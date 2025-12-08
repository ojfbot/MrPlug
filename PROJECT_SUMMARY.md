# MrPlug - Project Summary

## Overview

MrPlug is a containerized Node.js browser extension built with TypeScript that enables developers, designers, and product managers to provide natural language feedback on UI elements in web applications. The extension uses AI (via LangChain and OpenAI) to analyze feedback and automatically create GitHub issues or send code modification commands to Claude Code/CLI.

## Technology Stack

- **Runtime**: Node.js v20.18.1 (LTS)
- **Package Manager**: pnpm v8.15.0
- **Language**: TypeScript (strict mode)
- **Build Tool**: Vite v5
- **UI Framework**: React 18 + IBM Carbon Design System
- **AI Framework**: LangChain.js with OpenAI
- **Testing**: Vitest with behavior-driven approach
- **Containerization**: Docker with multi-stage builds

## Project Structure

```
mrplug/
├── src/
│   ├── background/              # Extension service worker
│   │   └── index.ts            # Message handling, lifecycle
│   ├── content/                # Content script (injected)
│   │   ├── index.tsx           # Main content script logic
│   │   └── styles.css          # Overlay and UI styles
│   ├── popup/                  # Extension popup
│   │   ├── index.html
│   │   └── index.tsx
│   ├── options/                # Settings page
│   │   ├── index.html
│   │   └── index.tsx
│   ├── components/             # React components
│   │   ├── FeedbackModal.tsx   # Main chat interface
│   │   └── ElementOverlay.tsx  # Element highlight overlay
│   ├── lib/                    # Core business logic
│   │   ├── element-capture.ts  # DOM extraction
│   │   ├── storage.ts          # Browser storage wrapper
│   │   ├── ai-agent.ts         # LangChain AI integration
│   │   ├── github-integration.ts # GitHub API client
│   │   └── claude-integration.ts # Claude Code bridge
│   ├── types/                  # TypeScript definitions
│   │   └── index.ts
│   └── test/                   # Test setup and utilities
│       └── setup.ts
├── public/                     # Static assets
│   └── icons/                  # Extension icons
├── scripts/                    # Build and setup scripts
│   ├── generate-icons.js       # Icon generator
│   └── setup.sh                # Development setup
├── Dockerfile                  # Container definition
├── docker-compose.yml          # Container orchestration
├── vite.config.ts              # Build configuration
├── tsconfig.json               # TypeScript config
├── package.json                # Dependencies and scripts
├── .nvmrc                      # Node.js version
├── .gitignore                  # Git exclusions (security-focused)
├── .env.example                # Environment template
├── README.md                   # Main documentation
├── CONTRIBUTING.md             # Contribution guidelines
├── CHANGELOG.md                # Version history
└── LICENSE                     # MIT License
```

## Key Features Implemented

### 1. Element Selection System
- **Keyboard Activation**: Alt+Shift+F toggles selection mode
- **Visual Feedback**: Blue overlay with element tag/class display
- **Context Capture**: DOM path, styles, dimensions, parent hierarchy
- **Screenshot Support**: Optional element screenshots

### 2. AI-Powered Analysis
- **LangChain Integration**: Structured prompts for UI/UX analysis
- **OpenAI GPT-4**: Natural language understanding
- **Conversation History**: Multi-turn refinement
- **Structured Responses**: JSON output with suggested actions

### 3. GitHub Integration
- **Automatic Issue Creation**: Pre-filled with context
- **Rich Metadata**: Screenshots, DOM paths, styles
- **Smart Labels**: Priority-based tagging
- **Repository Validation**: Token and access verification

### 4. Claude Code Integration
- **localStorage Bridge**: Command passing mechanism
- **Structured Commands**: Edit/refactor/style operations
- **Context Preservation**: Full element details included
- **Future-Ready**: MCP server support planned

### 5. IBM Carbon Design UI
- **Modal Interface**: Clean, professional chat UI
- **Element Overlay**: Non-intrusive selection feedback
- **Options Page**: Comprehensive settings management
- **Popup**: Quick access and status

### 6. Security Features
- **No Hardcoded Secrets**: All keys in browser storage
- **Comprehensive .gitignore**: Prevents accidental leaks
- **Content Security Policy**: Strict CSP in manifest
- **Input Validation**: All user inputs sanitized
- **HTTPS Only**: Secure API communication

### 7. Testing Strategy
- **Behavior-Driven**: Tests validate user outcomes
- **Vitest Framework**: Fast, modern testing
- **Browser API Mocks**: Isolated unit tests
- **Example Tests**: Element capture, storage, AI agent

### 8. Developer Experience
- **Hot Reload**: Vite dev mode for rapid iteration
- **TypeScript Strict**: Catch errors early
- **Docker Support**: Consistent builds anywhere
- **Setup Scripts**: One-command initialization
- **Clear Documentation**: README, contributing, changelog

