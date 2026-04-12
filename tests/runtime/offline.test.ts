import { beforeEach, describe, expect, it, vi } from 'vitest';

import { createDraftStore, createRetryQueue } from '../../src/index.js';

function createStorage(): Storage {
  const data = new Map<string, string>();

  return {
    clear() {
      data.clear();
    },
    getItem(key) {
      return data.get(key) ?? null;
    },
    key(index) {
      return [...data.keys()][index] ?? null;
    },
    get length() {
      return data.size;
    },
    removeItem(key) {
      data.delete(key);
    },
    setItem(key, value) {
      data.set(key, value);
    },
  };
}

describe('offline helpers', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('persists draft state and falls back to the initial value', () => {
    const storage = createStorage();
    const drafts = createDraftStore('draft:welcome', {
      initial: { name: '', subscribed: false },
      storage,
    });

    expect(drafts.load()).toEqual({ name: '', subscribed: false });

    drafts.save({ name: 'Taylor', subscribed: true });
    expect(drafts.load()).toEqual({ name: 'Taylor', subscribed: true });

    drafts.clear();
    expect(drafts.load()).toEqual({ name: '', subscribed: false });
  });

  it('replays retry queues and increments attempts for failures', async () => {
    const storage = createStorage();
    vi.stubGlobal('crypto', { randomUUID: vi.fn(() => 'retry-1') });

    const queue = createRetryQueue<{ id: number; shouldFail: boolean }>('queue:actions', { storage });
    const entry = queue.enqueue({ id: 7, shouldFail: true });

    expect(entry.id).toBe('retry-1');
    expect(queue.entries()).toHaveLength(1);

    const result = await queue.replay(async (queued) => {
      if (queued.payload.shouldFail) {
        throw new Error('still offline');
      }
    });

    expect(result).toEqual({ processed: 0, failed: 1 });
    expect(queue.entries()).toMatchObject([
      {
        id: 'retry-1',
        attempts: 1,
        payload: { id: 7, shouldFail: true },
      },
    ]);

    queue.remove('retry-1');
    expect(queue.entries()).toEqual([]);
  });
});
