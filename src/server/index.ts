#!/usr/bin/env node

import express, { Request, Response } from 'express';
import { getClient } from '../client.js';
import { SessionManager } from './session.js';
import { MCPHandler } from './mcp-handler.js';
import { ToolRegistry } from '../tools/registry.js';
import { OpenAPILoader } from '../openapi/loader.js';
import { OpenAPIToolGenerator } from '../openapi/generator.js';
import { SchemaResolver } from '../openapi/schema-resolver.js';
import { ResponseFormatter } from '../utils/formatters.js';
import { createDynamicTool } from '../tools/dynamic.js';

// Create Express app
const app = express();
app.use(express.json());

// Server configuration
const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || '127.0.0.1';

// Initialize components
const toolRegistry = new ToolRegistry();
const sessionManager = new SessionManager();
const mcpHandler = new MCPHandler(toolRegistry, sessionManager);

// Initialize tools from OpenAPI specification
async function initializeTools(): Promise<void> {
  try {
    console.log('Loading tools from OpenAPI specification...');
    
    // Initialize OpenAPI components
    const openAPILoader = new OpenAPILoader();
    const responseFormatter = new ResponseFormatter();
    
    // Load OpenAPI spec
    const spec = await openAPILoader.getSpec();
    const schemaResolver = new SchemaResolver(spec);
    const toolGenerator = new OpenAPIToolGenerator(openAPILoader, schemaResolver);
    
    // Generate tools from OpenAPI
    const searchTools = await toolGenerator.generateSearchTools();
    
    // Register each generated tool
    for (const toolInfo of searchTools) {
      const dynamicTool = createDynamicTool(toolInfo, responseFormatter);
      toolRegistry.register(dynamicTool);
    }
    
    console.log(`Successfully loaded ${searchTools.length} tools from OpenAPI spec`);
  } catch (error) {
    console.error('Failed to load OpenAPI tools:', error);
    console.log('Server will continue with no dynamically loaded tools');
  }
}

// MCP endpoint - handles both POST and GET
// Security Architecture:
// 1. Origin validation prevents DNS rebinding attacks
// 2. Session validation ensures authenticated requests
// 3. Client authentication via getClient() for all API calls
// 4. Rate limiting inherited from Takaro API client
app.post('/mcp', async (req: Request, res: Response) => {
  try {
    // Security: Validate Origin header to prevent DNS rebinding attacks
    const origin = req.headers.origin;
    if (origin && !isAllowedOrigin(origin)) {
      return res.status(403).json({
        jsonrpc: '2.0',
        error: {
          code: -32000,
          message: 'Forbidden: Invalid origin'
        },
        id: req.body.id || null
      });
    }

    // Handle session management
    let sessionId = req.headers['mcp-session-id'] as string;

    // Delegate to MCP handler
    const response = await mcpHandler.handleRequest(
      req.body.method,
      req.body.params,
      sessionId,
      req.body.id,
      (name, value) => res.setHeader(name, value)
    );
    
    return res.json(response);
  } catch (error) {
    console.error('Error handling request:', error);

    // Generic error
    return res.status(500).json({
      jsonrpc: '2.0',
      error: {
        code: -32603,
        message: 'Internal error',
        data: error instanceof Error ? error.message : 'Unknown error'
      },
      id: req.body.id || null
    });
  }
});

// Support GET for SSE connections
app.get('/mcp', (req: Request, res: Response): any => {
  const sessionId = req.headers['mcp-session-id'] as string;

  if (!sessionId || !sessionManager.has(sessionId)) {
    return res.status(400).json({
      error: 'Session ID required for SSE connection'
    });
  }

  // Set up SSE
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');

  // Send initial connection message
  res.write(':ok\n\n');

  // Keep connection alive
  const keepAlive = setInterval(() => {
    res.write(':keepalive\n\n');
  }, 30000);

  // Clean up on disconnect
  req.on('close', () => {
    clearInterval(keepAlive);
  });
});

// Security: Helper function to validate origins
// This prevents DNS rebinding attacks and unauthorized access
function isAllowedOrigin(origin: string): boolean {
  // TODO: In production, implement proper origin validation with:
  // - Environment-based configuration
  // - Wildcard support for subdomains if needed
  // - Stricter validation rules
  const allowedOrigins = [
    'http://localhost:3000',
    'http://127.0.0.1:3000',
    'https://localhost:3000',
    'https://127.0.0.1:3000'
  ];

  return allowedOrigins.includes(origin);
}

// Initialize and start server
(async () => {
  try {
    // Authenticate client first, before initializing tools
    await getClient();
    
    // Initialize tools from OpenAPI
    await initializeTools();
    
    // Start the server
    app.listen(Number(PORT), HOST, () => {
      console.log(`Takaro MCP Server running at http://${HOST}:${PORT}`);
      console.log(`Loaded ${toolRegistry.list().length} tools`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
})();

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\nShutting down server...');
  process.exit(0);
});