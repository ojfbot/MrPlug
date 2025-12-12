import { EventEmitter } from "events";
import type { WebSocket } from "ws";

// Browser extension state interface
interface BrowserState {
  isConnected: boolean;
  activeSessions: string[];
  selectedElement: string | null;
  lastUpdateTime: number;
  metadata: {
    pluginVersion: string;
    tabsWithPlugin: string[];
  };
}

// Session summary interface
interface SessionData {
  id: string;
  elementHash: string;
  title: string;
  summary: string | null;
  messageCount: number;
  isActive: boolean;
  createdAt: number;
  lastMessageAt: number;
}

// Full session with messages and element context
interface FullSession {
  id: string;
  elementHash: string;
  title: string;
  summary: string | null;
  messages: Array<{
    id: string;
    role: "user" | "assistant";
    content: string;
    timestamp: number;
  }>;
  elementContext: {
    tagName: string;
    id?: string;
    classList: string[];
    textContent?: string;
    computedStyles: Record<string, string>;
    boundingRect: {
      top: number;
      left: number;
      width: number;
      height: number;
    };
    domPath: string;
    screenshot?: string;
  };
  createdAt: number;
  updatedAt: number;
  lastMessageAt: number;
  isActive: boolean;
  metadata?: {
    pageUrl: string;
    messageCount: number;
    hasAIAnalysis: boolean;
  };
}

// Command interface
interface BrowserCommand {
  id: string;
  command: string;
  sessionId?: string;
  elementHash?: string;
  data?: any;
  timestamp: number;
}

/**
 * Manages communication between MCP server and browser extension
 * Handles state synchronization, command queuing, and event broadcasting
 */
export class BrowserPluginManager extends EventEmitter {
  private browserState: BrowserState;
  private sessionStore: Map<string, FullSession> = new Map();
  private commandQueue: Array<BrowserCommand> = [];
  private wsConnections: Map<string, WebSocket> = new Map();
  private implementationQueue: any[] = [];

  constructor() {
    super();
    this.browserState = {
      isConnected: false,
      activeSessions: [],
      selectedElement: null,
      lastUpdateTime: Date.now(),
      metadata: {
        pluginVersion: "0.1.0",
        tabsWithPlugin: [],
      },
    };
  }

  /**
   * Get current browser extension state
   * @param includeDetails Whether to include full session data
   */
  async getBrowserState(includeDetails: boolean = false): Promise<BrowserState & { sessions?: FullSession[] }> {
    const state = { ...this.browserState };

    if (includeDetails) {
      return {
        ...state,
        sessions: Array.from(this.sessionStore.values()),
      };
    }

    return state;
  }

  /**
   * Get specific session by ID or the active session
   * @param sessionId Optional session ID, uses first active if not provided
   */
  async getActiveSession(sessionId?: string): Promise<FullSession> {
    const id = sessionId || this.browserState.activeSessions[0];

    if (!id) {
      throw new Error("No active session found");
    }

    const session = this.sessionStore.get(id);
    if (!session) {
      throw new Error(`Session ${id} not found`);
    }

    return session;
  }

  /**
   * Get element context by hash
   * @param elementHash Hash identifier of the element
   * @param includeScreenshot Whether to include screenshot data
   */
  async getElementContext(
    elementHash: string,
    includeScreenshot: boolean = false
  ): Promise<FullSession["elementContext"] | null> {
    // Query the session store for element context
    for (const session of this.sessionStore.values()) {
      if (session.elementHash === elementHash) {
        const context = { ...session.elementContext };
        if (!includeScreenshot) {
          delete context.screenshot;
        }
        return context;
      }
    }

    throw new Error(`Element ${elementHash} not found in any session`);
  }

