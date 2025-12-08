# MrPlug Quick Start Guide

Get up and running with MrPlug in 5 minutes.

## Prerequisites

- Node.js v20.18.1 (we'll install this)
- Git
- Chrome, Edge, or Brave browser

## Step 1: Clone and Setup (2 minutes)

```bash
# Navigate to the mrplug directory (already exists in your case)
cd mrplug

# Run automated setup script
./scripts/setup.sh
```

This will:
- Install fnm (Node version manager)
- Install Node.js v20.18.1
- Install pnpm package manager
- Install project dependencies
- Generate placeholder icons
- Build the extension

## Step 2: Load Extension in Browser (1 minute)

### Chrome / Edge / Brave

1. Open `chrome://extensions/`
2. Enable **Developer mode** (toggle in top-right)
3. Click **Load unpacked**
4. Navigate to `mrplug/dist` folder and select it
5. Extension icon should appear in toolbar

### Firefox

1. Open `about:debugging#/runtime/this-firefox`
2. Click **Load Temporary Add-on**
3. Navigate to `mrplug/dist` and select `manifest.json`
4. Extension icon should appear in toolbar

## Step 3: Configure API Keys (2 minutes)

1. Click the **MrPlug** extension icon in your browser toolbar
2. Click **Settings**
3. Add your API keys:

   **OpenAI API Key** (Required):
   - Go to [platform.openai.com/api-keys](https://platform.openai.com/api-keys)
   - Click "Create new secret key"
   - Copy and paste into MrPlug settings

   **GitHub Token** (Optional):
   - Go to [github.com/settings/tokens/new?scopes=repo](https://github.com/settings/tokens/new?scopes=repo)
   - Generate token with `repo` scope
   - Copy and paste into MrPlug settings
   - Add repository in format: `owner/repo`

4. Click **Save Settings**

## Step 4: Try It Out (1 minute)

1. Navigate to any localhost development site (e.g., `http://localhost:3000`)
2. Press `Alt+Shift+F` to activate feedback mode
3. Click on any UI element (button, input, div, etc.)
4. Type feedback in natural language:
   - "This button should be bigger"
   - "The spacing here is too tight"
   - "Change this to blue"
5. Press **Send**
6. Review AI analysis and suggested actions
7. Choose to create GitHub issue or apply fix via Claude Code

## Common Issues

### "Extension not loading"
- Make sure you ran `pnpm build` first
- Check browser console for errors (Inspect → Console)
- Verify you're selecting the `dist` folder, not root

### "Feedback mode not activating"
- Confirm you're on `localhost` or `127.0.0.1`
- Try reloading the page
- Check that Alt+Shift+F isn't conflicting with other shortcuts

### "AI analysis failing"
- Verify OpenAI API key is correct in settings
- Check you have credits in your OpenAI account
- Look for errors in browser console

### "GitHub issue creation failing"
- Confirm token has `repo` scope
- Verify repository exists and token has access
- Check repository format is `owner/repo`

## Development Mode

For active development with hot reload:

```bash
# Terminal 1: Run build in watch mode
pnpm dev

# Terminal 2: (optional) Run tests in watch mode
pnpm test
```

After making changes:
1. Go to `chrome://extensions/`
2. Click the refresh icon on MrPlug extension
3. Reload your localhost page

## Next Steps

- Read the full [README.md](README.md) for detailed documentation
- Check out [CONTRIBUTING.md](CONTRIBUTING.md) to contribute
- Review [PROJECT_SUMMARY.md](PROJECT_SUMMARY.md) for architecture details
- Join discussions on GitHub

## Need Help?

- **GitHub Issues**: Report bugs or request features
- **GitHub Discussions**: Ask questions, share ideas
- **Documentation**: Check README.md for detailed guides

---

Happy feedback gathering! 🚀
