import { createRoot } from 'react-dom/client';
import { useState, useEffect } from 'react';
import browser from 'webextension-polyfill';
import type { ExtensionConfig } from '../types';
import { ThemeManager } from '../lib/theme';

// Simple SVG icons as components
const PlayIcon = () => (
  <svg viewBox="0 0 16 16" fill="currentColor">
    <path d="M3.5 2.5v11l9-5.5z"/>
  </svg>
);

const SettingsIcon = () => (
  <svg viewBox="0 0 16 16" fill="currentColor">
    <path d="M13.5 8.4v-.8l1.5-.9-1.4-2.4-1.5.9c-.3-.2-.6-.4-.9-.5L10.5 3h-2.8l-.7 1.7c-.3.1-.6.3-.9.5l-1.5-.9L3.2 6.7l1.5.9v.8l-1.5.9 1.4 2.4 1.5-.9c.3.2.6.4.9.5l.7 1.7h2.8l.7-1.7c.3-.1.6-.3.9-.5l1.5.9 1.4-2.4-1.5-.9zM9.1 10.4c-1.3 0-2.4-1.1-2.4-2.4s1.1-2.4 2.4-2.4 2.4 1.1 2.4 2.4-1.1 2.4-2.4 2.4z"/>
  </svg>
);

const KeyboardIcon = () => (
  <svg viewBox="0 0 16 16" fill="currentColor">
    <path d="M14 4H2c-.6 0-1 .4-1 1v6c0 .6.4 1 1 1h12c.6 0 1-.4 1-1V5c0-.6-.4-1-1-1zM5 10H3V9h2v1zm0-2H3V7h2v1zm3 2H6V9h2v1zm0-2H6V7h2v1zm3 2H9V9h2v1zm0-2H9V7h2v1zm2 2h-1V9h1v1zm0-2h-1V7h1v1z"/>
  </svg>
);

const ThemeIcon = () => (
  <svg viewBox="0 0 16 16" fill="currentColor">
    <path d="M8 12c-2.2 0-4-1.8-4-4s1.8-4 4-4 4 1.8 4 4-1.8 4-4 4zm0-9C6.9 3 6 2.1 6 1h4c0 1.1-.9 2-2 2zm0 12c1.1 0 2 .9 2 2H6c0-1.1.9-2 2-2zM3 8c0-1.1-.9-2-2-2v4c1.1 0 2-.9 2-2zm12 0c0 1.1.9 2 2 2V6c-1.1 0-2 .9-2 2z"/>
  </svg>
);

function Popup() {
  const [config, setConfig] = useState<ExtensionConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [theme, setTheme] = useState<'light' | 'dark' | 'auto'>('auto');

  useEffect(() => {
    loadData();
    initTheme();
  }, []);

  const loadData = async () => {
    try {
      const configData = await browser.runtime.sendMessage({ type: 'get-config' });
      setConfig(configData as ExtensionConfig);
    } catch (error) {
      console.error('Failed to load data:', error);
    } finally {
      setLoading(false);
    }
  };

  const initTheme = async () => {
    await ThemeManager.initTheme();
    const currentTheme = await ThemeManager.getTheme();
    setTheme(currentTheme);
  };

  const cycleTheme = async () => {
    const themeOrder: Array<'light' | 'dark' | 'auto'> = ['auto', 'light', 'dark'];
    const currentIndex = themeOrder.indexOf(theme);
    const nextTheme = themeOrder[(currentIndex + 1) % themeOrder.length];

    await ThemeManager.setTheme(nextTheme);
    setTheme(nextTheme);
  };

  const getThemeLabel = () => {
    if (theme === 'auto') {
      const systemTheme = ThemeManager.getSystemTheme();
      return `Theme: Auto (${systemTheme})`;
    }
    return `Theme: ${theme.charAt(0).toUpperCase() + theme.slice(1)}`;
  };

  const triggerFeedback = async () => {
    try {
      const tabs = await browser.tabs.query({ active: true, currentWindow: true });
      const tab = tabs[0];

      if (!tab?.id) {
        alert('Could not find active tab.');
        return;
      }

      // Check if we're on a localhost page
      if (!tab.url?.includes('localhost') && !tab.url?.includes('127.0.0.1')) {
        alert('MrPlug only works on localhost development sites.\n\nPlease navigate to http://localhost:* or http://127.0.0.1:*');
        return;
      }

      try {
        // Try to send message to content script
        const response = await browser.tabs.sendMessage(tab.id, {
          type: 'toggle-feedback',
        }) as { success?: boolean };

        if (response?.success) {
          window.close();
        } else {
          throw new Error('Content script did not respond');
        }
      } catch (sendError) {
        console.error('Message send error:', sendError);

        // Content script not loaded - offer to reload the page
        const shouldReload = confirm(
          'MrPlug needs to reload this page to activate.\n\n' +
          'The page was loaded before the extension was installed/updated.\n\n' +
          'Click OK to reload now, or Cancel to reload manually.'
        );

        if (shouldReload) {
          await browser.tabs.reload(tab.id);
          window.close();
        }
      }
    } catch (error) {
      console.error('Failed to trigger feedback:', error);
      alert('Could not activate feedback mode. Make sure you are on a localhost page.');
    }
  };

  const openOptions = () => {
    browser.runtime.openOptionsPage();
    window.close();
  };

  const openKeyboardHelp = () => {
    alert('MrPlug Keyboard Shortcuts:\n\n• fn-F1 + click: Select element for feedback\n• X: Exit feedback mode\n\nWorks on localhost and 127.0.0.1 pages only.');
  };

  if (loading) {
    return (
      <div className="dropdown-menu">
        <div className="menu-header">Loading...</div>
      </div>
    );
  }

  const hasLLM = (config?.llmProvider === 'openai' && config?.openaiApiKey) ||
                 (config?.llmProvider === 'anthropic' && config?.anthropicApiKey) ||
                 config?.openaiApiKey; // Fallback for old configs
  const hasIntegration = config?.githubToken || config?.claudeCodeEnabled;
  const isConfigured = hasLLM && hasIntegration;

  return (
    <div className="dropdown-menu">
      <div className="menu-header">MrPlug</div>

      <button className="menu-item" onClick={triggerFeedback}>
        <PlayIcon />
        <span>Start Feedback Mode</span>
        <span
          className={`status-indicator ${isConfigured ? 'status-configured' : 'status-not-configured'}`}
          title={isConfigured ? 'Configured' : 'Not configured'}
        />
      </button>

      <div className="menu-divider" />

      <button className="menu-item" onClick={cycleTheme}>
        <ThemeIcon />
        <span>{getThemeLabel()}</span>
      </button>

      <button className="menu-item" onClick={openKeyboardHelp}>
        <KeyboardIcon />
        <span>Keyboard Shortcuts</span>
      </button>

      <button className="menu-item" onClick={openOptions}>
        <SettingsIcon />
        <span>Settings</span>
      </button>

      <div className="menu-divider" />

      <div className="menu-footer">
        {isConfigured ? (
          <>
            <div style={{ color: '#24a148', marginBottom: '4px', fontWeight: 500 }}>
              ✓ Ready to use
            </div>
            <div>Press fn-F1 + click on any element</div>
          </>
        ) : (
          <>
            <div style={{ color: 'var(--cds-text-error)', marginBottom: '4px', fontWeight: 500 }}>
              ⚠ Setup required
            </div>
            <div>Configure API keys in Settings</div>
          </>
        )}
      </div>
    </div>
  );
}

const root = document.getElementById('root');
if (root) {
  createRoot(root).render(<Popup />);
}

export {};
