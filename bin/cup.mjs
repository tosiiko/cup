#!/usr/bin/env node

import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = dirname(fileURLToPath(import.meta.url));
const packageRoot = resolve(scriptDir, '..');
const packageInfo = JSON.parse(readFileSync(resolve(packageRoot, 'package.json'), 'utf8'));
const packageVersion = packageInfo.version;
const runtimeSource = resolve(packageRoot, 'dist', 'index.js');

const supportedAdapters = new Set(['ts-cup', 'py-cup', 'node-cup', 'go-cup']);
const adapterAliases = new Map([
  ['ts', 'ts-cup'],
  ['typescript', 'ts-cup'],
  ['py', 'py-cup'],
  ['python', 'py-cup'],
  ['node', 'node-cup'],
  ['go', 'go-cup'],
]);

main(process.argv.slice(2));

function main(argv) {
  if (argv.length === 0 || argv[0] === '--help' || argv[0] === '-h') {
    printUsage();
    process.exit(0);
  }

  const [command, ...rest] = argv;
  if (command !== 'init') {
    fail(`unknown command: ${command}`);
  }

  const options = parseInitArgs(rest);
  const adapter = normalizeAdapter(options.adapter);
  if (!adapter) {
    fail('`init` requires --adapter <name>. Supported: ts-cup, py-cup, node-cup, go-cup');
  }

  if (!supportedAdapters.has(adapter)) {
    fail(`adapter "${adapter}" is not runnable in \`cup init\` yet. Supported now: ts-cup, py-cup, node-cup, go-cup`);
  }

  if (options.template !== 'login') {
    fail(`template "${options.template}" is not available yet. Supported now: login`);
  }

  const targetDir = resolve(process.cwd(), options.target);
  const projectName = inferProjectName(targetDir);
  const files = buildScaffold(adapter, projectName);

  for (const file of files) {
    const destination = resolve(targetDir, file.path);
    ensureParentDir(destination);

    if (existsSync(destination) && !options.force) {
      fail(`refusing to overwrite existing file: ${relativeOrAbsolute(destination)}`);
    }

    if (file.copyFrom) {
      copyFileSync(file.copyFrom, destination);
    } else {
      writeFileSync(destination, file.content, 'utf8');
    }
  }

  console.log(`[CUP] initialized ${adapter} login scaffold in ${relativeOrAbsolute(targetDir)}`);
  for (const file of files) {
    console.log(`  wrote ${file.path}`);
  }
  for (const note of notesFor(adapter)) {
    console.log(`  next: ${note}`);
  }
}

function parseInitArgs(args) {
  let adapter = '';
  let target = '.';
  let template = 'login';
  let force = false;

  for (let index = 0; index < args.length; index += 1) {
    const current = args[index];
    if (current === '--adapter') {
      adapter = args[++index] ?? '';
      continue;
    }
    if (current === '--template') {
      template = args[++index] ?? '';
      continue;
    }
    if (current === '--force') {
      force = true;
      continue;
    }
    if (current.startsWith('--')) {
      fail(`unknown option: ${current}`);
    }
    target = current;
  }

  return { adapter, force, target, template };
}

function normalizeAdapter(value) {
  if (!value) return '';
  const normalized = value.trim().toLowerCase();
  return adapterAliases.get(normalized) ?? normalized;
}

function inferProjectName(targetDir) {
  const parts = targetDir.split(/[\\/]/).filter(Boolean);
  return parts.at(-1) || 'cup-app';
}

function ensureParentDir(path) {
  mkdirSync(dirname(path), { recursive: true });
}

function relativeOrAbsolute(path) {
  const cwd = process.cwd();
  return path.startsWith(cwd) ? path.slice(cwd.length + 1) || '.' : path;
}

function fail(message) {
  console.error(`[CUP] ${message}`);
  console.error('');
  printUsage();
  process.exit(1);
}

function printUsage() {
  console.log('usage: cup init [target-dir] --adapter <ts-cup|py-cup|node-cup|go-cup> [--template login] [--force]');
  console.log('');
  console.log('examples:');
  console.log('  npx @tosiiko/cup init --adapter py-cup');
  console.log('  npx @tosiiko/cup init my-ts-login --adapter ts-cup');
  console.log('  npx @tosiiko/cup init services/auth-demo --adapter node-cup');
}

function notesFor(adapter) {
  switch (adapter) {
    case 'ts-cup':
      return [
        'run `npm install`',
        'run `npm run dev`',
      ];
    case 'py-cup':
      return [
        'run `python3 server.py`',
        'open http://127.0.0.1:8010',
      ];
    case 'node-cup':
      return [
        'run `node server.mjs`',
        'open http://127.0.0.1:8011',
      ];
    case 'go-cup':
      return [
        'run `go run .`',
        'open http://127.0.0.1:8012',
      ];
    default:
      return [];
  }
}

function buildScaffold(adapter, projectName) {
  switch (adapter) {
    case 'ts-cup':
      return buildTypeScriptLoginScaffold(projectName);
    case 'py-cup':
      return buildPythonLoginScaffold(projectName);
    case 'node-cup':
      return buildNodeLoginScaffold(projectName);
    case 'go-cup':
      return buildGoLoginScaffold(projectName);
    default:
      throw new Error(`unsupported adapter: ${adapter}`);
  }
}

function scaffoldFile(path, content) {
  return { path, content };
}

function copiedRuntime(path = 'cup/index.js') {
  return { path, copyFrom: runtimeSource };
}

function buildTypeScriptLoginScaffold(projectName) {
  const packageName = npmSafeName(projectName);
  return [
    scaffoldFile('.gitignore', [
      'node_modules/',
      'dist/',
      '.DS_Store',
      '.vite/',
      '',
    ].join('\n')),
    scaffoldFile('README.md', [
      `# ${humanize(projectName)}`,
      '',
      'A minimal CUP TypeScript login app.',
      '',
      '## Run',
      '',
      '```bash',
      'npm install',
      'npm run dev',
      '```',
      '',
      '## Demo Credentials',
      '',
      '- username: `demo`',
      '- password: `cup123`',
      '',
    ].join('\n')),
    scaffoldFile('package.json', JSON.stringify({
      name: packageName,
      private: true,
      version: '0.1.0',
      type: 'module',
      scripts: {
        dev: 'vite',
        build: 'tsc --noEmit && vite build',
        preview: 'vite preview',
      },
      dependencies: {
        '@tosiiko/cup': `^${packageVersion}`,
      },
      devDependencies: {
        typescript: '^5.8.3',
        vite: '^5.4.12',
      },
    }, null, 2) + '\n'),
    scaffoldFile('tsconfig.json', JSON.stringify({
      compilerOptions: {
        target: 'ES2020',
        useDefineForClassFields: true,
        module: 'ESNext',
        moduleResolution: 'Bundler',
        lib: ['ES2020', 'DOM', 'DOM.Iterable'],
        strict: true,
        noEmit: true,
        skipLibCheck: true,
        allowSyntheticDefaultImports: true,
        types: ['vite/client'],
      },
      include: ['src'],
    }, null, 2) + '\n'),
    scaffoldFile('index.html', [
      '<!doctype html>',
      '<html lang="en">',
      '  <head>',
      '    <meta charset="UTF-8" />',
      '    <meta name="viewport" content="width=device-width, initial-scale=1.0" />',
      `    <title>${humanize(projectName)}</title>`,
      '  </head>',
      '  <body>',
      '    <div id="app"></div>',
      '    <script type="module" src="/src/main.ts"></script>',
      '  </body>',
      '</html>',
      '',
    ].join('\n')),
    scaffoldFile('src/style.css', typeScriptLoginCss()),
    scaffoldFile('src/main.ts', typeScriptLoginMain(projectName, packageVersion)),
  ];
}

