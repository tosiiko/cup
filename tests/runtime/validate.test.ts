import { describe, expect, it } from 'vitest';

import {
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
