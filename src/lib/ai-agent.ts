import { ChatOpenAI } from '@langchain/openai';
import { ChatAnthropic } from '@langchain/anthropic';
import { ChatPromptTemplate } from '@langchain/core/prompts';
import { StringOutputParser } from '@langchain/core/output_parsers';
import type { ElementContext, AIResponse, ConversationMessage } from '../types';

export class AIAgent {
  private model: ChatOpenAI | ChatAnthropic | null = null;
  private parser = new StringOutputParser();

  constructor(apiKey?: string) {
    if (apiKey) {
      // Detect API key type and use appropriate provider
      if (apiKey.startsWith('sk-ant-')) {
        // Anthropic API key
        this.model = new ChatAnthropic({
          modelName: 'claude-sonnet-4-20250514',
          temperature: 0.7,
          anthropicApiKey: apiKey,
        });
      } else if (apiKey.startsWith('sk-')) {
        // OpenAI API key
        this.model = new ChatOpenAI({
          modelName: 'gpt-4',
          temperature: 0.7,
          openAIApiKey: apiKey,
        });
      } else {
        throw new Error('Invalid API key format. Must be OpenAI (sk-...) or Anthropic (sk-ant-...)');
      }
    }
  }

  async analyzeFeedback(
    userInput: string,
    elementContext: ElementContext,
    conversationHistory: ConversationMessage[] = [],
    agentMode: 'ui' | 'ux' = 'ui'
  ): Promise<AIResponse> {
    if (!this.model) {
      throw new Error('AI model not initialized. Please configure OpenAI API key.');
    }

    const prompt = ChatPromptTemplate.fromMessages([
      ['system', this.getSystemPrompt(agentMode)],
      ['human', this.formatUserPrompt(userInput, elementContext, conversationHistory)],
    ]);

    const chain = prompt.pipe(this.model).pipe(this.parser);
    const response = await chain.invoke({});

    return this.parseResponse(response);
  }

  private getSystemPrompt(agentMode: 'ui' | 'ux'): string {
    if (agentMode === 'ux') {
      return `You are an expert UX strategist and product manager assistant. Your role is to:
1. Understand user experience goals and product requirements
2. Create detailed feature stories and implementation plans
3. Think holistically about user workflows and product features
4. Suggest actionable roadmap items that can be implemented via:
   - GitHub issues for feature requests with detailed acceptance criteria
   - Implementation plans for complex multi-step features
   - Product requirement documents (PRDs) for major features

When analyzing feedback:
- Focus on the user's goal and desired outcome, not just the UI element
- Think about the complete user journey and workflow
- Consider edge cases and alternate paths
- Break down complex features into implementable stories
- Suggest product improvements and new capabilities
- Think beyond styling to functional requirements

Your responses should prioritize product thinking and user experience over technical implementation details.`;
    }

    return `You are an expert UI analyst and frontend developer assistant. Your role is to:
1. Understand user feedback about UI elements and interactions
2. Analyze the technical context (DOM structure, styles, positioning)
3. Suggest actionable solutions that can be implemented via:
   - GitHub issues for feature requests or complex changes
   - Direct code changes for simple styling or structural fixes
   - Manual interventions for design decisions

When analyzing feedback:
- Be specific about what CSS properties or HTML structure needs to change
- Identify if it's a styling issue, layout problem, interaction bug, or feature request
- Prioritize solutions based on complexity and impact
- Format responses as JSON with the following structure:
{{
  "analysis": "Your detailed analysis of the issue",
  "suggestedActions": [
    {{
      "type": "github-issue" | "claude-code" | "manual",
      "title": "Action title",
      "description": "Detailed description",
      "priority": "low" | "medium" | "high",
      "metadata": {{}}
    }}
  ],
  "requiresCodeChange": true | false,
  "confidence": 0.0-1.0
}}`;
  }

  private formatUserPrompt(
    userInput: string,
    elementContext: ElementContext,
    conversationHistory: ConversationMessage[]
  ): string {
    const historyText = conversationHistory.length > 0
      ? `\n\nConversation History:\n${conversationHistory.map((msg) => `${msg.role}: ${msg.content}`).join('\n')}`
      : '';

    return `User Feedback: "${userInput}"

Element Context:
- Tag: ${elementContext.tagName}
- Classes: ${elementContext.classList.join(', ') || 'none'}
- ID: ${elementContext.id || 'none'}
- DOM Path: ${elementContext.domPath}
- Dimensions: ${elementContext.boundingRect.width}x${elementContext.boundingRect.height}
- Position: top=${elementContext.boundingRect.top}, left=${elementContext.boundingRect.left}

Key Styles:
${Object.entries(elementContext.computedStyles)
  .map(([key, value]) => `- ${key}: ${value}`)
  .join('\n')}

${elementContext.parentContext ? `Parent Context:
- Tag: ${elementContext.parentContext.tagName}
- Classes: ${elementContext.parentContext.classList?.join(', ') || 'none'}
` : ''}
${historyText}

Please analyze this feedback and provide actionable suggestions.`;
  }

  private parseResponse(response: string): AIResponse {
    try {
      // Try to extract JSON from markdown code blocks if present
      const jsonMatch = response.match(/```(?:json)?\s*(\{[\s\S]*\})\s*```/);
      const jsonString = jsonMatch ? jsonMatch[1] : response;

      const parsed = JSON.parse(jsonString);
      return {
        analysis: parsed.analysis || 'No analysis provided',
        suggestedActions: parsed.suggestedActions || [],
        requiresCodeChange: parsed.requiresCodeChange || false,
        confidence: parsed.confidence || 0.5,
      };
    } catch (error) {
      // Fallback if parsing fails
      return {
        analysis: response,
        suggestedActions: [
          {
            type: 'manual',
            title: 'Manual Review Required',
            description: response,
            priority: 'medium',
          },
        ],
        requiresCodeChange: false,
        confidence: 0.3,
      };
    }
  }
}