function buildPythonLoginScaffold(projectName) {
  return [
    scaffoldFile('.gitignore', [
      '__pycache__/',
      '*.pyc',
      '.DS_Store',
      '',
    ].join('\n')),
    scaffoldFile('README.md', [
      `# ${humanize(projectName)}`,
      '',
      'A minimal py-cup style login demo.',
      '',
      '## Run',
      '',
      '```bash',
      'python3 server.py',
      '```',
      '',
      '## Demo Credentials',
      '',
      '- username: `demo`',
      '- password: `cup123`',
      '',
    ].join('\n')),
    scaffoldFile('index.html', sharedLoginHtml(`${humanize(projectName)} · py-cup`)),
    scaffoldFile('server.py', pythonLoginServer(projectName)),
    scaffoldFile('vendor/py_cup/cup.py', minimalPyCupModule()),
    copiedRuntime(),
  ];
}

function buildNodeLoginScaffold(projectName) {
  return [
    scaffoldFile('.gitignore', [
      '.DS_Store',
      '',
    ].join('\n')),
    scaffoldFile('README.md', [
      `# ${humanize(projectName)}`,
      '',
      'A minimal node-cup style login demo.',
      '',
      '## Run',
      '',
      '```bash',
      'node server.mjs',
      '```',
      '',
      '## Demo Credentials',
      '',
      '- username: `demo`',
      '- password: `cup123`',
      '',
    ].join('\n')),
    scaffoldFile('index.html', sharedLoginHtml(`${humanize(projectName)} · node-cup`)),
    scaffoldFile('server.mjs', nodeLoginServer(projectName)),
    copiedRuntime(),
  ];
}

function buildGoLoginScaffold(projectName) {
  return [
    scaffoldFile('.gitignore', [
      '.DS_Store',
      '',
    ].join('\n')),
    scaffoldFile('README.md', [
      `# ${humanize(projectName)}`,
      '',
      'A minimal go-cup style login demo.',
      '',
      '## Run',
      '',
      '```bash',
      'go run .',
      '```',
      '',
      '## Demo Credentials',
      '',
      '- username: `demo`',
      '- password: `cup123`',
      '',
    ].join('\n')),
    scaffoldFile('go.mod', [
      `module ${goSafeModuleName(projectName)}`,
      '',
      'go 1.22',
      '',
    ].join('\n')),
    scaffoldFile('index.html', sharedLoginHtml(`${humanize(projectName)} · go-cup`)),
    scaffoldFile('main.go', goLoginServer(projectName)),
    copiedRuntime(),
  ];
}

function sharedLoginHtml(title) {
  return [
    '<!doctype html>',
    '<html lang="en">',
    '<head>',
    '  <meta charset="UTF-8" />',
    '  <meta name="viewport" content="width=device-width, initial-scale=1.0" />',
    `  <title>${escapeHtml(title)}</title>`,
    '  <style>',
    '    :root {',
    '      --bg: #f4efe6;',
    '      --panel: rgba(255, 255, 255, 0.86);',
    '      --text: #24180d;',
    '      --muted: #76634f;',
    '      --accent: #b05c2f;',
    '      --line: rgba(91, 60, 26, 0.12);',
    '      --shadow: 0 24px 50px rgba(53, 31, 8, 0.12);',
    '      font-family: "Avenir Next", "Segoe UI", sans-serif;',
    '    }',
    '    * { box-sizing: border-box; }',
    '    body {',
    '      margin: 0;',
    '      min-height: 100vh;',
    '      color: var(--text);',
    '      background:',
    '        radial-gradient(circle at top left, rgba(255,255,255,0.9), transparent 35%),',
    '        radial-gradient(circle at bottom right, rgba(176,92,47,0.16), transparent 32%),',
    '        linear-gradient(160deg, #efe2d0 0%, #f8f4ec 45%, #efe6d8 100%);',
    '      display: grid;',
    '      place-items: center;',
    '      padding: 24px;',
    '    }',
    '    .frame {',
    '      width: min(100%, 920px);',
    '      display: grid;',
    '      grid-template-columns: 1.1fr 0.9fr;',
    '      background: var(--panel);',
    '      border: 1px solid var(--line);',
    '      border-radius: 28px;',
    '      overflow: hidden;',
    '      box-shadow: var(--shadow);',
    '      backdrop-filter: blur(18px);',
    '    }',
    '    .hero {',
    '      padding: 44px;',
    '      background: linear-gradient(135deg, #f5e4d4 0%, #ead2bb 100%);',
    '      display: grid;',
    '      gap: 20px;',
    '      align-content: center;',
    '    }',
    '    .badge {',
    '      display: inline-flex;',
    '      width: fit-content;',
    '      padding: 10px 14px;',
    '      border-radius: 999px;',
    '      background: rgba(255,255,255,0.66);',
    '      border: 1px solid rgba(36,24,13,0.08);',
    '      font-size: 12px;',
    '      letter-spacing: 0.12em;',
    '      text-transform: uppercase;',
    '      color: var(--muted);',
    '    }',
    '    .hero h1 { margin: 0; font-size: clamp(2.4rem, 5vw, 4rem); line-height: 0.96; letter-spacing: -0.05em; }',
    '    .hero p { margin: 0; color: var(--muted); line-height: 1.6; }',
    '    .app-shell { padding: 32px; display: grid; place-items: center; background: rgba(255,255,255,0.65); }',
    '    #app { width: 100%; min-height: 460px; }',
    '    .loading { width: 100%; min-height: 460px; display: grid; place-items: center; color: var(--muted); text-transform: uppercase; letter-spacing: 0.08em; }',
    '    @media (max-width: 900px) { .frame { grid-template-columns: 1fr; } .hero, .app-shell { padding: 26px; } }',
    '  </style>',
    '</head>',
    '<body>',
    '  <div class="frame">',
    '    <section class="hero">',
    '      <span class="badge">CUP Login Scaffold</span>',
    '      <h1>Start with a real login flow, not a blank folder.</h1>',
    '      <p>This scaffold returns protocol views from the server and mounts them with the CUP browser runtime.</p>',
    '      <p>Demo credentials: <strong>demo</strong> / <strong>cup123</strong></p>',
    '    </section>',
    '    <section class="app-shell">',
    '      <div id="app"><div class="loading">Loading CUP view…</div></div>',
    '    </section>',
    '  </div>',
    '  <script type="module">',
    "    import { mountRemoteView, validateProtocolView } from '/cup/index.js';",
    '',
    "    const app = document.getElementById('app');",
    '',
    '    async function requestView(url, init = {}) {',
    '      const response = await fetch(url, {',
    "        headers: { 'Content-Type': 'application/json', ...(init.headers ?? {}) },",
    '        ...init,',
    '      });',
    '      if (!response.ok) throw new Error(`Request failed: ${response.status} ${response.statusText}`);',
    '      const view = validateProtocolView(await response.json());',
    '      mountRemoteView(view, app);',
    '      document.title = view.meta?.title ?? document.title;',
    '      return view;',
    '    }',
    '',
    '    async function submitLogin() {',
    "      const form = app.querySelector('[data-login-form]');",
    '      if (!(form instanceof HTMLFormElement)) return;',
    "      const values = new FormData(form);",
    '      const payload = {',
    "        username: String(values.get('username') ?? ''),",
    "        password: String(values.get('password') ?? ''),",
    '      };',
    "      const button = form.querySelector('[data-login-button]');",
    '      if (button instanceof HTMLButtonElement) {',
    '        button.disabled = true;',
    "        button.textContent = 'Signing in...';",
    '      }',
    '      try {',
    "        await requestView('/api/login', { method: 'POST', body: JSON.stringify(payload) });",
    '      } finally {',
    '        if (button instanceof HTMLButtonElement) {',
    '          button.disabled = false;',
    "          button.textContent = 'Sign in';",
    '        }',
    '      }',
    '    }',
    '',
    "    app.addEventListener('cup-login-submit', () => { void submitLogin(); });",
    "    app.addEventListener('cup-login-reset', () => { void requestView('/api/view'); });",
    "    app.addEventListener('cup-login-fill-demo', () => {",
    "      const form = app.querySelector('[data-login-form]');",
    '      if (!(form instanceof HTMLFormElement)) return;',
    "      const username = form.querySelector('input[name=\"username\"]');",
    "      const password = form.querySelector('input[name=\"password\"]');",
    '      if (username instanceof HTMLInputElement) username.value = "demo";',
    '      if (password instanceof HTMLInputElement) {',
    '        password.value = "cup123";',
    '        password.focus();',
    '        password.select();',
    '      }',
    '    });',
    '',
    "    requestView('/api/view').catch((error) => {",
    '      console.error(error);',
    '      app.textContent = error instanceof Error ? error.message : String(error);',
    '    });',
    '  </script>',
    '</body>',
    '</html>',
    '',
  ].join('\n');
}

