# MrPlug Debugging Guide

## Check 1: Extension Loaded & Service Worker Running

1. Go to `chrome://extensions/`
2. Find "MrPlug" extension
3. Click the **reload icon ⟳** to restart the extension
4. Click **"Service Worker"** link (or "background page" in Firefox)
5. **Expected console output:**
   ```
   [MrPlug] Background service worker started
   [MrPlug] 🔄 Auto-configuring from environment on startup
   [MrPlug] 🤖 Provider: anthropic
   [MrPlug] ✅ Extension configured and ready to use!
   ```

**If you see different output**, screenshot it and check:
- Did it say "Configuration already exists"? If so, what are the values?
- Any errors in red?

---

## Check 2: Verify Storage Configuration

In the Service Worker console, run:
```javascript
chrome.storage.local.get('mrplug_config', (result) => {
  console.log('Current config:', result);
});
```

**Expected output:**
```javascript
{
  mrplug_config: {
    llmProvider: "anthropic",
    anthropicApiKey: "sk-ant-api03-2wdWzql...",
    claudeCodeEnabled: false,
    autoScreenshot: true,
    keyboardShortcut: "Alt+Shift+F"
  }
}
```

---

## Check 3: Settings Page Shows API Key

1. Click MrPlug extension icon
2. Click "Settings"
3. **Expected:**
   - LLM Provider dropdown = "Anthropic"
   - Anthropic API Key field shows: `sk-ant-***rRcAAA` (password field)

**If blank:** The storage is not properly configured.

---

## Check 4: Popup Shows Configuration Status

1. Click MrPlug extension icon
2. Open browser console (F12)
3. **Expected console output:**
   ```
   [MrPlug Popup] Config loaded: {
     llmProvider: "anthropic",
     hasAnthropicKey: true,
     anthropicKeyPrefix: "sk-ant-api"
   }
   ```
4. **Expected popup UI:**
   - Green "✓ Ready to use" message at bottom

---

## Check 5: Content Script Loads on Localhost Page

1. Open http://localhost:8080/test-page.html
2. Open browser console (F12)
3. **Expected console output:**
   ```
   [MrPlug] Content script loaded
   [MrPlug] Loading config: {
     llmProvider: "anthropic",
     hasAnthropicKey: true,
     anthropicKeyPrefix: "sk-ant-api"
   }
   [MrPlug] Initializing Anthropic agent
   ```

**If you don't see this:** Reload the page (Cmd+R / Ctrl+R)

---

## Check 6: Test AI Response

1. On http://localhost:8080/test-page.html
2. Press `Alt+Shift+F`
3. Click any element (e.g., a button)
4. Type "describe this element"
5. Watch the console for:
   ```
   [MrPlug] AI agent is initialized, calling analyzeFeedback...
   [MrPlug] AI analysis received: { analysis: "...", ... }
   ```

**If you see error instead:**
- Copy the full error message and stack trace
- Check if it's an API key error, network error, or something else

---

## Common Issues & Fixes

### Issue: "AI agent not initialized"
**Console shows:** `[MrPlug] AI agent not initialized - skipping AI analysis`

**Possible causes:**
1. Config not loaded properly - Check steps 1-3 above
2. Page loaded before extension - Reload page (Cmd+R)
3. Storage not persisting - Clear extension data and reload

**Fix:**
```javascript
// Run in Service Worker console to manually set config
chrome.runtime.sendMessage({
  type: 'set-config',
  data: {
    llmProvider: 'anthropic',
    anthropicApiKey: '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',
    claudeCodeEnabled: false,
    autoScreenshot: true,
    keyboardShortcut: 'Alt+Shift+F'
  }
}, (response) => console.log('Config set:', response));
```

### Issue: API Key showing in Settings but not working

**Possible causes:**
1. Content script loaded before config was set
2. Wrong API key field (using openaiApiKey instead of anthropicApiKey)

**Fix:**
1. Reload the test page
2. Check console for `[MrPlug] Loading config:` message
3. Verify it shows `hasAnthropicKey: true`

### Issue: Network/API errors

**Console shows:** Error messages about fetch, CORS, or API failures

**Possible causes:**
1. Invalid API key
2. Anthropic API rate limits
3. Network connectivity

**Fix:**
1. Verify API key at https://console.anthropic.com/settings/keys
2. Check API usage/limits
3. Try a simple curl test:
   ```bash
   curl https://api.anthropic.com/v1/messages \
     -H "x-api-key: YOUR_KEY" \
     -H "anthropic-version: 2023-06-01" \
     -H "content-type: application/json" \
     -d '{"model":"claude-sonnet-4-20250514","max_tokens":100,"messages":[{"role":"user","content":"Hi"}]}'
   ```

---

## Getting Help

If none of these steps work, please provide:

1. Screenshot of Service Worker console after reload
2. Output of Check 2 (storage contents)
3. Screenshot of Settings page showing API key field
4. Console output from test page when trying to use feedback
5. Any error messages in red

This will help diagnose the exact issue!
