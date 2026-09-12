import './style.css';
import { WORLD } from './game/world.js';

const app = document.querySelector('#app');
app.innerHTML = `<main class="shell"><header class="hud"><div class="brand"><span>LOW</span>TOWN <b>// NIGHT SHIFT</b></div><div class="status"><i></i> FREE ROAM <strong id="speed">000</strong> KM/H</div></header><section class="game-wrap"><canvas id="game"></canvas><div class="mission"><small>JOB 01</small><strong>SHAKE THE NIGHT</strong><span>Drive to the amber marker.</span></div><div class="hint">WASD / ARROWS · SPACE HANDBRAKE · R RESET</div><div class="toast" id="toast">ENGINE READY</div><div class="touch" aria-label="Touch controls"><button data-key="arrowup">▲</button><div><button data-key="arrowleft">◀</button><button data-key=" ">■</button><button data-key="arrowright">▶</button></div><button data-key="arrowdown">▼</button></div></section></main>`;

const canvas = document.querySelector('#game');
const ctx = canvas.getContext('2d');
const speedEl = document.querySelector('#speed');
const toast = document.querySelector('#toast');
const keys = new Set();

addEventListener('keydown', e => {
  keys.add(e.key.toLowerCase());
  if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright', ' '].includes(e.key.toLowerCase())) e.preventDefault();
});
addEventListener('keyup', e => keys.delete(e.key.toLowerCase()));

document.querySelectorAll('[data-key]').forEach(button => {
  const key = button.dataset.key;
  const press = e => { e.preventDefault(); keys.add(key); button.classList.add('pressed'); };
  const release = e => { e.preventDefault(); keys.delete(key); button.classList.remove('pressed'); };
  button.addEventListener('pointerdown', press);
  button.addEventListener('pointerup', release);
  button.addEventListener('pointercancel', release);
  button.addEventListener('pointerleave', release);
});

const buildings = WORLD.buildings;
const lamps = WORLD.lamps;
const testMode = new URLSearchParams(location.search).has('autotest');

const S = {
  car: { x: 0, y: 0, a: -0.35, vx: 0, vy: 0 },
  cam: { x: 0, y: 0 },
  target: WORLD.mission,
  t: 0,
  done: false,
  damage: 0,
  collisions: 0,
  stuck: 0,
  maxSpeed: 0,
  test: { active: testMode, index: 0, lap: 0, lastX: 0, lastY: 0, report: [], timer: 0 }
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
  return { x: canvas.clientWidth / 2 + (x - S.cam.x) * .78 + (y - S.cam.y) * .42, y: canvas.clientHeight / 2 + (y - S.cam.y) * .42 - (x - S.cam.x) * .78 };
}
function poly(p, f, s) {
  ctx.beginPath(); p.forEach((q, i) => i ? ctx.lineTo(q.x, q.y) : ctx.moveTo(q.x, q.y)); ctx.closePath();
  ctx.fillStyle = f; ctx.fill(); if (s) { ctx.strokeStyle = s; ctx.stroke(); }
}
function roads() {
  ctx.fillStyle = '#14161a'; ctx.fillRect(0, 0, canvas.clientWidth, canvas.clientHeight);
  for (let i = -1400; i <= 1400; i += 160) {
    const a = iso(i, -1500), b = iso(i, 1500), c = iso(-1500, i), d = iso(1500, i);
    ctx.strokeStyle = '#272a2f'; ctx.lineWidth = 92;
    ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(c.x, c.y); ctx.lineTo(d.x, d.y); ctx.stroke();
  }
  ctx.setLineDash([18, 20]); ctx.lineWidth = 2; ctx.strokeStyle = 'rgba(224,154,62,.28)';
  for (let i = -1400; i <= 1400; i += 160) {
    const a = iso(i, -1500), b = iso(i, 1500), c = iso(-1500, i), d = iso(1500, i);
    ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(c.x, c.y); ctx.lineTo(d.x, d.y); ctx.stroke();
  }
  ctx.setLineDash([]);
}
function building(x, y, w, h) {
  const top = [iso(x, y), iso(x + w, y), iso(x + w, y + h), iso(x, y + h)];
  const f = top.map(p => ({ x: p.x, y: p.y - 70 }));
  poly(f, '#34373c', '#111317'); poly([f[0], f[1], top[1], top[0]], '#26292e'); poly([f[1], f[2], top[2], top[1]], '#1e2125');
  for (let yy = 18; yy < h; yy += 38) for (let xx = 22; xx < w; xx += 48) {
    if (((xx + yy) / 38 | 0) % 3 === 0) continue;
    const p = iso(x + xx, y + yy); ctx.fillStyle = 'rgba(224,154,62,.32)'; ctx.fillRect(p.x - 3, p.y - 2, 6, 4);
  }
}
function lamp(x, y) {
  const p = iso(x, y); ctx.strokeStyle = '#55585d'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x, p.y - 35); ctx.stroke();
  ctx.fillStyle = '#e09a3e'; ctx.beginPath(); ctx.arc(p.x, p.y - 39, 4, 0, 7); ctx.fill();
}
function target() {
  const p = iso(S.target.x, S.target.y), r = 18 + Math.sin(S.t * 5) * 4;
  ctx.strokeStyle = '#e09a3e'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, 7); ctx.stroke();
  ctx.fillStyle = 'rgba(224,154,62,.18)'; ctx.fill(); ctx.fillStyle = '#e09a3e'; ctx.font = 'bold 10px monospace'; ctx.textAlign = 'center'; ctx.fillText('DROP', p.x, p.y - 27);
}
function car() {
  const p = iso(S.car.x, S.car.y); ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(-S.car.a - .15);
  ctx.shadowColor = 'rgba(0,0,0,.65)'; ctx.shadowBlur = 16; ctx.fillStyle = '#08090b'; ctx.fillRect(-22, -12, 44, 24); ctx.shadowBlur = 0;
  ctx.fillStyle = '#e8b84a'; ctx.fillRect(-18, -9, 36, 18); ctx.fillStyle = '#15171b'; ctx.fillRect(-9, -7, 16, 14);
  ctx.fillStyle = '#d4523a'; ctx.fillRect(13, -7, 5, 4); ctx.fillRect(13, 3, 5, 4); ctx.restore();
}

