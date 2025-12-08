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
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
}

export interface AIResponse {
  analysis: string;
  suggestedActions: SuggestedAction[];
  requiresCodeChange: boolean;
  confidence: number;
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
  githubRepo?: string;
  claudeCodeEnabled: boolean;

  // General settings
  autoScreenshot: boolean;
  keyboardShortcut: string;
  theme?: 'light' | 'dark' | 'auto';
  localAppPath?: string;
}

export interface StorageData {
  config: ExtensionConfig;
  conversationHistory: ConversationMessage[];
  recentFeedback: FeedbackRequest[];
}
