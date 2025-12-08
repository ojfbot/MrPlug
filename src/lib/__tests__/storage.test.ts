import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Storage } from '../storage';
import type { ConversationMessage, ExtensionConfig } from '../../types';

describe('Storage', () => {
  let mockStorage: Record<string, any>;

  beforeEach(() => {
    mockStorage = {};

    // Mock browser storage API
    const mockBrowser = (global as any).browser;
    vi.spyOn(mockBrowser.storage.local, 'get').mockImplementation(
      async (...args: any[]) => {
        const keys = args[0];
        const key = typeof keys === 'string' ? keys : keys[0];
        return { [key]: mockStorage[key] };
      }
    );

    vi.spyOn(mockBrowser.storage.local, 'set').mockImplementation(
      async (...args: any[]) => {
        const items = args[0];
        Object.assign(mockStorage, items);
      }
    );
  });

  describe('User Behavior: Managing configuration', () => {
    it('should provide default configuration when user first installs extension', async () => {
      // User action: first time opening extension
      const config = await Storage.getConfig();

      // Expected result: default config is provided
      expect(config).toBeDefined();
      expect(config.claudeCodeEnabled).toBe(false);
      expect(config.autoScreenshot).toBe(true);
      expect(config.keyboardShortcut).toBe('Alt+Shift+Click');
    });

    it('should save user configuration preferences', async () => {
      // User action: updates configuration
      const newConfig: Partial<ExtensionConfig> = {
        openaiApiKey: 'sk-test-key',
        githubToken: 'ghp-test-token',
        claudeCodeEnabled: true,
      };

      await Storage.setConfig(newConfig);

      // Expected result: configuration is saved
      const savedConfig = await Storage.getConfig();
      expect(savedConfig.openaiApiKey).toBe('sk-test-key');
      expect(savedConfig.githubToken).toBe('ghp-test-token');
      expect(savedConfig.claudeCodeEnabled).toBe(true);
    });

    it('should merge new config with existing config', async () => {
      // User action: updates only one field
      await Storage.setConfig({ openaiApiKey: 'sk-key-1' });
      await Storage.setConfig({ githubToken: 'ghp-token-1' });

      // Expected result: both fields are preserved
      const config = await Storage.getConfig();
      expect(config.openaiApiKey).toBe('sk-key-1');
      expect(config.githubToken).toBe('ghp-token-1');
    });
  });

  describe('User Behavior: Managing conversation history', () => {
    it('should start with empty conversation history', async () => {
      // User action: first time using chat
      const history = await Storage.getConversationHistory();

      // Expected result: empty history
      expect(history).toHaveLength(0);
    });

    it('should add user and assistant messages to history', async () => {
      // User action: has a conversation
      const userMessage: ConversationMessage = {
        role: 'user',
        content: 'This button needs to be bigger',
        timestamp: Date.now(),
      };

      const assistantMessage: ConversationMessage = {
        role: 'assistant',
        content: 'I suggest increasing the padding',
        timestamp: Date.now(),
      };

      await Storage.addConversationMessage(userMessage);
      await Storage.addConversationMessage(assistantMessage);

      // Expected result: both messages are in history
      const history = await Storage.getConversationHistory();
      expect(history).toHaveLength(2);
      expect(history[0].role).toBe('user');
      expect(history[1].role).toBe('assistant');
    });

    it('should limit conversation history to last 50 messages', async () => {
      // User action: has a long conversation (60 messages)
      for (let i = 0; i < 60; i++) {
        await Storage.addConversationMessage({
          role: i % 2 === 0 ? 'user' : 'assistant',
          content: `Message ${i}`,
          timestamp: Date.now(),
        });
      }

      // Expected result: only last 50 messages are kept
      const history = await Storage.getConversationHistory();
      expect(history).toHaveLength(50);
      expect(history[0].content).toBe('Message 10');
    });

    it('should allow user to clear conversation history', async () => {
      // User action: adds messages then clears history
      await Storage.addConversationMessage({
        role: 'user',
        content: 'Test message',
        timestamp: Date.now(),
      });

      await Storage.clearConversationHistory();

      // Expected result: history is empty
      const history = await Storage.getConversationHistory();
      expect(history).toHaveLength(0);
    });
  });

  describe('User Behavior: Tracking feedback requests', () => {
    it('should save feedback requests for user reference', async () => {
      // User action: submits feedback on an element
      const request = {
        elementContext: {
          tagName: 'button',
          classList: ['primary'],
          computedStyles: {},
          boundingRect: { top: 0, left: 0, width: 100, height: 40 },
          domPath: 'button.primary',
        },
        userInput: 'Make this button bigger',
        pageUrl: 'http://localhost:3000',
        timestamp: Date.now(),
      };

      await Storage.saveFeedbackRequest(request);

      // Expected result: feedback is saved
      const feedback = await Storage.getRecentFeedback();
      expect(feedback).toHaveLength(1);
      expect(feedback[0].userInput).toBe('Make this button bigger');
    });

    it('should limit recent feedback to last 20 requests', async () => {
      // User action: submits 25 feedback requests
      for (let i = 0; i < 25; i++) {
        await Storage.saveFeedbackRequest({
          elementContext: {
            tagName: 'div',
            classList: [],
            computedStyles: {},
            boundingRect: { top: 0, left: 0, width: 100, height: 100 },
            domPath: 'div',
          },
          userInput: `Feedback ${i}`,
          pageUrl: 'http://localhost:3000',
          timestamp: Date.now(),
        });
      }

      // Expected result: only last 20 are kept
      const feedback = await Storage.getRecentFeedback();
      expect(feedback).toHaveLength(20);
      expect(feedback[0].userInput).toBe('Feedback 5');
    });
  });
});
