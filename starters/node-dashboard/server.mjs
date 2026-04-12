import { createHmac, randomBytes, randomUUID, timingSafeEqual } from 'node:crypto';
import { createServer } from 'node:http';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

import { STARTER_VIEW_POLICY, validateViewPolicy } from '../../dist/index.js';

const starterDir = dirname(fileURLToPath(import.meta.url));
const rootDir = resolve(starterDir, '../..');
const distDir = resolve(rootDir, 'dist');
const host = '127.0.0.1';
const port = 8075;
const appName = 'CUP Node Dashboard Starter';
const sessionCookie = 'cup_node_dashboard_session';
const sessionIdleMs = 2 * 60 * 60 * 1000;
const sessionAbsoluteMs = 8 * 60 * 60 * 1000;
const sessionSecret = Buffer.from(process.env.CUP_STARTER_SECRET || randomBytes(32).toString('hex'), 'utf8');
const secureCookies = process.env.CUP_STARTER_SECURE_COOKIES === '1';
const indexFile = resolve(starterDir, 'index.html');
const templateDir = resolve(starterDir, 'templates');
const staticDir = resolve(starterDir, 'static');
const sessions = new Map();

if (!existsSync(distDir)) {
  throw new Error('dist/ not found. Run `npm run build` in the CUP repo before starting the Node dashboard starter.');
}

const demoUsers = {
  'analyst@cup.local': {
    password: 'demo-pass',
    displayName: 'Amina Nsubuga',
    role: 'Operations Lead',
  },
};

function now() {
  return Date.now();
}

function newCsrfToken() {
  return randomBytes(18).toString('base64url');
}

function sessionSignature(sessionId) {
  return createHmac('sha256', sessionSecret).update(sessionId).digest('hex');
}

function makeCookieValue(sessionId) {
  return `${sessionId}.${sessionSignature(sessionId)}`;
}

function verifyCookieValue(raw) {
  if (!raw || !raw.includes('.')) return null;
  const [sessionId, signature] = raw.split('.', 2);
  const expected = sessionSignature(sessionId);
  const received = Buffer.from(signature, 'utf8');
  const required = Buffer.from(expected, 'utf8');
  if (received.length !== required.length || !timingSafeEqual(received, required)) {
    return null;
  }
  return sessionId;
}

function securityHeaders(isJson = false) {
  return {
    'Content-Security-Policy': "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; font-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'; form-action 'self'",
    'Referrer-Policy': 'same-origin',
    'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
    'X-Frame-Options': 'DENY',
    'X-Content-Type-Options': 'nosniff',
    'Cache-Control': 'no-store, no-cache, must-revalidate, private',
    Pragma: 'no-cache',
    'Cross-Origin-Opener-Policy': 'same-origin',
    'Cross-Origin-Resource-Policy': isJson ? 'same-origin' : 'same-origin',
  };
}

function parseCookies(header = '') {
  const jar = {};
  for (const pair of header.split(';')) {
    const [rawKey, ...rest] = pair.trim().split('=');
    if (!rawKey) continue;
    jar[rawKey] = rest.join('=');
  }
  return jar;
}

function parseJsonBody(req) {
  return new Promise((resolveBody) => {
    let body = '';
    req.on('data', (chunk) => {
      body += chunk.toString('utf8');
    });
    req.on('end', () => {
      try {
        const parsed = body ? JSON.parse(body) : {};
        resolveBody(parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {});
      } catch {
        resolveBody({});
      }
    });
  });
}

function loadTemplate(name) {
  return readFileSync(resolve(templateDir, name), 'utf8');
}

function renderShell(pageName) {
  return loadTemplate('shell.html').replace('<!-- PAGE_CONTENT -->', loadTemplate(`pages/${pageName}.html`));
}

function createSession(remoteAddress, userAgent) {
  const sessionId = randomBytes(18).toString('base64url');
  const timestamp = now();
  const session = {
    authenticated: false,
    displayName: 'Guest operator',
    role: 'Pending sign-in',
    csrfToken: newCsrfToken(),
    createdAt: timestamp,
    lastSeen: timestamp,
    remoteAddress,
    userAgent: userAgent.slice(0, 120),
    alerts: defaultAlerts(),
  };
  sessions.set(sessionId, session);
  return [sessionId, session];
}

function sessionExpired(session) {
  return now() - session.createdAt > sessionAbsoluteMs || now() - session.lastSeen > sessionIdleMs;
}

