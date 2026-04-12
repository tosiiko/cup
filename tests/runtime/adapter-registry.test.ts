import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

const root = process.cwd();
const registryPath = resolve(root, 'adapters', 'namespaces.json');
const packagePath = resolve(root, 'package.json');

type AdapterEntry = {
  language: string;
  namespace: string;
  repo_path: string;
  ecosystem: string;
  intent: string;
  repository_state: string;
  implementation_kind: string;
  maturity: string;
  publication_status: string;
  protocol_versions: string[];
  depends_on_core_package: boolean;
};

const registry = JSON.parse(readFileSync(registryPath, 'utf8')) as {
  version: number;
  core: {
    package_version: string;
    publication_status: string;
    protocol_versions: string[];
  };
  adapters: AdapterEntry[];
};

const packageJson = JSON.parse(readFileSync(packagePath, 'utf8')) as {
  version: string;
};

describe('adapter namespace registry', () => {
  it('maps every adapter to a real in-repo path with matching metadata', () => {
    expect(registry.version).toBe(2);
    expect(registry.core.package_version).toBe(packageJson.version);
    expect(registry.core.publication_status).toBe('published');
    expect(registry.core.protocol_versions).toEqual(['1']);

    for (const adapter of registry.adapters) {
      const adapterDir = resolve(root, adapter.repo_path);
      const adapterMetadataPath = resolve(adapterDir, 'adapter.json');
      expect(existsSync(adapterDir), `${adapter.namespace} dir missing`).toBe(true);
      expect(existsSync(resolve(adapterDir, 'README.md')), `${adapter.namespace} README missing`).toBe(true);
      expect(existsSync(adapterMetadataPath), `${adapter.namespace} adapter.json missing`).toBe(true);

      const adapterMetadata = JSON.parse(readFileSync(adapterMetadataPath, 'utf8')) as AdapterEntry & {
        adapter_version: string;
      };

      expect(adapterMetadata).toMatchObject({
        namespace: adapter.namespace,
        language: adapter.language,
        repo_path: adapter.repo_path,
        ecosystem: adapter.ecosystem,
        intent: adapter.intent,
        repository_state: adapter.repository_state,
        implementation_kind: adapter.implementation_kind,
        maturity: adapter.maturity,
        publication_status: adapter.publication_status,
        protocol_versions: adapter.protocol_versions,
        depends_on_core_package: adapter.depends_on_core_package,
        adapter_version: packageJson.version,
      });
    }
  });

  it('keeps stable, alpha, and scaffold tracks explicitly distinguished', () => {
    const byNamespace = new Map(registry.adapters.map((adapter) => [adapter.namespace, adapter]));

    expect(byNamespace.get('py-cup')).toMatchObject({
      intent: 'official',
      repository_state: 'implemented',
      implementation_kind: 'production',
      maturity: 'stable',
      publication_status: 'not-published',
      protocol_versions: ['1'],
    });
    expect(byNamespace.get('go-cup')).toMatchObject({
      intent: 'official',
      repository_state: 'implemented',
      implementation_kind: 'production',
      maturity: 'stable',
      publication_status: 'not-published',
      protocol_versions: ['1'],
    });
    expect(byNamespace.get('node-cup')).toMatchObject({
      intent: 'official',
      repository_state: 'implemented',
      implementation_kind: 'wrapper',
      maturity: 'alpha',
      publication_status: 'not-published',
      protocol_versions: ['1'],
      depends_on_core_package: true,
    });
    expect(byNamespace.get('ts-cup')).toMatchObject({
      intent: 'official',
      repository_state: 'implemented',
      implementation_kind: 'wrapper',
      maturity: 'alpha',
      publication_status: 'not-published',
      protocol_versions: ['1'],
      depends_on_core_package: true,
    });
    expect(byNamespace.get('rs-cup')).toMatchObject({
      intent: 'official',
      repository_state: 'implemented',
      implementation_kind: 'source',
      maturity: 'alpha',
      publication_status: 'not-published',
      protocol_versions: ['1'],
    });
    expect(byNamespace.get('java-cup')).toMatchObject({
      intent: 'official',
      repository_state: 'implemented',
      implementation_kind: 'source',
      maturity: 'alpha',
      publication_status: 'not-published',
      protocol_versions: ['1'],
    });
    expect(byNamespace.get('php-cup')).toMatchObject({
      intent: 'official',
      repository_state: 'bootstrapped',
      implementation_kind: 'scaffold',
      maturity: 'scaffold',
      publication_status: 'not-published',
      protocol_versions: ['1'],
    });
  });
});
