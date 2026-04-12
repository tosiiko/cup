/**
 * CUP Router — Phase 6
 *
 * Minimal SPA routing via the History API. No dependencies.
 *
 * Features:
 *  - Static paths:        '/about'
 *  - Named params:        '/user/:id/post/:slug'
 *  - Wildcard 404:        '*'
 *  - Query string access: URLSearchParams passed to view factories
 *  - CSS view transitions: 'fade' | 'slide' | 'none' (per-route or global default)
 *  - <a data-link> interception — zero page reloads
 *  - router.current signal — reactive current pathname
 *  - Scroll restoration
 *
 * Usage:
 *
 *   const router = createRouter({
 *     routes: [
 *       { path: '/',          view: homeView },
 *       { path: '/user/:id',  view: ({ id }) => userView(id) },
 *       { path: '*',          view: notFoundView },
 *     ],
 *     transition: 'slide',   // default for all routes
 *   });
 *
 *   router.start(document.getElementById('outlet'));
 */

import { mount } from './mount.js';
import { waitForVisualCompletion } from './css.js';
import { createSignal } from './signal.js';
import type { ClientView, Signal } from './types.js';

// ── Types ─────────────────────────────────────────────────────────────────────

export type Params = Record<string, string>;
export type RouteViewFactory = (params: Params, query: URLSearchParams) => ClientView | Promise<ClientView>;
export type RouteView = ClientView | RouteViewFactory;

export type Transition = 'fade' | 'slide' | 'none';
export type TransitionSource = Transition | (() => Transition);

export interface RouteDefinition {
  path: string;
  view: RouteView;
  /** Override the global transition for this route */
  transition?: TransitionSource;
  /** Optional title for document.title */
  title?: string;
}

export interface RouterOptions {
  routes: RouteDefinition[];
  /** Default CSS transition between routes. Default: 'fade' */
  transition?: TransitionSource;
  /** Prefix prepended to all paths (for sub-directory deployments) */
  base?: string;
  /** Lifecycle hook called before each navigation render */
  onNavigateStart?: (context: NavigationContext) => void;
  /** Lifecycle hook called after each successful navigation render */
  onNavigateEnd?: (context: NavigationContext) => void;
  /** Lifecycle hook called when a navigation render fails */
  onNavigateError?: (error: Error, context: NavigationContext) => void;
}

export interface NavigationContext {
  pathname: string;
  params: Params;
  query: URLSearchParams;
  source: 'start' | 'navigate' | 'popstate';
}

export interface Router {
  /** Mount the router into an outlet element and handle the initial URL */
  start(outlet: Element): Promise<void>;
  /** Navigate to a path, push a history entry */
  navigate(path: string, options?: { replace?: boolean; state?: unknown }): Promise<void>;
  /** Go back in browser history */
  back(): void;
  /** Go forward in browser history */
  forward(): void;
  /** Remove global listeners and release the outlet */
  destroy(): void;
  /** Reactive current pathname */
  current: Signal<string>;
  /** Reactive current route params */
  params: Signal<Params>;
  /** Reactive current query string */
  query: Signal<URLSearchParams>;
  /** True during a route transition */
  transitioning: Signal<boolean>;
}

// ── Route matching ────────────────────────────────────────────────────────────

interface CompiledRoute {
  regex: RegExp;
  paramNames: string[];
  definition: RouteDefinition;
}

function compileRoute(def: RouteDefinition): CompiledRoute {
  const paramNames: string[] = [];

  if (def.path === '*') {
    return { regex: /.*/, paramNames: [], definition: def };
  }

  const pattern = def.path
    .replace(/\//g, '\\/')           // escape slashes
    .replace(/:(\w+)/g, (_, name) => {
      paramNames.push(name);
      return '([^\\/]+)';            // named segment capture
    });

  return {
    regex: new RegExp(`^${pattern}$`),
    paramNames,
    definition: def,
  };
}

function matchRoute(
  compiled: CompiledRoute[],
  pathname: string,
): { route: CompiledRoute; params: Params } | null {
  for (const route of compiled) {
    const m = pathname.match(route.regex);
    if (m) {
      const params: Params = {};
      route.paramNames.forEach((name, i) => {
        params[name] = decodeURIComponent(m[i + 1] ?? '');
      });
      return { route, params };
    }
  }
  return null;
}

// ── CSS transition helpers ────────────────────────────────────────────────────
// JavaScript sets a class on the outlet — CSS does all the animation.

const TRANSITION_CSS: Record<Transition, { exit: string; enter: string }> = {
  fade:  { exit: 'route-exit-fade',  enter: 'route-enter-fade' },
  slide: { exit: 'route-exit-slide', enter: 'route-enter-slide' },
  none:  { exit: '',                 enter: '' },
};

async function runTransition(
  outlet: Element,
  style: Transition,
  renderNext: () => void,
): Promise<void> {
  const { exit, enter } = TRANSITION_CSS[style];

  if (style === 'none') {
    renderNext();
    return;
  }

  // Exit: add class, wait for CSS transition/animation to finish
  if (exit) {
    outlet.classList.add(exit);
    await waitForVisualCompletion(outlet, { timeout: 400 });
    outlet.classList.remove(exit);
  }

  renderNext();

  // Enter: add class, wait, remove
  if (enter) {
    outlet.classList.add(enter);
    // Force a reflow so the browser registers the class before transitioning
    void (outlet as HTMLElement).offsetHeight;
    // Remove after next frame so CSS can pick up the transition
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        outlet.classList.remove(enter);
      });
    });
    await waitForVisualCompletion(outlet, { timeout: 400 });
  }
}

