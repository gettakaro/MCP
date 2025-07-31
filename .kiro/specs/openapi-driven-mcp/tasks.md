# Implementation Tasks for OpenAPI-Driven MCP Server

## Overview
Transform the monolithic MCP server into a scalable, OpenAPI-driven architecture by refactoring existing code into modular components and adding automatic tool generation from Takaro's OpenAPI specification. The existing hardcoded tools (echo and searchModules) will be removed as they'll be auto-generated from the OpenAPI spec.

## Phase 1: Core Infrastructure Setup
Extract and modularize existing functionality without changing behavior.

- [x] Task 1: Create directory structure and move existing code
  - **Prompt**: Create the new directory structure (src/server, src/tools, src/openapi, src/types, src/utils) and move the existing Express server setup from index.ts into src/server/index.ts. Keep all functionality identical but prepare for modularization.
  - **Requirements**: REQ-ARCH-001 (Modular architecture)
  - **Design ref**: Section "File Organization"
  - **Files**: src/server/index.ts, src/types/index.ts

- [x] Task 2: Extract session management
  - **Prompt**: Extract session management logic from index.ts (lines around 61 and session-related code) into src/server/session.ts. Create a SessionManager class that wraps the existing Map-based storage with methods like create(), get(), delete(). Maintain the same UUID generation and data structure.
  - **Requirements**: REQ-ARCH-002 (Session management)
  - **Design ref**: Section "Session Data (extends line 61)"
  - **Files**: src/server/session.ts

- [x] Task 3: Create base tool interfaces
  - **Prompt**: Define the core tool interfaces in src/tools/base.ts following the design. Include Tool interface with metadata, inputSchema, and execute method. Create ToolMetadata, ToolContext, and ToolResult types. These will be the foundation for all tools.
  - **Requirements**: REQ-TOOL-001 (Tool abstraction)
  - **Design ref**: Section "Tool Registry" interface definitions
  - **Files**: src/tools/base.ts, src/types/tool.ts

## Phase 2: Tool Registry Implementation
Build the tool management system that will replace the hardcoded switch statements.

- [x] Task 4: Implement tool registry
  - **Prompt**: Create ToolRegistry class in src/tools/registry.ts with register(), get(), and list() methods using Map storage. Add logging for tool registration. Include method to convert tool schemas to JSON Schema format for MCP protocol.
  - **Requirements**: REQ-TOOL-002 (Dynamic tool registration)
  - **Design ref**: Section "Tool Registry" class
  - **Files**: src/tools/registry.ts

- [x] Task 5: ~~Create echo tool as custom example~~ (Skipped - tools will be auto-generated from OpenAPI)
  - **Prompt**: ~~Create a simple echo tool in src/tools/custom/echo.ts implementing the Tool interface. This will be the only custom tool to demonstrate how non-OpenAPI tools can be added. Keep it minimal - just echo back the input message.~~
  - **Requirements**: REQ-TOOL-003 (Custom tool support)
  - **Design ref**: Section "Custom Tools"
  - **Files**: ~~src/tools/custom/echo.ts~~
  - **Note**: Skipped as per design decision - all tools including echo will be auto-generated from OpenAPI spec

## Phase 3: MCP Handler Refactoring
Replace the monolithic switch statement with a registry-based handler.

- [x] Task 7: Create MCP handler class
  - **Prompt**: Create MCPHandler class in src/server/mcp-handler.ts that takes a ToolRegistry in constructor. Implement handleRequest() method that preserves the existing switch for 'initialize', 'tools/list', and 'tools/call' but uses registry for tool operations. Maintain exact JSON-RPC response format.
  - **Requirements**: REQ-MCP-001 (Protocol handling)
  - **Design ref**: Section "MCP Handler (refactored from index.ts lines 64-336)"
  - **Files**: src/server/mcp-handler.ts

- [x] Task 8: Implement tools/list using registry
  - **Prompt**: In MCPHandler, implement handleToolsList() to iterate through registry.list() and return tools with their schemas converted to JSON Schema format. Match the exact response structure from the current implementation.
  - **Requirements**: REQ-MCP-002 (Tool discovery)
  - **Design ref**: Section "MCP Handler" handleToolsList
  - **Files**: src/server/mcp-handler.ts (update)

- [x] Task 9: Implement tools/call using registry
  - **Prompt**: In MCPHandler, implement handleToolCall() to look up tools in registry, validate input against tool schema, create context with client and sessionId, and execute. Preserve all error handling patterns including -32601 for unknown tools and -32602 for invalid parameters.
  - **Requirements**: REQ-MCP-003 (Tool execution)
  - **Design ref**: Section "Error Handling (follows lines 289-300)"
  - **Files**: src/server/mcp-handler.ts (update)

## Phase 4: OpenAPI Integration
Add the ability to load and parse OpenAPI specifications.

- [x] Task 10: Create OpenAPI loader
  - **Prompt**: Implement OpenAPILoader class in src/openapi/loader.ts that fetches from ${process.env.TAKARO_HOST || 'https://api.takaro.io'}/openapi.json with 24-hour caching. Use the same host configuration as the Takaro client. Include local file caching for offline development. Add retry logic and error handling for network failures.
  - **Requirements**: REQ-OPENAPI-001 (Spec loading)
  - **Design ref**: Section "OpenAPI Loader"
  - **Files**: src/openapi/loader.ts

