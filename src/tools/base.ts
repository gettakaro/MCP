import { Client } from '@takaro/apiclient';

export interface ToolMetadata {
  name: string;
  description: string;
}

export interface ToolContext {
  client: Client;
  sessionId: string;
}

export interface ToolResult {
  content: Array<{
    type: 'text' | 'image' | 'resource';
    text?: string;
    data?: string;
    uri?: string;
    mimeType?: string;
  }>;
}

export interface Tool {
  metadata: ToolMetadata;
  inputSchema: any; // JSON Schema object
  execute(input: any, context: ToolContext): Promise<ToolResult>;
}