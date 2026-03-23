# CLAUDE.md — mrplug

> **Read `domain-knowledge/frame-os-context.md` before any cross-repo work.**
> **Read `domain-knowledge/mrplug-architecture.md` for extension-specific architecture.**

MrPlug is Frame OS's built-in inspect mode — a Chrome/Firefox extension (MV3) that activates on any `localhost` or `*.jim.software` page via `Cmd+Shift+F`.

## Commands

```bash
pnpm install          # install deps (Node v24.11.1 via fnm)
pnpm build            # compile + bundle → dist/
pnpm type-check       # tsc --noEmit only
pnpm test             # vitest

# Load dist/ as unpacked extension in Chrome:
# chrome://extensions → Developer mode → Load unpacked → select dist/
# After any change: pnpm build → Chrome "reload" button on the extension card
```

## Architecture

Single-package MV3 extension (not yet the planned monorepo). Key constraint: **no AI SDK in content script**. The background service worker is the routing brain: it resolves project mappings (page URL → repo) before any action fires.

```
src/
  manifest.json           MV3 manifest — host_permissions covers localhost + *.jim.software
  background/index.ts     Service worker. All AI calls live here. Imports AIAgent.
                          Also handles project mappings, GitHub issue creation, Claude Code relay,
                          and file-techdebt (posts AI-spotted debt to TECHDEBT.md via frame-agent).
  content/index.tsx       Injected into pages. Pure UI + messaging — no AI SDK.
  components/
    FeedbackModal.tsx     Carbon <Modal> — always cds--g100 (Frame dark)
    ElementOverlay.tsx    Hover highlight ring
    SessionList.tsx       Per-element chat thread sidebar
    ActionBadges          github-issue and claude-code action badges (see b25bc3c)
    OptionsPanel          Project mappings settings panel (see 76153b0)
  lib/
    ai-agent.ts           LangChain wrapper (Anthropic + OpenAI). Background only.
    storage.ts            chrome.storage.local — config, sessions, history
    element-capture.ts    DOM → ElementContext serialiser (mousedown-based selection; includes MF remote detection)
    github-integration.ts Octokit issue creation
  styles/
    frame-tokens.css      --ojf-* tokens (copied from shell/tokens.css — single source)
    carbon-lite.css       @import frame-tokens + UI primitives for popup/options
```

## Key invariants

- `AIAgent` is **only ever imported in `src/background/index.ts`** — never content script
- Content script communicates via `browser.runtime.sendMessage({ type: 'ai-request', ... })`
- `#mrplug-root` always has class `cds--g100` — Frame dark, host-page-agnostic
- `frame-tokens.css` is the single source of truth for `--ojf-*` tokens; do not duplicate vars in carbon-lite
- No `alert()` or `confirm()` in production code — use Carbon `InlineNotification`

## env.json (gitignored)

```json
{
  "ANTHROPIC_API_KEY": "sk-ant-...",
  "DEFAULT_PROVIDER": "anthropic"
}
```

`scripts/inject-env.js` reads this at build time and writes `src/lib/env.ts`. The background service worker auto-configures on install.

## Roadmap phases (mrplug-specific)

| Phase | What | Status |
|-------|------|--------|
| 2B | AI → background worker | Done |
| 2B.5 | Frame visual identity (ojf tokens, g100, top-bar hint, Cmd+Shift+F) | Done |
| 5A | frame-agent routing: background POSTs to `frame-agent/api/chat` instead of direct Anthropic | Next |
| 5B | GitHub issue creation, Claude Code relay, MF-aware project routing | **Done** |
| 5B.1 | file-techdebt handler: background posts AI-spotted debt to frame-agent → `TECHDEBT.md` | **Done** |
| 5C | Replace alert()/confirm() with Carbon InlineNotification | Polish |
| 5D | Replace emoji action icons with Carbon icons | Polish |
## Things NOT to do

- Do not import `AIAgent` or any AI SDK in `src/content/`
- Do not use `alert()` or `confirm()` — use Carbon notifications
- Do not hardcode hex colors — use `--ojf-*` or `--cds-*` tokens
- Do not add `@carbon/react` singletons or MF config — this is not a Module Federation remote
- Do not push to main without PR — branch protection enforced
