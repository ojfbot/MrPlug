import React, { useState, useEffect } from 'react';
import browser from 'webextension-polyfill';
import {
  Modal,
  TextArea,
  Loading,
  InlineNotification,
  Tag,
} from '@carbon/react';
import type { ElementContext, AIResponse, ConversationMessage, ClaudeCodePayload, ExtensionConfig, SessionListItem } from '../types';
import { ContextCapture } from '../lib/context-capture';
import { Storage } from '../lib/storage';
import { SessionList } from './SessionList';

interface FeedbackModalProps {
  isOpen: boolean;
  elementContext: ElementContext | null;
  selectedElement: Element | null;
  elementScreenshot: string | null;
  viewportScreenshot: string | null;
  onClose: () => void;
  onSubmit: (feedback: string, agentMode: 'ui' | 'ux') => Promise<AIResponse>;
  onNewSession: () => void;
}

export function FeedbackModal({
  isOpen,
  elementContext,
  selectedElement,
  elementScreenshot,
  viewportScreenshot,
  onClose,
  onSubmit,
  onNewSession,
}: FeedbackModalProps) {
  const [feedback, setFeedback] = useState('');
  const [loading, setLoading] = useState(false);
  const [response, setResponse] = useState<AIResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string>('AI analysis not available (API key not configured)');
  const [conversationHistory, setConversationHistory] = useState<ConversationMessage[]>([]);
  const [agentMode, setAgentMode] = useState<'ui' | 'ux'>('ui');
  const [hoveredMode, setHoveredMode] = useState<'ui' | 'ux' | null>(null);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [contextData, setContextData] = useState<ClaudeCodePayload | null>(null);
  const [viewingContext, setViewingContext] = useState<'dom' | 'redux' | 'console' | 'payload' | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<number[]>([]);
  const [currentSearchIndex, setCurrentSearchIndex] = useState(0);
  const scrollContainerRef = React.useRef<HTMLDivElement>(null);
  const currentMatchRef = React.useRef<HTMLSpanElement>(null);
  const textAreaRef = React.useRef<HTMLTextAreaElement>(null);
  const [config, setConfig] = useState<ExtensionConfig | null>(null);
  const [sessions, setSessions] = useState<SessionListItem[]>([]);
  const [claudeCodePending, setClaudeCodePending] = useState(false);

  // Helper to create simple status messages
  const createStatusMessage = (content: string): ConversationMessage => ({
    id: `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    role: 'system',
    content,
    timestamp: Date.now(),
  });

  const handleActionClick = async (action: AIResponse['suggestedActions'][0]) => {
    console.log('[MrPlug] Action clicked:', action);

    switch (action.type) {
      case 'github-issue':
        await handleGitHubIssue(action);
        break;

      case 'claude-code':
        await handleClaudeCode(action);
        break;

      case 'manual': {
        const errorMsg = createStatusMessage(
          `Manual action: ${action.title} — ${action.description}`
        );
        setConversationHistory((prev) => [...prev, errorMsg]);
        break;
      }

      default:
        console.warn('[MrPlug] Unknown action type:', action.type);
    }
  };

  const handleGitHubIssue = async (action: AIResponse['suggestedActions'][0]) => {
    if (!config?.githubToken) {
      const errorMsg = createStatusMessage(
        'GitHub token not configured. Open Settings to add your GitHub Personal Access Token.'
      );
      setConversationHistory((prev) => [...prev, errorMsg]);
      browser.runtime.sendMessage({ type: 'open-settings' }).catch(() => {});
      return;
    }

    try {
      const progressMsg = createStatusMessage('Creating GitHub issue...');
      setConversationHistory((prev) => [...prev, progressMsg]);

      // Build rich issue data from AI response
      const issueData = {
        title: response?.issueTitle || action.title,
        body: response?.issueDescription || action.description,
        labels: ['mrplug', `priority-${action.priority}`],
        acceptanceCriteria: response?.acceptanceCriteria,
        openQuestions: response?.openQuestions,
        elementContext: elementContext || undefined,
        pageUrl: window.location.href,
        elementScreenshot: elementScreenshot || undefined,
        viewportScreenshot: viewportScreenshot || undefined,
      };

      const result = await browser.runtime.sendMessage({
        type: 'create-github-issue',
        pageUrl: window.location.href,
        issueData,
      }) as { success: boolean; url?: string; number?: number; repo?: string; error?: string };

      if (result.success) {
        const successMsg = createStatusMessage(
          `GitHub issue #${result.number} created on ${result.repo}: ${result.url}`
        );
        setConversationHistory((prev) =>
          prev.filter((m) => m.id !== progressMsg.id).concat(successMsg)
        );
      } else {
        throw new Error(result.error || 'Unknown error');
      }
    } catch (error) {
      const errorMsg = createStatusMessage(
        `Failed to create issue: ${error instanceof Error ? error.message : String(error)}`
      );
      setConversationHistory((prev) => [...prev, errorMsg]);
    }
  };

  const handleClaudeCode = async (action: AIResponse['suggestedActions'][0]) => {
    try {
      const progressMsg = createStatusMessage('Sending to Claude Code...');
      setConversationHistory((prev) => [...prev, progressMsg]);

      const payload = {
        userComment: conversationHistory.filter((m) => m.role === 'user').slice(-1)[0]?.content || '',
        timestamp: Date.now(),
        pageUrl: window.location.href,
        elementContext,
        elementScreenshot,
        aiAnalysis: response
          ? {
              summary: response.analysis,
              suggestedActions: response.suggestedActions,
              confidence: response.confidence,
              acceptanceCriteria: response.acceptanceCriteria,
              openQuestions: response.openQuestions,
            }
          : undefined,
        action: {
          type: action.type,
          title: action.title,
          description: action.description,
          priority: action.priority,
        },
        conversationHistory,
      };

      const result = await browser.runtime.sendMessage({
        type: 'send-to-claude-code',
        payload,
      }) as { success: boolean; error?: string };

      if (result.success) {
        setClaudeCodePending(true);
        const successMsg = createStatusMessage(
          'Context queued in Claude Code relay — your next prompt will include this inspection.'
        );
        setConversationHistory((prev) =>
          prev.filter((m) => m.id !== progressMsg.id).concat(successMsg)
        );
      } else {
        throw new Error(result.error || 'Unknown error');
      }
    } catch (error) {
      const errorMsg = createStatusMessage(
        `Claude Code relay error: ${error instanceof Error ? error.message : String(error)}`
      );
      setConversationHistory((prev) => [...prev, errorMsg]);
    }
  };

  const handleClearClaudeCode = async () => {
    await browser.runtime.sendMessage({ type: 'clear-claude-code-context' }).catch(() => {});
    setClaudeCodePending(false);
  };

  useEffect(() => {
    if (!isOpen) {
      setFeedback('');
      setResponse(null);
      setError(null);
      setStatusMessage('AI analysis not available (API key not configured)');
      setPreviewImage(null);
      setViewingContext(null);
      setSearchQuery('');
      setSearchResults([]);
      setCurrentSearchIndex(0);
    }
  }, [isOpen]);

  // Load sessions and conversation history
  const loadSessions = React.useCallback(async () => {
    const allSessions = await Storage.getChatSessions();
    const sessionList: SessionListItem[] = allSessions.map((s) => ({
      id: s.id,
      title: s.title,
      summary: s.summary,
      lastMessageAt: s.lastMessageAt,
      messageCount: s.metadata?.messageCount || 0,
      isActive: s.isActive,
      elementHash: s.elementHash,
    }));
    setSessions(sessionList);

    const activeId = await Storage.getActiveSessionId();

    // Load conversation from active session
    if (activeId) {
      const activeSession = await Storage.getSessionById(activeId);
      if (activeSession) {
        setConversationHistory(activeSession.messages);
      }
    }
  }, []);

  // Load config when modal opens
  useEffect(() => {
    if (isOpen) {
      Storage.getConfig().then((cfg) => {
        setConfig(cfg);
      });
      loadSessions();
    }
  }, [isOpen]); // loadSessions is stable (empty deps), no need to include

  const handleSessionSelect = React.useCallback(async (sessionId: string) => {
    console.log('[MrPlug] Switching to session:', sessionId);

    // Optimized: Update UI immediately, then update storage
    setSessions(prev => prev.map(s => ({ ...s, isActive: s.id === sessionId })));

    try {
      // Load conversation for selected session
      const session = await Storage.getSessionById(sessionId);
      if (session) {
        console.log('[MrPlug] Loaded session with', session.messages.length, 'messages');
        console.log('[MrPlug] First message timestamp:', session.messages[0]?.timestamp);
        console.log('[MrPlug] Last message timestamp:', session.messages[session.messages.length - 1]?.timestamp);

        // Force React to re-render by creating new array reference
        setConversationHistory([...session.messages]);
      }

      // Update storage in background
      await Storage.setActiveSession(sessionId);
      console.log('[MrPlug] Session switch complete');
    } catch (err) {
      console.error('[MrPlug] Error switching sessions:', err);
    }
  }, []);

  const handleNewSessionClick = () => {
    // Trigger new session mode (activates feedback mode)
    onNewSession();
  };

  // Capture context data when modal opens with element
  // CRITICAL: Only run when modal opens or element changes, NOT on every message!
  useEffect(() => {
    if (isOpen && selectedElement) {
      const captureContext = async () => {
        try {
          // Get the current conversation at this moment
          const currentHistory = await Storage.getConversationHistory();
          const payload = await ContextCapture.captureCompleteContext(
            selectedElement,
            '',
            undefined,
            currentHistory
          );
          setContextData(payload);
          console.log('[MrPlug] Context captured for element');
        } catch (err) {
          console.warn('[MrPlug] Failed to capture context:', err);
        }
      };
      captureContext();
    }
  }, [isOpen, selectedElement]);

  // Handle ESC key to close preview first, then modal
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        setPreviewImage(null);
      }
    };

    if (previewImage && isOpen) {
      // Capture event before Modal can see it
      window.addEventListener('keydown', handleKeyDown, { capture: true });
      return () => {
        window.removeEventListener('keydown', handleKeyDown, { capture: true });
      };
    }
  }, [previewImage, isOpen]);

  // Handle Cmd+F / Ctrl+F for in-context search
  useEffect(() => {
    const handleSearchKeydown = (e: KeyboardEvent) => {
      // Cmd+F on Mac or Ctrl+F on Windows/Linux
      if ((e.metaKey || e.ctrlKey) && e.key === 'f' && viewingContext) {
        e.preventDefault();
        e.stopPropagation();
        // Focus will be handled by the search input when it appears
        const searchInput = document.querySelector('.context-search-input') as HTMLInputElement;
        if (searchInput) {
          searchInput.focus();
        }
      }
    };

    if (viewingContext && isOpen) {
      window.addEventListener('keydown', handleSearchKeydown, { capture: true });
      return () => {
        window.removeEventListener('keydown', handleSearchKeydown, { capture: true });
      };
    }
  }, [viewingContext, isOpen]);

  // Perform search when query changes
  useEffect(() => {
    if (!searchQuery || !viewingContext) {
      setSearchResults([]);
      setCurrentSearchIndex(0);
      return;
    }

    const getContextText = () => {
      if (viewingContext === 'dom') return JSON.stringify(contextData?.relevantDOM, null, 2);
      if (viewingContext === 'redux') return JSON.stringify(contextData?.reduxState, null, 2);
      if (viewingContext === 'console') return JSON.stringify(contextData?.consoleLogs, null, 2);
      if (viewingContext === 'payload') return JSON.stringify(contextData, null, 2);
      return '';
    };

    const text = getContextText().toLowerCase();
    const query = searchQuery.toLowerCase();
    const results: number[] = [];
    let index = 0;

    while (index !== -1) {
      index = text.indexOf(query, index);
      if (index !== -1) {
        results.push(index);
        index += query.length;
      }
    }

    setSearchResults(results);
    setCurrentSearchIndex(0);
  }, [searchQuery, viewingContext, contextData]);

  // Auto-focus scroll container when viewing context
  useEffect(() => {
    if (viewingContext && scrollContainerRef.current) {
      // Small delay to ensure DOM is ready
      setTimeout(() => {
        scrollContainerRef.current?.focus();
      }, 100);
    }
  }, [viewingContext]);

  // Auto-focus TextArea when modal opens or when returning from context viewer
  useEffect(() => {
    if (isOpen && !viewingContext && !loading) {
      // Small delay to ensure modal is fully rendered
      setTimeout(() => {
        // Carbon TextArea ref points to wrapper, need to find actual textarea
        const textarea = textAreaRef.current?.querySelector('textarea') as HTMLTextAreaElement;
        if (textarea) {
          textarea.focus();
        }
        // Silently ignore if textarea not ready yet
      }, 150);
    }
  }, [isOpen, viewingContext, loading]);

  // Scroll to current match when search index changes
  useEffect(() => {
    if (currentMatchRef.current && searchResults.length > 0) {
      currentMatchRef.current.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
      });
    }
  }, [currentSearchIndex, searchResults]);

  const handleSubmit = async () => {
    if (!feedback.trim()) return;

    setLoading(true);
    setError(null);
    setStatusMessage('Analyzing feedback...');

    try {
      const aiResponse = await onSubmit(feedback, agentMode);
      setResponse(aiResponse);

      const userMessage: ConversationMessage = {
        id: Storage.generateUUID(),
        role: 'user',
        content: feedback,
        timestamp: Date.now(),
      };

      const assistantMessage: ConversationMessage = {
        id: Storage.generateUUID(),
        role: 'assistant',
        content: aiResponse.analysis,
        timestamp: Date.now(),
      };

      setConversationHistory([...conversationHistory, userMessage, assistantMessage]);
      setFeedback('');

      if (aiResponse.confidence > 0) {
        setStatusMessage(`Analysis complete (${Math.round(aiResponse.confidence * 100)}% confidence)`);
      } else {
        setStatusMessage('Context captured successfully');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
      setStatusMessage('Analysis failed');
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Submit on Enter (without shift)
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
    // Allow Shift+Enter for new line (default behavior)
  };


  const getActionIcon = (type: string) => {
    switch (type) {
      case 'github-issue': return '📋';
      case 'claude-code': return '🤖';
      case 'manual': return '✋';
      default: return '•';
    }
  };

  const getActionColor = (priority: string) => {
    switch (priority) {
      case 'high': return '#da1e28';
      case 'medium': return '#f1c21b';
      case 'low': return '#24a148';
      default: return '#4589ff';
    }
  };

  const getThumbnailHeight = () => {
    if (!elementContext) return 60;
    // Two lines of text ~ 60px, scale element screenshot to fit
    return Math.min(elementContext.boundingRect.height, 60);
  };

  if (!isOpen) return null;

  return (
    <>
    <Modal
      open={isOpen}
      onRequestClose={onClose}
      modalHeading={elementContext ? `<${elementContext.tagName.toLowerCase()}>${elementContext.id ? `#${elementContext.id}` : ''}` : 'MrPlug'}
      primaryButtonText="Send"
      secondaryButtonText="Close"
      onRequestSubmit={handleSubmit}
      primaryButtonDisabled={!feedback.trim() || loading}
      size="lg"
    >
      <div style={{ display: 'flex', height: '700px', minHeight: '700px' }}>
        {/* Session List Sidebar */}
        <SessionList
          sessions={sessions}
          onSessionSelect={handleSessionSelect}
          onNewSession={handleNewSessionClick}
        />

        {/* Main Chat Area */}
        <div style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          padding: '0 1rem',
        }}>

        {/* Claude Code pending context banner */}
        {claudeCodePending && (
          <div style={{
            marginBottom: '0.5rem',
            padding: '0.375rem 0.75rem',
            background: 'var(--cds-support-info-inverse, #0043ce)',
            borderRadius: '4px',
            fontSize: '0.75rem',
            color: 'var(--cds-text-inverse, #fff)',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
          }}>
            <span style={{ flex: 1 }}>
              ⬆ Context queued — will inject into your next Claude Code prompt
            </span>
            <button
              onClick={handleClearClaudeCode}
              style={{
                background: 'rgba(255,255,255,0.15)',
                border: 'none',
                borderRadius: '2px',
                color: 'inherit',
                cursor: 'pointer',
                fontSize: '0.7rem',
                padding: '2px 6px',
                whiteSpace: 'nowrap',
              }}
            >
              Clear
            </button>
          </div>
        )}

        {/* Status Bar with Connection Links */}
        <div style={{
          marginBottom: '0.75rem',
          padding: '0.5rem 0.75rem',
          background: 'var(--cds-layer-accent-01)',
          borderRadius: '4px',
          fontSize: '0.75rem',
          color: 'var(--cds-text-secondary)',
          minHeight: '32px',
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem',
        }}>
          {loading && (
            <div style={{ marginRight: '0.25rem' }}>
              <Loading description="" withOverlay={false} small />
            </div>
          )}

          {/* Connection Status */}
          {config ? (
            <>
              {config.llmProvider && (config.openaiApiKey || config.anthropicApiKey) ? (
                <span>{config.llmProvider === 'openai' ? 'OpenAI' : 'Claude'}</span>
              ) : (
                <span style={{ color: 'var(--cds-text-error)' }}>AI not configured</span>
              )}

              {config.githubToken && config.githubRepo && (
                <>
                  <span>;</span>
                  <span>GitHub: {config.githubRepo.split('/').pop()}</span>
                </>
              )}

              {config.claudeCodeEnabled && (
                <>
                  <span>;</span>
                  <span>Claude Code</span>
                </>
              )}

              {loading && <span style={{ marginLeft: '0.25rem' }}>— {statusMessage}</span>}
            </>
          ) : (
            <span>{statusMessage}</span>
          )}
        </div>

        {error && (
          <InlineNotification
            kind="error"
            title="Error"
            subtitle={error}
            onCloseButtonClick={() => setError(null)}
            style={{ marginBottom: '0.75rem' }}
          />
        )}

        {/* Conversation History / Context Viewer - Fixed Height */}
        <div
          style={{
            marginBottom: '0.75rem',
            height: '300px',
            background: 'var(--cds-layer-01)',
            border: '1px solid var(--cds-border-subtle)',
            borderRadius: '4px',
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          {viewingContext ? (
            // Context Data Viewer
            <>
              {/* Sticky Search Header */}
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                gap: '0.5rem',
                padding: '0.75rem',
                paddingBottom: '0.5rem',
                borderBottom: '1px solid var(--cds-border-subtle)',
                background: 'var(--cds-layer-01)',
                position: 'sticky',
                top: 0,
                zIndex: 1,
              }}>
                <Tag type="purple" size="sm">
                  {viewingContext === 'dom' ? 'DOM Context' :
                   viewingContext === 'redux' ? 'Redux State' :
                   viewingContext === 'console' ? 'Console Logs' : 'Full Payload'}
                </Tag>
                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flex: 1 }}>
                  <input
                    type="text"
                    className="context-search-input"
                    placeholder="Search (Cmd+F)..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    style={{
                      flex: 1,
                      padding: '0.25rem 0.5rem',
                      fontSize: '0.75rem',
                      border: '1px solid var(--cds-border-subtle)',
                      borderRadius: '2px',
                      background: 'var(--cds-field-01)',
                      color: 'var(--cds-text-primary)',
                    }}
                  />
                  {searchResults.length > 0 && (
                    <div style={{ display: 'flex', gap: '0.25rem', alignItems: 'center' }}>
                      <span style={{ fontSize: '0.75rem', color: 'var(--cds-text-secondary)', whiteSpace: 'nowrap' }}>
                        {currentSearchIndex + 1} / {searchResults.length}
                      </span>
                      <button
                        onClick={() => setCurrentSearchIndex((currentSearchIndex - 1 + searchResults.length) % searchResults.length)}
                        style={{
                          padding: '0.125rem 0.25rem',
                          fontSize: '0.75rem',
                          border: '1px solid var(--cds-border-subtle)',
                          borderRadius: '2px',
                          background: 'var(--cds-layer-01)',
                          color: 'var(--cds-text-primary)',
                          cursor: 'pointer',
                        }}
                      >
                        ↑
                      </button>
                      <button
                        onClick={() => setCurrentSearchIndex((currentSearchIndex + 1) % searchResults.length)}
                        style={{
                          padding: '0.125rem 0.25rem',
                          fontSize: '0.75rem',
                          border: '1px solid var(--cds-border-subtle)',
                          borderRadius: '2px',
                          background: 'var(--cds-layer-01)',
                          color: 'var(--cds-text-primary)',
                          cursor: 'pointer',
                        }}
                      >
                        ↓
                      </button>
                    </div>
                  )}
                </div>
                <button
                  onClick={() => {
                    setViewingContext(null);
                    setSearchQuery('');
                  }}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: 'var(--cds-text-secondary)',
                    cursor: 'pointer',
                    fontSize: '0.75rem',
                    whiteSpace: 'nowrap',
                  }}
                >
                  Back to conversation
                </button>
              </div>

              {/* Scrollable Content Area */}
              <div
                ref={scrollContainerRef}
                tabIndex={0}
                style={{
                  flex: 1,
                  overflowY: 'auto',
                  padding: '0.75rem',
                  outline: 'none',
                }}
              >
                <pre style={{
                  fontSize: '0.75rem',
                  fontFamily: 'IBM Plex Mono, monospace',
                  color: 'var(--cds-text-primary)',
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-word',
                  margin: 0,
                }}>
                {(() => {
                  const text = viewingContext === 'dom' ? JSON.stringify(contextData?.relevantDOM, null, 2) :
                               viewingContext === 'redux' ? JSON.stringify(contextData?.reduxState, null, 2) :
                               viewingContext === 'console' ? JSON.stringify(contextData?.consoleLogs, null, 2) :
                               JSON.stringify(contextData, null, 2);

                  if (!searchQuery || searchResults.length === 0) {
                    return text;
                  }

                  // Highlight search results
                  const parts: (string | JSX.Element)[] = [];
                  let lastIndex = 0;

                  searchResults.forEach((resultIndex, idx) => {
                    // Add text before match
                    if (resultIndex > lastIndex) {
                      parts.push(text.substring(lastIndex, resultIndex));
                    }

                    // Add highlighted match
                    const isCurrentMatch = idx === currentSearchIndex;
                    parts.push(
                      <span
                        key={`match-${resultIndex}-${idx}`}
                        ref={isCurrentMatch ? currentMatchRef : null}
                        style={{
                          background: isCurrentMatch ? '#ffa500' : '#ffff00',
                          color: '#000',
                          fontWeight: isCurrentMatch ? 'bold' : 'normal',
                        }}
                      >
                        {text.substring(resultIndex, resultIndex + searchQuery.length)}
                      </span>
                    );

                    lastIndex = resultIndex + searchQuery.length;
                  });

                  // Add remaining text
                  if (lastIndex < text.length) {
                    parts.push(text.substring(lastIndex));
                  }

                  return parts;
                })()}
                </pre>
              </div>
            </>
          ) : (
            // Conversation History
            <div style={{
              flex: 1,
              overflowY: 'auto',
              padding: '0.75rem',
            }}>
              {conversationHistory.length === 0 ? (
                <div style={{
                  height: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'var(--cds-text-placeholder)',
                  fontSize: '0.875rem',
                }}>
                  No conversation history yet
                </div>
              ) : (
                conversationHistory.map((msg) => (
                  <div
                    key={msg.id}
                    style={{
                      marginBottom: '0.75rem',
                      padding: '0.75rem',
                      background: msg.role === 'user' ? 'var(--cds-layer-02)' : 'var(--cds-layer-01)',
                      borderRadius: '4px',
                      border: '1px solid var(--cds-border-subtle)',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                      <Tag
                        type={msg.role === 'user' ? 'blue' : msg.role === 'assistant' ? 'green' : 'gray'}
                        size="sm"
                      >
                        {msg.role === 'system' ? 'status' : msg.role}
                      </Tag>
                      <span style={{ fontSize: '0.75rem', color: 'var(--cds-text-secondary)' }}>
                        {new Date(msg.timestamp).toLocaleTimeString()}
                      </span>
                    </div>
                    <div style={{
                      whiteSpace: 'pre-wrap',
                      wordBreak: 'break-word',
                      fontSize: '0.875rem',
                      color: 'var(--cds-text-primary)',
                    }}>
                      {msg.content}
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>

        {/* Agent Mode Toggle */}
        <div style={{
          marginBottom: '0.75rem',
          display: 'flex',
          gap: '0.5rem',
          alignItems: 'center',
          position: 'relative',
        }}>
          <span style={{ fontSize: '0.875rem', fontWeight: 400, color: 'var(--cds-text-secondary)' }}>
            Agent Mode:
          </span>
          <div style={{ display: 'flex', gap: '0.25rem', padding: '2px', background: 'var(--cds-layer-01)', borderRadius: '4px' }}>
            <button
              onClick={() => setAgentMode('ui')}
              onMouseEnter={() => setHoveredMode('ui')}
              onMouseLeave={() => setHoveredMode(null)}
              style={{
                padding: '0.375rem 0.75rem',
                fontSize: '0.875rem',
                fontWeight: 500,
                border: 'none',
                borderRadius: '2px',
                cursor: 'pointer',
                background: agentMode === 'ui' ? 'var(--cds-interactive)' : 'transparent',
                color: agentMode === 'ui' ? 'var(--cds-text-on-color)' : 'var(--cds-text-primary)',
                transition: 'all 0.11s',
              }}
            >
              UI Expert
            </button>
            <button
              onClick={() => setAgentMode('ux')}
              onMouseEnter={() => setHoveredMode('ux')}
              onMouseLeave={() => setHoveredMode(null)}
              style={{
                padding: '0.375rem 0.75rem',
                fontSize: '0.875rem',
                fontWeight: 500,
                border: 'none',
                borderRadius: '2px',
                cursor: 'pointer',
                background: agentMode === 'ux' ? 'var(--cds-interactive)' : 'transparent',
                color: agentMode === 'ux' ? 'var(--cds-text-on-color)' : 'var(--cds-text-primary)',
                transition: 'all 0.11s',
              }}
            >
              UX Expert
            </button>
          </div>
          {/* Popover on hover */}
          {hoveredMode && (
            <div style={{
              position: 'absolute',
              top: '100%',
              left: 0,
              marginTop: '0.5rem',
              padding: '0.75rem',
              background: 'var(--cds-background)',
              border: '1px solid var(--cds-border-subtle)',
              borderRadius: '4px',
              fontSize: '0.75rem',
              color: 'var(--cds-text-primary)',
              maxWidth: '300px',
              zIndex: 9999,
              boxShadow: '0 2px 6px rgba(0, 0, 0, 0.3)',
            }}>
              {hoveredMode === 'ui' ? (
                <>
                  <strong>UI Expert Mode:</strong> Focus on specific styling, layout, colors, spacing, and browser flow.
                  Perfect for visual refinements and CSS/styling issues.
                </>
              ) : (
                <>
                  <strong>UX Expert Mode:</strong> Focus on product requirements, user workflows, feature stories, and implementation planning.
                  Perfect for new features, product improvements, and complex user journeys.
                </>
              )}
            </div>
          )}
        </div>

        {/* Text Input */}
        <div style={{ position: 'relative', marginBottom: '0.75rem' }}>
          <TextArea
            ref={textAreaRef}
            labelText={agentMode === 'ui' ? 'Describe the UI issue or desired change' : 'Describe the feature or user experience goal'}
            placeholder={
              agentMode === 'ui'
                ? "e.g., 'This button should be larger', 'The spacing is too tight', 'Change the color to match the brand'"
                : "e.g., 'This menu should allow users to launch new apps via natural language', 'Add a workflow for users to create custom dashboards', 'Implement a feature to save user preferences'"
            }
            value={feedback}
            onChange={(e) => setFeedback(e.target.value)}
            onKeyDown={handleKeyDown}
            rows={4}
            disabled={loading}
          />
        </div>

        {/* Row: Badge Buttons (Left) and Screenshots (Right) */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          gap: '1rem',
          minHeight: '32px',
          marginBottom: '0.5rem',
        }}>
          {/* Left: Badge Buttons */}
          <div style={{
            display: 'flex',
            gap: '0.5rem',
            flexWrap: 'wrap',
            alignItems: 'center',
            flex: 1,
          }}>
            {response?.suggestedActions && response.suggestedActions.length > 0 ? (
              response.suggestedActions.map((action, idx) => (
                <button
                  key={`${action.type}-${action.title}-${idx}`}
                  onClick={() => handleActionClick(action)}
                  title={`${action.description}\n\nClick to ${action.type === 'github-issue' ? 'create issue' : action.type === 'claude-code' ? 'send to Claude Code' : 'view details'}`}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.25rem',
                    padding: '0.25rem 0.75rem',
                    borderRadius: '12px',
                    fontSize: '0.75rem',
                    fontWeight: 500,
                    background: getActionColor(action.priority),
                    color: '#ffffff',
                    boxShadow: '0 1px 3px rgba(0, 0, 0, 0.3)',
                    border: 'none',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.transform = 'translateY(-2px)';
                    e.currentTarget.style.boxShadow = '0 3px 6px rgba(0, 0, 0, 0.4)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = 'translateY(0)';
                    e.currentTarget.style.boxShadow = '0 1px 3px rgba(0, 0, 0, 0.3)';
                  }}
                >
                  <span>{getActionIcon(action.type)}</span>
                  <span>{action.title}</span>
                </button>
              ))
            ) : (
              <div style={{ height: '32px' }} />
            )}
          </div>

          {/* Right: Screenshot Thumbnails and Context Data Badges */}
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            {/* Context Data Badges */}
            {contextData?.relevantDOM && (
              <button
                title="DOM Context"
                onClick={() => setViewingContext(viewingContext === 'dom' ? null : 'dom')}
                style={{
                  padding: '0.375rem 0.5rem',
                  fontSize: '0.875rem',
                  border: '1px solid var(--cds-border-subtle)',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  background: viewingContext === 'dom' ? 'var(--cds-interactive)' : 'var(--cds-layer-01)',
                  color: viewingContext === 'dom' ? 'var(--cds-text-on-color)' : 'var(--cds-text-primary)',
                  transition: 'all 0.11s',
                }}
              >
                📄 DOM
              </button>
            )}
            {contextData?.reduxState?.available && (
              <button
                title="Redux State"
                onClick={() => setViewingContext(viewingContext === 'redux' ? null : 'redux')}
                style={{
                  padding: '0.375rem 0.5rem',
                  fontSize: '0.875rem',
                  border: '1px solid var(--cds-border-subtle)',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  background: viewingContext === 'redux' ? 'var(--cds-interactive)' : 'var(--cds-layer-01)',
                  color: viewingContext === 'redux' ? 'var(--cds-text-on-color)' : 'var(--cds-text-primary)',
                  transition: 'all 0.11s',
                }}
              >
                🗄️ Redux
              </button>
            )}
            {contextData?.consoleLogs && (
              <button
                title="Console Logs"
                onClick={() => setViewingContext(viewingContext === 'console' ? null : 'console')}
                style={{
                  padding: '0.375rem 0.5rem',
                  fontSize: '0.875rem',
                  border: '1px solid var(--cds-border-subtle)',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  background: viewingContext === 'console' ? 'var(--cds-interactive)' : 'var(--cds-layer-01)',
                  color: viewingContext === 'console' ? 'var(--cds-text-on-color)' : 'var(--cds-text-primary)',
                  transition: 'all 0.11s',
                }}
              >
                📋 Console
              </button>
            )}
            {contextData && (
              <button
                title="Full Payload"
                onClick={() => setViewingContext(viewingContext === 'payload' ? null : 'payload')}
                style={{
                  padding: '0.375rem 0.5rem',
                  fontSize: '0.875rem',
                  border: '1px solid var(--cds-border-subtle)',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  background: viewingContext === 'payload' ? 'var(--cds-interactive)' : 'var(--cds-layer-01)',
                  color: viewingContext === 'payload' ? 'var(--cds-text-on-color)' : 'var(--cds-text-primary)',
                  transition: 'all 0.11s',
                }}
              >
                📦 Payload
              </button>
            )}

            {/* Screenshot Thumbnails */}
            {elementScreenshot && (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.25rem' }}>
                <img
                  src={elementScreenshot}
                  alt="Element screenshot"
                  onClick={() => setPreviewImage(elementScreenshot)}
                  style={{
                    height: `${getThumbnailHeight()}px`,
                    width: 'auto',
                    maxWidth: '100px',
                    border: '1px solid var(--cds-border-subtle)',
                    borderRadius: '2px',
                    objectFit: 'contain',
                    cursor: 'pointer',
                  }}
                />
                <span style={{ fontSize: '0.625rem', color: 'var(--cds-text-secondary)' }}>Element</span>
              </div>
            )}
            {viewportScreenshot && (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.25rem' }}>
                <img
                  src={viewportScreenshot}
                  alt="Viewport screenshot"
                  onClick={() => setPreviewImage(viewportScreenshot)}
                  style={{
                    height: '60px',
                    width: 'auto',
                    maxWidth: '100px',
                    border: '1px solid var(--cds-border-subtle)',
                    borderRadius: '2px',
                    objectFit: 'contain',
                    cursor: 'pointer',
                  }}
                />
                <span style={{ fontSize: '0.625rem', color: 'var(--cds-text-secondary)' }}>Viewport</span>
              </div>
            )}
          </div>
        </div>
        </div> {/* End Main Chat Area */}
      </div> {/* End flex container */}
    </Modal>

    {/* Image Preview Modal */}
    {previewImage && (
      <div
        onClick={() => setPreviewImage(null)}
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.9)',
          zIndex: 1000001,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          padding: '2rem',
        }}
      >
        <img
          src={previewImage}
          alt="Screenshot preview"
          style={{
            maxWidth: '90%',
            maxHeight: '90%',
            objectFit: 'contain',
            border: '2px solid var(--cds-border-subtle)',
            borderRadius: '4px',
          }}
        />
      </div>
    )}
  </>
  );
}
