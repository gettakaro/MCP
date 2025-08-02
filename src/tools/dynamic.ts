import { Tool, ToolMetadata, ToolContext, ToolResult } from './base.js';
import { Client } from '@takaro/apiclient';

/**
 * DynamicTool implements the Tool interface for dynamically generated tools
 * from OpenAPI specifications. It handles API calls and returns raw JSON responses.
 */
export class DynamicTool implements Tool {
  public readonly metadata: ToolMetadata;
  public readonly inputSchema: any;

  constructor(
    metadata: ToolMetadata,
    inputSchema: any,
    private apiCallFn: (input: any, client: Client) => Promise<any>
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

      // Return raw JSON response
      const responseData = apiResponse.data?.data !== undefined 
        ? apiResponse.data 
        : apiResponse;

      return {
        content: [{
          type: 'text',
          text: JSON.stringify(responseData, null, 2)
        }]
      };
    } catch (error) {
      // Handle errors and return them as JSON
      console.error(`Error executing ${this.metadata.name}:`, error);
      
      let errorResponse: any = {
        error: true,
        message: error instanceof Error ? error.message : 'Unknown error'
      };

      // Include Takaro API error details if available
      if (this.isTakaroError(error)) {
        errorResponse.status = (error as any).response.status;
        errorResponse.statusText = (error as any).response.statusText;
        errorResponse.details = (error as any).response.data;
      }

      return {
        content: [{
          type: 'text',
          text: JSON.stringify(errorResponse, null, 2)
        }]
      };
    }
  }

  /**
   * Check if the error is an axios error with response data
   */
  private isTakaroError(error: any): boolean {
    return error?.response?.data !== undefined;
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
  }
): DynamicTool {
  return new DynamicTool(
    toolInfo.metadata,
    toolInfo.inputSchema,
    toolInfo.apiCallFn
  );
}