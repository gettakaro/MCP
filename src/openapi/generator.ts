import { OpenAPILoader } from './loader.js';
import { SchemaResolver, OpenAPISpec } from './schema-resolver.js';
import { ToolMetadata } from '../tools/base.js';
import { Client } from '@takaro/apiclient';

interface GeneratedToolInfo {
  metadata: ToolMetadata;
  inputSchema: any;
  operationId: string;
  path: string;
  method: string;
  entityType: string;
  apiCallFn: (input: any, client: Client) => Promise<any>;
}

export class OpenAPIToolGenerator {
  constructor(
    private loader: OpenAPILoader,
    private resolver: SchemaResolver
  ) {}

  /**
   * Generate tools for all search endpoints in the OpenAPI spec
   */
  async generateSearchTools(): Promise<GeneratedToolInfo[]> {
    const spec = await this.loader.getSpec();
    const tools: GeneratedToolInfo[] = [];

    // Iterate through all paths in the OpenAPI spec
    for (const [path, pathItem] of Object.entries(spec.paths || {})) {
      // Check if this is a search endpoint (ends with /search)
      if (path.endsWith('/search')) {
        const tool = await this.generateSearchTool(path, pathItem, spec);
        if (tool) {
          tools.push(tool);
        }
      }
    }

    console.log(`Generated ${tools.length} search tools from OpenAPI spec`);
    return tools;
  }

  /**
   * Generate a single search tool from an OpenAPI path
   */
  private async generateSearchTool(
    path: string,
    pathItem: any,
    spec: OpenAPISpec
  ): Promise<GeneratedToolInfo | null> {
    // Search endpoints typically use POST method
    const operation = pathItem.post;
    if (!operation) {
      console.warn(`No POST operation found for search endpoint: ${path}`);
      return null;
    }

    // Extract entity type from path (e.g., /modules/search -> modules)
    const entityType = this.extractEntityType(path);
    if (!entityType) {
      console.warn(`Could not extract entity type from path: ${path}`);
      return null;
    }

    // Generate tool name (e.g., modules -> searchModules)
    const toolName = this.generateToolName(entityType);

    // Extract and resolve the request body schema
    const inputSchema = await this.extractInputSchema(operation, spec);
    if (!inputSchema) {
      console.warn(`No input schema found for ${path}`);
      return null;
    }

    // Build tool metadata
    const metadata: ToolMetadata = {
      name: toolName,
      description: operation.summary || operation.description || `Search ${entityType}`
    };

    // Create the API call function
    const apiCallFn = this.createApiCallFunction(
      operation.operationId || '', 
      path, 
      'post'
    );

    return {
      metadata,
      inputSchema,
      operationId: operation.operationId || '',
      path,
      method: 'post',
      entityType,
      apiCallFn
    };
  }

  /**
   * Extract entity type from a search path
   */
  private extractEntityType(path: string): string | null {
    // Match pattern like /modules/search, /players/search, etc.
    const match = path.match(/^\/([^\/]+)\/search$/);
    return match ? match[1] : null;
  }

  /**
   * Generate a tool name from entity type
   */
  private generateToolName(entityType: string): string {
    // Convert plural entity to singular for tool name
    // e.g., modules -> searchModules, players -> searchPlayers
    return `search${entityType.charAt(0).toUpperCase() + entityType.slice(1)}`;
  }

  /**
   * Extract and resolve the input schema from an operation
   */
  private async extractInputSchema(operation: any, _spec: OpenAPISpec): Promise<any> {
    // Check for request body
    if (!operation.requestBody) {
      return null;
    }

    // Get the schema from request body (usually in content['application/json'])
    const content = operation.requestBody.content;
    if (!content || !content['application/json']) {
      return null;
    }

    const mediaType = content['application/json'];
    if (!mediaType.schema) {
      return null;
    }

    // Resolve any $ref references in the schema
    const resolvedSchema = await this.resolver.resolveSchema(mediaType.schema);

    // Convert to MCP-compatible JSON Schema
    const mcpSchema = this.resolver.toMCPSchema(resolvedSchema);

    // Add required fields and metadata
    return {
      type: 'object',
      ...mcpSchema,
      $schema: 'http://json-schema.org/draft-07/schema#'
    };
  }

