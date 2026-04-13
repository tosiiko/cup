import { describe, expect, it } from 'vitest';

import {
  STARTER_VIEW_POLICY,
  repairProtocolPatchCandidate,
  repairProtocolViewCandidate,
} from '../../src/index.js';

describe('repair helpers', () => {
  it('sanitizes unsafe template patterns and applies metadata defaults', () => {
    const repaired = repairProtocolViewCandidate({
      template: '<a href="javascript:alert(1)" onclick="hack()">{{ body|safe }}</a><script>alert(1)</script>',
      state: {
        title: 'Hello',
        count: Number.NaN,
      },
      meta: {
        lang: 'python',
      },
    }, {
      defaults: {
        title: 'Welcome',
        route: '/welcome',
      },
    });

    expect(repaired.template).not.toContain('|safe');
    expect(repaired.template).not.toContain('<script');
    expect(repaired.template).not.toContain('onclick=');
    expect(repaired.template).toContain('href="#"');
    expect(repaired.state).toEqual({ title: 'Hello', count: 0 });
    expect(repaired.meta).toMatchObject({
      version: '1',
      lang: 'python',
      title: 'Welcome',
      route: '/welcome',
      provenance: {
        validation: {
          schema: 'repaired',
          policy: 'skipped',
          validator: 'repairProtocolViewCandidate',
        },
      },
      extensions: {
        'cup.provenance': { version: '1' },
      },
    });
    expect(repaired.meta?.provenance?.validation?.checkedAt).toEqual(expect.any(String));
  });

  it('drops malformed actions and produces policy-compliant views', () => {
    const repaired = repairProtocolViewCandidate({
      template: '<button data-action="save">Save</button>',
      state: {},
      actions: {
        save: { type: 'fetch', url: '/api/save', method: 'TRACE', replace: true },
        ping: { type: 'emit', event: 'saved', detail: { ok: true }, url: '/bad' },
        broken: { type: 'navigate', payload: { step: 2 } },
      },
    }, {
      defaults: {
        title: 'Account',
        route: '/account',
      },
      policy: STARTER_VIEW_POLICY,
    });

    expect(repaired.actions).toEqual({
      save: { type: 'fetch', url: '/api/save', method: 'POST' },
      ping: { type: 'emit', event: 'saved', detail: { ok: true } },
    });
  });

  it('strips origins from absolute and protocol-relative action URLs', () => {
    const repaired = repairProtocolViewCandidate({
      template: '<button data-action="next">Next</button>',
      state: {},
      actions: {
        next: { type: 'navigate', url: 'https://example.com/account?tab=security#access' },
        sync: { type: 'fetch', url: '//example.com/api/sync?mode=full', method: 'POST' },
      },
    }, {
      defaults: {
        title: 'Account',
        route: '/account',
      },
      policy: STARTER_VIEW_POLICY,
    });

    expect(repaired.actions).toEqual({
      next: { type: 'navigate', url: '/account?tab=security#access' },
      sync: { type: 'fetch', url: '/api/sync?mode=full', method: 'POST' },
    });
  });

  it('repairs patch candidates into valid merge patches', () => {
    const repaired = repairProtocolPatchCandidate({
      kind: 'something-else',
      mode: 'delta',
      state: {
        total: Infinity,
        items: [1, undefined, 3],
      },
      actions: {
        next: { type: 'navigate', url: '/next', replace: 'yes' },
      },
    }, {
      defaults: {
        route: '/next',
      },
    });

    expect(repaired).toEqual({
      kind: 'patch',
      mode: 'merge',
      state: {
        total: 0,
        items: [1, 3],
      },
      actions: {
        next: { type: 'navigate', url: '/next' },
      },
      meta: {
        version: '1',
        route: '/next',
      },
    });
  });
});
