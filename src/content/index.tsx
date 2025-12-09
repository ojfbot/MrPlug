import { createRoot } from 'react-dom/client';
import browser from 'webextension-polyfill';
import { FeedbackModal } from '../components/FeedbackModal';
import { ElementOverlay } from '../components/ElementOverlay';
import { ElementCapture } from '../lib/element-capture';
import { Storage } from '../lib/storage';
import { AIAgent } from '../lib/ai-agent';
import { AnthropicAgent } from '../lib/anthropic-agent';
import { GitHubIntegration } from '../lib/github-integration';
import { ClaudeIntegration } from '../lib/claude-integration';
import { ThemeManager } from '../lib/theme';
import type { ElementContext, AIResponse, FeedbackRequest } from '../types';
import './styles.css';
import '../styles/carbon-lite.css';

class MrPlugContent {
  private root: HTMLDivElement | null = null;
  private reactRoot: any = null;
  private isActive = false;
  private activatedByFnKey = false; // Track if activated by fn-F1 vs menu
  private hoveredElement: Element | null = null;
  private selectedElement: Element | null = null;
  private selectedContext: ElementContext | null = null;
  private modalOpen = false;
  private aiAgent: AIAgent | AnthropicAgent | null = null;
  private githubIntegration: GitHubIntegration | null = null;
  private claudeIntegration: ClaudeIntegration | null = null;
  private elementScreenshot: string | null = null;
  private viewportScreenshot: string | null = null;

  async init() {
    await this.loadConfig();
    await ThemeManager.initTheme();
    this.injectUI();
    this.syncTheme(); // Must be after injectUI to ensure this.root exists
    this.setupEventListeners();

    // Start monitoring console logs for context capture
    const { ContextCapture } = await import('../lib/context-capture');
    ContextCapture.startConsoleMonitoring();

    console.log('[MrPlug] Content script initialized');
  }

