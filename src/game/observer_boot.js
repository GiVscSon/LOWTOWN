const style = document.createElement('style');
style.textContent = '#ai-observer-panel{position:fixed;left:14px;top:72px;width:350px;z-index:30;background:rgba(8,9,11,.92);border:1px solid rgba(224,154,62,.6);color:#e7e2d8;font:11px/1.35 monospace;padding:10px;pointer-events:none;box-shadow:0 10px 30px rgba(0,0,0,.35)}#ai-observer-panel .head{color:#e09a3e;font-weight:700;font-size:12px;margin-bottom:6px}#ai-observer-log{margin-top:7px;max-height:115px;overflow:hidden;border-top:1px solid #2d3035;padding-top:5px}#ai-observer-log div{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}#ai-observer-help{position:fixed;right:14px;top:72px;z-index:30;color:#9aa0a8;background:rgba(8,9,11,.82);border:1px solid #2d3035;padding:7px 9px;font:10px monospace;pointer-events:none}#ai-observer-canvas{position:fixed;inset:0;width:100vw;height:100vh;z-index:15;pointer-events:none}@media(max-width:700px){#ai-observer-panel{left:8px;top:58px;width:calc(100vw - 36px);font-size:10px}#ai-observer-help{display:none}}';
document.head.appendChild(style);

const oc = document.createElement('canvas');
oc.id = 'ai-observer-canvas';
document.body.appendChild(oc);
const ctx = oc.getContext('2d');
const panel = document.createElement('aside');
panel.id = 'ai-observer-panel';
panel.innerHTML = '<div class="head">AI OBSERVER // FEEDBACK SUPERVISOR</div><div id="ai-observer-data">waiting for AI...</div><div id="ai-observer-log"></div>';
document.body.appendChild(panel);
const help = document.createElement('div');
help.id = 'ai-observer-help';
help.textContent = 'F1 CHASE · F2 TOP · F3 DEBUG · P PAUSE · O STEP · F8 HUD';
document.body.appendChild(help);

const nativeRAF = window.requestAnimationFrame.bind(window);
let gameFrame = null;
let paused = false;
let camera = 'CHASE';
const trail = [];
const decisions = [];
let lastDecision = '';
let lastX = 0;
let lastY = 0;
let stuckTime = 0;
let nearMisses = 0;
let supervisorReplans = 0;
let supervisorRecoveries = 0;
let bootTime = performance.now();
let lastReplan = 0;

function resize() {
  const d = Math.min(window.devicePixelRatio || 1, 2);
  oc.width = window.innerWidth * d;
  oc.height = window.innerHeight * d;
  ctx.setTransform(d, 0, 0, d, 0, 0);
}
window.addEventListener('resize', resize);
resize();

function screen(x, y, s) {
  return {
    x: window.innerWidth / 2 + (x - s.x) * .78 + (y - s.y) * .42,
    y: window.innerHeight / 2 + (y - s.y) * .42 - (x - s.x) * .78
  };
}

function safeFuture(a) {
  const r = Array.isArray(a.route) ? a.route : [];
  if (r.length < 3) return null;
  const i = Math.min(r.length - 1, Math.max(1, (a.node || 0) + 4));
  return r[i];
}

