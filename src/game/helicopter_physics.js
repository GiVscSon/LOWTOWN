/**
 * helicopter_physics.js
 * Modular helicopter physics step.
 * Controls: throttle (forward), steer (yaw), strafe (lateral slide),
 *           climb/descend (altitude), brake (all axes).
 */
import { TRANSPORT_TYPES } from './transport_constants.js';

const clamp  = (v, a, b) => Math.max(a, Math.min(b, v));
const finite = (v, f = 0) => Number.isFinite(Number(v)) ? Number(v) : f;

function normalizeInput(input = {}) {
  return {
    throttle: clamp(finite(input.throttle), -1, 1),
    steer:    clamp(finite(input.steer),    -1, 1),
    strafe:   clamp(finite(input.strafe),   -1, 1),
    brake:    clamp(finite(input.brake),     0, 1),
    climb:    clamp(finite(input.climb),     0, 1),
    descend:  clamp(finite(input.descend),   0, 1),
  };
}

export function stepHelicopterPhysics(state, dt, input, physics) {
  const p      = physics || {};
  const safeDt = clamp(finite(dt), 0, 0.1);
  const c      = normalizeInput(input);
  const mass   = Math.max(1, finite(p.mass, state.mass || 1));
  const thrust = finite(p.engineForce) / mass;

  // heading vectors
  const fx = Math.cos(state.a);
  const fy = Math.sin(state.a);
  const rx = -fy; // right strafe
  const ry =  fx;

  // forward/backward
  state.vx += fx * c.throttle * thrust * safeDt;
  state.vy += fy * c.throttle * thrust * safeDt;

  // lateral strafe (65% of main thrust)
  const strafePower = finite(p.strafeForce, thrust * 0.65);
  state.vx += rx * c.strafe * strafePower * safeDt;
  state.vy += ry * c.strafe * strafePower * safeDt;

  // yaw — independent of forward speed
  const yawRate    = finite(p.steeringRate, 1.8);
  const yawInertia = finite(p.yawInertia, 4);
  const yawDamp    = finite(p.yawDamping, 2.5);
  state.yawRate = state.yawRate || 0;
  state.yawRate += (c.steer * yawRate - state.yawRate) * yawInertia * safeDt;
  state.yawRate -= state.yawRate * yawDamp * safeDt;
  state.a       += state.yawRate * safeDt;

  // vertical / altitude
  const vf = finite(p.verticalForce, 1.4);
  state.vz = state.vz || 0;
  state.vz += (c.climb - c.descend) * vf * safeDt * (thrust * mass);
  state.vz *= (1 - finite(p.hoverDamping, 2.2) * safeDt); // rotor hover damping
  state.vz  = clamp(state.vz, -finite(p.maxAltitude, 600) * 0.4, finite(p.maxAltitude, 600) * 0.4);

  // brake — all axes
  if (c.brake > 0) {
    const brakeK = clamp(1 - finite(p.brakeForce, 0.9) * c.brake * safeDt / mass, 0, 1);
    state.vx *= brakeK; state.vy *= brakeK; state.vz *= brakeK;
  }

  // aerodynamic drag (rotor wash)
  const speed    = Math.hypot(state.vx, state.vy);
  const aeroDrag = 1 / (1 + finite(p.aeroDrag, 0.0006) * speed * speed * safeDt);
  state.vx *= aeroDrag;
  state.vy *= aeroDrag;

  // horizontal speed cap
  const hSpeed = Math.hypot(state.vx, state.vy);
  const maxH   = finite(p.maxForwardSpeed, 280);
  if (hSpeed > maxH) { const k = maxH / hSpeed; state.vx *= k; state.vy *= k; }

  // integrate position
  state.x += state.vx * safeDt;
  state.y += state.vy * safeDt;
  state.z  = clamp(
    (state.z || 0) + state.vz * safeDt,
    finite(p.minAltitude, 20),
    finite(p.maxAltitude, 600)
  );

  return helicopterTelemetry(state, c, p);
}

export function helicopterTelemetry(state, input = {}, physics = {}) {
  const fx      = Math.cos(state.a);
  const fy      = Math.sin(state.a);
  const forward = state.vx * fx + state.vy * fy;
  const lateral = -state.vx * Math.sin(state.a) + state.vy * Math.cos(state.a);
  return {
    type:          TRANSPORT_TYPES.HELICOPTER,
    x:             state.x,
    y:             state.y,
    z:             state.z || 0,
    heading:       state.a,
    velocity:      Math.hypot(state.vx, state.vy, state.vz || 0),
    forwardSpeed:  forward,
    lateralSpeed:  lateral,
    verticalSpeed: state.vz || 0,
    altitude:      state.z || 0,
    yawRate:       state.yawRate || 0,
    surface:       'air',
    controls:      { ...input },
  };
}
