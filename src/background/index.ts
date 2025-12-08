import browser from 'webextension-polyfill';
import { Storage } from '../lib/storage';

console.log('[MrPlug] Background service worker started');

// Handle installation
browser.runtime.onInstalled.addListener(async (details) => {
  if (details.reason === 'install') {
    console.log('[MrPlug] Extension installed');

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
        console.error('[MrPlug] Failed to capture screenshot:', error);
        return { success: false, error: String(error) };
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
