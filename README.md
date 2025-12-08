# MrPlug - AI-Powered UI Feedback Assistant

MrPlug is a browser extension that enables developers, designers, and project managers to provide natural language feedback on UI elements and automatically generate GitHub issues or apply code fixes through Claude Code integration.

## Features

- **Element Selection**: Use keyboard shortcuts (Alt+Shift+F or Alt+Shift+Click) to select any element on localhost development sites
- **Natural Language Feedback**: Describe UI issues in plain English ("this button should be bigger", "spacing is off", etc.)
- **AI-Powered Analysis**: LangChain-backed AI agent analyzes your feedback and suggests actionable solutions
- **IBM Carbon Design System**: Clean, professional UI built with IBM Carbon components
- **GitHub Integration**: Automatically create well-structured GitHub issues with element context and screenshots
- **Claude Code Integration**: Send code modification commands directly to Claude Code/CLI for instant fixes
- **Conversation History**: Multi-turn conversations to refine feedback and solutions
- **Secure by Design**: API keys stored securely, no hardcoded secrets, comprehensive .gitignore

## Architecture

```
mrplug/
├── src/
│   ├── background/        # Service worker for extension lifecycle
│   ├── content/           # Injected scripts for element selection
│   ├── popup/             # Quick access popup interface
│   ├── options/           # Settings and configuration page
│   ├── components/        # React components (Carbon Design)
│   ├── lib/               # Core functionality
│   │   ├── element-capture.ts   # DOM element context extraction
│   │   ├── storage.ts           # Browser storage management
│   │   ├── ai-agent.ts          # LangChain AI integration
│   │   ├── github-integration.ts # GitHub API client
│   │   └── claude-integration.ts # Claude Code communication
│   ├── types/             # TypeScript type definitions
│   └── test/              # Behavior-driven tests
├── Dockerfile             # Container configuration
├── docker-compose.yml     # Development environment
└── vite.config.ts         # Build configuration
```

## Prerequisites

- **Node.js**: v20.18.1 (LTS) - managed via fnm
- **pnpm**: v8.15.0 or higher
- **fnm**: Fast Node Manager (optional but recommended)
- **Docker**: For containerized development (optional)

### API Keys Required

- **OpenAI API Key**: For AI-powered feedback analysis (required)
- **GitHub Personal Access Token**: For issue creation (optional)
- **Claude Code**: Running Claude Code/CLI instance (optional)

## Installation

### 1. Setup Node.js Environment

```bash
# Install fnm if not already installed
curl -fsSL https://fnm.vercel.app/install | bash

# Use the correct Node.js version
fnm use

# Install pnpm if not already installed
npm install -g pnpm@8.15.0
```

### 2. Install Dependencies

```bash
cd mrplug
pnpm install
```

### 3. Build the Extension

```bash
# Development build with hot reload
pnpm dev

# Production build
pnpm build
```

### 4. Load Extension in Browser

#### Chrome/Edge/Brave

1. Navigate to `chrome://extensions/`
2. Enable "Developer mode"
3. Click "Load unpacked"
4. Select the `mrplug/dist` directory

#### Firefox

1. Navigate to `about:debugging#/runtime/this-firefox`
2. Click "Load Temporary Add-on"
3. Select any file in the `mrplug/dist` directory

### 5. Configure API Keys

