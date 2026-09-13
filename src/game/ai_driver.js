export function createAIDriver({ nodes, blocked, getTraffic = () => [] }) {
  const state = {
    enabled: false,
    route: [],
    node: 0,
    goal: null,
    state: 'IDLE',
    sensor: { front: 999, frontLeft: 999, frontRight: 999, left: 999, right: 999 },
    prediction: { ttc: Infinity, safe: true, x: 0, y: 0 },
    crossTrack: 0,
    curvature: 0,
    replans: 0,
    recoveries: 0,
    safeStarts: 0,
    progress: 0,
    stuckTime: 0,
    contactTime: 0,
    lastProgressX: 0,
    lastProgressY: 0,
    progressTimer: 0,
    decisionTimer: 0,
    routeTimer: 0,
    visited: new Set(),
    lap: 0,
    debug: true
  };

  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
  const wrap = a => { while (a > Math.PI) a -= Math.PI * 2; while (a < -Math.PI) a += Math.PI * 2; return a; };
  const dot = (ax, ay, bx, by) => ax * bx + ay * by;

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
    const q = [start], prev = new Map([[start.id, null]]);
    for (let head = 0; head < q.length; head++) {
      const n = q[head];
      if (n.id === goal.id) break;
      for (const m of n.links) if (!prev.has(m.id)) { prev.set(m.id, n); q.push(m); }
    }
    if (!prev.has(goal.id)) return [];
    const out = [];
    for (let n = goal; n; n = prev.get(n.id)) out.push(n);
    return out.reverse();
  }

  function chooseGoal(car) {
    const origin = nearestNode(car.x, car.y);
    const far = nodes.filter(n => n.links.length && !state.visited.has(n.id) && dist(n, origin) > 720);
    const pool = far.length ? far : nodes.filter(n => n.links.length);
    return pool.length ? pool[(Math.random() * pool.length) | 0] : origin;
  }

  function safeStart(car) {
    const candidates = nodes.filter(n => n.links.length >= 2 && !blocked(n.x, n.y));
    if (!candidates.length) return false;
    const n = candidates[(Math.random() * candidates.length) | 0];
    const next = n.links[(Math.random() * n.links.length) | 0];
    car.x = n.x; car.y = n.y;
    car.a = Math.atan2(next.y - n.y, next.x - n.x);
    car.vx = car.vy = 0;
    state.safeStarts++;
    state.lastProgressX = car.x;
    state.lastProgressY = car.y;
    return true;
  }

  function ray(car, angle, max, step = 8) {
    for (let d = 10; d <= max; d += step) {
      if (blocked(car.x + Math.cos(angle) * d, car.y + Math.sin(angle) * d)) return d;
    }
    return max;
  }

  function sense(car) {
    const a = car.a;
    state.sensor.front = ray(car, a, 300);
    state.sensor.frontLeft = ray(car, a - .38, 270);
    state.sensor.frontRight = ray(car, a + .38, 270);
    state.sensor.left = ray(car, a - Math.PI / 2, 180);
    state.sensor.right = ray(car, a + Math.PI / 2, 180);
    return state.sensor;
  }

  function dynamicHazards(car, horizon = 2.0) {
    const fx = Math.cos(car.a), fy = Math.sin(car.a);
    const hazards = [];
    for (const o of getTraffic() || []) {
      const dx = o.x - car.x, dy = o.y - car.y;
      const longitudinal = dot(dx, dy, fx, fy);
      const lateral = Math.abs(dot(dx, dy, -fy, fx));
      if (longitudinal > -30 && longitudinal < 330 && lateral < 48) {
        const ovx = Math.cos(o.a || 0) * (o.v || 0);
        const ovy = Math.sin(o.a || 0) * (o.v || 0);
        const rvx = car.vx - ovx, rvy = car.vy - ovy;
        const closing = dot(rvx, rvy, fx, fy);
        const ttc = closing > 1 ? longitudinal / closing : Infinity;
        hazards.push({ o, longitudinal, lateral, ttc });
      }
    }
    hazards.sort((a, b) => a.longitudinal - b.longitudinal);
    return { hazards, nearest: hazards[0] || null };
  }

  function segmentInfo(car) {
    if (state.route.length < 2) return { heading: car.a, cross: 0, curvature: 0, distance: Infinity };
    let best = null;
    for (let i = Math.max(0, state.node - 1); i < Math.min(state.route.length - 1, state.node + 3); i++) {
      const a = state.route[i], b = state.route[i + 1];
      const dx = b.x - a.x, dy = b.y - a.y, len2 = dx * dx + dy * dy || 1;
      const t = clamp(((car.x - a.x) * dx + (car.y - a.y) * dy) / len2, 0, 1);
      const px = a.x + dx * t, py = a.y + dy * t;
      const d = Math.hypot(car.x - px, car.y - py);
      if (!best || d < best.distance) best = { a, b, heading: Math.atan2(dy, dx), cross: ((car.x - px) * (-dy) + (car.y - py) * dx) / Math.sqrt(len2), distance: d, index: i };
    }
    const i = best?.index ?? 0;
    const p0 = state.route[Math.max(0, i - 1)], p1 = state.route[i], p2 = state.route[Math.min(state.route.length - 1, i + 1)], p3 = state.route[Math.min(state.route.length - 1, i + 2)];
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

  function predict(car, seconds, steer, throttle) {
    const c = { x: car.x, y: car.y, a: car.a, vx: car.vx, vy: car.vy };
    const steps = Math.max(1, Math.ceil(seconds / .08));
    const h = seconds / steps;
    for (let i = 0; i < steps; i++) {
      const fx = Math.cos(c.a), fy = Math.sin(c.a), rx = -fy, ry = fx;
      const fs = c.vx * fx + c.vy * fy, ls = c.vx * rx + c.vy * ry;
      c.vx += fx * throttle * 430 * h; c.vy += fy * throttle * 430 * h;
      c.vx -= rx * ls * Math.min(1, 10.5 * h); c.vy -= ry * ls * Math.min(1, 10.5 * h);
      c.vx *= Math.pow(.993, h * 60); c.vy *= Math.pow(.993, h * 60);
      const forward = c.vx * fx + c.vy * fy;
      c.a += steer * 1.9 * clamp(Math.abs(forward) / 55, 0, 1) * h * (forward >= 0 ? 1 : -1);
      const nx = c.x + c.vx * h, ny = c.y + c.vy * h;
      if (blocked(nx, ny)) return { safe: false, x: nx, y: ny, t: i * h };
      c.x = nx; c.y = ny;
    }
    return { safe: true, x: c.x, y: c.y, t: seconds };
  }

  function chooseControl(car, dt) {
    const s = sense(car);
    const dyn = dynamicHazards(car);
    const seg = segmentInfo(car);
    const v = Math.hypot(car.vx, car.vy);
    const lookDistance = clamp(95 + v * .42 + seg.curvature * 55, 95, 230);
    const look = lookahead(car, lookDistance);
    const desired = Math.atan2(look.y - car.y, look.x - car.x);
    const headingError = wrap(desired - car.a);
    const centerCorrection = clamp(seg.cross / 55, -1.25, 1.25);

    let steer = clamp(headingError * 1.7 - centerCorrection * .85, -1, 1);
    let desiredSpeed = 410;
    const corner = seg.curvature;
    desiredSpeed -= corner * 150;
    if (Math.abs(seg.cross) > 55) desiredSpeed -= 55;

    let mode = 'CRUISE';
    const wallThreat = Math.min(s.front, s.frontLeft * 1.08, s.frontRight * 1.08);
    if (wallThreat < 120) {
      const left = s.frontLeft + s.left * .65;
      const right = s.frontRight + s.right * .65;
      const escape = left > right ? -1 : 1;
      steer = clamp(steer + escape * clamp((120 - wallThreat) / 90, 0, 1) * .9, -1, 1);
      desiredSpeed = Math.min(desiredSpeed, 300 - (120 - wallThreat) * 2.6);
      mode = wallThreat < 55 ? 'AVOID' : 'BRAKE';
    }

    if (dyn.nearest && dyn.nearest.ttc < 2.4) {
      desiredSpeed = Math.min(desiredSpeed, Math.max(55, v - (2.4 - dyn.nearest.ttc) * 150));
      if (dyn.nearest.lateral < 34 && dyn.nearest.ttc < 1.4) {
        const side = dyn.hazards.some(h => h.lateral < 34 && h.o !== dyn.nearest.o) ? -1 : (Math.random() < .5 ? -1 : 1);
        steer = clamp(steer + side * .65, -1, 1);
        mode = 'AVOID';
      } else mode = 'TRAFFIC';
    }

    const pStraight = predict(car, 1.0, steer, 1);
    const pBrake = predict(car, 1.0, steer, 0);
    state.prediction = { ...pStraight, ttc: dyn.nearest?.ttc ?? Infinity };
    if (!pStraight.safe) {
      desiredSpeed = Math.min(desiredSpeed, 90);
      const leftTest = predict(car, .7, clamp(steer - .8, -1, 1), .3);
      const rightTest = predict(car, .7, clamp(steer + .8, -1, 1), .3);
      if (leftTest.safe && !rightTest.safe) steer = clamp(steer - .8, -1, 1);
      else if (rightTest.safe && !leftTest.safe) steer = clamp(steer + .8, -1, 1);
      else if (pBrake.safe) { desiredSpeed = 0; mode = 'EMERGENCY_BRAKE'; }
      else mode = 'REPLAN';
    }

    if (pBrake.safe && !pStraight.safe) desiredSpeed = Math.min(desiredSpeed, 150);
    const brake = v > desiredSpeed + 16 ? clamp((v - desiredSpeed) / 120, 0, 1) : 0;
    const throttle = brake > .2 || mode === 'EMERGENCY_BRAKE' ? 0 : v < desiredSpeed - 14 ? 1 : .35;
    state.state = mode;
    state.crossTrack = seg.cross || 0;
    state.curvature = corner;
    return { throttle, brake, steer, handbrake: Math.abs(headingError) > 1.75 && v > 190 };
  }

  function ensureRoute(car) {
    const current = nearestNode(car.x, car.y);
    const end = state.route.at(-1);
    const reached = end && dist(car, end) < 52;
    if (!state.route.length || reached || state.routeTimer > 8 || state.node >= state.route.length) {
      const goal = chooseGoal(car);
      state.route = route(current, goal);
      state.node = Math.min(1, Math.max(0, state.route.length - 1));
      state.goal = goal;
      state.routeTimer = 0;
      state.replans++;
      if (goal) state.visited.add(goal.id);
      if (state.visited.size >= 24) { state.visited.clear(); state.lap++; }
    }
    while (state.node < state.route.length - 1 && dist(car, state.route[state.node]) < 50) state.node++;
  }

  function recover(car, reason = 'stuck') {
    const here = nearestNode(car.x, car.y);
    const options = nodes.filter(n => n.links.length >= 2 && dist(n, car) > 120 && dist(n, car) < 420 && !blocked(n.x, n.y));
    const n = options[(Math.random() * options.length) | 0] || here;
    if (!n) return;
    const next = n.links[0] || n;
    car.x = n.x; car.y = n.y; car.a = Math.atan2(next.y - n.y, next.x - n.x); car.vx = car.vy = 0;
    state.route = []; state.node = 0; state.recoveries++; state.replans++; state.stuckTime = 0; state.contactTime = 0;
    state.state = reason === 'collision' ? 'RECOVER' : 'REPLAN';
  }

  function update(car, dt) {
    if (!state.enabled) return null;
    state.routeTimer += dt; state.decisionTimer += dt; state.progressTimer += dt;
    ensureRoute(car);
    const control = chooseControl(car, dt);
    const moved = Math.hypot(car.x - state.lastProgressX, car.y - state.lastProgressY);
    if (state.progressTimer > .8) {
      if (moved < 18 && Math.hypot(car.vx, car.vy) < 35) state.stuckTime += state.progressTimer;
      else state.stuckTime = Math.max(0, state.stuckTime - state.progressTimer * .5);
      state.lastProgressX = car.x; state.lastProgressY = car.y; state.progressTimer = 0;
    }
    if (state.sensor.front < 30) state.contactTime += dt; else state.contactTime = Math.max(0, state.contactTime - dt * 2);
    if (state.stuckTime > 1.8 || state.contactTime > .32) recover(car, state.contactTime > .32 ? 'collision' : 'stuck');
    return control;
  }

  function start(car) { state.enabled = true; safeStart(car); state.route = []; ensureRoute(car); }
  function stop() { state.enabled = false; }
  function reset(car) { state.route = []; state.node = 0; state.visited.clear(); state.replans = 0; state.recoveries = 0; state.stuckTime = 0; state.contactTime = 0; if (state.enabled) start(car); }
  function debugDraw(ctx, iso, car) {
    if (!state.enabled || !state.debug) return;
    ctx.save();
    const path = state.route.slice(state.node);
    if (path.length > 1) {
      ctx.strokeStyle = 'rgba(232,184,74,.55)'; ctx.lineWidth = 2; ctx.beginPath();
      path.forEach((n, i) => { const p = iso(n.x, n.y); i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y); }); ctx.stroke();
    }
    const look = lookahead(car, clamp(100 + Math.hypot(car.vx, car.vy) * .4, 100, 220));
    const lp = iso(look.x, look.y), cp = iso(car.x, car.y);
    ctx.strokeStyle = '#e8b84a'; ctx.setLineDash([5,5]); ctx.beginPath(); ctx.moveTo(cp.x, cp.y); ctx.lineTo(lp.x, lp.y); ctx.stroke(); ctx.setLineDash([]);
    const angles = [0, -.38, .38, -Math.PI/2, Math.PI/2];
    const vals = [state.sensor.front, state.sensor.frontLeft, state.sensor.frontRight, state.sensor.left, state.sensor.right];
    angles.forEach((ang, i) => { const a = car.a + ang, p = iso(car.x + Math.cos(a) * Math.min(vals[i], 180), car.y + Math.sin(a) * Math.min(vals[i], 180)); ctx.strokeStyle = i === 0 ? 'rgba(212,82,58,.7)' : 'rgba(154,160,168,.35)'; ctx.beginPath(); ctx.moveTo(cp.x, cp.y); ctx.lineTo(p.x,p.y); ctx.stroke(); });
    const pred = iso(state.prediction.x, state.prediction.y); ctx.fillStyle = '#d4523a'; ctx.beginPath(); ctx.arc(pred.x,pred.y,5,0,Math.PI*2); ctx.fill();
    ctx.restore();
  }

  return { state, start, stop, reset, update, debugDraw, safeStart };
}
