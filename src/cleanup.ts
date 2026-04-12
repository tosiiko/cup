export const ACTION_CLEANUP = Symbol('cup-action-cleanup');
export const BIND_CLEANUP = Symbol('cup-bind-cleanup');

type CleanupToken = typeof ACTION_CLEANUP | typeof BIND_CLEANUP;

type CleanupHost = Element & {
  [ACTION_CLEANUP]?: Array<() => void>;
  [BIND_CLEANUP]?: Array<() => void>;
};

function tokenList(tokens?: CleanupToken | CleanupToken[]): CleanupToken[] {
  if (!tokens) return [ACTION_CLEANUP, BIND_CLEANUP];
  return Array.isArray(tokens) ? tokens : [tokens];
}

function cleanupNodes(root: Element): CleanupHost[] {
  return [root as CleanupHost, ...Array.from(root.querySelectorAll<CleanupHost>('*'))];
}

export function trackCleanup(host: Element, token: CleanupToken, cleanup: () => void): void {
  const cleanupHost = host as CleanupHost;
  cleanupHost[token] ??= [];
  cleanupHost[token]!.push(cleanup);
}

export function cleanupTree(root: Element, tokens?: CleanupToken | CleanupToken[]): void {
  const activeTokens = tokenList(tokens);

  for (const node of cleanupNodes(root)) {
    for (const token of activeTokens) {
      const entries = node[token];
      if (!entries) continue;
      for (const cleanup of entries.splice(0, entries.length)) {
        cleanup();
      }
      delete node[token];
    }
  }
}
