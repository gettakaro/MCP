import { Tool } from './base.js';

export interface MCPTool {
  name: string;
  description: string;
  inputSchema: any;
}

export class ToolRegistry {
  private tools = new Map<string, Tool>();

  /**
   * Register a new tool in the registry
   */
  register(tool: Tool): void {
    const name = tool.metadata.name;
    
    if (this.tools.has(name)) {
      console.warn(`Tool "${name}" is already registered. Overwriting existing tool.`);
    }
    
    this.tools.set(name, tool);
    console.log(`Registered tool: ${name}`);
  }

  /**
   * Get a tool by name
   */
  get(name: string): Tool | undefined {
    return this.tools.get(name);
  }

  /**
   * List all registered tools
   */
  list(): Tool[] {
    return Array.from(this.tools.values());
  }

  /**
   * Convert registry tools to MCP format for protocol responses
   */
  toMCPFormat(): MCPTool[] {
    return this.list().map(tool => ({
      name: tool.metadata.name,
      description: tool.metadata.description,
      inputSchema: tool.inputSchema
    }));
  }

  /**
   * Get the number of registered tools
   */
  size(): number {
    return this.tools.size;
  }

  /**
   * Clear all registered tools
   */
  clear(): void {
    this.tools.clear();
    console.log('Tool registry cleared');
  }

  /**
   * Check if a tool exists
   */
  has(name: string): boolean {
    return this.tools.has(name);
  }
}