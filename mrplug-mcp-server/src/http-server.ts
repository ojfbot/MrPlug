import express from "express";
import cors from "cors";
import { WebSocketServer, WebSocket } from "ws";
import http from "http";
import { createMCPServer } from "./server.js";
import { BrowserPluginManager } from "./browser-plugin-manager.js";

const PORT = process.env.PORT || 3001;
const WS_PORT = process.env.WS_PORT || 3002;

// Create Express app
const app = express();
app.use(cors());
app.use(express.json());

// Create HTTP server
const httpServer = http.createServer(app);

// Create WebSocket server for browser plugin communication
const wss = new WebSocketServer({ port: Number(WS_PORT) });

// Initialize plugin manager
const pluginManager = new BrowserPluginManager();

// Create MCP server
const mcpServer = createMCPServer(pluginManager);

// Info endpoint for MCP (Claude Code can query this)
app.get("/mcp/info", (req, res) => {
  res.json({
    name: "mrplug-mcp",
    version: "1.0.0",
    transport: "stdio",
    note: "Connect via STDIO transport. Use 'npx tsx mrplug-mcp-server/src/stdio-server.ts' from Claude Code config.",
    endpoints: {
      websocket: `ws://localhost:${WS_PORT}`,
      rest: {
        state: "POST /plugin/state",
        session: "POST /plugin/session",
        commands: "GET /plugin/commands",
      },
    },
  });
});

// ==================== Browser Plugin REST API ====================

// Endpoint for plugin to report state updates
app.post("/plugin/state", (req, res) => {
  const { state } = req.body;
  console.log("[Plugin] Received state update");
  pluginManager.handlePluginMessage({ type: "state_update", state });
  res.json({ success: true });
});

// Endpoint for plugin to report session updates
app.post("/plugin/session", (req, res) => {
  const { session } = req.body;
  console.log("[Plugin] Received session update:", session.id);
  pluginManager.handlePluginMessage({ type: "session_update", session });
  res.json({ success: true });
});

// Endpoint for plugin to receive queued commands
app.get("/plugin/commands", (req, res) => {
  const commands = pluginManager.getQueuedCommands();
  console.log(`[Plugin] Sent ${commands.length} queued command(s)`);
  res.json({ commands });
});

// Endpoint to check connection status
app.get("/plugin/status", (req, res) => {
  res.json({
    connected: pluginManager.isConnected(),
    timestamp: Date.now(),
  });
});

// ==================== WebSocket for Real-time Communication ====================

wss.on("connection", (ws: WebSocket, req) => {
  const connectionId = `ws_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  console.log(`[WS] New connection: ${connectionId}`);

  // Register connection
  pluginManager.registerWSConnection(connectionId, ws);

  // Send welcome message
  ws.send(
    JSON.stringify({
      type: "connected",
      connectionId,
      timestamp: Date.now(),
    })
  );

  // Handle incoming messages from browser plugin
  ws.on("message", (data: Buffer) => {
    try {
      const message = JSON.parse(data.toString());
      console.log(`[WS] Received message type: ${message.type}`);
      pluginManager.handlePluginMessage(message);

      // Send acknowledgment
      ws.send(
        JSON.stringify({
          type: "ack",
          originalType: message.type,
          timestamp: Date.now(),
        })
      );
    } catch (error) {
      console.error("[WS] Error parsing message:", error);
      ws.send(
        JSON.stringify({
          type: "error",
          message: "Failed to parse message",
          timestamp: Date.now(),
        })
      );
    }
  });

  // Handle ping/pong for keepalive
  ws.on("ping", () => {
    ws.pong();
  });

  // Handle connection close
  ws.on("close", () => {
    console.log(`[WS] Connection closed: ${connectionId}`);
    pluginManager.unregisterWSConnection(connectionId);
  });

  // Handle errors
  ws.on("error", (error) => {
    console.error(`[WS] Connection error (${connectionId}):`, error);
    pluginManager.unregisterWSConnection(connectionId);
  });
});

// ==================== Health & Status Endpoints ====================

app.get("/health", (req, res) => {
  res.json({
    status: "ok",
    mcp_endpoint: `http://localhost:${PORT}/sse`,
    ws_endpoint: `ws://localhost:${WS_PORT}`,
    plugin_connected: pluginManager.isConnected(),
    timestamp: Date.now(),
  });
});

// Get server info
app.get("/info", (req, res) => {
  res.json({
    name: "mrplug-mcp-server",
    version: "1.0.0",
    endpoints: {
      mcp_sse: `http://localhost:${PORT}/sse`,
      websocket: `ws://localhost:${WS_PORT}`,
      plugin_rest: {
        state: "POST /plugin/state",
        session: "POST /plugin/session",
        commands: "GET /plugin/commands",
        status: "GET /plugin/status",
      },
    },
    documentation: "https://github.com/ojfbot/mrplug#mcp-integration",
  });
});

// ==================== Start Servers ====================

httpServer.listen(PORT, () => {
  console.log(`
╔═══════════════════════════════════════════════════════════════╗
║              MrPlug MCP Server Started                        ║
╚═══════════════════════════════════════════════════════════════╝

MCP Endpoint (Claude Code):
  http://localhost:${PORT}/sse

WebSocket Endpoint (Browser Plugin):
  ws://localhost:${WS_PORT}

REST Endpoints (Browser Plugin):
  POST http://localhost:${PORT}/plugin/state
  POST http://localhost:${PORT}/plugin/session
  GET  http://localhost:${PORT}/plugin/commands
  GET  http://localhost:${PORT}/plugin/status

Health Check:
  GET  http://localhost:${PORT}/health
  GET  http://localhost:${PORT}/info

Ready to connect! 🚀
  `);
});

// Handle graceful shutdown
process.on("SIGINT", () => {
  console.log("\n[Server] Shutting down gracefully...");
  wss.close(() => {
    console.log("[WS] WebSocket server closed");
  });
  httpServer.close(() => {
    console.log("[HTTP] HTTP server closed");
    process.exit(0);
  });
});

process.on("SIGTERM", () => {
  console.log("\n[Server] Received SIGTERM, shutting down...");
  wss.close();
  httpServer.close(() => {
    process.exit(0);
  });
});
