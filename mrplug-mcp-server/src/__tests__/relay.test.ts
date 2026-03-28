/**
 * Relay server integration tests
 *
 * Spawns the relay on a test port (27183) using tsx, then exercises the HTTP
 * contract that underpins the banner auto-clear feature:
 *
 *   POST /submit  → stores payload
 *   GET /consume?path=<wrong>  → 204, payload stays
 *   GET /status  → hasPendingPayload: true
 *   GET /consume?path=<right>  → 200, payload consumed
 *   GET /status  → hasPendingPayload: false  ← this triggers banner clear
 *
 * Run:  pnpm --filter mrplug-mcp-server... wait this lives in mrplug-mcp-server
 * but vitest is in the parent.  Run from repo root:
 *   pnpm vitest run mrplug-mcp-server/src/__tests__/relay.test.ts
 */

// @vitest-environment node
import { spawn, type ChildProcess } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const RELAY_SRC = path.resolve(__dirname, '../../src/index.ts');
const TEST_PORT = 27183;
const BASE = `http://127.0.0.1:${TEST_PORT}`;

const MATCHING_PATH = '/Users/test/ojfbot/cv-builder';
const OTHER_PATH = '/Users/test/ojfbot/shell';

let relay: ChildProcess;

async function waitForReady(timeoutMs = 5000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const r = await fetch(`${BASE}/status`);
      if (r.ok) return;
    } catch {
      // not ready yet
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error('Relay server did not start within timeout');
}

beforeAll(async () => {
  // tsx lives in mrplug-mcp-server's own node_modules (two dirs up from __tests__)
  const tsx = path.resolve(__dirname, '../../node_modules/.bin/tsx');
  relay = spawn(tsx, [RELAY_SRC], {
    env: { ...process.env, PORT: String(TEST_PORT) },
    stdio: 'pipe',
  });

  relay.stderr?.on('data', (d: Buffer) => {
    // Suppress relay logs in test output; uncomment to debug:
    // process.stderr.write(d);
  });

  await waitForReady();
}, 10_000);

afterAll(() => {
  relay.kill('SIGTERM');
});

async function submitPayload(localPath: string) {
  const r = await fetch(`${BASE}/submit`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      resolvedLocalPath: localPath,
      pageUrl: 'http://localhost:3000/test',
      userComment: 'banner-clear integration test',
      elementContext: { tagName: 'BUTTON', classList: ['test-btn'] },
    }),
  });
  expect(r.status).toBe(200);
}

describe('relay session isolation', () => {
  it('has no pending payload initially', async () => {
    const r = await fetch(`${BASE}/status`);
    const body = await r.json() as { hasPendingPayload: boolean };
    expect(body.hasPendingPayload).toBe(false);
  });

  it('returns 204 when nothing is queued', async () => {
    const r = await fetch(`${BASE}/consume?path=${encodeURIComponent(MATCHING_PATH)}`);
    expect(r.status).toBe(204);
  });

  describe('with a queued payload', () => {
    beforeAll(async () => {
      await submitPayload(MATCHING_PATH);
    });

    it('GET /status reports hasPendingPayload: true after submit', async () => {
      const r = await fetch(`${BASE}/status`);
      const body = await r.json() as { hasPendingPayload: boolean; pendingLocalPath: string };
      expect(body.hasPendingPayload).toBe(true);
      expect(body.pendingLocalPath).toBe(MATCHING_PATH);
    });

    it('GET /consume with a non-matching path returns 204 (payload preserved)', async () => {
      const r = await fetch(`${BASE}/consume?path=${encodeURIComponent(OTHER_PATH)}`);
      expect(r.status).toBe(204);
    });

    it('GET /status still reports pending after non-matching consume', async () => {
      const r = await fetch(`${BASE}/status`);
      const body = await r.json() as { hasPendingPayload: boolean };
      expect(body.hasPendingPayload).toBe(true);
    });

    it('GET /consume with the matching path delivers the payload', async () => {
      const r = await fetch(`${BASE}/consume?path=${encodeURIComponent(MATCHING_PATH)}`);
      expect(r.status).toBe(200);
      const body = await r.json() as { success: boolean; payload: { userComment: string } };
      expect(body.success).toBe(true);
      expect(body.payload.userComment).toBe('banner-clear integration test');
    });

    it('GET /status reports hasPendingPayload: false after matching consume → banner should clear', async () => {
      const r = await fetch(`${BASE}/status`);
      const body = await r.json() as { hasPendingPayload: boolean };
      // This is the state change that background.ts polls for.
      // When this flips false, the extension broadcasts claude-code-context-consumed
      // and FeedbackModal clears claudeCodePending → banner disappears.
      expect(body.hasPendingPayload).toBe(false);
    });
  });

  describe('without a localPath in payload (broadcast to any session)', () => {
    beforeAll(async () => {
      // Submit a payload with no resolvedLocalPath (e.g. older extension version)
      const r = await fetch(`${BASE}/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pageUrl: 'http://localhost:3000/no-path',
          userComment: 'no-path payload',
        }),
      });
      expect(r.status).toBe(200);
    });

    it('delivers to any caller when no resolvedLocalPath in payload', async () => {
      const r = await fetch(`${BASE}/consume?path=${encodeURIComponent(OTHER_PATH)}`);
      expect(r.status).toBe(200);
    });
  });

  describe('DELETE /clear', () => {
    beforeAll(async () => {
      await submitPayload(MATCHING_PATH);
    });

    it('clears the pending payload so polling sees hasPendingPayload: false', async () => {
      await fetch(`${BASE}/clear`, { method: 'DELETE' });
      const r = await fetch(`${BASE}/status`);
      const body = await r.json() as { hasPendingPayload: boolean };
      expect(body.hasPendingPayload).toBe(false);
    });
  });
});