function pythonLoginServer(projectName) {
  return [
    'from __future__ import annotations',
    '',
    'import json',
    'import os',
    'import sys',
    'from http.server import BaseHTTPRequestHandler, HTTPServer',
    'from pathlib import Path',
    'from typing import Any',
    '',
    'APP_DIR = Path(__file__).resolve().parent',
    'sys.path.insert(0, str(APP_DIR / "vendor" / "py_cup"))',
    '',
    'from cup import EmitAction, STARTER_VIEW_POLICY, UIView, validate_view_policy  # noqa: E402',
    '',
    'HOST = os.environ.get("CUP_LOGIN_HOST", "127.0.0.1")',
    'PORT = int(os.environ.get("CUP_LOGIN_PORT", "8010"))',
    'VALID_USERNAME = "demo"',
    'VALID_PASSWORD = "cup123"',
    '',
    'INDEX_FILE = APP_DIR / "index.html"',
    'RUNTIME_FILE = APP_DIR / "cup" / "index.js"',
    '',
    'def login_view(*, username: str = "", error: str | None = None, notice: str | None = None) -> UIView:',
    '    template = """',
    `    <section style="display:grid;gap:22px;">`,
    `      <div style="display:grid;gap:10px;">`,
    `        <span style="font-size:12px;letter-spacing:0.12em;text-transform:uppercase;color:#8b7965;">py-cup</span>`,
    `        <h2 style="margin:0;font-size:2.2rem;letter-spacing:-0.05em;color:#24180d;">Welcome back</h2>`,
    `        <p style="margin:0;color:#76634f;line-height:1.6;">Sign in with the demo account to see the next CUP view.</p>`,
    `      </div>`,
    '',
    '      {% if error %}',
    `        <div style="padding:14px 16px;border-radius:16px;background:#fff0ee;color:#8f2e22;border:1px solid rgba(143,46,34,0.12);">{{ error }}</div>`,
    '      {% endif %}',
    '',
    '      {% if notice %}',
    `        <div style="padding:14px 16px;border-radius:16px;background:#eef8ef;color:#24653a;border:1px solid rgba(36,101,58,0.12);">{{ notice }}</div>`,
    '      {% endif %}',
    '',
    `      <form data-login-form style="display:grid;gap:16px;">`,
    `        <label style="display:grid;gap:8px;">`,
    `          <span style="font-size:13px;font-weight:600;color:#5f4e3f;">Username</span>`,
    `          <input name="username" type="text" value="{{ username }}" autocomplete="username" placeholder="demo" style="width:100%;padding:14px 16px;border-radius:16px;border:1px solid rgba(102,70,30,0.14);background:#fff;color:#24180d;font:inherit;" />`,
    `        </label>`,
    `        <label style="display:grid;gap:8px;">`,
    `          <span style="font-size:13px;font-weight:600;color:#5f4e3f;">Password</span>`,
    `          <input name="password" type="password" autocomplete="current-password" placeholder="cup123" style="width:100%;padding:14px 16px;border-radius:16px;border:1px solid rgba(102,70,30,0.14);background:#fff;color:#24180d;font:inherit;" />`,
    `        </label>`,
    `        <div style="display:flex;gap:12px;flex-wrap:wrap;">`,
    `          <button type="button" data-action="submit" data-login-button style="padding:14px 18px;border:none;border-radius:18px;background:#b05c2f;color:white;font:inherit;font-weight:700;">Sign in</button>`,
    `          <button type="button" data-action="fill-demo" style="padding:14px 18px;border-radius:18px;border:1px solid rgba(102,70,30,0.14);background:#fff;color:#24180d;font:inherit;font-weight:700;">Use demo credentials</button>`,
    `        </div>`,
    `      </form>`,
    `    </section>`,
    '    """',
    '    return (',
    '        UIView(template)',
    '        .state(username=username, error=error, notice=notice)',
    '        .action("submit", EmitAction("cup-login-submit"))',
    '        .action("fill-demo", EmitAction("cup-login-fill-demo"))',
    `        .title("${escapePython(humanize(projectName))}")`,
    '        .route("/api/view")',
    '    )',
    '',
    'def success_view(username: str) -> UIView:',
    '    template = """',
    `    <section style="display:grid;gap:20px;">`,
    `      <div style="width:64px;height:64px;border-radius:18px;display:grid;place-items:center;background:#eef8ef;color:#24653a;font-size:1.8rem;">✓</div>`,
    `      <div style="display:grid;gap:10px;">`,
    `        <span style="font-size:12px;letter-spacing:0.12em;text-transform:uppercase;color:#8b7965;">Authenticated</span>`,
    `        <h2 style="margin:0;font-size:2.3rem;letter-spacing:-0.05em;color:#24180d;">Hello, {{ username }}</h2>`,
    `        <p style="margin:0;color:#76634f;line-height:1.6;">The server accepted your credentials and returned a new CUP view.</p>`,
    `      </div>`,
    `      <button type="button" data-action="reset" style="padding:14px 18px;border:none;border-radius:18px;background:#24180d;color:white;font:inherit;font-weight:700;">Back to login</button>`,
    `    </section>`,
    '    """',
    '    return (',
    '        UIView(template)',
    '        .state(username=username)',
    '        .action("reset", EmitAction("cup-login-reset"))',
    `        .title("${escapePython(humanize(projectName))} Success")`,
    '        .route("/api/login")',
    '    )',
    '',
    'class DemoHandler(BaseHTTPRequestHandler):',
    '    def log_message(self, fmt: str, *args: Any) -> None:',
    '        print(f"[py-cup] {self.command} {self.path} -> {args[0]}")',
    '',
    '    def send_text(self, body: str, *, content_type: str = "text/html; charset=utf-8", status: int = 200) -> None:',
    '        payload = body.encode("utf-8")',
    '        self.send_response(status)',
    '        self.send_header("Content-Type", content_type)',
    '        self.send_header("Content-Length", str(len(payload)))',
    '        self.end_headers()',
    '        self.wfile.write(payload)',
    '',
    '    def send_view(self, view: UIView, *, status: int = 200) -> None:',
    '        validate_view_policy(view, STARTER_VIEW_POLICY)',
    '        body, content_type = view.to_response()',
    '        self.send_text(body, content_type=content_type, status=status)',
    '',
    '    def read_json(self) -> dict[str, Any]:',
    '        length = int(self.headers.get("Content-Length", "0"))',
    '        if length <= 0:',
    '            return {}',
    '        raw = self.rfile.read(length)',
    '        if not raw:',
    '            return {}',
    '        payload = json.loads(raw.decode("utf-8"))',
    '        return payload if isinstance(payload, dict) else {}',
    '',
    '    def do_GET(self) -> None:',
    '        if self.path == "/":',
    '            self.send_text(INDEX_FILE.read_text(encoding="utf-8"))',
    '            return',
    '        if self.path == "/api/view":',
    '            self.send_view(login_view(notice="Use the demo credentials shown on the page."))',
    '            return',
    '        if self.path == "/cup/index.js":',
    '            self.send_text(RUNTIME_FILE.read_text(encoding="utf-8"), content_type="text/javascript; charset=utf-8")',
    '            return',
    '        self.send_text("Not found", content_type="text/plain; charset=utf-8", status=404)',
    '',
    '    def do_POST(self) -> None:',
    '        if self.path != "/api/login":',
    '            self.send_text("Not found", content_type="text/plain; charset=utf-8", status=404)',
    '            return',
    '        payload = self.read_json()',
    '        username = str(payload.get("username", "")).strip()',
    '        password = str(payload.get("password", ""))',
    '        if username == VALID_USERNAME and password == VALID_PASSWORD:',
    '            self.send_view(success_view(username))',
    '            return',
    '        self.send_view(login_view(username=username, error="Incorrect username or password. Try the demo credentials and submit again."))',
    '',
    'def main() -> None:',
    '    if not RUNTIME_FILE.exists():',
    '        raise SystemExit("cup/index.js not found. The scaffold should include the CUP browser runtime.")',
    '    try:',
    '        server = HTTPServer((HOST, PORT), DemoHandler)',
    '    except OSError as error:',
    '        if error.errno == 48:',
    '            raise SystemExit(f"Port {PORT} is already in use on {HOST}. Try `CUP_LOGIN_PORT={PORT + 1} python3 server.py`.") from error',
    '        raise',
    '    print(f"py-cup login demo -> http://{HOST}:{PORT}")',
    '    server.serve_forever()',
    '',
    'if __name__ == "__main__":',
    '    main()',
    '',
  ].join('\n');
}

