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
    const apiCallFn = this.createApiCallFunction(operation.operationId || '');

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
   * This will be implemented in later tasks
   */
  async generateAllTools(): Promise<GeneratedToolInfo[]> {
    // Placeholder for future implementation
    // Will handle CRUD operations, special endpoints, etc.
    return this.generateSearchTools();
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
   * Extract controller name from operation ID
   * e.g., "ModuleController.search" -> "module"
   */
  private extractControllerName(operationId: string): string {
    if (!operationId) return '';
    
    // Extract the controller part (before the first dot)
    const parts = operationId.split('.');
    if (parts.length === 0) return '';
    
    const controllerPart = parts[0];
    
    // Remove "Controller" suffix if present
    const controllerName = controllerPart.replace(/Controller$/i, '');
    
    // Convert to lowercase for client module access
    return controllerName.toLowerCase();
  }

  /**
   * Create a dynamic API call function based on operation ID
   */
  private createApiCallFunction(operationId: string): (input: any, client: Client) => Promise<any> {
    const controllerName = this.extractControllerName(operationId);
    const methodName = this.operationIdToMethod(operationId);
    
    return async (input: any, client: Client) => {
      try {
        // Dynamically access the client module and method
        const controller = (client as any)[controllerName];
        
        if (!controller) {
          throw new Error(`Controller '${controllerName}' not found in Takaro client`);
        }
        
        const method = controller[methodName];
        
        if (!method || typeof method !== 'function') {
          throw new Error(`Method '${methodName}' not found in controller '${controllerName}'`);
        }
        
        // Call the method with the input
        return await method.call(controller, input);
      } catch (error) {
        console.error(`Error calling ${controllerName}.${methodName}:`, error);
        throw error;
      }
    };
  }
}