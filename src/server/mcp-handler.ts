import { ToolRegistry } from '../tools/registry.js';
import { ToolContext } from '../tools/base.js';
import { SessionManager } from './session.js';
import { getClient } from '../client.js';

export interface MCPRequest {
  method: string;
  params?: any;
  id?: string | number | null;
}

export interface MCPResponse {
  jsonrpc: '2.0';
  result?: any;
  error?: {
    code: number;
    message: string;
    data?: any;
  };
  id: string | number | null;
}

export class MCPHandler {
  constructor(
    private registry: ToolRegistry,
    private sessionManager: SessionManager
  ) {}

  async handleRequest(
    method: string,
    params: any,
    sessionId: string | undefined,
    requestId: string | number | null,
    setHeader?: (name: string, value: string) => void
  ): Promise<MCPResponse> {
    try {
      switch (method) {
        case 'initialize':
          return await this.handleInitialize(sessionId, requestId, setHeader);
        case 'tools/list':
          return this.handleToolsList(requestId);
        case 'tools/call':
          return await this.handleToolCall(params, sessionId, requestId);
        default:
          return {
            jsonrpc: '2.0',
            error: {
              code: -32601,
              message: `Method not found: ${method}`
            },
            id: requestId
          };
      }
    } catch (error) {
      console.error('Error handling request:', error);
      return {
        jsonrpc: '2.0',
        error: {
          code: -32603,
          message: 'Internal error',
          data: error instanceof Error ? error.message : 'Unknown error'
        },
        id: requestId
      };
    }
  }

  private async handleInitialize(
    sessionId: string | undefined,
    requestId: string | number | null,
    setHeader?: (name: string, value: string) => void
  ): Promise<MCPResponse> {
    const sessionResult = this.sessionManager.getOrCreate(sessionId);
    
    if (sessionResult.isNew && setHeader) {
      setHeader('Mcp-Session-Id', sessionResult.sessionId);
    }

    return {
      jsonrpc: '2.0',
      result: {
        protocolVersion: '2024-11-05',
        capabilities: {
          tools: {}
        },
        serverInfo: {
          name: 'takaro-mcp',
          version: '1.0.0'
        }
      },
      id: requestId
    };
  }

  private handleToolsList(requestId: string | number | null): MCPResponse {
    const tools = this.registry.toMCPFormat();

    return {
      jsonrpc: '2.0',
      result: {
        tools
      },
      id: requestId
    };
  }

  private async handleToolCall(
    params: any,
    sessionId: string | undefined,
    requestId: string | number | null
  ): Promise<MCPResponse> {
    const { name, arguments: args } = params || {};

    // Security: Validate session ID is provided
    if (!sessionId) {
      return {
        jsonrpc: '2.0',
        error: {
          code: -32602,
          message: 'Session ID required for tool execution'
        },
        id: requestId
      };
    }

    // Security: Verify session exists in SessionManager
    if (!this.sessionManager.has(sessionId)) {
      return {
        jsonrpc: '2.0',
        error: {
          code: -32602,
          message: 'Invalid or expired session'
        },
        id: requestId
      };
    }

    // Look up tool in registry
    const tool = this.registry.get(name);
    
    if (!tool) {
      return {
        jsonrpc: '2.0',
        error: {
          code: -32601,
          message: `Unknown tool: ${name}`
        },
        id: requestId
      };
    }

    try {
      // Security: Create context with authenticated client
      // The getClient() function ensures proper authentication with Takaro API
      const context: ToolContext = {
        client: await getClient(),
        sessionId: sessionId
      };

      // Execute tool with validated context
      const result = await tool.execute(args, context);

      return {
        jsonrpc: '2.0',
        result,
        id: requestId
      };
    } catch (error) {
      console.error('Error in tool execution:', error);
      
      // Check if it's a validation error
      if (error instanceof Error && error.message.includes('Invalid parameters')) {
        return {
          jsonrpc: '2.0',
          error: {
            code: -32602,
            message: 'Invalid parameters',
            data: error.message
          },
          id: requestId
        };
      }

      // Security: Generic execution error without exposing internal details
      // Log the actual error for debugging but don't expose it to client
      console.error(`Tool execution error for ${name}:`, error);
      
      return {
        jsonrpc: '2.0',
        error: {
          code: -32603,
          message: 'Failed to execute tool',
          data: 'An error occurred during tool execution'
        },
        id: requestId
      };
    }
  }
}