function nodeLoginServer(projectName) {
  return [
    "import { createServer } from 'node:http';",
    "import { readFileSync } from 'node:fs';",
    "import { fileURLToPath } from 'node:url';",
    "import { dirname, join } from 'node:path';",
    '',
    'const appDir = dirname(fileURLToPath(import.meta.url));',
    'const host = process.env.CUP_NODE_LOGIN_HOST || "127.0.0.1";',
    'const port = Number.parseInt(process.env.CUP_NODE_LOGIN_PORT || "8011", 10);',
    'const validUsername = "demo";',
    'const validPassword = "cup123";',
    '',
    'const indexHtml = readFileSync(join(appDir, "index.html"), "utf8");',
    'const runtimeJs = readFileSync(join(appDir, "cup", "index.js"), "utf8");',
    '',
    `const appTitle = ${JSON.stringify(humanize(projectName))};`,
    '',
    'function loginView(username = "", error = null, notice = null) {',
    '  return {',
    '    template: `',
    '      <section style="display:grid;gap:22px;">',
    '        <div style="display:grid;gap:10px;">',
    '          <span style="font-size:12px;letter-spacing:0.12em;text-transform:uppercase;color:#8b7965;">node-cup</span>',
    '          <h2 style="margin:0;font-size:2.2rem;letter-spacing:-0.05em;color:#24180d;">Welcome back</h2>',
    '          <p style="margin:0;color:#76634f;line-height:1.6;">Sign in with the demo account to see the next CUP view.</p>',
    '        </div>',
    '        {% if error %}<div style="padding:14px 16px;border-radius:16px;background:#fff0ee;color:#8f2e22;border:1px solid rgba(143,46,34,0.12);">{{ error }}</div>{% endif %}',
    '        {% if notice %}<div style="padding:14px 16px;border-radius:16px;background:#eef8ef;color:#24653a;border:1px solid rgba(36,101,58,0.12);">{{ notice }}</div>{% endif %}',
    '        <form data-login-form style="display:grid;gap:16px;">',
    '          <label style="display:grid;gap:8px;"><span style="font-size:13px;font-weight:600;color:#5f4e3f;">Username</span><input name="username" type="text" value="{{ username }}" autocomplete="username" placeholder="demo" style="width:100%;padding:14px 16px;border-radius:16px;border:1px solid rgba(102,70,30,0.14);background:#fff;color:#24180d;font:inherit;" /></label>',
    '          <label style="display:grid;gap:8px;"><span style="font-size:13px;font-weight:600;color:#5f4e3f;">Password</span><input name="password" type="password" autocomplete="current-password" placeholder="cup123" style="width:100%;padding:14px 16px;border-radius:16px;border:1px solid rgba(102,70,30,0.14);background:#fff;color:#24180d;font:inherit;" /></label>',
    '          <div style="display:flex;gap:12px;flex-wrap:wrap;">',
    '            <button type="button" data-action="submit" data-login-button style="padding:14px 18px;border:none;border-radius:18px;background:#b05c2f;color:white;font:inherit;font-weight:700;">Sign in</button>',
    '            <button type="button" data-action="fill-demo" style="padding:14px 18px;border-radius:18px;border:1px solid rgba(102,70,30,0.14);background:#fff;color:#24180d;font:inherit;font-weight:700;">Use demo credentials</button>',
    '          </div>',
    '        </form>',
    '      </section>',
    '    `,',
    '    state: { username, error, notice },',
    '    actions: {',
    "      submit: { type: 'emit', event: 'cup-login-submit' },",
    "      'fill-demo': { type: 'emit', event: 'cup-login-fill-demo' },",
    '    },',
    "    meta: { version: '1', title: appTitle, route: '/api/view' },",
    '  };',
    '}',
    '',
    'function successView(username) {',
    '  return {',
    '    template: `',
    '      <section style="display:grid;gap:20px;">',
    '        <div style="width:64px;height:64px;border-radius:18px;display:grid;place-items:center;background:#eef8ef;color:#24653a;font-size:1.8rem;">✓</div>',
    '        <div style="display:grid;gap:10px;">',
    '          <span style="font-size:12px;letter-spacing:0.12em;text-transform:uppercase;color:#8b7965;">Authenticated</span>',
    '          <h2 style="margin:0;font-size:2.3rem;letter-spacing:-0.05em;color:#24180d;">Hello, {{ username }}</h2>',
    '          <p style="margin:0;color:#76634f;line-height:1.6;">The server accepted your credentials and returned a new CUP view.</p>',
    '        </div>',
    '        <button type="button" data-action="reset" style="padding:14px 18px;border:none;border-radius:18px;background:#24180d;color:white;font:inherit;font-weight:700;">Back to login</button>',
    '      </section>',
    '    `,',
    '    state: { username },',
    "    actions: { reset: { type: 'emit', event: 'cup-login-reset' } },",
    "    meta: { version: '1', title: `${appTitle} Success`, route: '/api/login' },",
    '  };',
    '}',
    '',
    'function send(response, status, body, contentType = "text/plain; charset=utf-8") {',
    '  response.writeHead(status, { "Content-Type": contentType, "Content-Length": Buffer.byteLength(body) });',
    '  response.end(body);',
    '}',
    '',
    'const server = createServer(async (request, response) => {',
    '  const url = new URL(request.url || "/", `http://${host}:${port}`);',
    '  if (request.method === "GET" && url.pathname === "/") {',
    '    send(response, 200, indexHtml, "text/html; charset=utf-8");',
    '    return;',
    '  }',
    '  if (request.method === "GET" && url.pathname === "/api/view") {',
    '    send(response, 200, JSON.stringify(loginView("", null, "Use the demo credentials shown on the page.")), "application/json; charset=utf-8");',
    '    return;',
    '  }',
    '  if (request.method === "GET" && url.pathname === "/cup/index.js") {',
    '    send(response, 200, runtimeJs, "text/javascript; charset=utf-8");',
    '    return;',
    '  }',
    '  if (request.method === "POST" && url.pathname === "/api/login") {',
    '    let body = "";',
    '    for await (const chunk of request) { body += chunk; }',
    '    const payload = body ? JSON.parse(body) : {};',
    '    const username = String(payload.username || "").trim();',
    '    const password = String(payload.password || "");',
    '    const nextView = username === validUsername && password === validPassword',
    '      ? successView(username)',
    '      : loginView(username, "Incorrect username or password. Try the demo credentials and submit again.", null);',
    '    send(response, 200, JSON.stringify(nextView), "application/json; charset=utf-8");',
    '    return;',
    '  }',
    '  send(response, 404, "Not found");',
    '});',
    '',
    'server.on("error", (error) => {',
    '  if (error && error.code === "EADDRINUSE") {',
    '    console.error(`Port ${port} is already in use on ${host}. Try CUP_NODE_LOGIN_PORT=${port + 1} node server.mjs`);',
    '    process.exit(1);',
    '  }',
    '  throw error;',
    '});',
    '',
    'server.listen(port, host, () => {',
    '  console.log(`node-cup login demo -> http://${host}:${port}`);',
    '});',
    '',
  ].join('\n');
}

