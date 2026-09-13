import './style.css';
import { WORLD } from './game/world.js';
import { createTrafficSystem } from './game/traffic.js';
import { createMissionSystem } from './game/missions.js';
import { createPeopleSystem } from './game/people.js';
import { createEventSystem } from './game/events.js';
import { createAIDriver } from './game/ai_driver.js';

const app = document.querySelector('#app');
app.innerHTML = `<main class="shell"><header class="hud"><div class="brand"><span>LOW</span>TOWN <b>// NIGHT SHIFT</b></div><div class="status"><i></i> FREE ROAM <strong id="speed">000</strong> KM/H</div></header><section class="game-wrap"><canvas id="game"></canvas><div class="mission"><small id="job-id">JOB 01</small><strong id="job-title">SHAKE THE NIGHT</strong><span id="job-text">Drive to the amber marker.</span></div><div class="hint">WASD / ARROWS · SPACE HANDBRAKE · R RESET · N NEXT JOB</div><div class="toast" id="toast">ENGINE READY</div><div class="touch" aria-label="Touch controls"><button data-key="arrowup">▲</button><div><button data-key="arrowleft">◀</button><button data-key=" ">■</button><button data-key="arrowright">▶</button></div><button data-key="arrowdown">▼</button></div></section></main>`;

const canvas = document.querySelector('#game');
const ctx = canvas.getContext('2d');
const speedEl = document.querySelector('#speed');
const toast = document.querySelector('#toast');
const jobId = document.querySelector('#job-id');
const jobTitle = document.querySelector('#job-title');
const jobText = document.querySelector('#job-text');
const keys = new Set();

addEventListener('keydown', e => {
  keys.add(e.key.toLowerCase());
  if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright', ' ', 'n', 'r'].includes(e.key.toLowerCase())) e.preventDefault();
});
addEventListener('keyup', e => keys.delete(e.key.toLowerCase()));
document.querySelectorAll('[data-key]').forEach(button => {
  const key = button.dataset.key;
  const down = e => { e.preventDefault(); keys.add(key); button.classList.add('pressed'); };
  const up = e => { e.preventDefault(); keys.delete(key); button.classList.remove('pressed'); };
  button.addEventListener('pointerdown', down);
  button.addEventListener('pointerup', up);
  button.addEventListener('pointercancel', up);
  button.addEventListener('pointerleave', up);
});

const buildings = WORLD.buildings;
const lamps = WORLD.lamps;
const GRID = 160;
const testMode = new URLSearchParams(location.search).has('autotest');
const S = {
  car: { x: 0, y: 0, a: 0, vx: 0, vy: 0 },
  cam: { x: 0, y: 0 },
  target: WORLD.mission,
  t: 0,
  done: false,
  damage: 0,
  collisions: 0,
  trafficHits: 0,
  stuck: 0,
  maxSpeed: 0,
  distance: 0,
  missionReward: 0,
  collisionCooldown: 0,
  test: { active: testMode }
};

function resize() {
  const r = canvas.getBoundingClientRect();
  const d = Math.min(devicePixelRatio || 1, 2);
  canvas.width = r.width * d;
  canvas.height = r.height * d;
  ctx.setTransform(d, 0, 0, d, 0, 0);
}
addEventListener('resize', resize);
resize();

