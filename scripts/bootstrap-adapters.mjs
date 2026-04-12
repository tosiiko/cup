import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = dirname(fileURLToPath(import.meta.url));
const rootDir = resolve(scriptDir, '..');
const registryPath = resolve(rootDir, 'adapters', 'namespaces.json');
const packagePath = resolve(rootDir, 'package.json');
const registry = JSON.parse(readFileSync(registryPath, 'utf8'));
const rootPackage = JSON.parse(readFileSync(packagePath, 'utf8'));
const packageVersion = rootPackage.version;

function ensureDir(path) {
  mkdirSync(path, { recursive: true });
}

function write(path, content) {
  ensureDir(dirname(path));
  writeFileSync(path, content, 'utf8');
}

function adapterReadme(adapter) {
  const lines = [
    `# ${adapter.namespace}`,
    '',
    `Language: ${adapter.language}`,
    `Ecosystem: ${adapter.ecosystem}`,
    `Intent: ${adapter.intent}`,
    `Repository state: ${adapter.repository_state}`,
    `Implementation kind: ${adapter.implementation_kind}`,
    `Maturity: ${adapter.maturity}`,
    `Publication status: ${adapter.publication_status}`,
    `Protocol versions: ${adapter.protocol_versions.join(', ')}`,
    '',
  ];

  if (adapter.repository_state === 'implemented') {
    lines.push('This adapter has an in-repo implementation and should use its hand-maintained README instead of the generated scaffold text.');
  } else {
    lines.push('This is a generated CUP adapter scaffold. It establishes the in-repo package path, ecosystem metadata, and starter source layout for a future full implementation.');
  }

  lines.push(
    '',
    'Adapter expectations:',
    '',
    '- emit protocol-compatible `v1` views',
    '- preserve `meta.version`, `meta.lang`, and `meta.generator`',
    '- provide schema validation helpers',
    '- provide starter-safe policy validation',
    '- pass the shared CUP contract tests once fully implemented',
    '',
    'Notes:',
    '',
    `- ${adapter.notes}`,
    '- This scaffold is generated from `adapters/namespaces.json`.',
    '',
  );

  return lines.join('\n');
}

function adapterManifest(adapter) {
  return JSON.stringify({
    namespace: adapter.namespace,
    language: adapter.language,
    code: adapter.code,
    ecosystem: adapter.ecosystem,
    repo_path: adapter.repo_path,
    intent: adapter.intent,
    repository_state: adapter.repository_state,
    implementation_kind: adapter.implementation_kind,
    maturity: adapter.maturity,
    publication_status: adapter.publication_status,
    protocol_versions: adapter.protocol_versions,
    depends_on_core_package: adapter.depends_on_core_package,
    adapter_version: packageVersion,
    generated_from: 'adapters/namespaces.json',
  }, null, 2) + '\n';
}

