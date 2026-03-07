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
    const baseStructure = `
Always respond with valid JSON matching this exact structure:
{{
  "analysis": "Your detailed analysis",
  "issueTitle": "Concise GitHub issue title (under 80 chars)",
  "issueDescription": "1-3 paragraph description of the problem and proposed solution, written for a developer reading a GitHub issue",
  "acceptanceCriteria": [
    "Criteria written as 'Given/When/Then' or 'The user can...' statements",
    "Each entry is a single verifiable condition"
  ],
  "openQuestions": [
    "Unresolved design or implementation question that needs team input",
    "Any ambiguity that should be clarified before implementation"
  ],
  "suggestedActions": [
    {{
      "type": "github-issue" | "claude-code" | "manual",
      "title": "Action title",
      "description": "One-line description shown on the action button tooltip",
      "priority": "low" | "medium" | "high",
      "metadata": {{}}
    }}
  ],
  "requiresCodeChange": true | false,
  "confidence": 0.0-1.0
}}`;

    if (agentMode === 'ux') {
      return `You are an expert UX strategist and product manager embedded in a browser extension that inspects live UI. When a developer clicks a UI element and describes a goal, you produce a structured GitHub issue brief.

Your job:
1. Identify the user experience problem or opportunity from the feedback and element context
2. Write a clear issue description that frames the WHY (user need) and the WHAT (proposed change)
3. List concrete, testable acceptance criteria — not vague goals
4. Surface genuine open questions: design decisions, edge cases, or technical ambiguities that need team alignment
5. Recommend the right action type (github-issue for features/UX work, claude-code for targeted code fixes)

Think beyond the single element — consider the complete user workflow, mobile vs desktop, empty states, error states, and accessibility.
${baseStructure}`;
    }

    return `You are an expert UI analyst and frontend developer assistant embedded in a browser extension that inspects live DOM elements. When a developer clicks a UI element and describes an issue, you produce a structured GitHub issue brief.

Your job:
1. Diagnose the specific UI problem: styling, layout, spacing, color, interaction, or structure
2. Write a clear issue description with technical specifics (which CSS properties, which component, what the fix entails)
3. List concrete acceptance criteria that a QA engineer can verify
4. Flag genuine open questions: design decisions, browser compatibility concerns, token/variable naming questions
5. Recommend action type: github-issue for tracked changes, claude-code for immediate targeted fixes

Be specific about DOM paths, class names, CSS properties, and pixel values when relevant.
${baseStructure}`;
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
    let parsed: any = null;

    try {
      // Try markdown code block first, then bare JSON object
      const jsonMatch = response.match(/```(?:json)?\s*(\{[\s\S]*?\})\s*```/) ||
                        response.match(/(\{[\s\S]*\})/);
      const jsonString = jsonMatch ? jsonMatch[1] : response;
      parsed = JSON.parse(jsonString);
    } catch {
      // Plain text response — treat entire response as the analysis
    }

    const result: AIResponse = parsed
      ? {
          analysis: parsed.analysis || response,
          issueTitle: parsed.issueTitle,
          issueDescription: parsed.issueDescription,
          acceptanceCriteria: Array.isArray(parsed.acceptanceCriteria) ? parsed.acceptanceCriteria : undefined,
          openQuestions: Array.isArray(parsed.openQuestions) ? parsed.openQuestions : undefined,
          suggestedActions: Array.isArray(parsed.suggestedActions) ? parsed.suggestedActions : [],
          requiresCodeChange: parsed.requiresCodeChange ?? false,
          confidence: parsed.confidence ?? 0.5,
        }
      : {
          analysis: response,
          suggestedActions: [],
          requiresCodeChange: false,
          confidence: 0.3,
        };

    return result;
  }
}