function iso(x, y) {
  return {
    x: canvas.clientWidth / 2 + (x - S.cam.x) * .78 + (y - S.cam.y) * .42,
    y: canvas.clientHeight / 2 + (y - S.cam.y) * .42 - (x - S.cam.x) * .78
  };
}
function poly(points, fill, stroke) {
  ctx.beginPath();
  points.forEach((p, i) => i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y));
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();
  if (stroke) { ctx.strokeStyle = stroke; ctx.stroke(); }
}
function roads() {
  ctx.fillStyle = '#14161a';
  ctx.fillRect(0, 0, canvas.clientWidth, canvas.clientHeight);
  for (let i = -1600; i <= 1600; i += GRID) {
    const a = iso(i, -1700), b = iso(i, 1700), c = iso(-1700, i), d = iso(1700, i);
    ctx.strokeStyle = '#272a2f'; ctx.lineWidth = 92;
    ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(c.x, c.y); ctx.lineTo(d.x, d.y); ctx.stroke();
  }
  ctx.setLineDash([18, 20]); ctx.lineWidth = 2; ctx.strokeStyle = 'rgba(224,154,62,.28)';
  for (let i = -1600; i <= 1600; i += GRID) {
    const a = iso(i, -1700), b = iso(i, 1700), c = iso(-1700, i), d = iso(1700, i);
    ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(c.x, c.y); ctx.lineTo(d.x, d.y); ctx.stroke();
  }
  ctx.setLineDash([]);
}
function building(x, y, w, h) {
  const top = [iso(x, y), iso(x + w, y), iso(x + w, y + h), iso(x, y + h)];
  const f = top.map(p => ({ x: p.x, y: p.y - 70 }));
  poly(f, '#34373c', '#111317');
  poly([f[0], f[1], top[1], top[0]], '#26292e');
  poly([f[1], f[2], top[2], top[1]], '#1e2125');
  for (let yy = 18; yy < h; yy += 38) for (let xx = 22; xx < w; xx += 48) {
    if (((xx + yy) / 38 | 0) % 3 === 0) continue;
    const p = iso(x + xx, y + yy);
    ctx.fillStyle = 'rgba(224,154,62,.32)'; ctx.fillRect(p.x - 3, p.y - 2, 6, 4);
  }
}
function lamp(x, y) {
  const p = iso(x, y);
  ctx.strokeStyle = '#55585d'; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x, p.y - 35); ctx.stroke();
  ctx.fillStyle = '#e09a3e'; ctx.beginPath(); ctx.arc(p.x, p.y - 39, 4, 0, Math.PI * 2); ctx.fill();
}
function target() {
  const p = iso(S.target.x, S.target.y), r = 18 + Math.sin(S.t * 5) * 4;
  ctx.strokeStyle = '#e09a3e'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, Math.PI * 2); ctx.stroke();
  ctx.fillStyle = 'rgba(224,154,62,.18)'; ctx.fill();
  ctx.fillStyle = '#e09a3e'; ctx.font = 'bold 10px monospace'; ctx.textAlign = 'center'; ctx.fillText('DROP', p.x, p.y - 27);
}
function car() {
  const p = iso(S.car.x, S.car.y);
  ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(-S.car.a - .15);
  ctx.shadowColor = 'rgba(0,0,0,.65)'; ctx.shadowBlur = 16; ctx.fillStyle = '#08090b'; ctx.fillRect(-22, -12, 44, 24); ctx.shadowBlur = 0;
  ctx.fillStyle = '#e8b84a'; ctx.fillRect(-18, -9, 36, 18); ctx.fillStyle = '#15171b'; ctx.fillRect(-9, -7, 16, 14);
  ctx.fillStyle = keys.has('s') || keys.has('arrowdown') ? '#f06a4d' : '#d4523a'; ctx.fillRect(13, -7, 5, 4); ctx.fillRect(13, 3, 5, 4); ctx.restore();
}
function speed() { return Math.hypot(S.car.vx, S.car.vy); }
function blocked(x, y) {
  const r = 18;
  return buildings.some(([bx, by, bw, bh]) => x > bx - r && x < bx + bw + r && y > by - r && y < by + bh + r);
}
function openRoad(x, y) { return !blocked(x, y); }
function corridor(a, b) {
  for (let i = 1; i <= 16; i++) { const t = i / 16; if (blocked(a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t)) return false; }
  return true;
}
function buildRoadGraph() {
  const nodes = [], map = new Map();
  for (let x = -1280; x <= 1280; x += GRID) for (let y = -1280; y <= 1280; y += GRID) {
    if (openRoad(x, y)) { const n = { x, y, id: nodes.length, links: [] }; nodes.push(n); map.set(`${x},${y}`, n); }
  }
  for (const n of nodes) for (const [dx, dy] of [[GRID, 0], [-GRID, 0], [0, GRID], [0, -GRID]]) {
    const m = map.get(`${n.x + dx},${n.y + dy}`); if (m && corridor(n, m)) n.links.push(m);
  }
  return nodes;
}
const roadNodes = buildRoadGraph();
function nearestNode(x, y) {
  let best = roadNodes[0], bd = Infinity;
  for (const n of roadNodes) { const d = (n.x - x) ** 2 + (n.y - y) ** 2; if (d < bd) { bd = d; best = n; } }
  return best;
}
function drive(dt, throttle, brake, steer, handbrake = false) {
  const c = S.car; const sub = Math.max(1, Math.ceil(dt / (1 / 120))); const h = dt / sub;
  for (let n = 0; n < sub; n++) {
    const fx = Math.cos(c.a), fy = Math.sin(c.a), rx = -fy, ry = fx;
    const fs = c.vx * fx + c.vy * fy, ls = c.vx * rx + c.vy * ry;
    c.vx += fx * throttle * 460 * h; c.vy += fy * throttle * 460 * h;
    if (brake) { const amount = fs > 10 ? Math.min(Math.abs(fs), 760 * brake * h) : 260 * brake * h; c.vx -= fx * Math.sign(fs || 1) * amount; c.vy -= fy * Math.sign(fs || 1) * amount; }
    const grip = handbrake ? 2 : 10.5, correction = Math.min(1, grip * h);
    c.vx -= rx * ls * correction; c.vy -= ry * ls * correction;
    const drag = handbrake ? .972 : .993; c.vx *= Math.pow(drag, h * 60); c.vy *= Math.pow(drag, h * 60);
    const cur = c.vx * fx + c.vy * fy, authority = Math.min(1, Math.abs(cur) / 55);
    c.a += steer * (handbrake ? 1.65 : 1.9) * authority * h * (cur >= 0 ? 1 : -1);
    const nfx = Math.cos(c.a), nfy = Math.sin(c.a), forward = c.vx * nfx + c.vy * nfy;
    if (forward > 520) { const e = forward - 520; c.vx -= nfx * e; c.vy -= nfy * e; }
    if (forward < -180) { const e = forward + 180; c.vx -= nfx * e; c.vy -= nfy * e; }
    const nx = c.x + c.vx * h, ny = c.y + c.vy * h;
    if (!blocked(nx, ny)) { c.x = nx; c.y = ny; }
    else {
      const oldV = speed();
      if (!blocked(nx, c.y)) c.x = nx; else if (!blocked(c.x, ny)) c.y = ny; else { c.vx *= -.2; c.vy *= -.2; }
      if (S.collisionCooldown <= 0) { S.collisions++; S.damage += Math.min(3, Math.max(.5, oldV / 220)); S.collisionCooldown = .28; toast.textContent = 'BODY HIT'; }
    }
  }
}

