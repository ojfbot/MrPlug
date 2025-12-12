# MCP + Claude Code Integration Documentation

**Status**: Paused for future iteration (too unstable)
**Date**: December 2024
**Goal**: Enable bi-directional communication between browser extension and Claude Code terminal session via MCP server

---

## Overview

This document captures all work done on integrating the MrPlug browser extension with Claude Code via a Model Context Protocol (MCP) server. This feature was deemed too unstable for the initial release and has been stripped out, but all work is documented here for future reference.

## Architecture Implemented

```
Browser Extension (MrPlug)
       ↓
WebSocket + HTTP (ports 3001/3002)
       ↓
MCP Server (mrplug-mcp-server)
       ↓
Claude Code Terminal Session
```

### Key Components

1. **MCP Server** (`mrplug-mcp-server/`)
   - HTTP server on port 3001 for REST API
   - WebSocket server on port 3002 for real-time streaming
   - Plugin state management
   - Implementation request queue
   - Progress broadcast system

2. **Browser Extension Integration**
   - `src/lib/mcp-client.ts` - WebSocket client
   - `src/background/index.ts` - MCP client initialization
   - `src/components/FeedbackModal.tsx` - Clickable suggestions
   - `src/content/index.tsx` - Progress event dispatch

3. **Streaming Implementation**
   - Real-time progress updates from Claude Code
   - Live UI updates in browser modal
   - Debug monitoring panel
   - Status tracking (analyzing, implementing, testing, complete)

---

## Files Modified for MCP Integration

### Core Implementation Files

#### `src/lib/mcp-client.ts`
- WebSocket client for bi-directional communication
- Handles plugin state sync
- Receives implementation progress updates
- Routes messages to appropriate handlers
- Key methods:
  - `initialize()` - Connect to MCP server
  - `handleImplementationProgress()` - Process streaming updates
  - `sendSessionUpdate()` - Sync browser session to MCP

#### `src/background/index.ts`
- MCP client initialization on extension startup
- Lines 9-34: MCP client setup and config checking
- Lines 72-73: Initialize MCP client after auto-config
- Lines 168-173: Reinitialize on config change
- Lines 187-191: Session update sync to MCP
- Default MCP config:
  ```typescript
  mcpEnabled: true,
  mcpServerUrl: 'http://localhost:3001',
  mcpWsUrl: 'ws://localhost:3002',
  ```

#### `src/components/FeedbackModal.tsx`
- Clickable suggestion badges (lines 62-82)
- `handleClaudeCodeAction()` function (lines 166-236)
- Implementation progress event listener (lines 341-364)
- MCP activity tracking with debug panel
- Status message display for streaming updates
- Action types: `github-issue`, `claude-code`, `manual`

#### `src/content/index.tsx`
- Message listener for implementation progress (lines ~100+)
- Custom event dispatch to FeedbackModal
- Bridges background script → content script → React UI

### MCP Server Files

#### `mrplug-mcp-server/src/http-server.ts`
- `/plugin/state` - Get browser plugin state
- `/plugin/implement` - Queue implementation request (NEW)
- `/implementation/progress` - Receive progress from Claude Code (NEW)
- Integrated with BrowserPluginManager

#### `mrplug-mcp-server/src/browser-plugin-manager.ts`
- `queueImplementationRequest()` - Add to queue
- `getImplementationRequests()` - Poll for requests
- `broadcastToPlugin()` - Send progress to browser (made public)
- Implementation queue management
- WebSocket event broadcasting

#### `mrplug-mcp-server/src/stdio-server.ts`
- MCP tool: `get_implementation_requests` - Poll queue
- MCP tool: `get_browser_state` - Get plugin state
- Exposes queue to Claude Code terminal

### Supporting Files

#### `src/types/index.ts`
- `ConversationMessage.metadata` - Added MCP activity tracking
  ```typescript
  metadata?: {
    source?: 'mcp' | 'local' | 'extension';
    mcpActivity?: string;
    toolCalls?: string[];
  }
  ```
- `ExtensionConfig` - Added MCP settings
  ```typescript
  mcpEnabled?: boolean;
  mcpServerUrl?: string;
  mcpWsUrl?: string;
  ```