1. Click the MrPlug extension icon
2. Click "Settings" to open the options page
3. Enter your API keys:
   - OpenAI API Key (required): Get from [OpenAI Platform](https://platform.openai.com/api-keys)
   - GitHub Token (optional): Create a [Personal Access Token](https://github.com/settings/tokens/new?scopes=repo)
   - GitHub Repository (optional): Format `owner/repo`
4. Save settings

## Usage

### Basic Workflow

1. **Navigate** to your localhost development application
2. **Activate** feedback mode:
   - Press `Alt+Shift+F`, OR
   - Click the MrPlug extension icon and click "Start Feedback Mode"
3. **Select** any UI element by clicking on it
4. **Describe** the issue or desired change in natural language
5. **Review** AI-generated analysis and suggested actions
6. **Choose** an action:
   - Create GitHub Issue
   - Apply Fix via Claude Code
   - Continue conversation for refinement

### Example Feedback Scenarios

**Styling Issues:**
- "This button is too small"
- "The color should be changed to match our brand blue"
- "Spacing between these items is too tight"

**Layout Problems:**
- "This is rendering out of order"
- "These elements should be in a row, not a column"
- "The width is too narrow on mobile"

**Feature Requests:**
- "This should expand into a form with email and password inputs"
- "Add a loading spinner here when submitting"
- "The agent response should appear as options below this input"

**UX Feedback:**
- "This looks weird on my screen"
- "The interaction feels laggy"
- "The chat should be more condensed"

### Keyboard Shortcuts

- `Alt+Shift+F`: Toggle feedback mode
- `Alt+Shift+Click`: Select element (when in feedback mode)

## Docker Development

### Build and Run with Docker

```bash
# Build the container
docker-compose build

# Run the build
docker-compose up

# Build will be output to ./dist
```

### Using Docker for Consistent Builds

```bash
# Build extension in container
docker-compose run mrplug pnpm build

# Run tests in container
docker-compose run mrplug pnpm test

# Type check in container
docker-compose run mrplug pnpm type-check
```

## Testing

MrPlug uses behavior-driven testing focused on user interactions and outcomes.

```bash
# Run all tests
pnpm test

# Run tests with UI
pnpm test:ui

# Run tests with coverage
pnpm test:coverage
```

### Testing Philosophy

Tests validate **user behaviors and outcomes**, not internal implementation:

✅ **Good**: "User can select an element and see context captured"
❌ **Bad**: "captureElement() returns an ElementContext object"

✅ **Good**: "User receives actionable feedback when submitting a request"
❌ **Bad**: "analyzeFeedback() calls the OpenAI API"

## Development

### Project Structure

- **Content Script** (`src/content/`): Injected into web pages, handles element selection and overlay UI
- **Background Worker** (`src/background/`): Manages extension lifecycle, message passing, and API calls
- **Popup** (`src/popup/`): Quick access interface for activating feedback mode
- **Options** (`src/options/`): Configuration page for API keys and preferences
- **Components** (`src/components/`): Reusable React components using IBM Carbon Design
- **Library** (`src/lib/`): Core business logic (AI, storage, integrations)

### Build Scripts

```bash
pnpm dev          # Development build with watch mode
pnpm build        # Production build
pnpm preview      # Preview production build
pnpm test         # Run test suite
pnpm lint         # Lint TypeScript files
pnpm type-check   # Type check without emitting files
pnpm package      # Create distributable .zip file
```

### Adding New Features

1. Define types in `src/types/index.ts`
2. Implement core logic in `src/lib/`
3. Create UI components in `src/components/`
4. Add behavior-driven tests in `src/**/__tests__/`
5. Update documentation

## Security

### Best Practices Built-In

- ✅ **No hardcoded secrets**: All API keys stored in browser storage
- ✅ **Comprehensive .gitignore**: Prevents accidental secret commits
- ✅ **Content Security Policy**: Strict CSP in manifest
- ✅ **Input sanitization**: User inputs are validated
- ✅ **Minimal permissions**: Only requests necessary browser permissions
- ✅ **HTTPS only**: API calls over secure connections
- ✅ **No eval()**: No dynamic code execution

### API Key Storage

API keys are stored in browser's local storage (`chrome.storage.local`) which is:
- Encrypted at rest
- Isolated per extension
- Never transmitted except to configured APIs
- Cleared when extension is uninstalled

### Recommendations

1. Use environment-specific API keys (dev vs prod)
2. Rotate API keys regularly
3. Use GitHub fine-grained tokens with minimal scopes
4. Review Chrome extension permissions before installing
5. Monitor API usage in OpenAI and GitHub dashboards

## Claude Code Integration

### How It Works

MrPlug can send code modification commands to a running Claude Code/CLI instance via:

1. **LocalStorage Communication**: Commands written to `localStorage.mrplug_claude_command`
2. **File-Based**: Monitor `.mrplug/commands.json` (future)
3. **MCP Server**: Model Context Protocol server (future)

### Setup

1. Enable Claude Code integration in MrPlug settings
2. Ensure Claude Code is running and monitoring for commands
3. Use "Apply Fix" button after AI analysis

### Command Format

```json
{
  "type": "mrplug-feedback",
  "command": "edit",
  "data": {
    "instruction": "User feedback with suggested changes",
    "context": "Element details, styles, DOM path",
    "targetFile": "src/components/Button.tsx",
    "targetSelector": "button.primary"
  },
  "timestamp": 1234567890
}
```

## GitHub Integration

### Issue Format

Created issues include:

- **Title**: AI-generated summary
- **Description**: User feedback + AI analysis
- **Labels**: `ui-feedback`, `priority-{low|medium|high}`
- **Element Details**: DOM path, tag, classes, styles
- **Screenshot**: Visual context (when available)
- **Page URL**: Where the issue was reported

### Repository Setup

1. Create a GitHub Personal Access Token with `repo` scope
2. Configure repository in MrPlug settings (`owner/repo`)
3. MrPlug will validate access before creating issues

## Troubleshooting

### Extension Not Loading

- Ensure you've run `pnpm build`
- Check browser console for errors (`chrome://extensions/` → Details → Inspect views)
- Verify Node.js version matches `.nvmrc` (20.18.1)

### Feedback Mode Not Activating

- Confirm you're on `localhost` or `127.0.0.1`
- Check that keyboard shortcut isn't conflicting with browser shortcuts
- Reload the page and try again

### AI Analysis Failing

- Verify OpenAI API key is correct in settings
- Check browser DevTools console for error messages
- Ensure API key has sufficient credits
- Test API key independently using OpenAI Playground

### GitHub Issue Creation Failing

- Verify GitHub token has `repo` scope
- Confirm repository format is `owner/repo`
- Check token hasn't expired
- Ensure repository exists and token has access

### Claude Code Integration Not Working

- Confirm Claude Code integration is enabled in settings
- Check that Claude Code/CLI is running
- Monitor browser console for command payloads
- Verify localStorage command is being written

## Contributing

### Development Setup

1. Fork the repository
2. Clone your fork
3. Create a feature branch
4. Make changes with tests
5. Run `pnpm test` and `pnpm lint`
6. Submit a pull request

### Testing Requirements

- All new features must include behavior-driven tests
- Tests should validate user outcomes, not implementation details
- Maintain >80% code coverage

### Code Style

- TypeScript strict mode enabled
- ESLint configuration provided
- Use IBM Carbon components for UI
- Follow existing file structure

## Roadmap

### MVP (Current)

- ✅ Element selection and context capture
- ✅ AI-powered feedback analysis
- ✅ GitHub issue creation
- ✅ Claude Code integration
- ✅ IBM Carbon UI
- ✅ Localhost-only support

### Future Enhancements

- [ ] Multi-browser support (Firefox, Safari)
- [ ] Screenshot editing and annotation
- [ ] Team collaboration features
- [ ] Integration with Linear, Jira, Asana
- [ ] Custom AI model support (Anthropic Claude, local models)
- [ ] Visual regression testing integration
- [ ] Figma/design tool integration
- [ ] Domain whitelist for production sites
- [ ] Mobile device testing support

## License

MIT License - see LICENSE file for details

## Support

- **Issues**: [GitHub Issues](https://github.com/yourusername/mrplug/issues)
- **Documentation**: This README and inline code comments
- **Discussions**: [GitHub Discussions](https://github.com/yourusername/mrplug/discussions)

## Acknowledgments

- **IBM Carbon Design System**: UI component library
- **LangChain**: AI agent framework
- **OpenAI**: GPT models for analysis
- **Anthropic**: Claude Code/CLI integration inspiration
- **Vite**: Fast build tooling
- **CRXJS**: Browser extension Vite plugin

---

Built with ❤️ for developers, designers, and product teams who want to move faster with AI-assisted feedback.