function goLoginServer(projectName) {
  return [
    'package main',
    '',
    'import (',
    '  "encoding/json"',
    '  "fmt"',
    '  "net/http"',
    '  "os"',
    '  "path/filepath"',
    ')',
    '',
    'type ProtocolView struct {',
    '  Template string                 `json:"template"`',
    '  State    map[string]any         `json:"state"`',
    '  Actions  map[string]any         `json:"actions,omitempty"`',
    '  Meta     map[string]string      `json:"meta,omitempty"`',
    '}',
    '',
    'var (',
    `  appTitle      = ${JSON.stringify(humanize(projectName))}`,
    '  validUsername = "demo"',
    '  validPassword = "cup123"',
    ')',
    '',
    'func loginView(username, errorMessage, notice string) ProtocolView {',
    '  return ProtocolView{',
    '    Template: `',
    '      <section style="display:grid;gap:22px;">',
    '        <div style="display:grid;gap:10px;">',
    '          <span style="font-size:12px;letter-spacing:0.12em;text-transform:uppercase;color:#8b7965;">go-cup</span>',
    '          <h2 style="margin:0;font-size:2.2rem;letter-spacing:-0.05em;color:#24180d;">Welcome back</h2>',
    '          <p style="margin:0;color:#76634f;line-height:1.6;">Sign in with the demo account to see the next CUP view.</p>',
    '        </div>',
    '        {% if error %}<div style="padding:14px 16px;border-radius:16px;background:#fff0ee;color:#8f2e22;border:1px solid rgba(143,46,34,0.12);">{{ error }}</div>{% endif %}',
    '        {% if notice %}<div style="padding:14px 16px;border-radius:16px;background:#eef8ef;color:#24653a;border:1px solid rgba(36,101,58,0.12);">{{ notice }}</div>{% endif %}',
    '        <form data-login-form style="display:grid;gap:16px;">',
    '          <label style="display:grid;gap:8px;"><span style="font-size:13px;font-weight:600;color:#5f4e3f;">Username</span><input name="username" type="text" value="{{ username }}" autocomplete="username" placeholder="demo" style="width:100%;padding:14px 16px;border-radius:16px;border:1px solid rgba(102,70,30,0.14);background:#fff;color:#24180d;font:inherit;" /></label>',
    '          <label style="display:grid;gap:8px;"><span style="font-size:13px;font-weight:600;color:#5f4e3f;">Password</span><input name="password" type="password" autocomplete="current-password" placeholder="cup123" style="width:100%;padding:14px 16px;border-radius:16px;border:1px solid rgba(102,70,30,0.14);background:#fff;color:#24180d;font:inherit;" /></label>',
    '          <div style="display:flex;gap:12px;flex-wrap:wrap;">',
    '            <button type="button" data-action="submit" data-login-button style="padding:14px 18px;border:none;border-radius:18px;background:#b05c2f;color:white;font:inherit;font-weight:700;">Sign in</button>',
    '            <button type="button" data-action="fill-demo" style="padding:14px 18px;border-radius:18px;border:1px solid rgba(102,70,30,0.14);background:#fff;color:#24180d;font:inherit;font-weight:700;">Use demo credentials</button>',
    '          </div>',
    '        </form>',
    '      </section>',
    '    `,',
    '    State: map[string]any{"username": username, "error": nullable(errorMessage), "notice": nullable(notice)},',
    '    Actions: map[string]any{',
    `      "submit": map[string]any{"type": "emit", "event": "cup-login-submit"},`,
    `      "fill-demo": map[string]any{"type": "emit", "event": "cup-login-fill-demo"},`,
    '    },',
    '    Meta: map[string]string{"version": "1", "title": appTitle, "route": "/api/view"},',
    '  }',
    '}',
    '',
    'func successView(username string) ProtocolView {',
    '  return ProtocolView{',
    '    Template: `',
    '      <section style="display:grid;gap:20px;">',
    '        <div style="width:64px;height:64px;border-radius:18px;display:grid;place-items:center;background:#eef8ef;color:#24653a;font-size:1.8rem;">✓</div>',
    '        <div style="display:grid;gap:10px;">',
    '          <span style="font-size:12px;letter-spacing:0.12em;text-transform:uppercase;color:#8b7965;">Authenticated</span>',
    '          <h2 style="margin:0;font-size:2.3rem;letter-spacing:-0.05em;color:#24180d;">Hello, {{ username }}</h2>',
    '          <p style="margin:0;color:#76634f;line-height:1.6;">The server accepted your credentials and returned a new CUP view.</p>',
    '        </div>',
    '        <button type="button" data-action="reset" style="padding:14px 18px;border:none;border-radius:18px;background:#24180d;color:white;font:inherit;font-weight:700;">Back to login</button>',
    '      </section>',
    '    `,',
    '    State: map[string]any{"username": username},',
    '    Actions: map[string]any{"reset": map[string]any{"type": "emit", "event": "cup-login-reset"}},',
    '    Meta: map[string]string{"version": "1", "title": appTitle + " Success", "route": "/api/login"},',
    '  }',
    '}',
    '',
    'func nullable(value string) any {',
    '  if value == "" {',
    '    return nil',
    '  }',
    '  return value',
    '}',
    '',
    'func sendJSON(w http.ResponseWriter, view ProtocolView) {',
    '  payload, _ := json.Marshal(view)',
    '  w.Header().Set("Content-Type", "application/json; charset=utf-8")',
    '  w.WriteHeader(http.StatusOK)',
    '  _, _ = w.Write(payload)',
    '}',
    '',
    'func main() {',
    '  host := getenv("CUP_GO_LOGIN_HOST", "127.0.0.1")',
    '  port := getenv("CUP_GO_LOGIN_PORT", "8012")',
    '  indexHTML, err := os.ReadFile(filepath.Join("index.html"))',
    '  if err != nil { panic(err) }',
    '  runtimeJS, err := os.ReadFile(filepath.Join("cup", "index.js"))',
    '  if err != nil { panic(err) }',
    '',
    '  mux := http.NewServeMux()',
    '  mux.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {',
    '    if r.URL.Path != "/" { http.NotFound(w, r); return }',
    '    w.Header().Set("Content-Type", "text/html; charset=utf-8")',
    '    _, _ = w.Write(indexHTML)',
    '  })',
    '  mux.HandleFunc("/cup/index.js", func(w http.ResponseWriter, r *http.Request) {',
    '    w.Header().Set("Content-Type", "text/javascript; charset=utf-8")',
    '    _, _ = w.Write(runtimeJS)',
    '  })',
    '  mux.HandleFunc("/api/view", func(w http.ResponseWriter, r *http.Request) {',
    '    sendJSON(w, loginView("", "", "Use the demo credentials shown on the page."))',
    '  })',
    '  mux.HandleFunc("/api/login", func(w http.ResponseWriter, r *http.Request) {',
    '    if r.Method != http.MethodPost { http.NotFound(w, r); return }',
    '    defer r.Body.Close()',
    '    var payload map[string]any',
    '    _ = json.NewDecoder(r.Body).Decode(&payload)',
    '    username := fmt.Sprint(payload["username"])',
    '    password := fmt.Sprint(payload["password"])',
    '    if username == validUsername && password == validPassword {',
    '      sendJSON(w, successView(username))',
    '      return',
    '    }',
    '    sendJSON(w, loginView(username, "Incorrect username or password. Try the demo credentials and submit again.", ""))',
    '  })',
    '',
    '  address := host + ":" + port',
    '  fmt.Printf("go-cup login demo -> http://%s\\n", address)',
    '  if err := http.ListenAndServe(address, mux); err != nil {',
    '    panic(err)',
    '  }',
    '}',
    '',
    'func getenv(name, fallback string) string {',
    '  if value := os.Getenv(name); value != "" {',
    '    return value',
    '  }',
    '  return fallback',
    '}',
    '',
  ].join('\n');
}

