# OpenAPI-Driven MCP Server Architecture Design Document

## Codebase Analysis

The current implementation shows a well-structured but monolithic approach:

- **Single file architecture**: `src/index.ts` contains all server logic (399 lines)
- **Express patterns**: Standard Express middleware, JSON body parsing, route handlers
- **Authentication pattern**: Singleton client pattern in `src/client.ts` with environment-based config
- **Manual tool definitions**: Hard-coded schemas and handlers within switch statements
- **Session management**: Map-based session storage with UUID generation
- **Error handling**: Consistent JSON-RPC error responses with proper error codes
- **Code style**: TypeScript with explicit types, async/await patterns, descriptive variable names

## Extension vs. Creation Analysis

**Existing systems to extend:**
- Express server setup (lines 8-10) - Add route registration system
- Session management (line 61) - Keep existing Map-based approach
- Client singleton (src/client.ts) - Reuse for all API calls
- Error response patterns (lines 189-197, 291-299) - Standardize in base class
- MCP protocol switch statement (line 83) - Replace with registry pattern

**Why new components are necessary:**
- **Tool registry**: No existing plugin/extension system to leverage
- **OpenAPI integration**: No schema loading mechanism exists
- **Dynamic tool generation**: Current hard-coded approach doesn't scale

## Overview

This design transforms the MCP server from a monolithic, manually-maintained system to a dynamic, OpenAPI-driven architecture. By parsing Takaro's OpenAPI specification, we automatically generate MCP tools for every API endpoint, eliminating manual schema definitions and ensuring the server always reflects the latest API capabilities.

**Goals:**
- Zero manual schema maintenance
- Automatic tool generation from OpenAPI spec
- Maintain existing authentication and session patterns
- Preserve current error handling consistency
- Scale to hundreds of API endpoints

**Non-goals:**
- Changing authentication mechanism
- Modifying MCP protocol implementation
- Altering session management approach

## Feature Integration & Consistency

The OpenAPI-driven system integrates seamlessly with existing components:

- **Authentication**: Uses existing `getClient()` singleton pattern
- **Error handling**: Extends current JSON-RPC error format
- **Session management**: Maintains Map-based session storage
- **Express routing**: Enhances existing `/mcp` endpoints
- **Tool execution**: Follows current request/response patterns

## Architecture

### Component Integration
```
┌─────────────────┐     ┌──────────────────┐
│  Express Server │────▶│  MCP Handler     │
│  (existing)     │     │  (refactored)    │
└─────────────────┘     └──────────────────┘
                               │
                               ▼
                        ┌──────────────────┐
                        │  Tool Registry   │
                        │  (new)           │
                        └──────────────────┘
                               │
                    ┌──────────┴──────────┐
                    ▼                     ▼
             ┌──────────────┐      ┌──────────────┐
             │ OpenAPI Tools│      │ Custom Tools │
             │ (generated)  │      │ (echo, etc)  │
             └──────────────┘      └──────────────┘
                    │
                    ▼
             ┌──────────────┐
             │ Takaro Client│
             │ (existing)   │
             └──────────────┘
```

### Key Extensions:
1. **MCP Handler**: Refactor switch statement into registry-based dispatch
2. **Tool Registry**: Central registration point for all tools
3. **OpenAPI Loader**: Cache and parse OpenAPI specification
4. **Dynamic Tools**: Generated from OpenAPI paths and operations

## Components and Interfaces

### Extending Existing Components

**MCP Handler (refactored from index.ts lines 64-336):**
```typescript
// Extends existing request handling pattern
class MCPHandler {
  constructor(private registry: ToolRegistry) {}
  
  async handleRequest(method: string, params: any, sessionId: string): Promise<any> {
    // Preserves existing method routing
    switch (method) {
      case 'initialize': return this.handleInitialize(sessionId);
      case 'tools/list': return this.handleToolsList();
      case 'tools/call': return this.handleToolCall(params);
    }
  }
}
```

