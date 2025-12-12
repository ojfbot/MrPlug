import React from 'react';
import { Tag } from '@carbon/react';

export interface MCPActivity {
  id: string;
  timestamp: number;
  type: 'websocket' | 'rest' | 'command' | 'state_sync' | 'session_update';
  direction: 'sent' | 'received';
  message: string;
  details?: any;
}

interface MCPDebugPanelProps {
  activities: MCPActivity[];
  isConnected: boolean;
  serverUrl?: string;
  wsUrl?: string;
}

export function MCPDebugPanel({ activities, isConnected, serverUrl, wsUrl }: MCPDebugPanelProps) {
  const [isExpanded, setIsExpanded] = React.useState(true);
  const [selectedActivity, setSelectedActivity] = React.useState<MCPActivity | null>(null);
  const scrollRef = React.useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new activities arrive
  React.useEffect(() => {
    if (scrollRef.current && isExpanded) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [activities.length, isExpanded]);

  const getActivityIcon = (activity: MCPActivity) => {
    switch (activity.type) {
      case 'websocket': return '🔌';
      case 'rest': return '🌐';
      case 'command': return '⚡';
      case 'state_sync': return '🔄';
      case 'session_update': return '💬';
      default: return '📡';
    }
  };

  const getActivityColor = (activity: MCPActivity) => {
    if (activity.direction === 'sent') return 'var(--cds-support-info)';
    return 'var(--cds-support-success)';
  };

  return (
    <div style={{
      marginBottom: '0.75rem',
      border: '1px solid var(--cds-border-subtle)',
      borderRadius: '4px',
      background: 'var(--cds-layer-01)',
    }}>
      {/* Header */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '0.5rem 0.75rem',
          borderBottom: isExpanded ? '1px solid var(--cds-border-subtle)' : 'none',
          cursor: 'pointer',
          background: 'var(--cds-layer-02)',
        }}
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span style={{ fontSize: '0.875rem', fontWeight: 600 }}>
            {isExpanded ? '▼' : '▶'} MCP Debug Monitor
          </span>

          {isConnected ? (
            <Tag type="green" size="sm">
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                <span className="connection-dot"></span>
                Connected
              </div>
            </Tag>
          ) : (
            <Tag type="red" size="sm">Disconnected</Tag>
          )}

          {activities.length > 0 && (
            <Tag type="outline" size="sm">{activities.length} events</Tag>
          )}
        </div>

        <div style={{ fontSize: '0.75rem', color: 'var(--cds-text-secondary)' }}>
          {serverUrl && <span title={serverUrl}>HTTP</span>}
          {serverUrl && wsUrl && <span style={{ margin: '0 0.25rem' }}>•</span>}
          {wsUrl && <span title={wsUrl}>WS</span>}
        </div>
      </div>

      {/* Activity Log */}
      {isExpanded && (
        <div
          ref={scrollRef}
          style={{
            maxHeight: '200px',
            overflowY: 'auto',
            padding: '0.5rem',
          }}
        >
          {activities.length === 0 ? (
            <div style={{
              padding: '1rem',
              textAlign: 'center',
              color: 'var(--cds-text-secondary)',
              fontSize: '0.875rem',
            }}>
              No MCP activity yet
            </div>
          ) : (
            activities.map((activity) => (
              <div
                key={activity.id}
                onClick={() => setSelectedActivity(selectedActivity?.id === activity.id ? null : activity)}
                style={{
                  padding: '0.5rem',
                  marginBottom: '0.25rem',
                  background: selectedActivity?.id === activity.id ? 'var(--cds-layer-accent-01)' : 'var(--cds-background)',
                  borderRadius: '2px',
                  cursor: 'pointer',
                  fontSize: '0.75rem',
                  borderLeft: `3px solid ${getActivityColor(activity)}`,
                  transition: 'background 0.1s',
                }}
              >
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: selectedActivity?.id === activity.id ? '0.25rem' : 0,
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span>{getActivityIcon(activity)}</span>
                    <span style={{ color: getActivityColor(activity), fontWeight: 600 }}>
                      {activity.direction === 'sent' ? '→' : '←'}
                    </span>
                    <span style={{ color: 'var(--cds-text-primary)' }}>
                      {activity.message}
                    </span>
                  </div>

                  <span style={{ color: 'var(--cds-text-secondary)', fontSize: '0.7rem' }}>
                    {new Date(activity.timestamp).toLocaleTimeString()}
                  </span>
                </div>

                {/* Expanded details */}
                {selectedActivity?.id === activity.id && activity.details && (
                  <pre style={{
                    marginTop: '0.5rem',
                    padding: '0.5rem',
                    background: 'var(--cds-layer-01)',
                    borderRadius: '2px',
                    fontSize: '0.7rem',
                    overflow: 'auto',
                    maxHeight: '150px',
                    fontFamily: 'IBM Plex Mono, monospace',
                  }}>
                    {JSON.stringify(activity.details, null, 2)}
                  </pre>
                )}
              </div>
            ))
          )}
        </div>
      )}

      <style>{`
        .connection-dot {
          width: 6px;
          height: 6px;
          background: var(--cds-support-success);
          border-radius: 50%;
          animation: pulse-green 2s ease-in-out infinite;
        }

        @keyframes pulse-green {
          0%, 100% { opacity: 0.6; box-shadow: 0 0 0 0 var(--cds-support-success); }
          50% { opacity: 1; box-shadow: 0 0 0 3px rgba(36, 161, 72, 0.4); }
        }
      `}</style>
    </div>
  );
}
