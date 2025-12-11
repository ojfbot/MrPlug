/**
 * MCP Client for Browser Extension
 * Handles bi-directional communication with the MCP server
 */

import type { ChatSession } from '../types';
import { Storage } from './storage';

export interface MCPConfig {
  serverUrl: string;
  wsUrl: string;
  enabled: boolean;
  pollInterval?: number; // milliseconds
}

export class MCPClient {
  private config: MCPConfig;
  private ws: WebSocket | null = null;
  private reconnectTimer: number | null = null;
  private stateUpdateTimer: number | null = null;
  private commandPollTimer: number | null = null;
  private isConnected: boolean = false;
  private reconnectAttempts: number = 0;
  private maxReconnectAttempts: number = 5;

  constructor(config: MCPConfig) {
    this.config = {
      pollInterval: 5000, // 5 seconds default
      ...config,
    };
  }

  /**
   * Initialize MCP client and establish connection
   */
  async initialize(): Promise<void> {
    if (!this.config.enabled) {
      console.log('[MCP Client] Disabled in config');
      return;
    }

    console.log('[MCP Client] Initializing...');
    await this.connectWebSocket();
    this.startStateSync();
    this.startCommandPolling();
  }

  /**
   * Connect to MCP server via WebSocket
   */
  private async connectWebSocket(): Promise<void> {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      console.log('[MCP Client] Already connected');
      return;
    }

