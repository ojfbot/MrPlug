#!/usr/bin/env node
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createMCPServer } from "./server.js";
import { HttpBrowserPluginManager } from "./http-plugin-manager.js";

/**
 * STDIO MCP Server for Claude Code
 * This server uses STDIO transport for Claude Code integration
 *
 * IMPORTANT: This server connects to the HTTP server (port 3001) to fetch
 * browser state instead of maintaining its own state. The HTTP server must
 * be running for this to work.
 *
 * Usage: npx tsx mrplug-mcp-server/src/stdio-server.ts
 */

const HTTP_SERVER_URL = process.env.HTTP_SERVER_URL || "http://localhost:3001";

// Initialize HTTP-based plugin manager (fetches state from HTTP server)
const pluginManager = new HttpBrowserPluginManager(HTTP_SERVER_URL);

// Create MCP server
const mcpServer = createMCPServer(pluginManager);

// Create STDIO transport
const transport = new StdioServerTransport();

// Connect server to transport
async function main() {
  console.error("[MCP] Starting MrPlug MCP Server (STDIO transport)");
  console.error("[MCP] HTTP Server URL:", HTTP_SERVER_URL);
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
