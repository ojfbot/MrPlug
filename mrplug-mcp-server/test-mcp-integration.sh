#!/bin/bash

# MCP Integration Test Script
# Tests the full integration between Browser Extension <-> HTTP Server <-> STDIO Server

set -e

echo "========================================="
echo "MrPlug MCP Integration Test Suite"
echo "========================================="
echo ""

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

HTTP_SERVER_URL="http://localhost:3001"
WS_SERVER_URL="ws://localhost:3002"

# Test counter
PASSED=0
FAILED=0

# Helper functions
pass() {
    echo -e "${GREEN}✓${NC} $1"
    ((PASSED++))
}

fail() {
    echo -e "${RED}✗${NC} $1"
    ((FAILED++))
}

warn() {
    echo -e "${YELLOW}⚠${NC} $1"
}

test_section() {
    echo ""
    echo "─────────────────────────────────────────"
    echo "$1"
    echo "─────────────────────────────────────────"
}

# Test 1: HTTP Server Health Check
test_section "Test 1: HTTP Server Health Check"
if curl -s "$HTTP_SERVER_URL/health" > /dev/null 2>&1; then
    pass "HTTP server is running on port 3001"
else
    fail "HTTP server is NOT running on port 3001"
    echo "   Please start it with: cd mrplug-mcp-server && npm run dev"
    exit 1
fi

# Test 2: Get Browser State via HTTP API
test_section "Test 2: HTTP REST API - Get Browser State"
RESPONSE=$(curl -s "$HTTP_SERVER_URL/plugin/status")
if echo "$RESPONSE" | jq -e '.isConnected' > /dev/null 2>&1; then
    pass "HTTP API returns valid browser state"
    IS_CONNECTED=$(echo "$RESPONSE" | jq -r '.isConnected')
    if [ "$IS_CONNECTED" = "true" ]; then
        pass "Browser extension is connected"
        ACTIVE_SESSIONS=$(echo "$RESPONSE" | jq -r '.activeSessions | length')
        echo "   Active sessions: $ACTIVE_SESSIONS"
    else
        warn "Browser extension is NOT connected"
        echo "   Make sure MrPlug extension is loaded and MCP is enabled in settings"
    fi
else
    fail "HTTP API returned invalid response"
fi

# Test 3: List Sessions via HTTP API
test_section "Test 3: HTTP REST API - List Sessions"
SESSION_RESPONSE=$(curl -s "$HTTP_SERVER_URL/plugin/sessions")
if echo "$SESSION_RESPONSE" | jq -e '.sessions' > /dev/null 2>&1; then
    pass "Sessions endpoint is working"
    SESSION_COUNT=$(echo "$SESSION_RESPONSE" | jq -r '.count')
    echo "   Total sessions: $SESSION_COUNT"
else
    fail "Sessions endpoint returned invalid response"
fi

# Test 4: STDIO Server - List Tools
test_section "Test 4: STDIO MCP Server - List Tools"
TOOLS_REQUEST='{"jsonrpc":"2.0","id":1,"method":"tools/list"}'
TOOLS_RESPONSE=$(echo "$TOOLS_REQUEST" | npx -y tsx src/stdio-server.ts 2>/dev/null | tail -1)

if echo "$TOOLS_RESPONSE" | jq -e '.result.tools' > /dev/null 2>&1; then
    TOOL_COUNT=$(echo "$TOOLS_RESPONSE" | jq -r '.result.tools | length')
    if [ "$TOOL_COUNT" -eq 7 ]; then
        pass "STDIO server exposes all 7 MCP tools"
        echo "$TOOLS_RESPONSE" | jq -r '.result.tools[] | "   • \(.name)"'
    else
        fail "Expected 7 tools, got $TOOL_COUNT"
    fi
else
    fail "STDIO server did not return valid tools list"
fi

# Test 5: STDIO Server - Call get_browser_state
test_section "Test 5: STDIO MCP Server - Call get_browser_state Tool"
STATE_REQUEST='{"jsonrpc":"2.0","id":2,"method":"tools/call","params":{"name":"get_browser_state","arguments":{"includeSessionDetails":true}}}'
STATE_RESPONSE=$(echo "$STATE_REQUEST" | npx -y tsx src/stdio-server.ts 2>/dev/null | tail -1)

