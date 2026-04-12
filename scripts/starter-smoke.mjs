import { spawn } from 'node:child_process';
import { setTimeout as delay } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

import {
  STARTER_VIEW_POLICY,
  validateProtocolView,
  validateViewPolicy,
} from '../dist/index.js';

const scriptDir = dirname(fileURLToPath(import.meta.url));
const rootDir = resolve(scriptDir, '..');

function readCookie(headers) {
  const fromGetter = typeof headers.getSetCookie === 'function'
    ? headers.getSetCookie()[0]
    : headers.get('set-cookie');
  return fromGetter ? fromGetter.split(';', 1)[0] : '';
}

function createServerHandle(command, args, cwd = rootDir) {
  const child = spawn(command, args, {
    cwd,
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  let stdout = '';
  let stderr = '';
  child.stdout.on('data', (chunk) => {
    stdout += chunk.toString();
  });
  child.stderr.on('data', (chunk) => {
    stderr += chunk.toString();
  });

  return {
    child,
    async stop() {
      child.kill('SIGTERM');
      await Promise.race([
        new Promise((resolve) => child.once('exit', resolve)),
        delay(1000),
      ]);
      if (child.exitCode && child.exitCode !== 0) {
        throw new Error(`starter server exited with code ${child.exitCode}\nstdout:\n${stdout}\nstderr:\n${stderr}`);
      }
    },
  };
}

async function waitForServer(baseUrl, probePath = '/api/views?route=%2F') {
  let lastError;
  for (let attempt = 0; attempt < 50; attempt += 1) {
    try {
      const response = await fetch(`${baseUrl}${probePath}`);
      if (response.ok || response.status === 401) {
        return;
      }
      lastError = new Error(`unexpected starter status: ${response.status}`);
    } catch (error) {
      lastError = error;
    }
    await delay(100);
  }
  throw lastError ?? new Error('starter server did not start');
}

async function fetchStarterView(baseUrl, route, cookie = '') {
  const response = await fetch(`${baseUrl}/api/views?route=${encodeURIComponent(route)}`, {
    headers: cookie ? { Cookie: cookie } : {},
  });
  const payload = await response.json();
  const view = validateProtocolView(payload);
  validateViewPolicy(view, STARTER_VIEW_POLICY);
  return { response, view };
}

async function smokeMinimal() {
  const handle = createServerHandle('python3', [resolve(rootDir, 'starters', 'python-minimal', 'server.py')]);
  const baseUrl = 'http://127.0.0.1:8050';

  try {
    await waitForServer(baseUrl, '/api/views?route=%2F');

    const pageResponse = await fetch(baseUrl);
    if (!pageResponse.ok) {
      throw new Error(`minimal starter page request failed: ${pageResponse.status}`);
    }

    const { response, view } = await fetchStarterView(baseUrl, '/');
    const cookie = readCookie(response.headers);
    const csrfToken = String(view.state.csrf_token ?? '');
    if (!csrfToken) {
      throw new Error('minimal starter view did not expose a csrf token');
    }

    const updateResponse = await fetch(`${baseUrl}/api/preferences`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: cookie,
        'X-CSRF-Token': csrfToken,
      },
      body: JSON.stringify({
        csrf_token: csrfToken,
        display_name: 'Taylor',
      }),
    });

    if (!updateResponse.ok) {
      throw new Error(`minimal starter mutation request failed: ${updateResponse.status}`);
    }

    const updated = validateViewPolicy(validateProtocolView(await updateResponse.json()), STARTER_VIEW_POLICY);
    if (updated.state.display_name !== 'Taylor') {
      throw new Error('minimal starter mutation did not update the display name');
    }
  } finally {
    await handle.stop();
  }
}

