import { execFileSync } from 'node:child_process';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  DEFAULT_RUNTIME_CAPABILITIES,
  negotiateCapabilities,
  validateProtocolView,
} from '../../src/index.js';

const ROOT = process.cwd();

function loadPythonView(): unknown {
  const output = execFileSync('python3', ['tests/fixtures/python_emit.py'], {
    cwd: ROOT,
    encoding: 'utf8',
  });
  return JSON.parse(output);
}

function loadGoView(): unknown {
  const output = execFileSync('go', ['run', './fixtures/emit'], {
    cwd: path.join(ROOT, 'adapters', 'go'),
    encoding: 'utf8',
    env: {
      ...process.env,
      GOCACHE: '/tmp/cup-go-cache',
    },
  });
  return JSON.parse(output);
}

function loadNodeView(): unknown {
  const output = execFileSync('node', ['tests/fixtures/node_emit.mjs'], {
    cwd: ROOT,
    encoding: 'utf8',
  });
  return JSON.parse(output);
}

describe('official adapter conformance', () => {
  it.each([
    ['python', loadPythonView],
    ['go', loadGoView],
    ['node', loadNodeView],
  ])('accepts %s adapter provenance and negotiated extensions', (_name, loadView) => {
    const view = validateProtocolView(loadView(), {
      capabilities: DEFAULT_RUNTIME_CAPABILITIES,
    });
    const result = negotiateCapabilities(view, DEFAULT_RUNTIME_CAPABILITIES);

    expect(result.supportedVersion).toBe(true);
    expect(result.acceptedExtensions).toEqual({
      'cup.provenance': '1',
    });
    expect(view.meta?.provenance?.validation?.schema).toBe('valid');
  });
});
