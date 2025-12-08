import type { AIResponse, ElementContext, ConversationMessage } from '../types';

export class AnthropicAgent {
  private apiKey: string;
  private apiUrl = 'https://api.anthropic.com/v1/messages';

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  async analyzeFeedback(
    userInput: string,
    elementContext: ElementContext,
    conversationHistory: ConversationMessage[] = [],
    agentMode: 'ui' | 'ux' = 'ui'
  ): Promise<AIResponse> {
    // Build context for Claude based on agent mode
    const systemRole = agentMode === 'ux'
      ? `You are a UX strategist and product manager expert analyzing user experience goals and product requirements.

Focus on:
- User workflows and product features
- Feature stories and implementation plans
- Complete user journeys, not just UI elements
- Product improvements and new capabilities
- Detailed acceptance criteria for features`
      : `You are a UI expert analyzing feedback about web interface elements and styling.

Focus on:
- Specific styling, layout, colors, spacing
- CSS properties and HTML structure
- Visual refinements and browser flow
- Technical implementation details`;

    const contextPrompt = `
${systemRole}

Element Details:
- Tag: ${elementContext.tagName}
- ID: ${elementContext.id || 'none'}
- Classes: ${elementContext.classList.join(', ') || 'none'}
- DOM Path: ${elementContext.domPath}
- Text Content: ${elementContext.textContent || 'none'}
- Position: ${JSON.stringify(elementContext.boundingRect)}
- Key Styles: ${Object.entries(elementContext.computedStyles).slice(0, 5).map(([k, v]) => `${k}: ${v}`).join(', ')}

User Feedback: ${userInput}

Based on this feedback, provide:
1. A concise analysis of the issue or request
2. Suggested actions to address it (categorize as 'github-issue', 'claude-code', or 'manual')
3. Priority level (low, medium, high)
4. Whether code changes are required
5. Your confidence level (0-1)

Respond in JSON format:
{
  "analysis": "Brief analysis of the feedback",
  "suggestedActions": [
    {
      "type": "github-issue" | "claude-code" | "manual",
      "title": "Action title",
      "description": "What needs to be done",
      "priority": "low" | "medium" | "high"
    }
  ],
  "requiresCodeChange": true | false,
  "confidence": 0.0 to 1.0
}
`;

    // Build messages array with conversation history
    const messages: any[] = [];

    // Add conversation history
    conversationHistory.forEach((msg) => {
      messages.push({
        role: msg.role === 'user' ? 'user' : 'assistant',
        content: msg.content,
      });
    });

    // Add current request
    messages.push({
      role: 'user',
      content: contextPrompt,
    });

    try {
      const response = await fetch(this.apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': this.apiKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: 'claude-3-5-sonnet-20241022',
          max_tokens: 1024,
          messages,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(
          `Anthropic API error: ${response.status} ${response.statusText} - ${JSON.stringify(errorData)}`
        );
      }

      const data = await response.json();

      // Extract the text content from Claude's response
      const textContent = data.content?.[0]?.text || '';

      // Try to parse JSON from the response
      let result: AIResponse;
      try {
        // Look for JSON in the response (Claude might wrap it in markdown)
        const jsonMatch = textContent.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          result = JSON.parse(jsonMatch[0]);
        } else {
          throw new Error('No JSON found in response');
        }
      } catch (parseError) {
        // Fallback: create response from text
        result = {
          analysis: textContent,
          suggestedActions: [
            {
              type: 'manual',
              title: 'Review feedback',
              description: userInput,
              priority: 'medium',
            },
          ],
          requiresCodeChange: false,
          confidence: 0.5,
        };
      }

      return result;
    } catch (error) {
      console.error('[MrPlug] Anthropic API error:', error);
      throw error;
    }
  }
}