function filesFor(adapter) {
  const files = [
    ['adapter.json', adapterManifest(adapter)],
  ];

  if (adapter.repository_state !== 'implemented') {
    files.push(['README.md', adapterReadme(adapter)]);
  }

  if (adapter.repository_state !== 'bootstrapped') {
    return files;
  }

  switch (adapter.code) {
    case 'dotnet':
      files.push(
        ['dotnet-cup.csproj', `<Project Sdk="Microsoft.NET.Sdk">\n  <PropertyGroup>\n    <TargetFramework>net8.0</TargetFramework>\n    <PackageId>${adapter.namespace}</PackageId>\n    <Version>${packageVersion}</Version>\n    <Nullable>enable</Nullable>\n  </PropertyGroup>\n</Project>\n`],
        ['src/DotnetCup.cs', `namespace Tosiiko.Cup;\n\npublic static class DotnetCup\n{\n    public const string AdapterName = "${adapter.namespace}";\n    public const string ProtocolVersion = "1";\n}\n`],
      );
      break;
    case 'php':
      files.push(
        ['composer.json', JSON.stringify({
          name: `tosiiko/${adapter.namespace}`,
          description: 'CUP PHP adapter scaffold',
          type: 'library',
          license: 'MIT',
          autoload: {
            'psr-4': {
              'Tosiiko\\\\Cup\\\\': 'src/',
            },
          },
        }, null, 2) + '\n'],
        ['src/PhpCup.php', `<?php\n\ndeclare(strict_types=1);\n\nnamespace Tosiiko\\Cup;\n\nfinal class PhpCup\n{\n    public const ADAPTER_NAME = '${adapter.namespace}';\n    public const PROTOCOL_VERSION = '1';\n}\n`],
      );
      break;
    case 'rb':
      files.push(
        ['rb-cup.gemspec', `Gem::Specification.new do |spec|\n  spec.name = "${adapter.namespace}"\n  spec.version = "${packageVersion}"\n  spec.summary = "CUP Ruby adapter scaffold"\n  spec.files = Dir["lib/**/*.rb"]\n  spec.require_paths = ["lib"]\nend\n`],
        ['lib/rb/cup.rb', `module Rb\n  module Cup\n    ADAPTER_NAME = "${adapter.namespace}"\n    PROTOCOL_VERSION = "1"\n  end\nend\n`],
      );
      break;
    case 'ex':
      files.push(
        ['mix.exs', `defmodule ExCup.MixProject do\n  use Mix.Project\n\n  def project do\n    [\n      app: :ex_cup,\n      version: "${packageVersion}",\n      elixir: "~> 1.16"\n    ]\n  end\nend\n`],
        ['lib/ex_cup.ex', `defmodule ExCup do\n  @adapter_name "${adapter.namespace}"\n  @protocol_version "1"\n\n  def adapter_name, do: @adapter_name\n  def protocol_version, do: @protocol_version\nend\n`],
      );
      break;
    case 'kt':
      files.push(
        ['settings.gradle.kts', `rootProject.name = "${adapter.namespace}"\n`],
        ['build.gradle.kts', `plugins {\n  kotlin("jvm") version "1.9.24"\n}\n\ngroup = "dev.tosiiko.cup"\nversion = "${packageVersion}"\n`],
        ['src/main/kotlin/dev/tosiiko/cup/KtCup.kt', `package dev.tosiiko.cup\n\nobject KtCup {\n    const val ADAPTER_NAME = "${adapter.namespace}"\n    const val PROTOCOL_VERSION = "1"\n}\n`],
      );
      break;
    case 'swift':
      files.push(
        ['Package.swift', `// swift-tools-version: 5.9\nimport PackageDescription\n\nlet package = Package(\n    name: "${adapter.namespace}",\n    products: [.library(name: "SwiftCup", targets: ["SwiftCup"])],\n    targets: [.target(name: "SwiftCup")]\n)\n`],
        ['Sources/SwiftCup/SwiftCup.swift', `public enum SwiftCup {\n    public static let adapterName = "${adapter.namespace}"\n    public static let protocolVersion = "1"\n}\n`],
      );
      break;
    case 'dart':
      files.push(
        ['pubspec.yaml', `name: ${adapter.namespace.replace(/-/g, '_')}\ndescription: CUP Dart adapter scaffold\nversion: ${packageVersion}\nenvironment:\n  sdk: '>=3.0.0 <4.0.0'\n`],
        ['lib/dart_cup.dart', `library dart_cup;\n\nconst adapterName = '${adapter.namespace}';\nconst protocolVersion = '1';\n`],
      );
      break;
    case 'clj':
      files.push(
        ['deps.edn', `{:paths ["src"]}\n`],
        ['src/clj_cup/core.clj', `(ns clj-cup.core)\n\n(def adapter-name "${adapter.namespace}")\n(def protocol-version "1")\n`],
      );
      break;
    case 'lua':
      files.push(
        ['lua-cup-scm-1.rockspec', `package = "${adapter.namespace}"\nversion = "scm-1"\nsource = { url = "git://example.invalid/${adapter.namespace}" }\nbuild = { type = "builtin", modules = { ["cup"] = "lua/cup.lua" } }\n`],
        ['lua/cup.lua', `local M = {}\nM.adapter_name = "${adapter.namespace}"\nM.protocol_version = "1"\nreturn M\n`],
      );
      break;
    case 'zig':
      files.push(
        ['build.zig', `const std = @import("std");\npub fn build(b: *std.Build) void {\n    _ = b;\n}\n`],
        ['src/lib.zig', `pub const adapter_name = "${adapter.namespace}";\npub const protocol_version = "1";\n`],
      );
      break;
    case 'nim':
      files.push(
        ['nim-cup.nimble', `version = "${packageVersion}"\nauthor = "CUP contributors"\ndescription = "CUP Nim adapter scaffold"\n`],
        ['src/nim_cup.nim', `const adapterName* = "${adapter.namespace}"\nconst protocolVersion* = "1"\n`],
      );
      break;
    case 'ml':
      files.push(
        ['dune-project', `(lang dune 3.11)\n(name ${adapter.namespace})\n`],
        ['lib/dune', `(library\n (name cup))\n`],
        ['lib/cup.ml', `let adapter_name = "${adapter.namespace}"\nlet protocol_version = "1"\n`],
      );
      break;
    case 'pl':
      files.push(
        ['Makefile.PL', `use ExtUtils::MakeMaker;\nWriteMakefile(NAME => 'CUP', VERSION => '${packageVersion}');\n`],
        ['lib/CUP.pm', `package CUP;\nuse strict;\nuse warnings;\nour $ADAPTER_NAME = '${adapter.namespace}';\nour $PROTOCOL_VERSION = '1';\n1;\n`],
      );
      break;
    case 'hs':
      files.push(
        ['hs-cup.cabal', `cabal-version: 2.4\nname: ${adapter.namespace}\nversion: ${packageVersion}\nlibrary\n  exposed-modules: CUP\n  hs-source-dirs: src\n  build-depends: base >=4.14 && <5\n  default-language: Haskell2010\n`],
        ['src/CUP.hs', `module CUP where\n\nadapterName :: String\nadapterName = "${adapter.namespace}"\n\nprotocolVersion :: String\nprotocolVersion = "1"\n`],
      );
      break;
    default:
      break;
  }

  return files;
}

for (const adapter of registry.adapters) {
  const adapterDir = resolve(rootDir, adapter.repo_path);
  ensureDir(adapterDir);

  for (const [relativePath, content] of filesFor(adapter)) {
    write(join(adapterDir, relativePath), content);
  }
}

console.log(`bootstrapped ${registry.adapters.length} adapter paths`);
