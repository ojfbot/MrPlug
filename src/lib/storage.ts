import browser from 'webextension-polyfill';
import type { ExtensionConfig, ConversationMessage, FeedbackRequest, ChatSession, ElementContext } from '../types';

export class Storage {
  private static readonly KEYS = {
    CONFIG: 'mrplug_config',
    CONVERSATION: 'mrplug_conversation', // DEPRECATED - for migration
    FEEDBACK: 'mrplug_feedback',
    CHAT_SESSIONS: 'mrplug_chat_sessions',
    ACTIVE_SESSION: 'mrplug_active_session',
    SESSION_INDEX: 'mrplug_session_index',
  };

  static async getConfig(): Promise<ExtensionConfig> {
    const result = await browser.storage.local.get(this.KEYS.CONFIG);
    return (result[this.KEYS.CONFIG] as ExtensionConfig) || this.getDefaultConfig();
  }

  static async setConfig(config: Partial<ExtensionConfig>): Promise<void> {
    const currentConfig = await this.getConfig();
    const newConfig = { ...currentConfig, ...config };
    await browser.storage.local.set({ [this.KEYS.CONFIG]: newConfig });
  }

  static async getConversationHistory(): Promise<ConversationMessage[]> {
    const result = await browser.storage.local.get(this.KEYS.CONVERSATION);
    return (result[this.KEYS.CONVERSATION] as ConversationMessage[]) || [];
  }

  static async addConversationMessage(message: ConversationMessage): Promise<void> {
    const history = await this.getConversationHistory();
    history.push(message);

    // Keep only last 50 messages
    const trimmed = history.slice(-50);
    await browser.storage.local.set({ [this.KEYS.CONVERSATION]: trimmed });
  }

  static async clearConversationHistory(): Promise<void> {
    await browser.storage.local.set({ [this.KEYS.CONVERSATION]: [] });
  }

  static async saveFeedbackRequest(request: FeedbackRequest): Promise<void> {
    const result = await browser.storage.local.get(this.KEYS.FEEDBACK);
    const feedback: FeedbackRequest[] = (result[this.KEYS.FEEDBACK] as FeedbackRequest[]) || [];
    feedback.push(request);

    // Keep only last 20 requests
    const trimmed = feedback.slice(-20);
    await browser.storage.local.set({ [this.KEYS.FEEDBACK]: trimmed });
  }

  static async getRecentFeedback(): Promise<FeedbackRequest[]> {
    const result = await browser.storage.local.get(this.KEYS.FEEDBACK);
    return (result[this.KEYS.FEEDBACK] as FeedbackRequest[]) || [];
  }

  private static getDefaultConfig(): ExtensionConfig {
    return {
      claudeCodeEnabled: false,
      autoScreenshot: true,
      keyboardShortcut: 'Alt+Shift+Click',
    };
  }

  // ===== SESSION MANAGEMENT METHODS =====

  /**
   * Get all chat sessions (sorted by lastMessageAt desc)
   */
  static async getChatSessions(): Promise<ChatSession[]> {
    const result = await browser.storage.local.get(this.KEYS.CHAT_SESSIONS);
    const sessions = (result[this.KEYS.CHAT_SESSIONS] as ChatSession[]) || [];
    return sessions.sort((a, b) => b.lastMessageAt - a.lastMessageAt);
  }

  /**
   * Get session by ID
   */
  static async getSessionById(sessionId: string): Promise<ChatSession | null> {
    const sessions = await this.getChatSessions();
    return sessions.find((s) => s.id === sessionId) || null;
  }

  /**
   * Find session by element hash
   */
  static async findSessionByElementHash(elementHash: string): Promise<ChatSession | null> {
    const result = await browser.storage.local.get(this.KEYS.SESSION_INDEX);
    const index = (result[this.KEYS.SESSION_INDEX] as Record<string, string>) || {};

    const sessionId = index[elementHash];
    if (!sessionId) return null;

    return this.getSessionById(sessionId);
  }

  /**
   * Create new session
   */
  static async createSession(
    elementHash: string,
    title: string,
    elementContext: ElementContext
  ): Promise<ChatSession> {
    const sessions = await this.getChatSessions();

    const newSession: ChatSession = {
      id: this.generateUUID(),
      elementHash,
      title,
      summary: null,
      messages: [],
      elementContext,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      lastMessageAt: Date.now(),
      isActive: true,
      metadata: {
        pageUrl: typeof window !== 'undefined' ? window.location.href : 'unknown',
        messageCount: 0,
        hasAIAnalysis: false,
      },
    };

    // Deactivate all other sessions
    sessions.forEach((s) => (s.isActive = false));

    // Add new session
    sessions.push(newSession);

    // Apply session limit (keep most recent)
    const limit = 20; // Default limit
    const trimmed = sessions
      .sort((a, b) => b.lastMessageAt - a.lastMessageAt)
      .slice(0, limit);

    // Save sessions and update index
    await this.saveSessions(trimmed);
    await this.updateSessionIndex(elementHash, newSession.id);
    await this.setActiveSession(newSession.id);

    return newSession;
  }

