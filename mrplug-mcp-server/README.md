# MrPlug MCP Server

MCP (Model Context Protocol) server for MrPlug browser extension, enabling bi-directional communication between Claude Code and the browser plugin.

## Features

- **Discover Browser State**: Claude can query the current state of the MrPlug extension
- **Access Sessions**: View active feedback sessions and conversation history
- **Query Element Context**: Get detailed information about tracked DOM elements
- **Send Commands**: Control the browser (open URLs, select elements, capture screenshots)
- **Bi-directional Communication**: WebSocket + REST API for real-time updates
- **Session Management**: Add messages to sessions from Claude terminal

## Architecture

```
┌─────────────────┐         ┌──────────────────┐         ┌──────────────────┐
│  Claude Code    │◄───────►│   MCP Server     │◄───────►│ Browser Plugin   │
│  (Terminal)     │   SSE   │  (This Server)   │ WS/REST │   (MrPlug)       │
└─────────────────┘         └──────────────────┘         └──────────────────┘
```

### Communication Protocols

1. **Claude Code ↔ MCP Server**: Server-Sent Events (SSE) via MCP SDK
2. **MCP Server ↔ Browser Plugin**:
   - WebSocket for real-time bidirectional communication
   - REST API as fallback for state updates and commands

## Installation

```bash
cd mrplug-mcp-server
npm install
```

## Configuration

Create a `.env` file:

```bash
cp .env.example .env
```

Edit `.env`:

```env
PORT=3001          # HTTP/SSE server port
WS_PORT=3002       # WebSocket server port
NODE_ENV=development
```

## Running the Server

### Development Mode

```bash
npm run dev
```

This starts the server with hot reload using `tsx watch`.

### Production Mode

```bash
npm run build
npm start
```

## Endpoints

### MCP Endpoints (for Claude Code)

- **SSE Connection**: `GET http://localhost:3001/sse`
  - Claude Code connects here for MCP protocol communication

- **Message Endpoint**: `POST http://localhost:3001/message`
  - Used by SSE transport for bi-directional messaging

### Browser Plugin Endpoints

**REST API:**
- `POST /plugin/state` - Browser reports state updates
- `POST /plugin/session` - Browser reports session updates
- `GET /plugin/commands` - Browser polls for commands
- `GET /plugin/status` - Check connection status

**WebSocket:**
- `ws://localhost:3002` - Real-time bidirectional communication

### Utility Endpoints

- `GET /health` - Health check and connection status
- `GET /info` - Server information and endpoints

## MCP Tools

When connected to Claude Code, the following tools are available:

### `get_browser_state`
Get current state of the browser extension including active sessions and selected elements.

```typescript
{
  includeSessionDetails?: boolean  // Include full session data (default: false)
}
```

### `get_active_session`
Get detailed information about the currently active feedback session.

```typescript
{
  sessionId?: string  // Optional: specific session ID (uses active if omitted)
}
```

### `get_element_context`
Get detailed context about a specific DOM element being tracked.

```typescript
{
  elementHash: string,          // Element identifier (required)
  includeScreenshot?: boolean   // Include screenshot (default: false)
}
```

### `send_browser_command`
Send command to the browser to perform an action.

```typescript
{
  command: "open_browser" | "select_element" | "capture_screenshot" | "create_issue" | "start_session",
  sessionId?: string,    // Optional: target session
  elementHash?: string,  // Optional: target element
  data?: object         // Optional: command-specific data
}
```

**Available Commands:**
- `open_browser`: Open URL with optional element selection
- `select_element`: Highlight element in current tab
- `capture_screenshot`: Capture screenshot of element
- `create_issue`: Create GitHub issue
- `start_session`: Start new feedback session

### `list_feedback_sessions`
List all feedback sessions with summaries.

```typescript
{
  limit?: number,      // Max sessions to return (default: 10)
  activeOnly?: boolean // Only active sessions (default: false)
}
```

### `query_session_history`
Get conversation history from a specific session.

```typescript
{
  sessionId: string,  // Session ID (required)
  limit?: number      // Limit messages (returns most recent)
}
```

### `add_session_message`
Add a new message to a session from Claude.

```typescript
{
  sessionId: string,             // Session ID (required)
  message: string,               // Message content (required)
  role: "user" | "assistant"     // Message role (required)
}
```

## Claude Code Configuration

To use this MCP server with Claude Code, add to your `.claude/config.json`:

```json
{
  "mcpServers": {
    "mrplug": {
      "type": "url",
      "url": "http://localhost:3001/sse",
      "name": "mrplug-mcp"
    }
  }
}
```

## Browser Extension Configuration

Update MrPlug extension settings:

1. Open MrPlug options page
2. Enable "MCP Integration"
3. Set MCP Server URL: `http://localhost:3001`
4. Set MCP WebSocket URL: `ws://localhost:3002`
5. Save settings

The extension will automatically connect to the MCP server.

## Example Usage

### From Claude Code Terminal

```bash
# Get current browser state
claude: "What's the current state of the MrPlug extension?"
→ Uses: get_browser_state
→ Returns: Active sessions, selected elements, connection status

# View active session
claude: "Show me the active feedback session"
→ Uses: get_active_session
→ Returns: Full session with messages and element context

# Open browser to specific element
claude: "Open the browser to the button we discussed"
→ Uses: send_browser_command with command: "open_browser"
→ Result: Browser opens with element highlighted

# Add message to session
claude: "Tell the user to try changing the padding to 20px"
→ Uses: add_session_message
→ Result: Message appears in browser extension chat
```

## Development

### Project Structure

```
mrplug-mcp-server/
├── src/
│   ├── server.ts                  # MCP server with tool definitions
│   ├── browser-plugin-manager.ts  # Browser state & command management
│   └── http-server.ts             # HTTP/SSE/WebSocket server
├── package.json
├── tsconfig.json
└── README.md
```

### Adding New Tools

1. Add tool definition to `tools` array in `server.ts`
2. Implement handler in `server.setRequestHandler(CallToolRequestSchema, ...)`
3. Add corresponding method to `BrowserPluginManager` if needed
4. Update this README

### Adding New Commands

1. Add command type to `send_browser_command` enum in `server.ts`
2. Implement handler in `browser-plugin-manager.ts` `sendCommand()` method
3. Add handler in browser extension's `mcp-client.ts` `handleCommand()` method
4. Update this README

## Troubleshooting

### Connection Issues

**MCP Server not starting:**
```bash
# Check if ports are in use
lsof -i :3001
lsof -i :3002

# Kill processes if needed
kill -9 <PID>
```

**Claude Code can't connect:**
- Verify MCP server is running (`npm run dev`)
- Check `.claude/config.json` has correct URL
- Restart Claude Code
- Check server logs for errors

**Browser plugin won't connect:**
- Verify WebSocket server is running (port 3002)
- Check browser extension settings have correct URLs
- Open browser console and look for `[MCP Client]` logs
- Check server logs for `[WS]` connection messages

### Debugging

**Enable detailed logging:**
```bash
NODE_ENV=development npm run dev
```

**Check WebSocket connections:**
```bash
# In browser console
localStorage.setItem('DEBUG', 'mrplug:*')
```

**Monitor MCP traffic:**
- Server logs show all incoming MCP tool calls
- Browser console shows all outgoing state updates
- Use browser DevTools Network tab for WebSocket traffic

## Security Considerations

### Current Implementation (Development Only)

⚠️ **WARNING**: This server is currently designed for local development only!

- No authentication/authorization
- CORS enabled for all origins
- No rate limiting
- Accepts commands from any WebSocket client

### Production Recommendations

If deploying beyond localhost:

1. **Add Authentication**
   - Require API keys/tokens for both MCP and browser connections
   - Validate all incoming requests

2. **Enable TLS**
   - Use `wss://` for WebSocket
   - Use `https://` for REST endpoints
   - Obtain valid SSL certificates

3. **Restrict CORS**
   - Whitelist specific origins
   - Remove wildcard CORS policies

4. **Add Rate Limiting**
   - Limit command execution frequency
   - Throttle state updates
   - Prevent abuse

5. **Input Validation**
   - Sanitize all user inputs
   - Validate command parameters
   - Prevent injection attacks

6. **Monitoring & Logging**
   - Log all commands and state changes
   - Monitor for suspicious activity
   - Set up alerts for anomalies

## License

MIT - Same as MrPlug browser extension

## Support

- **Issues**: https://github.com/ojfbot/mrplug/issues
- **Documentation**: https://github.com/ojfbot/mrplug#claude-code-integration
- **MCP Specification**: https://spec.modelcontextprotocol.io/

---

**Built for MrPlug** - AI-powered UI feedback assistant