function currentSession(req) {
  const cookies = parseCookies(req.headers.cookie || '');
  const userAgent = req.headers['user-agent'] || '';
  const remoteAddress = req.socket.remoteAddress || '127.0.0.1';
  const rawCookie = cookies[sessionCookie];
  if (rawCookie) {
    const sessionId = verifyCookieValue(rawCookie);
    const session = sessionId ? sessions.get(sessionId) : null;
    if (session && !sessionExpired(session)) {
      session.lastSeen = now();
      session.remoteAddress = remoteAddress;
      session.userAgent = userAgent.slice(0, 120);
      return {
        sessionId,
        session,
        setCookie: null,
      };
    }
    if (sessionId) {
      sessions.delete(sessionId);
    }
  }

  const [sessionId, session] = createSession(remoteAddress, userAgent);
  return {
    sessionId,
    session,
    setCookie: buildSetCookie(sessionId),
  };
}

function buildSetCookie(sessionId) {
  const parts = [
    `${sessionCookie}=${makeCookieValue(sessionId)}`,
    'Path=/',
    `Max-Age=${Math.floor(sessionAbsoluteMs / 1000)}`,
    'HttpOnly',
    'SameSite=Lax',
  ];
  if (secureCookies) {
    parts.push('Secure');
  }
  return parts.join('; ');
}

function send(res, status, contentType, body, extraHeaders = {}) {
  res.writeHead(status, {
    ...securityHeaders(contentType.includes('application/json')),
    'Content-Type': contentType,
    'Content-Length': Buffer.byteLength(body),
    ...extraHeaders,
  });
  res.end(body);
}

function sendJsonView(res, sessionState, status, view) {
  const valid = validateViewPolicy(view, STARTER_VIEW_POLICY);
  const body = JSON.stringify(valid);
  send(res, status, 'application/json; charset=utf-8', body, sessionState.setCookie ? { 'Set-Cookie': sessionState.setCookie } : {});
}

function sendFile(res, sessionState, status, contentType, filePath) {
  const body = readFileSync(filePath);
  send(res, status, contentType, body, sessionState.setCookie ? { 'Set-Cookie': sessionState.setCookie } : {});
}

function requireCsrf(session, payload, req) {
  const header = String(req.headers['x-csrf-token'] || '');
  const token = String(payload.csrf_token || '');
  return Boolean(
    header
      && token
      && header.length === session.csrfToken.length
      && token.length === session.csrfToken.length
      && timingSafeEqual(Buffer.from(header), Buffer.from(session.csrfToken))
      && timingSafeEqual(Buffer.from(token), Buffer.from(session.csrfToken))
  );
}

function navItems(route) {
  return [
    { href: '/dashboard/overview', label: 'Overview', active: route === '/dashboard/overview' },
    { href: '/dashboard/alerts', label: 'Alerts', active: route === '/dashboard/alerts' },
  ];
}

function defaultAlerts() {
  return [
    {
      id: 'alert-liquidity',
      title: 'Liquidity review due',
      detail: 'Treasury sweep confirmation is due before 15:30 EAT.',
      severity: 'High',
    },
    {
      id: 'alert-onboarding',
      title: 'Vendor onboarding pending',
      detail: 'Three partner records still need a document review decision.',
      severity: 'Medium',
    },
  ];
}

function dashboardMetrics(session) {
  return [
    { label: 'Visible alerts', value: String(session.alerts.length) },
    { label: 'Signed-in role', value: session.role },
    { label: 'Protected routes', value: '2' },
  ];
}

function loginView(session, error = null) {
  return {
    template: renderShell('login'),
    state: {
      app_name: appName,
      title: 'Operator sign in',
      heading: 'Authenticate before loading dashboard routes',
      subheading: 'This Node starter keeps the same CUP boundaries: signed cookie sessions, CSRF validation, and policy-checked protocol responses.',
      display_name: session.displayName,
      role: session.role,
      csrf_token: session.csrfToken,
      nav: [],
      notice: null,
      error,
      demo_username: 'analyst@cup.local',
      demo_password: 'demo-pass',
    },
    meta: {
      version: '1',
      title: 'Operator sign in',
      route: '/login',
    },
  };
}

function shellView(session, route, title, heading, subheading, pageName, pageState, notice = null, error = null) {
  return {
    template: renderShell(pageName),
    state: {
      app_name: appName,
      title,
      heading,
      subheading,
      display_name: session.displayName,
      role: session.role,
      csrf_token: session.csrfToken,
      nav: navItems(route),
      notice,
      error,
      ...pageState,
    },
    meta: {
      version: '1',
      title,
      route,
    },
  };
}

function overviewView(session, notice = null, error = null) {
  return shellView(
    session,
    '/dashboard/overview',
    'Dashboard overview',
    'Backend-owned overview for authenticated operators',
    'The browser only requests protocol views and posts action payloads back to the server. Metrics and auth state stay backend-authoritative.',
    'overview',
    {
      metrics: dashboardMetrics(session),
    },
    notice,
    error,
  );
}