    try {
      console.log('[MCP Client] Connecting to WebSocket:', this.config.wsUrl);
      this.ws = new WebSocket(this.config.wsUrl);

      this.ws.onopen = () => {
        console.log('[MCP Client] WebSocket connected');
        this.isConnected = true;
        this.reconnectAttempts = 0;
      };

      this.ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          this.handleServerMessage(message);
        } catch (error) {
          console.error('[MCP Client] Failed to parse message:', error);
        }
      };

      this.ws.onerror = (error) => {
        console.error('[MCP Client] WebSocket error:', error);
        this.isConnected = false;
      };

      this.ws.onclose = () => {
        console.log('[MCP Client] WebSocket closed');
        this.isConnected = false;
        this.scheduleReconnect();
      };
    } catch (error) {
      console.error('[MCP Client] Failed to connect:', error);
      this.scheduleReconnect();
    }
  }

  /**
   * Schedule reconnection attempt with exponential backoff
   */
  private scheduleReconnect(): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('[MCP Client] Max reconnect attempts reached, giving up');
      return;
    }

    if (this.reconnectTimer !== null) {
      return; // Already scheduled
    }

    const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 30000);
    this.reconnectAttempts++;

    console.log(`[MCP Client] Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts})`);

    this.reconnectTimer = window.setTimeout(() => {
      this.reconnectTimer = null;
      this.connectWebSocket();
    }, delay);
  }

  /**
   * Send message to server via WebSocket
   */
  private sendWebSocketMessage(message: any): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      console.warn('[MCP Client] WebSocket not connected, cannot send message');
      return;
    }

    try {
      this.ws.send(JSON.stringify(message));
    } catch (error) {
      console.error('[MCP Client] Failed to send message:', error);
    }
  }

  /**
   * Handle incoming messages from MCP server
   */
  private handleServerMessage(message: any): void {
    console.log('[MCP Client] Received message:', message.type);

    switch (message.type) {
      case 'connected':
        console.log('[MCP Client] Connection confirmed:', message.connectionId);
        break;

      case 'command':
        this.handleCommand(message.payload);
        break;

      case 'session_message':
        this.handleSessionMessage(message);
        break;

      case 'ack':
        console.log('[MCP Client] Server acknowledged:', message.originalType);
        break;

      case 'error':
        console.error('[MCP Client] Server error:', message.message);
        break;

      default:
        console.warn('[MCP Client] Unknown message type:', message.type);
    }
  }

  /**
   * Handle command from Claude via MCP server
   */
  private async handleCommand(command: any): Promise<void> {
    console.log('[MCP Client] Executing command:', command.command);

    try {
      switch (command.command) {
        case 'open_browser':
          await this.handleOpenBrowser(command);
          break;

        case 'select_element':
          await this.handleSelectElement(command);
          break;

        case 'capture_screenshot':
          await this.handleCaptureScreenshot(command);
          break;

        case 'create_issue':
          await this.handleCreateIssue(command);
          break;

        case 'start_session':
          await this.handleStartSession(command);
          break;

        default:
          console.warn('[MCP Client] Unknown command:', command.command);
      }

      // Send command response
      this.sendWebSocketMessage({
        type: 'command_response',
        commandId: command.id,
        success: true,
        timestamp: Date.now(),
      });
    } catch (error) {
      console.error('[MCP Client] Command execution failed:', error);
      this.sendWebSocketMessage({
        type: 'command_response',
        commandId: command.id,
        success: false,
        error: error instanceof Error ? error.message : String(error),
        timestamp: Date.now(),
      });
    }
  }

  /**
   * Handle open_browser command - opens URL with element selected
   */
  private async handleOpenBrowser(command: any): Promise<void> {
    const { data } = command;

    if (!data?.url) {
      console.error('[MCP Client] open_browser requires url in data');
      return;
    }

    // Open new tab with URL
    const tab = await chrome.tabs.create({ url: data.url });

    // If elementHash is provided, select element after page loads
    if (command.elementHash && tab.id) {
      // Wait for page to load
      await new Promise((resolve) => setTimeout(resolve, 1000));

      // Send message to content script to highlight element
      await chrome.tabs.sendMessage(tab.id, {
        type: 'highlight-element',
        elementHash: command.elementHash,
      });
    }
  }

  /**
   * Handle select_element command - highlights element in current tab
   */
  private async handleSelectElement(command: any): Promise<void> {
    if (!command.elementHash) {
      console.error('[MCP Client] select_element requires elementHash');
      return;
    }

    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tabs[0]?.id) {
      await chrome.tabs.sendMessage(tabs[0].id, {
        type: 'highlight-element',
        elementHash: command.elementHash,
      });
    }
  }

  /**
   * Handle capture_screenshot command
   */
  private async handleCaptureScreenshot(command: any): Promise<void> {
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tabs[0]?.id) {
      const dataUrl = await chrome.tabs.captureVisibleTab(undefined, {
        format: 'png',
      });

      // Send screenshot back to MCP server
      this.sendWebSocketMessage({
        type: 'screenshot_captured',
        commandId: command.id,
        dataUrl,
        timestamp: Date.now(),
      });
    }
  }

  /**
   * Handle create_issue command
   */
  private async handleCreateIssue(command: any): Promise<void> {
    // Trigger GitHub issue creation via content script/popup
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tabs[0]?.id) {
      await chrome.tabs.sendMessage(tabs[0].id, {
        type: 'create-issue',
        data: command.data,
      });
    }
  }

  /**
   * Handle start_session command
   */
  private async handleStartSession(command: any): Promise<void> {
    // Activate feedback mode and start new session
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tabs[0]?.id) {
      await chrome.tabs.sendMessage(tabs[0].id, {
        type: 'toggle-feedback',
        elementHash: command.elementHash,
      });
    }
  }

  /**
   * Handle session_message from Claude
   */
  private async handleSessionMessage(message: any): Promise<void> {
    console.log('[MCP Client] Adding message to session:', message.sessionId);

    // Update session in storage
    const sessions = await Storage.getChatSessions();
    const session = sessions.find((s) => s.id === message.sessionId);

    if (session) {
      session.messages.push(message.message);
      session.updatedAt = Date.now();
      session.lastMessageAt = Date.now();
      await Storage.updateChatSession(session);

      // Notify content script if session is active
      const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tabs[0]?.id) {
        await chrome.tabs.sendMessage(tabs[0].id, {
          type: 'session-updated',
          sessionId: message.sessionId,
        });
      }
    }
  }

  /**
   * Start periodic state synchronization
   */
  private startStateSync(): void {
    // Send initial state
    this.sendStateUpdate();

    // Set up periodic updates
    this.stateUpdateTimer = window.setInterval(() => {
      this.sendStateUpdate();
    }, this.config.pollInterval!);

    console.log('[MCP Client] State sync started');
  }

  /**
   * Send current state to MCP server
   */
  private async sendStateUpdate(): Promise<void> {
    try {
      const sessions = await Storage.getChatSessions();
      const activeSessions = sessions.filter((s) => s.isActive);

      const state = {
        isConnected: true,
        activeSessions: activeSessions.map((s) => s.id),
        selectedElement: activeSessions[0]?.elementHash || null,
        lastUpdateTime: Date.now(),
        metadata: {
          pluginVersion: '0.1.0',
          tabsWithPlugin: await this.getActiveLocalhostTabs(),
        },
      };

      // Send via WebSocket if connected
      if (this.isConnected) {
        this.sendWebSocketMessage({ type: 'state_update', state });
      }

      // Also send via REST API as fallback
      await fetch(`${this.config.serverUrl}/plugin/state`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ state }),
      });
    } catch (error) {
      console.error('[MCP Client] Failed to send state update:', error);
    }
  }

  /**
   * Send session update to MCP server
   */
  async sendSessionUpdate(session: ChatSession): Promise<void> {
    try {
      // Send via WebSocket if connected
      if (this.isConnected) {
        this.sendWebSocketMessage({ type: 'session_update', session });
      }

      // Also send via REST API as fallback
      await fetch(`${this.config.serverUrl}/plugin/session`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session }),
      });
    } catch (error) {
      console.error('[MCP Client] Failed to send session update:', error);
    }
  }

  /**
   * Start polling for commands from MCP server
   */
  private startCommandPolling(): void {
    this.commandPollTimer = window.setInterval(async () => {
      await this.pollCommands();
    }, 2000); // Poll every 2 seconds

    console.log('[MCP Client] Command polling started');
  }

  /**
   * Poll for commands from MCP server (fallback for WebSocket)
   */
  private async pollCommands(): Promise<void> {
    if (this.isConnected) {
      return; // Skip if WebSocket is active
    }

    try {
      const response = await fetch(`${this.config.serverUrl}/plugin/commands`);
      const { commands } = await response.json();

      for (const command of commands) {
        await this.handleCommand(command);
      }
    } catch (error) {
      console.error('[MCP Client] Failed to poll commands:', error);
    }
  }

  /**
   * Get list of active localhost tabs
   */
  private async getActiveLocalhostTabs(): Promise<string[]> {
    const tabs = await chrome.tabs.query({});
    return tabs
      .filter((tab) => {
        if (!tab.url) return false;
        try {
          const url = new URL(tab.url);
          return url.hostname === 'localhost' || url.hostname === '127.0.0.1';
        } catch {
          return false;
        }
      })
      .map((tab) => tab.url!);
  }

  /**
   * Disconnect from MCP server
   */
  disconnect(): void {
    console.log('[MCP Client] Disconnecting...');

    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }

    if (this.reconnectTimer !== null) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    if (this.stateUpdateTimer !== null) {
      clearInterval(this.stateUpdateTimer);
      this.stateUpdateTimer = null;
    }

    if (this.commandPollTimer !== null) {
      clearInterval(this.commandPollTimer);
      this.commandPollTimer = null;
    }

    this.isConnected = false;
  }

  /**
   * Check if connected to MCP server
   */
  isConnectedToServer(): boolean {
    return this.isConnected;
  }
}
