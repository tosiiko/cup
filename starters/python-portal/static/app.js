import {
  STARTER_VIEW_POLICY,
  mountRemoteView,
  validateProtocolView,
  validateViewPolicy,
} from '/dist/index.js';

const app = document.getElementById('app');

const FORM_ENDPOINTS = {
  'submit-request': '/api/requests',
  'decide-request': '/api/reviews',
};

function syncRoute(view, method = 'GET') {
  const nextRoute = view.meta?.route;
  if (!nextRoute || nextRoute === location.pathname) return;

  if (method === 'GET' || method === 'HEAD') {
    history.replaceState(null, '', nextRoute);
  } else {
    history.pushState(null, '', nextRoute);
  }
}

function mountView(view, method = 'GET') {
  mountRemoteView(view, app);
  if (view.meta?.title) {
    document.title = view.meta.title;
  }
  syncRoute(view, method);
}

async function requestProtocolView(url, init = {}) {
  const response = await fetch(url, {
    credentials: 'same-origin',
    headers: {
      Accept: 'application/json',
      ...(init.body ? { 'Content-Type': 'application/json' } : {}),
      ...(init.headers ?? {}),
    },
    ...init,
  });

  const contentType = response.headers.get('content-type') ?? '';
  if (!contentType.includes('application/json')) {
    throw new Error(`Unexpected response: ${response.status} ${response.statusText}`);
  }

  const payload = await response.json();
  const view = validateProtocolView(payload);
  validateViewPolicy(view, STARTER_VIEW_POLICY);
  mountView(view, init.method ?? 'GET');
  return view;
}

async function loadCurrentRoute() {
  const route = location.pathname || '/';
  return requestProtocolView(`/api/views?route=${encodeURIComponent(route)}`);
}

function formPayload(form) {
  const values = Object.fromEntries(new FormData(form).entries());
  return Object.fromEntries(
    Object.entries(values).map(([key, value]) => [key, typeof value === 'string' ? value.trim() : value]),
  );
}

async function submitForm(form) {
  const formKind = form.dataset.formKind;
  const endpoint = formKind ? FORM_ENDPOINTS[formKind] : undefined;
  if (!endpoint) {
    throw new Error(`Unsupported form kind: ${String(formKind)}`);
  }

  const payload = formPayload(form);
  const csrfToken = String(payload.csrf_token ?? '');
  const submitter = form.querySelector('[type="submit"]');

  if (submitter instanceof HTMLButtonElement) {
    submitter.disabled = true;
    submitter.dataset.originalLabel = submitter.textContent ?? '';
    submitter.textContent = form.dataset.pendingLabel ?? 'Working...';
  }

  try {
    await requestProtocolView(endpoint, {
      method: 'POST',
      headers: { 'X-CSRF-Token': csrfToken },
      body: JSON.stringify(payload),
    });
  } finally {
    if (submitter instanceof HTMLButtonElement) {
      submitter.disabled = false;
      if (submitter.dataset.originalLabel) {
        submitter.textContent = submitter.dataset.originalLabel;
      }
    }
  }
}

function fatalError(error) {
  console.error('[CUP Portal Starter]', error);
  const panel = document.createElement('div');
  panel.className = 'starter-fatal';

  const title = document.createElement('h1');
  title.textContent = 'Starter request failed';

  const body = document.createElement('p');
  body.textContent = error instanceof Error ? error.message : String(error);

  panel.append(title, body);
  app.replaceChildren(panel);
}

document.addEventListener('click', (event) => {
  if (event.defaultPrevented) return;

  const anchor = event.target instanceof Element ? event.target.closest('a[data-link]') : null;
  if (!(anchor instanceof HTMLAnchorElement)) return;
  if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) return;

  const href = anchor.getAttribute('href');
  if (!href || href.startsWith('http://') || href.startsWith('https://') || href.startsWith('mailto:')) return;

  event.preventDefault();
  history.pushState(null, '', href);
  void loadCurrentRoute().catch(fatalError);
});

document.addEventListener('submit', (event) => {
  const form = event.target;
  if (!(form instanceof HTMLFormElement) || !form.matches('[data-form-kind]')) return;

  event.preventDefault();
  void submitForm(form).catch(fatalError);
});

window.addEventListener('popstate', () => {
  void loadCurrentRoute().catch(fatalError);
});

void loadCurrentRoute().catch(fatalError);
