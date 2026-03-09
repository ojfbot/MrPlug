import browser from 'webextension-polyfill';
import { Storage } from '../lib/storage';
import { AIAgent } from '../lib/ai-agent';
import { GitHubIntegration } from '../lib/github-integration';
import { ENV_CONFIG } from '../lib/env';
import type { AIResponse, ProjectMapping, GitHubIssueData } from '../types';

console.log('[MrPlug] Background service worker started');

// ─── Default project mappings for Frame OS repos ────────────────────────────
const DEFAULT_PROJECT_MAPPINGS: ProjectMapping[] = [
  {
    hostname: 'cv.jim.software',
    githubRepo: 'ojfbot/cv-builder',
    localPath: '/Users/yuri/ojfbot/cv-builder',
  },
  {
    hostname: 'localhost:3000',
    githubRepo: 'ojfbot/cv-builder',
    localPath: '/Users/yuri/ojfbot/cv-builder',
  },
  {
    hostname: 'localhost:3001',
    githubRepo: 'ojfbot/cv-builder',
    localPath: '/Users/yuri/ojfbot/cv-builder',
  },
  {
    hostname: 'frame.jim.software',
    githubRepo: 'ojfbot/shell',
    localPath: '/Users/yuri/ojfbot/shell',
  },
  {
    hostname: 'localhost:4000',
    githubRepo: 'ojfbot/shell',
    localPath: '/Users/yuri/ojfbot/shell',
  },
  {
    hostname: 'blog.jim.software',
    githubRepo: 'ojfbot/blogengine',
    localPath: '/Users/yuri/ojfbot/blogengine',
  },
  {
    hostname: 'localhost:3005',
    githubRepo: 'ojfbot/blogengine',
    localPath: '/Users/yuri/ojfbot/blogengine',
  },
  {
    hostname: 'trips.jim.software',
    githubRepo: 'ojfbot/tripplanner',
    localPath: '/Users/yuri/ojfbot/tripplanner',
  },
  {
    hostname: 'localhost:3010',
    githubRepo: 'ojfbot/tripplanner',
    localPath: '/Users/yuri/ojfbot/tripplanner',
  },
];

/**
 * Resolve the project mapping for a given page URL.
 * Matches on host+port, then host-only, then falls back to config.githubRepo.
 */
/**
 * Replace the generic default action injected by ai-agent with a context-aware one:
 * - Production (*.jim.software) → github-issue
 * - Local (localhost / 127.0.0.1) → claude-code
 */
function injectDefaultAction(response: AIResponse, pageUrl?: string): AIResponse {
  const isLocal = !pageUrl || /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?/.test(pageUrl);
  const desiredType = isLocal ? 'claude-code' : 'github-issue';
  const oppositeType = isLocal ? 'github-issue' : 'claude-code';

  // Remove any auto-injected opposite action so we don't show both
  const filtered = response.suggestedActions.filter((a) => a.type !== oppositeType);

  // Ensure the desired action is present (unshift if not already there)
  if (!filtered.some((a) => a.type === desiredType)) {
    filtered.unshift({
      type: desiredType,
      title: desiredType === 'github-issue' ? 'Create GitHub Issue' : 'Send to Claude Code',
      description: response.issueTitle || response.analysis.slice(0, 80),
      priority: 'medium',
    });
  }

  return { ...response, suggestedActions: filtered };
}

function resolveProjectMapping(
  pageUrl: string,
  mappings: ProjectMapping[],
  fallbackRepo?: string,
  elementContext?: { mfRemoteName?: string; mfRemoteOrigins?: string[] }
): ProjectMapping | null {
  // 1. Highest precision: data-mf-remote attribute on the element's ancestor
  if (elementContext?.mfRemoteName) {
    const byName = mappings.find(
      (m) => m.hostname === elementContext.mfRemoteName ||
             m.githubRepo.endsWith(`/${elementContext.mfRemoteName}`)
    );
    if (byName) return byName;
  }

  // 2. Script-tag origins: match remote entry origin to a project mapping
  if (elementContext?.mfRemoteOrigins?.length) {
    for (const origin of elementContext.mfRemoteOrigins) {
      try {
        const o = new URL(origin);
        const originHost = o.port ? `${o.hostname}:${o.port}` : o.hostname;
        const byOrigin =
          mappings.find((m) => m.hostname === originHost) ||
          mappings.find((m) => m.hostname === o.hostname);
        if (byOrigin) return byOrigin;
      } catch {
        // skip
      }
    }
  }

  // 3. Page URL (handles non-MF pages and shell URLs when no remotes detected)
  try {
    const url = new URL(pageUrl);
    const hostWithPort = url.port ? `${url.hostname}:${url.port}` : url.hostname;

    const match =
      mappings.find((m) => m.hostname === hostWithPort) ||
      mappings.find((m) => m.hostname === url.hostname);

    if (match) return match;

    if (fallbackRepo) {
      return { hostname: url.hostname, githubRepo: fallbackRepo };
    }
  } catch {
    // Invalid URL
  }
  return null;
}

