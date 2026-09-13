export function createAIDriver({ nodes, blocked, getTraffic = () => [] }) {
  const state = {
    enabled: false,
    route: [], node: 0, goal: null,
    state: 'IDLE', mode: 'IDLE',
    sensor: { front: 999, frontLeft: 999, frontRight: 999, left: 999, right: 999 },
    dynamic: { count: 0, nearest: null },
    prediction: { safe: true, x: 0, y: 0, t: 0, ttc: Infinity, risk: 0 },
    candidates: [], chosenCandidate: 0,
    crossTrack: 0, curvature: 0, headingError: 0,
    replans: 0, recoveries: 0, safeStarts: 0,
    stuckTime: 0, contactTime: 0, progressTimer: 0, routeTimer: 0,
    lastProgressX: 0, lastProgressY: 0, distance: 0,
    visited: new Set(), lap: 0, decisions: 0,
    collisionsAvoided: 0, debug: true
  };

  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
  const wrap = a => { while (a > Math.PI) a -= Math.PI * 2; while (a < -Math.PI) a += Math.PI * 2; return a; };
  const dot = (ax, ay, bx, by) => ax * bx + ay * by;
  const rand = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
  let seed = 0x51f15e;

  function nearestNode(x, y) {
    let best = nodes[0], bd = Infinity;
    for (const n of nodes) {
      const d = (n.x - x) ** 2 + (n.y - y) ** 2;
      if (d < bd) { bd = d; best = n; }
    }
    return best;
  }

  function route(start, goal) {
    if (!start || !goal) return [];
    const q = [start], cost = new Map([[start.id, 0]]), prev = new Map([[start.id, null]]);
    for (let head = 0; head < q.length; head++) {
      const n = q[head];
      for (const m of n.links) {
        const next = cost.get(n.id) + dist(n, m);
        if (!cost.has(m.id) || next < cost.get(m.id)) {
          cost.set(m.id, next); prev.set(m.id, n); q.push(m);
        }
      }
    }
    if (!prev.has(goal.id)) return [];
    const out = [];
    for (let n = goal; n; n = prev.get(n.id)) out.push(n);
    return out.reverse();
  }

  function safePoint(n) {
    if (!n || blocked(n.x, n.y) || n.links.length < 2) return false;
    for (const a of [0, Math.PI / 2, Math.PI, -Math.PI / 2]) {
      if (blocked(n.x + Math.cos(a) * 42, n.y + Math.sin(a) * 42)) continue;
      return true;
    }
    return false;
  }

  function safeStart(car) {
    const candidates = nodes.filter(safePoint).filter(n => n.links.some(m => !blocked((n.x + m.x) * .5, (n.y + m.y) * .5)));
    if (!candidates.length) return false;
    const n = candidates[(rand() * candidates.length) | 0];
    const exits = n.links.filter(m => !blocked((n.x + m.x) * .5, (n.y + m.y) * .5));
    const next = exits[(rand() * exits.length) | 0] || n.links[0];
    car.x = n.x; car.y = n.y;
    car.a = Math.atan2(next.y - n.y, next.x - n.x);
    car.vx = car.vy = 0;
    state.safeStarts++;
    state.lastProgressX = car.x; state.lastProgressY = car.y;
    return true;
  }

  function ray(car, angle, max, step = 7) {
    for (let d = 12; d <= max; d += step) {
      if (blocked(car.x + Math.cos(angle) * d, car.y + Math.sin(angle) * d)) return d;
    }
    return max;
  }

  function sense(car) {
    const a = car.a;
    state.sensor.front = ray(car, a, 340);
    state.sensor.frontLeft = ray(car, a - .34, 300);
    state.sensor.frontRight = ray(car, a + .34, 300);
    state.sensor.left = ray(car, a - Math.PI / 2, 190);
    state.sensor.right = ray(car, a + Math.PI / 2, 190);
    return state.sensor;
  }

  function dynamicHazards(car) {
    const fx = Math.cos(car.a), fy = Math.sin(car.a);
    const hazards = [];
    for (const o of getTraffic() || []) {
      if (!o || o === car) continue;
      const dx = o.x - car.x, dy = o.y - car.y;
      const longitudinal = dot(dx, dy, fx, fy);
      const lateral = Math.abs(dot(dx, dy, -fy, fx));
      if (longitudinal < -55 || longitudinal > 420 || lateral > 58) continue;
      const ovx = Math.cos(o.a || 0) * (o.v || 0), ovy = Math.sin(o.a || 0) * (o.v || 0);
      const rvx = car.vx - ovx, rvy = car.vy - ovy;
      const closing = dot(rvx, rvy, fx, fy);
      const ttc = closing > 1 ? Math.max(0, longitudinal - 24) / closing : Infinity;
      hazards.push({ o, longitudinal, lateral, ttc, closing });
    }
    hazards.sort((a, b) => a.longitudinal - b.longitudinal);
    state.dynamic = { count: hazards.length, nearest: hazards[0] || null };
    return hazards;
  }

  function segmentInfo(car) {
    if (state.route.length < 2) return { heading: car.a, cross: 0, curvature: 0, distance: Infinity, index: 0 };
    let best = null;
    const from = Math.max(0, state.node - 2), to = Math.min(state.route.length - 2, state.node + 4);
    for (let i = from; i <= to; i++) {
      const a = state.route[i], b = state.route[i + 1];
      const dx = b.x - a.x, dy = b.y - a.y, len2 = dx * dx + dy * dy || 1;
      const t = clamp(((car.x - a.x) * dx + (car.y - a.y) * dy) / len2, 0, 1);
      const px = a.x + dx * t, py = a.y + dy * t;
      const d = Math.hypot(car.x - px, car.y - py);
      if (!best || d < best.distance) best = { a, b, heading: Math.atan2(dy, dx), cross: ((car.x - px) * (-dy) + (car.y - py) * dx) / Math.sqrt(len2), distance: d, index: i };
    }
    const i = best.index;
    const p1 = state.route[i], p2 = state.route[Math.min(state.route.length - 1, i + 1)];
    const p3 = state.route[Math.min(state.route.length - 1, i + 2)];
    const h1 = Math.atan2(p2.y - p1.y, p2.x - p1.x);
    const h2 = Math.atan2(p3.y - p2.y, p3.x - p2.x);
    return { ...best, curvature: Math.abs(wrap(h2 - h1)), nextHeading: h2 };
  }

  function lookahead(car, meters) {
    if (!state.route.length) return nearestNode(car.x, car.y);
    let i = Math.min(state.node, state.route.length - 1);
    let p = state.route[i], remain = meters;
    while (i + 1 < state.route.length) {
      const n = state.route[i + 1], len = dist(p, n) || 1;
      if (len >= remain) return { x: p.x + (n.x - p.x) * remain / len, y: p.y + (n.y - p.y) * remain / len };
      remain -= len; p = n; i++;
    }
    return p;
  }

  function simulate(car, seconds, steer, throttle, brake = 0) {
    const c = { x: car.x, y: car.y, a: car.a, vx: car.vx, vy: car.vy };
    const points = [];
    const steps = Math.max(2, Math.ceil(seconds / .06));
    const h = seconds / steps;
    let minWall = 999, collision = false, collisionT = seconds;
    for (let i = 0; i < steps; i++) {
      const fx = Math.cos(c.a), fy = Math.sin(c.a), rx = -fy, ry = fx;
      const fs = dot(c.vx, c.vy, fx, fy), ls = dot(c.vx, c.vy, rx, ry);
      c.vx += fx * throttle * 430 * h; c.vy += fy * throttle * 430 * h;
      if (brake > 0) { const amount = Math.min(Math.abs(fs), 760 * brake * h); c.vx -= fx * Math.sign(fs || 1) * amount; c.vy -= fy * Math.sign(fs || 1) * amount; }
      c.vx -= rx * ls * Math.min(1, 10.5 * h); c.vy -= ry * ls * Math.min(1, 10.5 * h);
      c.vx *= Math.pow(.993, h * 60); c.vy *= Math.pow(.993, h * 60);
      const forward = dot(c.vx, c.vy, fx, fy);
      c.a += steer * 1.9 * clamp(Math.abs(forward) / 55, 0, 1) * h * (forward >= 0 ? 1 : -1);
      const nx = c.x + c.vx * h, ny = c.y + c.vy * h;
      const wall = Math.min(ray({ x: c.x, y: c.y, a: c.a }, c.a, 70, 5), ray({ x: c.x, y: c.y, a: c.a }, c.a + .3, 55, 5), ray({ x: c.x, y: c.y, a: c.a }, c.a - .3, 55, 5));
      minWall = Math.min(minWall, wall);
      if (blocked(nx, ny)) { collision = true; collisionT = i * h; break; }
      c.x = nx; c.y = ny;
      if (i % 2 === 0) points.push({ x: c.x, y: c.y });
    }
    return { safe: !collision, collisionT, x: c.x, y: c.y, points, minWall, speed: Math.hypot(c.vx, c.vy) };
  }

  function candidateScore(car, candidate, seg, hazards) {
    const p = simulate(car, candidate.horizon, candidate.steer, candidate.throttle, candidate.brake);
    const target = lookahead(car, Math.max(100, candidate.horizon * 130));
    const progress = -Math.hypot(p.x - target.x, p.y - target.y);
    const centerPenalty = Math.abs(seg.cross + Math.sin(candidate.steer) * candidate.horizon * Math.max(30, Math.hypot(car.vx, car.vy))) * .7;
    let hazardPenalty = 0;
    for (const h of hazards.slice(0, 3)) {
      const dx = h.o.x - p.x, dy = h.o.y - p.y;
      hazardPenalty += Math.max(0, 180 - Math.hypot(dx, dy)) * 2;
    }
    const wallPenalty = Math.max(0, 70 - p.minWall) * 3;
    const collisionPenalty = p.safe ? 0 : 100000 + (candidate.horizon - p.collisionT) * 5000;
    const comfort = Math.abs(candidate.steer) * 70 + candidate.brake * 50;
    return { ...candidate, ...p, score: progress - centerPenalty - hazardPenalty - wallPenalty - collisionPenalty - comfort };
  }

  function chooseControl(car) {
    const s = sense(car), hazards = dynamicHazards(car), seg = segmentInfo(car);
    const v = Math.hypot(car.vx, car.vy);
    const lookDistance = clamp(105 + v * .48 + seg.curvature * 75, 105, 270);
    const look = lookahead(car, lookDistance);
    const desired = Math.atan2(look.y - car.y, look.x - car.x);
    const headingError = wrap(desired - car.a);
    state.headingError = headingError;

    const center = clamp(seg.cross / 60, -1.3, 1.3);
    const baseSteer = clamp(headingError * 1.65 - center * .9, -1, 1);
    let desiredSpeed = 420 - seg.curvature * 175 - Math.min(70, Math.abs(seg.cross) * .65);
    if (Math.abs(headingError) > .75) desiredSpeed -= 80;
    if (hazards[0]?.ttc < 2.6) desiredSpeed = Math.min(desiredSpeed, Math.max(55, v - (2.6 - hazards[0].ttc) * 125));
    if (s.front < 120) desiredSpeed = Math.min(desiredSpeed, Math.max(35, s.front * 2.1));

    const candidates = [];
    for (const steerOffset of [-.9, -.45, 0, .45, .9]) {
      for (const throttle of [0, .45, 1]) {
        const brake = throttle === 0 ? clamp((v - desiredSpeed) / 120, 0, 1) : 0;
        candidates.push(candidateScore(car, { steer: clamp(baseSteer + steerOffset * .42, -1, 1), throttle, brake, horizon: v > 260 ? .85 : 1.05 }, seg, hazards));
      }
    }
    candidates.sort((a, b) => b.score - a.score);
    const best = candidates[0];
    state.candidates = candidates.slice(0, 7).map((c, i) => ({ rank: i + 1, steer: c.steer, throttle: c.throttle, brake: c.brake, safe: c.safe, score: Math.round(c.score), collisionT: c.collisionT }));
    state.chosenCandidate = 0;

    let mode = 'CRUISE';
    if (!best.safe) mode = 'REPLAN';
    else if (best.brake > .2 || s.front < 90) mode = 'BRAKE';
    else if (hazards[0]?.ttc < 1.5) mode = 'AVOID';
    else if (seg.curvature > .45) mode = 'CORNER';
    else if (Math.abs(seg.cross) > 70) mode = 'LANE_CORRECT';
    state.mode = state.state = mode;

    state.prediction = {
      safe: best.safe, x: best.x, y: best.y, t: best.collisionT,
      ttc: hazards[0]?.ttc ?? Infinity,
      risk: clamp((1 - Math.min(1, best.minWall / 100)) + (best.safe ? 0 : 1), 0, 2)
    };
    state.crossTrack = seg.cross || 0;
    state.curvature = seg.curvature || 0;
    return { throttle: best.throttle, brake: best.brake, steer: best.steer, handbrake: Math.abs(headingError) > 1.9 && v > 210 };
  }

  function chooseGoal(car) {
    const origin = nearestNode(car.x, car.y);
    const pool = nodes.filter(n => n.links.length && !state.visited.has(n.id) && dist(n, origin) > 680 && safePoint(n));
    const list = pool.length ? pool : nodes.filter(n => n.links.length && safePoint(n));
    return list.length ? list[(rand() * list.length) | 0] : origin;
  }

  function ensureRoute(car) {
    const current = nearestNode(car.x, car.y), end = state.route.at(-1);
    const reached = end && dist(car, end) < 55;
    const offRoad = Math.abs(state.crossTrack) > 135;
    if (!state.route.length || reached || state.routeTimer > 10 || state.node >= state.route.length || offRoad) {
      const goal = chooseGoal(car);
      state.route = route(current, goal);
      state.node = Math.min(1, Math.max(0, state.route.length - 1));
      state.goal = goal; state.routeTimer = 0; state.replans++;
      if (goal) state.visited.add(goal.id);
      if (state.visited.size >= 24) { state.visited.clear(); state.lap++; }
    }
    while (state.node < state.route.length - 1 && dist(car, state.route[state.node]) < 48) state.node++;
  }

  function recover(car, reason = 'stuck') {
    const here = nearestNode(car.x, car.y);
    const candidates = nodes.filter(n => safePoint(n) && dist(n, car) > 120 && dist(n, car) < 500);
    const n = candidates[(rand() * candidates.length) | 0] || here;
    if (!n) return;
    const next = n.links.find(m => !blocked((n.x + m.x) * .5, (n.y + m.y) * .5)) || n.links[0] || n;
    car.x = n.x; car.y = n.y; car.a = Math.atan2(next.y - n.y, next.x - n.x); car.vx = car.vy = 0;
    state.route = []; state.node = 0; state.recoveries++; state.replans++; state.stuckTime = 0; state.contactTime = 0;
    state.mode = state.state = reason === 'collision' ? 'RECOVER' : 'REPLAN';
  }

  function start(car) {
    state.enabled = true;
    safeStart(car);
    ensureRoute(car);
    state.mode = state.state = 'CRUISE';
    return state;
  }

  function update(car, dt) {
    if (!state.enabled) return null;
    state.routeTimer += dt; state.progressTimer += dt;
    ensureRoute(car);
    const control = chooseControl(car);
    state.decisions++;
    const moved = Math.hypot(car.x - state.lastProgressX, car.y - state.lastProgressY);
    if (state.progressTimer >= .75) {
      if (moved < 16 && Math.hypot(car.vx, car.vy) < 35) state.stuckTime += state.progressTimer;
      else state.stuckTime = Math.max(0, state.stuckTime - state.progressTimer * .7);
      state.lastProgressX = car.x; state.lastProgressY = car.y; state.progressTimer = 0;
    }
    if (state.sensor.front < 27) state.contactTime += dt; else state.contactTime = Math.max(0, state.contactTime - dt * 2);
    if (state.prediction.safe === false && state.prediction.t < .35) state.collisionsAvoided++;
    if (state.stuckTime > 1.6) recover(car, 'stuck');
    if (state.contactTime > .3) recover(car, 'collision');
    state.distance += Math.hypot(car.vx, car.vy) * dt;
    return control;
  }

  return { state, start, update, recover: car => recover(car, 'manual') };
}