  /**
   * Generate tools for all endpoints (not just search)
   */
  async generateAllTools(): Promise<GeneratedToolInfo[]> {
    const spec = await this.loader.getSpec();
    const tools: GeneratedToolInfo[] = [];

    // Iterate through all paths in the OpenAPI spec
    for (const [path, pathItem] of Object.entries(spec.paths || {})) {
      // Process each HTTP method for this path
      for (const [method, operation] of Object.entries(pathItem as any)) {
        // Skip non-operation properties
        if (!['get', 'post', 'put', 'delete', 'patch'].includes(method.toLowerCase())) {
          continue;
        }

        const tool = await this.generateTool(path, method, operation, spec);
        if (tool) {
          tools.push(tool);
        }
      }
    }

    console.log(`Generated ${tools.length} tools from OpenAPI spec`);
    return tools;
  }

  /**
   * Generate a single tool from an OpenAPI operation
   */
  private async generateTool(
    path: string,
    method: string,
    operation: any,
    spec: OpenAPISpec
  ): Promise<GeneratedToolInfo | null> {
    // Skip if no operationId
    if (!operation.operationId) {
      console.warn(`No operationId found for ${method.toUpperCase()} ${path}`);
      return null;
    }

    // Extract entity type from path
    const entityType = this.extractEntityTypeFromPath(path);
    
    // Generate tool name based on operation
    const toolName = this.generateToolNameFromOperation(operation.operationId, path, method);
    
    // Extract and resolve the schema
    const inputSchema = await this.extractFullInputSchema(operation, path, spec);
    
    // Build tool metadata
    const metadata: ToolMetadata = {
      name: toolName,
      description: operation.summary || operation.description || `${method.toUpperCase()} ${path}`
    };

    // Create the API call function
    const apiCallFn = this.createApiCallFunction(
      operation.operationId,
      path,
      method
    );

    return {
      metadata,
      inputSchema: inputSchema || { type: 'object', properties: {}, $schema: 'http://json-schema.org/draft-07/schema#' },
      operationId: operation.operationId,
      path,
      method: method.toLowerCase(),
      entityType,
      apiCallFn
    };
  }

  /**
   * Extract entity type from any path pattern
   */
  private extractEntityTypeFromPath(path: string): string {
    // Try to extract entity from various patterns
    // /modules/search -> modules
    // /modules/{id} -> modules
    // /modules -> modules
    const match = path.match(/^\/([^\/\{]+)/);
    return match ? match[1] : 'unknown';
  }

  /**
   * Generate a tool name from operation ID
   */
  private generateToolNameFromOperation(operationId: string, path: string, method: string): string {
    // Convert ControllerName.methodName to controllerMethod format
    if (operationId && operationId.includes('.')) {
      const parts = operationId.split('.');
      if (parts.length >= 2) {
        // Extract controller name and method
        const controllerPart = parts[0];
        const methodName = parts[parts.length - 1];
        
        // Remove "Controller" suffix and convert to lowercase
        const controllerName = controllerPart.replace(/Controller$/i, '').toLowerCase();
        
        // Create tool name: controllerMethod (e.g., commandGetOne, userSearch)
        return `${controllerName}${methodName.charAt(0).toUpperCase() + methodName.slice(1)}`;
      }
    }
    
    // Use operationId if it's well-formed and doesn't have dots
    if (operationId && !operationId.includes('.')) {
      return operationId;
    }
    
    // Fallback: generate from path and method
    const entity = this.extractEntityTypeFromPath(path);
    const action = method.toLowerCase();
    
    // Handle path parameters
    const cleanPath = path.replace(/\{[^}]+\}/g, 'ById');
    const pathParts = cleanPath.split('/').filter(p => p && p !== entity);
    
    if (pathParts.length > 0) {
      return `${action}${entity.charAt(0).toUpperCase() + entity.slice(1)}${pathParts.join('')}`;
    }
    
    return `${action}${entity.charAt(0).toUpperCase() + entity.slice(1)}`;
  }