function minimalPyCupModule() {
  return [
    'from __future__ import annotations',
    '',
    'import json',
    'from dataclasses import dataclass, field',
    'from typing import Any',
    '',
    'STARTER_VIEW_POLICY: dict[str, Any] = {"requireVersion": True}',
    'ADAPTER_GENERATOR = "py-cup/init"',
    '',
    '@dataclass(frozen=True)',
    'class EmitAction:',
    '    event: str',
    '    detail: dict[str, Any] = field(default_factory=dict)',
    '',
    '    def to_dict(self) -> dict[str, Any]:',
    '        payload: dict[str, Any] = {"type": "emit", "event": self.event}',
    '        if self.detail:',
    '            payload["detail"] = self.detail',
    '        return payload',
    '',
    'class UIView:',
    '    def __init__(self, template: str) -> None:',
    '        self.template = template',
    '        self._state: dict[str, Any] = {}',
    '        self._actions: dict[str, Any] = {}',
        '        self._meta: dict[str, Any] = {"version": "1", "lang": "python", "generator": ADAPTER_GENERATOR}',
    '',
    '    def state(self, **values: Any) -> "UIView":',
    '        self._state.update(values)',
    '        return self',
    '',
    '    def action(self, name: str, descriptor: Any) -> "UIView":',
    '        if hasattr(descriptor, "to_dict"):',
    '            self._actions[name] = descriptor.to_dict()',
    '        elif isinstance(descriptor, dict):',
    '            self._actions[name] = descriptor',
    '        else:',
    '            raise TypeError("action descriptors must be dicts or expose to_dict()")',
    '        return self',
    '',
    '    def title(self, value: str) -> "UIView":',
    '        self._meta["title"] = value',
    '        return self',
    '',
    '    def route(self, value: str) -> "UIView":',
    '        self._meta["route"] = value',
    '        return self',
    '',
    '    def to_dict(self) -> dict[str, Any]:',
    '        return {',
    '            "template": self.template,',
    '            "state": self._state,',
    '            "actions": self._actions,',
    '            "meta": self._meta,',
    '        }',
    '',
    '    def to_response(self) -> tuple[str, str]:',
    '        return json.dumps(self.to_dict()), "application/json; charset=utf-8"',
    '',
    'def validate_view_policy(view: UIView | dict[str, Any], policy: dict[str, Any] | None = None) -> UIView | dict[str, Any]:',
    '    payload = view.to_dict() if isinstance(view, UIView) else view',
    '    meta = payload.get("meta") if isinstance(payload, dict) else None',
    '    if not isinstance(meta, dict) or meta.get("version") != "1":',
    '        raise ValueError("view.meta.version must be \\"1\\"")',
    '    return view',
    '',
  ].join('\n');
}

