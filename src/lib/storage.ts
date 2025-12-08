import browser from 'webextension-polyfill';
import type { ExtensionConfig, ConversationMessage, FeedbackRequest } from '../types';

export class Storage {
  private static readonly KEYS = {
    CONFIG: 'mrplug_config',
    CONVERSATION: 'mrplug_conversation',
    FEEDBACK: 'mrplug_feedback',
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
}
