import { execFileSync } from 'node:child_process';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { mountRemoteView, validateProtocolView } from '../../src/index.js';

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

describe('cross-language protocol contracts', () => {
  it('accepts Python adapter output', () => {
    const view = validateProtocolView(loadPythonView());
    const container = document.createElement('div');

    mountRemoteView(view, container);
    expect(container.textContent).toContain('Hello from Python');
  });

  it('accepts Go adapter output', () => {
    const view = validateProtocolView(loadGoView());
    const container = document.createElement('div');

    mountRemoteView(view, container);
    expect(container.textContent).toContain('Hello from Go');
  });
});
