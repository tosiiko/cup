import { execFileSync } from 'node:child_process';
import path from 'node:path';

import { beforeEach, describe, expect, it } from 'vitest';

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

function loadNodeView(): unknown {
  const output = execFileSync('node', ['tests/fixtures/node_emit.mjs'], {
    cwd: ROOT,
    encoding: 'utf8',
  });
  return JSON.parse(output);
}

describe('cross-language protocol contracts', () => {
  beforeEach(() => {
    history.replaceState(null, '', '/fixture');
  });

  it('accepts Python adapter output', () => {
    const view = validateProtocolView(loadPythonView());
    const container = document.createElement('div');

    mountRemoteView(view, container);
    expect(container.textContent).toContain('Hello from Python');
    expect(view.meta).toMatchObject({
      version: '1',
      lang: 'python',
      generator: 'cup-python/0.3.0',
      title: 'Fixture',
      route: '/fixture',
      provenance: {
        source: 'adapter',
        generatedBy: 'cup-python/0.3.0',
        validation: {
          schema: 'valid',
        },
      },
      extensions: {
        'cup.provenance': { version: '1' },
      },
    });
    expect(view.meta?.provenance?.generatedAt).toEqual(expect.any(String));
    expect(view.meta?.provenance?.validation?.checkedAt).toEqual(expect.any(String));

    container.querySelector('button')?.dispatchEvent(new MouseEvent('click', { bubbles: true, button: 0 }));
    expect(location.pathname).toBe('/next');
  });

  it('accepts Go adapter output', () => {
    const view = validateProtocolView(loadGoView());
    const container = document.createElement('div');

    mountRemoteView(view, container);
    expect(container.textContent).toContain('Hello from Go');
    expect(view.meta).toMatchObject({
      version: '1',
      lang: 'go',
      generator: 'cup-go/0.3.0',
      title: 'Fixture',
      route: '/fixture',
      provenance: {
        source: 'adapter',
        generatedBy: 'cup-go/0.3.0',
        validation: {
          schema: 'valid',
        },
      },
      extensions: {
        'cup.provenance': { version: '1' },
      },
    });
    expect(view.meta?.provenance?.generatedAt).toEqual(expect.any(String));
    expect(view.meta?.provenance?.validation?.checkedAt).toEqual(expect.any(String));

    container.querySelector('button')?.dispatchEvent(new MouseEvent('click', { bubbles: true, button: 0 }));
    expect(location.pathname).toBe('/next');
  });

  it('accepts Node-emitted protocol output', () => {
    const view = validateProtocolView(loadNodeView());
    const container = document.createElement('div');

    mountRemoteView(view, container);
    expect(container.textContent).toContain('Hello from Node');
    expect(view.meta).toMatchObject({
      version: '1',
      lang: 'node',
      generator: 'node-cup/0.3.0',
      title: 'Fixture',
      route: '/fixture',
      provenance: {
        source: 'adapter',
        generatedBy: 'node-cup/0.3.0',
        validation: {
          schema: 'valid',
        },
      },
      extensions: {
        'cup.provenance': { version: '1' },
      },
    });
    expect(view.meta?.provenance?.generatedAt).toEqual(expect.any(String));
    expect(view.meta?.provenance?.validation?.checkedAt).toEqual(expect.any(String));

    container.querySelector('button')?.dispatchEvent(new MouseEvent('click', { bubbles: true, button: 0 }));
    expect(location.pathname).toBe('/next');
  });
});
