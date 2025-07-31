import { test, describe, before, after } from 'node:test';
import assert from 'node:assert';
import { spawn, ChildProcess } from 'node:child_process';
import axios, { AxiosInstance } from 'axios';

describe('MCP Server Integration Tests', () => {
  let serverProcess: ChildProcess;
  let client: AxiosInstance;
  let sessionId: string;
  const TEST_PORT = 3001;
  const baseURL = `http://127.0.0.1:${TEST_PORT}`;
  
  before(async () => {
    // Set up environment for testing
    process.env.PORT = String(TEST_PORT);
    
    // Use real credentials from environment
    if (!process.env.TAKARO_USERNAME || !process.env.TAKARO_PASSWORD) {
      throw new Error('TAKARO_USERNAME and TAKARO_PASSWORD environment variables must be set for tests');
    }
    
    // Optionally override the host for testing
    // process.env.TAKARO_HOST = process.env.TAKARO_HOST || 'https://api.takaro.io';
    
    // Start the server
    console.log('Starting test server...');
    serverProcess = spawn('node', ['build/server/index.js'], {
      env: { ...process.env },
      stdio: 'pipe'
    });
    
    // Wait for server to start
    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Server failed to start within timeout'));
      }, 10000);
      
      serverProcess.stdout?.on('data', (data) => {
        const output = data.toString();
        console.log('Server output:', output);
        if (output.includes(`running at`)) {
          clearTimeout(timeout);
          resolve();
        }
      });
      
      serverProcess.stderr?.on('data', (data) => {
        console.error('Server error:', data.toString());
      });
      
      serverProcess.on('error', (err) => {
        clearTimeout(timeout);
        reject(err);
      });
    });
    
    // Create axios client
    client = axios.create({
      baseURL,
      headers: {
        'Content-Type': 'application/json'
      },
      validateStatus: () => true // Don't throw on error status codes
    });
  });
  
  after(async () => {
    // Clean up
    if (serverProcess) {
      serverProcess.kill('SIGTERM');
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  });
  
  test('Initialize session creates new session', async () => {
    const response = await client.post('/mcp', {
      jsonrpc: '2.0',
      method: 'initialize',
      params: {},
      id: 1
    });
    
    assert.strictEqual(response.status, 200);
    assert.strictEqual(response.data.jsonrpc, '2.0');
    assert.strictEqual(response.data.id, 1);
    assert.ok(response.data.result);
    assert.strictEqual(response.data.result.protocolVersion, '2024-11-05');
    assert.ok(response.data.result.capabilities);
    assert.ok(response.data.result.serverInfo);
    assert.strictEqual(response.data.result.serverInfo.name, 'takaro-mcp');
    
    // Check for session header
    sessionId = response.headers['mcp-session-id'];
    assert.ok(sessionId, 'Should return session ID in header');
  });
  
  test('List tools includes all dynamically generated search tools', async () => {
    const response = await client.post('/mcp', {
      jsonrpc: '2.0',
      method: 'tools/list',
      params: {},
      id: 2
    }, {
      headers: {
        'Mcp-Session-Id': sessionId
      }
    });
    
    assert.strictEqual(response.status, 200);
    assert.strictEqual(response.data.jsonrpc, '2.0');
    assert.ok(response.data.result);
    assert.ok(Array.isArray(response.data.result.tools));
    
    // Check that we have the expected number of tools (14 from real API)
    assert.ok(response.data.result.tools.length >= 14, `Expected at least 14 tools, got ${response.data.result.tools.length}`);
    
    // Verify some key tools exist
    const expectedTools = ['searchModule', 'searchUser', 'searchPlayer', 'searchGameserver'];
    for (const toolName of expectedTools) {
      const tool = response.data.result.tools.find((t: any) => t.name === toolName);
      assert.ok(tool, `${toolName} tool should be in the list`);
      assert.ok(tool.description, `${toolName} should have a description`);
      assert.ok(tool.inputSchema, `${toolName} should have an input schema`);
      assert.strictEqual(tool.inputSchema.type, 'object');
    }
  });
  
  test('Execute searchModule tool returns formatted results', async () => {
    const response = await client.post('/mcp', {
      jsonrpc: '2.0',
      method: 'tools/call',
      params: {
        name: 'searchModule',
        arguments: {
          limit: 5,
          page: 0
        }
      },
      id: 3
    }, {
      headers: {
        'Mcp-Session-Id': sessionId
      }
    });
    
    // Should get a successful response with real data
    assert.strictEqual(response.status, 200);
    assert.strictEqual(response.data.jsonrpc, '2.0');
    assert.strictEqual(response.data.id, 3);
    assert.ok(response.data.result, 'Should have a result, not an error');
    assert.ok(response.data.result.content);
    assert.ok(Array.isArray(response.data.result.content));
    assert.ok(response.data.result.content.length > 0);
    assert.strictEqual(response.data.result.content[0].type, 'text');
    
    // Verify the content contains module data
    const textContent = response.data.result.content[0].text;
    assert.ok(textContent.includes('Found'), 'Should indicate number of modules found');
  });
  
  test('Unknown tool returns appropriate error', async () => {
    const response = await client.post('/mcp', {
      jsonrpc: '2.0',
      method: 'tools/call',
      params: {
        name: 'unknownTool',
        arguments: {}
      },
      id: 4
    }, {
      headers: {
        'Mcp-Session-Id': sessionId
      }
    });
    
    assert.strictEqual(response.status, 200);
    assert.strictEqual(response.data.jsonrpc, '2.0');
    assert.ok(response.data.error);
    assert.strictEqual(response.data.error.code, -32601);
    assert.ok(response.data.error.message.includes('Unknown tool'));
  });
  
  test('Missing session ID returns error', async () => {
    const response = await client.post('/mcp', {
      jsonrpc: '2.0',
      method: 'tools/call',
      params: {
        name: 'searchModule',
        arguments: {}
      },
      id: 5
    });
    
    assert.strictEqual(response.status, 200);
    assert.strictEqual(response.data.jsonrpc, '2.0');
    assert.ok(response.data.error);
    assert.strictEqual(response.data.error.code, -32602);
    assert.ok(response.data.error.message.includes('Session ID required'));
  });
  
  test('Execute multiple search tools with real API', async () => {
    // Test searchUser
    const userResponse = await client.post('/mcp', {
      jsonrpc: '2.0',
      method: 'tools/call',
      params: {
        name: 'searchUser',
        arguments: {
          limit: 3,
          page: 0
        }
      },
      id: 6
    }, {
      headers: {
        'Mcp-Session-Id': sessionId
      }
    });
    
    assert.strictEqual(userResponse.status, 200);
    assert.ok(userResponse.data.result, 'searchUser should succeed');
    assert.ok(userResponse.data.result.content[0].text.includes('Found'), 'Should show user count');
    
    // Test searchPlayer
    const playerResponse = await client.post('/mcp', {
      jsonrpc: '2.0',
      method: 'tools/call',
      params: {
        name: 'searchPlayer',
        arguments: {
          limit: 3,
          page: 0
        }
      },
      id: 7
    }, {
      headers: {
        'Mcp-Session-Id': sessionId
      }
    });
    
    assert.strictEqual(playerResponse.status, 200);
    assert.ok(playerResponse.data.result, 'searchPlayer should succeed');
    
    // Test searchGameserver
    const gameserverResponse = await client.post('/mcp', {
      jsonrpc: '2.0',
      method: 'tools/call',
      params: {
        name: 'searchGameserver',
        arguments: {
          limit: 3,
          page: 0
        }
      },
      id: 8
    }, {
      headers: {
        'Mcp-Session-Id': sessionId
      }
    });
    
    assert.strictEqual(gameserverResponse.status, 200);
    assert.ok(gameserverResponse.data.result, 'searchGameserver should succeed');
  });
});