export interface ElementContext {
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
  parentContext?: Partial<ElementContext>;
  /**
   * Module Federation: origins of remoteEntry.js scripts loaded on the page
   * (e.g. ["http://localhost:3000"]).  Background resolves these against
   * projectMappings to find the owning repo — more precise than page URL alone
   * when the shell hosts multiple remotes.
   * Populated by ElementCapture; undefined on non-MF pages.
   */
  mfRemoteOrigins?: string[];
  /**
   * Value of the nearest ancestor's data-mf-remote attribute, if present.
   * Shell should set this on each remote mount point, e.g.:
   *   <div data-mf-remote="cv-builder" id="remote-mount" />
   * More precise than script-tag scanning when multiple remotes coexist.
   */
  mfRemoteName?: string;
}

export interface FeedbackRequest {
  elementContext: ElementContext;
  userInput: string;
  pageUrl: string;
  timestamp: number;
  conversationHistory?: ConversationMessage[];
  agentMode?: 'ui' | 'ux';
}

export interface ConversationMessage {
  id: string; // UUID for stable React keys
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
  isStreaming?: boolean;
  metadata?: {
    source?: 'mcp' | 'local' | 'extension';
    mcpActivity?: string;
    toolCalls?: string[];
  };
}

export interface AIResponse {
  analysis: string;
  suggestedActions: SuggestedAction[];
  requiresCodeChange: boolean;
  confidence: number;
  // Rich issue fields — populated by UX/UI agent when suggesting a github-issue action
  issueTitle?: string;
  issueDescription?: string;
  acceptanceCriteria?: string[];
  openQuestions?: string[];
}

export interface SuggestedAction {
  type: 'github-issue' | 'claude-code' | 'manual';
  title: string;
  description: string;
  priority: 'low' | 'medium' | 'high';
  metadata?: Record<string, any>;
}

export interface GitHubIssueData {
  title: string;
  body: string;
  labels: string[];
  assignees?: string[];
  screenshot?: string;
  // Rich fields
  acceptanceCriteria?: string[];
  openQuestions?: string[];
  elementContext?: ElementContext;
  pageUrl?: string;
  elementScreenshot?: string;  // data URL — will be uploaded via GitHub Contents API
  viewportScreenshot?: string; // data URL
}

export interface ProjectMapping {
  /** hostname pattern, e.g. "cv.jim.software" or "localhost:3000" */
  hostname: string;
  /** GitHub repo in "owner/repo" format */
  githubRepo: string;
  /** Absolute path to local source, used in Claude Code payloads */
  localPath?: string;
}

export interface ClaudeCodeCommand {
  type: 'edit' | 'refactor' | 'style';
  targetFile?: string;
  targetSelector?: string;
  instruction: string;
  context: ElementContext;
}

export interface ClaudeCodePayload {
  // Core feedback data
  userComment: string;
  timestamp: number;
  pageUrl: string;

  // Element & visual context
  elementContext: ElementContext;
  elementScreenshot?: string;
  fullPageScreenshot?: string;

  // DOM context
  relevantDOM: {
    innerHTML: string;
    outerHTML: string;
    siblings?: string[];
    parentHTML?: string;
  };

  // State management (if available)
  reduxState?: {
    available: boolean;
    relevantSlices?: Record<string, any>;
    fullState?: any;
  };

  // Console logs
  consoleLogs?: {
    errors: ConsoleEntry[];
    warnings: ConsoleEntry[];
    logs: ConsoleEntry[];
    recent: ConsoleEntry[]; // Last N entries before feedback
  };

  // AI analysis (if available)
  aiAnalysis?: {
    summary: string;
    suggestedActions: SuggestedAction[];
    confidence: number;
  };

  // Conversation context
  conversationHistory?: ConversationMessage[];
}

export interface ConsoleEntry {
  level: 'log' | 'warn' | 'error' | 'info' | 'debug';
  message: string;
  timestamp: number;
  stack?: string;
}

export interface ExtensionConfig {
  // LLM Provider settings
  llmProvider?: 'openai' | 'anthropic' | 'none';
  openaiApiKey?: string;
  anthropicApiKey?: string;

  // Integration settings
  githubToken?: string;
  githubRepo?: string;  // fallback single repo (legacy); prefer projectMappings
  claudeCodeEnabled: boolean;

  // Frame OS dev routing — when set, AI calls route through frame-agent instead of direct API
  // Dev mode only: set to 'http://localhost:4001' in env.json builds; leave unset for production
  frameAgentUrl?: string;

  // MCP Server settings
  mcpEnabled?: boolean;
  mcpServerUrl?: string;
  mcpWsUrl?: string;

  // Claude Code relay — lightweight HTTP server that bridges extension → Claude Code terminal session
  // Default: http://localhost:27182
  claudeCodeRelayUrl?: string;

  // Per-hostname project mappings (hostname → GitHub repo + local path)
  projectMappings?: ProjectMapping[];

  // General settings
  autoScreenshot: boolean;
  keyboardShortcut: string;
  theme?: 'light' | 'dark' | 'auto';
  localAppPath?: string;  // legacy; prefer projectMappings[].localPath
}

export interface ChatSession {
  id: string; // UUID
  elementHash: string;
  title: string;
  summary: string | null;
  messages: ConversationMessage[];
  elementContext: ElementContext;
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

export interface SessionListItem {
  id: string;
  title: string;
  summary: string | null;
  lastMessageAt: number;
  messageCount: number;
  isActive: boolean;
  elementHash: string;
}

export interface StorageData {
  config: ExtensionConfig;
  conversationHistory: ConversationMessage[]; // DEPRECATED - for migration
  recentFeedback: FeedbackRequest[];
  chatSessions: ChatSession[];
  activeSessionId: string | null;
  sessionHashIndex: Record<string, string>; // elementHash -> sessionId
}
