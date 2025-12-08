import type { ClaudeCodePayload, ConsoleEntry } from '../types';
import { ElementCapture } from './element-capture';
import browser from 'webextension-polyfill';

export class ContextCapture {
  private static consoleBuffer: ConsoleEntry[] = [];
  private static maxConsoleEntries = 100;
  private static isMonitoring = false;

  /**
   * Start monitoring console logs
   */
  static startConsoleMonitoring() {
    if (this.isMonitoring) return;

    const originalConsole = {
      log: console.log,
      warn: console.warn,
      error: console.error,
      info: console.info,
      debug: console.debug,
    };

    const createInterceptor = (level: ConsoleEntry['level'], original: any) => {
      return (...args: any[]) => {
        // Call original console method
        original.apply(console, args);

        // Capture the log
        const message = args.map((arg) => {
          if (typeof arg === 'object') {
            try {
              return JSON.stringify(arg, null, 2);
            } catch {
              return String(arg);
            }
          }
          return String(arg);
        }).join(' ');

        const entry: ConsoleEntry = {
          level,
          message,
          timestamp: Date.now(),
        };

        // Capture stack trace for errors
        if (level === 'error') {
          entry.stack = new Error().stack;
        }

        this.consoleBuffer.push(entry);

        // Keep buffer size limited
        if (this.consoleBuffer.length > this.maxConsoleEntries) {
          this.consoleBuffer.shift();
        }
      };
    };

    console.log = createInterceptor('log', originalConsole.log);
    console.warn = createInterceptor('warn', originalConsole.warn);
    console.error = createInterceptor('error', originalConsole.error);
    console.info = createInterceptor('info', originalConsole.info);
    console.debug = createInterceptor('debug', originalConsole.debug);

    this.isMonitoring = true;
  }

  /**
   * Get captured console logs
   */
  private static getConsoleLogs(recentCount: number = 20) {
    const errors = this.consoleBuffer.filter((e) => e.level === 'error');
    const warnings = this.consoleBuffer.filter((e) => e.level === 'warn');
    const logs = this.consoleBuffer.filter((e) => e.level === 'log');
    const recent = this.consoleBuffer.slice(-recentCount);

    return { errors, warnings, logs, recent };
  }

  /**
   * Detect and extract Redux state
   */
  private static getReduxState() {
    try {
      // Try to find Redux DevTools extension state
      const windowWithRedux = window as any;

      // Check for Redux DevTools
      if (windowWithRedux.__REDUX_DEVTOOLS_EXTENSION__) {
        const store = windowWithRedux.__REDUX_DEVTOOLS_EXTENSION__.store;
        if (store && store.getState) {
          return {
            available: true,
            fullState: store.getState(),
          };
        }
      }

      // Check for common Redux store patterns
      if (windowWithRedux.store && windowWithRedux.store.getState) {
        return {
          available: true,
          fullState: windowWithRedux.store.getState(),
        };
      }

      // Check React DevTools for Redux
      if (windowWithRedux.__REACT_DEVTOOLS_GLOBAL_HOOK__) {
        // This is more complex - we'd need to traverse the fiber tree
        // For now, just mark as unavailable
        return {
          available: false,
        };
      }

      return {
        available: false,
      };
    } catch (error) {
      console.warn('[MrPlug] Failed to capture Redux state:', error);
      return {
        available: false,
      };
    }
  }

  /**
   * Capture relevant DOM context around an element
   */
  private static getRelevantDOM(element: Element) {
    const parent = element.parentElement;
    const siblings = parent ? Array.from(parent.children)
      .filter((el) => el !== element)
      .map((el) => el.outerHTML.slice(0, 500)) // Limit size
      : undefined;

    return {
      innerHTML: element.innerHTML.slice(0, 2000), // Limit size
      outerHTML: element.outerHTML.slice(0, 2000),
      siblings,
      parentHTML: parent?.outerHTML.slice(0, 2000),
    };
  }

  /**
   * Capture full page screenshot using browser API
   */
  private static async captureFullPageScreenshot(): Promise<string | undefined> {
    try {
      // Use browser.runtime API to message background script for screenshot
      const response = await browser.runtime.sendMessage({
        type: 'capture-screenshot',
      }) as { success?: boolean; dataUrl?: string };
      return response.dataUrl;
    } catch (error) {
      console.warn('[MrPlug] Failed to capture full page screenshot:', error);
      return undefined;
    }
  }

  /**
   * Main method to capture complete context for Claude Code
   */
  static async captureCompleteContext(
    element: Element,
    userComment: string,
    aiAnalysis?: { summary: string; suggestedActions: any[]; confidence: number },
    conversationHistory?: any[]
  ): Promise<ClaudeCodePayload> {
    // Capture element context
    const elementContext = await ElementCapture.captureElement(element);

    // Capture element screenshot
    let elementScreenshot: string | undefined;
    try {
      elementScreenshot = await ElementCapture.captureScreenshot(element);
    } catch (error) {
      console.warn('[MrPlug] Failed to capture element screenshot:', error);
    }

    // Capture full page screenshot
    const fullPageScreenshot = await this.captureFullPageScreenshot();

    // Get DOM context
    const relevantDOM = this.getRelevantDOM(element);

    // Get Redux state
    const reduxState = this.getReduxState();

    // Get console logs
    const consoleLogs = this.getConsoleLogs();

    // Build the payload
    const payload: ClaudeCodePayload = {
      userComment,
      timestamp: Date.now(),
      pageUrl: window.location.href,
      elementContext,
      elementScreenshot,
      fullPageScreenshot,
      relevantDOM,
      reduxState,
      consoleLogs,
      aiAnalysis,
      conversationHistory,
    };

    // Log the structured payload to console for inspection
    console.log('[MrPlug] Claude Code Payload:', payload);
    console.log('[MrPlug] Payload JSON:', JSON.stringify(payload, null, 2));

    return payload;
  }
}