## Architecture Decisions

### Why LangChain?
- Abstraction over LLM providers (easy to swap models)
- Structured output parsing
- Prompt templating and composition
- Agent framework for future enhancements

### Why IBM Carbon?
- Professional, enterprise-ready design
- Comprehensive component library
- Accessibility built-in
- Consistent with developer tooling aesthetic

### Why Vite?
- Fast HMR for development
- Native ES modules support
- Simple browser extension plugin (@crxjs/vite-plugin)
- Superior TypeScript support

### Why Behavior-Driven Testing?
- Focuses on user value, not implementation
- Easier to refactor without breaking tests
- Self-documenting test suite
- Aligns with product thinking

## Development Workflow

1. **Setup**: `./scripts/setup.sh` (installs deps, builds, generates icons)
2. **Development**: `pnpm dev` (watch mode with hot reload)
3. **Testing**: `pnpm test` (run test suite)
4. **Building**: `pnpm build` (production bundle)
5. **Packaging**: `pnpm package` (creates distributable .zip)

## Integration Points

### OpenAI API
- **Purpose**: Feedback analysis
- **Model**: GPT-4
- **Input**: User feedback + element context
- **Output**: Structured JSON with actions

### GitHub API
- **Purpose**: Issue creation
- **Auth**: Personal Access Token
- **Scope**: `repo` (read/write issues)
- **API**: Octokit REST client

### Claude Code
- **Purpose**: Direct code modifications
- **Method**: localStorage communication
- **Format**: JSON commands
- **Future**: MCP server protocol

## Security Considerations

### API Key Storage
- Stored in `chrome.storage.local`
- Encrypted at rest by browser
- Never transmitted except to target APIs
- Cleared on uninstall

### Input Sanitization
- All user inputs validated before processing
- DOM paths sanitized before execution
- No eval() or dynamic code execution

### Permissions
- `activeTab`: Only active tab access
- `storage`: Local storage only
- `scripting`: Content script injection
- `tabs`: Tab query for messaging
- **No** broad `<all_urls>` permission

### Content Security Policy
```json
{
  "extension_pages": "script-src 'self'; object-src 'self'"
}
```

## Deployment Checklist

Before publishing to Chrome Web Store / Firefox Add-ons:

- [ ] Replace placeholder icons with professional designs
- [ ] Update manifest description and author
- [ ] Add privacy policy URL
- [ ] Test on multiple browsers
- [ ] Run full test suite
- [ ] Build production bundle
- [ ] Create promotional screenshots
- [ ] Write store listing copy
- [ ] Set up analytics (optional)
- [ ] Prepare support email/site

## Future Enhancements

### Short Term
- Firefox manifest v2/v3 compatibility
- Safari extension support
- Screenshot annotation tools
- Better error messaging

### Medium Term
- Linear/Jira/Asana integrations
- Custom AI model support (Claude, local)
- Team collaboration features
- Visual regression testing

### Long Term
- Figma/Sketch integration
- Production site support (whitelisting)
- Mobile device testing
- Browser DevTools panel

## Maintenance

### Dependencies
- Review and update quarterly
- Security audit with `pnpm audit`
- Check for breaking changes in:
  - React (major versions)
  - Carbon Design (updates can break styles)
  - LangChain (API changes common)

### API Compatibility
- Monitor OpenAI API deprecations
- Test GitHub API changes
- Track browser extension API updates

### Documentation
- Keep README in sync with features
- Update CHANGELOG for all releases
- Maintain example code in CONTRIBUTING

## Metrics to Track

- **Usage**: Active users, feedback submissions
- **Quality**: Issue creation rate, Claude Code usage
- **Performance**: Load time, AI response time
- **Errors**: API failures, extension crashes
- **Engagement**: Repeat usage, conversation length

## Known Limitations

1. **Localhost Only**: MVP only works on localhost/127.0.0.1
2. **Chrome/Edge**: Not yet tested on Firefox/Safari
3. **Screenshot Quality**: Basic implementation, no annotations
4. **Claude Code**: One-way communication via localStorage
5. **Single User**: No team/collaboration features yet

## Credits

- **Architecture**: Designed for extensibility and security
- **UI/UX**: IBM Carbon Design System
- **AI**: LangChain + OpenAI
- **Build**: Vite + CRXJS
- **Icons**: Placeholder SVGs (replace before launch)

## Contact

For questions, issues, or contributions:
- GitHub Issues: [yourusername/mrplug/issues]
- GitHub Discussions: [yourusername/mrplug/discussions]
- Email: support@yourcompany.com

---

**Project Status**: MVP Complete ✅
**Next Milestone**: Browser compatibility testing
**Target Release**: TBD
