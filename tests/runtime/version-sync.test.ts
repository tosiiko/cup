import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

const root = process.cwd();
const packageVersion = JSON.parse(
  readFileSync(resolve(root, 'package.json'), 'utf8'),
) as { version: string };

const version = packageVersion.version;

describe('version sync', () => {
  it('keeps repo docs aligned to the published package version', () => {
    const readme = readFileSync(resolve(root, 'README.md'), 'utf8');
    expect(readme).toContain(`package version: \`${version}\``);
  });

  it('keeps implemented adapter generators aligned to the published package version', () => {
    expect(readFileSync(resolve(root, 'adapters', 'go', 'cup.go'), 'utf8')).toContain(`cup-go/${version}`);
    expect(readFileSync(resolve(root, 'adapters', 'python', 'cup.py'), 'utf8')).toContain(`cup-python/${version}`);
    expect(readFileSync(resolve(root, 'adapters', 'node', 'index.mjs'), 'utf8')).toContain(`node-cup/${version}`);
    expect(readFileSync(resolve(root, 'adapters', 'typescript', 'index.ts'), 'utf8')).toContain(`ts-cup/${version}`);
    expect(readFileSync(resolve(root, 'adapters', 'rust', 'src', 'lib.rs'), 'utf8')).toContain(`rs-cup/${version}`);
    expect(readFileSync(resolve(root, 'adapters', 'java', 'src', 'main', 'java', 'dev', 'tosiiko', 'cup', 'UIView.java'), 'utf8')).toContain(`java-cup/${version}`);
  });

  it('keeps implemented adapter package manifests aligned to the published package version', () => {
    expect(readFileSync(resolve(root, 'adapters', 'python', 'pyproject.toml'), 'utf8')).toContain(`version = "${version}"`);
    expect(readFileSync(resolve(root, 'adapters', 'node', 'package.json'), 'utf8')).toContain(`"version": "${version}"`);
    expect(readFileSync(resolve(root, 'adapters', 'node', 'package.json'), 'utf8')).toContain(`"@tosiiko/cup": "^${version}"`);
    expect(readFileSync(resolve(root, 'adapters', 'typescript', 'package.json'), 'utf8')).toContain(`"version": "${version}"`);
    expect(readFileSync(resolve(root, 'adapters', 'typescript', 'package.json'), 'utf8')).toContain(`"@tosiiko/cup": "^${version}"`);
    expect(readFileSync(resolve(root, 'adapters', 'rust', 'Cargo.toml'), 'utf8')).toContain(`version = "${version}"`);
    expect(readFileSync(resolve(root, 'adapters', 'java', 'pom.xml'), 'utf8')).toContain(`<version>${version}</version>`);
  });
});
