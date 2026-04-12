import { describe, expect, it } from 'vitest';

import {
  PolicyError,
  STARTER_VIEW_POLICY,
  validateViewPolicy,
} from '../../src/index.js';

describe('view policy validation', () => {
  it('accepts starter-compliant views', () => {
    const view = validateViewPolicy({
      template: '<button data-action="save">Save</button>',
      state: {},
      actions: {
        save: { type: 'fetch', url: '/api/save', method: 'POST' },
      },
      meta: {
        version: '1',
        title: 'Save record',
        route: '/records/1',
      },
    }, STARTER_VIEW_POLICY);

    expect(view.meta?.title).toBe('Save record');
  });

  it('rejects unsafe template patterns under the starter policy', () => {
    expect(() => validateViewPolicy({
      template: '<p>{{ content|safe }}</p>',
      state: { content: '<strong>hi</strong>' },
      meta: {
        version: '1',
        title: 'Unsafe',
        route: '/unsafe',
      },
    }, STARTER_VIEW_POLICY)).toThrow(PolicyError);
  });

  it('rejects absolute action urls under the starter policy', () => {
    expect(() => validateViewPolicy({
      template: '<button data-action="save">Save</button>',
      state: {},
      actions: {
        save: { type: 'fetch', url: 'https://example.com/save', method: 'POST' },
      },
      meta: {
        version: '1',
        title: 'External',
        route: '/external',
      },
    }, STARTER_VIEW_POLICY)).toThrowError(/must stay relative/);
  });

  it('can be used with an empty policy for schema-only acceptance', () => {
    const view = validateViewPolicy({
      template: '<p>Hello</p>',
      state: {},
    });

    expect(view.template).toBe('<p>Hello</p>');
  });
});
