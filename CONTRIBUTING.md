# Contributing to MrPlug

Thank you for your interest in contributing to MrPlug! This document provides guidelines and instructions for contributing.

## Getting Started

1. **Fork the repository** on GitHub
2. **Clone your fork** locally:
   ```bash
   git clone https://github.com/yourusername/mrplug.git
   cd mrplug
   ```
3. **Install dependencies**:
   ```bash
   fnm use
   pnpm install
   ```
4. **Create a branch** for your work:
   ```bash
   git checkout -b feature/your-feature-name
   ```

## Development Workflow

### Making Changes

1. **Write code** following our style guide
2. **Add tests** for new functionality (behavior-driven)
3. **Update documentation** if needed
4. **Run tests** to ensure nothing breaks:
   ```bash
   pnpm test
   pnpm type-check
   pnpm lint
   ```

### Commit Messages

Use clear, descriptive commit messages:

```
feat: add screenshot annotation feature
fix: resolve element selection on nested components
docs: update API configuration instructions
test: add behavior tests for GitHub integration
refactor: simplify AI prompt formatting
```

Prefix types:
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation only
- `test`: Adding or updating tests
- `refactor`: Code change that neither fixes a bug nor adds a feature
- `perf`: Performance improvement
- `chore`: Maintenance tasks

### Testing Philosophy

All tests should validate **user behaviors and outcomes**, not internal implementation:

**Good Test Example:**
```typescript
it('should allow user to select an element and capture its context', async () => {
  // User action: clicks on a button
  const context = await ElementCapture.captureElement(button);

  // Expected outcome: context is captured with necessary details
  expect(context.tagName).toBe('button');
  expect(context.domPath).toBeTruthy();
});
```

**Bad Test Example:**
```typescript
it('should call getBoundingClientRect()', async () => {
  // Don't test implementation details
  const spy = vi.spyOn(element, 'getBoundingClientRect');
  await ElementCapture.captureElement(element);
  expect(spy).toHaveBeenCalled();
});
```

### Code Style

- **TypeScript**: Use strict mode, avoid `any` when possible
- **React**: Functional components with hooks
- **Imports**: Group and order (external, internal, types)
- **Naming**: camelCase for functions/variables, PascalCase for components/types
- **Comments**: Focus on "why", not "what"
- **Files**: One component per file, co-locate tests

### Pull Request Process

1. **Update documentation** if you've added/changed features
2. **Add tests** for new functionality
3. **Ensure CI passes** (tests, linting, type checking)
4. **Update CHANGELOG.md** with your changes
5. **Submit PR** with clear description of changes

### PR Description Template

```markdown
## Description
Brief description of what this PR does

## Type of Change
- [ ] Bug fix
- [ ] New feature
- [ ] Breaking change
- [ ] Documentation update

## Testing
How has this been tested?

## Screenshots (if applicable)
Add screenshots for UI changes

## Checklist
- [ ] Tests added/updated
- [ ] Documentation updated
- [ ] No breaking changes (or documented)
- [ ] Follows code style guidelines
```

## Areas for Contribution

### High Priority

- **Browser compatibility**: Firefox, Safari support
- **Testing**: Increase test coverage
- **Documentation**: Tutorials, examples, videos
- **Accessibility**: WCAG compliance improvements

### Feature Ideas

- Screenshot annotation tools
- Integration with other project management tools (Linear, Jira)
- Custom AI model support
- Visual regression testing
- Figma integration
- Team collaboration features

### Bug Fixes

Check [GitHub Issues](https://github.com/yourusername/mrplug/issues) for:
- Issues labeled `good first issue`
- Issues labeled `help wanted`
- Bug reports needing investigation

## Security

### Reporting Vulnerabilities

**DO NOT** open a public issue for security vulnerabilities.

Instead:
1. Email security@yourcompany.com
2. Include detailed description
3. Wait for response before disclosing publicly

### Security Guidelines

When contributing:
- Never commit API keys, tokens, or secrets
- Validate all user inputs
- Use browser storage APIs securely
- Follow OWASP guidelines
- Review dependencies for vulnerabilities

## Questions?

- **Discussions**: Use [GitHub Discussions](https://github.com/yourusername/mrplug/discussions)
- **Chat**: Join our Discord server (link)
- **Issues**: Open an issue for bugs or feature requests

## Code of Conduct

Be respectful, inclusive, and professional. We're all here to build something great together.

### Our Standards

- Use welcoming and inclusive language
- Respect differing viewpoints and experiences
- Accept constructive criticism gracefully
- Focus on what's best for the community
- Show empathy towards others

## License

By contributing, you agree that your contributions will be licensed under the MIT License.