function speed() { return Math.hypot(S.car.vx, S.car.vy); }
function blocked(x, y) {
  const radius = 19;
  return buildings.some(([bx, by, bw, bh]) => x > bx - radius && x < bx + bw + radius && y > by - radius && y < by + bh + radius);
}
function nearestOpen(x, y) {
  if (!blocked(x, y)) return { x, y };
  const probes = [[45,0],[-45,0],[0,45],[0,-45],[80,0],[-80,0],[0,80],[0,-80]];
  for (const [dx, dy] of probes) if (!blocked(x + dx, y + dy)) return { x: x + dx, y: y + dy };
  return { x: 0, y: 0 };
}

// A compact arcade-realistic vehicle model: throttle builds longitudinal speed,
// lateral velocity is naturally scrubbed by tire grip, and steering changes yaw
// in proportion to forward speed. This gives smooth cornering without a tank-like feel.
function drive(dt, throttle, brake, steer, handbrake = false) {
  const c = S.car;
  const forwardX = Math.cos(c.a), forwardY = Math.sin(c.a);
  const rightX = -forwardY, rightY = forwardX;
  const forwardSpeed = c.vx * forwardX + c.vy * forwardY;
  const lateralSpeed = c.vx * rightX + c.vy * rightY;
  const maxForward = 520;
  const maxReverse = 185;

  const engine = throttle > 0 ? 430 : brake > 0 ? -300 : 0;
  c.vx += forwardX * engine * throttle * dt;
  c.vy += forwardY * engine * throttle * dt;
  if (brake > 0) {
    if (forwardSpeed > 12) {
      const brakeForce = 700 * brake;
      c.vx -= forwardX * Math.min(forwardSpeed, brakeForce * dt);
      c.vy -= forwardY * Math.min(forwardSpeed, brakeForce * dt);
    } else {
      c.vx -= forwardX * 260 * brake * dt;
      c.vy -= forwardY * 260 * brake * dt;
    }
  }

  const grip = handbrake ? 2.4 : 8.5;
  const lateralCorrection = Math.min(1, grip * dt);
  c.vx -= rightX * lateralSpeed * lateralCorrection;
  c.vy -= rightY * lateralSpeed * lateralCorrection;

  const drag = handbrake ? 0.975 : 0.992;
  c.vx *= Math.pow(drag, dt * 60);
  c.vy *= Math.pow(drag, dt * 60);

  const currentForward = c.vx * forwardX + c.vy * forwardY;
  const steerAuthority = Math.min(1, Math.abs(currentForward) / 80);
  c.a += steer * (handbrake ? 1.35 : 1.75) * steerAuthority * dt * (currentForward >= 0 ? 1 : -1);

  const afterForward = c.vx * Math.cos(c.a) + c.vy * Math.sin(c.a);
  if (afterForward > maxForward) {
    const excess = afterForward - maxForward;
    c.vx -= Math.cos(c.a) * excess;
    c.vy -= Math.sin(c.a) * excess;
  }
  if (afterForward < -maxReverse) {
    const excess = afterForward + maxReverse;
    c.vx -= Math.cos(c.a) * excess;
    c.vy -= Math.sin(c.a) * excess;
  }

  const nx = c.x + c.vx * dt;
  const ny = c.y + c.vy * dt;
  if (!blocked(nx, ny)) {
    c.x = nx; c.y = ny;
  } else {
    const before = speed();
    const safe = nearestOpen(c.x, c.y);
    c.x = safe.x; c.y = safe.y;
    c.vx *= -0.18; c.vy *= -0.18;
    S.collisions++;
    S.damage += Math.max(1, before / 180);
    toast.textContent = 'BODY HIT';
  }
}

