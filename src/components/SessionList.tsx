import { Tag } from '@carbon/react';
import type { SessionListItem } from '../types';

interface SessionListProps {
  sessions: SessionListItem[];
  onSessionSelect: (sessionId: string) => void;
  onNewSession: () => void;
}

export function SessionList({
  sessions,
  onSessionSelect,
  onNewSession,
}: SessionListProps) {
  const formatTimestamp = (timestamp: number) => {
    const now = Date.now();
    const diff = now - timestamp;
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days < 7) return `${days}d ago`;
    return new Date(timestamp).toLocaleDateString();
  };

  return (
    <div
      style={{
        width: '250px',
        height: '100%',
        borderRight: '1px solid var(--cds-border-subtle)',
        display: 'flex',
        flexDirection: 'column',
        background: 'var(--cds-layer-01)',
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: '1rem',
          borderBottom: '1px solid var(--cds-border-subtle)',
        }}
      >
        <button
          onClick={onNewSession}
          tabIndex={0}
          style={{
            width: '100%',
            padding: '0.5rem 1rem',
            background: 'var(--cds-interactive)',
            color: 'var(--cds-text-on-color)',
            border: 'none',
            borderRadius: '4px',
            fontSize: '0.875rem',
            fontWeight: 500,
            cursor: 'pointer',
            transition: 'all 0.11s',
          }}
          onFocus={(e) => {
            e.currentTarget.style.outline = '2px solid var(--cds-focus)';
            e.currentTarget.style.outlineOffset = '2px';
          }}
          onBlur={(e) => {
            e.currentTarget.style.outline = 'none';
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = 'var(--cds-interactive-hover)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'var(--cds-interactive)';
          }}
        >
          + New Session
        </button>
      </div>

      {/* Session List */}
      <div
        role="listbox"
        aria-label="Chat sessions"
        style={{
          flex: 1,
          overflowY: 'auto',
        }}
      >
        {sessions.length === 0 ? (
          <div
            style={{
              padding: '2rem 1rem',
              textAlign: 'center',
              color: 'var(--cds-text-secondary)',
              fontSize: '0.875rem',
            }}
          >
            No sessions yet
          </div>
        ) : (
          sessions.map((session) => (
            <button
              key={session.id}
              onClick={() => onSessionSelect(session.id)}
              tabIndex={0}
              role="option"
              aria-selected={session.isActive}
              style={{
                width: '100%',
                padding: '0.75rem 1rem',
                borderBottom: '1px solid var(--cds-border-subtle)',
                border: 'none',
                borderLeft: session.isActive ? '3px solid var(--cds-interactive)' : '3px solid transparent',
                cursor: 'pointer',
                background: session.isActive
                  ? 'var(--cds-layer-selected-01)'
                  : 'transparent',
                transition: 'all 0.11s',
                textAlign: 'left',
                outline: 'none',
              }}
              onMouseEnter={(e) => {
                if (!session.isActive) {
                  e.currentTarget.style.background = 'var(--cds-layer-hover-01)';
                }
              }}
              onMouseLeave={(e) => {
                if (!session.isActive) {
                  e.currentTarget.style.background = 'transparent';
                }
              }}
              onFocus={(e) => {
                e.currentTarget.style.outline = '2px solid var(--cds-focus)';
                e.currentTarget.style.outlineOffset = '-2px';
              }}
              onBlur={(e) => {
                e.currentTarget.style.outline = 'none';
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  onSessionSelect(session.id);
                }
              }}
            >
              {/* Session Title */}
              <div
                style={{
                  fontSize: '0.875rem',
                  fontWeight: session.isActive ? 600 : 400,
                  color: 'var(--cds-text-primary)',
                  marginBottom: '0.25rem',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {session.title}
              </div>

              {/* Summary */}
              {session.summary && (
                <div
                  style={{
                    fontSize: '0.75rem',
                    color: 'var(--cds-text-secondary)',
                    marginBottom: '0.5rem',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {session.summary}
                </div>
              )}

              {/* Metadata */}
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  fontSize: '0.625rem',
                  color: 'var(--cds-text-secondary)',
                }}
              >
                <span>{formatTimestamp(session.lastMessageAt)}</span>
                <span>
                  {session.messageCount} msg{session.messageCount !== 1 ? 's' : ''}
                </span>
              </div>

              {/* Active Indicator */}
              {session.isActive && (
                <Tag type="blue" size="sm" style={{ marginTop: '0.5rem' }}>
                  Active
                </Tag>
              )}
            </button>
          ))
        )}
      </div>
    </div>
  );
}
