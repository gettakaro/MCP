import { Tool, ToolMetadata, ToolContext, ToolResult } from './base.js';
import { Client } from '@takaro/apiclient';
import { ResponseFormatter } from '../utils/formatters.js';

/**
 * DynamicTool implements the Tool interface for dynamically generated tools
 * from OpenAPI specifications. It handles API calls and response formatting.
 */
export class DynamicTool implements Tool {
  public readonly metadata: ToolMetadata;
  public readonly inputSchema: any;

  constructor(
    metadata: ToolMetadata,
    inputSchema: any,
    private apiCallFn: (input: any, client: Client) => Promise<any>,
    private formatter: ResponseFormatter,
    private entityType: string
  ) {
    this.metadata = metadata;
    this.inputSchema = inputSchema;
  }

  /**
   * Execute the tool with the given input and context
   */
  async execute(input: any, context: ToolContext): Promise<ToolResult> {
    try {
      // Basic input validation
      if (this.inputSchema.required) {
        for (const requiredField of this.inputSchema.required) {
          if (!(requiredField in input)) {
            throw new Error(`Missing required field: ${requiredField}`);
          }
        }
      }

      // Call the API using the provided function
      const apiResponse = await this.apiCallFn(input, context.client);

      // Handle different response structures
      if (this.isSearchOperation()) {
        // Search operations return paginated responses
        const response = {
          data: apiResponse.data?.data || [],
          meta: apiResponse.data?.meta || {}
        };
        
        return this.formatter.formatPaginatedList(response, this.entityType, input);
      } else {
        // Single entity operations
        const entity = apiResponse.data?.data || apiResponse.data;
        return this.formatter.formatSingleEntity(entity, this.entityType);
      }
    } catch (error) {
      // Handle Takaro API errors
      if (this.isTakaroError(error)) {
        return this.formatter.formatError(error);
      }

      // Handle other errors
      console.error(`Error executing ${this.metadata.name}:`, error);
      
      return {
        content: [{
          type: 'text',
          text: `Failed to execute ${this.metadata.name}: ${error instanceof Error ? error.message : 'Unknown error'}`
        }]
      };
    }
  }

  /**
   * Check if this is a search operation based on the tool name
   */
  private isSearchOperation(): boolean {
    return this.metadata.name.toLowerCase().startsWith('search');
  }

  /**
   * Check if the error is a Takaro API error with structured error response
   */
  private isTakaroError(error: any): boolean {
    return error?.response?.data?.errors !== undefined;
  }
}

/**
 * Factory function to create a DynamicTool from generated tool info
 */
export function createDynamicTool(
  toolInfo: {
    metadata: ToolMetadata;
    inputSchema: any;
    operationId: string;
    path: string;
    method: string;
    entityType: string;
    apiCallFn: (input: any, client: Client) => Promise<any>;
  },
  formatter: ResponseFormatter
): DynamicTool {
  return new DynamicTool(
    toolInfo.metadata,
    toolInfo.inputSchema,
    toolInfo.apiCallFn,
    formatter,
    toolInfo.entityType
  );
}