# Instructions for Claude Code in blogengine Directory

This document contains instructions for interacting with the MrPlug browser extension via the MCP server.

## Current Setup

- **MrPlug MCP Server**: Running on `http://localhost:3001` and `ws://localhost:3002`
- **blogengine app**: Running on `http://localhost:3005`
- **Browser Extension**: MrPlug loaded in browser, connected to MCP server
- **Your Location**: `/Users/yuri/ojfbot/blogengine`

## Available MCP Tools

You have access to these MrPlug tools via the MCP server:

### 1. `get_browser_state` - Get current browser plugin status
```
Get the current state of the MrPlug browser extension including:
- Connection status
- Active feedback sessions
- Currently selected elements
- Tabs with MrPlug active
```

### 2. `list_feedback_sessions` - List all feedback sessions
```
List all feedback sessions captured by the browser extension.
Parameters:
- limit: number (default: 10) - Max sessions to return
- includeInactive: boolean (default: false) - Include closed sessions
```

### 3. `get_session_details` - Get detailed session information
```
Get complete details about a specific feedback session including:
- Full conversation history
- Element context (DOM, CSS, etc.)
- Screenshots
- User feedback
Parameters:
- sessionId: string (required) - Session ID to fetch
```

### 4. `send_message_to_session` - Send a message to a chat session
```
Send a message to an active feedback session. The browser will receive
this message and add it to the conversation.
Parameters:
- sessionId: string (required) - Target session ID
- message: string (required) - Message content
- role: 'user' | 'assistant' (default: 'assistant')
```

### 5. `open_browser_tab` - Open a URL in the browser
```
Open a specific URL in the browser, optionally highlighting an element.
Parameters:
- url: string (required) - URL to open
- elementHash: string (optional) - Element to highlight
```

### 6. `select_element` - Highlight an element in the browser
```
Highlight a specific element in the current browser tab.
Parameters:
- elementHash: string (required) - Element identifier
```

### 7. `start_feedback_session` - Start a new feedback session
```
Start a new feedback session for a specific element.
Parameters:
- url: string (required) - Page URL
- elementHash: string (optional) - Element to focus on
```

## Example Workflows

### Workflow 1: Check Browser Status and Active Sessions
```
1. Call get_browser_state to see if browser is connected
2. Call list_feedback_sessions to see what users are working on
3. Call get_session_details on any active session to see the conversation
```

### Workflow 2: Respond to User Feedback
```
1. Call list_feedback_sessions to find active sessions
2. Call get_session_details to read the full conversation and context
3. Analyze the DOM context, screenshots, and user feedback
4. Call send_message_to_session with your response/suggestions
5. (Optional) Make code changes in blogengine based on feedback
6. (Optional) Call send_message_to_session to notify user of fixes
```

### Workflow 3: Start a New Session for Testing
```
1. Call open_browser_tab with url: "http://localhost:3005/some-page"
2. Call start_feedback_session to initiate feedback mode
3. User will see the feedback UI activate in their browser
```

### Workflow 4: Interactive Debugging
```
1. User reports an issue via MrPlug in the browser
2. You call get_session_details to see the full context
3. Review the DOM structure, Redux state, console logs
4. Identify the issue and make code changes in blogengine
5. Call send_message_to_session to tell user "Fixed! Reload the page"
6. Call open_browser_tab to reload the page for them
```

## Testing the Integration

### Step 1: Verify Connection
```bash
claude "What's the current state of the MrPlug browser extension?"
```
This will call `get_browser_state` and show you if the browser is connected.

### Step 2: Check for Active Sessions
```bash
claude "What feedback sessions are currently active in my browser?"
```
This will call `list_feedback_sessions` and show any active conversations.

### Step 3: Create a Test Session (User Action Required)
In the browser:
1. Go to `http://localhost:3005`
2. Press `fn-F1` and click on any element (like a button, heading, etc.)
3. Type some feedback like "This button should be bigger"
4. Submit the feedback

### Step 4: Respond to the Session
```bash
claude "Get details of the most recent feedback session and respond with a suggestion"
```
This will:
1. Call `list_feedback_sessions` to find the latest session
2. Call `get_session_details` to read the conversation
3. Analyze the context
4. Call `send_message_to_session` to respond

### Step 5: Make Code Changes and Notify
```bash
claude "Find the button mentioned in the feedback, update its CSS in the blogengine code to make it bigger, and notify the user via MrPlug"
```

## Example Commands to Try

```bash
# Get browser status
claude "Call the get_browser_state tool from the mrplug MCP server"

# List sessions
claude "Call list_feedback_sessions with limit=5"

# Get session details (replace SESSION_ID with actual ID from list_feedback_sessions)
claude "Call get_session_details with sessionId='SESSION_ID'"

# Send a message to a session
claude "Call send_message_to_session with sessionId='SESSION_ID' and message='I can help with that! Let me analyze the element.'"

# Open a specific page
claude "Call open_browser_tab with url='http://localhost:3005'"
```

## Integration Pattern: Continuous Feedback Loop

Here's how to use MrPlug for a continuous development feedback loop:

```
1. USER: Activates MrPlug on an element in browser (localhost:3005)
2. USER: Provides feedback (e.g., "This form is confusing")
3. BROWSER: Creates feedback session with full context
4. YOU (blogengine Claude): Get session details via MCP
5. YOU: Analyze DOM, screenshots, Redux state, console logs
6. YOU: Identify the issue in the blogengine codebase
7. YOU: Make code changes to fix the issue
8. YOU: Send message to session: "Fixed! The form now has better labels and validation messages"
9. USER: Sees your message in the browser
10. USER: Reloads page to see changes
11. CYCLE CONTINUES...
```

## Debug Output

The browser extension logs all MCP activity to the console:
- `[MCP Client]` - WebSocket connection, messages
- `[MrPlug]` - General extension activity
- Check browser DevTools → Console to see real-time MCP communication

## Troubleshooting

### "Browser not connected"
1. Check MCP server is running: `curl http://localhost:3001/health`
2. Open browser extension settings (click MrPlug icon → Settings)
3. Verify MCP is enabled and URLs are correct
4. Check browser console for `[MCP Client] WebSocket connected`

### "No active sessions"
1. Make sure you're on `http://localhost:3005` in the browser
2. Press `fn-F1` and click an element
3. Type some feedback and submit
4. Session should now appear when you call `list_feedback_sessions`

### "Can't send message to session"
1. Verify sessionId is correct (copy from `list_feedback_sessions`)
2. Make sure session is active (isActive: true)
3. Check browser console for incoming messages

## Next Steps

Once you're connected and can see sessions:
1. Try responding to user feedback in real-time
2. Use the context data (DOM, Redux, console) to debug issues
3. Make code changes in blogengine and notify users via MCP
4. Build an interactive development workflow where users can report issues and you fix them immediately

Good luck! 🚀
