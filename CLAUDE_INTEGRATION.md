# Claude Code Integration Guide

This guide explains how to set up bi-directional communication between MrPlug browser extension and Claude Code terminal using the MCP (Model Context Protocol) server.

## Table of Contents

- [Overview](#overview)
- [Architecture](#architecture)
- [Quick Start](#quick-start)
- [Detailed Setup](#detailed-setup)
- [Usage Examples](#usage-examples)
- [Troubleshooting](#troubleshooting)
- [Advanced Configuration](#advanced-configuration)

## Overview

The Claude Code integration allows you to:

1. **Discover Plugin State**: Claude can see what feedback sessions are active in your browser
2. **Query Element Context**: Get detailed info about UI elements being discussed
3. **Send Commands to Browser**: Open URLs, select elements, capture screenshots
4. **Continue Conversations**: Claude can add messages to browser feedback sessions
5. **Launch Browser from Terminal**: Start feedback mode from Claude with specific elements selected

## Architecture

```
┌──────────────────┐
│  Claude Code     │
│  (Terminal)      │
└────────┬─────────┘
         │ MCP Protocol (SSE)
         ▼
┌──────────────────┐
│  MCP Server      │
│  (localhost:3001)│
└────────┬─────────┘
         │ WebSocket + REST
         ▼
┌──────────────────┐
│ Browser Plugin   │
│  (MrPlug)        │
└──────────────────┘
```

### Communication Flow

1. **Plugin → MCP Server**: Browser extension sends state updates via WebSocket/REST
2. **MCP Server → Claude**: Claude queries state via MCP tools
3. **Claude → MCP Server**: Claude sends commands via MCP tools
4. **MCP Server → Plugin**: Commands forwarded to browser via WebSocket/REST

## Quick Start

### 1. Install MCP Server

```bash
cd mrplug-mcp-server
npm install
```

### 2. Start MCP Server

```bash
npm run dev
```

You should see:
```
╔═══════════════════════════════════════════════════════════════╗
║              MrPlug MCP Server Started                        ║
╚═══════════════════════════════════════════════════════════════╝

MCP Endpoint (Claude Code):
  http://localhost:3001/sse

WebSocket Endpoint (Browser Plugin):
  ws://localhost:3002

Ready to connect! 🚀
```

### 3. Configure Claude Code

Create or edit `.claude/config.json` in your project:

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

Restart Claude Code if it's running.

### 4. Configure Browser Extension

1. Click MrPlug extension icon
2. Go to Settings/Options
3. Enable "MCP Integration"
4. Set:
   - MCP Server URL: `http://localhost:3001`
   - MCP WebSocket URL: `ws://localhost:3002`
5. Save settings

### 5. Verify Connection

In Claude Code terminal:
```
You: "What's the current state of the MrPlug extension?"
```

Claude should use the `get_browser_state` tool and return info about your browser plugin.

## Detailed Setup

### MCP Server Setup

#### Development Mode

```bash
cd mrplug-mcp-server
npm install
npm run dev
```

The server will hot-reload on file changes.

#### Production Mode

```bash
cd mrplug-mcp-server
npm install
npm run build
npm start
```

#### Environment Configuration

Create `.env` file:

```env
PORT=3001          # HTTP/SSE server port
WS_PORT=3002       # WebSocket server port
NODE_ENV=development
```

### Browser Extension Setup

#### Enable MCP Integration

1. **Via Options Page**:
   - Right-click MrPlug extension icon → Options
   - Scroll to "Advanced Integrations"
   - Toggle "Enable MCP Server Integration"
   - Enter server URLs
   - Save

2. **Via Storage API** (for development):
   ```javascript
   // In browser console
   chrome.storage.local.set({
     config: {
       ...existingConfig,
       mcpEnabled: true,
       mcpServerUrl: 'http://localhost:3001',
       mcpWsUrl: 'ws://localhost:3002'
     }
   })
   ```

#### Verify Browser Connection

Open browser console (F12) and look for:
```
[MCP Client] Initializing...
[MCP Client] Connecting to WebSocket: ws://localhost:3002
[MCP Client] WebSocket connected
[MCP Client] State sync started
[MCP Client] Command polling started
```

### Claude Code Setup

#### Method 1: Project-Specific Config

Create `.claude/config.json` in your project directory:

```json
{
  "mcpServers": {
    "mrplug": {
      "type": "url",
      "url": "http://localhost:3001/sse",
      "name": "mrplug-mcp",
      "description": "MrPlug browser extension integration"
    }
  }
}
```

#### Method 2: Global Config

Edit `~/.claude/config.json`:

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

**Note**: Project-specific config takes precedence over global config.

## Usage Examples

### Example 1: Discover Active Sessions

**Claude Code:**
```
You: "What feedback sessions are currently active in my browser?"

Claude: Let me check the current state of your MrPlug extension.

[Uses: get_browser_state with includeSessionDetails: true]

Claude: You have 2 active feedback sessions:

1. Button Sizing Issue (Session ID: sess_abc123)
   - Element: <button class="primary-btn">
   - 5 messages in conversation
   - Last activity: 2 minutes ago

2. Navigation Layout (Session ID: sess_xyz789)
   - Element: <nav class="sidebar">
   - 3 messages in conversation
   - Last activity: 10 minutes ago

Would you like me to review either of these sessions?
```

### Example 2: Review Element Context

**Claude Code:**
```
You: "Show me the details of the button element we're working on"

Claude: [Uses: get_element_context with elementHash: "btn-hash-456"]

Claude: Here's the button element context:

Tag: button
Classes: primary-btn, large, rounded
Current Styles:
  - background-color: #007bff
  - padding: 12px 24px
  - font-size: 16px
  - border-radius: 8px
Position: 200x50px at (100, 300)
DOM Path: html > body > main > div.container > button.primary-btn

The user mentioned it's too small. I recommend increasing padding to 16px 32px.
```

### Example 3: Continue Conversation in Browser

**Claude Code:**
```
You: "Tell the user to try changing the button padding to 16px 32px"

Claude: [Uses: add_session_message]

Claude: I've added a message to the browser session suggesting:
"Try increasing the button padding to 16px 32px (top/bottom 16px, left/right 32px).
This will make the button more prominent and easier to tap on mobile."

The user will see this message in their MrPlug extension immediately.
```

### Example 4: Launch Browser with Element Selected

**Claude Code:**
```
You: "Open the browser to show the button we're discussing"

Claude: [Uses: send_browser_command with command: "open_browser"]

Claude: I've opened your browser to the page with the button highlighted.
You can now see the element in context and test the changes we discussed.
```

### Example 5: Capture Screenshot

**Claude Code:**
```
You: "Can you capture a screenshot of the current element?"

Claude: [Uses: send_browser_command with command: "capture_screenshot"]

Claude: I've captured a screenshot. Here's what the button currently looks like:
[Screenshot data would be returned]

The spacing does look tight. Let's increase it as we discussed.
```

## Troubleshooting

### MCP Server Won't Start

**Symptom**: `Error: listen EADDRINUSE: address already in use :::3001`

**Solution**:
```bash
# Find process using port 3001
lsof -i :3001

# Kill the process
kill -9 <PID>

# Or use different ports
PORT=4001 WS_PORT=4002 npm run dev
```

### Browser Extension Won't Connect

**Symptom**: No `[MCP Client]` logs in browser console

**Checks**:
1. Is MCP Server running? Visit `http://localhost:3001/health`
2. Is MCP enabled in extension settings?
3. Are URLs correct in settings?
4. Check browser console for errors

**Solution**:
```javascript
// In browser console, verify settings
chrome.storage.local.get('config', (data) => {
  console.log('MCP Config:', {
    enabled: data.config?.mcpEnabled,
    serverUrl: data.config?.mcpServerUrl,
    wsUrl: data.config?.mcpWsUrl
  });
});
```

### Claude Code Can't Connect

**Symptom**: Tools not showing up in Claude Code

**Checks**:
1. Is `.claude/config.json` formatted correctly?
2. Is MCP server running and accessible?
3. Did you restart Claude Code after config change?

**Solution**:
```bash
# Verify MCP server is accessible
curl http://localhost:3001/health

# Check Claude config
cat .claude/config.json

# Restart Claude Code
```

### WebSocket Connection Drops

**Symptom**: `[WS] Connection closed` in logs

**Solution**:
- MCP client auto-reconnects with exponential backoff
- Check for firewall/antivirus blocking WebSocket
- Verify WS_PORT is not blocked

### State Not Syncing

**Symptom**: Claude sees outdated/no data

**Checks**:
1. Browser console: Are state updates being sent?
2. MCP server logs: Are updates being received?
3. Is session data being saved properly?

**Solution**:
```javascript
// Manually trigger state update from browser console
chrome.runtime.sendMessage({
  type: 'session-updated',
  session: currentSession
});
```

## Advanced Configuration

### Custom Polling Intervals

Adjust how often browser polls for commands:

```typescript
// In browser extension config
{
  mcpEnabled: true,
  mcpServerUrl: 'http://localhost:3001',
  mcpWsUrl: 'ws://localhost:3002',
  mcpPollInterval: 3000  // 3 seconds instead of default 5
}
```

### Multiple Browser Instances

Run multiple browsers with same MCP server:
- Each browser instance gets unique WebSocket connection ID
- MCP server broadcasts commands to all connected instances
- Sessions are identified by unique IDs, not connection IDs

### Running MCP Server on Different Machine

If MCP server is on different machine:

1. **Update Browser Extension Config**:
   ```
   mcpServerUrl: 'http://192.168.1.100:3001'
   mcpWsUrl: 'ws://192.168.1.100:3002'
   ```

2. **Update Claude Config**:
   ```json
   {
     "mcpServers": {
       "mrplug": {
         "url": "http://192.168.1.100:3001/sse"
       }
     }
   }
   ```

3. **Configure Firewall** to allow ports 3001, 3002

### HTTPS/WSS for Remote Access

For production or remote access:

1. **Get SSL Certificate** (Let's Encrypt, etc.)

2. **Update MCP Server** to use HTTPS:
   ```typescript
   import https from 'https';
   import fs from 'fs';

   const options = {
     key: fs.readFileSync('key.pem'),
     cert: fs.readFileSync('cert.pem')
   };

   const httpsServer = https.createServer(options, app);
   ```

3. **Use WSS** for WebSocket:
   ```typescript
   const wss = new WebSocketServer({
     server: httpsServer
   });
   ```

4. **Update URLs**:
   - Claude: `https://your-domain.com:3001/sse`
   - Browser: `https://your-domain.com:3001` and `wss://your-domain.com:3002`

## Available MCP Tools

| Tool | Purpose | Common Use Cases |
|------|---------|-----------------|
| `get_browser_state` | Get plugin state | Check what's active, see sessions |
| `get_active_session` | Get session details | Review conversation, element context |
| `get_element_context` | Get element info | Understand UI element properties |
| `send_browser_command` | Control browser | Open pages, select elements, capture screenshots |
| `list_feedback_sessions` | List all sessions | See recent feedback, find sessions |
| `query_session_history` | Get messages | Review conversation history |
| `add_session_message` | Add message | Continue conversation, provide suggestions |

## Best Practices

### 1. Keep MCP Server Running

Start MCP server before using Claude Code with MrPlug:
```bash
# Use a process manager like PM2
npm install -g pm2
pm2 start npm --name "mrplug-mcp" -- run dev

# Or run in tmux/screen session
tmux new -s mrplug-mcp
npm run dev
# Detach with Ctrl+B, D
```

### 2. Monitor Connections

Check health regularly:
```bash
watch -n 5 curl -s http://localhost:3001/health | jq
```

### 3. Session Management

- Sessions persist across browser restarts
- Use `list_feedback_sessions` to find old sessions
- Clean up inactive sessions periodically

### 4. Error Handling

All tools return structured errors:
```json
{
  "content": [{
    "type": "text",
    "text": "Error: Session abc123 not found"
  }],
  "isError": true
}
```

Claude handles these gracefully and can retry or ask for clarification.

## Security Notes

⚠️ **Current implementation is for LOCAL DEVELOPMENT ONLY**

- No authentication on MCP server
- CORS enabled for all origins
- No rate limiting
- Commands accepted from any client

**For production use**, implement:
- API key authentication
- CORS whitelist
- Rate limiting
- Input validation
- TLS/SSL encryption
- Audit logging

See [MCP Server README](./mrplug-mcp-server/README.md#security-considerations) for details.

## Support

- **Issues**: https://github.com/ojfbot/mrplug/issues
- **Documentation**: https://github.com/ojfbot/mrplug
- **MCP Spec**: https://spec.modelcontextprotocol.io/

---

**Happy coding with Claude + MrPlug! 🚀**