function alertsView(session, notice = null, error = null) {
  return shellView(
    session,
    '/dashboard/alerts',
    'Alert queue',
    'Review and dismiss active dashboard alerts',
    'Each dismissal POSTs the alert id plus the CSRF token. The server mutates the session-backed queue and returns the next view.',
    'alerts',
    {
      alerts: session.alerts,
    },
    notice,
    error,
  );
}

function resolveView(session, route, notice = null, error = null) {
  const normalized = route.startsWith('/') ? route : `/${route}`;
  if (!session.authenticated) {
    return [normalized === '/login' ? 200 : 401, loginView(session, error)];
  }
  if (normalized === '/' || normalized === '/dashboard/overview') {
    return [200, overviewView(session, notice, error)];
  }
  if (normalized === '/dashboard/alerts') {
    return [200, alertsView(session, notice, error)];
  }
  return [404, alertsView(session, notice, `Unknown route requested: ${normalized}`)];
}

const server = createServer(async (req, res) => {
  const sessionState = currentSession(req);
  const { session } = sessionState;
  const url = new URL(req.url || '/', `http://${host}:${port}`);

  if (req.method === 'GET' && url.pathname === '/') {
    sendFile(res, sessionState, 200, 'text/html; charset=utf-8', indexFile);
    return;
  }

  if (req.method === 'GET' && url.pathname === '/app.js') {
    sendFile(res, sessionState, 200, 'text/javascript; charset=utf-8', resolve(staticDir, 'app.js'));
    return;
  }

  if (req.method === 'GET' && url.pathname === '/app.css') {
    sendFile(res, sessionState, 200, 'text/css; charset=utf-8', resolve(staticDir, 'app.css'));
    return;
  }

  if (req.method === 'GET' && url.pathname.startsWith('/dist/')) {
    const filePath = resolve(distDir, url.pathname.replace('/dist/', ''));
    if (!filePath.startsWith(distDir) || !existsSync(filePath)) {
      send(res, 404, 'text/plain; charset=utf-8', 'Not found');
      return;
    }
    const contentType = filePath.endsWith('.js')
      ? 'text/javascript; charset=utf-8'
      : filePath.endsWith('.css')
        ? 'text/css; charset=utf-8'
        : 'application/json; charset=utf-8';
    sendFile(res, sessionState, 200, contentType, filePath);
    return;
  }

  if (req.method === 'GET' && url.pathname === '/api/views') {
    const route = url.searchParams.get('route') || '/dashboard/overview';
    const [status, view] = resolveView(session, route);
    sendJsonView(res, sessionState, status, view);
    return;
  }

  if (req.method === 'POST' && url.pathname === '/api/auth/login') {
    const payload = await parseJsonBody(req);
    if (!requireCsrf(session, payload, req)) {
      sendJsonView(res, sessionState, 403, loginView(session, 'Security token validation failed. Refresh and try again.'));
      return;
    }
    const username = String(payload.username || '').trim().toLowerCase();
    const password = String(payload.password || '');
    const user = demoUsers[username];
    if (!user || password !== user.password) {
      sendJsonView(res, sessionState, 401, loginView(session, 'Use the demo credentials shown in the form to unlock the dashboard.'));
      return;
    }
    session.authenticated = true;
    session.displayName = user.displayName;
    session.role = user.role;
    session.csrfToken = newCsrfToken();
    const [status, view] = resolveView(session, '/dashboard/overview', 'Signed in. The protected dashboard route was resolved on the server.');
    sendJsonView(res, sessionState, status, view);
    return;
  }

  if (req.method === 'POST' && url.pathname === '/api/alerts/dismiss') {
    const payload = await parseJsonBody(req);
    if (!requireCsrf(session, payload, req)) {
      const [status, view] = resolveView(session, '/dashboard/alerts', null, 'Security token validation failed. Refresh and try again.');
      sendJsonView(res, sessionState, Math.max(status, 403), view);
      return;
    }
    if (!session.authenticated) {
      sendJsonView(res, sessionState, 401, loginView(session, 'Sign in before dismissing alerts.'));
      return;
    }
    const alertId = String(payload.alert_id || '');
    session.alerts = session.alerts.filter((alert) => alert.id !== alertId);
    const [status, view] = resolveView(session, '/dashboard/alerts', 'Alert dismissed. The server returned the next protected view.');
    sendJsonView(res, sessionState, status, view);
    return;
  }

  send(res, 404, 'text/plain; charset=utf-8', 'Not found', sessionState.setCookie ? { 'Set-Cookie': sessionState.setCookie } : {});
});

server.listen(port, host, () => {
  console.log(`CUP Node dashboard starter -> http://${host}:${port}`);
});