function supervisor(s, a, dt) {
  const v = Math.hypot(s.vx || 0, s.vy || 0);
  const sensor = a.sensor || {};
  const prediction = a.prediction || {};
  const front = Number(sensor.front || 999);
  const ttc = Number.isFinite(prediction.ttc) ? prediction.ttc : Infinity;
  const moved = Math.hypot(s.x - lastX, s.y - lastY);

  if (moved > 2) {
    stuckTime = Math.max(0, stuckTime - dt * .7);
    lastX = s.x;
    lastY = s.y;
  } else if (v < 35) {
    stuckTime += dt;
  }

  if (ttc < 1.15 || front < 45) nearMisses++;

  const now = performance.now();
  if ((ttc < 1.0 || front < 38 || stuckTime > 1.35) && now - lastReplan > 900) {
    const future = safeFuture(a);
    if (future) {
      a.goal = future;
      a.route = [];
      a.node = 0;
      a.replans = (a.replans || 0) + 1;
      supervisorReplans++;
      lastReplan = now;
      decisions.push({ mode: 'SUPERVISOR', reason: 'safe replan: TTC ' + (Number.isFinite(ttc) ? ttc.toFixed(2) : '--') + ' wall ' + Math.round(front) + ' stuck ' + stuckTime.toFixed(1) + 's' });
      if (decisions.length > 40) decisions.shift();
      stuckTime = 0;
    }
  }

  if (stuckTime > 3.2 && now - lastReplan > 900) {
    const future = safeFuture(a);
    if (future) {
      s.x = future.x;
      s.y = future.y;
      const route = Array.isArray(a.route) ? a.route : [];
      const next = route[Math.min((a.node || 0) + 5, route.length - 1)];
      if (next) s.a = Math.atan2(next.y - s.y, next.x - s.x);
      s.vx = 0;
      s.vy = 0;
      supervisorRecoveries++;
      a.recoveries = (a.recoveries || 0) + 1;
      stuckTime = 0;
      lastReplan = now;
      decisions.push({ mode: 'SUPERVISOR', reason: 'hard safe-position recovery' });
      if (decisions.length > 40) decisions.shift();
    }
  }

  a.supervisor = {
    nearMisses: nearMisses,
    replans: supervisorReplans,
    recoveries: supervisorRecoveries,
    stuck: stuckTime,
    uptime: (now - bootTime) / 1000
  };
}

function observe() {
  const ai = window.__LOWTOWN_AI;
  const test = window.__LOWTOWN_TEST;
  if (!ai || !test) return null;

  const s = test.state();
  const a = ai.state || ai;
  supervisor(s, a, Math.min(.05, 1 / 60));

  const last = trail[trail.length - 1];
  if (!last || Math.hypot(s.x - last.x, s.y - last.y) > 3) {
    trail.push({ x: s.x, y: s.y });
    if (trail.length > 240) trail.shift();
  }

  const mode = a.mode || a.state || 'IDLE';
  const prediction = a.prediction || {};
  const sensor = a.sensor || {};
  const ttc = Number.isFinite(prediction.ttc) ? prediction.ttc : Infinity;
  let reason = 'CRUISE route tracking';
  if (mode === 'BRAKE') reason = 'BRAKE wall ' + Math.round(sensor.front || 0);
  else if (mode === 'AVOID') reason = 'AVOID TTC ' + ttc.toFixed(2) + 's';
  else if (mode === 'CORNER') reason = 'CORNER ' + Number(a.curvature || 0).toFixed(2);
  else if (mode === 'LANE_CORRECT') reason = 'CORRECT ' + Math.round(a.crossTrack || 0) + 'm';
  else if (mode === 'REPLAN') reason = 'REPLAN blocked';

  const key = mode + '|' + reason;
  if (key !== lastDecision) {
    decisions.push({ mode: mode, reason: reason });
    if (decisions.length > 40) decisions.shift();
    lastDecision = key;
  }
  return { s: s, a: a };
}

