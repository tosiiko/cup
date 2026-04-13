import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';
import { tmpdir } from 'node:os';

const scriptDir = dirname(fileURLToPath(import.meta.url));
const rootDir = resolve(scriptDir, '..');
const packDir = mkdtempSync(join(tmpdir(), 'cup-pack-'));
const smokeDir = mkdtempSync(join(tmpdir(), 'cup-npm-smoke-'));

const env = {
  ...process.env,
  npm_config_cache: '/tmp/cup-npm-cache',
  npm_config_audit: 'false',
  npm_config_fund: 'false',
};

const npmBin = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const nodeBin = process.execPath;
const tscBin = resolve(
  rootDir,
  'node_modules',
  '.bin',
  process.platform === 'win32' ? 'tsc.cmd' : 'tsc',
);

try {
  const raw = execFileSync(
    npmBin,
    ['pack', '--json', '--pack-destination', packDir],
    { cwd: rootDir, env, encoding: 'utf8' },
  );
  const [packResult] = JSON.parse(raw);
  if (!packResult || typeof packResult !== 'object') {
    throw new Error('npm pack did not return package metadata');
  }

  const files = new Set((packResult.files ?? []).map((file) => file.path));
  const requiredFiles = [
    'LICENSE',
    'README.md',
    'bin/cup.mjs',
    'docs/generators.md',
    'docs/reference-ui.md',
    'dist/index.js',
    'dist/index.d.ts',
    'package.json',
    'schema/uiview.v1.json',
    'styles/reference.css',
  ];

  for (const file of requiredFiles) {
    if (!files.has(file)) {
      throw new Error(`packed artifact is missing required file: ${file}`);
    }
  }

  for (const file of files) {
    if (file.endsWith('.map')) {
      throw new Error(`packed artifact should not ship source maps: ${file}`);
    }
  }

  const tarball = resolve(packDir, packResult.filename);
  const packedBundle = execFileSync(
    'tar',
    ['-xOf', tarball, 'package/dist/index.js'],
    { encoding: 'utf8' },
  );

  for (const marker of ['fetchView', 'fetchViewStream', 'globalThis["fetch"]', 'globalThis.fetch']) {
    if (packedBundle.includes(marker)) {
      throw new Error(`packed core bundle should stay transport-free, but found marker: ${marker}`);
    }
  }

  writeFileSync(resolve(smokeDir, 'package.json'), JSON.stringify({
    name: 'cup-smoke',
    private: true,
    type: 'module',
  }, null, 2));

  execFileSync(npmBin, ['install', '--ignore-scripts', tarball], {
    cwd: smokeDir,
    env,
    stdio: 'inherit',
  });

  writeFileSync(resolve(smokeDir, 'index.mjs'), [
    "import { validateProtocolView } from '@tosiiko/cup';",
    "const view = validateProtocolView({ template: '<p>{{ title }}</p>', state: { title: 'Smoke' } });",
    "if (view.state.title !== 'Smoke') throw new Error('runtime smoke import failed');",
    '',
  ].join('\n'));

  execFileSync(nodeBin, [resolve(smokeDir, 'index.mjs')], {
    cwd: smokeDir,
    stdio: 'inherit',
  });

  const cliBin = resolve(
    smokeDir,
    'node_modules',
    '.bin',
    process.platform === 'win32' ? 'cup.cmd' : 'cup',
  );

  const pyInitDir = resolve(smokeDir, 'py-init');
  execFileSync(cliBin, ['init', pyInitDir, '--adapter', 'py-cup'], {
    cwd: smokeDir,
    stdio: 'inherit',
  });
  if (!existsSync(resolve(pyInitDir, 'server.py'))) {
    throw new Error('packed cli should create a py-cup scaffold with server.py');
  }
  if (!existsSync(resolve(pyInitDir, 'cup', 'index.js'))) {
    throw new Error('packed cli should vendor the runtime into py-cup scaffolds');
  }

  const tsInitDir = resolve(smokeDir, 'ts-init');
  execFileSync(cliBin, ['init', tsInitDir, '--adapter', 'ts-cup'], {
    cwd: smokeDir,
    stdio: 'inherit',
  });
  const tsPackageJson = readFileSync(resolve(tsInitDir, 'package.json'), 'utf8');
  if (!tsPackageJson.includes('"@tosiiko/cup"')) {
    throw new Error('packed cli should create a ts-cup scaffold that depends on @tosiiko/cup');
  }

  writeFileSync(resolve(smokeDir, 'index.ts'), [
    "import { validateProtocolView } from '@tosiiko/cup';",
    "import type { ClientView, ProtocolView } from '@tosiiko/cup';",
    '',
    "const remote: ProtocolView = validateProtocolView({ template: '<p>{{ title }}</p>', state: { title: 'Smoke' } });",
    "const local: ClientView = { template: remote.template, state: { title: 'Smoke' } };",
    '',
    "if (!local.template) throw new Error('type smoke import failed');",
    '',
  ].join('\n'));

  writeFileSync(resolve(smokeDir, 'tsconfig.json'), JSON.stringify({
    compilerOptions: {
      module: 'ESNext',
      moduleResolution: 'bundler',
      noEmit: true,
      strict: true,
      target: 'ES2020',
    },
    include: ['index.ts'],
  }, null, 2));

  execFileSync(tscBin, ['-p', resolve(smokeDir, 'tsconfig.json')], {
    cwd: smokeDir,
    stdio: 'inherit',
  });
} finally {
  rmSync(packDir, { recursive: true, force: true });
  rmSync(smokeDir, { recursive: true, force: true });
}
