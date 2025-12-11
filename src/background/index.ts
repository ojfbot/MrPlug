import browser from 'webextension-polyfill';
import { Storage } from '../lib/storage';
import { ENV_CONFIG } from '../lib/env';
import { MCPClient } from '../lib/mcp-client';

console.log('[MrPlug] Background service worker started');

// Initialize MCP client
let mcpClient: MCPClient | null = null;

// Initialize MCP client based on config
async function initializeMCPClient() {
  const config = await Storage.getConfig();

  if (config.mcpEnabled && config.mcpServerUrl && config.mcpWsUrl) {
    console.log('[MrPlug] Initializing MCP client...');
    mcpClient = new MCPClient({
      serverUrl: config.mcpServerUrl,
      wsUrl: config.mcpWsUrl,
      enabled: true,
    });
    await mcpClient.initialize();
    console.log('[MrPlug] MCP client initialized');
  } else {
    console.log('[MrPlug] MCP integration disabled');
  }
}

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
        claudeCodeEnabled: false,
        autoScreenshot: true,
        keyboardShortcut: 'Alt+Shift+F',
        // MCP server defaults
        mcpEnabled: false,
        mcpServerUrl: 'http://localhost:3001',
        mcpWsUrl: 'ws://localhost:3002',
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

  // Initialize MCP client
  await initializeMCPClient();
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
        claudeCodeEnabled: false,
        autoScreenshot: true,
        keyboardShortcut: 'Alt+Shift+F',
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

// Handle keyboard commands
browser.commands.onCommand.addListener(async (command) => {
  if (command === 'trigger-feedback') {
    const tabs = await browser.tabs.query({ active: true, currentWindow: true });
    if (tabs[0]?.id) {
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

    case 'session-updated':
      // Sync session to MCP server
      if (mcpClient && message.session) {
        await mcpClient.sendSessionUpdate(message.session);
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

    case 'capture-screenshot':
      // Capture screenshot of active tab
      try {
        const tabs = await browser.tabs.query({ active: true, currentWindow: true });
        if (tabs[0]?.id) {
          const dataUrl = await browser.tabs.captureVisibleTab(undefined, {
            format: 'png',
          });
          return { success: true, dataUrl };
        }
        return { success: false, error: 'No active tab' };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error('[MrPlug] Failed to capture screenshot:', errorMessage);

        // Check if it's a rate limit error
        if (errorMessage.includes('MAX_CAPTURE_VISIBLE_TAB_CALLS_PER_SECOND')) {
          console.warn('[MrPlug] Screenshot rate limit exceeded - client should retry');
          return { success: false, error: 'rate_limit_exceeded' };
        }

        return { success: false, error: errorMessage };
      }

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
