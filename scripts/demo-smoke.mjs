import { spawn } from 'node:child_process';
import { setTimeout as delay } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

import { validateProtocolView } from '../dist/index.js';

const scriptDir = dirname(fileURLToPath(import.meta.url));
const rootDir = resolve(scriptDir, '..');
const serverPath = resolve(rootDir, 'demo', 'login', 'server.py');
const baseUrl = 'http://127.0.0.1:8010';

const server = spawn('python3', [serverPath], {
  cwd: rootDir,
  stdio: ['ignore', 'pipe', 'pipe'],
});

let stdout = '';
let stderr = '';
server.stdout.on('data', (chunk) => {
  stdout += chunk.toString();
});
server.stderr.on('data', (chunk) => {
  stderr += chunk.toString();
});

async function waitForServer() {
  let lastError;
  for (let attempt = 0; attempt < 40; attempt += 1) {
    try {
      const response = await fetch(`${baseUrl}/api/view`);
      if (response.ok) {
        return;
      }
      lastError = new Error(`unexpected demo status: ${response.status}`);
    } catch (error) {
      lastError = error;
    }
    await delay(100);
  }
  throw lastError ?? new Error('demo server did not start');
}

try {
  await waitForServer();

  const pageResponse = await fetch(baseUrl);
  if (!pageResponse.ok) {
    throw new Error(`demo page request failed: ${pageResponse.status}`);
  }
  const page = await pageResponse.text();
  if (!page.includes('id="app"')) {
    throw new Error('demo HTML shell did not contain the application root');
  }

  const viewResponse = await fetch(`${baseUrl}/api/view`);
  if (!viewResponse.ok) {
    throw new Error(`demo view request failed: ${viewResponse.status}`);
  }
  const payload = await viewResponse.json();
  validateProtocolView(payload);
} finally {
  server.kill('SIGTERM');
  await Promise.race([
    new Promise((resolve) => server.once('exit', resolve)),
    delay(1000),
  ]);

  if (server.exitCode && server.exitCode !== 0) {
    throw new Error(`demo server exited with code ${server.exitCode}\nstdout:\n${stdout}\nstderr:\n${stderr}`);
  }
}
