import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  STARTER_VIEW_POLICY,
  repairProtocolViewCandidate,
  validateProtocolView,
  validateViewPolicy,
} from '../../src/index.js';

const fixturesDir = resolve(process.cwd(), 'tests', 'fixtures', 'ai');

function loadFixture(name: string): unknown {
  return JSON.parse(readFileSync(resolve(fixturesDir, name), 'utf8'));
}

describe('AI fixtures', () => {
  it('accepts starter-compliant generated views', () => {
    const fixture = loadFixture('generated-valid.json');
    const view = validateViewPolicy(validateProtocolView(fixture), STARTER_VIEW_POLICY);

    expect(view.meta?.route).toBe('/accounts/review');
    expect(view.actions?.next.type).toBe('navigate');
  });

  it('repairs unsafe generated views back into starter-compliant output', () => {
    const fixture = loadFixture('generated-unsafe.json');

    expect(() => validateViewPolicy(validateProtocolView(fixture), STARTER_VIEW_POLICY)).toThrow();

    const repaired = repairProtocolViewCandidate(fixture, {
      defaults: {
        title: 'Recovered AI view',
        route: '/recovered',
      },
      policy: STARTER_VIEW_POLICY,
    });

    expect(repaired.template).not.toContain('|safe');
    expect(repaired.template).not.toContain('<script');
    expect(repaired.actions).toEqual({
      save: { type: 'fetch', url: '/save', method: 'POST' },
    });
    expect(repaired.meta).toMatchObject({
      version: '1',
      lang: 'ai',
      title: 'Recovered AI view',
      route: '/recovered',
      provenance: {
        validation: {
          schema: 'repaired',
          policy: 'passed',
          validator: 'repairProtocolViewCandidate',
        },
        policyDecisions: [
          {
            policy: 'view-policy',
            outcome: 'allow',
          },
        ],
      },
      extensions: {
        'cup.provenance': { version: '1' },
      },
    });
    expect(repaired.meta?.provenance?.validation?.checkedAt).toEqual(expect.any(String));
  });
});
