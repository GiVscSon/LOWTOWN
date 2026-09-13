import { createTrajectoryLab } from './trajectory_lab.js';
import { predictVehicle } from './physics_prediction.js';
import { resolveTransportPhysics } from './transport_profiles.js';
import { collisionSafety } from './vehicle_safety.js';

export function createAIDriver({ nodes = [], blocked = () => false, getTraffic = () => [] }) {
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
  const wrap = a => { while (a > Math.PI) a -= Math.PI * 2; while (a < -Math.PI) a += Math.PI * 2; return a; };
  const dot = (ax, ay, bx, by) => ax * bx + ay * by;
  const finite = (v, f = 0) => Number.isFinite(Number(v)) ? Number(v) : f;
  const state = {
    enabled: false, route: [], node: 0, goal: null, state: 'IDLE', mode: 'IDLE', tactical: 'CRUISE',
    sensor: { front: 999, frontLeft: 999, frontRight: 999, left: 999, right: 999 },
    dynamic: { count: 0, nearest: null, hazards: [] },
    prediction: { safe: true, x: 0, y: 0, t: 0, ttc: Infinity, risk: 0, confidence: 1 },
    horizons: [], candidates: [], chosenCandidate: 0, predictedTrajectory: [],
    crossTrack: 0, curvature: 0, headingError: 0, laneOffset: 0, targetSpeed: 0,
    replans: 0, recoveries: 0, safeStarts: 0, routeFailures: 0, stuckTime: 0, contactTime: 0,
    progressTimer: 0, routeTimer: 0, lastProgressX: 0, lastProgressY: 0, distance: 0,
    visited: new Set(), lap: 0, decisions: 0, collisionsAvoided: 0, nearMisses: 0, overtakes: 0,
    debug: true, trajectoryLab: { selected: null, cause: 'BOOT', reason: 'BOOT', candidateCount: 0, safeCandidates: 0, risk: Infinity },
    control: { throttle: 0, brake: 0, steer: 0, handbrake: false },
    uncertainty: { position: 0, traffic: 0, model: 0, total: 0 },
    predictionConfidence: 1
  };

  let seed = 0x51f15e;
  const rand = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };

  function nearestNode(x, y) {
    let best = nodes[0] || null, bd = Infinity;
    for (const n of nodes) { const d = (n.x - x) ** 2 + (n.y - y) ** 2; if (d < bd) { bd = d; best = n; } }
    return best;
  }

  function weightedRoute(start, goal) {
    if (!start || !goal) return [];
    if (start.id === goal.id) return [start];
    const open = [start], g = new Map([[start.id, 0]]), f = new Map([[start.id, dist(start, goal)]]), prev = new Map([[start.id, null]]);
    const closed = new Set();
    while (open.length) {
      open.sort((a, b) => (f.get(a.id) ?? Infinity) - (f.get(b.id) ?? Infinity));
      const n = open.shift();
      if (!n || closed.has(n.id)) continue;
      if (n.id === goal.id) break;
      closed.add(n.id);
      for (const m of n.links || []) {
        if (closed.has(m.id) || blocked(m.x, m.y)) continue;
        const dx = m.x - n.x, dy = m.y - n.y, length = Math.hypot(dx, dy) || 1;
        const blockedMid = blocked((n.x + m.x) * .5, (n.y + m.y) * .5);
        if (blockedMid) continue;
        const turnCost = n.links?.length > 2 ? 0 : .15;
        const heatCost = 1 + turnCost + Math.min(.8, Math.abs(dx * dy) / (length * length + 1));
        const tentative = (g.get(n.id) ?? Infinity) + length * heatCost;
        if (tentative < (g.get(m.id) ?? Infinity)) {
          g.set(m.id, tentative); f.set(m.id, tentative + dist(m, goal)); prev.set(m.id, n); open.push(m);
        }
      }
    }
    if (!prev.has(goal.id)) return [];
    const out = []; for (let n = goal; n; n = prev.get(n.id)) out.push(n); return out.reverse();
  }

  function safePoint(n) { return !!(n && !blocked(n.x, n.y) && Array.isArray(n.links) && n.links.length >= 2); }

  function safeStart(car) {
    const candidates = nodes.filter(safePoint);
    if (!candidates.length) return null;
    let n = candidates[(rand() * candidates.length) | 0];
    for (let i = 0; i < 8; i++) { const t = candidates[(rand() * candidates.length) | 0]; if ((t.links?.length || 0) > (n.links?.length || 0)) n = t; }
    const next = (n.links || []).find(m => !blocked((n.x + m.x) * .5, (n.y + m.y) * .5)) || n.links?.[0];
    if (!next) return null;
    car.x = n.x; car.y = n.y; car.a = Math.atan2(next.y - n.y, next.x - n.x); car.vx = 0; car.vy = 0; car.vz = 0;
    state.safeStarts++; state.lastProgressX = car.x; state.lastProgressY = car.y; return n;
  }

  function ray(car, angle, max, step = 6) {
    for (let d = 10; d <= max; d += step) if (blocked(car.x + Math.cos(angle) * d, car.y + Math.sin(angle) * d)) return d;
    return max;
  }

  function sense(car) {
    const a = car.a || 0;
    state.sensor.front = ray(car, a, 360); state.sensor.frontLeft = ray(car, a - .34, 320); state.sensor.frontRight = ray(car, a + .34, 320);
    state.sensor.left = ray(car, a - Math.PI / 2, 210); state.sensor.right = ray(car, a + Math.PI / 2, 210); return state.sensor;
  }

  function dynamicHazards(car) {
    const fx = Math.cos(car.a || 0), fy = Math.sin(car.a || 0), hs = [];
    for (const o of getTraffic() || []) {
      if (!o || o === car) continue;
      const dx = o.x - car.x, dy = o.y - car.y, lon = dot(dx, dy, fx, fy), latSigned = dot(dx, dy, -fy, fx), lat = Math.abs(latSigned);
      if (lon < -90 || lon > 520 || lat > 105) continue;
      const ov = finite(o.v), ovx = Math.cos(o.a || 0) * ov, ovy = Math.sin(o.a || 0) * ov;
      const rvx = finite(car.vx) - ovx, rvy = finite(car.vy) - ovy, closing = dot(rvx, rvy, fx, fy), gap = Math.max(0, lon - 28);
      hs.push({ o, longitudinal: lon, lateral: lat, lateralSigned: latSigned, ttc: closing > 5 ? gap / closing : Infinity, closing, speed: ov });
    }
    hs.sort((a, b) => a.longitudinal - b.longitudinal); state.dynamic = { count: hs.length, nearest: hs[0] || null, hazards: hs }; return hs;
  }

  function segmentInfo(car) {
    if (state.route.length < 2) return { heading: car.a || 0, cross: 0, curvature: 0, distance: Infinity, index: 0, width: 46, nextHeading: car.a || 0 };
    let best = null, from = Math.max(0, state.node - 3), to = Math.min(state.route.length - 2, state.node + 6);
    for (let i = from; i <= to; i++) {
      const a = state.route[i], b = state.route[i + 1], dx = b.x - a.x, dy = b.y - a.y, l2 = dx * dx + dy * dy || 1;
      const t = clamp(((car.x - a.x) * dx + (car.y - a.y) * dy) / l2, 0, 1), px = a.x + dx * t, py = a.y + dy * t, d = Math.hypot(car.x - px, car.y - py);
      if (!best || d < best.distance) best = { a, b, heading: Math.atan2(dy, dx), cross: ((car.x - px) * (-dy) + (car.y - py) * dx) / Math.sqrt(l2), distance: d, index: i, t };
    }
    const i = best.index, p1 = state.route[i], p2 = state.route[Math.min(state.route.length - 1, i + 1)], p3 = state.route[Math.min(state.route.length - 1, i + 2)];
    const h1 = Math.atan2(p2.y - p1.y, p2.x - p1.x), h2 = p3 === p2 ? h1 : Math.atan2(p3.y - p2.y, p3.x - p2.x);
    return { ...best, curvature: Math.abs(wrap(h2 - h1)), nextHeading: h2, width: 46 };
  }

  function lookahead(car, meters) {
    if (!state.route.length) return nearestNode(car.x, car.y) || { x: car.x, y: car.y };
    let i = Math.min(state.node, state.route.length - 1), p = state.route[i], remain = meters;
    while (i + 1 < state.route.length) { const n = state.route[i + 1], len = dist(p, n) || 1; if (len >= remain) return { x: p.x + (n.x - p.x) * remain / len, y: p.y + (n.y - p.y) * remain / len }; remain -= len; p = n; i++; }
    return p;
  }

  function sharedPredict(car, seconds, candidate) {
    const physics = car.physics || resolveTransportPhysics(car.vehicleId || 'sedan');
    return predictVehicle(car, seconds, { steer: candidate.steer, throttle: candidate.throttle, brake: candidate.brake, handbrake: !!candidate.handbrake }, physics, {
      blocked, useActuatorDelay: true, actuatorResponse: { steer: 12, throttle: 8, brake: 16, climb: 8, descend: 8 }
    });
  }

  function trafficRisk(result, hazards) {
    let risk = 0, minTtc = Infinity;
    for (const h of hazards.slice(0, 6)) {
      minTtc = Math.min(minTtc, h.ttc);
      const o = h.o, ov = finite(o.v), ovx = Math.cos(o.a || 0) * ov, ovy = Math.sin(o.a || 0) * ov;
      for (const t of [.35, .7, 1.05]) { const qx = o.x + ovx * t, qy = o.y + ovy * t, d = Math.hypot(result.x - qx, result.y - qy), allow = 34 + result.speed * .06; if (d < allow) risk += (allow - d) * (1.4 - t * .3); }
    }
    return { risk, minTtc };
  }

  const trajectoryLab = createTrajectoryLab({ simulate: (car, seconds, steer, throttle, brake = 0) => sharedPredict(car, seconds, { steer, throttle, brake }), trafficRisk, blocked });

  function candidateScore(car, candidate, seg, hazards) {
    const p = sharedPredict(car, candidate.horizon, candidate), tr = trafficRisk(p, hazards);
    const target = lookahead(car, Math.max(180, candidate.horizon * 320)), movement = Math.hypot(p.x - car.x, p.y - car.y), targetDistance = Math.hypot(p.x - target.x, p.y - target.y);
    const physics = car.physics || resolveTransportPhysics(car.vehicleId || 'sedan');
    const brakingAcceleration = Math.max(1, finite(physics.brakingAcceleration, finite(physics.brakeForce) / Math.max(1, finite(physics.mass, 1))));
    let safetyPenalty = 0, safetySafe = true;
    for (const h of hazards.slice(0, 6)) {
      if (h.longitudinal <= 0) continue;
      const gap = Math.max(0, h.longitudinal - 28), safety = collisionSafety({ gap, speed: p.speed, relativeSpeed: Math.max(0, h.closing), brakingAcceleration, reactionTime: .25, margin: 12 });
      if (!safety.safe) { safetySafe = false; safetyPenalty += Math.min(6000, (safety.requiredGap - safety.gap) * 40); }
    }
    const lateral = Math.abs(seg.cross + Math.sin(candidate.steer) * candidate.horizon * Math.max(30, Math.hypot(car.vx || 0, car.vy || 0)));
    const wallPenalty = Number.isFinite(p.minWall) ? Math.max(0, 70 - p.minWall) * 4 : 0;
    const collisionPenalty = p.safe ? 0 : 100000 + Math.max(0, candidate.horizon - p.collisionT) * 8000;
    const comfort = Math.abs(candidate.steer) * 30 + candidate.brake * 35;
    const score = movement * .7 - targetDistance * .75 - lateral * .85 - wallPenalty - tr.risk * 5 - safetyPenalty - collisionPenalty - comfort + (candidate.overtake ? 45 : 0);
    return { ...candidate, ...p, safe: !!p.safe && safetySafe, physicsSafe: !!p.safe, safetySafe, trafficRisk: tr.risk, ttc: tr.minTtc, targetDistance, score };
  }

  function chooseControl(car) {
    const sensors = sense(car), hazards = dynamicHazards(car), seg = segmentInfo(car), speed = Math.hypot(car.vx || 0, car.vy || 0), look = lookahead(car, clamp(115 + speed * .5 + seg.curvature * 90, 115, 300));
    const headingError = wrap(Math.atan2(look.y - car.y, look.x - car.x) - (car.a || 0)); state.headingError = headingError;
    const center = clamp(seg.cross / 48, -2, 2), baseSteer = clamp(headingError * 1.85 - center * 1.05, -1, 1), turnAround = Math.abs(headingError) > 2.2 || seg.curvature > 2.35;
    const lab = trajectoryLab.evaluate(car, { headingError, curvature: seg.curvature, baseSteer, speed, target: look, hazards });
    state.trajectoryLab = { selected: lab.selected?.id || null, cause: lab.cause, reason: lab.reason, candidateCount: lab.candidateCount, safeCandidates: lab.safeCandidates, risk: lab.risk };
    const physics = car.physics || resolveTransportPhysics(car.vehicleId || 'sedan'), maxSpeed = Math.max(35, finite(physics.maxForwardSpeed, 300));
    let desiredSpeed = maxSpeed - seg.curvature * 210 - Math.min(75, Math.abs(seg.cross) * .7);
    if (turnAround) desiredSpeed = Math.min(desiredSpeed, Math.max(55, Math.min(95, speed)));
    else { if (Math.abs(seg.cross) > 55) desiredSpeed = Math.min(desiredSpeed, Math.max(55, maxSpeed - Math.min(150, (Math.abs(seg.cross) - 55) * 2.2))); if (Math.abs(seg.cross) > 90) desiredSpeed = Math.min(desiredSpeed, 135); if (Math.abs(headingError) > .8) desiredSpeed -= 95; desiredSpeed = Math.max(35, desiredSpeed); }
    const lead = hazards.find(h => h.longitudinal > 0 && h.longitudinal < 250); let tactical = 'CRUISE', laneBias = 0;
    if (!turnAround && lead && lead.ttc < 3.5 && sensors.front < 210) {
      const sideFree = sensors.left > 95 || sensors.right > 95;
      if (sideFree && seg.curvature < .55 && speed > 90) { tactical = 'OVERTAKE'; laneBias = sensors.left > sensors.right ? -1 : 1; state.overtakes++; } else tactical = 'FOLLOW';
      if (lead.ttc < 2.1) desiredSpeed = Math.min(desiredSpeed, Math.max(50, speed - (2.1 - lead.ttc) * 145));
    }
    if (sensors.front < 105) desiredSpeed = Math.min(desiredSpeed, Math.max(35, sensors.front * 2));
    state.tactical = turnAround ? 'TURN_AROUND' : tactical; state.laneOffset = laneBias;
    const candidates = [];
    const offsets = turnAround ? [-1, -0.5, 0, 0.5, 1] : [-1, -0.5, 0, 0.5, 1];
    for (const offset of offsets) for (const throttle of [0, .45, 1]) {
      const steer = clamp(baseSteer + offset * .38 + laneBias * .12, -1, 1);
      let brake = throttle === 0 ? clamp((speed - desiredSpeed) / 130, 0, 1) : 0;
      if (Math.abs(seg.cross) > 70) brake = Math.max(brake, clamp((Math.abs(seg.cross) - 70) / 70, 0, 1));
      if (turnAround && speed > 180 && throttle === 0) brake = Math.max(brake, .75);
      candidates.push(candidateScore(car, { id: `${offset}:${throttle}`, steer, throttle, brake, horizon: speed > 260 ? .9 : 1.2, overtake: tactical === 'OVERTAKE' && laneBias !== 0 && offset * laneBias > 0 }, seg, hazards));
    }
    candidates.sort((a, b) => b.score - a.score);
    const best = candidates.find(c => c.safe && c.ttc > 1.05) || candidates.find(c => c.safe) || candidates[0];
    state.candidates = candidates.slice(0, 12).map((c, i) => ({ rank: i + 1, id: c.id, steer: +c.steer.toFixed(3), throttle: c.throttle, brake: +c.brake.toFixed(3), safe: c.safe, score: Math.round(c.score), ttc: Number.isFinite(c.ttc) ? +c.ttc.toFixed(2) : Infinity }));
    state.chosenCandidate = Math.max(0, candidates.indexOf(best)); state.targetSpeed = desiredSpeed; state.mode = state.state = best.brake > .5 ? 'BRAKE' : tactical; state.decisions++;
    const horizons = [.35, .7, 1.05].map(t => candidateScore(car, { ...best, horizon: t }, seg, hazards));
    state.predictedTrajectory = horizons.flatMap(p => p.points || []);
    const last = horizons[horizons.length - 1] || best, tr = trafficRisk(last, hazards);
    const uncertainty = clamp((Math.abs(seg.cross) / 140) * .25 + (hazards.length / 10) * .25 + (Math.abs(headingError) / Math.PI) * .2 + (last.safe ? 0 : .35), 0, .95);
    state.uncertainty = { position: clamp(Math.abs(seg.cross) / 160, 0, 1), traffic: clamp(hazards.length / 8, 0, 1), model: .12, total: uncertainty };
    state.predictionConfidence = 1 - uncertainty;
    state.prediction = { safe: best.safe && tr.risk < 10, x: last.x, y: last.y, t: last.collisionT, ttc: tr.minTtc, risk: clamp((1 - Math.min(1, finite(last.minWall, 100) / 100)) + tr.risk / 40 + (best.safe ? 0 : 1), 0, 2), confidence: state.predictionConfidence };
    state.horizons = horizons.map((p, i) => ({ t: [.35, .7, 1.05][i], x: p.x, y: p.y, safe: p.safe, wall: p.minWall, confidence: state.predictionConfidence }));
    state.crossTrack = seg.cross || 0; state.curvature = seg.curvature || 0;
    state.control = { throttle: best.throttle, brake: best.brake, steer: best.steer, handbrake: speed > 180 && Math.abs(best.steer) > .65 };
    if (state.prediction.ttc < 1.2) state.nearMisses++;
    return state.control;
  }

  function chooseGoal(car) {
    const current = nearestNode(car.x, car.y); if (!current) return null;
    if (state.visited.size > nodes.length * .7) state.visited.clear();
    const candidates = nodes.filter(n => n.id !== current.id && !blocked(n.x, n.y) && !state.visited.has(n.id));
    let best = null, bestScore = -Infinity;
    for (const n of candidates) { const r = weightedRoute(current, n); if (!r.length) continue; const score = Math.min(1800, dist(current, n)) + rand() * 220 - r.length * 12; if (score > bestScore) { bestScore = score; best = n; } }
    if (!best) { state.routeFailures++; return null; }
    state.goal = best; state.route = weightedRoute(current, best); state.node = 0; state.replans++; state.routeTimer = 0; return best;
  }

  function replan(car) { const goal = state.goal || chooseGoal(car); if (!goal) return false; const start = nearestNode(car.x, car.y); const r = weightedRoute(start, goal); if (!r.length) { state.routeFailures++; return false; } state.route = r; state.node = 0; state.replans++; state.routeTimer = 0; return true; }

  function start(car) {
    state.enabled = true; state.state = 'START'; state.mode = 'CRUISE'; state.decisions = 0; state.distance = 0; state.stuckTime = 0; state.progressTimer = 0; state.routeTimer = 0; state.visited.clear();
    const n = safeStart(car) || nearestNode(car.x, car.y); if (!n) { state.routeFailures++; return false; }
    state.route = []; state.goal = null; state.node = 0; chooseGoal(car); return !!state.route.length;
  }

  function update(car, dt = 1 / 60) {
    if (!state.enabled) return null;
    const h = clamp(finite(dt, 1 / 60), 0, .1); state.routeTimer += h; state.progressTimer += h;
    if (!state.route.length || state.routeTimer > 3 || state.node >= state.route.length - 1) { if (!replan(car)) return state.control; }
    while (state.node + 1 < state.route.length && dist(car, state.route[state.node + 1]) < 55) { state.visited.add(state.route[state.node].id); state.node++; state.lap++; }
    const moved = Math.hypot(car.x - state.lastProgressX, car.y - state.lastProgressY); state.distance += moved;
    if (moved > 1) { state.progressTimer = 0; state.stuckTime = 0; state.lastProgressX = car.x; state.lastProgressY = car.y; }
    else { state.stuckTime += h; if (state.stuckTime > 2.5) { state.recoveries++; state.stuckTime = 0; car.vx *= .25; car.vy *= .25; replan(car); } }
    const control = chooseControl(car); state.routeTimer = Math.min(state.routeTimer, 2.9); return control;
  }

  function reset() {
    state.enabled = false; state.route = []; state.node = 0; state.goal = null; state.state = 'IDLE'; state.mode = 'IDLE'; state.control = { throttle: 0, brake: 0, steer: 0, handbrake: false }; state.visited.clear();
  }

  return { state, start, update, reset, chooseControl, replan, weightedRoute };
}