function draw() {
  const data = observe();
  ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);
  if (data) {
    const s = data.s;
    const a = data.a;
    const cam = { x: s.x, y: s.y };

    if (trail.length > 1) {
      ctx.save();
      ctx.strokeStyle = 'rgba(232,184,74,.58)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      trail.forEach(function(p, i) {
        const q = screen(p.x, p.y, cam);
        if (i) ctx.lineTo(q.x, q.y); else ctx.moveTo(q.x, q.y);
      });
      ctx.stroke();
      ctx.restore();
    }

    const o = screen(s.x, s.y, cam);
    const se = a.sensor || {};
    [[0, se.front], [-.34, se.frontLeft], [.34, se.frontRight], [-1.57, se.left], [1.57, se.right]].forEach(function(pair) {
      const ang = pair[0];
      const len = pair[1];
      const l = Math.min(Number(len) || 0, 340);
      const q = screen(s.x + Math.cos(s.a + ang) * l, s.y + Math.sin(s.a + ang) * l, cam);
      ctx.strokeStyle = l < 75 ? 'rgba(212,82,58,.9)' : (l < 130 ? 'rgba(224,154,62,.8)' : 'rgba(224,154,62,.35)');
      ctx.lineWidth = ang === 0 ? 3 : 1.5;
      ctx.beginPath();
      ctx.moveTo(o.x, o.y);
      ctx.lineTo(q.x, q.y);
      ctx.stroke();
    });

    const p = a.prediction || {};
    const px = Number(p.x);
    const py = Number(p.y);
    if (Number.isFinite(px) && Number.isFinite(py)) {
      const q = screen(px, py, cam);
      ctx.strokeStyle = p.safe ? '#9dbb8c' : '#d4523a';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(o.x, o.y);
      ctx.lineTo(q.x, q.y);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(q.x, q.y, 5, 0, Math.PI * 2);
      ctx.stroke();
    }

    if (a.dynamic && a.dynamic.nearest && a.dynamic.nearest.o) {
      const n = a.dynamic.nearest.o;
      const q = screen(n.x, n.y, cam);
      ctx.strokeStyle = Number.isFinite(p.ttc) && p.ttc < 2 ? '#d4523a' : 'rgba(224,154,62,.7)';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(q.x, q.y, 14, 0, Math.PI * 2);
      ctx.stroke();
    }

    const control = a.control || (Array.isArray(a.candidates) ? a.candidates[0] : {}) || {};
    const speed = Math.round(Math.hypot(s.vx || 0, s.vy || 0) * .19);
    const ttcText = Number.isFinite(p.ttc) ? p.ttc.toFixed(2) + 's' : '--';
    const dataHtml = 'MODE <b>' + (a.mode || 'IDLE') + '</b><br>' +
      'POS ' + Math.round(s.x) + ', ' + Math.round(s.y) + ' SPEED ' + speed + ' km/h<br>' +
      'CONTROL ' + JSON.stringify(control) + '<br>' +
      'SENSORS F ' + Math.round(se.front || 0) + ' FL ' + Math.round(se.frontLeft || 0) + ' FR ' + Math.round(se.frontRight || 0) + '<br>' +
      'TTC ' + ttcText + ' RISK ' + Number(p.risk || 0).toFixed(2) + '<br>' +
      'ROUTE ' + (a.node || 0) + '/' + ((a.route && a.route.length) || 0) + ' REPLANS ' + (a.replans || 0) + ' RECOVER ' + (a.recoveries || 0) + '<br>' +
      'SUPERVISOR NM ' + nearMisses + ' RP ' + supervisorReplans + ' SR ' + supervisorRecoveries + '<br>' +
      'TRACE ' + trail.length + ' pts ' + (paused ? '|| PAUSED' : 'LIVE');
    panel.querySelector('#ai-observer-data').innerHTML = dataHtml;
    panel.querySelector('#ai-observer-log').innerHTML = decisions.slice(-7).reverse().map(function(d) {
      return '<div>' + d.mode + ' · ' + d.reason + '</div>';
    }).join('');
  }
  nativeRAF(draw);
}

function pause(v) {
  paused = v;
  if (window.__LOWTOWN_OBSERVER) window.__LOWTOWN_OBSERVER.paused = v;
  if (!paused && gameFrame) {
    const cb = gameFrame;
    gameFrame = null;
    nativeRAF(cb);
  }
}

window.requestAnimationFrame = function(cb) {
  if (cb === draw) return nativeRAF(cb);
  gameFrame = cb;
  if (paused) return 0;
  return nativeRAF(cb);
};

window.addEventListener('keydown', function(e) {
  if (e.repeat) return;
  const k = e.key.toLowerCase();
  if (k === 'f1') camera = 'CHASE';
  if (k === 'f2') camera = 'TOP';
  if (k === 'f3') camera = 'DEBUG';
  if (k === 'p') pause(!paused);
  if (k === 'o' && paused && gameFrame) {
    const cb = gameFrame;
    gameFrame = null;
    nativeRAF(cb);
  }
  if (k === 'f8') {
    const on = panel.style.display !== 'none';
    panel.style.display = on ? 'none' : '';
    help.style.display = on ? 'none' : '';
    oc.style.display = on ? 'none' : '';
  }
});

const timer = setInterval(function() {
  if (window.__LOWTOWN_AI && window.__LOWTOWN_TEST) {
    window.__LOWTOWN_OBSERVER = {
      active: true,
      get camera() { return camera; },
      get paused() { return paused; },
      set paused(v) { pause(v); },
      decisions: decisions,
      trail: trail,
      get metrics() {
        return {
          nearMisses: nearMisses,
          supervisorReplans: supervisorReplans,
          supervisorRecoveries: supervisorRecoveries,
          stuckTime: stuckTime
        };
      }
    };
    clearInterval(timer);
    nativeRAF(draw);
  }
}, 100);