// ─── Auto-configure on startup ──────────────────────────────────────────────
(async () => {
  const hasEnvConfig = ENV_CONFIG && ENV_CONFIG.ANTHROPIC_API_KEY;

  if (hasEnvConfig) {
    const currentConfig = await Storage.getConfig();

    if (!currentConfig.anthropicApiKey && !currentConfig.openaiApiKey) {
      console.log('[MrPlug] Auto-configuring from environment on startup');
      await Storage.setConfig({
        llmProvider: ENV_CONFIG.DEFAULT_PROVIDER as 'anthropic' | 'openai',
        anthropicApiKey: ENV_CONFIG.ANTHROPIC_API_KEY,
        frameAgentUrl: 'http://localhost:4001',
        claudeCodeEnabled: true,
        claudeCodeRelayUrl: 'http://localhost:27182',
        autoScreenshot: true,
        keyboardShortcut: 'Alt+Shift+F',
        localAppPath: '/Users/yuri/ojfbot/cv-builder',
        githubRepo: 'ojfbot/cv-builder',
        projectMappings: DEFAULT_PROJECT_MAPPINGS,
      });
      console.log('[MrPlug] Extension configured and ready');
    } else if (!currentConfig.projectMappings || currentConfig.projectMappings.length === 0) {
      // Existing install — backfill project mappings
      await Storage.setConfig({
        ...currentConfig,
        projectMappings: DEFAULT_PROJECT_MAPPINGS,
        claudeCodeEnabled: currentConfig.claudeCodeEnabled ?? true,
        claudeCodeRelayUrl: currentConfig.claudeCodeRelayUrl ?? 'http://localhost:27182',
      });
      console.log('[MrPlug] Backfilled project mappings');
    }
  }
})();

// ─── Installation handler ────────────────────────────────────────────────────
browser.runtime.onInstalled.addListener(async (details) => {
  if (details.reason === 'install') {
    console.log('[MrPlug] Extension installed');
    const hasEnvConfig = ENV_CONFIG && ENV_CONFIG.ANTHROPIC_API_KEY;

    if (hasEnvConfig) {
      await Storage.setConfig({
        llmProvider: ENV_CONFIG.DEFAULT_PROVIDER as 'anthropic' | 'openai',
        anthropicApiKey: ENV_CONFIG.ANTHROPIC_API_KEY,
        frameAgentUrl: 'http://localhost:4001',
        claudeCodeEnabled: true,
        claudeCodeRelayUrl: 'http://localhost:27182',
        autoScreenshot: true,
        keyboardShortcut: 'Alt+Shift+F',
        localAppPath: '/Users/yuri/ojfbot/cv-builder',
        githubRepo: 'ojfbot/cv-builder',
        projectMappings: DEFAULT_PROJECT_MAPPINGS,
      });
      console.log('[MrPlug] Extension configured from env');
    } else {
      await Storage.setConfig({
        llmProvider: 'none',
        claudeCodeEnabled: false,
        claudeCodeRelayUrl: 'http://localhost:27182',
        autoScreenshot: true,
        keyboardShortcut: 'Alt+Shift+F',
        localAppPath: '/Users/yuri/ojfbot/cv-builder',
        githubRepo: 'ojfbot/cv-builder',
        projectMappings: DEFAULT_PROJECT_MAPPINGS,
      });
      browser.runtime.openOptionsPage();
    }
  } else if (details.reason === 'update') {
    const hasEnvConfig = ENV_CONFIG && ENV_CONFIG.ANTHROPIC_API_KEY;
    if (hasEnvConfig) {
      const currentConfig = await Storage.getConfig();
      const updates: Partial<typeof currentConfig> = {};

      if (!currentConfig.anthropicApiKey && !currentConfig.openaiApiKey) {
        updates.llmProvider = ENV_CONFIG.DEFAULT_PROVIDER as 'anthropic' | 'openai';
        updates.anthropicApiKey = ENV_CONFIG.ANTHROPIC_API_KEY;
      }
      if (!currentConfig.projectMappings || currentConfig.projectMappings.length === 0) {
        updates.projectMappings = DEFAULT_PROJECT_MAPPINGS;
      }
      if (!currentConfig.claudeCodeRelayUrl) {
        updates.claudeCodeRelayUrl = 'http://localhost:27182';
      }
      if (Object.keys(updates).length > 0) {
        await Storage.setConfig({ ...currentConfig, ...updates });
      }
    }
  }
});

