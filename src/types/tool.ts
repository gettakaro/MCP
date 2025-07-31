// Re-export tool types from base for easier imports
export { Tool, ToolMetadata, ToolContext, ToolResult } from '../tools/base.js';

// Import for use in additional types
import type { Tool } from '../tools/base.js';

// Additional tool-related types

export interface ToolError {
  code: number;
  message: string;
  data?: any;
}

export interface ToolRegistration {
  tool: Tool;
  source: 'custom' | 'openapi';
  priority?: number;
}