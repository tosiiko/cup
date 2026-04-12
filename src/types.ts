import type { ProtocolView } from './protocol.js';

export type UIView = ProtocolView;

export type ClientActionHandler = (
  state: Record<string, unknown>,
  event: Event,
) => void | Promise<void>;

export interface ClientView {
  template: string;
  state: Record<string, unknown>;
  actions?: Record<string, ClientActionHandler>;
}

export type Signal<T> = {
  get(): T;
  set(value: T): void;
  subscribe(fn: (value: T) => void): () => void;
};