async function smokePortal() {
  const handle = createServerHandle('python3', [resolve(rootDir, 'starters', 'python-portal', 'server.py')]);
  const baseUrl = 'http://127.0.0.1:8065';

  try {
    await waitForServer(baseUrl, '/api/views?route=%2Fportal%2Frequest');

    const { response, view } = await fetchStarterView(baseUrl, '/portal/request');
    const cookie = readCookie(response.headers);
    const csrfToken = String(view.state.csrf_token ?? '');
    if (!csrfToken) {
      throw new Error('portal starter view did not expose a csrf token');
    }

    const submitResponse = await fetch(`${baseUrl}/api/requests`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: cookie,
        'X-CSRF-Token': csrfToken,
      },
      body: JSON.stringify({
        csrf_token: csrfToken,
        request_title: 'Partner onboarding approval',
        request_type: 'Approval',
        justification: 'Need a real workflow item to prove the portal queue remounts cleanly.',
      }),
    });

    if (!submitResponse.ok) {
      throw new Error(`portal starter submit request failed: ${submitResponse.status}`);
    }
    const queued = validateViewPolicy(validateProtocolView(await submitResponse.json()), STARTER_VIEW_POLICY);
    const pending = Array.isArray(queued.state.pending_requests) ? queued.state.pending_requests : [];
    if (queued.meta?.route !== '/portal/review' || pending.length === 0) {
      throw new Error('portal starter did not return the review queue after request submission');
    }

    const firstPending = pending[0];
    const reviewResponse = await fetch(`${baseUrl}/api/reviews`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: cookie,
        'X-CSRF-Token': csrfToken,
      },
      body: JSON.stringify({
        csrf_token: csrfToken,
        request_id: String(firstPending.id),
        decision: 'approve',
      }),
    });

    if (!reviewResponse.ok) {
      throw new Error(`portal starter review request failed: ${reviewResponse.status}`);
    }
    const reviewed = validateViewPolicy(validateProtocolView(await reviewResponse.json()), STARTER_VIEW_POLICY);
    const history = Array.isArray(reviewed.state.history_items) ? reviewed.state.history_items : [];
    if (reviewed.meta?.route !== '/portal/history' || !history.some((item) => item.id === firstPending.id)) {
      throw new Error('portal starter did not return the completed request in workflow history');
    }
  } finally {
    await handle.stop();
  }
}

async function smokeNodeDashboard() {
  const handle = createServerHandle('node', [resolve(rootDir, 'starters', 'node-dashboard', 'server.mjs')]);
  const baseUrl = 'http://127.0.0.1:8075';

  try {
    await waitForServer(baseUrl, '/api/views?route=%2Flogin');

    const { response, view } = await fetchStarterView(baseUrl, '/login');
    const cookie = readCookie(response.headers);
    const csrfToken = String(view.state.csrf_token ?? '');
    if (!csrfToken) {
      throw new Error('node dashboard starter login view did not expose a csrf token');
    }

    const loginResponse = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: cookie,
        'X-CSRF-Token': csrfToken,
      },
      body: JSON.stringify({
        csrf_token: csrfToken,
        username: 'analyst@cup.local',
        password: 'demo-pass',
      }),
    });

    if (!loginResponse.ok) {
      throw new Error(`node dashboard starter login failed: ${loginResponse.status}`);
    }
    const dashboard = validateViewPolicy(validateProtocolView(await loginResponse.json()), STARTER_VIEW_POLICY);
    if (dashboard.meta?.route !== '/dashboard/overview') {
      throw new Error('node dashboard starter did not land on the overview route after login');
    }

    const alertsView = await fetchStarterView(baseUrl, '/dashboard/alerts', cookie);
    const alerts = Array.isArray(alertsView.view.state.alerts) ? alertsView.view.state.alerts : [];
    const nextCsrfToken = String(alertsView.view.state.csrf_token ?? '');
    if (alerts.length === 0 || !nextCsrfToken) {
      throw new Error('node dashboard starter alerts route did not expose alerts or a csrf token');
    }

    const dismissResponse = await fetch(`${baseUrl}/api/alerts/dismiss`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: cookie,
        'X-CSRF-Token': nextCsrfToken,
      },
      body: JSON.stringify({
        csrf_token: nextCsrfToken,
        alert_id: String(alerts[0].id),
      }),
    });

    if (!dismissResponse.ok) {
      throw new Error(`node dashboard starter dismiss request failed: ${dismissResponse.status}`);
    }
    const updated = validateViewPolicy(validateProtocolView(await dismissResponse.json()), STARTER_VIEW_POLICY);
    const nextAlerts = Array.isArray(updated.state.alerts) ? updated.state.alerts : [];
    if (nextAlerts.length !== alerts.length - 1) {
      throw new Error('node dashboard starter did not remove the dismissed alert');
    }
  } finally {
    await handle.stop();
  }
}

await smokeMinimal();
await smokePortal();
await smokeNodeDashboard();