const traffic = createTrafficSystem({ nodes: roadNodes, blocked });
const people = createPeopleSystem({ nodes: roadNodes, blocked });
const events = createEventSystem({ nodes: roadNodes });
const missions = createMissionSystem(WORLD);
const ai = createAIDriver({ nodes: roadNodes, blocked, getTraffic: () => traffic.cars });

function refreshMission() {
  const m = missions.state(); const idx = missions.templates.findIndex(t => t.id === m.id);
  S.target = m.target; jobId.textContent = `JOB 0${idx + 1}`; jobTitle.textContent = m.title; jobText.textContent = `${m.text}  $${m.reward}`;
}
function trafficCollisions() {
  const now = performance.now();
  for (const n of traffic.cars) {
    const dx = n.x - S.car.x, dy = n.y - S.car.y, d = Math.hypot(dx, dy);
    if (d < 34 && now - (n.hitAt || 0) > 550) {
      const nx = dx / (d || 1), ny = dy / (d || 1), impact = Math.max(20, speed() - n.v);
      S.car.vx += nx * impact * .16; S.car.vy += ny * impact * .16; n.v = Math.max(15, n.v - impact * .1); n.hitAt = now;
      S.trafficHits++; S.damage += Math.min(3, impact / 90); toast.textContent = 'TRAFFIC HIT';
    }
  }
}
function reset() {
  S.car = { x: 0, y: 0, a: 0, vx: 0, vy: 0 }; S.cam = { x: 0, y: 0 }; S.done = false; S.damage = 0; S.collisions = 0; S.trafficHits = 0; S.stuck = 0; S.maxSpeed = 0; S.distance = 0; S.collisionCooldown = 0;
  if (S.test.active) ai.start(S.car);
  else { ai.state.enabled = false; const n = nearestNode(S.car.x, S.car.y); if (n?.links.length) { const next = n.links[0]; S.car.x = n.x; S.car.y = n.y; S.car.a = Math.atan2(next.y - n.y, next.x - n.x); } }
  toast.textContent = 'ENGINE READY'; toast.classList.remove('hot'); refreshMission();
}

refreshMission();
if (testMode) reset();

