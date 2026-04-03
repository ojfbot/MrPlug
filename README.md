# MrPlug - AI-Powered UI Feedback Assistant

<div align="center">

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.5-blue.svg)](https://www.typescriptlang.org/)
[![Node.js](https://img.shields.io/badge/Node.js-20.18.1-green.svg)](https://nodejs.org/)
[![React](https://img.shields.io/badge/React-18-61DAFB.svg)](https://reactjs.org/)
[![Vite](https://img.shields.io/badge/Vite-5-646CFF.svg)](https://vitejs.dev/)
[![pnpm](https://img.shields.io/badge/pnpm-8.15.0-orange.svg)](https://pnpm.io/)

**Transform UI feedback into actionable development tasks with AI**

[Features](#features) • [Installation](#installation) • [Usage](#usage) • [Documentation](#documentation) • [Contributing](#contributing)

</div>

---

MrPlug closes the feedback loop between design review and code change. Instead of filing a bug, describing the element, and hoping the developer finds it — point at the element, describe what's wrong, and get a GitHub issue or a code fix in one step.

A Chrome extension that enables developers, designers, and project managers to provide natural language feedback on UI elements and automatically generate GitHub issues or apply code fixes through Claude Code integration.

## Demo

### How It Works

1. **Navigate** to your localhost development app (e.g., `http://localhost:3000`)
2. **Press** `Alt+Shift+F` (or `MacCtrl+Shift+F` on macOS) to activate feedback mode
3. **Press down on** any UI element (button, input, div, card, etc.)
4. **Describe** what needs to change: _"This button is too small"_, _"spacing is off"_, _"should be blue"_
5. **Review** AI-generated analysis with actionable suggestions
6. **Choose** an action:
   - 📝 Create GitHub Issue with full context
   - ⚡ Apply Fix via Claude Code
   - 💬 Continue conversation to refine

### Example Feedback Scenarios

```
💬 "This button should be bigger and match our brand blue"
   → AI suggests: Increase padding, change background-color to #0066CC

💬 "The spacing between these cards is too tight"
   → AI suggests: Increase gap property from 8px to 16px, update grid-gap

💬 "This should expand into a login form when clicked"
   → AI creates: Feature story with acceptance criteria for GitHub

💬 "Move this to the right side and make it sticky"
   → AI suggests: Add position: sticky, right: 0, top: 0
```

## Table of Contents

- [Demo](#demo)
- [Features](#features)
- [Architecture](#architecture)
- [Prerequisites](#prerequisites)
- [Installation](#installation)
- [Usage](#usage)
- [Docker Development](#docker-development)
- [Testing](#testing)
- [Development](#development)
- [Security](#security)
- [Claude Code Integration](#claude-code-integration)
- [GitHub Integration](#github-integration)
- [Troubleshooting](#troubleshooting)
- [Contributing](#contributing)
- [Roadmap](#roadmap)
- [License](#license)

## Features

### Core Capabilities

- 🎯 **Element Selection**: Use keyboard shortcuts (`Alt+Shift+F`) to activate feedback mode and select any element on localhost development sites
- 💬 **Natural Language Feedback**: Describe UI issues in plain English ("this button should be bigger", "spacing is off", etc.)
- 🤖 **AI-Powered Analysis**: LangChain-backed AI agent analyzes your feedback and suggests actionable solutions
- 🎨 **IBM Carbon Design System**: Clean, professional UI built with IBM Carbon components
- 📝 **GitHub Integration**: Automatically create well-structured GitHub issues with element context and screenshots
- ⚡ **Claude Code Integration**: Send code modification commands directly to Claude Code/CLI for instant fixes
- 💭 **Conversation History**: Multi-turn conversations to refine feedback and solutions
- 🔒 **Secure by Design**: API keys stored securely, no hardcoded secrets, comprehensive .gitignore

### What AI Can Analyze

| Category | Examples |
|----------|----------|
| **Styling Issues** | Colors, fonts, sizes, opacity, shadows, borders |
| **Layout Problems** | Positioning, alignment, spacing, grid/flex issues |
| **Responsive Design** | Mobile breakpoints, viewport issues, overflow |
| **Feature Requests** | New components, interactions, state management |
| **UX Feedback** | Accessibility, usability, performance, interactions |
| **Component Issues** | Props, rendering, conditional logic, event handlers |

## Architecture

```
mrplug/
├── src/
│   ├── background/        # Service worker: project routing, GitHub issue creation, Claude Code relay
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

### Technology Stack

| Layer | Technology | Purpose |
|-------|------------|---------|
| **Runtime** | Node.js 20.18.1 | JavaScript runtime environment |
| **Package Manager** | pnpm 8.15.0 | Fast, efficient dependency management |
| **Language** | TypeScript 5.5 (strict) | Type-safe development |
| **Build Tool** | Vite 5 | Fast HMR and optimized production builds |
| **UI Framework** | React 18 | Component-based UI development |
| **Design System** | IBM Carbon | Professional, accessible UI components |
| **AI Framework** | LangChain.js | LLM abstraction and structured outputs |
| **LLM Provider** | OpenAI GPT-4 | Natural language understanding and analysis |
| **GitHub API** | Octokit REST | Repository and issue management |
| **Testing** | Vitest | Fast, modern test runner with Vite integration |
| **Browser Extension** | Manifest V3 | Modern browser extension API |
| **Containerization** | Docker | Consistent development environment |

### Data Flow

```
┌─────────────────┐
│   User Action   │ Press Alt+Shift+F, Click Element
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Content Script  │ Inject overlay, capture element context
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Element Context │ DOM path, styles, dimensions, parent info
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  User Feedback  │ Natural language description
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Background      │ Message passing to service worker
│ Service Worker  │
└────────┬────────┘
         │
         ├──────────────────┬──────────────────┐
         ▼                  ▼                  ▼
┌─────────────────┐  ┌─────────────┐  ┌──────────────┐
│  Browser Storage│  │  OpenAI API │  │ GitHub API   │
│  (API Keys)     │  │  (Analysis) │  │ (Issues)     │
└─────────────────┘  └──────┬──────┘  └──────┬───────┘
                            │                │
                            ▼                ▼
                     ┌─────────────┐  ┌──────────────┐
                     │ AI Response │  │ Issue Created│
                     │ (JSON)      │  │ (URL)        │
                     └──────┬──────┘  └──────────────┘
                            │
                            ▼
                     ┌─────────────┐
                     │  Suggested  │
                     │   Actions   │
                     └──────┬──────┘
                            │
         ┌──────────────────┼──────────────────┐
         ▼                  ▼                  ▼
┌─────────────────┐  ┌─────────────┐  ┌──────────────┐
│ Create GitHub   │  │ Send to     │  │ Manual       │
│ Issue           │  │ Claude Code │  │ Review       │
└─────────────────┘  └─────────────┘  └──────────────┘
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
3. **Select** any UI element by pressing down (mousedown) on it
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

1. **Background Service Worker Relay**: The background service worker resolves project context via `resolveProjectMapping` and relays enriched payloads to Claude Code with the correct project and target information.
2. **MCP Server**: A dedicated `mrplug-mcp-server` for Claude Code relay (commit f515699).
3. **LocalStorage Communication** (legacy): Commands written to `localStorage.mrplug_claude_command`
4. **File-Based**: Monitor `.mrplug/commands.json` (future)
### Setup

1. Enable Claude Code integration in MrPlug settings
1. Enable Claude Code integration in MrPlug settings
2. Configure project mappings in the options settings panel
3. Ensure Claude Code is running and monitoring for commands

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

### v0.1.0 - MVP (Current ✅)

- ✅ Element selection and context capture
- ✅ AI-powered feedback analysis (OpenAI GPT-4)
- ✅ GitHub issue creation with full context and screenshots
- ✅ Claude Code integration (background relay with project routing + MCP server)
- ✅ Module Federation-aware project routing
- ✅ Project mappings settings panel
- ✅ Confirmation UX before GitHub issue creation and Claude Code injection
- ✅ IBM Carbon Design UI
- ✅ Localhost-only support
- ✅ Behavior-driven testing
- ✅ Docker development support
- ✅ Comprehensive documentation

### v0.2.0 - Multi-Browser Support

- [ ] Firefox extension (Manifest V3 compatibility)
- [ ] Safari extension support
- [ ] Cross-browser testing suite
- [ ] Browser-specific optimizations
- [ ] Unified build pipeline

### v0.3.0 - Enhanced Feedback

- [ ] Screenshot editing and annotation tools
- [ ] Multi-element selection mode
- [ ] Visual diff comparison
- [ ] Custom element selectors (CSS, XPath)
- [ ] Feedback templates library
- [ ] Batch feedback submission

### v0.4.0 - AI & Integrations

- [ ] Anthropic Claude API integration
- [ ] Local LLM support (Ollama, LM Studio)
- [ ] Custom prompt templates
- [ ] Integration with Linear, Jira, Asana
- [ ] Slack/Discord notifications
- [x] MCP (Model Context Protocol) server

### v0.5.0 - Team Collaboration

- [ ] Shared feedback workspace
- [ ] Team member assignment
- [ ] Feedback approval workflow
- [ ] Activity feed and analytics
- [ ] Role-based permissions
- [ ] Team settings management

### v1.0.0 - Production Ready

- [ ] Domain whitelist for production sites
- [ ] Mobile device testing support
- [ ] Browser DevTools panel integration
- [ ] Figma/Sketch design integration
- [ ] Visual regression testing
- [ ] Enterprise features (SSO, audit logs)
- [ ] Chrome Web Store / Firefox Add-ons listing
- [ ] Professional marketing site

## FAQ

### General Questions

**Q: Does MrPlug work on production websites?**
A: Currently no. MrPlug v0.1.0 only works on `localhost` and `127.0.0.1` for security reasons. Production site support with domain whitelisting is planned for v1.0.0.

**Q: Which browsers are supported?**
A: Chrome, Edge, and Brave (Chromium-based browsers with Manifest V3). Firefox and Safari support is coming in v0.2.0.

**Q: Is my feedback data stored or sent anywhere?**
A: Conversation history is stored locally in your browser's encrypted storage. The only external data transmission is to OpenAI API (for AI analysis) and GitHub API (if you create issues). No data is sent to MrPlug servers because there are none!

**Q: Can I use this with my team?**
A: Not yet in v0.1.0. Team collaboration features (shared workspaces, assignments, approvals) are planned for v0.5.0.

### API & Integration Questions

**Q: Do I need all three integrations (OpenAI, GitHub, Claude Code)?**
A: No. Only **OpenAI API key** is required for AI-powered feedback analysis. GitHub and Claude Code integrations are completely optional based on your workflow.

**Q: Can I use Anthropic Claude instead of OpenAI?**
A: Not yet in v0.1.0. Anthropic Claude integration is planned for v0.4.0.

**Q: What happens to my API keys?**
A: API keys are stored securely in your browser's encrypted local storage (`chrome.storage.local`). They are never transmitted except to the configured APIs (OpenAI, GitHub). Keys are cleared when you uninstall the extension.

**Q: How much does this cost to use?**
A: MrPlug itself is free and open source (MIT license). You'll pay for API usage:
- **OpenAI**: ~$0.01-0.05 per feedback request (GPT-4 pricing)
- **GitHub**: Free (API included with GitHub accounts)
- **Claude Code**: Free (runs locally)

### Usage Questions

**Q: Can I customize the AI prompts?**
A: Not in v0.1.0. Custom prompt templates and system prompts are planned for v0.4.0.

**Q: Can I select multiple elements at once?**
A: Not yet. Multi-element selection mode is planned for v0.3.0.

**Q: Does this work with React, Vue, Angular, Svelte, etc.?**
A: Yes! MrPlug works with **any web application** regardless of framework, library, or technology stack. It operates at the DOM level.

**Q: Can I use this for mobile app development?**
A: Not directly. MrPlug works on web UIs. However, if you have a web-based mobile preview (like in a simulator), it could work there. Native mobile app support is out of scope.

### Claude Code Integration

**Q: How does Claude Code integration work?**
A: MrPlug's background service worker resolves which project/repo a page belongs to via `resolveProjectMapping`, then relays an enriched payload to Claude Code with full project context. A dedicated MCP server (`mrplug-mcp-server`) is also available. Before any code is injected, a confirmation dialog shows the resolved project and target — you must confirm before anything fires.

**Q: Can Claude Code automatically apply fixes without confirmation?**
A: No. As of Phase 5B, MrPlug enforces an explicit confirmation step before any Claude Code context injection. The user sees a summary of the resolved project and target, and must confirm. Cancellation aborts cleanly.

**Q: What if I don't use Claude Code?**
A: No problem! You can disable Claude Code integration and just use GitHub issue creation, or simply review the AI analysis manually.

### Troubleshooting

**Q: The extension isn't loading. What should I do?**
A: See the [Troubleshooting](#troubleshooting) section for detailed solutions. Common fixes:
1. Ensure you ran `pnpm build`
2. Check `chrome://extensions/` for errors
3. Verify Node.js version matches `.nvmrc`
4. Clear browser cache and reload

**Q: AI analysis is failing. How do I fix this?**
A: Most common causes:
1. Invalid or expired OpenAI API key
2. Insufficient API credits
3. Network connectivity issues
4. Rate limiting

See [Troubleshooting - AI Analysis Failing](#ai-analysis-failing) for detailed solutions.

**Q: I found a bug. How do I report it?**
A: Please [open a GitHub issue](https://github.com/ojfbot/MrPlug/issues/new) with:
- Browser and version
- Steps to reproduce
- Expected vs actual behavior
- Console error messages (if any)
- Screenshots (if helpful)

## License

MIT License - see LICENSE file for details

## Support

- **Issues**: [GitHub Issues](https://github.com/ojfbot/MrPlug/issues)
- **Documentation**: This README and inline code comments
- **Discussions**: [GitHub Discussions](https://github.com/ojfbot/MrPlug/discussions)

## Acknowledgments

Built on the shoulders of giants:

- **IBM Carbon Design System** - Professional, accessible UI component library
- **LangChain.js** - Powerful AI agent framework for structured LLM interactions
- **OpenAI** - GPT-4 for intelligent feedback analysis
- **Anthropic** - Claude Code/CLI integration inspiration and future API support
- **Vite** - Lightning-fast build tooling and HMR
- **CRXJS** - Seamless browser extension integration for Vite
- **Octokit** - Robust GitHub API client
- **Vitest** - Modern, fast testing framework
- **pnpm** - Efficient package management
- **TypeScript** - Type safety and developer experience

---

## Frame OS Ecosystem

Part of [Frame OS](https://github.com/ojfbot/shell) — an AI-native application OS.

| Repo | Description |
|------|-------------|
| [shell](https://github.com/ojfbot/shell) | Module Federation host + frame-agent LLM gateway |
| [core](https://github.com/ojfbot/core) | Workflow framework — 30+ slash commands + TypeScript engine |
| [cv-builder](https://github.com/ojfbot/cv-builder) | AI-powered resume builder with LangGraph agents |
| [blogengine](https://github.com/ojfbot/BlogEngine) | AI blog content creation platform |
| [TripPlanner](https://github.com/ojfbot/TripPlanner) | AI trip planner with 11-phase pipeline |
| [core-reader](https://github.com/ojfbot/core-reader) | Documentation viewer for the core framework |
| [lean-canvas](https://github.com/ojfbot/lean-canvas) | AI-powered lean canvas business model tool |
| [gastown-pilot](https://github.com/ojfbot/gastown-pilot) | Multi-agent coordination dashboard |
| [seh-study](https://github.com/ojfbot/seh-study) | NASA SEH spaced repetition study tool |
| [daily-logger](https://github.com/ojfbot/daily-logger) | Automated daily dev blog pipeline |
| [purefoy](https://github.com/ojfbot/purefoy) | Roger Deakins cinematography knowledge base |
| **MrPlug** | **Chrome extension for AI UI feedback (this repo)** |
| [frame-ui-components](https://github.com/ojfbot/frame-ui-components) | Shared component library (Carbon DS) |

---

<div align="center">

**Built with ❤️ for developers, designers, and product teams**

*Move faster with AI-assisted UI feedback*

[⬆ Back to Top](#mrplug---ai-powered-ui-feedback-assistant)

</div>
