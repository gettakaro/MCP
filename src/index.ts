#!/usr/bin/env node

import express, { Request, Response } from 'express';
import { z } from 'zod';
import { randomUUID } from 'crypto';
import { authTakaro } from './auth.js';

// Create Express app
const app = express();
app.use(express.json());

// Server configuration
const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || '127.0.0.1';

// Define the echo tool schema
const EchoToolSchema = z.object({
  message: z.string().min(1, { message: 'Message must not be empty' })
});

// Session management
const sessions = new Map<string, any>();

// MCP endpoint - handles both POST and GET
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

    // Handle different MCP methods
    switch (req.body.method) {
      case 'initialize':
        // Initialize a new session
        if (!sessionId) {
          sessionId = randomUUID();
          res.setHeader('Mcp-Session-Id', sessionId);
          sessions.set(sessionId, { created: Date.now() });
        }

        return res.json({
          jsonrpc: '2.0',
          result: {
            protocolVersion: '2024-11-05',
            capabilities: {
              tools: {}
            },
            serverInfo: {
              name: 'echo-server',
              version: '1.0.0'
            }
          },
          id: req.body.id
        });

      case 'tools/list':
        // List available tools
        return res.json({
          jsonrpc: '2.0',
          result: {
            tools: [
              {
                name: 'echo',
                description: 'Echoes back the input message',
                inputSchema: {
                  type: 'object',
                  properties: {
                    message: {
                      type: 'string',
                      description: 'The message to echo back'
                    }
                  },
                  required: ['message']
                }
              }
            ]
          },
          id: req.body.id
        });

      case 'tools/call':
        // Call a tool
        const { name, arguments: args } = req.body.params || {};

        if (name !== 'echo') {
          return res.json({
            jsonrpc: '2.0',
            error: {
              code: -32601,
              message: `Unknown tool: ${name}`
            },
            id: req.body.id
          });
        }

        // Validate the arguments
        const validationResult = EchoToolSchema.safeParse(args);

        if (!validationResult.success) {
          return res.json({
            jsonrpc: '2.0',
            error: {
              code: -32602,
              message: 'Invalid parameters',
              data: validationResult.error.format()
            },
            id: req.body.id
          });
        }

        const { message } = validationResult.data;

        return res.json({
          jsonrpc: '2.0',
          result: {
            content: [
              {
                type: 'text',
                text: `Echo: ${message}`
              }
            ]
          },
          id: req.body.id
        });

      default:
        // Method not found
        return res.json({
          jsonrpc: '2.0',
          error: {
            code: -32601,
            message: `Method not found: ${req.body.method}`
          },
          id: req.body.id || null
        });
    }
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
app.get('/mcp', (req: Request, res: Response) => {
  const sessionId = req.headers['mcp-session-id'] as string;

  if (!sessionId || !sessions.has(sessionId)) {
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
    res.write(':ping\n\n');
  }, 30000);

  req.on('close', () => {
    clearInterval(keepAlive);
    sessions.delete(sessionId);
  });

  // Keep the response open
  return;
});

// Helper function to validate origins
function isAllowedOrigin(origin: string): boolean {
  // In production, implement proper origin validation
  // For development, allow localhost origins
  const allowedOrigins = [
    'http://localhost:3000',
    'http://127.0.0.1:3000',
    'https://localhost:3000',
    'https://127.0.0.1:3000'
  ];

  return allowedOrigins.includes(origin);
}

// Start the server
app.listen(Number(PORT), HOST, () => {
  console.log(`MCP Echo Server running at http://${HOST}:${PORT}`);
  authTakaro().catch(error => {
    console.error('Authentication failed:', error);
    process.exit(1);
  });
});

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\nShutting down server...');
  process.exit(0);
});