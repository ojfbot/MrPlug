# Extension Testing Guide

This guide provides comprehensive instructions for manually testing the MrPlug browser extension.

## Build Verification

### Prerequisites
- Node.js >= 20.18.1
- pnpm >= 8.0.0

### Build Steps

1. **Install dependencies**
   ```bash
   pnpm install
   ```

2. **Run TypeScript type checking**
   ```bash
   pnpm type-check
   ```
   Expected: No errors

3. **Run automated tests**
   ```bash
   pnpm test
   ```
   Expected: All tests pass (21 tests across 3 test files)

4. **Build the extension**
   ```bash
   pnpm build
   ```
   Expected output:
   - Build completes without errors
   - `dist/` directory is created with all assets
   - `dist/manifest.json` is valid Manifest V3
   - All icons bundled in `dist/icons/`
   - All HTML pages in `dist/src/popup/` and `dist/src/options/`

## Manual Browser Testing

### Chrome/Edge/Brave

1. **Load the extension**
   - Navigate to `chrome://extensions/` (Chrome) or `edge://extensions/` (Edge) or `brave://extensions/` (Brave)
   - Enable "Developer mode" toggle (top right)
   - Click "Load unpacked"
   - Select the `dist/` directory from your project

2. **Verify extension loaded successfully**
   - ✅ Extension appears in the list without errors
   - ✅ MrPlug icon shows in the browser toolbar
   - ✅ Extension status shows as "Enabled"

3. **Check background service worker**
   - Click "service worker" link under the extension
   - Developer tools console should open
   - ✅ No errors in console
   - ✅ Console shows: `[MrPlug] Background service worker initialized`

4. **Test popup**
   - Click the MrPlug icon in the toolbar
   - ✅ Popup opens without errors
   - ✅ UI renders correctly with configuration options
   - ✅ No console errors

5. **Test options page**
   - Right-click the MrPlug icon
   - Select "Options"
   - ✅ Options page opens in a new tab
   - ✅ Configuration form renders correctly
   - ✅ No console errors

6. **Test content script injection**
   - Open any localhost page (e.g., `http://localhost:3000`)
   - Open browser DevTools console (F12)
   - ✅ Console shows: `[MrPlug] Content script initialized`
   - ✅ No injection errors
   - ✅ Content script loads on all localhost URLs

7. **Test keyboard shortcut**
   - On a localhost page, press `Alt+Shift+F` (Windows/Linux) or `Ctrl+Shift+F` (Mac)
   - ✅ Feedback interface should trigger
   - Alternative: Hold `Fn+F1` and click on any element
   - ✅ Element should be selected for feedback

## Acceptance Criteria Checklist

Use this checklist to verify all requirements from issue #1:

- [x] `pnpm build` completes without errors
- [x] Extension loads in Chrome/Edge/Brave without errors
- [x] All TypeScript compilation passes
- [x] Vite build produces optimized production bundle
- [x] Extension manifest is valid for Manifest V3
- [x] All assets (icons, HTML pages) are correctly bundled
- [ ] No console errors when extension loads (manual verification required)
- [ ] Background service worker loads without errors (manual verification required)
- [ ] Content script injects on localhost pages (manual verification required)
- [ ] Popup opens and displays correctly (manual verification required)
- [ ] Options page opens and displays correctly (manual verification required)

## Common Issues

### Extension fails to load
- Ensure you selected the `dist/` directory, not the project root
- Run `pnpm build` again to ensure build artifacts are current
- Check for syntax errors in manifest.json

### Content script doesn't inject
- Verify you're on a localhost URL (http://localhost:* or http://127.0.0.1:*)
- Check browser console for injection errors
- Reload the extension and refresh the page

### Service worker errors
- Check that all permissions are granted
- Verify manifest.json has correct service worker path
- Look for CSP (Content Security Policy) violations

## Build Statistics

Current build output (as of latest build):
- Total bundle size: ~827 KB (content script)
- Gzipped size: ~214 KB
- Icons: 3 SVG files (16px, 48px, 128px)
- Pages: 2 HTML files (popup, options)
- Service worker: Modularized build

## Next Steps

After manual testing confirms all functionality:
1. Document any issues found
2. Update this testing guide with any new findings
3. Create PR with test results
4. Request architectural review
