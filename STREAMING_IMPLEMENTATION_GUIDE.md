# Streaming Implementation Guide - For Claude Code (blogengine)

## Overview

When users click a suggestion in the browser, you (Claude Code in blogengine) can now receive the implementation request and send streaming progress updates back to the browser in real-time!

---

## How It Works

```
User clicks suggestion in browser
       ↓
Browser sends request to MCP server
       ↓
MCP server queues implementation request
       ↓
YOU (Claude Code) polls for requests
       ↓
YOU implement the fix
       ↓
YOU send progress updates
       ↓
MCP server forwards to browser via WebSocket
       ↓
Browser shows streaming messages in chat!
```

---

## Step 1: Send Progress Updates from Claude Code

Use curl to send progress messages to the MCP server:

### Example Progress Update:

```bash
curl -X POST http://localhost:3001/implementation/progress \
  -H "Content-Type: application/json" \
  -d '{
    "requestId": "impl_1234567890_abc123",
    "sessionId": "session-uuid-here",
    "message": "🔍 Analyzing component structure...",
    "status": "analyzing",
    "details": {
      "toolCalls": ["read_file", "grep_pattern"]
    }
  }'
```

### Progress Update Format:

```typescript
{
  requestId: string;    // From the implementation request
  sessionId: string;    // Session ID where user clicked
  message: string;      // User-friendly progress message
  status: string;       // analyzing | implementing | testing | complete | error
  details?: {           // Optional extra info
    toolCalls?: string[];  // Tools you're using
    files?: string[];      // Files being modified
    error?: string;        // Error details if failed
  };
}
```

---

## Step 2: Example Streaming Workflow

Here's how you'd send streaming updates while implementing a fix:

```bash
# Step 1: Start analyzing
curl -X POST http://localhost:3001/implementation/progress \
  -H "Content-Type: application/json" \
  -d '{
    "requestId": "impl_123",
    "sessionId": "session_abc",
    "message": "🔍 Reading component file...",
    "status": "analyzing"
  }'

# Step 2: Found the issue
curl -X POST http://localhost:3001/implementation/progress \
  -H "Content-Type: application/json" \
  -d '{
    "requestId": "impl_123",
    "sessionId": "session_abc",
    "message": "✅ Found button component at src/components/Button.tsx:45",
    "status": "analyzing",
    "details": {
      "files": ["src/components/Button.tsx"]
    }
  }'

# Step 3: Implementing fix
curl -X POST http://localhost:3001/implementation/progress \
  -H "Content-Type: application/json" \
  -d '{
    "requestId": "impl_123",
    "sessionId": "session_abc",
    "message": "⚡ Increasing button min-width from 80px to 120px...",
    "status": "implementing",
    "details": {
      "toolCalls": ["edit_file"]
    }
  }'

# Step 4: Testing
curl -X POST http://localhost:3001/implementation/progress \
  -H "Content-Type": "application/json" \
  -d '{
    "requestId": "impl_123",
    "sessionId": "session_abc",
    "message": "🧪 Running type check...",
    "status": "testing"
  }'

# Step 5: Complete!
curl -X POST http://localhost:3001/implementation/progress \
  -H "Content-Type: application/json" \
  -d '{
    "requestId": "impl_123",
    "sessionId": "session_abc",
    "message": "✅ Implementation complete! Reload the page to see changes.",
    "status": "complete",
    "details": {
      "files": ["src/components/Button.tsx"],
      "changes": "Updated min-width CSS property"
    }
  }'
```

---

## What the User Sees

When you send these progress updates, the user sees them appear in real-time in the browser modal:

```
[status] [🔌MCP]                 12:34:56  [🐛]
⚡ Sending fix request to Claude Code...

[status] [🧩Extension]           12:34:57  [🐛]
✅ Request sent! Waiting for Claude Code to implement changes...

[system] [🔌MCP]                 12:35:01  [🐛]
🔍 Reading component file...

[system] [🔌MCP]                 12:35:03  [🐛]
✅ Found button component at src/components/Button.tsx:45

[system] [🔌MCP]                 12:35:05  [🐛]
⚡ Increasing button min-width from 80px to 120px...

[system] [🔌MCP]                 12:35:08  [🐛]
🧪 Running type check...

[system] [🔌MCP]                 12:35:10  [🐛]
✅ Implementation complete! Reload the page to see changes.
```

Plus, each message has a debug toggle (🐛) showing MCP activity and tool calls!

---

## Emoji Guide for Progress Messages

Use emojis to make progress messages clear and engaging:

- 🔍 **Analyzing** - Reading files, searching code
- ✅ **Success** - Found something, completed a step
- ⚡ **Implementing** - Making code changes
- 🧪 **Testing** - Running tests, type checking
- 📝 **Writing** - Creating files, documentation
- 🔧 **Fixing** - Bug fixes, corrections
- ⚠️ **Warning** - Non-critical issues
- ❌ **Error** - Something failed
- 💡 **Suggestion** - Offering alternatives
- 🚀 **Complete** - All done!

---

## Full Example: Interactive Fix Session

### User Action:
User clicks "Make button bigger" suggestion

### Your Response (Claude Code):

```javascript
const requestId = "impl_1734567890_xyz";
const sessionId = "8a0f545d-84ba-4195-bafc-1738362e9ebf";
const mcpUrl = "http://localhost:3001/implementation/progress";

// Helper function
function sendProgress(message, status, details = {}) {
  exec(`curl -X POST ${mcpUrl} -H "Content-Type: application/json" -d '${JSON.stringify({
    requestId,
    sessionId,
    message,
    status,
    details
  })}'`);
}

// Start implementing
sendProgress("🔍 Analyzing button component...", "analyzing");

// Read the file
const content = readFile("src/components/Button.tsx");
sendProgress("✅ Found Button component", "analyzing");

// Make the change
editFile("src/components/Button.tsx", ...);
sendProgress("⚡ Increased min-width to 120px", "implementing", {
  toolCalls: ["edit_file"],
  files: ["src/components/Button.tsx"]
});

// Type check
exec("npm run type-check");
sendProgress("🧪 Type check passed", "testing");

// Done!
sendProgress("🚀 Implementation complete! Button is now bigger. Reload to see changes.", "complete", {
  files: ["src/components/Button.tsx"],
  changes: "Updated min-width from 80px to 120px"
});
```

---

## Testing It Yourself

### From blogengine terminal:

```bash
# Simulate receiving an implementation request and sending progress
curl -X POST http://localhost:3001/implementation/progress \
  -H "Content-Type: application/json" \
  -d '{
    "requestId": "test_123",
    "sessionId": "YOUR_SESSION_ID_HERE",
    "message": "🎉 Hello from Claude Code! This is a test progress message.",
    "status": "testing"
  }'
```

Watch the browser - you should see the message appear instantly in the chat!

---

## Advanced: Streaming with Details

You can include extra information in the `details` field:

```json
{
  "requestId": "impl_123",
  "sessionId": "session_abc",
  "message": "⚡ Updated 3 files",
  "status": "implementing",
  "details": {
    "toolCalls": ["edit_file", "edit_file", "edit_file"],
    "files": [
      "src/components/Button.tsx",
      "src/styles/button.css",
      "src/types/button.ts"
    ],
    "linesChanged": 25,
    "summary": "Refactored button sizing system"
  }
}
```

Users can click the 🐛 debug icon on the message to see all these details!

---

## Error Handling

If something goes wrong:

```bash
curl -X POST http://localhost:3001/implementation/progress \
  -H "Content-Type: application/json" \
  -d '{
    "requestId": "impl_123",
    "sessionId": "session_abc",
    "message": "❌ Type check failed: Property 'size' does not exist on type 'ButtonProps'",
    "status": "error",
    "details": {
      "error": "TypeScript error at Button.tsx:45",
      "suggestion": "Add 'size' property to ButtonProps interface"
    }
  }'
```

---

## Best Practices

1. **Send frequent updates** - Every major step (analyzing, implementing, testing)
2. **Use descriptive messages** - Say what you're doing, not just "working..."
3. **Include file paths** - Help users know what's changing
4. **End with clear next steps** - Tell users to reload, test, etc.
5. **Handle errors gracefully** - Explain what failed and suggest fixes

---

## MCP Debug Monitor

Every progress update also appears in the MCP Debug Monitor panel in the browser:

```
▼ MCP Debug Monitor  [●Connected]  [15 events]
─────────────────────────────────────────────
💬 ← Progress: 🔍 Analyzing...      12:35:01
💬 ← Progress: ⚡ Implementing...   12:35:05
💬 ← Progress: ✅ Complete!         12:35:10
```

Click any event to see the full JSON payload!

---

## Ready to Test!

1. **User**: Click a suggestion in browser
2. **You**: Send progress updates as you implement
3. **User**: Watch real-time progress in the chat!

The implementation request contains:
- `sessionId`: Session to send messages to
- `action`: What to implement (title, description, priority)
- `elementContext`: Full DOM context of the element
- `sourceCodePath`: Path to source code (~/ojfbot/blogengine)

Have fun streaming live code changes to the browser! 🚀
