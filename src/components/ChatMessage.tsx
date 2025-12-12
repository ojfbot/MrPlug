import React from 'react';
import { Tag } from '@carbon/react';
import type { ConversationMessage } from '../types';

interface ChatMessageProps {
  message: ConversationMessage;
  isStreaming?: boolean;
  debugInfo?: {
    source?: 'mcp' | 'local' | 'extension';
    mcpActivity?: string;
    toolCalls?: string[];
  };
}

export function ChatMessage({ message, isStreaming = false, debugInfo }: ChatMessageProps) {
  const [showDebug, setShowDebug] = React.useState(false);

  return (
    <div
      style={{
        marginBottom: '0.75rem',
        padding: '0.75rem',
        background: message.role === 'user' ? 'var(--cds-layer-02)' : 'var(--cds-layer-01)',
        borderRadius: '4px',
        border: '1px solid var(--cds-border-subtle)',
      }}
    >
      {/* Header with role tag and timestamp */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '0.5rem',
      }}>
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          <Tag
            type={message.role === 'user' ? 'blue' : message.role === 'assistant' ? 'green' : 'gray'}
            size="sm"
          >
            {message.role === 'system' ? 'status' : message.role}
          </Tag>

          {/* Source indicator */}
          {debugInfo?.source && (
            <Tag type="outline" size="sm">
              {debugInfo.source === 'mcp' ? '🔌 MCP' :
               debugInfo.source === 'local' ? '🏠 Local' :
               '🧩 Extension'}
            </Tag>
          )}

          {/* Streaming indicator */}
          {isStreaming && (
            <Tag type="outline" size="sm">
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                <span className="streaming-dot"></span>
                streaming...
              </div>
            </Tag>
          )}
        </div>

        {/* Timestamp and debug toggle */}
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          <span style={{
            fontSize: '0.75rem',
            color: 'var(--cds-text-secondary)',
          }}>
            {new Date(message.timestamp).toLocaleTimeString()}
          </span>

          {debugInfo && (
            <button
              onClick={() => setShowDebug(!showDebug)}
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--cds-text-secondary)',
                cursor: 'pointer',
                fontSize: '0.75rem',
                padding: '0.125rem 0.25rem',
                borderRadius: '2px',
              }}
              title="Toggle debug info"
            >
              🐛
            </button>
          )}
        </div>
      </div>

      {/* Message content */}
      <div style={{
        fontSize: '0.875rem',
        color: 'var(--cds-text-primary)',
        lineHeight: '1.5',
        whiteSpace: 'pre-wrap',
        wordBreak: 'break-word',
      }}>
        {message.content}
        {isStreaming && <span className="cursor-blink">▊</span>}
      </div>

      {/* Debug info panel (collapsible) */}
      {showDebug && debugInfo && (
        <div style={{
          marginTop: '0.75rem',
          padding: '0.5rem',
          background: 'var(--cds-background)',
          border: '1px solid var(--cds-border-subtle)',
          borderRadius: '2px',
          fontSize: '0.75rem',
          fontFamily: 'IBM Plex Mono, monospace',
        }}>
          <div style={{
            fontWeight: 600,
            marginBottom: '0.25rem',
            color: 'var(--cds-text-secondary)',
          }}>
            Debug Information
          </div>

          {debugInfo.mcpActivity && (
            <div style={{ marginBottom: '0.25rem' }}>
              <span style={{ color: 'var(--cds-support-info)' }}>MCP Activity:</span>{' '}
              {debugInfo.mcpActivity}
            </div>
          )}

          {debugInfo.toolCalls && debugInfo.toolCalls.length > 0 && (
            <div>
              <span style={{ color: 'var(--cds-support-info)' }}>Tool Calls:</span>
              <ul style={{ marginLeft: '1rem', marginTop: '0.25rem' }}>
                {debugInfo.toolCalls.map((tool, idx) => (
                  <li key={idx} style={{ color: 'var(--cds-text-primary)' }}>
                    {tool}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {message.id && (
            <div style={{
              marginTop: '0.5rem',
              paddingTop: '0.5rem',
              borderTop: '1px solid var(--cds-border-subtle)',
              color: 'var(--cds-text-secondary)',
            }}>
              Message ID: {message.id}
            </div>
          )}
        </div>
      )}

      <style>{`
        .streaming-dot {
          width: 6px;
          height: 6px;
          background: var(--cds-support-success);
          border-radius: 50%;
          animation: pulse 1.5s ease-in-out infinite;
        }

        .cursor-blink {
          animation: blink 1s step-start infinite;
          margin-left: 2px;
        }

        @keyframes pulse {
          0%, 100% { opacity: 0.4; }
          50% { opacity: 1; }
        }

        @keyframes blink {
          0%, 50% { opacity: 1; }
          51%, 100% { opacity: 0; }
        }
      `}</style>
    </div>
  );
}
