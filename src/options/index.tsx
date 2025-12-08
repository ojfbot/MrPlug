import { createRoot } from 'react-dom/client';
import { useState, useEffect } from 'react';
import browser from 'webextension-polyfill';
import type { ExtensionConfig } from '../types';
import { ThemeManager } from '../lib/theme';

function Options() {
  const [config, setConfig] = useState<ExtensionConfig>({
    claudeCodeEnabled: false,
    autoScreenshot: true,
    keyboardShortcut: 'Alt+Shift+F',
  });

  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [theme, setTheme] = useState<'light' | 'dark' | 'auto'>('auto');

  useEffect(() => {
    loadConfig();
    initTheme();
  }, []);

  const initTheme = async () => {
    await ThemeManager.initTheme();
    const currentTheme = await ThemeManager.getTheme();
    setTheme(currentTheme);
  };

  const loadConfig = async () => {
    try {
      const data = await browser.runtime.sendMessage({ type: 'get-config' });
      setConfig(data as ExtensionConfig);
    } catch (err) {
      setError('Failed to load configuration');
    }
  };

  const saveConfig = async () => {
    try {
      await browser.runtime.sendMessage({
        type: 'set-config',
        data: config,
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      setError('Failed to save configuration');
    }
  };

  const clearHistory = async () => {
    if (confirm('Are you sure you want to clear conversation history?')) {
      try {
        await browser.runtime.sendMessage({ type: 'clear-conversation' });
        alert('Conversation history cleared');
      } catch (err) {
        setError('Failed to clear history');
      }
    }
  };

  const updateConfig = (key: keyof ExtensionConfig, value: any) => {
    setConfig({ ...config, [key]: value });
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
      return `${theme.charAt(0).toUpperCase() + theme.slice(1)} (${systemTheme})`;
    }
    return theme.charAt(0).toUpperCase() + theme.slice(1);
  };

  return (
    <div className="options-container">
      <h1>MrPlug Settings</h1>

      {saved && (
        <div className="cds-notification cds-notification--success">
          <div>
            <div className="cds-notification__title">Settings Saved</div>
            <div className="cds-notification__subtitle">Your configuration has been updated</div>
          </div>
        </div>
      )}

      {error && (
        <div className="cds-notification cds-notification--error">
          <div>
            <div className="cds-notification__title">Error</div>
            <div className="cds-notification__subtitle">{error}</div>
          </div>
        </div>
      )}

      <div className="options-grid">
        <div className="options-panel">
          <div className="section">
            <h2>AI Configuration</h2>
            <p style={{ color: 'var(--cds-text-secondary)' }}>
              Configure your AI provider for feedback analysis. Choose between OpenAI or Anthropic.
            </p>

            <div className="cds-form-item">
              <label htmlFor="llm-provider" className="cds-label">LLM Provider</label>
              <select
                id="llm-provider"
                value={config.llmProvider || 'none'}
                onChange={(e) => updateConfig('llmProvider', e.target.value as 'openai' | 'anthropic' | 'none')}
                style={{ width: '100%', padding: '0.5rem', fontSize: '0.875rem' }}
              >
                <option value="none">None (Context capture only)</option>
                <option value="openai">OpenAI</option>
                <option value="anthropic">Anthropic</option>
              </select>
              <div className="cds-helper-text">
                Select 'None' to use MrPlug without AI analysis (still captures context)
              </div>
            </div>

            {config.llmProvider === 'openai' && (
              <div className="cds-form-item">
                <label htmlFor="openai-key" className="cds-label">OpenAI API Key</label>
                <input
                  id="openai-key"
                  type="password"
                  placeholder="sk-..."
                  value={config.openaiApiKey || ''}
                  onChange={(e) => updateConfig('openaiApiKey', e.target.value)}
                />
                <div className="cds-helper-text">
                  Get your API key from{' '}
                  <a href="https://platform.openai.com/api-keys" target="_blank" rel="noopener noreferrer">
                    OpenAI Platform
                  </a>
                </div>
              </div>
            )}

            {config.llmProvider === 'anthropic' && (
              <div className="cds-form-item">
                <label htmlFor="anthropic-key" className="cds-label">Anthropic API Key</label>
                <input
                  id="anthropic-key"
                  type="password"
                  placeholder="sk-ant-..."
                  value={config.anthropicApiKey || ''}
                  onChange={(e) => updateConfig('anthropicApiKey', e.target.value)}
                />
                <div className="cds-helper-text">
                  Get your API key from{' '}
                  <a href="https://console.anthropic.com/settings/keys" target="_blank" rel="noopener noreferrer">
                    Anthropic Console
                  </a>
                </div>
              </div>
            )}

            <div className="cds-helper-text" style={{ marginTop: '1rem', fontSize: '0.75rem' }}>
              Your API keys are stored securely in browser storage and never leave your device
            </div>
          </div>
        </div>

        <div className="options-panel">
          <div className="section">
            <h2>GitHub Integration</h2>
            <p style={{ color: 'var(--cds-text-secondary)' }}>
              Configure GitHub to automatically create issues from feedback. Create a{' '}
              <a href="https://github.com/settings/tokens/new?scopes=repo" target="_blank" rel="noopener noreferrer">
                Personal Access Token
              </a>{' '}
              with repo scope.
            </p>

            <div className="cds-form-item">
              <label htmlFor="github-token" className="cds-label">GitHub Personal Access Token</label>
              <input
                id="github-token"
                type="password"
                placeholder="ghp_..."
                value={config.githubToken || ''}
                onChange={(e) => updateConfig('githubToken', e.target.value)}
              />
            </div>

            <div className="cds-form-item">
              <label htmlFor="github-repo" className="cds-label">Repository</label>
              <input
                id="github-repo"
                type="text"
                placeholder="owner/repository"
                value={config.githubRepo || ''}
                onChange={(e) => updateConfig('githubRepo', e.target.value)}
              />
              <div className="cds-helper-text">
                Format: owner/repository (e.g., octocat/hello-world)
              </div>
            </div>
          </div>
        </div>

        <div className="options-panel">
          <div className="section">
            <h2>Claude Code Integration</h2>
            <p style={{ color: 'var(--cds-text-secondary)' }}>
              Enable direct integration with Claude Code for automatic code fixes.
            </p>

            <label className="cds-toggle">
              <input
                type="checkbox"
                checked={config.claudeCodeEnabled}
                onChange={(e) => updateConfig('claudeCodeEnabled', e.target.checked)}
              />
              <span className="cds-toggle__switch"></span>
              <span className="cds-toggle__label">Enable Claude Code integration</span>
            </label>

            <div className="cds-notification cds-notification--info" style={{ marginTop: 'calc(var(--cds-spacing-07) * 1.5)' }}>
              <div>
                <div className="cds-notification__title">How it works</div>
                <div className="cds-notification__subtitle">
                  When enabled, MrPlug will send fix commands to Claude Code via localStorage. Make sure Claude Code is running and monitoring for commands.
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="options-panel">
          <div className="section">
            <h2>General Settings</h2>

            <div className="cds-form-item">
              <label htmlFor="theme-select" className="cds-label">Theme</label>
              <button
                id="theme-select"
                onClick={cycleTheme}
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  fontSize: '0.875rem',
                  background: 'var(--cds-background)',
                  border: '1px solid var(--cds-border-subtle)',
                  color: 'var(--cds-text-primary)',
                  cursor: 'pointer',
                  borderRadius: '2px',
                  textAlign: 'left',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                <span>{getThemeLabel()}</span>
                <span style={{ color: 'var(--cds-text-secondary)' }}>Click to change</span>
              </button>
              <div className="cds-helper-text">
                Cycles between Auto (system), Light, and Dark themes
              </div>
            </div>

            <div className="cds-form-item">
              <label className="cds-toggle">
                <input
                  type="checkbox"
                  checked={config.autoScreenshot}
                  onChange={(e) => updateConfig('autoScreenshot', e.target.checked)}
                />
                <span className="cds-toggle__switch"></span>
                <span className="cds-toggle__label">Automatically capture element screenshots</span>
              </label>
            </div>

            <div className="cds-form-item">
              <label htmlFor="local-app-path" className="cds-label">Local App Path</label>
              <input
                id="local-app-path"
                type="text"
                placeholder="/Users/username/projects/myapp"
                value={config.localAppPath || ''}
                onChange={(e) => updateConfig('localAppPath', e.target.value)}
              />
              <div className="cds-helper-text">
                Path to your local application directory (used for Claude Code integration)
              </div>
            </div>

            <div className="cds-form-item">
              <label htmlFor="keyboard-shortcut" className="cds-label">Keyboard Shortcut</label>
              <input
                id="keyboard-shortcut"
                type="text"
                value={config.keyboardShortcut}
                disabled
              />
              <div className="cds-helper-text">
                Use fn-F1 + click to select elements
              </div>
            </div>

            <button className="danger" onClick={clearHistory}>
              Clear Conversation History
            </button>
          </div>
        </div>
      </div>

      <div className="actions-section">
        <div className="button-group">
          <button onClick={saveConfig}>
            Save Settings
          </button>
        </div>
      </div>

      <div className="footer-info">
        <p style={{ marginBottom: 'var(--cds-spacing-03)' }}>
          <strong>MrPlug v0.1.0</strong> - AI-powered UI feedback assistant
        </p>
        <p style={{ margin: 0 }}>
          For help and documentation, visit the{' '}
          <a href="https://github.com/yourusername/mrplug" target="_blank" rel="noopener noreferrer">
            GitHub repository
          </a>.
        </p>
      </div>
    </div>
  );
}

const root = document.getElementById('root');
if (root) {
  createRoot(root).render(<Options />);
}

export {};