// ── createRouter ──────────────────────────────────────────────────────────────

export function createRouter(options: RouterOptions): Router {
  const {
    routes,
    transition: defaultTransition = 'fade',
    base = '',
    onNavigateStart,
    onNavigateEnd,
    onNavigateError,
  } = options;

  const compiled = routes.map((r) => compileRoute(r));
  const normalizedBase = normalizeBase(base);

  // Signals
  const current = createSignal<string>(stripBase(location.pathname, normalizedBase));
  const params       = createSignal<Params>({});
  const query        = createSignal<URLSearchParams>(new URLSearchParams(location.search));
  const transitioning = createSignal<boolean>(false);

  let outlet: Element | null = null;
  let activeTransition: Promise<void> = Promise.resolve();
  let started = false;

  const onDocumentClick = (e: MouseEvent): void => {
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) {
      return;
    }

    const anchor = (e.target as Element | null)?.closest<HTMLAnchorElement>('a[data-link]');
    if (!anchor || anchor.target && anchor.target !== '_self') return;

    const href = anchor.getAttribute('href');
    if (!href || href.startsWith('http://') || href.startsWith('https://') || href.startsWith('mailto:')) {
      return;
    }

    e.preventDefault();
    void router.navigate(href);
  };

  // ── Resolve and render a matched route ────────────────────────────────────

  async function renderMatch(pathname: string, search: string, source: NavigationContext['source']): Promise<void> {
    const match = matchRoute(compiled, pathname);
    if (!match) return; // no wildcard defined — do nothing

    const { route, params: routeParams } = match;
    const def = route.definition;
    const qs  = new URLSearchParams(search);
    const context: NavigationContext = {
      pathname,
      params: routeParams,
      query: qs,
      source,
    };

    try {
      onNavigateStart?.(context);

      // Resolve view (factory or plain UIView)
      const view = typeof def.view === 'function'
        ? await def.view(routeParams, qs)
        : def.view;

      // Update signals
      current.set(pathname);
      params.set(routeParams);
      query.set(qs);

      if (def.title) document.title = def.title;

      const targetOutlet = outlet;
      if (!targetOutlet) return;

      const style = resolveTransition(def.transition ?? defaultTransition);
      transitioning.set(true);

      await runTransition(targetOutlet, style, () => {
        mount(targetOutlet, view);
      });

      transitioning.set(false);
      window.scrollTo({ top: 0, behavior: 'smooth' });
      onNavigateEnd?.(context);
    } catch (error) {
      transitioning.set(false);
      const normalized = error instanceof Error ? error : new Error(String(error));
      onNavigateError?.(normalized, context);
      throw normalized;
    }
  }

  // ── Global popstate ───────────────────────────────────────────────────────

  function onPopState(): void {
    activeTransition = activeTransition.then(() =>
      renderMatch(stripBase(location.pathname, normalizedBase), location.search, 'popstate')
    );
  }

  // ── Public router object ──────────────────────────────────────────────────

  const router: Router = {
    current,
    params,
    query,
    transitioning,

    async start(el: Element): Promise<void> {
      if (started) return;
      started = true;
      outlet = el;
      window.addEventListener('popstate', onPopState);
      document.addEventListener('click', onDocumentClick);
      await renderMatch(stripBase(location.pathname, normalizedBase), location.search, 'start');
    },

    async navigate(path, { replace = false, state = null } = {}): Promise<void> {
      const targetPath = withBase(path, normalizedBase);
      if (replace) {
        history.replaceState(state, '', targetPath);
      } else {
        history.pushState(state, '', targetPath);
      }
      activeTransition = activeTransition.then(() =>
        renderMatch(stripBase(location.pathname, normalizedBase), location.search, 'navigate')
      );
      return activeTransition;
    },

    back()    { history.back(); },
    forward() { history.forward(); },

    destroy() {
      started = false;
      window.removeEventListener('popstate', onPopState);
      document.removeEventListener('click', onDocumentClick);
      outlet = null;
    },
  };

  return router;
}

function normalizeBase(base: string): string {
  if (!base) return '';
  const prefixed = base.startsWith('/') ? base : `/${base}`;
  return prefixed.endsWith('/') ? prefixed.slice(0, -1) : prefixed;
}

function stripBase(pathname: string, base: string): string {
  if (!base) return pathname;
  if (pathname === base) return '/';
  return pathname.startsWith(`${base}/`) ? pathname.slice(base.length) : pathname;
}

function withBase(path: string, base: string): string {
  if (!base) return path;
  if (path === '/') return base || '/';
  return `${base}${path.startsWith('/') ? path : `/${path}`}`;
}

function resolveTransition(source: TransitionSource): Transition {
  return typeof source === 'function' ? source() : source;
}