  /**
   * Extract input schema including path parameters, query parameters, and body
   */
  private async extractFullInputSchema(operation: any, _path: string, _spec: OpenAPISpec): Promise<any> {
    const properties: any = {};
    const required: string[] = [];

    // Extract path parameters
    if (operation.parameters) {
      for (const param of operation.parameters) {
        if (param.in === 'path' || param.in === 'query') {
          const paramSchema = param.schema ? await this.resolver.resolveSchema(param.schema) : { type: 'string' };
          properties[param.name] = {
            ...paramSchema,
            description: param.description
          };
          
          if (param.required) {
            required.push(param.name);
          }
        }
      }
    }

    // Extract request body schema
    if (operation.requestBody) {
      const content = operation.requestBody.content;
      if (content && content['application/json']) {
        const mediaType = content['application/json'];
        if (mediaType.schema) {
          const bodySchema = await this.resolver.resolveSchema(mediaType.schema);
          
          // If body schema is an object, merge its properties
          if (bodySchema.type === 'object' && bodySchema.properties) {
            Object.assign(properties, bodySchema.properties);
            if (bodySchema.required) {
              required.push(...bodySchema.required);
            }
          } else {
            // Otherwise, add it as a 'body' property
            properties.body = bodySchema;
            if (operation.requestBody.required) {
              required.push('body');
            }
          }
        }
      }
    }

    // Always return a valid schema object, even if empty
    return {
      type: 'object',
      properties,
      required: required.length > 0 ? required : undefined,
      $schema: 'http://json-schema.org/draft-07/schema#'
    };
  }

  /**
   * Convert operation ID to method name for dynamic API calls
   * e.g., "ModuleController.search" -> "moduleControllerSearch"
   * This will be fully implemented in Task 15
   */
  operationIdToMethod(operationId: string): string {
    if (!operationId) return '';
    
    // Split by dots and convert to camelCase
    const parts = operationId.split('.');
    if (parts.length === 0) return operationId;

    // Convert first part to lowercase, rest to camelCase
    let methodName = parts[0].charAt(0).toLowerCase() + parts[0].slice(1);
    
    // Append remaining parts with first letter capitalized
    for (let i = 1; i < parts.length; i++) {
      methodName += parts[i].charAt(0).toUpperCase() + parts[i].slice(1);
    }

    return methodName;
  }


  /**
   * Create a dynamic API call function that uses raw axios
   */
  private createApiCallFunction(
    operationId: string, 
    path: string, 
    method: string
  ): (input: any, client: Client) => Promise<any> {
    
    return async (input: any, client: Client) => {
      try {
        // Get the raw axios instance from the client
        const axios = (client as any).axiosInstance || (client as any).axios;
        
        if (!axios) {
          throw new Error('Could not access axios instance from client');
        }

        // Clone input to avoid modifying the original
        const requestData = { ...input };

        // Process path parameters (replace {param} with actual values)
        let processedPath = path;
        const pathParams: string[] = [];
        
        // Extract path parameter names
        const pathParamMatches = path.matchAll(/\{([^}]+)\}/g);
        for (const match of pathParamMatches) {
          pathParams.push(match[1]);
        }
        
        // Replace path parameters with actual values
        for (const paramName of pathParams) {
          if (paramName in requestData) {
            processedPath = processedPath.replace(`{${paramName}}`, encodeURIComponent(requestData[paramName]));
            // Remove the path parameter from requestData so it's not sent as query/body
            delete requestData[paramName];
          } else {
            throw new Error(`Missing required path parameter: ${paramName}`);
          }
        }
        
        // Prepare axios request config
        const axiosConfig: any = {
          method: method.toLowerCase(),
          url: processedPath,
        };
        
        // Handle query parameters vs request body based on method
        if (['get', 'delete'].includes(method.toLowerCase())) {
          // For GET and DELETE, parameters go in query string
          if (Object.keys(requestData).length > 0) {
            axiosConfig.params = requestData;
          }
        } else {
          // For POST, PUT, PATCH, parameters go in request body
          if (Object.keys(requestData).length > 0) {
            axiosConfig.data = requestData;
          }
        }
        
        // Make the request
        const response = await axios.request(axiosConfig);
        return response;
        
      } catch (error) {
        console.error(`Error calling ${operationId} (${method} ${path}):`, error);
        throw error;
      }
    };
  }
}