// ─── Screenshot pre-capture ──────────────────────────────────────────────────
let pendingScreenshot: string | null = null;
let pendingScreenshotTime: number = 0;
const PENDING_SCREENSHOT_MAX_AGE_MS = 10_000;

browser.commands.onCommand.addListener(async (command) => {
  if (command === 'trigger-feedback') {
    const tabs = await browser.tabs.query({ active: true, currentWindow: true });
    if (tabs[0]?.id) {
      try {
        pendingScreenshot = await browser.tabs.captureVisibleTab(tabs[0].windowId, { format: 'png' });
        pendingScreenshotTime = Date.now();
        console.log('[MrPlug] Pre-captured screenshot at command time');
      } catch (err) {
        console.warn('[MrPlug] Pre-capture failed:', err);
        pendingScreenshot = null;
        pendingScreenshotTime = 0;
      }

      await browser.tabs.sendMessage(tabs[0].id, { type: 'toggle-feedback' });
    }
  }
});

// ─── Message handler ─────────────────────────────────────────────────────────
browser.runtime.onMessage.addListener(async (message: any, _sender: any) => {
  console.log('[MrPlug] Received message:', message.type);

  switch (message.type) {
    case 'get-config':
      return await Storage.getConfig();

    case 'set-config':
      await Storage.setConfig(message.data);
      return { success: true };

    case 'get-conversation-history':
      return await Storage.getConversationHistory();

    case 'clear-conversation':
      await Storage.clearConversationHistory();
      return { success: true };

    case 'get-recent-feedback':
      return await Storage.getRecentFeedback();

    case 'open-settings': {
      const currentTabs = await browser.tabs.query({ active: true, currentWindow: true });
      const referringTabId = currentTabs[0]?.id;
      const optionsUrl = browser.runtime.getURL('options.html');
      const existingTabs = await browser.tabs.query({ url: optionsUrl });

      if (existingTabs.length > 0 && existingTabs[0].id) {
        await browser.tabs.update(existingTabs[0].id, { active: true });
      } else {
        await browser.tabs.create({ url: optionsUrl });
      }

      if (referringTabId) {
        await browser.storage.local.set({ mrplug_referring_tab: referringTabId });
      }
      return { success: true };
    }

    case 'activate-feedback':
      if (message.tabId) {
        try {
          const response = await browser.tabs.sendMessage(message.tabId, { type: 'toggle-feedback' });
          return response;
        } catch (error) {
          console.error('[MrPlug] Failed to send message to content script:', error);
          return { success: false, error: 'Content script not ready' };
        }
      }
      return { success: false, error: 'No tab ID provided' };

    case 'capture-screenshot': {
      const age = Date.now() - pendingScreenshotTime;
      if (pendingScreenshot && age < PENDING_SCREENSHOT_MAX_AGE_MS) {
        const dataUrl = pendingScreenshot;
        pendingScreenshot = null;
        pendingScreenshotTime = 0;
        return { success: true, dataUrl };
      }
      if (pendingScreenshot) {
        console.warn(`[MrPlug] Discarding stale screenshot (age: ${age}ms)`);
        pendingScreenshot = null;
        pendingScreenshotTime = 0;
      }

      try {
        const tabs = await browser.tabs.query({ active: true, currentWindow: true });
        if (!tabs[0]) return { success: false, error: 'No active tab' };
        const dataUrl = await browser.tabs.captureVisibleTab(tabs[0].windowId, { format: 'png' });
        if (!dataUrl) return { success: false, error: 'captureVisibleTab returned empty result' };
        return { success: true, dataUrl };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error('[MrPlug] Failed to capture screenshot:', errorMessage);
        if (errorMessage.includes('MAX_CAPTURE_VISIBLE_TAB_CALLS_PER_SECOND')) {
          return { success: false, error: 'rate_limit_exceeded' };
        }
        return { success: false, error: errorMessage };
      }
    }

    case 'ai-request': {
      const config = await Storage.getConfig();

      // Dev mode: route through frame-agent
      if (config.frameAgentUrl) {
        try {
          const res = await fetch(`${config.frameAgentUrl}/api/inspect`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              elementContext: message.elementContext,
              userInput: message.userInput,
              agentMode: message.agentMode || 'ui',
              conversationHistory: message.conversationHistory || [],
            }),
          });

          if (res.ok) {
            const json = await res.json() as { success: boolean; data: AIResponse };
            if (json.success) {
              return injectDefaultAction(json.data, message.pageUrl);
            }
          }
          console.warn('[MrPlug] frame-agent non-OK, falling back to direct API');
        } catch (err) {
          console.warn('[MrPlug] frame-agent unreachable, falling back to direct API:', err);
        }
      }

      const apiKey = config.anthropicApiKey || config.openaiApiKey;
      if (!apiKey || config.llmProvider === 'none') {
        const notConfigured: AIResponse = {
          analysis: 'AI not configured. Open extension settings and add an API key.',
          suggestedActions: [{ type: 'manual', title: 'Open Settings', description: 'Add an API key in extension settings', priority: 'high' }],
          requiresCodeChange: false,
          confidence: 0,
        };
        return notConfigured;
      }

      try {
        const agent = new AIAgent(apiKey);
        const aiResponse = await agent.analyzeFeedback(
          message.userInput,
          message.elementContext,
          message.conversationHistory || [],
          message.agentMode || 'ui'
        );
        return injectDefaultAction(aiResponse, message.pageUrl);
      } catch (err) {
        console.error('[MrPlug] Background AI call failed:', err);
        const failed: AIResponse = {
          analysis: err instanceof Error ? err.message : 'AI call failed',
          suggestedActions: [],
          requiresCodeChange: false,
          confidence: 0,
        };
        return failed;
      }
    }

    case 'create-github-issue': {
      const config = await Storage.getConfig();

      if (!config.githubToken) {
        return { success: false, error: 'No GitHub token configured' };
      }

      // Resolve repo from page URL using project mappings (MF-aware)
      const mappings = config.projectMappings || DEFAULT_PROJECT_MAPPINGS;
      const elementCtx = message.elementContext ?? message.issueData?.elementContext;
      const projectMapping = message.pageUrl
        ? resolveProjectMapping(message.pageUrl, mappings, config.githubRepo, elementCtx)
        : null;

      const repoString = projectMapping?.githubRepo || config.githubRepo;
      if (!repoString) {
        return { success: false, error: 'No GitHub repo configured for this page' };
      }

      try {
        const gh = new GitHubIntegration(config.githubToken, repoString);
        const issueData: GitHubIssueData = message.issueData;
        const result = await gh.createIssue(issueData);
        console.log('[MrPlug] GitHub issue created:', result.url);
        return { success: true, url: result.url, number: result.number, repo: repoString };
      } catch (err) {
        console.error('[MrPlug] GitHub issue creation failed:', err);
        return { success: false, error: err instanceof Error ? err.message : String(err) };
      }
    }

    case 'send-to-claude-code': {
      const config = await Storage.getConfig();
      const relayUrl = config.claudeCodeRelayUrl || 'http://localhost:27182';

      try {
        const res = await fetch(`${relayUrl}/submit`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(message.payload),
        });

        if (res.ok) {
          console.log('[MrPlug] Payload sent to Claude Code relay');
          return { success: true };
        }
        return { success: false, error: `Relay responded with ${res.status}` };
      } catch (err) {
        console.error('[MrPlug] Claude Code relay unreachable:', err);
        return {
          success: false,
          error: 'Claude Code relay not running. Start it with: cd mrplug-mcp-server && pnpm start',
        };
      }
    }

    case 'clear-claude-code-context': {
      const config = await Storage.getConfig();
      const relayUrl = config.claudeCodeRelayUrl || 'http://localhost:27182';

      try {
        const res = await fetch(`${relayUrl}/clear`, { method: 'DELETE' });
        return { success: res.ok };
      } catch {
        // Relay not running — nothing to clear
        return { success: true };
      }
    }

    case 'resolve-project': {
      // Content script can ask: "what project is this page?"
      const config = await Storage.getConfig();
      const mappings = config.projectMappings || DEFAULT_PROJECT_MAPPINGS;
      const mapping = message.pageUrl
        ? resolveProjectMapping(message.pageUrl, mappings, config.githubRepo, message.elementContext)
        : null;
      return { success: true, mapping };
    }

    case 'open-settings':
      await browser.runtime.openOptionsPage();
      return { success: true };

    case 'ping':
      return { pong: true };

    default:
      console.warn('[MrPlug] Unknown message type:', message.type);
      return { error: 'Unknown message type' };
  }
});

// ─── Tab update logging ──────────────────────────────────────────────────────
browser.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && tab.url) {
    try {
      const url = new URL(tab.url);
      if (url.hostname === 'localhost' || url.hostname === '127.0.0.1') {
        console.log('[MrPlug] Localhost page loaded:', tab.url);
        setTimeout(async () => {
          try {
            const response = await browser.tabs.sendMessage(tabId, { type: 'ping' }) as { loaded?: boolean };
            if (response?.loaded) {
              console.log('[MrPlug] Content script is loaded and ready');
            }
          } catch {
            console.warn('[MrPlug] Content script not responding');
          }
        }, 1000);
      }
    } catch {
      // Invalid URL
    }
  }
});

export {};
