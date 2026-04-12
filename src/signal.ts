import type { Signal } from './types.js';

export function createSignal<T>(initial: T): Signal<T> {
  let value = initial;
  const subscribers = new Set<(next: T) => void>();

  return {
    get() {
      return value;
    },
    set(next: T) {
      value = next;
      for (const subscriber of subscribers) {
        subscriber(value);
      }
    },
    subscribe(subscriber) {
      subscribers.add(subscriber);
      return () => subscribers.delete(subscriber);
    },
  };
}
