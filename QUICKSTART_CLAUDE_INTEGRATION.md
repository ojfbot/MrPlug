# Quick Start: Claude Code Integration

Get the MrPlug ↔ Claude Code integration running in 5 minutes!

## Prerequisites

- Node.js 20.18.1+ installed
- MrPlug browser extension installed
- Claude Code CLI installed

## Step-by-Step Setup

### 1️⃣ Install & Start MCP Server (2 minutes)

```bash
# Navigate to project root
cd mrplug

# Install MCP server dependencies
cd mrplug-mcp-server
npm install

# Start the server
npm run dev
```

✅ **Success**: You should see this banner:
```
╔═══════════════════════════════════════════════════════════════╗
║              MrPlug MCP Server Started                        ║
╚═══════════════════════════════════════════════════════════════╝

Ready to connect! 🚀
```

**Keep this terminal running!**

### 2️⃣ Configure Browser Extension (1 minute)

1. Open your browser
2. Click the **MrPlug extension icon**
3. Click **"Settings"** or **"Options"**
4. Find **"Advanced Integrations"** section
5. Toggle **"Enable MCP Server Integration"** ON
6. Enter:
   - **MCP Server URL**: `http://localhost:3001`
   - **MCP WebSocket URL**: `ws://localhost:3002`
7. Click **"Save"**

✅ **Success**: Open browser console (F12) and look for:
```
[MCP Client] WebSocket connected
[MCP Client] State sync started
```

### 3️⃣ Test with Claude Code (1 minute)

The MCP server is **already configured** via `.claude/config.json`!

Open a new terminal in the `mrplug` directory and try:

```bash
claude "What's the current state of the MrPlug extension?"
```

✅ **Success**: Claude should respond with browser plugin state info!

## Quick Test Commands

Try these with Claude Code:

```bash
# Check browser state
claude "What feedback sessions are active in my browser?"

# List sessions
claude "Show me all feedback sessions"

# Get element details (if you have an active session)
claude "What element are we discussing?"

# Open browser
claude "Open the browser and show me the element"
```

## Verify Everything Works

### ✅ Checklist

- [ ] MCP server is running (port 3001 & 3002)
- [ ] Browser extension shows MCP connected in console
- [ ] Claude Code can query browser state
- [ ] You can see active sessions from Claude

### 🔍 Quick Health Check

**Terminal 1 (MCP Server Running):**
```
[WS] Registered connection: ws_...
[MCP Client] Connected
```

**Browser Console (F12):**
```
[MCP Client] WebSocket connected
[MCP Client] State sync started
```

**Terminal 2 (Test Claude):**
```bash
claude "What's the MrPlug browser state?"
# Should return JSON with browser info
```

## Common Issues

### Issue: MCP server won't start

**Error**: `EADDRINUSE: address already in use`

**Fix**:
```bash
# Kill process on port 3001
lsof -i :3001
kill -9 <PID>

# Try again
npm run dev
```

### Issue: Browser won't connect

**Error**: No `[MCP Client]` logs in browser console

**Fix**:
1. Verify MCP server is running: `curl http://localhost:3001/health`
2. Check extension settings are saved
3. Reload the browser extension
4. Reload the page

### Issue: Claude can't see browser

**Error**: Claude responds "I don't have access to browser state"

**Fix**:
1. Check `.claude/config.json` exists in project root
2. Restart Claude Code
3. Verify MCP server is running
4. Try: `claude --debug "What's the browser state?"`

## What's Next?

Now that it's working, check out:

- **CLAUDE_INTEGRATION.md** - Full setup guide with examples
- **IMPLEMENTATION_SUMMARY.md** - Technical details
- **mrplug-mcp-server/README.md** - MCP server API reference

## Example Workflow

1. **Open your localhost app** in browser (e.g., `http://localhost:3000`)

2. **Start a feedback session** in MrPlug:
   - Press `Alt+Shift+F`
   - Click a button or element
   - Type some feedback like "this button is too small"

3. **Query from Claude**:
   ```bash
   claude "What am I working on in the browser?"
   ```

   Claude will see your feedback session!

4. **Get element details**:
   ```bash
   claude "Show me the styles of that button"
   ```

5. **Get suggestions from Claude**:
   ```bash
   claude "What padding would you recommend for better mobile UX?"
   ```

6. **Send suggestion to browser**:
   Claude can use `add_session_message` to send suggestions directly to your browser session!

## Need Help?

- **Documentation**: See `CLAUDE_INTEGRATION.md`
- **Issues**: https://github.com/ojfbot/mrplug/issues
- **MCP Spec**: https://spec.modelcontextprotocol.io/

---

**You're all set! 🎉** Start using Claude Code to interact with your browser feedback sessions!
