import type { JSONValue } from './protocol.js';

export interface DraftStore<T extends JSONValue> {
  load(): T;
  save(value: T): void;
  clear(): void;
}

export interface RetryEntry<T extends JSONValue> {
  id: string;
  payload: T;
  createdAt: string;
  attempts: number;
}

export interface RetryQueue<T extends JSONValue> {
  enqueue(payload: T): RetryEntry<T>;
  entries(): RetryEntry<T>[];
  remove(id: string): void;
  clear(): void;
  replay(processor: (entry: RetryEntry<T>) => Promise<void>): Promise<{ processed: number; failed: number }>;
}

interface DraftStoreOptions<T extends JSONValue> {
  initial: T;
  storage?: Storage | null;
}

interface RetryQueueOptions {
  storage?: Storage | null;
}

const memoryStorage = new Map<string, string>();

export function createDraftStore<T extends JSONValue>(
  key: string,
  options: DraftStoreOptions<T>,
): DraftStore<T> {
  const storage = resolveStorage(options.storage);
  const initial = options.initial;

  return {
    load() {
      const raw = storage.getItem(key);
      if (!raw) return initial;
      return JSON.parse(raw) as T;
    },
    save(value) {
      storage.setItem(key, JSON.stringify(value));
    },
    clear() {
      storage.removeItem(key);
    },
  };
}

export function createRetryQueue<T extends JSONValue>(
  key: string,
  options: RetryQueueOptions = {},
): RetryQueue<T> {
  const storage = resolveStorage(options.storage);

  return {
    enqueue(payload) {
      const entry: RetryEntry<T> = {
        id: crypto.randomUUID(),
        payload,
        createdAt: new Date().toISOString(),
        attempts: 0,
      };
      const next = [...readEntries<T>(storage, key), entry];
      writeEntries(storage, key, next);
      return entry;
    },
    entries() {
      return readEntries<T>(storage, key);
    },
    remove(id) {
      writeEntries(storage, key, readEntries<T>(storage, key).filter((entry) => entry.id !== id));
    },
    clear() {
      storage.removeItem(key);
    },
    async replay(processor) {
      const pending = readEntries<T>(storage, key);
      const survivors: RetryEntry<T>[] = [];
      let processed = 0;
      let failed = 0;

      for (const entry of pending) {
        try {
          await processor(entry);
          processed += 1;
        } catch {
          failed += 1;
          survivors.push({ ...entry, attempts: entry.attempts + 1 });
        }
      }

      writeEntries(storage, key, survivors);
      return { processed, failed };
    },
  };
}

function resolveStorage(storage?: Storage | null): Storage {
  if (storage) return storage;
  if (typeof window !== 'undefined' && window.localStorage) {
    return window.localStorage;
  }
  return {
    clear() {
      memoryStorage.clear();
    },
    getItem(key) {
      return memoryStorage.get(key) ?? null;
    },
    key(index) {
      return [...memoryStorage.keys()][index] ?? null;
    },
    get length() {
      return memoryStorage.size;
    },
    removeItem(key) {
      memoryStorage.delete(key);
    },
    setItem(key, value) {
      memoryStorage.set(key, value);
    },
  };
}

function readEntries<T extends JSONValue>(storage: Storage, key: string): RetryEntry<T>[] {
  const raw = storage.getItem(key);
  if (!raw) return [];
  return JSON.parse(raw) as RetryEntry<T>[];
}

function writeEntries<T extends JSONValue>(storage: Storage, key: string, entries: RetryEntry<T>[]): void {
  if (entries.length === 0) {
    storage.removeItem(key);
    return;
  }
  storage.setItem(key, JSON.stringify(entries));
}
