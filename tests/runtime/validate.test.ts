import { describe, expect, it } from 'vitest';

import {
  DEFAULT_RUNTIME_CAPABILITIES,
  ValidationError,
  validateProtocolPatch,
  validateProtocolView,
} from '../../src/index.js';

describe('validateProtocolView', () => {
  it('rejects cross-type action properties', () => {
    expect(() => validateProtocolView({
      template: '<button data-action="save">Save</button>',
      state: {},
      actions: {
        save: { type: 'fetch', url: '/save', replace: true },
      },
    })).toThrow(ValidationError);

    expect(() => validateProtocolView({
      template: '<button data-action="notify">Notify</button>',
      state: {},
      actions: {
        notify: { type: 'emit', event: 'saved', url: '/save' },
      },
    })).toThrow('unsupported property');

    expect(() => validateProtocolView({
      template: '<button data-action="go">Go</button>',
      state: {},
      actions: {
        go: { type: 'navigate', url: '/next', payload: { draft: true } },
      },
    })).toThrow('unsupported property');
  });

  it('accepts provenance metadata and supported extensions', () => {
    const view = validateProtocolView({
      template: '<p>{{ title }}</p>',
      state: { title: 'Traceable' },
      meta: {
        version: '1',
        title: 'Traceable',
        route: '/traceable',
        provenance: {
          source: 'ai',
          generatedBy: 'generator/v1',
          validation: {
            schema: 'valid',
            policy: 'passed',
          },
          policyDecisions: [
            { policy: 'starter-view-policy', outcome: 'allow' },
          ],
        },
        extensions: {
          'cup.provenance': { version: '1', required: true },
        },
      },
    }, {
      capabilities: DEFAULT_RUNTIME_CAPABILITIES,
    });

    expect(view.meta?.extensions?.['cup.provenance']).toEqual({ version: '1', required: true });
  });

  it('rejects required unsupported extensions when capabilities are checked', () => {
    expect(() => validateProtocolView({
      template: '<p>Unsupported</p>',
      state: {},
      meta: {
        version: '1',
        extensions: {
          'acme.analytics': { version: '9', required: true },
        },
      },
    }, {
      capabilities: DEFAULT_RUNTIME_CAPABILITIES,
    })).toThrow('requires unsupported extension');
  });
});

describe('validateProtocolPatch', () => {
  it('accepts merge patches with valid action descriptors', () => {
    const patch = validateProtocolPatch({
      kind: 'patch',
      state: { step: 2 },
      actions: {
        next: { type: 'navigate', url: '/wizard/2', replace: true },
      },
      meta: {
        version: '1',
        route: '/wizard/2',
      },
    });

    expect(patch.kind).toBe('patch');
    expect(patch.actions?.next.type).toBe('navigate');
  });

  it('rejects invalid patch modes and empty patches', () => {
    expect(() => validateProtocolPatch({
      kind: 'patch',
      mode: 'delta',
      state: { ready: true },
    })).toThrow(ValidationError);

    expect(() => validateProtocolPatch({
      kind: 'patch',
    })).toThrow('must include at least one patch field');
  });
});