### New Components (Required for Scalability)

**Tool Registry:**
```typescript
interface Tool {
  metadata: ToolMetadata;
  inputSchema: any; // OpenAPI JSON Schema
  execute(input: any, context: ToolContext): Promise<ToolResult>;
}

class ToolRegistry {
  private tools = new Map<string, Tool>();
  
  register(tool: Tool): void {
    this.tools.set(tool.metadata.name, tool);
  }
}
```

**OpenAPI Tool Generator:**
```typescript
class OpenAPIToolGenerator {
  async generateTools(): Promise<Tool[]> {
    const spec = await this.loader.getSpec();
    // Parse paths and generate tools
  }
}
```

## Data Models

### Extensions to Existing Models

**Session Data (extends line 61):**
```typescript
interface SessionData {
  created: number;  // existing
  client?: Client;  // cached client instance
  toolsCache?: Tool[]; // cached tool list
}
```

### New Data Structures

**OpenAPI Cache:**
```typescript
interface OpenAPICache {
  spec: OpenAPISpec;
  lastFetch: number;
  tools: Map<string, Tool>;
}
```

## Security Considerations

### Threat Model
- **API Key Exposure**: Environment variables remain secure
- **Origin Validation**: Extends existing `isAllowedOrigin()` function
- **Schema Injection**: OpenAPI schemas are read-only from trusted source
- **Rate Limiting**: Inherit from Takaro API client

### Security Controls
- Maintain existing origin validation (lines 372-383)
- No direct schema modification allowed
- All API calls through authenticated client
- Input validation via OpenAPI schemas

## Implementation Details

### Pattern Adherence

**Error Handling (follows lines 289-300):**
```typescript
catch (error) {
  console.error('Error in tool execution:', error);
  return res.json({
    jsonrpc: '2.0',
    error: {
      code: -32603,
      message: 'Failed to execute tool',
      data: error instanceof Error ? error.message : 'Unknown error'
    },
    id: req.body.id
  });
}
```

**Client Usage (follows src/client.ts pattern):**
```typescript
const context: ToolContext = {
  client: await getClient(),
  sessionId: sessionId
};
```

### File Organization
```
src/
├── server/
│   ├── mcp-handler.ts    # Refactored from index.ts
│   └── session.ts        # Extracted from index.ts
├── tools/
│   ├── registry.ts       # New tool management
│   └── custom/
│       └── echo.ts       # Existing echo tool
├── openapi/
│   ├── loader.ts         # OpenAPI fetching/caching
│   └── generator.ts      # Tool generation
└── index.ts              # Simplified entry point
```

## Error Handling

Extends existing patterns:
- JSON-RPC error codes (preserved from current implementation)
- Consistent error structure with code, message, and data
- Console logging for debugging (following line 290 pattern)
- Graceful fallbacks for OpenAPI fetch failures

## Testing Strategy

### Unit Tests
- Tool registry operations
- OpenAPI schema parsing
- Individual tool execution
- Error handling paths

### Integration Tests
- Full MCP request/response cycle
- OpenAPI loading and caching
- Tool discovery and registration
- Session management

### E2E Tests
- Complete tool execution flow
- Multiple concurrent sessions
- Error scenarios
- Cache invalidation

Follows existing test patterns found in the project structure.

## Documentation Plan

### User Documentation
- How to add custom tools
- Environment variable configuration
- Supported Takaro API operations
- Troubleshooting guide

### Developer Documentation
- Architecture overview
- Extension points
- OpenAPI schema mapping
- Tool generation process

### Migration Guide
- Moving from current implementation
- Custom tool conversion
- Configuration changes

## Summary

This design extends the existing MCP server architecture to support automatic tool generation from OpenAPI specifications. By building on current patterns for authentication, error handling, and session management, we maintain consistency while dramatically improving scalability. The registry-based approach allows for both generated and custom tools, providing flexibility for future enhancements while eliminating manual schema maintenance.