function typeScriptLoginMain(projectName, version) {
  return [
    "import {",
    "  STARTER_VIEW_POLICY,",
    "  mountRemoteView,",
    "  validateProtocolView,",
    "  validateViewPolicy,",
    "  type ProtocolView,",
    `} from '@tosiiko/cup';`,
    "import './style.css';",
    '',
    'type LoginViewState = {',
    '  username: string;',
    '  error: string | null;',
    '  notice: string | null;',
    '  pending: boolean;',
    '};',
    '',
    "const root = document.querySelector<HTMLDivElement>('#app');",
    "if (!root) throw new Error('Missing #app root element');",
    'const appRoot = root;',
    "const demoUser = 'demo';",
    "const demoPassword = 'cup123';",
    '',
    'function shell(inner: string): string {',
    '  return `',
    '    <main class="shell">',
    '      <section class="hero">',
    '        <div class="hero-copy">',
    '          <span class="eyebrow"><span class="dot"></span>ts-cup</span>',
    '          <h1>Login flows can stay structured, even when they feel premium.</h1>',
    '          <p>This scaffold validates each protocol view before mount and keeps the browser layer tiny.</p>',
    '        </div>',
    '        <div class="stats">',
    '          <div class="stat"><strong>1 contract</strong><span>Protocol views stay consistent across screens.</span></div>',
    '          <div class="stat"><strong>0 frameworks</strong><span>Just CUP, TypeScript, and a tiny browser shell.</span></div>',
    '          <div class="stat"><strong>demo / cup123</strong><span>Use the seeded credentials to complete the flow.</span></div>',
    '        </div>',
    '      </section>',
    '      <section class="panel">${inner}</section>',
    '    </main>',
    '  `;',
    '}',
    '',
    'function loginView(state: LoginViewState): ProtocolView {',
    '  return {',
    '    template: shell(`',
    '      <section class="card">',
    '        <span class="badge">TypeScript Demo</span>',
    '        <div><h2>Sign in to your workspace</h2><p class="copy">The action buttons emit CUP events and the app remounts the next validated view.</p></div>',
    '        {% if error %}<div class="alert error">{{ error }}</div>{% endif %}',
    '        {% if notice %}<div class="alert notice">{{ notice }}</div>{% endif %}',
    '        <form class="form" data-login-form>',
    '          <label class="field"><span class="label">Username</span><input class="input" name="username" value="{{ username }}" placeholder="demo" autocomplete="username" /></label>',
    '          <label class="field"><span class="label">Password</span><input class="input" name="password" type="password" placeholder="cup123" autocomplete="current-password" /></label>',
    '          <div class="actions">',
    '            <button class="button" type="button" data-action="submit" {% if pending %}disabled{% endif %}>{% if pending %}Signing in...{% else %}Sign in{% endif %}</button>',
    '            <button class="button-secondary" type="button" data-action="fill-demo">Use demo credentials</button>',
    '          </div>',
    '        </form>',
    '      </section>',
    '    `),',
    '    state,',
    '    actions: {',
    "      submit: { type: 'emit', event: 'cup-login-submit' },",
    "      'fill-demo': { type: 'emit', event: 'cup-login-fill-demo' },",
    '    },',
    `    meta: { version: '1', title: ${JSON.stringify(humanize(projectName))}, route: '/login' },`,
    '  };',
    '}',
    '',
    'function successView(username: string): ProtocolView {',
    '  return {',
    '    template: shell(`',
    '      <section class="card">',
    '        <div class="success-mark">✓</div>',
    '        <span class="badge">Authenticated</span>',
    '        <div><h2>Welcome back, {{ username }}</h2><p class="copy">The next CUP view rendered successfully after the login event completed.</p></div>',
    '        <div class="alert success">Authentication complete. Your next route is now mounted.</div>',
    '        <div class="list">',
    '          <div class="list-item"><strong>1.</strong><span>The login button emitted a CUP action event.</span></div>',
    '          <div class="list-item"><strong>2.</strong><span>TypeScript assembled the next protocol view.</span></div>',
    '          <div class="list-item"><strong>3.</strong><span>CUP validated and remounted the new screen.</span></div>',
    '        </div>',
    '        <button class="button-secondary" type="button" data-action="reset">Back to login</button>',
    '      </section>',
    '    `),',
    '    state: { username },',
    "    actions: { reset: { type: 'emit', event: 'cup-login-reset' } },",
    `    meta: { version: '1', title: ${JSON.stringify(`${humanize(projectName)} Success`)}, route: '/login/success' },`,
    '  };',
    '}',
    '',
    'function render(view: ProtocolView): void {',
    '  const normalized = validateProtocolView(view);',
    '  validateViewPolicy(normalized, STARTER_VIEW_POLICY);',
    '  document.title = normalized.meta?.title ?? document.title;',
    '  mountRemoteView(normalized, appRoot);',
    '}',
    '',
    'function readCredentials() {',
    "  const form = appRoot.querySelector<HTMLFormElement>('[data-login-form]');",
    "  if (!form) return { username: '', password: '' };",
    '  const values = new FormData(form);',
    '  return {',
    "    username: String(values.get('username') ?? '').trim(),",
    "    password: String(values.get('password') ?? ''),",
    '  };',
    '}',
    '',
    'async function attemptLogin(): Promise<void> {',
    '  const credentials = readCredentials();',
    '  render(loginView({ username: credentials.username, error: null, notice: "Checking credentials against the demo profile...", pending: true }));',
    '  await new Promise((resolve) => window.setTimeout(resolve, 650));',
    '  if (credentials.username === demoUser && credentials.password === demoPassword) {',
    '    render(successView(credentials.username));',
    '    return;',
    '  }',
    '  render(loginView({ username: credentials.username, error: "Incorrect username or password. Try the demo credentials and submit again.", notice: null, pending: false }));',
    '}',
    '',
    `console.debug('using @tosiiko/cup@${version}');`,
    '',
    "appRoot.addEventListener('cup-login-submit', () => { void attemptLogin(); });",
    "appRoot.addEventListener('cup-login-fill-demo', () => {",
    '  render(loginView({ username: demoUser, error: null, notice: "Demo credentials filled. Password is cup123.", pending: false }));',
    '  window.requestAnimationFrame(() => {',
    '    const password = appRoot.querySelector<HTMLInputElement>(\'input[name="password"]\');',
    '    if (password) { password.value = demoPassword; password.focus(); password.select(); }',
    '  });',
    '});',
    "appRoot.addEventListener('cup-login-reset', () => {",
    '  render(loginView({ username: "", error: null, notice: "Use the demo account to explore the login flow.", pending: false }));',
    '});',
    '',
    'render(loginView({ username: "", error: null, notice: "Use the demo account to explore the login flow.", pending: false }));',
    '',
  ].join('\n');
}

