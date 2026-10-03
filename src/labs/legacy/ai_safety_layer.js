export function createAISafetyLayer({ eventCooldown = 0.45, nearMissCooldown = 0.35, overtakeCooldown = 1.2 } = {}) {
  const state = {
    lastNearMiss: -Infinity,
    lastOvertake: -Infinity,
    lastAvoidance: -Infinity,
    hardBrakeCount: 0,
    steeringSpikes: 0,
    invalidControls: 0,
    suppressedEvents: 0,
    lastControl: { throttle: 0, brake: 0, steer: 0, handbrake: false }
  };

  function finite(v, fallback = 0) { return Number.isFinite(v) ? v : fallback; }
  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }

  function sanitizeControl(control = {}, speed = 0) {
    let throttle = clamp(finite(control.throttle), 0, 1);
    let brake = clamp(finite(control.brake), 0, 1);
    let steer = clamp(finite(control.steer), -1, 1);
    const handbrake = !!control.handbrake;

    if (throttle > 0.85 && brake > 0.25) {
      if (speed > 45) throttle = 0;
      else brake = 0;
      state.invalidControls++;
    }

    if (Math.abs(steer - state.lastControl.steer) > 0.72) state.steeringSpikes++;
    if (brake > 0.72 && speed > 250) state.hardBrakeCount++;

    state.lastControl = { throttle, brake, steer, handbrake };
    return state.lastControl;
  }

  function edgeEvent(kind, condition, now = 0) {
    if (!condition) return false;
    const key = kind === 'nearMiss' ? 'lastNearMiss' : kind === 'overtake' ? 'lastOvertake' : 'lastAvoidance';
    const cooldown = kind === 'nearMiss' ? nearMissCooldown : kind === 'overtake' ? overtakeCooldown : eventCooldown;
    if (now - state[key] < cooldown) { state.suppressedEvents++; return false; }
    state[key] = now;
    return true;
  }

  function validatePrediction(prediction = {}) {
    const risk = clamp(finite(prediction.risk), 0, 2);
    const ttc = Number.isFinite(prediction.ttc) ? Math.max(0, prediction.ttc) : Infinity;
    return {
      safe: prediction.safe !== false && risk < 1,
      risk,
      ttc,
      urgent: ttc < 1.2 || risk >= 1.25
    };
  }

  function status() {
    return { ...state, lastControl: { ...state.lastControl } };
  }

  return { state, sanitizeControl, edgeEvent, validatePrediction, status };
}

export function evaluateTrajectoryAgainstTraffic(points = [], traffic = [], { radius = 38, dt = 0.1, horizon = 1.2 } = {}) {
  let minDistance = Infinity;
  let minTtc = Infinity;
  let risk = 0;
  let conflict = null;

  for (let i = 0; i < points.length; i++) {
    const t = Math.min(horizon, i * dt);
    const p = points[i];
    for (const o of traffic) {
      if (!o) continue;
      const speed = Number.isFinite(o.v) ? o.v : 0;
      const ox = o.x + Math.cos(o.a || 0) * speed * t;
      const oy = o.y + Math.sin(o.a || 0) * speed * t;
      const d = Math.hypot(p.x - ox, p.y - oy);
      if (d < minDistance) minDistance = d;
      if (d < radius) {
        const localRisk = (radius - d) / radius;
        risk += localRisk * (1.2 - Math.min(1, t / Math.max(0.1, horizon)) * 0.35);
        if (!conflict || t < conflict.t) conflict = { t, x: p.x, y: p.y, traffic: o, distance: d };
      }
      if (d < radius * 1.8 && t > 0) minTtc = Math.min(minTtc, t);
    }
  }

  return {
    safe: !conflict,
    risk: Math.min(2, risk),
    minDistance,
    ttc: minTtc,
    conflict
  };
}

export function shouldReplan({ routeLength = 0, node = 0, routeTimer = 0, stuckTime = 0, predictionRisk = 0, ttc = Infinity, crossTrack = 0, progressTimer = 0, goalDistance = Infinity } = {}) {
  if (routeLength < 2) return { replan: true, reason: 'INVALID_ROUTE' };
  if (node >= routeLength - 1 && goalDistance > 75) return { replan: true, reason: 'ROUTE_EXHAUSTED' };
  if (stuckTime > 2.5) return { replan: true, reason: 'STUCK' };
  if (predictionRisk >= 1.25 || ttc < 0.8) return { replan: true, reason: 'DYNAMIC_HAZARD' };
  if (Math.abs(crossTrack) > 130) return { replan: true, reason: 'OFF_ROUTE' };
  if (progressTimer > 7) return { replan: true, reason: 'NO_PROGRESS' };
  if (routeTimer > 24) return { replan: true, reason: 'STALE_ROUTE' };
  return { replan: false, reason: 'ROUTE_VALID' };
}
