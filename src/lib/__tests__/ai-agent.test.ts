import { describe, it, expect } from 'vitest';
import { AIAgent } from '../ai-agent';
import type { ElementContext } from '../../types';

describe('AIAgent', () => {
  const mockElementContext: ElementContext = {
    tagName: 'button',
    id: 'submit-btn',
    classList: ['btn', 'primary'],
    textContent: 'Submit',
    computedStyles: {
      fontSize: '14px',
      padding: '8px 16px',
      backgroundColor: 'blue',
    },
    boundingRect: {
      top: 100,
      left: 200,
      width: 120,
      height: 40,
    },
    domPath: 'div.form > button#submit-btn.btn.primary',
  };

  describe('User Behavior: Getting AI feedback analysis', () => {
    it('should throw error when API key is not configured', async () => {
      // User action: tries to use AI without API key
      const agent = new AIAgent();

      // Expected result: clear error message
      await expect(
        agent.analyzeFeedback('Make it bigger', mockElementContext)
      ).rejects.toThrow('AI model not initialized');
    });

    it('should analyze user feedback with element context', async () => {
      // Note: This is a mock test. In real testing, you'd use a mock LangChain instance
      const agent = new AIAgent('sk-test-key');

      // Mock the model response
      const mockResponse = JSON.stringify({
        analysis: 'The button appears small. Increasing padding would improve usability.',
        suggestedActions: [
          {
            type: 'claude-code',
            title: 'Increase button padding',
            description: 'Change padding from 8px 16px to 12px 24px',
            priority: 'medium',
          },
        ],
        requiresCodeChange: true,
        confidence: 0.85,
      });

      // Since we can't easily mock LangChain in tests, we'll test the parse logic
      const parsed = (agent as any).parseResponse(mockResponse);

      // Expected result: structured response
      expect(parsed.analysis).toBeDefined();
      expect(parsed.suggestedActions).toHaveLength(1);
      expect(parsed.requiresCodeChange).toBe(true);
      expect(parsed.confidence).toBe(0.85);
    });

    it('should handle non-JSON responses gracefully', () => {
      const agent = new AIAgent('sk-test-key');

      // User action: AI returns plain text instead of JSON
      const plainTextResponse = 'The button should be larger and have more padding.';

      // Expected result: fallback to manual action
      const parsed = (agent as any).parseResponse(plainTextResponse);

      expect(parsed.analysis).toBe(plainTextResponse);
      expect(parsed.suggestedActions).toHaveLength(1);
      expect(parsed.suggestedActions[0].type).toBe('manual');
      expect(parsed.confidence).toBeLessThan(0.5);
    });

    it('should extract JSON from markdown code blocks', () => {
      const agent = new AIAgent('sk-test-key');

      // User action: AI returns JSON in markdown
      const markdownResponse = '```json\n{"analysis": "Test", "suggestedActions": [], "requiresCodeChange": false, "confidence": 0.8}\n```';

      // Expected result: JSON is extracted and parsed
      const parsed = (agent as any).parseResponse(markdownResponse);

      expect(parsed.analysis).toBe('Test');
      expect(parsed.confidence).toBe(0.8);
    });
  });

  describe('User Behavior: Incorporating conversation history', () => {
    it('should include conversation history in prompt', () => {
      const agent = new AIAgent('sk-test-key');

      const conversationHistory = [
        { role: 'user' as const, content: 'Make it blue', timestamp: 1 },
        { role: 'assistant' as const, content: 'Changed color to blue', timestamp: 2 },
      ];

      // Format prompt with history
      const prompt = (agent as any).formatUserPrompt(
        'Now make it bigger',
        mockElementContext,
        conversationHistory
      );

      // Expected result: history is included
      expect(prompt).toContain('user: Make it blue');
      expect(prompt).toContain('assistant: Changed color to blue');
      expect(prompt).toContain('Now make it bigger');
    });
  });
});