  private async syncTheme() {
    // Apply theme to both document and mrplug-root
    const applyThemeToRoot = async () => {
      const theme = await ThemeManager.getTheme();
      console.log('[MrPlug] Applying theme to root:', theme);

      // Apply to page document
      ThemeManager.applyTheme(theme);

      // Also apply to mrplug-root
      if (this.root) {
        if (theme === 'auto') {
          this.root.removeAttribute('data-theme');
        } else {
          this.root.setAttribute('data-theme', theme);
        }
      }
    };

    // Initial sync
    await applyThemeToRoot();

    // Listen for storage changes (when theme is changed in popup/settings)
    browser.storage.onChanged.addListener(async (changes, areaName) => {
      if (areaName === 'local' && changes.mrplug_theme) {
        console.log('[MrPlug] Theme changed in storage:', changes.mrplug_theme.newValue);
        await applyThemeToRoot();
      }
    });

    // Listen for system theme changes when in auto mode
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', async () => {
      const currentTheme = await ThemeManager.getTheme();
      if (currentTheme === 'auto') {
        await applyThemeToRoot();
      }
    });
  }

  private async loadConfig() {
    const config = await Storage.getConfig();

    console.log('[MrPlug] Loading config:', {
      llmProvider: config.llmProvider,
      hasOpenAIKey: !!config.openaiApiKey,
      hasAnthropicKey: !!config.anthropicApiKey,
      openaiKeyPrefix: config.openaiApiKey?.substring(0, 7),
      anthropicKeyPrefix: config.anthropicApiKey?.substring(0, 10),
    });

    // Initialize AI agent based on provider
    if (config.llmProvider === 'openai' && config.openaiApiKey) {
      console.log('[MrPlug] Initializing OpenAI agent');
      this.aiAgent = new AIAgent(config.openaiApiKey);
    } else if (config.llmProvider === 'anthropic' && config.anthropicApiKey) {
      console.log('[MrPlug] Initializing Anthropic agent');
      this.aiAgent = new AIAgent(config.anthropicApiKey);
    } else if (config.openaiApiKey) {
      // Fallback for existing configs without llmProvider set
      console.log('[MrPlug] Initializing agent with OpenAI fallback');
      this.aiAgent = new AIAgent(config.openaiApiKey);
    } else {
      console.warn('[MrPlug] No AI agent configured - AI analysis will not be available');
    }

    if (config.githubToken && config.githubRepo) {
      this.githubIntegration = new GitHubIntegration(
        config.githubToken,
        config.githubRepo
      );
    }

    this.claudeIntegration = new ClaudeIntegration(config.claudeCodeEnabled);
  }

  private injectUI() {
    this.root = document.createElement('div');
    this.root.id = 'mrplug-root';
    document.body.appendChild(this.root);

    this.reactRoot = createRoot(this.root);
    this.renderUI();
  }

  private renderUI() {
    try {
      console.log('[MrPlug] Rendering UI, modalOpen:', this.modalOpen, 'selectedContext:', this.selectedContext);
      this.reactRoot.render(
        <>
          <ElementOverlay
            element={this.hoveredElement}
            visible={this.isActive && !this.modalOpen}
          />
          <FeedbackModal
            isOpen={this.modalOpen}
            elementContext={this.selectedContext}
            selectedElement={this.selectedElement}
            elementScreenshot={this.elementScreenshot}
            viewportScreenshot={this.viewportScreenshot}
            onClose={() => this.closeModal()}
            onSubmit={(feedback, agentMode) => this.handleFeedbackSubmit(feedback, agentMode)}
            onCreateIssue={(response) => this.handleCreateIssue(response)}
            onApplyFix={(response) => this.handleApplyFix(response)}
          />
        </>
      );
      console.log('[MrPlug] UI rendered successfully');
    } catch (error) {
      console.error('[MrPlug] Error rendering UI:', error);
    }
  }

  private setupEventListeners() {
    // Track fn key state - use capture mode to ensure we catch it first
    document.addEventListener('keydown', (e) => {
      // X key to exit feedback mode (only when in feedback mode, not when modal is open)
      if ((e.key === 'x' || e.key === 'X') && !e.ctrlKey && !e.metaKey && !e.altKey) {
        if (this.isActive && !this.modalOpen) {
          console.log('[MrPlug] X key detected - exiting feedback mode');
          e.preventDefault();
          e.stopPropagation();
          e.stopImmediatePropagation();
          this.deactivate();
          return;
        }
      }

      // Detect fn key (via F1-F12 keys on Mac)
      if (e.key === 'F1') {
        e.preventDefault();

        // Prevent repeat events while key is held
        if (e.repeat) return;

        // Activate feedback mode when fn-F1 is pressed
        if (!this.isActive) {
          this.activatedByFnKey = true;
          this.activate();
          // Don't show green hint - blue hint from activate() is enough
        }
      }
    }, true); // Use capture to catch before other listeners

    document.addEventListener('keyup', (e) => {
      if (e.key === 'F1') {
        // Only deactivate if it was activated by fn-F1 (not by menu button)
        if (this.isActive && this.activatedByFnKey && !this.modalOpen) {
          this.deactivate();
          this.activatedByFnKey = false;
        }
      }
    });

    // Listen for clicks - select element on click
    document.addEventListener('click', (e) => {
      if (this.isActive && !this.modalOpen) {
        // In active mode - select element
        e.preventDefault();
        e.stopPropagation();
        this.handleClick(e);
      }
    }, true);

    // Track hover when active
    document.addEventListener('mousemove', (e) => this.handleMouseMove(e), true);

    // Listen for messages from background script and popup
    browser.runtime.onMessage.addListener((message: any) => {
      console.log('[MrPlug] Received message:', message);
      if (message.type === 'toggle-feedback') {
        console.log('[MrPlug] Toggling feedback mode, current isActive:', this.isActive);
        this.toggleActive();
        return Promise.resolve({ success: true });
      }
      if (message.type === 'ping') {
        return Promise.resolve({ success: true, loaded: true });
      }
      return Promise.resolve({ success: false });
    });
  }

  private toggleActive() {
    if (this.isActive) {
      this.deactivate();
    } else {
      // When toggling via menu, NOT activated by fn key
      this.activatedByFnKey = false;
      this.activate();
    }
  }

  private activate() {
    this.isActive = true;
    document.body.classList.add('mrplug-active-mode');
    this.showHint();
  }

  private deactivate() {
    this.isActive = false;
    this.activatedByFnKey = false;
    document.body.classList.remove('mrplug-active-mode');
    this.hoveredElement = null;
    this.renderUI();
    this.hideHint();
  }

  private showHint() {
    // Remove any existing hints first
    this.hideHint();

    const hint = document.createElement('div');
    hint.className = 'mrplug-hint';

    // Different message based on activation method
    const message = this.activatedByFnKey
      ? 'Click any element to provide feedback • Release fn-F1 or press X to exit'
      : 'Click any element to provide feedback • Press X to exit';

    hint.innerHTML = `
      ${message}
      <button class="mrplug-hint-close">×</button>
    `;

    hint.querySelector('.mrplug-hint-close')?.addEventListener('click', () => {
      this.deactivate();
    });

    document.body.appendChild(hint);

    setTimeout(() => hint.remove(), 5000);
  }

  private hideHint() {
    document.querySelector('.mrplug-hint')?.remove();
  }

  private handleMouseMove(e: MouseEvent) {
    if (!this.isActive || this.modalOpen) return;

    const target = e.target as Element;

    // Ignore if hovering over MrPlug UI elements (root, hint, etc.)
    const isHint = target.closest('.mrplug-activation-hint') || target.closest('.mrplug-hint');
    if (isHint) return;

    if (target && target !== this.root && !this.root?.contains(target)) {
      this.hoveredElement = target;
      this.renderUI();
    }
  }

  private async handleClick(e: MouseEvent) {
    if (!this.isActive || this.modalOpen) return;

    e.preventDefault();
    e.stopPropagation();

    const target = e.target as Element;
    if (target && target !== this.root && !this.root?.contains(target)) {
      await this.selectElement(target);
    }
  }

  private async selectElement(element: Element) {
    console.log('[MrPlug] Selecting element:', element);
    this.selectedElement = element;
    this.selectedContext = await ElementCapture.captureElement(element);
    console.log('[MrPlug] Element context captured:', this.selectedContext);

    // Capture screenshots before opening modal
    await this.captureScreenshots(element);

    this.isActive = false;
    document.body.classList.remove('mrplug-active-mode');

    this.openModal();
  }

  private async captureScreenshots(element: Element) {
    try {
      console.log('[MrPlug] Starting screenshot capture...');

      // Capture full viewport screenshot via background script with timeout
      const screenshotPromise = browser.runtime.sendMessage({
        type: 'capture-screenshot'
      }) as Promise<{ success?: boolean; dataUrl?: string }>;

      // Add timeout to prevent hanging
      const timeoutPromise = new Promise<{ success: false }>((resolve) => {
        setTimeout(() => {
          console.warn('[MrPlug] Screenshot capture timed out');
          resolve({ success: false });
        }, 3000); // 3 second timeout
      });

      const response = await Promise.race([screenshotPromise, timeoutPromise]);
      console.log('[MrPlug] Screenshot response:', response ? 'received' : 'none');

      if (response && 'dataUrl' in response && response.dataUrl) {
        this.viewportScreenshot = response.dataUrl;
        console.log('[MrPlug] Viewport screenshot captured successfully');

        // Capture element-specific screenshot by cropping viewport
        if (this.viewportScreenshot) {
          try {
            this.elementScreenshot = await this.cropElementFromViewport(element, this.viewportScreenshot);
            console.log('[MrPlug] Element screenshot captured successfully');
          } catch (cropError) {
            console.warn('[MrPlug] Failed to crop element screenshot:', cropError);
          }
        }
      } else {
        console.warn('[MrPlug] No screenshot data received');
      }
    } catch (error) {
      console.warn('[MrPlug] Failed to capture screenshots:', error);
    }
    console.log('[MrPlug] Screenshot capture completed');
  }

  private async cropElementFromViewport(element: Element, viewportDataUrl: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const rect = element.getBoundingClientRect();
      const img = new Image();

      img.onload = () => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');

        if (!ctx) {
          reject(new Error('Failed to get canvas context'));
          return;
        }

        // Account for device pixel ratio - screenshot is at actual device pixels
        const dpr = window.devicePixelRatio || 1;
        const padding = 10;

        // Canvas dimensions in CSS pixels
        canvas.width = rect.width + padding * 2;
        canvas.height = rect.height + padding * 2;

        // Source coordinates need to be scaled by device pixel ratio
        const srcX = (rect.left - padding) * dpr;
        const srcY = (rect.top - padding) * dpr;
        const srcWidth = canvas.width * dpr;
        const srcHeight = canvas.height * dpr;

        // Draw the cropped portion of the viewport
        ctx.drawImage(
          img,
          srcX,
          srcY,
          srcWidth,
          srcHeight,
          0,
          0,
          canvas.width,
          canvas.height
        );

        // Draw a border around the element
        ctx.strokeStyle = '#0f62fe';
        ctx.lineWidth = 2;
        ctx.strokeRect(padding, padding, rect.width, rect.height);

        resolve(canvas.toDataURL('image/png'));
      };

      img.onerror = () => {
        reject(new Error('Failed to load viewport screenshot'));
      };

      img.src = viewportDataUrl;
    });
  }

  private openModal() {
    console.log('[MrPlug] Opening modal, modalOpen:', this.modalOpen, 'selectedContext:', this.selectedContext);
    this.modalOpen = true;
    this.renderUI();
    console.log('[MrPlug] Modal opened, modalOpen:', this.modalOpen);
  }

  private closeModal() {
    this.modalOpen = false;
    this.selectedElement = null;
    this.selectedContext = null;
    this.elementScreenshot = null;
    this.viewportScreenshot = null;
    this.renderUI();
  }

  private async handleFeedbackSubmit(feedback: string, agentMode: 'ui' | 'ux' = 'ui'): Promise<AIResponse> {
    if (!this.selectedContext) {
      throw new Error('No element selected');
    }

    const conversationHistory = await Storage.getConversationHistory();

    await Storage.addConversationMessage({
      role: 'user',
      content: feedback,
      timestamp: Date.now(),
    });

    const request: FeedbackRequest = {
      elementContext: this.selectedContext,
      userInput: feedback,
      pageUrl: window.location.href,
      timestamp: Date.now(),
      conversationHistory,
      agentMode,
    };

    await Storage.saveFeedbackRequest(request);

    // Try to get AI analysis if configured, but don't fail if not
    let response: AIResponse | undefined;

    // If agent not initialized, try to reload config
    if (!this.aiAgent) {
      console.warn('[MrPlug] AI agent not initialized - attempting to reload config...');
      await this.loadConfig();
    }

    if (this.aiAgent) {
      console.log('[MrPlug] AI agent is initialized, calling analyzeFeedback...');
      try {
        response = await this.aiAgent.analyzeFeedback(
          feedback,
          this.selectedContext,
          conversationHistory,
          agentMode
        );
        console.log('[MrPlug] AI analysis received:', response);

        await Storage.addConversationMessage({
          role: 'assistant',
          content: response.analysis,
          timestamp: Date.now(),
        });
      } catch (error) {
        console.error('[MrPlug] AI analysis failed:', error);
        console.error('[MrPlug] Error details:', {
          name: error instanceof Error ? error.name : 'Unknown',
          message: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined,
        });
      }
    } else {
      console.error('[MrPlug] AI agent still not initialized after reload - AI analysis unavailable');
    }

    // Capture complete context for Claude Code integration (works with or without AI)
    const { ContextCapture } = await import('../lib/context-capture');
    const claudeCodePayload = await ContextCapture.captureCompleteContext(
      this.selectedElement!,
      feedback,
      response ? {
        summary: response.analysis,
        suggestedActions: response.suggestedActions,
        confidence: response.confidence,
      } : undefined,
      conversationHistory
    );

    // Log structured payload to console
    console.log('%c[MrPlug] Claude Code Integration Payload', 'color: #0f62fe; font-weight: bold; font-size: 14px');
    console.log('User Comment:', claudeCodePayload.userComment);
    console.log('Element Context:', claudeCodePayload.elementContext);
    console.log('DOM Context:', claudeCodePayload.relevantDOM);
    console.log('Redux State:', claudeCodePayload.reduxState);
    console.log('Console Logs:', claudeCodePayload.consoleLogs);
    console.log('AI Analysis:', claudeCodePayload.aiAnalysis);
    console.log('%cFull Payload (JSON):', 'color: #24a148; font-weight: bold');
    console.log(JSON.stringify(claudeCodePayload, null, 2));

    // If no AI response, return a basic response
    if (!response) {
      response = {
        analysis: 'AI analysis not available (API key not configured). Please configure your AI provider in settings.',
        suggestedActions: [],
        requiresCodeChange: false,
        confidence: 0,
      };
    }

    return response;
  }

  private async handleCreateIssue(response: AIResponse): Promise<void> {
    if (!this.githubIntegration) {
      throw new Error('GitHub integration not configured. Please set your GitHub token and repository in the extension options.');
    }

    if (!this.selectedContext) {
      throw new Error('No element selected');
    }

    const primaryAction = response.suggestedActions[0];
    if (!primaryAction) {
      throw new Error('No suggested actions available');
    }

    let screenshot: string | undefined;
    try {
      screenshot = await ElementCapture.captureScreenshot(this.selectedElement!);
    } catch (error) {
      console.warn('Failed to capture screenshot:', error);
    }

    const issueData = {
      title: primaryAction.title,
      body: `${primaryAction.description}\n\n## AI Analysis\n${response.analysis}\n\n## Element Details\n- Path: \`${this.selectedContext.domPath}\`\n- Tag: \`${this.selectedContext.tagName}\`\n- Classes: \`${this.selectedContext.classList.join(', ')}\`\n- Page: ${window.location.href}`,
      labels: ['ui-feedback', `priority-${primaryAction.priority}`],
      screenshot,
    };

    const issueUrl = await this.githubIntegration.createIssue(issueData);
    console.log('[MrPlug] Created GitHub issue:', issueUrl);

    // Notify user
    alert(`GitHub issue created successfully!\n${issueUrl}`);
  }

  private async handleApplyFix(response: AIResponse): Promise<void> {
    if (!this.claudeIntegration) {
      throw new Error('Claude Code integration not enabled');
    }

    if (!this.selectedContext) {
      throw new Error('No element selected');
    }

    const codeAction = response.suggestedActions.find(
      (action) => action.type === 'claude-code'
    );

    if (!codeAction) {
      throw new Error('No code action available');
    }

    const command = this.claudeIntegration.generateEditInstruction(
      codeAction.description,
      this.selectedContext,
      response.analysis
    );

    const success = await this.claudeIntegration.sendCommand(command);

    if (success) {
      alert('Command sent to Claude Code! Check your IDE for the suggested changes.');
    } else {
      throw new Error('Failed to send command to Claude Code');
    }
  }
}

// Initialize when DOM is ready - only in valid extension context
if ((globalThis as any).chrome?.runtime?.id) {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      new MrPlugContent().init();
    });
  } else {
    new MrPlugContent().init();
  }
} else {
  console.warn('[MrPlug] Not running in extension context, skipping initialization');
}

export {};