function update(dt) {
  S.collisionCooldown = Math.max(0, S.collisionCooldown - dt);
  if (keys.has('n')) { missions.next(); S.done = false; keys.delete('n'); refreshMission(); toast.textContent = 'NEW JOB'; }
  if (keys.has('r')) { reset(); keys.delete('r'); }
  if (S.test.active) {
    const control = ai.update(S.car, dt);
    if (control) drive(dt, control.throttle, control.brake, control.steer, control.handbrake);
    S.distance = ai.state.distance;
    S.test.recoveries = ai.state.recoveries;
  } else {
    const u = keys.has('w') || keys.has('arrowup'), d = keys.has('s') || keys.has('arrowdown'), l = keys.has('a') || keys.has('arrowleft'), r = keys.has('d') || keys.has('arrowright');
    drive(dt, u ? 1 : 0, d ? 1 : 0, (r ? 1 : 0) - (l ? 1 : 0), keys.has(' ')); S.distance += speed() * dt;
  }
  events.update(dt, S.car);
  const ev = events.state();
  traffic.update(dt, S.car, ev);
  people.update(dt, S.car, ev ? 1 : 0);
  trafficCollisions();
  if (!S.done && missions.update(S.car)) { S.done = true; S.missionReward += missions.state().reward; S.car.vx *= .45; S.car.vy *= .45; toast.textContent = `JOB COMPLETE // +$${missions.state().reward}`; toast.classList.add('hot'); }
  const v = speed(); S.maxSpeed = Math.max(S.maxSpeed, v); S.cam.x += (S.car.x - S.cam.x) * Math.min(1, dt * 5); S.cam.y += (S.car.y - S.cam.y) * Math.min(1, dt * 5); speedEl.textContent = String(Math.round(v * .19)).padStart(3, '0');
}
function drawTestOverlay() {
  if (!S.test.active) return;
  const a = ai.state, ev = events.state();
  const lines = [
    `AI DRIVER // ${a.mode}`,
    `POS ${Math.round(S.car.x)},${Math.round(S.car.y)}  HEADING ${Math.round(S.car.a * 57.3)}°`,
    `NODES ${roadNodes.length} ROUTE ${a.node}/${a.route.length} REPLANS ${a.replans}`,
    `COLLISIONS ${S.collisions} TRAFFIC ${S.trafficHits} RECOVERIES ${a.recoveries}`,
    `SENSE F:${Math.round(a.sensor.front)} FL:${Math.round(a.sensor.frontLeft)} FR:${Math.round(a.sensor.frontRight)}`,
    `PRED ${a.prediction.safe ? 'SAFE' : 'DANGER'} TTC:${Number.isFinite(a.prediction.ttc) ? a.prediction.ttc.toFixed(2) : '--'} RISK:${a.prediction.risk.toFixed(2)}`,
    `CROSS ${Math.round(a.crossTrack)} CURVE ${a.curvature.toFixed(2)} DECISIONS ${a.decisions}`,
    `MAX ${Math.round(S.maxSpeed * .19)} KM/H PEOPLE ${people.people.length} EVENT ${ev?.id || 'NONE'}`
  ];
  ctx.save(); ctx.font = '11px monospace'; ctx.textAlign = 'left';
  lines.forEach((line, i) => { ctx.fillStyle = i === 0 ? '#e8b84a' : '#a6abb1'; ctx.fillText(line, 18, 22 + i * 15); });
  ctx.restore();
}
function draw() {
  S.t += 1 / 60; roads(); buildings.forEach(b => building(...b)); lamps.forEach(l => lamp(...l)); events.draw(ctx, iso); traffic.draw(ctx, iso); people.draw(ctx, iso); if (!S.done) target(); car(); drawTestOverlay();
}

window.__LOWTOWN_TEST = {
  state: () => ({
    x: S.car.x, y: S.car.y, speed: speed(), maxSpeed: S.maxSpeed, distance: S.distance, collisions: S.collisions, trafficHits: S.trafficHits, damage: S.damage, stuck: S.stuck,
    recoveries: ai.state.recoveries, replans: ai.state.replans, safeStarts: ai.state.safeStarts, trafficCars: traffic.cars.length, pedestrians: people.people.length,
    activeEvent: events.state()?.id || null, routeLength: ai.state.route.length, missionComplete: S.done, missionReward: S.missionReward,
    sensor: { ...ai.state.sensor }, mode: ai.state.mode, ttc: ai.state.prediction.ttc, risk: ai.state.prediction.risk, decisions: ai.state.decisions,
    candidates: ai.state.candidates
  }),
  start: () => { S.test.active = true; reset(); },
  stop: () => { S.test.active = false; ai.state.enabled = false; },
  reset
};

let last = performance.now();
function frame(now) { const dt = Math.min(.05, Math.max(.001, (now - last) / 1000)); last = now; update(dt); draw(); requestAnimationFrame(frame); }
requestAnimationFrame(frame);
