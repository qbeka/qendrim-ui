/**
 * The state model. It knows about intent and ownership and nothing else: no DOM, no
 * timers, no React. See docs/CONTRACT.md, rules M1 to M7.
 *
 * Invariant: `generation` only goes up, and a completion commits only if it names the
 * current generation. That one comparison is what stops an older close from closing a
 * surface that was reopened after it started.
 */

export type Phase = 'settled' | 'moving';

export interface MachineSnapshot<S extends string = string> {
  desired: S;
  rendered: S;
  generation: number;
  phase: Phase;
  destroyed: boolean;
}

/** Proof of who asked. A token stops being current when any newer intent arrives. */
export interface IntentToken {
  readonly generation: number;
}

export type CompletionResult = 'committed' | 'stale' | 'idle' | 'destroyed';

export interface Machine<S extends string = string> {
  snapshot(): MachineSnapshot<S>;
  request(shape: S): boolean;
  complete(generation: number): CompletionResult;
  token(): IntentToken;
  isCurrent(token: IntentToken): boolean;
  invalidate(): void;
  destroy(): void;
}

export function createMachine<S extends string>(initial: S): Machine<S> {
  let desired = initial;
  let rendered = initial;
  let generation = 0;
  let phase: Phase = 'settled';
  let destroyed = false;

  return {
    snapshot: () => ({ desired, rendered, generation, phase, destroyed }),

    request(shape) {
      if (destroyed || shape === desired) return false;
      desired = shape;
      generation += 1;
      phase = 'moving';
      return true;
    },

    complete(claimed) {
      if (destroyed) return 'destroyed';
      if (claimed !== generation) return 'stale';
      if (phase !== 'moving') return 'idle';
      rendered = desired;
      phase = 'settled';
      return 'committed';
    },

    token: () => ({ generation }),

    isCurrent: (token) => !destroyed && token.generation === generation,

    invalidate() {
      if (!destroyed) generation += 1;
    },

    destroy() {
      destroyed = true;
    },
  };
}
