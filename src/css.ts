/**
 * CUP CSS-First Model — Phase 3
 *
 * JavaScript owns state names. CSS owns all visual behaviour.
 * These utilities toggle classes; CSS transitions/animations do the rest.
 *
 * API surface:
 *   cssState(el, stateMap)        — mutually exclusive named class states
 *   animate(el, cls, durationMs)  — fire a one-shot CSS animation class
 *   waitTransition(el)            — Promise that resolves after transitionend
 *   waitAnimation(el)             — Promise that resolves after animationend
 *   theme(root, themes, initial)  — whole-page theme switcher
 */

/** Map of state-name → list of CSS classes active in that state */
export type StateMap = Record<string, string[]>;

export interface CSSState {
  /** Switch to a named state immediately */
  set(name: string): void;
  /** Switch, then resolve after all CSS transitions finish */
  transition(name: string): Promise<void>;
  /** Current state name */
  get(): string;
  /** Subscribe to state changes */
  subscribe(fn: (name: string) => void): () => void;
}

/**
 * Create a CSS state machine on a DOM element.
 *
 * @param el        Target element (or selector string)
 * @param stateMap  Map of state names to arrays of CSS classes
 * @param initial   Initial state name (defaults to first key)
 *
 * @example
 * const modal = cssState('#modal', {
 *   hidden:  ['modal--hidden'],
 *   open:    ['modal--open', 'modal--animate-in'],
 *   closing: ['modal--open', 'modal--animate-out'],
 * });
 * await modal.transition('open');
 */
export function cssState(
  el: Element | string,
  stateMap: StateMap,
  initial?: string,
): CSSState {
  const element = typeof el === 'string'
    ? (document.querySelector(el) ?? (() => { throw new Error(`[CUP] cssState: no element matches "${el}"`); })())
    : el;

  const allClasses = Object.values(stateMap).flat();
  const states = Object.keys(stateMap);
  let current = initial ?? states[0]!;
  const subscribers = new Set<(name: string) => void>();

  // Apply initial state immediately
  applyState(current);

  function applyState(name: string): void {
    if (!(name in stateMap)) {
      console.warn(`[CUP] cssState: unknown state "${name}". Valid: ${states.join(', ')}`);
      return;
    }
    // Strip every class that belongs to ANY state
    element.classList.remove(...allClasses);
    // Add the classes for the target state
    const classes = stateMap[name];
    if (classes && classes.length) element.classList.add(...classes);
    current = name;
    subscribers.forEach((fn) => fn(name));
  }

  return {
    set(name) {
      applyState(name);
    },
    async transition(name) {
      applyState(name);
      await waitForVisualCompletion(element);
    },
    get() {
      return current;
    },
    subscribe(fn) {
      subscribers.add(fn);
      return () => subscribers.delete(fn);
    },
  };
}

/**
 * Fire a one-shot CSS animation class on an element, then remove it.
 * Lets CSS keyframe animations act as fire-and-forget effects.
 *
 * @example
 * await animate(toastEl, 'toast--slide-in');
 */
export async function animate(el: Element, cls: string, durationMs = 2000): Promise<void> {
  el.classList.add(cls);
  await Promise.race([
    waitAnimation(el),
    new Promise<void>((r) => setTimeout(r, durationMs)),
  ]);
  el.classList.remove(cls);
}

/**
 * Resolve after all CSS transitions on an element finish.
 * Falls back after 1 s if no transitionend fires (element may have none).
 */
export function waitTransition(el: Element, timeout = 1000): Promise<void> {
  return waitForVisualCompletion(el, { timeout, includeAnimations: false });
}

export function waitForVisualCompletion(
  el: Element,
  options: { timeout?: number; includeTransitions?: boolean; includeAnimations?: boolean } = {},
): Promise<void> {
  return new Promise((resolve) => {
    const timeout = options.timeout ?? 1000;
    const includeTransitions = options.includeTransitions ?? true;
    const includeAnimations = options.includeAnimations ?? true;
    let pending = 0;
    let started = false;
    const onStart = () => {
      started = true;
      pending += 1;
    };
    const onEnd = () => {
      pending = Math.max(0, pending - 1);
      if (started && pending === 0) finish();
    };
    const timer = setTimeout(finish, timeout);

    function finish() {
      clearTimeout(timer);
      if (includeTransitions) {
        el.removeEventListener('transitionstart', onStart);
        el.removeEventListener('transitionend', onEnd);
        el.removeEventListener('transitioncancel', onEnd);
      }
      if (includeAnimations) {
        el.removeEventListener('animationstart', onStart);
        el.removeEventListener('animationend', onEnd);
        el.removeEventListener('animationcancel', onEnd);
      }
      resolve();
    }

    if (includeTransitions) {
      el.addEventListener('transitionstart', onStart);
      el.addEventListener('transitionend', onEnd);
      el.addEventListener('transitioncancel', onEnd);
    }
    if (includeAnimations) {
      el.addEventListener('animationstart', onStart);
      el.addEventListener('animationend', onEnd);
      el.addEventListener('animationcancel', onEnd);
    }

    // If no transition starts within a tick, resolve immediately
    requestAnimationFrame(() => {
      if (!started && pending === 0) finish();
    });
  });
}

/**
 * Resolve after the current CSS animation on an element finishes.
 */
export function waitAnimation(el: Element, timeout = 2000): Promise<void> {
  return waitForVisualCompletion(el, {
    timeout,
    includeAnimations: true,
    includeTransitions: false,
  });
}

/**
 * Whole-page theme switcher.
 * Adds a single class to `root` (default: document.documentElement).
 * All styling is in CSS — JS only swaps the class.
 *
 * @example
 * const t = theme(['theme-dark', 'theme-light'], 'theme-dark');
 * t.toggle();
 */
export interface ThemeSwitcher {
  set(cls: string): void;
  toggle(): void;
  get(): string;
}

export function theme(
  themes: [string, string],
  initial: string = themes[0]!,
  root: Element = document.documentElement,
): ThemeSwitcher {
  let current = initial;
  root.classList.add(current);

  return {
    set(cls) {
      root.classList.remove(...themes);
      root.classList.add(cls);
      current = cls;
    },
    toggle() {
      const next = themes.find((t) => t !== current) ?? themes[0]!;
      this.set(next);
    },
    get() {
      return current;
    },
  };
}
