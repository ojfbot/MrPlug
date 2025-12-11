import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  Tool,
} from "@modelcontextprotocol/sdk/types.js";
import { BrowserPluginManager } from "./browser-plugin-manager.js";

/**
 * Create and configure the MCP server instance
 * @param pluginManager Browser plugin manager instance
 */
export function createMCPServer(pluginManager: BrowserPluginManager): Server {
  // Create MCP server
  const server = new Server(
    {
      name: "mrplug-mcp",
      version: "1.0.0",
    },
    {
      capabilities: {
        tools: {},
      },
    }
  );

  // Define tools available to Claude
  const tools: Tool[] = [
    {
      name: "get_browser_state",
      description:
        "Retrieve the current state of the MrPlug browser extension including active sessions, selected elements, and connection status. Use this to understand what the user is currently working on in the browser.",
      inputSchema: {
        type: "object" as const,
        properties: {
          includeSessionDetails: {
            type: "boolean",
            description:
              "Whether to include full conversation history and element context for each session. Default: false",
          },
        },
        required: [],
      },
    },
    {
      name: "get_active_session",
      description:
        "Get detailed information about the currently active feedback session including messages, element context, and metadata. This gives you full context about what UI element the user is providing feedback on.",
      inputSchema: {
        type: "object" as const,
        properties: {
          sessionId: {
            type: "string",
            description:
              "Optional: specific session ID to fetch. If not provided, returns the most recently active session.",
          },
        },
        required: [],
      },
    },
    {
      name: "get_element_context",
      description:
        "Get detailed context about a specific DOM element being tracked in the browser. Returns tag, styles, position, DOM path, and optionally a screenshot. Use this to understand the visual state of UI elements.",
      inputSchema: {
        type: "object" as const,
        properties: {
          elementHash: {
            type: "string",
            description: "Hash identifier of the element (obtained from sessions or browser state)",
          },
          includeScreenshot: {
            type: "boolean",
            description:
              "Whether to include the base64-encoded screenshot of the element. Default: false",
          },
        },
        required: ["elementHash"],
      },
    },
    {
      name: "send_browser_command",
      description:
        "Send a command to the browser plugin to perform an action. Available commands: open_browser (opens URL with element selected), select_element (highlights element), capture_screenshot (captures element screenshot), create_issue (creates GitHub issue), start_session (starts new feedback session).",
      inputSchema: {
        type: "object" as const,
        properties: {
          command: {
            type: "string",
            enum: ["open_browser", "select_element", "capture_screenshot", "create_issue", "start_session"],
            description: "The command to execute in the browser",
          },
          sessionId: {
            type: "string",
            description: "Optional: Target session ID for the command",
          },
          elementHash: {
            type: "string",
            description: "Optional: Target element hash (required for element-specific commands)",
          },
          data: {
            type: "object",
            description:
              "Optional: Additional command-specific data (e.g., url for open_browser, selector for capture_screenshot)",
          },
        },
        required: ["command"],
      },
    },
    {
      name: "list_feedback_sessions",
      description:
        "List all feedback sessions with summaries, sorted by most recent activity. Use this to see what UI feedback conversations are available.",
      inputSchema: {
        type: "object" as const,
        properties: {
          limit: {
            type: "number",
            description: "Maximum number of sessions to return. Default: 10",
          },
          activeOnly: {
            type: "boolean",
            description: "Only return currently active sessions. Default: false",
          },
        },
        required: [],
      },
    },
    {
      name: "query_session_history",
      description:
        "Query the conversation history from a specific feedback session. Returns all user and assistant messages for the session.",
      inputSchema: {
        type: "object" as const,
        properties: {
          sessionId: {
            type: "string",
            description: "Session ID to query",
          },
          limit: {
            type: "number",
            description: "Optional: Limit number of messages returned. Returns most recent if specified.",
          },
        },
        required: ["sessionId"],
      },
    },
    {
      name: "add_session_message",
      description:
        "Add a new message to a feedback session from Claude. Use this to continue conversations or provide analysis to the user in the browser extension.",
      inputSchema: {
        type: "object" as const,
        properties: {
          sessionId: {
            type: "string",
            description: "Session ID to add message to",
          },
          message: {
            type: "string",
            description: "The message content to add",
          },
          role: {
            type: "string",
            enum: ["user", "assistant"],
            description: "Message role: 'user' for user messages, 'assistant' for AI/Claude messages",
          },
        },
        required: ["sessionId", "message", "role"],
      },
    },
  ];

  // List available tools
  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools,
  }));

  // Handle tool calls
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;

    try {
      switch (name) {
        case "get_browser_state": {
          const result = await pluginManager.getBrowserState(
            (args as any)?.includeSessionDetails || false
          );
          return {
            content: [
              {
                type: "text",
                text: JSON.stringify(result, null, 2),
              },
            ],
          };
        }

        case "get_active_session": {
          const result = await pluginManager.getActiveSession((args as any)?.sessionId);
          return {
            content: [
              {
                type: "text",
                text: JSON.stringify(result, null, 2),
              },
            ],
          };
        }

        case "get_element_context": {
          const result = await pluginManager.getElementContext(
            (args as any).elementHash,
            (args as any)?.includeScreenshot || false
          );
          return {
            content: [
              {
                type: "text",
                text: JSON.stringify(result, null, 2),
              },
            ],
          };
        }

        case "send_browser_command": {
          const result = await pluginManager.sendCommand(
            (args as any).command,
            (args as any).sessionId,
            (args as any).elementHash,
            (args as any).data
          );
          return {
            content: [
              {
                type: "text",
                text: JSON.stringify(result, null, 2),
              },
            ],
          };
        }

        case "list_feedback_sessions": {
          const result = await pluginManager.listSessions(
            (args as any)?.limit || 10,
            (args as any)?.activeOnly || false
          );
          return {
            content: [
              {
                type: "text",
                text: JSON.stringify(result, null, 2),
              },
            ],
          };
        }

        case "query_session_history": {
          const result = await pluginManager.querySessionHistory(
            (args as any).sessionId,
            (args as any)?.limit
          );
          return {
            content: [
              {
                type: "text",
                text: JSON.stringify(result, null, 2),
              },
            ],
          };
        }

        case "add_session_message": {
          const result = await pluginManager.addSessionMessage(
            (args as any).sessionId,
            (args as any).message,
            (args as any).role
          );
          return {
            content: [
              {
                type: "text",
                text: JSON.stringify(result, null, 2),
              },
            ],
          };
        }

        default:
          return {
            content: [
              {
                type: "text",
                text: `Unknown tool: ${name}`,
              },
            ],
            isError: true,
          };
      }
    } catch (error) {
      console.error(`[MCP] Error executing tool ${name}:`, error);
      return {
        content: [
          {
            type: "text",
            text: `Error executing tool: ${error instanceof Error ? error.message : String(error)}`,
          },
        ],
        isError: true,
      };
    }
  });

  return server;
}
