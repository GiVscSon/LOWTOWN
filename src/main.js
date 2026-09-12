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

const S = { car: { x: 0, y: 0, a: -0.35, v: 0 }, cam: { x: 0, y: 0 }, target: WORLD.mission, t: 0, done: false };
const buildings = WORLD.buildings;
const lamps = WORLD.lamps;

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
  ctx.beginPath();
  p.forEach((q, i) => i ? ctx.lineTo(q.x, q.y) : ctx.moveTo(q.x, q.y));
  ctx.closePath(); ctx.fillStyle = f; ctx.fill();
  if (s) { ctx.strokeStyle = s; ctx.stroke(); }
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
  const p = iso(S.car.x, S.car.y); ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(-S.car.a - .15); ctx.shadowColor = 'rgba(0,0,0,.65)'; ctx.shadowBlur = 16;
  ctx.fillStyle = '#08090b'; ctx.fillRect(-20, -11, 40, 22); ctx.shadowBlur = 0; ctx.fillStyle = '#e8b84a'; ctx.fillRect(-17, -9, 34, 18);
  ctx.fillStyle = '#15171b'; ctx.fillRect(-8, -7, 15, 14); ctx.fillStyle = '#d4523a'; ctx.fillRect(12, -7, 5, 4); ctx.fillRect(12, 3, 5, 4); ctx.restore();
}
function blocked(x, y) {
  const margin = 18;
  return buildings.some(([bx, by, bw, bh]) => x > bx - margin && x < bx + bw + margin && y > by - margin && y < by + bh + margin);
}
function update(dt) {
  const u = keys.has('w') || keys.has('arrowup'), d = keys.has('s') || keys.has('arrowdown');
  const l = keys.has('a') || keys.has('arrowleft'), r = keys.has('d') || keys.has('arrowright');
  if (u) S.car.v += 420 * dt; if (d) S.car.v -= 520 * dt;
  if (keys.has(' ')) S.car.v *= Math.pow(.90, dt * 60);
  else S.car.v *= Math.pow(.985, dt * 60);
  S.car.v = Math.max(-170, Math.min(520, S.car.v));
  const steer = (l ? -1 : 0) + (r ? 1 : 0);
  S.car.a += steer * (keys.has(' ') ? .9 : 1.7) * dt * (.35 + Math.abs(S.car.v) / 180);
  const nx = S.car.x + Math.cos(S.car.a) * S.car.v * dt;
  const ny = S.car.y + Math.sin(S.car.a) * S.car.v * dt;
  if (!blocked(nx, ny)) { S.car.x = nx; S.car.y = ny; } else { S.car.v *= -.22; toast.textContent = 'CURB HIT'; }
  S.cam.x += (S.car.x - S.cam.x) * Math.min(1, dt * 5); S.cam.y += (S.car.y - S.cam.y) * Math.min(1, dt * 5);
  if (!S.done && Math.hypot(S.car.x - S.target.x, S.car.y - S.target.y) < S.target.radius) { S.done = true; S.car.v = 0; toast.textContent = `JOB COMPLETE // +$${S.target.reward}`; toast.classList.add('hot'); }
  if (keys.has('r')) { S.car = { x: 0, y: 0, a: -.35, v: 0 }; S.done = false; toast.textContent = 'ENGINE READY'; toast.classList.remove('hot'); keys.delete('r'); }
  speedEl.textContent = String(Math.round(Math.abs(S.car.v) * .19)).padStart(3, '0');
}
function draw() { S.t += 1 / 60; roads(); buildings.forEach(b => building(...b)); lamps.forEach(l => lamp(...l)); if (!S.done) target(); car(); }
let last = performance.now();
function loop(now) { const dt = Math.min(.033, (now - last) / 1000); last = now; update(dt); draw(); requestAnimationFrame(loop); }
requestAnimationFrame(loop);
