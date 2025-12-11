import { createRoot } from 'react-dom/client';
import browser from 'webextension-polyfill';
import { FeedbackModal } from '../components/FeedbackModal';
import { ElementOverlay } from '../components/ElementOverlay';
import { ElementCapture } from '../lib/element-capture';
import { ElementHash } from '../lib/element-hash';
import { Storage } from '../lib/storage';
import { AIAgent } from '../lib/ai-agent';
import { GitHubIntegration } from '../lib/github-integration';
import { ClaudeIntegration } from '../lib/claude-integration';
import { ThemeManager } from '../lib/theme';
import { SessionSummary } from '../lib/session-summary';
import type { ElementContext, AIResponse, FeedbackRequest, ChatSession } from '../types';
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
  private aiAgent: AIAgent | null = null;
  private githubIntegration: GitHubIntegration | null = null;
  private claudeIntegration: ClaudeIntegration | null = null;
  private elementScreenshot: string | null = null;
  private viewportScreenshot: string | null = null;
  private currentElementHash: string | null = null;
  private currentSessionId: string | null = null;
  private lastScreenshotTime: number = 0;
  private screenshotRateLimit: number = 600; // 600ms between captures to stay under 2/sec limit
  private dismissedPageModal: {
    modal: HTMLElement;
    backdrop: HTMLElement | null;
    originalStyles: {
      modalDisplay: string;
      modalVisibility: string;
      modalOpacity: string;
      backdropDisplay?: string;
      backdropVisibility?: string;
      backdropOpacity?: string;
    };
  } | null = null;

  async init() {
    await this.loadConfig();
    await Storage.migrateToSessions(); // Run migration from old conversation format
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
            onNewSession={() => this.handleNewSession()}
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
      // Don't interfere with keyboard input when modal is open
      if (this.modalOpen) {
        // Allow all keyboard events to pass through to the modal
        return;
      }

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

  private handleNewSession() {
    // Close modal
    this.closeModal();
    // Activate feedback mode for element selection
    this.activate();
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

    // Generate element hash
    this.currentElementHash = ElementHash.generate(element);
    console.log('[MrPlug] Element hash:', this.currentElementHash);

    // Check for existing session with error handling
    let session: ChatSession | null = null;
    try {
      session = await Storage.findSessionByElementHash(this.currentElementHash);

      if (session) {
        // Resume existing session
        console.log('[MrPlug] Resuming session:', session.id);
        this.currentSessionId = session.id;
        await Storage.setActiveSession(session.id);
      } else {
        // Create new session
        console.log('[MrPlug] Creating new session for element');
        const title = ElementHash.generateTitle(element);
        session = await Storage.createSession(
          this.currentElementHash,
          title,
          this.selectedContext
        );
        this.currentSessionId = session.id;
      }
    } catch (error) {
      console.error('[MrPlug] Failed to create/resume session:', error);
      // Show user-visible error - still open modal but with error state
      this.currentSessionId = null;
      alert('Failed to create chat session. Your feedback will not be saved. Please try again.');
      return;
    }

    // Capture screenshots BEFORE dismissing page modal
    await this.captureScreenshots(element);

    this.isActive = false;
    document.body.classList.remove('mrplug-active-mode');

    this.openModal();

    // WORKAROUND: Dismiss page modals AFTER MrPlug modal is open and screenshot is captured
    // This ensures the dismissal is subtle and doesn't interfere with screenshot
    // Known issue: Page modals can interfere with keyboard focus in MrPlug modal
    setTimeout(() => {
      this.dismissPageModals(element);
    }, 200); // Small delay to ensure MrPlug modal is fully rendered
  }

  private dismissPageModals(element: Element) {
    // Try to detect and dismiss modals that contain the selected element
    // This is a workaround for keyboard focus issues when selecting elements inside modals
    // Dismissal is subtle (opacity fade) and restorable

    // Check if element is inside a modal
    const modal = element.closest('[role="dialog"], [aria-modal="true"], .cds--modal, .modal');

    if (modal && modal instanceof HTMLElement) {
      console.log('[MrPlug] Detected element is inside a modal, subtly dismissing it');

      // Find backdrop
      const backdrop = document.querySelector('.cds--modal-backdrop, .modal-backdrop, [class*="backdrop"], [class*="overlay"]') as HTMLElement | null;

      // Save original styles for restoration
      this.dismissedPageModal = {
        modal,
        backdrop,
        originalStyles: {
          modalDisplay: modal.style.display || '',
          modalVisibility: modal.style.visibility || '',
          modalOpacity: modal.style.opacity || '',
          backdropDisplay: backdrop?.style.display || '',
          backdropVisibility: backdrop?.style.visibility || '',
          backdropOpacity: backdrop?.style.opacity || '',
        },
      };

      console.log('[MrPlug] Saved modal state for restoration');

      // Subtle fade out using opacity and pointer-events
      // Don't use display:none immediately - that's too visible
      modal.style.transition = 'opacity 0.3s ease-out';
      modal.style.opacity = '0';
      modal.style.pointerEvents = 'none';
      modal.setAttribute('aria-hidden', 'true');

      if (backdrop) {
        backdrop.style.transition = 'opacity 0.3s ease-out';
        backdrop.style.opacity = '0';
        backdrop.style.pointerEvents = 'none';
      }

      // After fade completes, set visibility:hidden to fully remove from layout
      setTimeout(() => {
        modal.style.visibility = 'hidden';
        if (backdrop) {
          backdrop.style.visibility = 'hidden';
        }
        console.log('[MrPlug] Page modal fully dismissed (subtle)');
      }, 300);
    }
  }

  private restorePageModal() {
    // Restore page modal that was dismissed
    if (!this.dismissedPageModal) {
      return;
    }

    console.log('[MrPlug] Restoring page modal state');

    const { modal, backdrop, originalStyles } = this.dismissedPageModal;

    // Check if modal still exists in DOM
    if (!document.body.contains(modal)) {
      console.warn('[MrPlug] Modal no longer in DOM, skipping restore');
      this.dismissedPageModal = null;
      return;
    }

    // Restore modal styles
    modal.style.visibility = originalStyles.modalVisibility;
    modal.style.display = originalStyles.modalDisplay;
    modal.style.opacity = originalStyles.modalOpacity || '1';
    modal.style.pointerEvents = '';
    modal.style.transition = '';
    modal.removeAttribute('aria-hidden');

    // Restore backdrop styles (check existence first)
    if (backdrop && document.body.contains(backdrop)) {
      backdrop.style.visibility = originalStyles.backdropVisibility || '';
      backdrop.style.display = originalStyles.backdropDisplay || '';
      backdrop.style.opacity = originalStyles.backdropOpacity || '1';
      backdrop.style.pointerEvents = '';
      backdrop.style.transition = '';
    }

    // Try to restore focus to modal
    try {
      const focusableElement = modal.querySelector('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])') as HTMLElement;
      if (focusableElement) {
        focusableElement.focus();
        console.log('[MrPlug] Focus restored to page modal');
      }
    } catch (e) {
      console.warn('[MrPlug] Failed to restore focus to page modal:', e);
    }

    console.log('[MrPlug] Page modal restored');
    this.dismissedPageModal = null;
  }

  private async captureScreenshots(element: Element) {
    try {
      // Rate limiting: Check if we're calling too frequently
      const now = Date.now();
      const timeSinceLastCapture = now - this.lastScreenshotTime;

      if (timeSinceLastCapture < this.screenshotRateLimit) {
        const waitTime = this.screenshotRateLimit - timeSinceLastCapture;
        console.log(`[MrPlug] Rate limiting screenshot capture, waiting ${waitTime}ms...`);
        // Reserve the slot BEFORE waiting to prevent race conditions
        this.lastScreenshotTime = now + waitTime;
        await new Promise(resolve => setTimeout(resolve, waitTime));
      } else {
        // Update timestamp immediately to reserve this slot
        this.lastScreenshotTime = now;
      }

      console.log('[MrPlug] Starting screenshot capture...');

      // Capture full viewport screenshot via background script with timeout
      const screenshotPromise = browser.runtime.sendMessage({
        type: 'capture-screenshot'
      }) as Promise<{ success?: boolean; dataUrl?: string; error?: string }>;

      // Add timeout to prevent hanging
      const timeoutPromise = new Promise<{ success: false; error: string }>((resolve) => {
        setTimeout(() => {
          console.warn('[MrPlug] Screenshot capture timed out');
          resolve({ success: false, error: 'timeout' });
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
        const errorMsg = response && 'error' in response ? response.error : 'Unknown error';
        console.warn('[MrPlug] Screenshot capture failed:', errorMsg);
        // Continue without screenshots - don't block the modal
      }
    } catch (error) {
      console.error('[MrPlug] Failed to capture screenshots:', error);
      // Continue without screenshots - don't block the modal
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

    // Restore page modal if it was dismissed
    this.restorePageModal();

    this.renderUI();
  }

  private async handleFeedbackSubmit(feedback: string, agentMode: 'ui' | 'ux' = 'ui'): Promise<AIResponse> {
    // Capture sessionId as local variable to avoid non-null assertions
    const sessionId = this.currentSessionId;
    if (!this.selectedContext || !sessionId) {
      throw new Error('No element or session selected');
    }

    // Get session conversation history
    const session = await Storage.getSessionById(sessionId);
    const conversationHistory = session?.messages || [];

    // Add user message to session with error handling
    try {
      await Storage.addMessageToSession(sessionId, {
        id: Storage.generateUUID(),
        role: 'user',
        content: feedback,
        timestamp: Date.now(),
      });
    } catch (error) {
      console.error('[MrPlug] Failed to save user message to session:', error);
      throw new Error('Failed to save message. Please try again.');
    }

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

        if (response) {
          // Add assistant response to session with error handling
          try {
            await Storage.addMessageToSession(sessionId, {
              id: Storage.generateUUID(),
              role: 'assistant',
              content: response.analysis,
              timestamp: Date.now(),
            });

            // Auto-generate summary if needed
            await SessionSummary.autoGenerateSummary(sessionId, this.aiAgent);
          } catch (error) {
            console.error('[MrPlug] Failed to save assistant message to session:', error);
            // Don't throw - this is not critical, user already has the response
          }
        }
      } catch (error) {
        console.error('[MrPlug] AI analysis failed:', error);
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error('[MrPlug] Error details:', {
          name: error instanceof Error ? error.name : 'Unknown',
          message: errorMessage,
          stack: error instanceof Error ? error.stack : undefined,
        });

        // Surface error to user with actionable message
        let userMessage = 'AI analysis failed. ';
        if (errorMessage.includes('API key')) {
          userMessage += 'Please check your API key in Settings.';
        } else if (errorMessage.includes('network') || errorMessage.includes('fetch')) {
          userMessage += 'Please check your internet connection and try again.';
        } else if (errorMessage.includes('rate limit')) {
          userMessage += 'API rate limit reached. Please wait a moment and try again.';
        } else {
          userMessage += 'Please try again or check the console for details.';
        }

        response = {
          analysis: userMessage,
          suggestedActions: [{
            type: 'manual',
            title: 'Check Settings',
            description: 'Verify your API configuration in the extension settings',
            priority: 'high',
          }],
          requiresCodeChange: false,
          confidence: 0,
        };
      }
    } else {
      console.error('[MrPlug] AI agent still not initialized after reload - AI analysis unavailable');

      // User-friendly message for configuration issues
      response = {
        analysis: 'AI agent is not configured. Please configure your AI provider (OpenAI or Anthropic) in the extension settings to enable AI analysis.',
        suggestedActions: [{
          type: 'manual',
          title: 'Open Settings',
          description: 'Click the MrPlug icon and select Settings to configure your API key',
          priority: 'high',
        }],
        requiresCodeChange: false,
        confidence: 0,
      };
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
