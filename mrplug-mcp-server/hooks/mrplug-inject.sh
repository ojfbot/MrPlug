#!/usr/bin/env bash
# MrPlug → Claude Code injection hook
#
# Install as a Claude Code UserPromptSubmit hook:
#   Add to ~/.claude/settings.json:
#   {
#     "hooks": {
#       "UserPromptSubmit": [
#         { "hooks": [{ "type": "command", "command": "/path/to/mrplug-inject.sh" }] }
#       ]
#     }
#   }
#
# When MrPlug sends a payload to the relay (pnpm start in mrplug-mcp-server/),
# this hook injects the full context into Claude Code's next prompt.

RELAY_URL="${MRPLUG_RELAY_URL:-http://127.0.0.1:27182}"

# Read + consume payload from relay
RESPONSE=$(curl -sf --max-time 1 "${RELAY_URL}/consume" 2>/dev/null)
STATUS=$?

# If relay unreachable or no pending payload, pass through unchanged
if [ $STATUS -ne 0 ] || [ -z "$RESPONSE" ]; then
  cat  # pass stdin through unchanged
  exit 0
fi

# Check for 204 (no content) — curl -sf returns empty body
if [ -z "$RESPONSE" ]; then
  cat
  exit 0
fi

# Extract fields from JSON payload
PAGE_URL=$(echo "$RESPONSE" | python3 -c "import sys,json; d=json.load(sys.stdin)['payload']; print(d.get('pageUrl',''))" 2>/dev/null)
USER_COMMENT=$(echo "$RESPONSE" | python3 -c "import sys,json; d=json.load(sys.stdin)['payload']; print(d.get('userComment',''))" 2>/dev/null)
TAG=$(echo "$RESPONSE" | python3 -c "import sys,json; d=json.load(sys.stdin)['payload']; ctx=d.get('elementContext',{}); print(ctx.get('tagName','?'))" 2>/dev/null)
DOM_PATH=$(echo "$RESPONSE" | python3 -c "import sys,json; d=json.load(sys.stdin)['payload']; ctx=d.get('elementContext',{}); print(ctx.get('domPath',''))" 2>/dev/null)
CLASSES=$(echo "$RESPONSE" | python3 -c "import sys,json; d=json.load(sys.stdin)['payload']; ctx=d.get('elementContext',{}); print(' '.join(ctx.get('classList',[])))" 2>/dev/null)
LOCAL_PATH=$(echo "$RESPONSE" | python3 -c "import sys,json; d=json.load(sys.stdin)['payload']; ctx=d.get('elementContext',{}); print(ctx.get('localPath',''))" 2>/dev/null)
AI_SUMMARY=$(echo "$RESPONSE" | python3 -c "
import sys,json
d=json.load(sys.stdin)['payload']
ai=d.get('aiAnalysis',{})
if ai:
    print(ai.get('summary',''))
" 2>/dev/null)
AC=$(echo "$RESPONSE" | python3 -c "
import sys,json
d=json.load(sys.stdin)['payload']
ai=d.get('aiAnalysis',{}) or {}
ac=ai.get('acceptanceCriteria',[]) or []
for item in ac:
    print(f'  - {item}')
" 2>/dev/null)

# Build context block
CONTEXT_BLOCK="---
[MrPlug context injected from browser inspection]
Page: ${PAGE_URL}
Element: <${TAG}> .${CLASSES}
DOM path: ${DOM_PATH}
User comment: ${USER_COMMENT}"

if [ -n "$AI_SUMMARY" ]; then
  CONTEXT_BLOCK="${CONTEXT_BLOCK}

AI analysis: ${AI_SUMMARY}"
fi

if [ -n "$AC" ]; then
  CONTEXT_BLOCK="${CONTEXT_BLOCK}

Acceptance criteria:
${AC}"
fi

if [ -n "$LOCAL_PATH" ]; then
  CONTEXT_BLOCK="${CONTEXT_BLOCK}

Local source: ${LOCAL_PATH}"
fi

CONTEXT_BLOCK="${CONTEXT_BLOCK}
---"

# Read original prompt from stdin and prepend context
ORIGINAL_PROMPT=$(cat)

printf '%s\n\n%s' "$CONTEXT_BLOCK" "$ORIGINAL_PROMPT"
