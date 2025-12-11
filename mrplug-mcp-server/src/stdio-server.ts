#!/usr/bin/env node
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createMCPServer } from "./server.js";
import { BrowserPluginManager } from "./browser-plugin-manager.js";

/**
 * STDIO MCP Server for Claude Code
 * This server uses STDIO transport for Claude Code integration
 *
 * Usage: npx tsx mrplug-mcp-server/src/stdio-server.ts
 */

// Initialize plugin manager (connects to HTTP server for browser state)
const pluginManager = new BrowserPluginManager();

// Create MCP server
const mcpServer = createMCPServer(pluginManager);

// Create STDIO transport
const transport = new StdioServerTransport();

// Connect server to transport
async function main() {
  console.error("[MCP] Starting MrPlug MCP Server (STDIO transport)");
  console.error("[MCP] Waiting for Claude Code connection...");

  try {
    await mcpServer.connect(transport);
    console.error("[MCP] Connected successfully");
  } catch (error) {
    console.error("[MCP] Connection error:", error);
    process.exit(1);
  }
}

main().catch((error) => {
  console.error("[MCP] Fatal error:", error);
  process.exit(1);
});
