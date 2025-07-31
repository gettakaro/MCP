# Takaro MCP Server

A Model Context Protocol (MCP) server that provides access to the Takaro API, allowing you to search and manage Takaro modules through Claude Code or other MCP-compatible clients.

## Features

- **Echo Tool**: Simple tool for testing the MCP connection
- **Module Search**: Advanced search functionality with full access to the Takaro Module API including:
  - Exact match filtering by name, ID, author, builtin status, and supported games
  - Partial match searching in module names
  - Date range filtering for creation and update times
  - Sorting by any field in ascending or descending order
  - Pagination support
  - Extensible data retrieval

## Prerequisites

- Node.js 18+ and npm
- Takaro API credentials (username and password)
- Claude Code or another MCP-compatible client

## Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd takaro-mcp
```

2. Install dependencies:
```bash
npm install
```

3. Build the TypeScript project:
```bash
npm run build
```

## Configuration

### Environment Variables

Set the following environment variables for Takaro authentication:

```bash
export TAKARO_USERNAME="your-username"
export TAKARO_PASSWORD="your-password"
export TAKARO_HOST="https://api.takaro.io"  # Optional, defaults to https://api.takaro.io
```

### Server Port

By default, the server runs on port 3000. You can change this:

```bash
export PORT=4000
```

## Running the Server

### Option 1: Using the startup script

```bash
./start-server.sh
```

### Option 2: Direct npm command

```bash
PORT=4000 npm start
```

### Option 3: Development mode with auto-reload

```bash
npm run dev
```

## Configuring Claude Code

The server is configured to work with Claude Code via HTTP transport. The configuration is already set up in `.mcp.json`:

```json
{
  "mcpServers": {
    "takaro-mcp": {
      "type": "http",
      "url": "http://127.0.0.1:4000/mcp"
    }
  }
}
```

To use the server with Claude Code:

1. Start the server first (it must be running before Claude Code connects)
2. Open Claude Code in the project directory
3. The server should automatically appear in your MCP servers list

## Available Tools

### echo

Simple echo tool for testing:

```
Input:
{
  "message": "Hello, world!"
}

Output:
Echo: Hello, world!
```

### searchModules

Advanced module search with all Takaro API capabilities:

```
Input:
{
  "filters": {
    "name": ["exact-module-name"],
    "builtin": ["true"],
    "author": ["author-name"],
    "supportedGames": ["7days", "rust"],
    "id": ["module-id"]
  },
  "search": {
    "name": ["partial-match"]
  },
  "greaterThan": {
    "createdAt": "2024-01-01",
    "updatedAt": "2024-06-01"
  },
  "lessThan": {
    "createdAt": "2024-12-31",
    "updatedAt": "2024-12-31"
  },
  "page": 0,
  "limit": 20,
  "sortBy": "name",
  "sortDirection": "asc",
  "extend": ["permissions", "hooks"]
}
```

All parameters are optional. Examples:

- Search by partial name: `{"search": {"name": ["teleport"]}}`
- Find builtin modules: `{"filters": {"builtin": ["true"]}}`
- Get modules by author: `{"filters": {"author": ["TakaroBot"]}}`
- Paginate results: `{"page": 1, "limit": 10}`
- Sort by creation date: `{"sortBy": "createdAt", "sortDirection": "desc"}`

## Testing

### Test with curl

After starting the server, you can test it with curl:

1. Initialize session:
```bash
curl -X POST http://127.0.0.1:4000/mcp \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{}},"id":1}'
```

2. List available tools:
```bash
curl -X POST http://127.0.0.1:4000/mcp \
  -H "Content-Type: application/json" \
  -H "Mcp-Session-Id: <session-id-from-initialize>" \
  -d '{"jsonrpc":"2.0","method":"tools/list","params":{},"id":2}'
```

3. Search for modules:
```bash
curl -X POST http://127.0.0.1:4000/mcp \
  -H "Content-Type: application/json" \
  -H "Mcp-Session-Id: <session-id-from-initialize>" \
  -d '{"jsonrpc":"2.0","method":"tools/call","params":{"name":"searchModules","arguments":{"search":{"name":["teleport"]}}},"id":3}'
```

## Troubleshooting

### Authentication Failed

If you see "Authentication failed" when starting the server:
- Verify your TAKARO_USERNAME and TAKARO_PASSWORD are correct
- Check if the TAKARO_HOST is accessible
- Ensure your account has the necessary permissions

### Connection Timeout in Claude Code

If Claude Code shows a connection timeout:
- Make sure the server is running before starting Claude Code
- Verify the port in `.mcp.json` matches the server's PORT
- Check that no firewall is blocking localhost connections

### Port Already in Use

If you get "EADDRINUSE" error:
- Another process is using the port
- Change the port: `PORT=4001 npm start`
- Update `.mcp.json` to match the new port

## Development

- `npm run build` - Build TypeScript files
- `npm run dev` - Run in development mode with auto-reload
- `npm run clean` - Clean build directory

## License

MIT