import React from "react";

type EffectSlot = { dependencies?: readonly unknown[]; cleanup?: () => void };
type Internals = { H: unknown };
const internals = (React as unknown as { __CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE: Internals })
  .__CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE;

/** Deterministic Node hook lifecycle runner; no browser or simulated network escape. */
export function hooks<T>(component: () => T, contexts = new Map<unknown, unknown>()) {
  const slots: unknown[] = [];
  let cursor = 0;
  let dirty = true;
  let output: T;
  const pending: (() => void)[] = [];
  function effect(callback: () => (() => void) | void, dependencies?: readonly unknown[]) {
    const index = cursor++;
    const previous = slots[index] as EffectSlot | undefined;
    if (!previous || !dependencies || dependencies.some((value, i) => !Object.is(value, previous.dependencies?.[i]))) {
      const slot: EffectSlot = { dependencies };
      slots[index] = slot;
      pending.push(() => {
        previous?.cleanup?.();
        slot.cleanup = callback() || undefined;
      });
    }
  }
  const dispatcher = {
    useState(initial: unknown) {
      const index = cursor++;
      if (!(index in slots)) slots[index] = typeof initial === "function" ? initial() : initial;
      return [slots[index], (next: unknown) => {
        const value = typeof next === "function" ? next(slots[index]) : next;
        if (!Object.is(value, slots[index])) { slots[index] = value; dirty = true; }
      }];
    },
    useRef(initial: unknown) {
      const index = cursor++;
      if (!(index in slots)) slots[index] = { current: initial };
      return slots[index];
    },
    useMemo(factory: () => unknown, dependencies: readonly unknown[]) {
      const index = cursor++;
      const previous = slots[index] as { dependencies: readonly unknown[]; value: unknown } | undefined;
      if (!previous || dependencies.some((value, i) => !Object.is(value, previous.dependencies[i]))) {
        slots[index] = { dependencies, value: factory() };
      }
      return (slots[index] as { value: unknown }).value;
    },
    useCallback(callback: unknown, dependencies: readonly unknown[]) { return dispatcher.useMemo(() => callback, dependencies); },
    useContext(context: { _currentValue: unknown }) { return contexts.has(context) ? contexts.get(context) : context._currentValue; },
    useEffect: effect,
    useLayoutEffect: effect,
  };
  function render() {
    cursor = 0;
    dirty = false;
    const previous = internals.H;
    internals.H = dispatcher;
    try { output = component(); } finally { internals.H = previous; }
    while (pending.length) pending.shift()!();
    return output;
  }
  async function flush() {
    for (let i = 0; i < 30; i++) {
      if (dirty) render();
      await new Promise<void>(resolve => setImmediate(resolve));
    }
    return output;
  }
  render();
  return {
    get output() { return output; },
    render: () => { dirty = true; return render(); },
    flush,
    dispose: () => { for (const slot of slots) (slot as EffectSlot | undefined)?.cleanup?.(); },
  };
}
