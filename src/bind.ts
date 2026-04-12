/**
 * CUP Reactivity Layer — Phase 2
 *
 * bind(container, signals) wires named signals to DOM elements via:
 *   data-bind="signalName"          → updates element.textContent
 *   data-bind-attr="name:signal"    → updates element.setAttribute(name, value)
 *   data-bind-class="cls:signal"    → toggles class "cls" when signal is truthy
 *   data-bind-show="signal"         → toggles visibility (CSS class "hidden")
 *
 * Only the affected elements are touched — no re-render, no virtual DOM.
 */

import type { Signal } from './types.js';
import { BIND_CLEANUP, cleanupTree, trackCleanup } from './cleanup.js';

export type SignalMap = Record<string, Signal<unknown>>;

type BindableElement = HTMLElement;

/** Remove all signal subscriptions from a previously-bound container. */
export function unbind(container: Element): void {
  cleanupTree(container);
}

/**
 * Wire signals to DOM elements inside container.
 * Call after mount() so the elements exist in the DOM.
 */
export function bind(container: Element, signals: SignalMap): void {
  cleanupTree(container, BIND_CLEANUP);

  // data-bind="signalName"  →  textContent
  container.querySelectorAll<BindableElement>('[data-bind]').forEach((el) => {
    const name = el.dataset['bind']!;
    const signal = signals[name];
    if (!signal) { warn(name, el); return; }

    // Set initial value
    el.textContent = String(signal.get() ?? '');

    const unsub = signal.subscribe((v) => {
      el.textContent = String(v ?? '');
    });
    trackCleanup(el, BIND_CLEANUP, unsub);
  });

  // data-bind-attr="attributeName:signalName"  →  setAttribute
  container.querySelectorAll<BindableElement>('[data-bind-attr]').forEach((el) => {
    const raw = el.dataset['bindAttr']!;
    const [attrName, sigName] = raw.split(':').map((s) => s.trim());
    if (!attrName || !sigName) return;

    const signal = signals[sigName];
    if (!signal) { warn(sigName, el); return; }

    el.setAttribute(attrName, String(signal.get() ?? ''));

    const unsub = signal.subscribe((v) => {
      el.setAttribute(attrName, String(v ?? ''));
    });
    trackCleanup(el, BIND_CLEANUP, unsub);
  });

  // data-bind-class="className:signalName"  →  classList.toggle
  container.querySelectorAll<BindableElement>('[data-bind-class]').forEach((el) => {
    const raw = el.dataset['bindClass']!;
    // Support multiple pairs: "negative:isNeg warn:isWarn"
    raw.split(/\s+/).forEach((pair) => {
      const [cls, sigName] = pair.split(':').map((s) => s.trim());
      if (!cls || !sigName) return;

      const signal = signals[sigName];
      if (!signal) { warn(sigName, el); return; }

      el.classList.toggle(cls, Boolean(signal.get()));

      const unsub = signal.subscribe((v) => {
        el.classList.toggle(cls, Boolean(v));
      });
      trackCleanup(el, BIND_CLEANUP, unsub);
    });
  });

  // data-bind-show="signalName"  →  toggles .hidden (display:none via CSS)
  container.querySelectorAll<BindableElement>('[data-bind-show]').forEach((el) => {
    const name = el.dataset['bindShow']!;
    const signal = signals[name];
    if (!signal) { warn(name, el); return; }

    el.style.display = signal.get() ? '' : 'none';

    const unsub = signal.subscribe((v) => {
      el.style.display = v ? '' : 'none';
    });
    trackCleanup(el, BIND_CLEANUP, unsub);
  });
}

function warn(name: string, el: Element): void {
  console.warn(`[CUP] No signal named "${name}" for`, el);
}