function typeScriptLoginCss() {
  return [
    ':root {',
    '  color-scheme: light;',
    '  --bg: #f6efe5;',
    '  --bg-deep: #ecdcc8;',
    '  --surface: rgba(255, 250, 244, 0.82);',
    '  --surface-strong: #fff8f1;',
    '  --ink: #24170e;',
    '  --muted: #75614d;',
    '  --accent: #b45a2a;',
    '  --accent-strong: #8d4119;',
    '  --accent-soft: rgba(180, 90, 42, 0.12);',
    '  --success-bg: rgba(58, 122, 82, 0.1);',
    '  --success-ink: #275a3a;',
    '  --danger-bg: rgba(163, 46, 24, 0.11);',
    '  --danger-ink: #8c2f19;',
    '  --line: rgba(85, 52, 24, 0.1);',
    '  --shadow: 0 28px 80px rgba(76, 48, 22, 0.14);',
    '  --font-sans: "Avenir Next", "Plus Jakarta Sans", "Segoe UI", sans-serif;',
    '  --font-display: "Iowan Old Style", "Palatino Linotype", serif;',
    '}',
    '* { box-sizing: border-box; }',
    'html, body { margin: 0; min-height: 100%; }',
    'body {',
    '  font-family: var(--font-sans);',
    '  color: var(--ink);',
    '  background:',
    '    radial-gradient(circle at top left, rgba(255, 255, 255, 0.72), transparent 32%),',
    '    radial-gradient(circle at right center, rgba(196, 123, 77, 0.12), transparent 28%),',
    '    linear-gradient(160deg, var(--bg) 0%, #f8f3ec 42%, var(--bg-deep) 100%);',
    '}',
    '#app { min-height: 100vh; display: grid; place-items: center; padding: 24px; }',
    '.shell { width: min(100%, 1040px); display: grid; grid-template-columns: 1.05fr 0.95fr; background: var(--surface); border: 1px solid rgba(255,255,255,0.75); border-radius: 32px; overflow: hidden; box-shadow: var(--shadow); backdrop-filter: blur(22px); }',
    '.hero { padding: 48px; background: linear-gradient(180deg, rgba(255,247,238,0.84), rgba(243,227,206,0.92)), linear-gradient(135deg, #fff8ef, #efdfca); display: grid; gap: 28px; align-content: space-between; }',
    '.eyebrow { display: inline-flex; width: fit-content; align-items: center; gap: 10px; padding: 10px 14px; border-radius: 999px; background: rgba(255,255,255,0.64); border: 1px solid rgba(105,69,37,0.08); color: var(--muted); font-size: 12px; font-weight: 700; letter-spacing: 0.14em; text-transform: uppercase; }',
    '.dot { width: 10px; height: 10px; border-radius: 999px; background: var(--accent); box-shadow: 0 0 0 6px rgba(180, 90, 42, 0.12); }',
    '.hero-copy { display: grid; gap: 16px; }',
    '.hero h1 { margin: 0; font-family: var(--font-display); font-size: clamp(2.8rem, 4vw, 4.5rem); line-height: 0.95; letter-spacing: -0.06em; }',
    '.hero p { margin: 0; max-width: 28rem; color: var(--muted); line-height: 1.7; font-size: 1.02rem; }',
    '.stats { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 12px; }',
    '.stat { padding: 16px; border-radius: 20px; background: rgba(255,255,255,0.7); border: 1px solid rgba(99,62,31,0.08); }',
    '.stat strong { display: block; margin-bottom: 8px; font-size: 1.3rem; letter-spacing: -0.04em; }',
    '.stat span { color: var(--muted); font-size: 0.92rem; }',
    '.panel { padding: 42px; background: linear-gradient(180deg, rgba(255,251,246,0.96), rgba(255,248,241,0.86)); display: grid; align-content: center; }',
    '.card { display: grid; gap: 24px; }',
    '.badge { display: inline-flex; width: fit-content; align-items: center; gap: 8px; padding: 8px 12px; border-radius: 999px; background: var(--accent-soft); color: var(--accent-strong); font-size: 12px; font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase; }',
    '.card h2 { margin: 0; font-size: 2rem; letter-spacing: -0.06em; }',
    '.copy, .caption, .list { color: var(--muted); line-height: 1.6; }',
    '.alert { padding: 14px 16px; border-radius: 18px; font-size: 0.95rem; line-height: 1.5; border: 1px solid transparent; }',
    '.alert.error { background: var(--danger-bg); color: var(--danger-ink); border-color: rgba(140,47,25,0.12); }',
    '.alert.notice { background: rgba(46,88,140,0.08); color: #335a8d; border-color: rgba(51,90,141,0.12); }',
    '.alert.success { background: var(--success-bg); color: var(--success-ink); border-color: rgba(39,90,58,0.12); }',
    '.form { display: grid; gap: 16px; }',
    '.field { display: grid; gap: 8px; }',
    '.label { font-size: 13px; font-weight: 700; color: #5f4835; }',
    '.input { width: 100%; padding: 15px 16px; border-radius: 18px; border: 1px solid var(--line); background: var(--surface-strong); color: var(--ink); font: inherit; outline: none; }',
    '.actions { display: grid; gap: 12px; margin-top: 6px; }',
    '.button, .button-secondary { appearance: none; border: none; border-radius: 18px; padding: 14px 18px; font: inherit; font-weight: 700; cursor: pointer; }',
    '.button { background: linear-gradient(135deg, var(--accent), #cb7443); color: white; box-shadow: 0 16px 32px rgba(180, 90, 42, 0.22); }',
    '.button-secondary { background: transparent; color: var(--ink); border: 1px solid var(--line); }',
    '.button:disabled { cursor: wait; opacity: 0.78; }',
    '.success-mark { width: 72px; height: 72px; display: grid; place-items: center; border-radius: 24px; background: linear-gradient(180deg, rgba(61,146,96,0.18), rgba(61,146,96,0.08)); color: #2a6f43; font-size: 2rem; }',
    '.list { display: grid; gap: 10px; }',
    '.list-item { display: flex; gap: 10px; align-items: flex-start; }',
    '@media (max-width: 920px) { .shell { grid-template-columns: 1fr; } .hero, .panel { padding: 32px 24px; } .stats { grid-template-columns: 1fr; } }',
    '',
  ].join('\n');
}

function npmSafeName(name) {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'cup-app';
}

function goSafeModuleName(name) {
  return npmSafeName(name).replace(/-/g, '');
}

function humanize(name) {
  return name
    .replace(/[-_]+/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function escapeHtml(value) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

function escapePython(value) {
  return value.replaceAll('\\', '\\\\').replaceAll('"', '\\"');
}
