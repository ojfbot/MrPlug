import browser from 'webextension-polyfill';
import { Storage } from '../lib/storage';
import { AIAgent } from '../lib/ai-agent';
import { ENV_CONFIG } from '../lib/env';
import type { AIResponse } from '../types';

console.log('[MrPlug] Background service worker started');

// Auto-configure on startup if env config exists and no API key is set
(async () => {
  const hasEnvConfig = ENV_CONFIG && ENV_CONFIG.ANTHROPIC_API_KEY;

  if (hasEnvConfig) {
    const currentConfig = await Storage.getConfig();

    // If no API key is configured, auto-configure from env
    if (!currentConfig.anthropicApiKey && !currentConfig.openaiApiKey) {
      console.log('[MrPlug] 🔄 Auto-configuring from environment on startup');
      console.log('[MrPlug] 🤖 Provider:', ENV_CONFIG.DEFAULT_PROVIDER);

      await Storage.setConfig({
        llmProvider: ENV_CONFIG.DEFAULT_PROVIDER as 'anthropic' | 'openai',
        anthropicApiKey: ENV_CONFIG.ANTHROPIC_API_KEY,
        frameAgentUrl: 'http://localhost:4001', // Dev mode: route AI through frame-agent
        claudeCodeEnabled: false,
        autoScreenshot: true,
        keyboardShortcut: 'Alt+Shift+F',
        localAppPath: '/Users/yuri/ojfbot/cv-builder', // Default source code path
      });

      console.log('[MrPlug] ✅ Extension configured and ready to use!');
      console.log('[MrPlug] 💡 Press Alt+Shift+F on any localhost page to start');
    } else {
      console.log('[MrPlug] 📋 Configuration already exists');
      console.log('[MrPlug] Provider:', currentConfig.llmProvider);
      console.log('[MrPlug] Has Anthropic key:', !!currentConfig.anthropicApiKey);
      console.log('[MrPlug] Has OpenAI key:', !!currentConfig.openaiApiKey);
    }
  }
})();

// Handle installation
browser.runtime.onInstalled.addListener(async (details) => {
  if (details.reason === 'install') {
    console.log('[MrPlug] Extension installed');

    // Check for environment config and auto-configure
    const hasEnvConfig = ENV_CONFIG && ENV_CONFIG.ANTHROPIC_API_KEY;

    if (hasEnvConfig) {
      console.log('[MrPlug] 🔑 Auto-configuring with environment API key');
      console.log('[MrPlug] 🤖 Provider:', ENV_CONFIG.DEFAULT_PROVIDER);

      // Initialize with environment API key
      await Storage.setConfig({
        llmProvider: ENV_CONFIG.DEFAULT_PROVIDER as 'anthropic' | 'openai',
        anthropicApiKey: ENV_CONFIG.ANTHROPIC_API_KEY,
        frameAgentUrl: 'http://localhost:4001', // Dev mode: route AI through frame-agent
        claudeCodeEnabled: false,
        autoScreenshot: true,
        keyboardShortcut: 'Alt+Shift+F',
        localAppPath: '/Users/yuri/ojfbot/cv-builder', // Default source code path
        githubRepo: 'ojfbot/cv-builder', // Default GitHub repo
      });

      console.log('[MrPlug] ✅ Extension configured and ready to use!');
      console.log('[MrPlug] 💡 Press Alt+Shift+F on any localhost page to start');
    } else {
      console.log('[MrPlug] No environment config found - using defaults');

      // Initialize default config
      await Storage.setConfig({
        llmProvider: 'none',
        claudeCodeEnabled: false,
        autoScreenshot: true,
        keyboardShortcut: 'Alt+Shift+F',
        localAppPath: '/Users/yuri/ojfbot/cv-builder', // Default source code path
        githubRepo: 'ojfbot/cv-builder', // Default GitHub repo
      });

      // Open options page on first install
      browser.runtime.openOptionsPage();
    }
  } else if (details.reason === 'update') {
    console.log('[MrPlug] Extension updated');

    // Check if we should update with new env config
    const hasEnvConfig = ENV_CONFIG && ENV_CONFIG.ANTHROPIC_API_KEY;

    if (hasEnvConfig) {
      const currentConfig = await Storage.getConfig();

      // Only update if no API key is currently set
      if (!currentConfig.anthropicApiKey && !currentConfig.openaiApiKey) {
        console.log('[MrPlug] 🔑 Auto-updating with environment API key');
        await Storage.setConfig({
          ...currentConfig,
          llmProvider: ENV_CONFIG.DEFAULT_PROVIDER as 'anthropic' | 'openai',
          anthropicApiKey: ENV_CONFIG.ANTHROPIC_API_KEY,
        });
        console.log('[MrPlug] ✅ Configuration updated!');
      }
    }
  }
});

// Pre-captured screenshot — taken immediately when the command fires, while activeTab is granted.
// captureVisibleTab() requires activeTab permission to be freshly granted; the Chrome command
// path guarantees this. The content script then reads it via 'capture-screenshot' message.
let pendingScreenshot: string | null = null;

