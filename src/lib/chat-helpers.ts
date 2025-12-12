/**
 * Helper functions for chat UI and progress messages
 */

import type { ConversationMessage } from '../types';

/**
 * Create a system progress message
 */
export function createProgressMessage(content: string, mcpActivity?: string): ConversationMessage {
  return {
    id: `progress-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    role: 'system',
    content,
    timestamp: Date.now(),
    metadata: {
      source: 'extension',
      mcpActivity,
    },
  };
}

/**
 * Create a streaming assistant message
 */
export function createStreamingMessage(content: string, source: 'mcp' | 'local' = 'local'): ConversationMessage {
  return {
    id: `streaming-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    role: 'assistant',
    content,
    timestamp: Date.now(),
    isStreaming: true,
    metadata: {
      source,
    },
  };
}

/**
 * Update streaming message with final content
 */
export function finalizeStreamingMessage(message: ConversationMessage, finalContent: string): ConversationMessage {
  return {
    ...message,
    content: finalContent,
    isStreaming: false,
  };
}

/**
 * Add MCP activity metadata to a message
 */
export function addMCPActivity(
  message: ConversationMessage,
  activity: string,
  toolCalls?: string[]
): ConversationMessage {
  return {
    ...message,
    metadata: {
      ...message.metadata,
      mcpActivity: activity,
      toolCalls,
    },
  };
}

/**
 * Common progress messages
 */
export const ProgressMessages = {
  CONNECTING_MCP: '🔌 Connecting to Claude Code via MCP...',
  MCP_CONNECTED: '✅ Connected to Claude Code',
  MCP_DISCONNECTED: '❌ Disconnected from MCP server',
  SENDING_CONTEXT: '📤 Sending element context to Claude Code...',
  CONTEXT_SENT: '✅ Context sent successfully',
  WAITING_FOR_RESPONSE: '⏳ Waiting for Claude Code response...',
  RECEIVING_MESSAGE: '📥 Receiving message from Claude Code...',
  ANALYZING_ELEMENT: '🔍 Analyzing element context...',
  CAPTURING_SCREENSHOTS: '📸 Capturing screenshots...',
  CALLING_AI: '🤖 Analyzing with AI...',
  AI_THINKING: '💭 AI is thinking...',
  GENERATING_SUGGESTIONS: '💡 Generating suggestions...',
};