- [x] Task 11: Implement schema resolver
  - **Prompt**: Create SchemaResolver class in src/openapi/schema-resolver.ts that resolves $ref references in OpenAPI schemas. Implement resolveSchema() to handle nested references and toMCPSchema() to clean OpenAPI-specific fields for MCP compatibility.
  - **Requirements**: REQ-OPENAPI-002 (Schema resolution)
  - **Design ref**: Section "Schema Resolver"
  - **Files**: src/openapi/schema-resolver.ts

- [x] Task 12: Create response formatters
  - **Prompt**: Implement ResponseFormatter in src/utils/formatters.ts with entity-specific formatting for modules, players, gameservers, etc. Include formatPaginatedList() for consistent pagination display with format "Found X items (page Y of Z)" followed by numbered list of formatted items.
  - **Requirements**: REQ-FORMAT-001 (Response formatting)
  - **Design ref**: Section "Intelligent Formatters"
  - **Files**: src/utils/formatters.ts

## Phase 5: Dynamic Tool Generation
Implement automatic tool creation from OpenAPI paths.

- [x] Task 13: Create tool generator for search operations
  - **Prompt**: Implement OpenAPIToolGenerator in src/openapi/generator.ts that parses OpenAPI paths and creates tools for /*/search endpoints. Extract entity name, create tool name like searchModules, use request schema from OpenAPI, and generate execute function that calls appropriate API method.
  - **Requirements**: REQ-GEN-001 (Search tool generation)
  - **Design ref**: Section "OpenAPI Tool Generator"
  - **Files**: src/openapi/generator.ts

- [x] Task 14: Add dynamic tool execution
  - **Prompt**: Create DynamicTool class in src/tools/dynamic.ts that implements Tool interface with constructor taking metadata, schema, API call function, and formatter. Implement execute() to call API with error handling that extracts Takaro error messages.
  - **Requirements**: REQ-GEN-002 (Dynamic execution)
  - **Design ref**: Section "Dynamic Tool Execution"
  - **Files**: src/tools/dynamic.ts

- [x] Task 15: Implement operation ID mapping
  - **Prompt**: In OpenAPIToolGenerator, add operationIdToMethod() that converts OpenAPI operation IDs like "ModuleController.search" to method names like "moduleControllerSearch". Add logic to dynamically access client API modules.
  - **Requirements**: REQ-GEN-003 (API method mapping)
  - **Design ref**: Section "operationIdToMethod"
  - **Files**: src/openapi/generator.ts (update)

## Phase 6: Integration and Migration
Wire everything together and migrate from the monolithic structure.

- [x] Task 16: Update Express server integration
  - **Prompt**: Refactor src/index.ts to create instances of ToolRegistry, OpenAPILoader, and MCPHandler. Initialize registry with both custom tools and OpenAPI-generated tools on startup. Replace the switch statement with handler.handleRequest() calls.
  - **Requirements**: REQ-INT-001 (Server integration)
  - **Design ref**: Section "Key Extensions"
  - **Files**: src/index.ts

- [x] Task 17: Add startup initialization
  - **Prompt**: In src/index.ts, implement async initialization that loads OpenAPI spec, generates tools, registers custom tools, and logs the number of loaded tools. Add error handling with graceful fallback if OpenAPI loading fails.
  - **Requirements**: REQ-INT-002 (Startup sequence)
  - **Design ref**: Section "Tool Registry with Auto-Discovery"
  - **Files**: src/index.ts (update)

- [x] Task 18: Preserve security controls
  - **Prompt**: Ensure all security measures are maintained: origin validation using existing isAllowedOrigin(), session validation, and authentication through getClient(). Verify no new attack vectors are introduced.
  - **Requirements**: REQ-SEC-001 (Security preservation)
  - **Design ref**: Section "Security Controls"
  - **Files**: src/server/mcp-handler.ts (verify)

## Phase 7: Testing and Validation
Ensure the refactored system maintains all existing functionality.

- [x] Task 19: Create integration tests
  - **Prompt**: Write integration tests in src/__tests__/integration.test.ts that verify the complete MCP flow: initialize session, list tools (including dynamically generated ones), and execute both custom and generated tools. Compare responses with original implementation.
  - **Requirements**: REQ-TEST-001 (Integration testing)
  - **Design ref**: Section "Integration Tests"
  - **Files**: src/__tests__/integration.test.ts

- [ ] Task 20: Add tool generation tests
  - **Prompt**: Create unit tests in src/openapi/__tests__/generator.test.ts that verify correct tool generation from sample OpenAPI paths, proper schema extraction, and operation ID mapping. Use a minimal OpenAPI spec fixture.
  - **Requirements**: REQ-TEST-002 (Unit testing)
  - **Design ref**: Section "Unit Tests"
  - **Files**: src/openapi/__tests__/generator.test.ts

## Phase 8: Extended Tool Support
Add support for more API operation types beyond search.

- [ ] Task 21: Add CRUD operation support
  - **Prompt**: Extend OpenAPIToolGenerator to handle GET /entity/{id}, POST /entity, PUT /entity/{id}, and DELETE /entity/{id} patterns. Create tools like getModule, createPlayer, updateGameserver, deleteItem with appropriate schemas and execution logic.
  - **Requirements**: REQ-GEN-004 (CRUD operations)
  - **Design ref**: Section "Tool Patterns"
  - **Files**: src/openapi/generator.ts (update)

- [ ] Task 22: Add special operation support
  - **Prompt**: Extend generator to handle special endpoints like /trigger, /export, /executions. Create appropriate tool names and handle various HTTP methods. Ensure proper parameter extraction from paths.
  - **Requirements**: REQ-GEN-005 (Special operations)
  - **Design ref**: Section "Tool Patterns"
  - **Files**: src/openapi/generator.ts (update)