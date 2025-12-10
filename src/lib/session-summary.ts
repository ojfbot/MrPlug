/**
 * Session summary generation with AI and fallback strategies
 */

import type { ChatSession } from '../types';
import type { AIAgent } from './ai-agent';
import { Storage } from './storage';

export class SessionSummary {
  /**
   * Generate AI summary for a session
   */
  static async generateSummary(
    session: ChatSession,
    _aiAgent: AIAgent | null
  ): Promise<string> {
    // Always use fallback for now (AI summary can be added later)
    return this.generateFallbackSummary(session);
  }

  /**
   * Generate fallback summary (no AI)
   */
  private static generateFallbackSummary(session: ChatSession): string {
    const userMessages = session.messages.filter((m) => m.role === 'user');

    if (userMessages.length === 0) {
      return 'No messages yet';
    }

    // Use first user message as summary
    const firstUserMsg = userMessages[0].content;
    const maxLength = 60;

    if (firstUserMsg.length > maxLength) {
      return `${firstUserMsg.substring(0, maxLength)}...`;
    }

    return firstUserMsg;
  }

  /**
   * Check if session should trigger summary generation
   */
  static shouldGenerateSummary(session: ChatSession, threshold: number = 3): boolean {
    // Generate summary if:
    // 1. Session has no summary
    // 2. Session has at least threshold messages
    if (session.summary !== null) return false;
    if (session.messages.length < threshold) return false;

    return true;
  }

  /**
   * Auto-generate summary if needed
   */
  static async autoGenerateSummary(
    sessionId: string,
    aiAgent: AIAgent | null
  ): Promise<void> {
    const session = await Storage.getSessionById(sessionId);
    if (!session) return;

    const threshold = 3;
    if (!this.shouldGenerateSummary(session, threshold)) return;

    const summary = await this.generateSummary(session, aiAgent);
    await Storage.updateSessionSummary(sessionId, summary);
  }
}