  /**
   * Add message to session
   */
  static async addMessageToSession(
    sessionId: string,
    message: ConversationMessage
  ): Promise<void> {
    const sessions = await this.getChatSessions();
    const session = sessions.find((s) => s.id === sessionId);

    if (!session) {
      throw new Error(`Session not found: ${sessionId}`);
    }

    session.messages.push(message);
    session.lastMessageAt = Date.now();
    session.updatedAt = Date.now();
    if (session.metadata) {
      session.metadata.messageCount = session.messages.length;
    }

    // Keep only last 50 messages per session
    if (session.messages.length > 50) {
      session.messages = session.messages.slice(-50);
    }

    await this.saveSessions(sessions);
  }

  /**
   * Update session summary
   */
  static async updateSessionSummary(sessionId: string, summary: string): Promise<void> {
    const sessions = await this.getChatSessions();
    const session = sessions.find((s) => s.id === sessionId);

    if (!session) return;

    session.summary = summary;
    session.updatedAt = Date.now();

    await this.saveSessions(sessions);
  }

  /**
   * Set active session
   */
  static async setActiveSession(sessionId: string | null): Promise<void> {
    const sessions = await this.getChatSessions();

    sessions.forEach((s) => {
      s.isActive = s.id === sessionId;
    });

    await this.saveSessions(sessions);
    await browser.storage.local.set({ [this.KEYS.ACTIVE_SESSION]: sessionId });
  }

  /**
   * Get active session ID
   */
  static async getActiveSessionId(): Promise<string | null> {
    const result = await browser.storage.local.get(this.KEYS.ACTIVE_SESSION);
    return (result[this.KEYS.ACTIVE_SESSION] as string | undefined) || null;
  }

  /**
   * Delete session
   */
  static async deleteSession(sessionId: string): Promise<void> {
    let sessions = await this.getChatSessions();
    const session = sessions.find((s) => s.id === sessionId);

    if (!session) return;

    // Remove from sessions
    sessions = sessions.filter((s) => s.id !== sessionId);
    await this.saveSessions(sessions);

    // Remove from index
    const result = await browser.storage.local.get(this.KEYS.SESSION_INDEX);
    const index = (result[this.KEYS.SESSION_INDEX] as Record<string, string>) || {};
    delete index[session.elementHash];
    await browser.storage.local.set({ [this.KEYS.SESSION_INDEX]: index });

    // Clear active session if it was deleted
    const activeId = await this.getActiveSessionId();
    if (activeId === sessionId) {
      await this.setActiveSession(null);
    }
  }

  // ===== PRIVATE HELPERS =====

  private static async saveSessions(sessions: ChatSession[]): Promise<void> {
    await browser.storage.local.set({ [this.KEYS.CHAT_SESSIONS]: sessions });
  }

  private static async updateSessionIndex(
    elementHash: string,
    sessionId: string
  ): Promise<void> {
    const result = await browser.storage.local.get(this.KEYS.SESSION_INDEX);
    const index = (result[this.KEYS.SESSION_INDEX] as Record<string, string>) || {};
    index[elementHash] = sessionId;
    await browser.storage.local.set({ [this.KEYS.SESSION_INDEX]: index });
  }

  private static generateUUID(): string {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0;
      const v = c === 'x' ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  }

  // ===== MIGRATION METHOD =====

  /**
   * Migrate old single conversation to new session format
   */
  static async migrateToSessions(): Promise<void> {
    // Check if already migrated
    const sessions = await this.getChatSessions();
    if (sessions.length > 0) return;

    // Get old conversation
    const oldConversation = await this.getConversationHistory();
    if (oldConversation.length === 0) return;

    // Create a "legacy" session
    const legacySession: ChatSession = {
      id: this.generateUUID(),
      elementHash: 'legacy',
      title: 'Legacy Conversation (Migrated)',
      summary: 'Conversation from before multi-session support',
      messages: oldConversation,
      elementContext: {
        tagName: 'div',
        classList: [],
        computedStyles: {},
        boundingRect: { top: 0, left: 0, width: 0, height: 0 },
        domPath: 'legacy',
      },
      createdAt: oldConversation[0]?.timestamp || Date.now(),
      updatedAt: Date.now(),
      lastMessageAt:
        oldConversation[oldConversation.length - 1]?.timestamp || Date.now(),
      isActive: false,
      metadata: {
        pageUrl: 'unknown',
        messageCount: oldConversation.length,
        hasAIAnalysis: false,
      },
    };

    await this.saveSessions([legacySession]);

    // Clear old conversation
    await this.clearConversationHistory();

    console.log('[MrPlug] Migrated legacy conversation to sessions');
  }
}