function testWaypoints() {
  return [
    { x: 0, y: 0 }, { x: 300, y: 0 }, { x: 620, y: 0 },
    { x: 620, y: -300 }, { x: 760, y: -420 }, { x: 360, y: -320 },
    { x: 0, y: -320 }, { x: -320, y: -320 }, { x: -320, y: 0 },
    { x: -320, y: 320 }, { x: 0, y: 320 }, { x: 320, y: 320 },
    { x: 620, y: 320 }, { x: 620, y: 0 }
  ];
}
function autonomousDrive(dt) {
  const points = testWaypoints();
  let target = points[S.test.index];
  const dx = target.x - S.car.x, dy = target.y - S.car.y;
  const distance = Math.hypot(dx, dy);
  if (distance < 55) {
    S.test.index = (S.test.index + 1) % points.length;
    if (S.test.index === 0) S.test.lap++;
    target = points[S.test.index];
  }
  const desired = Math.atan2(target.y - S.car.y, target.x - S.car.x);
  let delta = desired - S.car.a;
  while (delta > Math.PI) delta -= Math.PI * 2;
  while (delta < -Math.PI) delta += Math.PI * 2;
  const steer = Math.max(-1, Math.min(1, delta * 2.2));
  const v = speed();
  const slowForCorner = Math.max(0, 1 - Math.abs(delta) * 1.8);
  const throttle = distance > 100 ? Math.max(.35, slowForCorner) : .2;
  const brake = Math.abs(delta) > 1.1 && v > 180 ? Math.min(1, Math.abs(delta) / 1.8) : 0;
  drive(dt, throttle, brake, steer, Math.abs(delta) > 1.65 && v > 260);

  S.test.timer += dt;
  const moved = Math.hypot(S.car.x - S.test.lastX, S.car.y - S.test.lastY);
  if (S.test.timer > 2) {
    if (moved < 25 && v < 20) S.stuck++;
    S.test.lastX = S.car.x; S.test.lastY = S.car.y; S.test.timer = 0;
  }
}

function update(dt) {
  if (S.test.active) autonomousDrive(dt);
  else {
    const u = keys.has('w') || keys.has('arrowup'), d = keys.has('s') || keys.has('arrowdown');
    const l = keys.has('a') || keys.has('arrowleft'), r = keys.has('d') || keys.has('arrowright');
    drive(dt, u ? 1 : 0, d ? 1 : 0, (r ? 1 : 0) - (l ? 1 : 0), keys.has(' '));
  }

  const v = speed();
  S.maxSpeed = Math.max(S.maxSpeed, v);
  S.cam.x += (S.car.x - S.cam.x) * Math.min(1, dt * 5);
  S.cam.y += (S.car.y - S.cam.y) * Math.min(1, dt * 5);

  if (!S.done && Math.hypot(S.car.x - S.target.x, S.car.y - S.target.y) < S.target.radius) {
    S.done = true; S.car.vx = 0; S.car.vy = 0;
    toast.textContent = `JOB COMPLETE // +$${S.target.reward}`; toast.classList.add('hot');
  }
  if (keys.has('r')) {
    const start = nearestOpen(0, 0);
    S.car = { x: start.x, y: start.y, a: -.35, vx: 0, vy: 0 }; S.done = false; S.damage = 0; S.collisions = 0;
    toast.textContent = 'ENGINE READY'; toast.classList.remove('hot'); keys.delete('r');
  }
  speedEl.textContent = String(Math.round(v * .19)).padStart(3, '0');
}

function drawTestOverlay() {
  if (!S.test.active) return;
  const lines = [
    'AI DRIVER // SELF TEST',
    `LAP ${S.test.lap}  WP ${S.test.index + 1}/${testWaypoints().length}`,
    `COLLISIONS ${S.collisions}  DAMAGE ${S.damage.toFixed(1)}`,
    `MAX ${Math.round(S.maxSpeed * .19)} KM/H  STUCK ${S.stuck}`
  ];
  ctx.save(); ctx.font = '11px monospace'; ctx.textAlign = 'left';
  lines.forEach((line, i) => { ctx.fillStyle = i === 0 ? '#e8b84a' : '#a6abb1'; ctx.fillText(line, 18, 92 + i * 16); });
  ctx.restore();
}
function draw() {
  S.t += 1 / 60; roads(); buildings.forEach(b => building(...b)); lamps.forEach(l => lamp(...l)); if (!S.done) target(); car(); drawTestOverlay();
}

window.__LOWTOWN_TEST = {
  state: () => ({
    x: S.car.x, y: S.car.y, speed: speed(), maxSpeed: S.maxSpeed,
    collisions: S.collisions, damage: S.damage, stuck: S.stuck,
    missionComplete: S.done, lap: S.test.lap, waypoint: S.test.index
  }),
  start: () => { S.test.active = true; },
  stop: () => { S.test.active = false; },
  reset: () => { location.href = location.pathname + (S.test.active ? '?autotest' : ''); }
};

let last = performance.now();
function loop(now) { const dt = Math.min(.033, (now - last) / 1000); last = now; update(dt); draw(); requestAnimationFrame(loop); }
requestAnimationFrame(loop);
