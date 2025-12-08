# Changelog

All notable changes to MrPlug will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Planned
- Firefox extension support
- Safari extension support
- Screenshot annotation features
- Integration with Linear, Jira, Asana
- Custom AI model configuration
- Visual regression testing integration
- Figma design tool integration
- Team collaboration features

## [0.1.0] - 2024-12-04

### Added
- Initial release of MrPlug browser extension
- Element selection with keyboard shortcuts (Alt+Shift+F)
- Element context capture (DOM path, styles, dimensions, hierarchy)
- IBM Carbon Design System UI components
- Natural language feedback input interface
- LangChain-powered AI agent for feedback analysis
- GitHub issue creation with element context and screenshots
- Claude Code/CLI integration for direct code modifications
- Conversation history with multi-turn support
- Browser storage management for configuration and history
- Comprehensive .gitignore for security
- Docker containerization support
- Behavior-driven test suite using Vitest
- TypeScript strict mode configuration
- Vite-based build system with hot reload
- Extension popup for quick access
- Options page for API key configuration
- Support for localhost and 127.0.0.1 development environments

### Documentation
- Comprehensive README with setup instructions
- Architecture overview and component descriptions
- Security best practices documentation
- Contributing guidelines
- Testing philosophy and examples
- Docker development workflow

### Testing
- Element capture behavior tests
- Storage management tests
- AI agent integration tests
- Test setup with browser API mocks
- Focus on user behavior validation over implementation testing

### Security
- Secure API key storage in browser storage
- No hardcoded secrets in codebase
- Content Security Policy configuration
- Input sanitization
- Minimal browser permissions
- HTTPS-only API communication

[Unreleased]: https://github.com/ojfbot/MrPlug/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/ojfbot/MrPlug/releases/tag/v0.1.0