  /**
   * Send command to browser extension
   * @param command Command type
   * @param sessionId Optional session ID
   * @param elementHash Optional element hash
   * @param data Optional command data
   */
  async sendCommand(
    command: string,
    sessionId?: string,
    elementHash?: string,
    data?: any
  ): Promise<{ success: boolean; commandId: string; message: string }> {
    const commandId = `cmd_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    const commandPayload: BrowserCommand = {
      id: commandId,
      command,
      sessionId,
      elementHash,
      data,
      timestamp: Date.now(),
    };

    // Add to queue
    this.commandQueue.push(commandPayload);

    // Broadcast to connected clients
    this.broadcastToPlugin({ type: "command", payload: commandPayload });

    return {
      success: true,
      commandId,
      message: `Command '${command}' queued for browser extension`,
    };
  }

  /**
   * List feedback sessions with optional filtering
   * @param limit Maximum number of sessions to return
   * @param activeOnly Only return active sessions
   */
  async listSessions(limit: number = 10, activeOnly: boolean = false): Promise<SessionData[]> {
    let sessions = Array.from(this.sessionStore.values());

    if (activeOnly) {
      sessions = sessions.filter((s) => s.isActive);
    }

    // Sort by last message time (most recent first)
    sessions.sort((a, b) => b.lastMessageAt - a.lastMessageAt);

    return sessions.slice(0, limit).map((s) => ({
      id: s.id,
      elementHash: s.elementHash,
      title: s.title,
      summary: s.summary,
      messageCount: s.messages?.length || 0,
      isActive: s.isActive,
      createdAt: s.createdAt,
      lastMessageAt: s.lastMessageAt,
    }));
  }

  /**
   * Get full session details including messages and element context
   * @param sessionId Session ID
   */
  async getFullSession(sessionId: string): Promise<FullSession | null> {
    const session = this.sessionStore.get(sessionId);
    return session || null;
  }

  /**
   * Query conversation history from a session
   * @param sessionId Session ID
   * @param limit Optional limit on number of messages
   */
  async querySessionHistory(sessionId: string, limit?: number): Promise<FullSession["messages"]> {
    const session = this.sessionStore.get(sessionId);
    if (!session) {
      throw new Error(`Session ${sessionId} not found`);
    }

    let messages = session.messages || [];
    if (limit) {
      messages = messages.slice(-limit);
    }
    return messages;
  }

  /**
   * Add message to a session from Claude
   * @param sessionId Session ID
   * @param message Message content
   * @param role Message role (user or assistant)
   */
  async addSessionMessage(
    sessionId: string,
    message: string,
    role: "user" | "assistant"
  ): Promise<{ success: boolean; messageId: string }> {
    const session = this.sessionStore.get(sessionId);
    if (!session) {
      throw new Error(`Session ${sessionId} not found`);
    }

    const messageId = `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const messageObj = {
      id: messageId,
      content: message,
      role,
      timestamp: Date.now(),
    };

    if (!session.messages) {
      session.messages = [];
    }
    session.messages.push(messageObj);
    session.lastMessageAt = Date.now();
    session.updatedAt = Date.now();

    if (session.metadata) {
      session.metadata.messageCount = session.messages.length;
    }

    // Notify browser extension of new message
    this.broadcastToPlugin({
      type: "session_message",
      sessionId,
      message: messageObj,
    });

    return { success: true, messageId };
  }

  /**
   * Handle messages from browser extension
   * @param message Message from browser plugin
   */
  handlePluginMessage(message: any): void {
    console.log("[Plugin Message]", message.type);

    if (message.type === "state_update") {
      this.browserState = {
        ...message.state,
        isConnected: true,
        lastUpdateTime: Date.now(),
      };
      this.emit("state_change", this.browserState);
    } else if (message.type === "session_update") {
      this.sessionStore.set(message.session.id, message.session);

      // Update active sessions list
      if (message.session.isActive && !this.browserState.activeSessions.includes(message.session.id)) {
        this.browserState.activeSessions.push(message.session.id);
      } else if (!message.session.isActive) {
        this.browserState.activeSessions = this.browserState.activeSessions.filter(
          (id) => id !== message.session.id
        );
      }

      this.emit("session_change", message.session);
    } else if (message.type === "command_response") {
      // Handle command responses from plugin
      this.emit("command_response", message);
    } else if (message.type === "ping") {
      // Handle ping/keepalive
      this.browserState.isConnected = true;
      this.browserState.lastUpdateTime = Date.now();
    }
  }

  /**
   * Broadcast message to all connected browser plugin instances
   * @param message Message to broadcast
   */
  broadcastToPlugin(message: any): void {
    console.log("[MCP -> Plugin]", message.type);

    // Send to all connected WebSocket clients
    for (const [id, ws] of this.wsConnections.entries()) {
      if (ws.readyState === 1) {
        // WebSocket.OPEN
        try {
          ws.send(JSON.stringify(message));
        } catch (error) {
          console.error(`[WS] Failed to send to ${id}:`, error);
          this.wsConnections.delete(id);
        }
      } else {
        // Clean up closed connections
        this.wsConnections.delete(id);
      }
    }
  }

  /**
   * Register WebSocket connection from browser plugin
   * @param id Connection ID
   * @param ws WebSocket instance
   */
  registerWSConnection(id: string, ws: WebSocket): void {
    console.log(`[WS] Registered connection: ${id}`);
    this.wsConnections.set(id, ws);
    this.browserState.isConnected = true;
  }

  /**
   * Unregister WebSocket connection
   * @param id Connection ID
   */
  unregisterWSConnection(id: string): void {
    console.log(`[WS] Unregistered connection: ${id}`);
    this.wsConnections.delete(id);

    if (this.wsConnections.size === 0) {
      this.browserState.isConnected = false;
    }
  }

  /**
   * Get queued commands and clear the queue
   * Used by browser extension to poll for commands
   */
  getQueuedCommands(): BrowserCommand[] {
    const commands = [...this.commandQueue];
    this.commandQueue = [];
    return commands;
  }

  /**
   * Get connection status
   */
  isConnected(): boolean {
    return this.wsConnections.size > 0 || this.browserState.isConnected;
  }

  /**
   * Queue an implementation request from the browser
   */
  queueImplementationRequest(request: any): void {
    this.implementationQueue.push(request);
    console.log(`[Implementation Queue] Added request ${request.id}, queue size: ${this.implementationQueue.length}`);
  }

  /**
   * Get all pending implementation requests (for Claude Code to poll)
   */
  getImplementationRequests(): any[] {
    const requests = [...this.implementationQueue];
    this.implementationQueue = [];  // Clear queue after retrieval
    return requests;
  }
}