// Handle keyboard commands
browser.commands.onCommand.addListener(async (command) => {
  if (command === 'trigger-feedback') {
    const tabs = await browser.tabs.query({ active: true, currentWindow: true });
    if (tabs[0]?.id) {
      // Capture screenshot NOW while activeTab permission is granted by this command invocation.
      // Store it so the content script can retrieve it after the user clicks an element.
      try {
        pendingScreenshot = await browser.tabs.captureVisibleTab(tabs[0].windowId, { format: 'png' });
        console.log('[MrPlug] Pre-captured screenshot at command time');
      } catch (err) {
        console.warn('[MrPlug] Pre-capture failed:', err);
        pendingScreenshot = null;
      }

      await browser.tabs.sendMessage(tabs[0].id, {
        type: 'toggle-feedback',
      });
    }
  }
});

// Handle messages from content scripts and popup
browser.runtime.onMessage.addListener(async (message: any, _sender: any) => {
  console.log('[MrPlug] Received message:', message);

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

    case 'open-settings':
      // Open settings page and track referring tab
      const currentTabs = await browser.tabs.query({ active: true, currentWindow: true });
      const referringTabId = currentTabs[0]?.id;

      const optionsUrl = browser.runtime.getURL('options.html');
      const existingTabs = await browser.tabs.query({ url: optionsUrl });

      if (existingTabs.length > 0 && existingTabs[0].id) {
        // Settings already open, focus it
        await browser.tabs.update(existingTabs[0].id, { active: true });
      } else {
        // Open new settings tab
        await browser.tabs.create({ url: optionsUrl });
      }

      // Store referring tab ID for return navigation
      if (referringTabId) {
        await browser.storage.local.set({ mrplug_referring_tab: referringTabId });
      }

      return { success: true };

    case 'activate-feedback':
      // Forward to content script in the specified tab
      if (message.tabId) {
        try {
          const response = await browser.tabs.sendMessage(message.tabId, {
            type: 'toggle-feedback',
          });
          return response;
        } catch (error) {
          console.error('[MrPlug] Failed to send message to content script:', error);
          return { success: false, error: 'Content script not ready' };
        }
      }
      return { success: false, error: 'No tab ID provided' };

    case 'capture-screenshot': {
      // Return pre-captured screenshot (taken when command fired with activeTab grant)
      if (pendingScreenshot) {
        const dataUrl = pendingScreenshot;
        pendingScreenshot = null; // consume — one screenshot per activation
        console.log('[MrPlug] Returning pre-captured screenshot');
        return { success: true, dataUrl };
      }

      // Fallback: try live capture (works if host permissions cover the current tab URL)
      try {
        const tabs = await browser.tabs.query({ active: true, currentWindow: true });
        if (!tabs[0]) {
          return { success: false, error: 'No active tab' };
        }
        const dataUrl = await browser.tabs.captureVisibleTab(tabs[0].windowId, { format: 'png' });
        if (!dataUrl) {
          return { success: false, error: 'captureVisibleTab returned empty result' };
        }
        return { success: true, dataUrl };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error('[MrPlug] Failed to capture screenshot:', errorMessage);

        if (errorMessage.includes('MAX_CAPTURE_VISIBLE_TAB_CALLS_PER_SECOND')) {
          console.warn('[MrPlug] Screenshot rate limit exceeded - client should retry');
          return { success: false, error: 'rate_limit_exceeded' };
        }

        return { success: false, error: errorMessage };
      }
    }

    case 'ai-request': {
      const config = await Storage.getConfig();

      // Dev mode: route through frame-agent if configured and reachable
      if (config.frameAgentUrl) {
        try {
          console.log('[MrPlug] Routing AI request through frame-agent:', config.frameAgentUrl);
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
              console.log('[MrPlug] frame-agent response received');
              return json.data;
            }
          }
          console.warn('[MrPlug] frame-agent returned non-OK status, falling back to direct API');
        } catch (err) {
          console.warn('[MrPlug] frame-agent unreachable, falling back to direct API:', err);
        }
      }

      // Production / fallback: use own API key
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
        const response = await agent.analyzeFeedback(
          message.userInput,
          message.elementContext,
          message.conversationHistory || [],
          message.agentMode || 'ui'
        );
        return response;
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

    case 'ping':
      // Keepalive — content script sends this on activate() to wake the service worker
      // before the user clicks an element, so captureVisibleTab is ready immediately
      return { pong: true };

    default:
      console.warn('[MrPlug] Unknown message type:', message.type);
      return { error: 'Unknown message type' };
  }
});

// Handle tab updates to log when content script should be injected
browser.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && tab.url) {
    try {
      const url = new URL(tab.url);
      if (url.hostname === 'localhost' || url.hostname === '127.0.0.1') {
        console.log('[MrPlug] Localhost page loaded:', tab.url);
        console.log('[MrPlug] Content script should be automatically injected by manifest');

        // Try to ping the content script to verify it's loaded
        setTimeout(async () => {
          try {
            const response = await browser.tabs.sendMessage(tabId, { type: 'ping' }) as { loaded?: boolean };
            if (response?.loaded) {
              console.log('[MrPlug] ✓ Content script is loaded and ready');
            }
          } catch (error) {
            console.warn('[MrPlug] ✗ Content script not responding. User may need to reload the page.');
          }
        }, 1000); // Wait 1 second for content script to initialize
      }
    } catch (urlError) {
      // Invalid URL, skip
    }
  }
});

export {};
