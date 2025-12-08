import { beforeAll, afterEach, vi } from 'vitest';

// Mock browser API
const mockBrowser = {
  storage: {
    local: {
      get: async (_keys: string | string[]) => {
        const storage: Record<string, any> = {};
        return storage;
      },
      set: async (_items: Record<string, any>) => {
        return;
      },
    },
  },
  runtime: {
    sendMessage: async (_message: any) => {
      return {};
    },
    onMessage: {
      addListener: (_callback: Function) => {},
    },
    onInstalled: {
      addListener: (_callback: Function) => {},
    },
    openOptionsPage: async () => {},
  },
  tabs: {
    query: async (_queryInfo: any) => {
      return [];
    },
    sendMessage: async (_tabId: number, _message: any) => {
      return;
    },
    onUpdated: {
      addListener: (_callback: Function) => {},
    },
  },
  commands: {
    onCommand: {
      addListener: (_callback: Function) => {},
    },
  },
};

// Mock webextension-polyfill module before it's imported
vi.mock('webextension-polyfill', () => ({
  default: mockBrowser,
}));

// @ts-ignore
global.browser = mockBrowser;
// @ts-ignore
global.chrome = mockBrowser;

beforeAll(() => {
  // Setup global test environment
});

afterEach(() => {
  // Clean up after each test
});
