import type { ClaudeCodeCommand, ElementContext } from '../types';

export class ClaudeIntegration {
  private enabled: boolean;

  constructor(enabled: boolean = false) {
    this.enabled = enabled;
  }

  async sendCommand(command: ClaudeCodeCommand): Promise<boolean> {
    if (!this.enabled) {
      throw new Error('Claude Code integration is not enabled');
    }

    // This is a placeholder for Claude Code integration
    // In production, this would communicate with Claude Code via:
    // 1. MCP (Model Context Protocol) server
    // 2. Local API endpoint
    // 3. File-based communication

    const commandPayload = {
      type: 'mrplug-feedback',
      command: command.type,
      data: {
        instruction: command.instruction,
        context: this.formatContextForClaude(command.context),
        targetFile: command.targetFile,
        targetSelector: command.targetSelector,
      },
      timestamp: Date.now(),
    };

    // For now, we'll log to console and save to localStorage
    // which Claude Code could monitor
    console.log('[MrPlug -> Claude Code]', commandPayload);

    try {
      localStorage.setItem(
        'mrplug_claude_command',
        JSON.stringify(commandPayload)
      );
      return true;
    } catch (error) {
      console.error('Failed to send command to Claude Code:', error);
      return false;
    }
  }

  private formatContextForClaude(context: ElementContext): string {
    return `Element: ${context.domPath}
Tag: ${context.tagName}
Classes: ${context.classList.join(', ')}
Current Styles:
${Object.entries(context.computedStyles)
  .map(([key, value]) => `  ${key}: ${value}`)
  .join('\n')}
Position: ${context.boundingRect.width}x${context.boundingRect.height} at (${context.boundingRect.left}, ${context.boundingRect.top})`;
  }

  async checkConnection(): Promise<boolean> {
    // Check if Claude Code is listening
    // This could be done via:
    // 1. Checking for a running process
    // 2. Pinging a local endpoint
    // 3. Checking for a specific file/socket

    // For now, just return the enabled status
    return this.enabled;
  }

  generateEditInstruction(
    userFeedback: string,
    elementContext: ElementContext,
    suggestedChanges: string
  ): ClaudeCodeCommand {
    return {
      type: 'edit',
      targetSelector: elementContext.domPath,
      instruction: `User feedback: "${userFeedback}"

Suggested changes:
${suggestedChanges}

Please modify the styles or structure of the element at:
${elementContext.domPath}

Current element state:
- Tag: ${elementContext.tagName}
- Classes: ${elementContext.classList.join(', ')}
- Key styles: ${Object.entries(elementContext.computedStyles)
  .slice(0, 5)
  .map(([k, v]) => `${k}: ${v}`)
  .join(', ')}`,
      context: elementContext,
    };
  }
}