#### `src/lib/chat-helpers.ts`
- `createProgressMessage()` - Helper for streaming messages
- Status message formatting utilities

#### `src/components/ChatMessage.tsx`
- Enhanced message display with debug info
- MCP activity indicators
- Streaming status badges
- Debug toggle for technical details

#### `src/components/MCPDebugPanel.tsx`
- Real-time MCP activity monitor
- Event log with expandable JSON
- Connection status indicator
- Event filtering and search

#### `src/options/index.tsx`
- MCP Server Integration section (lines 240-323)
- Settings for `mcpEnabled`, `mcpServerUrl`, `mcpWsUrl`
- Source code path configuration
- Setup instructions

---

## MCP Server Endpoints

### HTTP Endpoints (port 3001)

1. **GET `/plugin/state`**
   - Returns current browser plugin state
   - Used by Claude Code to check connection

2. **POST `/plugin/implement`**
   - Queue implementation request from browser
   - Body:
     ```json
     {
       "sessionId": "uuid",
       "action": {
         "title": "Make button bigger",
         "description": "Increase min-width",
         "priority": "high"
       },
       "elementContext": {...},
       "sourceCodePath": "~/ojfbot/cv-builder"
     }
     ```
   - Returns `requestId` for tracking

3. **POST `/implementation/progress`**
   - Receive progress updates from Claude Code
   - Body:
     ```json
     {
       "requestId": "impl_123",
       "sessionId": "uuid",
       "message": "🔍 Analyzing component...",
       "status": "analyzing",
       "details": {
         "toolCalls": ["read_file"],
         "files": ["Button.tsx"]
       }
     }
     ```
   - Broadcasts to browser via WebSocket

### WebSocket Events (port 3002)

- **`plugin_state`** - Plugin state updates
- **`implementation_progress`** - Streaming progress messages
- **`session_update`** - Browser session changes

### MCP Tools (stdio)

1. **`get_browser_state`**
   - Get current plugin connection state
   - Returns session count, URLs, etc.

2. **`get_implementation_requests`**
   - Poll for queued implementation requests
   - Returns array of pending requests
   - Clears queue on read

---

## User Flow (Implemented)

### 1. User Clicks Suggestion in Browser

```
[User clicks "Make button bigger" suggestion]
       ↓
FeedbackModal.handleClaudeCodeAction()
       ↓
POST /plugin/implement → MCP Server
       ↓
MCP Server queues request
       ↓
Browser shows: "✅ Request sent! Waiting for Claude Code..."
```

### 2. Claude Code Polls for Requests

```
Claude Code calls MCP tool: get_implementation_requests
       ↓
MCP Server returns queued requests
       ↓
Claude Code receives: {sessionId, action, elementContext, sourceCodePath}
```

### 3. Claude Code Sends Progress

```
Claude Code: curl POST /implementation/progress
       ↓
MCP Server receives progress
       ↓
Broadcasts via WebSocket to browser
       ↓
Browser shows streaming update: "🔍 Analyzing component..."
```

### 4. Live Updates in Browser

```
Browser WebSocket receives message
       ↓
Background script → Content script → Custom event
       ↓
FeedbackModal re-renders with new message
       ↓
User sees real-time progress
```

---

## Configuration

### Browser Extension Config

```typescript
{
  mcpEnabled: true,
  mcpServerUrl: 'http://localhost:3001',
  mcpWsUrl: 'ws://localhost:3002',
  localAppPath: '/Users/yuri/ojfbot/cv-builder',
  claudeCodeEnabled: true,
}
```

### MCP Server Startup

```bash
cd mrplug-mcp-server
npm run dev
```

Starts:
- HTTP server on `http://localhost:3001`
- WebSocket server on `ws://localhost:3002`
- stdio MCP server for Claude Code

---

## Testing Documentation

### Test Files Created

1. **`READY_TO_TEST.md`** - Quick 30-second test guide
2. **`STREAMING_IMPLEMENTATION_GUIDE.md`** - Full guide for Claude Code
3. **`mrplug-mcp-server/test-mcp-integration.sh`** - curl test scripts