if echo "$STATE_RESPONSE" | jq -e '.result.content[0].text' > /dev/null 2>&1; then
    pass "get_browser_state tool executed successfully"

    # Parse the state from the response
    STATE_TEXT=$(echo "$STATE_RESPONSE" | jq -r '.result.content[0].text')
    if echo "$STATE_TEXT" | jq -e '.isConnected' > /dev/null 2>&1; then
        pass "Tool returned valid browser state"

        IS_CONNECTED=$(echo "$STATE_TEXT" | jq -r '.isConnected')
        if [ "$IS_CONNECTED" = "true" ]; then
            pass "STDIO server can see browser connection"
        else
            warn "STDIO server reports browser NOT connected"
        fi
    else
        fail "Tool returned invalid state format"
    fi
else
    fail "get_browser_state tool call failed"
    echo "   Response: $STATE_RESPONSE"
fi

# Test 6: Check Claude Code Config
test_section "Test 6: Claude Code Configuration"
if [ -f "../.claude/config.json" ]; then
    pass "Claude Code config file exists"

    if grep -q "mrplug" "../.claude/config.json"; then
        pass "MrPlug MCP server is configured"

        # Show the config
        echo "   Config:"
        cat ../.claude/config.json | jq -r '.mcpServers.mrplug | "   Command: \(.command) \(.args | join(" "))"'
    else
        fail "MrPlug MCP server NOT found in config"
    fi
else
    fail "Claude Code config file NOT found"
    echo "   Expected at: $(pwd)/../.claude/config.json"
fi

# Test 7: End-to-End Integration Test
test_section "Test 7: End-to-End Integration (if browser connected)"
if [ "$IS_CONNECTED" = "true" ]; then
    # Try to list sessions via STDIO
    LIST_REQUEST='{"jsonrpc":"2.0","id":3,"method":"tools/call","params":{"name":"list_feedback_sessions","arguments":{"limit":5}}}'
    LIST_RESPONSE=$(echo "$LIST_REQUEST" | npx -y tsx src/stdio-server.ts 2>/dev/null | tail -1)

    if echo "$LIST_RESPONSE" | jq -e '.result' > /dev/null 2>&1; then
        pass "End-to-end: STDIO server → HTTP server → Browser"

        # Parse session list
        SESSION_LIST=$(echo "$LIST_RESPONSE" | jq -r '.result.content[0].text')
        if echo "$SESSION_LIST" | jq -e '.[0]' > /dev/null 2>&1; then
            SESSION_COUNT=$(echo "$SESSION_LIST" | jq 'length')
            pass "Retrieved $SESSION_COUNT session(s) from browser"
        else
            warn "No sessions found (expected if none created yet)"
        fi
    else
        fail "End-to-end integration failed"
    fi
else
    warn "Skipping end-to-end test (browser not connected)"
    echo "   To test fully:"
    echo "   1. Enable MCP in MrPlug extension settings"
    echo "   2. Set MCP Server URL: http://localhost:3001"
    echo "   3. Set MCP WebSocket URL: ws://localhost:3002"
    echo "   4. Reload the extension"
fi

# Summary
test_section "Test Summary"
echo ""
echo "Tests Passed: ${GREEN}$PASSED${NC}"
echo "Tests Failed: ${RED}$FAILED${NC}"
echo ""

if [ $FAILED -eq 0 ]; then
    echo -e "${GREEN}✓ All tests passed!${NC}"
    echo ""
    echo "Next steps:"
    echo "  1. Restart Claude Code in this directory"
    echo "  2. Try: claude \"What feedback sessions are active in my browser?\""
    echo ""
    exit 0
else
    echo -e "${RED}✗ Some tests failed${NC}"
    echo ""
    echo "Troubleshooting:"
    echo "  • Make sure HTTP server is running: cd mrplug-mcp-server && npm run dev"
    echo "  • Check browser extension MCP settings"
    echo "  • View server logs in the terminal running npm run dev"
    echo ""
    exit 1
fi
