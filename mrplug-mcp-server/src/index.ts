/**
 * MrPlug Relay Server
 *
 * Lightweight HTTP bridge between the MrPlug browser extension and a running
 * Claude Code terminal session.
 *
 * Flow:
 *   1. Extension POSTs element context to POST /submit
 *   2. Relay stores it in memory and writes ~/.mrplug/pending.json
 *   3. Claude Code UserPromptSubmit hook reads + consumes the payload
 *      and prepends it to the user's next message
 *
 * Start: pnpm start  (or pnpm dev for watch mode)
 * Default port: 27182
 */

import express from 'express';
import cors from 'cors';
import { promises as fs } from 'fs';
import path from 'path';
import os from 'os';

const PORT = parseInt(process.env.PORT || '27182', 10);
const PAYLOAD_DIR = path.join(os.homedir(), '.mrplug');
const PAYLOAD_FILE = path.join(PAYLOAD_DIR, 'pending.json');

const app = express();
app.use(cors({ origin: '*' }));
app.use(express.json({ limit: '10mb' }));

// In-memory store — last submitted payload
let pendingPayload: Record<string, unknown> | null = null;
let pendingReceivedAt = 0;

async function ensurePayloadDir() {
  try {
    await fs.mkdir(PAYLOAD_DIR, { recursive: true });
  } catch {
    // Already exists
  }
}

/**
 * POST /submit
 * Extension sends the MrPlug context payload here.
 */
app.post('/submit', async (req, res) => {
  const payload = req.body as Record<string, unknown>;
  pendingPayload = payload;
  pendingReceivedAt = Date.now();

  // Persist to disk so hooks survive relay restarts within a short window
  try {
    await ensurePayloadDir();
    await fs.writeFile(PAYLOAD_FILE, JSON.stringify({ payload, receivedAt: pendingReceivedAt }, null, 2));
  } catch (err) {
    console.warn('[mrplug-relay] Could not write payload file:', err);
  }

  const summary = buildSummary(payload);
  console.log(`[mrplug-relay] Payload received: ${summary}`);
  res.json({ success: true, summary });
});

/**
 * GET /consume
 * Claude Code hook calls this to read-and-consume the pending payload.
 * Returns 204 if nothing pending.
 */
app.get('/consume', async (req, res) => {
  // Try memory first, then disk
  if (!pendingPayload) {
    try {
      const raw = await fs.readFile(PAYLOAD_FILE, 'utf-8');
      const stored = JSON.parse(raw) as { payload: Record<string, unknown>; receivedAt: number };
      // Only honour payloads younger than 10 minutes
      if (Date.now() - stored.receivedAt < 10 * 60 * 1000) {
        pendingPayload = stored.payload;
        pendingReceivedAt = stored.receivedAt;
      }
    } catch {
      // No file or invalid JSON
    }
  }

  if (!pendingPayload) {
    res.status(204).send();
    return;
  }

  const payload = pendingPayload;
  pendingPayload = null;

  // Remove file after consuming
  try {
    await fs.unlink(PAYLOAD_FILE);
  } catch {
    // Already gone
  }

  res.json({ success: true, payload });
});

/**
 * GET /status
 * Simple health check.
 */
app.get('/status', (_req, res) => {
  res.json({
    status: 'running',
    port: PORT,
    hasPendingPayload: pendingPayload !== null,
    pendingAge: pendingPayload ? Date.now() - pendingReceivedAt : null,
  });
});

function buildSummary(payload: Record<string, unknown>): string {
  const ctx = payload.elementContext as Record<string, unknown> | undefined;
  const url = (payload.pageUrl as string) || 'unknown';
  const tag = ctx?.tagName as string | undefined;
  const comment = (payload.userComment as string | undefined)?.slice(0, 60);
  return `<${tag || '?'}> on ${url}${comment ? ` — "${comment}"` : ''}`;
}

app.listen(PORT, '127.0.0.1', () => {
  console.log(`[mrplug-relay] Listening on http://127.0.0.1:${PORT}`);
  console.log(`[mrplug-relay] Payloads written to ${PAYLOAD_FILE}`);
  console.log(`[mrplug-relay] Claude Code hook: curl -s http://127.0.0.1:${PORT}/consume | jq .`);
});
