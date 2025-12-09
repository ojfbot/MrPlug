# Security Guidelines for MrPlug

## API Key Management

### Development vs Production

**CRITICAL**: The `env.json` system is designed **ONLY for local development** and should **NEVER** be used in production builds distributed to users.

### How It Works

1. **Development Build** (`pnpm build`):
   - Reads `env.json` (gitignored)
   - Generates `src/lib/env.ts` with API keys
   - Keys are bundled into extension for auto-configuration
   - **USE ONLY FOR LOCAL TESTING**

2. **Production Build** (future implementation needed):
   - Should NOT bundle any API keys
   - Users configure keys via Settings UI
   - Keys stored only in browser's encrypted storage
   - Never appear in bundled JavaScript

### Security Risks

#### ⚠️ Current Implementation
The current `scripts/inject-env.js` bundles API keys into the distributed extension code. This is acceptable for:
- Local development and testing
- Personal use on your own machine
- **NOT acceptable for distribution to other users**

#### Why This Matters
- API keys in bundled JS can be extracted by anyone
- Violates principle of zero hardcoded secrets
- Could lead to API key theft and abuse
- Your API costs could skyrocket from unauthorized use

### Proper Production Architecture

For distributing MrPlug to users:

1. **Remove env injection** from production builds
2. **Users must provide their own API keys** via Settings
3. **Keys stored in browser.storage.local** (encrypted by browser)
4. **Never bundled** into extension JavaScript

## Prompt Injection Protection

### Current Risk

User-controlled data (DOM content, computed styles, user input) is directly interpolated into AI prompts without sanitization. Malicious actors could:

- Craft DOM elements with styles containing prompt injection attacks
- Override system instructions via computed style values
- Extract sensitive information from prompt context

### Mitigation Strategies

1. **Input Sanitization** (TODO):
   - Strip/escape special characters from user input
   - Validate DOM content before including in prompts
   - Limit computed styles to safe subset

2. **Structured Prompts** (TODO):
   - Use LangChain's structured output parsing
   - Separate user content from system instructions
   - Use message roles properly (system vs user)

3. **Content Filtering** (TODO):
   - Blocklist dangerous patterns in DOM content
   - Validate URLs and script content
   - Sanitize HTML before processing

## Content Security Policy

Ensure your manifest CSP allows connections to:
- `https://api.anthropic.com` (for Anthropic Claude)
- `https://api.openai.com` (for OpenAI GPT)
- `https://api.github.com` (for GitHub integration)

Current manifest.json includes these in `host_permissions`.

## Logging Security

### Current State
Multiple `console.log` statements expose API key prefixes for debugging.

### Recommendations
1. **Production**: Remove or redact all API key logging
2. **Development**: Keep for debugging but warn users
3. **Never log**: Full API keys, sensitive user data, passwords

## Browser Storage

### What's Stored
- `mrplug_config`: Extension configuration including API keys
- `mrplug_conversation`: Recent conversation history
- `mrplug_feedback`: Recent feedback requests

### Security Properties
- Uses `browser.storage.local` (encrypted by browser)
- Not accessible to web pages
- Only accessible to extension code
- Backed up by browser sync (be careful with syncing API keys)

## Recommended Actions

### Before Public Distribution

- [ ] Remove `scripts/inject-env.js` from production builds
- [ ] Update build scripts to have separate dev/prod modes
- [ ] Add input sanitization for prompt injection protection
- [ ] Remove or redact API key logging in production
- [ ] Add user documentation about API key security
- [ ] Consider adding API key encryption at rest
- [ ] Implement rate limiting for API calls

### For Open Source Contributors

1. **Never commit**:
   - `env.json` files
   - API keys in any form
   - Personal configuration

2. **Always**:
   - Use `.gitignore` for secrets
   - Review diffs before committing
   - Use environment variables for CI/CD

3. **Security Issues**:
   - Report via GitHub Security Advisories
   - Don't disclose publicly until patched
   - Follow responsible disclosure practices

## Related Issues

- #TBD: Implement prompt injection sanitization
- #TBD: Add production build mode without API key bundling
- #TBD: Improve API key detection and validation

## Resources

- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [Prompt Injection Guide](https://learnprompting.org/docs/prompt_hacking/injection)
- [Chrome Extension Security](https://developer.chrome.com/docs/extensions/mv3/security/)
- [WebExtension Security Best Practices](https://extensionworkshop.com/documentation/develop/build-a-secure-extension/)
