/**
 * A damped spring, solved in closed form.
 *
 * Units: seconds and pixels. A sample at time t is exact, so a retarget can read
 * position and velocity at any moment and the result does not depend on the frame
 * rate. This is why the engine owns a spring rather than using a CSS timing function:
 * a CSS transition can restart from the current value, but it cannot carry velocity.
 *
 * The equation is x'' + 2 z w x' + w^2 (x - to) = 0, with angular frequency w and
 * damping ratio z. Only z <= 1 is supported, because nothing here needs an overdamped
 * spring, and leaving it out keeps two branches instead of three.
 */

export interface Spring {
  /** Angular frequency in radians per second. */
  omega: number;
  /** Damping ratio. 1 is critically damped. Below 1 overshoots. */
  zeta: number;
}

export interface SpringSegment {
  from: number;
  velocity: number;
  to: number;
}

export interface SpringSample {
  value: number;
  velocity: number;
}

const CRITICAL_EPSILON = 1e-6;

/** Builds a spring from its undamped period in milliseconds, which is easier to tune than stiffness. */
export function springFromResponse(responseMs: number, zeta: number): Spring {
  const seconds = Math.max(responseMs, 1) / 1000;
  return { omega: (2 * Math.PI) / seconds, zeta: Math.min(Math.max(zeta, 0.05), 1) };
}

export function sampleSpring(segment: SpringSegment, spring: Spring, t: number): SpringSample {
  const { from, velocity, to } = segment;
  const { omega, zeta } = spring;
  const a = from - to;

  if (1 - zeta < CRITICAL_EPSILON) {
    // Critically damped: x(t) = to + (a + b t) e^(-w t), with b chosen so x'(0) = velocity.
    const b = velocity + omega * a;
    const decay = Math.exp(-omega * t);
    return {
      value: to + (a + b * t) * decay,
      velocity: (b - omega * (a + b * t)) * decay,
    };
  }

  // Underdamped: x(t) = to + e^(-z w t) (a cos(d t) + b sin(d t)), with d the damped frequency.
  const damped = omega * Math.sqrt(1 - zeta * zeta);
  const b = (velocity + zeta * omega * a) / damped;
  const decay = Math.exp(-zeta * omega * t);
  const cos = Math.cos(damped * t);
  const sin = Math.sin(damped * t);
  return {
    value: to + decay * (a * cos + b * sin),
    velocity: decay * ((b * damped - zeta * omega * a) * cos - (a * damped + zeta * omega * b) * sin),
  };
}
