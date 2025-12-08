# Browser Extension Permissions

This document explains why each permission is required for MrPlug to function properly.

## Standard Permissions

### `activeTab`
**Purpose**: Access to the currently active tab for element selection

**Usage**:
- Allows the extension to interact with the active tab when the user triggers feedback mode
- Required for capturing element context and injecting the feedback overlay
- Only grants access when user explicitly activates the extension (via keyboard shortcut or popup)

**Security**: Minimal risk - only accesses tab when user explicitly requests it

---

### `storage`
**Purpose**: Store API keys and settings securely

**Usage**:
- Stores OpenAI API key in `chrome.storage.local` (encrypted at rest)
- Stores GitHub token and repository configuration
- Stores user preferences and conversation history
- Stores Claude Code integration settings

**Security**: High security - browser handles encryption, isolated per-extension, cleared on uninstall

---

### `scripting`
**Purpose**: Inject content scripts for UI overlay and element capture

**Usage**:
- Injects content script to display feedback overlay on localhost pages
- Enables element selection and context capture functionality
- Required for programmatic script injection via Manifest V3 API

**Security**: Scoped to localhost only via `host_permissions` and content script `matches`

---

### `tabs`
**Purpose**: Query and manage tabs for feedback mode activation

**Usage**:
- Query active tab information to verify it's a localhost URL
- Send messages to content scripts in specific tabs
- Activate/focus tabs when needed
- Check tab status before injecting scripts

**Security**: Standard permission for browser extensions that interact with tabs

---

## Host Permissions

### `http://localhost/*`
**Purpose**: Development sites (localhost domain)

**Usage**:
- Allows extension to run on `http://localhost:3000`, `http://localhost:8080`, etc.
- Primary use case for MVP: developers working on local applications
- Required for content script injection and element selection

**Security**: Localhost-only scope aligns with documented MVP limitations

**Note**: This is explicitly documented in README.md as the intended scope for v0.1.0

---

### `http://127.0.0.1/*`
**Purpose**: Localhost IP address variant

**Usage**:
- Alternative localhost address (some frameworks use `127.0.0.1` instead of `localhost`)
- Ensures extension works regardless of how localhost is accessed
- Required for complete localhost coverage

**Security**: Localhost-only, cannot access external sites

---

### `https://api.github.com/*`
**Purpose**: GitHub API for issue creation

**Usage**:
- Create GitHub issues directly from the extension
- Validate GitHub token and repository access
- Attach element context, screenshots, and AI analysis to issues

**Security**:
- HTTPS only (encrypted communication)
- Requires user-provided GitHub token with explicit repository access
- No access to GitHub.com UI, only API endpoints

---

## Previously Removed Permissions

These permissions were removed in PR #6 as part of security hardening:

### ~~`tabCapture`~~ (REMOVED)
- **Reason**: Not used anywhere in the codebase
- **Risk**: Would have granted access to capture audio/video from tabs
- **Removal**: Eliminated unnecessary security warnings and attack surface

### ~~`<all_urls>`~~ (REMOVED)
- **Reason**: Violated principle of least privilege
- **Risk**: Would have granted access to ALL websites (major privacy/security risk)
- **Replacement**: Explicit localhost-only host permissions
- **Removal**: Critical security fix - extension now properly scoped

---

## Permission Justification Summary

| Permission | Required? | Justification | Alternative? |
|------------|-----------|---------------|--------------|
| `activeTab` | ✅ Yes | Core functionality (element selection) | ❌ No alternative |
| `storage` | ✅ Yes | API key storage and settings | ❌ No alternative |
| `scripting` | ✅ Yes | Content script injection (MV3) | ❌ Required for MV3 |
| `tabs` | ✅ Yes | Tab management and messaging | ❌ No alternative |
| `localhost` hosts | ✅ Yes | MVP scope is localhost-only | ⚠️ Could restrict to specific ports |
| `api.github.com` | ⚠️ Optional | GitHub integration feature | ✅ Users can skip this feature |

---

## Security Audit Notes

### What This Extension CANNOT Do

- ❌ Access production websites (only localhost)
- ❌ Access browsing history
- ❌ Read data from other tabs
- ❌ Access bookmarks or downloads
- ❌ Modify browser settings
- ❌ Run in background without user interaction
- ❌ Capture audio or video
- ❌ Access file system directly
- ❌ Make network requests to arbitrary domains

### What This Extension CAN Do

- ✅ Read DOM structure on localhost pages (when activated)
- ✅ Inject UI overlay on localhost pages
- ✅ Store API keys in encrypted browser storage
- ✅ Send data to OpenAI API (user-provided key)
- ✅ Send data to GitHub API (user-provided token)
- ✅ Capture screenshots of selected elements (with user consent)

### Content Security Policy

The extension enforces a strict CSP:

```json
{
  "content_security_policy": {
    "extension_pages": "script-src 'self'; object-src 'self'"
  }
}
```

This prevents:
- Loading external scripts
- Inline script execution
- `eval()` usage
- Unsafe dynamic code execution

---

## Future Permission Considerations

### v1.0.0 - Production Site Support

If/when production site support is added:

1. **Domain Whitelist**: Replace wildcard localhost with specific production domains
2. **User Approval**: Require explicit user approval for each domain
3. **Audit Trail**: Log which domains have been granted access
4. **Revocation**: Allow users to revoke domain access at any time

### Potential Additional Permissions

| Permission | Use Case | Priority | Security Concern |
|------------|----------|----------|------------------|
| `downloads` | Export feedback history | Low | Minimal - user-initiated only |
| `clipboardWrite` | Copy element selectors | Low | Minimal - write-only |
| `notifications` | Review completion alerts | Low | Minimal - user preference |
| `contextMenus` | Right-click feedback | Medium | None - UI enhancement |

---

## Compliance

This permission set is designed for:

- ✅ Chrome Web Store submission
- ✅ Firefox Add-ons review
- ✅ Enterprise security policies
- ✅ GDPR compliance (no tracking, user-controlled data)
- ✅ Principle of least privilege
- ✅ Transparent permission usage

---

## Questions or Concerns?

If you have questions about why a permission is needed or concerns about privacy/security:

1. Open a [GitHub Discussion](https://github.com/ojfbot/MrPlug/discussions)
2. File a [Security Issue](https://github.com/ojfbot/MrPlug/security)
3. Review the [Privacy Policy](../README.md#security) in README.md

Last Updated: 2025-12-08
Manifest Version: 3
Extension Version: 0.1.0
