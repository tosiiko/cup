import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';

import { describe, expect, it } from 'vitest';

const root = process.cwd();
const cliPath = resolve(root, 'bin', 'cup.mjs');

function runInit(adapter: string, target: string): void {
  execFileSync(process.execPath, [cliPath, 'init', target, '--adapter', adapter], {
    cwd: root,
    stdio: 'pipe',
  });
}

function runInitInCurrentDirectory(adapter: string, cwd: string): void {
  execFileSync(process.execPath, [cliPath, 'init', '--adapter', adapter], {
    cwd,
    stdio: 'pipe',
  });
}

describe('cup init cli', () => {
  it('creates a ts-cup login scaffold', () => {
    const sandbox = mkdtempSync(join(tmpdir(), 'cup-init-ts-'));
    try {
      const target = join(sandbox, 'ts-demo');
      runInit('ts-cup', target);

      expect(existsSync(join(target, 'package.json'))).toBe(true);
      expect(existsSync(join(target, 'src', 'main.ts'))).toBe(true);
      expect(readFileSync(join(target, 'package.json'), 'utf8')).toContain('"@tosiiko/cup"');
    } finally {
      rmSync(sandbox, { recursive: true, force: true });
    }
  });

  it('creates a py-cup login scaffold with the vendored runtime', () => {
    const sandbox = mkdtempSync(join(tmpdir(), 'cup-init-py-'));
    try {
      const target = join(sandbox, 'py-demo');
      runInit('py-cup', target);

      expect(existsSync(join(target, 'server.py'))).toBe(true);
      expect(existsSync(join(target, 'cup', 'index.js'))).toBe(true);
      expect(existsSync(join(target, 'vendor', 'py_cup', 'cup.py'))).toBe(true);
      expect(readFileSync(join(target, 'server.py'), 'utf8')).toContain('py-cup login demo');
    } finally {
      rmSync(sandbox, { recursive: true, force: true });
    }
  });

  it('creates node-cup and go-cup login scaffolds', () => {
    const sandbox = mkdtempSync(join(tmpdir(), 'cup-init-multi-'));
    try {
      const nodeTarget = join(sandbox, 'node-demo');
      runInit('node-cup', nodeTarget);
      expect(existsSync(join(nodeTarget, 'server.mjs'))).toBe(true);
      expect(existsSync(join(nodeTarget, 'cup', 'index.js'))).toBe(true);

      const goTarget = join(sandbox, 'go-demo');
      runInit('go-cup', goTarget);
      expect(existsSync(join(goTarget, 'go.mod'))).toBe(true);
      expect(existsSync(join(goTarget, 'main.go'))).toBe(true);
      expect(readFileSync(join(goTarget, 'main.go'), 'utf8')).toContain('go-cup login demo');
    } finally {
      rmSync(sandbox, { recursive: true, force: true });
    }
  });

  it('initializes the current directory and accepts adapter aliases', () => {
    const sandbox = mkdtempSync(join(tmpdir(), 'cup-init-current-'));
    try {
      runInitInCurrentDirectory('python', sandbox);

      expect(existsSync(join(sandbox, 'server.py'))).toBe(true);
      expect(existsSync(join(sandbox, 'cup', 'index.js'))).toBe(true);
      expect(readFileSync(join(sandbox, 'README.md'), 'utf8')).toContain('py-cup style login demo');
    } finally {
      rmSync(sandbox, { recursive: true, force: true });
    }
  });
});