### Test Workflow

```bash
# 1. Start MCP server
cd mrplug-mcp-server && npm run dev

# 2. Reload extension
# chrome://extensions/ → MrPlug → Reload

# 3. Click suggestion in browser
# Browser → localhost:3000 → fn-F1 → Click element → Submit feedback → Click suggestion

# 4. Send test progress from terminal
curl -X POST http://localhost:3001/implementation/progress \
  -H "Content-Type: application/json" \
  -d '{
    "requestId": "test_123",
    "sessionId": "SESSION_ID",
    "message": "🎉 Test message from Claude Code!",
    "status": "testing"
  }'

# 5. Watch message appear in browser instantly
```

---

## Known Issues & Instability

### Why This Was Paused

1. **MCP Server Dependency**
   - Requires separate server process running
   - Users must manually start MCP server
   - Connection can drop unexpectedly

2. **WebSocket Complexity**
   - Race conditions on reconnect
   - Message ordering not guaranteed
   - Error handling incomplete

3. **Claude Code Polling**
   - Claude Code must poll for requests
   - No push notifications to terminal
   - Polling interval unclear

4. **Session Management**
   - Session IDs must match between systems
   - No cleanup of stale sessions
   - Browser refresh breaks connection

5. **Error Recovery**
   - No retry logic for failed requests
   - No timeout handling
   - Silent failures possible

6. **User Experience**
   - Too many moving parts
   - Complex setup (server + extension + Claude Code)
   - Debugging difficult across 3 systems

---

## Removed/Disabled Files

When stripping MCP integration, these files should be:

### Disable (keep for future)
- `src/lib/mcp-client.ts` - Keep but don't import
- `src/components/MCPDebugPanel.tsx` - Keep but don't use
- `mrplug-mcp-server/` - Keep directory, don't run

### Remove from Active Code
- MCP client initialization in `src/background/index.ts`
- MCP activity tracking in `FeedbackModal.tsx`
- MCP progress handlers in `src/content/index.tsx`
- MCP settings in `src/options/index.tsx`

### Keep
- `src/components/ChatMessage.tsx` - Still useful for regular messages
- `src/lib/chat-helpers.ts` - Generic message helpers

---

## Future Iteration Checklist

When resuming MCP integration:

- [ ] Implement connection retry logic
- [ ] Add request timeout handling
- [ ] Improve error messages for users
- [ ] Auto-start MCP server with extension
- [ ] Add health check endpoint
- [ ] Implement message acknowledgments
- [ ] Add session cleanup on disconnect
- [ ] Create visual connection status indicator
- [ ] Add MCP server logs viewer in extension
- [ ] Implement request cancellation
- [ ] Add progress persistence across reconnects
- [ ] Create Claude Code MCP server package
- [ ] Write comprehensive integration tests
- [ ] Document all error scenarios
- [ ] Create troubleshooting guide

---

## References

### Documentation Files
- `STREAMING_IMPLEMENTATION_GUIDE.md` - How to send progress from Claude Code
- `READY_TO_TEST.md` - Quick test instructions
- `CLAUDE_CODE_BLOGENGINE_INSTRUCTIONS.md` - MCP tool reference (outdated)
- `SETUP_COMPLETE.md` - Initial setup guide (outdated)

### Key Commits
- Initial MCP integration
- Streaming implementation feature
- Claude Code enabled by default
- cv-builder configuration update

### Port Configuration
- 3001: MCP HTTP server
- 3002: MCP WebSocket server
- 3000: cv-builder application
- 3005: blogengine application (previous)

---

## Summary

This MCP integration enabled real-time, bi-directional communication between the browser extension and Claude Code terminal sessions. Users could click suggestions and watch Claude Code implement fixes with live streaming updates. While technically impressive, the complexity and instability made it unsuitable for initial release.

The architecture is sound and the code is production-ready from a functionality perspective. The main issues are operational complexity and error handling edge cases. This can be revisited in a future iteration once the core GitHub integration is stable.

**Estimated effort to resume**: 2-3 days to add stability improvements and comprehensive error handling.
