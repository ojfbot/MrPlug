import { createRoot } from 'react-dom/client';
import browser from 'webextension-polyfill';
import { FeedbackModal } from '../components/FeedbackModal';
import { ElementOverlay } from '../components/ElementOverlay';
import { ElementHash } from '../lib/element-hash';
import { ElementCapture } from '../lib/element-capture';
import { Storage } from '../lib/storage';
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
  private elementScreenshot: string | null = null;
  private viewportScreenshot: string | null = null;
  private currentElementHash: string | null = null;
  private currentSessionId: string | null = null;
  private lastScreenshotTime: number = 0;
  private screenshotRateLimit: number = 600; // 600ms between captures to stay under 2/sec limit
  // Debounce: when keydown handler fires Cmd+Shift+F, we set this timestamp so the
  // subsequent 'toggle-feedback' message from the background command path doesn't double-toggle.
  private keydownActivatedAt: number = 0;
  // Incremented each time the background signals that Claude Code consumed the relay context.
  // Passed as prop to FeedbackModal so it can clear the pending banner via useEffect.
  private claudeCodeConsumedAt: number = 0;
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
      // Apply to page document only — mrplug-root always uses cds--g100 (Frame dark)
      ThemeManager.applyTheme(theme);
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
    // Config is read directly by the background worker and FeedbackModal.
    // No integrations need to be instantiated in the content script.
    console.log('[MrPlug] Content script initialised — AI, GitHub, and Claude Code handled by background worker');
  }

  private injectUI() {
    this.root = document.createElement('div');
    this.root.id = 'mrplug-root';
    // Always Frame dark — MrPlug is a Frame OS surface, not a host-page widget
    this.root.classList.add('cds--g100');
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
            claudeCodeConsumedAt={this.claudeCodeConsumedAt}
            onClose={() => this.closeModal()}
            onSubmit={(feedback, agentMode) => this.handleFeedbackSubmit(feedback, agentMode)}
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

      // Cmd+Shift+F — toggle cursor mode.
      // Both the content script keydown handler AND Chrome's extension command system
      // fire for this shortcut. We record when we handled it so the subsequent
      // 'toggle-feedback' message from the command path doesn't double-toggle.
      if (e.metaKey && e.shiftKey && e.key === 'f') {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        this.keydownActivatedAt = Date.now();
        this.toggleActive();
        return;
      }

      // Escape or X — exit cursor mode
      if ((e.key === 'Escape' || e.key === 'x' || e.key === 'X') && !e.ctrlKey && !e.metaKey && !e.altKey) {
        if (this.isActive && !this.modalOpen) {
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

    // Trigger element selection on mousedown (not click).
    // Using mousedown matches how browser element inspectors work and is essential
    // for <button> elements: calling preventDefault() on mousedown suppresses Chrome's
    // button activation behaviour which would otherwise prevent the click event from
    // firing at all — making buttons un-selectable with a click-based approach.
    document.addEventListener('mousedown', (e) => {
      if (this.isActive && !this.modalOpen) {
        const target = e.target as Element;
        if (target && target !== this.root && !this.root?.contains(target)) {
          e.preventDefault();            // suppress focus change + button activation
          e.stopPropagation();           // prevent React root from seeing mousedown
          e.stopImmediatePropagation();  // block any other document-level capture listeners
          this.handleClick(e).catch((err) => console.error('[MrPlug] handleClick error:', err));
        }
      }
    }, true);

    // Suppress the click that follows mousedown so the button's onClick doesn't fire.
    document.addEventListener('click', (e) => {
      if (this.isActive && !this.modalOpen) {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        // Selection was already handled in mousedown — don't call handleClick again.
      }
    }, true);

    // Track hover when active
    document.addEventListener('mousemove', (e) => this.handleMouseMove(e), true);

    // Listen for messages from background script and popup
    browser.runtime.onMessage.addListener((message: any) => {
      console.log('[MrPlug] Received message:', message);
      if (message.type === 'toggle-feedback') {
        // If the content script keydown handler fired within the last 300ms, skip this
        // message — it's the duplicate from the Chrome extension command path.
        const msSinceKeydown = Date.now() - this.keydownActivatedAt;
        if (msSinceKeydown < 300) {
          console.log('[MrPlug] Ignoring duplicate toggle-feedback (keydown already handled it)');
          return Promise.resolve({ success: true });
        }
        console.log('[MrPlug] Toggling feedback mode, current isActive:', this.isActive);
        this.toggleActive();
        return Promise.resolve({ success: true });
      }
      if (message.type === 'claude-code-context-consumed') {
        this.claudeCodeConsumedAt = Date.now();
        this.renderUI();
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
    // Wake the MV3 service worker now so captureVisibleTab is ready when the user clicks
    browser.runtime.sendMessage({ type: 'ping' }).catch(() => {});
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
    this.hideHint();

    const hint = document.createElement('div');
    hint.className = 'mrplug-hint';
    hint.innerHTML = `Click any element to inspect &nbsp;·&nbsp; <kbd style="font-family:inherit;font-size:11px;background:var(--ojf-surface-3,#222);border:1px solid var(--ojf-border,#2a2a2a);border-radius:2px;padding:1px 5px;color:var(--ojf-text-secondary,#a0a0a0)">⌘⇧F</kbd> or <kbd style="font-family:inherit;font-size:11px;background:var(--ojf-surface-3,#222);border:1px solid var(--ojf-border,#2a2a2a);border-radius:2px;padding:1px 5px;color:var(--ojf-text-secondary,#a0a0a0)">Esc</kbd> to exit<button class="mrplug-hint-close" title="Exit MrPlug">×</button>`;

    hint.querySelector('.mrplug-hint-close')?.addEventListener('click', () => {
      this.deactivate();
    });

    document.body.appendChild(hint);
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
          this.selectedContext!
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
        }, 8000); // 8s — covers MV3 service worker cold-start (3-5s)
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

    // AI call delegated to background worker — no AI SDK in content script
    let response: AIResponse = await browser.runtime.sendMessage({
      type: 'ai-request',
      elementContext: this.selectedContext,
      userInput: feedback,
      conversationHistory,
      agentMode,
      sessionId,
      pageUrl: window.location.href,
    }) as AIResponse;

    if (response?.analysis) {
      try {
        await Storage.addMessageToSession(sessionId, {
          id: Storage.generateUUID(),
          role: 'assistant',
          content: response.analysis,
          timestamp: Date.now(),
        });
        await SessionSummary.autoGenerateSummary(sessionId, null);
      } catch (error) {
        console.error('[MrPlug] Failed to save assistant message to session:', error);
      }
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
