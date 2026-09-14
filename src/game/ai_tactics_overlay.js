const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, Number(v) || 0));
const dist = (a, b) => Math.hypot((a?.x || 0) - (b?.x || 0), (a?.y || 0) - (b?.y || 0));

export function applyAITactics(ai) {
  if (!ai || ai.__LOWTOWN_TACTICS_OVERLAY) return false;
  const originalUpdate = ai.update;
  if (typeof originalUpdate !== 'function') return false;

  ai.__LOWTOWN_TACTICS_OVERLAY = true;
  ai.update = function updateWithTactics(car, dt) {
    const control = originalUpdate.call(ai, car, dt);
    if (!control || !ai.state) return control;

    const s = ai.state;
    const hazards = Array.isArray(s.dynamic?.hazards) ? s.dynamic.hazards : [];
    const lead = hazards.find(h => h && h.longitudinal > 0) || s.dynamic?.nearest || null;
    const mission = s.mode === 'MISSION' && s.goal;
    const predicted = s.prediction || {};
    const approachDistance = mission && Number.isFinite(predicted.x) && Number.isFinite(predicted.y)
      ? dist(predicted, s.goal)
      : Infinity;

    let throttle = clamp(control.throttle, 0, 1);
    let brake = clamp(control.brake, 0, 1);
    let steer = clamp(control.steer, -1, 1);

    // Mission arrival: stop feeding full throttle into the destination.
    if (mission && approachDistance < 90) {
      const crawl = clamp((approachDistance - 18) / 72, 0, 1);
      throttle = Math.min(throttle, crawl * .55);
      if (approachDistance < 55) brake = Math.max(brake, clamp((55 - approachDistance) / 37, 0, .85));
      if (approachDistance < 24) { throttle = 0; brake = Math.max(brake, .9); }
      s.tactical = approachDistance < 24 ? 'MISSION_STOP' : 'MISSION_APPROACH';
    }

    // Traffic TTC guard. The trajectory scorer already sees hazards, but this
    // final actuator guard prevents a stale high-throttle candidate from winning
    // when a lead vehicle becomes dangerous between decisions.
    const ttc = Number(lead?.ttc);
    if (Number.isFinite(ttc) && lead.longitudinal > 0 && lead.lateral < 78) {
      if (ttc < 1.1) {
        throttle = 0;
        brake = Math.max(brake, .9);
        if (s.tactical === 'OVERTAKE') s.tactical = 'EMERGENCY_FOLLOW';
      } else if (ttc < 1.8) {
        throttle = Math.min(throttle, clamp((ttc - 1.1) / .7, 0, 1) * .35);
        brake = Math.max(brake, clamp((1.8 - ttc) / .7, 0, .8));
        if (s.tactical === 'OVERTAKE') s.tactical = 'FOLLOW';
      } else if (ttc < 2.2 && s.tactical === 'OVERTAKE') {
        throttle = Math.min(throttle, .45);
        s.tactical = 'FOLLOW';
      }
    }

    // Never let the overlay create a stronger steering command than the planner.
    steer = clamp(steer, -1, 1);
    const out = { ...control, throttle, brake, steer };
    s.control = out;
    s.tactics = {
      mission: !!mission,
      approachDistance: Number.isFinite(approachDistance) ? approachDistance : Infinity,
      leadTtc: Number.isFinite(ttc) ? ttc : Infinity,
      guard: Number.isFinite(ttc) && ttc < 1.8 ? 'TTC_BRAKE' : (mission && approachDistance < 90 ? 'MISSION_APPROACH' : 'NONE')
    };
    return out;
  };
  return true;
}

function boot() {
  const ai = globalThis.__LOWTOWN_AI;
  if (applyAITactics(ai)) return;
  globalThis.setTimeout(boot, 50);
}

if (typeof window !== 'undefined') boot();
