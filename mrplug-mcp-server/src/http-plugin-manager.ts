import { BrowserPluginManager } from "./browser-plugin-manager.js";

/**
 * HTTP-based Browser Plugin Manager
 *
 * This manager connects to the HTTP server's REST API to fetch browser state
 * instead of maintaining its own WebSocket connections. This allows the STDIO
 * server (for Claude Code) to query the same state as the HTTP server.
 *
 * Architecture:
 * - Browser Extension <--WebSocket--> HTTP Server (holds state)
 * - Claude Code <--STDIO--> STDIO Server --HTTP--> HTTP Server (queries state)
 */
export class HttpBrowserPluginManager extends BrowserPluginManager {
  private httpServerUrl: string;

  constructor(httpServerUrl: string) {
    super();
    this.httpServerUrl = httpServerUrl;
  }

  /**
   * Override getBrowserState to fetch from HTTP server
   */
  async getBrowserState(includeDetails: boolean = false): Promise<any> {
    try {
      const response = await fetch(`${this.httpServerUrl}/plugin/status`);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      const data = await response.json();

      // If details requested, fetch sessions too
      if (includeDetails && data.sessionCount > 0) {
        const sessionsResponse = await fetch(`${this.httpServerUrl}/plugin/sessions`);
        if (sessionsResponse.ok) {
          const sessionsData = await sessionsResponse.json();
          data.sessions = sessionsData.sessions;
        }
      }

      return data;
    } catch (error: any) {
      console.error("[HTTP Plugin Manager] Failed to fetch browser state:", error.message);
      // Return empty state on error
      return {
        isConnected: false,
        activeSessions: [],
        selectedElement: null,
        lastUpdateTime: Date.now(),
        metadata: {
          pluginVersion: "unknown",
          tabsWithPlugin: [],
        },
        error: error.message,
      };
    }
  }

  /**
   * Override sendCommand to send via HTTP server
   */
  async sendCommand(
    command: string,
    sessionId?: string,
    elementHash?: string,
    data?: any
  ): Promise<{ success: boolean; commandId: string; message: string }> {
    try {
      const response = await fetch(`${this.httpServerUrl}/plugin/command`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          command,
          sessionId,
          elementHash,
          data,
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      return await response.json();
    } catch (error: any) {
      console.error("[HTTP Plugin Manager] Failed to send command:", error.message);
      return {
        success: false,
        commandId: "",
        message: `Failed to send command: ${error.message}`,
      };
    }
  }

  /**
   * Override getFullSession to fetch from HTTP server
   */
  async getFullSession(sessionId: string): Promise<any> {
    try {
      const response = await fetch(`${this.httpServerUrl}/plugin/session/${sessionId}`);
      if (!response.ok) {
        if (response.status === 404) {
          return null;
        }
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      return await response.json();
    } catch (error: any) {
      console.error("[HTTP Plugin Manager] Failed to fetch session:", error.message);
      return null;
    }
  }

  /**
   * Override listSessions to fetch from HTTP server
   */
  async listSessions(): Promise<any[]> {
    try {
      const response = await fetch(`${this.httpServerUrl}/plugin/sessions`);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      const data = await response.json();
      return data.sessions || [];
    } catch (error: any) {
      console.error("[HTTP Plugin Manager] Failed to list sessions:", error.message);
      return [];
    }
  }
}
