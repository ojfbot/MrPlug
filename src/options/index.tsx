import { createRoot } from 'react-dom/client';
import { useState, useEffect } from 'react';
import browser from 'webextension-polyfill';
import type { ExtensionConfig, ProjectMapping } from '../types';
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
  const [mappingEdit, setMappingEdit] = useState<{ hostname: string; githubRepo: string; localPath: string }>({
    hostname: '',
    githubRepo: '',
    localPath: '',
  });

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

      // Check if there's a referring tab to return to
      const result = await browser.storage.local.get('mrplug_referring_tab');
      const referringTabId = result.mrplug_referring_tab as number | undefined;

      if (referringTabId && typeof referringTabId === 'number') {
        // Clean up stored tab ID
        await browser.storage.local.remove('mrplug_referring_tab');

        // Switch back to referring tab
        try {
          await browser.tabs.update(referringTabId, { active: true });
          // Close settings tab after a short delay
          setTimeout(async () => {
            const currentTab = await browser.tabs.getCurrent();
            if (currentTab?.id) {
              await browser.tabs.remove(currentTab.id);
            }
          }, 500);
        } catch (tabError) {
          // Tab might have been closed, just show success message
          setTimeout(() => setSaved(false), 3000);
        }
      } else {
        // No referring tab, just show success message
        setTimeout(() => setSaved(false), 3000);
      }
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

  // ── Project mappings ────────────────────────────────────────────────────────
  const mappings: ProjectMapping[] = config.projectMappings || [];

  const addMapping = () => {
    if (!mappingEdit.hostname || !mappingEdit.githubRepo) return;
    const newMapping: ProjectMapping = {
      hostname: mappingEdit.hostname.trim(),
      githubRepo: mappingEdit.githubRepo.trim(),
      localPath: mappingEdit.localPath.trim() || undefined,
    };
    updateConfig('projectMappings', [...mappings, newMapping]);
    setMappingEdit({ hostname: '', githubRepo: '', localPath: '' });
  };

  const removeMapping = (index: number) => {
    updateConfig('projectMappings', mappings.filter((_, i) => i !== index));
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
              Add a{' '}
              <a href="https://github.com/settings/tokens/new?scopes=repo" target="_blank" rel="noopener noreferrer">
                Personal Access Token
              </a>{' '}
              with <code>repo</code> scope. Repos are resolved per page via project mappings below.
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
              <div className="cds-helper-text">
                Screenshots are uploaded to the repo under <code>screenshots/mrplug/</code>.
              </div>
            </div>

            <div className="cds-form-item">
              <label htmlFor="github-repo" className="cds-label">Fallback Repository</label>
              <input
                id="github-repo"
                type="text"
                placeholder="owner/repository"
                value={config.githubRepo || ''}
                onChange={(e) => updateConfig('githubRepo', e.target.value)}
              />
              <div className="cds-helper-text">
                Used when no project mapping matches the current page.
              </div>
            </div>
          </div>
        </div>

        {/* ── Claude Code Integration ── */}
        <div className="options-panel">
          <div className="section">
            <h2>Claude Code Integration</h2>
            <p style={{ color: 'var(--cds-text-secondary)' }}>
              Send element context to your active Claude Code terminal session via the MrPlug relay server.
            </p>

            <div className="cds-form-item">
              <label className="cds-toggle">
                <input
                  type="checkbox"
                  checked={config.claudeCodeEnabled}
                  onChange={(e) => updateConfig('claudeCodeEnabled', e.target.checked)}
                />
                <span className="cds-toggle__switch"></span>
                <span className="cds-toggle__label">Enable Claude Code integration</span>
              </label>
            </div>

            <div className="cds-form-item">
              <label htmlFor="relay-url" className="cds-label">Relay Server URL</label>
              <input
                id="relay-url"
                type="text"
                placeholder="http://localhost:27182"
                value={config.claudeCodeRelayUrl || 'http://localhost:27182'}
                onChange={(e) => updateConfig('claudeCodeRelayUrl', e.target.value)}
              />
              <div className="cds-helper-text">
                Start relay: <code>cd mrplug-mcp-server &amp;&amp; pnpm start</code>
              </div>
            </div>
          </div>
        </div>

        {/* ── Project Mappings ── */}
        <div className="options-panel" style={{ gridColumn: '1 / -1' }}>
          <div className="section">
            <h2>Project Mappings</h2>
            <p style={{ color: 'var(--cds-text-secondary)' }}>
              Map hostnames to GitHub repos and local source paths. Used for GitHub issue routing and Claude Code context.
            </p>

            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem', marginBottom: '1rem' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--cds-border-subtle)' }}>
                  <th style={{ textAlign: 'left', padding: '0.5rem', color: 'var(--cds-text-secondary)', fontWeight: 500 }}>Hostname</th>
                  <th style={{ textAlign: 'left', padding: '0.5rem', color: 'var(--cds-text-secondary)', fontWeight: 500 }}>GitHub Repo</th>
                  <th style={{ textAlign: 'left', padding: '0.5rem', color: 'var(--cds-text-secondary)', fontWeight: 500 }}>Local Path</th>
                  <th style={{ width: '40px' }}></th>
                </tr>
              </thead>
              <tbody>
                {mappings.length === 0 && (
                  <tr>
                    <td colSpan={4} style={{ padding: '0.75rem 0.5rem', color: 'var(--cds-text-placeholder)', fontStyle: 'italic' }}>
                      No mappings configured. Save to load Frame OS defaults.
                    </td>
                  </tr>
                )}
                {mappings.map((m, idx) => (
                  <tr key={idx} style={{ borderBottom: '1px solid var(--cds-border-subtle-00)' }}>
                    <td style={{ padding: '0.5rem', fontFamily: 'IBM Plex Mono, monospace', fontSize: '0.8rem' }}>{m.hostname}</td>
                    <td style={{ padding: '0.5rem', fontFamily: 'IBM Plex Mono, monospace', fontSize: '0.8rem' }}>{m.githubRepo}</td>
                    <td style={{ padding: '0.5rem', fontFamily: 'IBM Plex Mono, monospace', fontSize: '0.8rem', color: 'var(--cds-text-secondary)' }}>{m.localPath || '—'}</td>
                    <td style={{ padding: '0.5rem', textAlign: 'center' }}>
                      <button
                        onClick={() => removeMapping(idx)}
                        style={{ background: 'none', border: 'none', color: 'var(--cds-text-error)', cursor: 'pointer', fontSize: '1rem', padding: '0.125rem 0.25rem' }}
                        title="Remove mapping"
                      >×</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr auto', gap: '0.5rem', alignItems: 'end' }}>
              <div className="cds-form-item" style={{ margin: 0 }}>
                <label className="cds-label" style={{ fontSize: '0.75rem' }}>Hostname</label>
                <input
                  type="text"
                  placeholder="cv.jim.software"
                  value={mappingEdit.hostname}
                  onChange={(e) => setMappingEdit({ ...mappingEdit, hostname: e.target.value })}
                  style={{ fontSize: '0.875rem' }}
                />
              </div>
              <div className="cds-form-item" style={{ margin: 0 }}>
                <label className="cds-label" style={{ fontSize: '0.75rem' }}>GitHub Repo</label>
                <input
                  type="text"
                  placeholder="owner/repo"
                  value={mappingEdit.githubRepo}
                  onChange={(e) => setMappingEdit({ ...mappingEdit, githubRepo: e.target.value })}
                  style={{ fontSize: '0.875rem' }}
                />
              </div>
              <div className="cds-form-item" style={{ margin: 0 }}>
                <label className="cds-label" style={{ fontSize: '0.75rem' }}>Local Path (optional)</label>
                <input
                  type="text"
                  placeholder="/Users/yuri/ojfbot/cv-builder"
                  value={mappingEdit.localPath}
                  onChange={(e) => setMappingEdit({ ...mappingEdit, localPath: e.target.value })}
                  style={{ fontSize: '0.875rem' }}
                />
              </div>
              <button onClick={addMapping} disabled={!mappingEdit.hostname || !mappingEdit.githubRepo}>
                Add
              </button>
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
