# MrPlug - Quick Start Guide

## 🚀 Extension is Ready!

The MrPlug extension has been built with your Anthropic API key pre-configured!

### ✅ What's Configured

- **API Provider**: Anthropic Claude Sonnet 4
- **API Key**: Configured from env.json (sk-ant-***rRcAAA)
- **Keyboard Shortcut**: `Alt+Shift+F`

---

## 📦 Load the Extension

### Chrome/Edge/Brave
1. Go to `chrome://extensions/`
2. Enable "Developer mode"
3. **If MrPlug is already installed**: Click the reload icon ⟳ on the MrPlug card
4. **If not installed**: Click "Load unpacked" and select `/Users/yuri/ojfbot/mrplug/dist`

### Firefox
1. Go to `about:debugging#/runtime/this-firefox`
2. Click "Load Temporary Add-on"
3. Select `/Users/yuri/ojfbot/mrplug/dist/manifest.json`

**Important**: After reloading, check the Service Worker console:
- Click "Service Worker" link on the extension card
- You should see: `[MrPlug] 🔄 Auto-configuring from environment on startup`

---

## ✓ Verify Configuration

After loading the extension:

1. Click the MrPlug icon in your browser toolbar
2. Click "Open Settings"
3. You should see:
   - **LLM Provider**: "Anthropic" selected
   - **Anthropic API Key**: Shows as `sk-ant-***rRcAAA` (starred out for security)
4. The extension is now ready to use!

---

## 🧪 Test It!

1. Open: **http://localhost:8080/test-page.html**
2. Press `Alt+Shift+F` to activate
3. Click any element
4. Describe your feedback (e.g., "This button should be larger")
5. See AI analysis with actionable suggestions!

**Server Running**: http://localhost:8080

---

## 🔧 Troubleshooting

**API key not showing in settings?**
- Make sure you loaded the extension from the `/dist` folder
- Try removing and re-adding the extension
- Check browser console for any errors

**AI not responding?**
- Verify your API key is valid at https://console.anthropic.com/settings/keys
- Check browser developer console for error messages
- Make sure you're on a localhost page (http://localhost:*)

---

Happy Testing! 🎉
