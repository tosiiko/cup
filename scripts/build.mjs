import { mkdirSync, rmSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

import { build } from 'esbuild';

const scriptDir = dirname(fileURLToPath(import.meta.url));
const rootDir = resolve(scriptDir, '..');
const distDir = resolve(rootDir, 'dist');

rmSync(distDir, { recursive: true, force: true });
mkdirSync(distDir, { recursive: true });

await build({
  entryPoints: [resolve(rootDir, 'src', 'index.ts')],
  outfile: resolve(distDir, 'index.js'),
  bundle: true,
  format: 'esm',
  target: 'es2020',
  platform: 'browser',
  minify: true,
  sourcemap: false,
  legalComments: 'none',
  logLevel: 'info',
});

const tscBin = resolve(
  rootDir,
  'node_modules',
  '.bin',
  process.platform === 'win32' ? 'tsc.cmd' : 'tsc',
);

execFileSync(tscBin, ['-p', resolve(rootDir, 'tsconfig.build.json')], {
  cwd: rootDir,
  stdio: 'inherit',
});
