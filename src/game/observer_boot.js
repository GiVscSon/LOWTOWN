const style = document.createElement('style');
style.textContent = `
#ai-observer-panel{position:fixed;left:14px;top:72px;width:330px;z-index:20;background:rgba(8,9,11,.9);border:1px solid rgba(224,154,62,.55);box-shadow:0 10px 35px rgba(0,0,0,.35);color:#e7e2d8;font:11px/1.35 monospace;padding:10px;pointer-events:none;backdrop-filter:blur(5px)}
#ai-observer-panel .head{color:#e09a3e;font-weight:700;font-size:12px;margin-bottom:6px}#ai-observer-panel .warn{color:#d4523a}#ai-observer-panel .ok{color:#9dbb8c}
#ai-observer-log{margin-top:7px;max-height:105px;overflow:hidden;border-top:1px solid #2d3035;padding-top:5px}
#ai-observer-log div{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
#ai-observer-help{position:fixed;right:14px;top:72px;z-index:20;color:#9aa0a8;background:rgba(8,9,11,.78);border:1px solid #2d3035;padding:7px 9px;font:10px monospace;pointer-events:none}
@media(max-width:700px){#ai-observer-panel{left:8px;top:58px;width:calc(100vw - 36px);font-size:10px}#ai-observer-help{display:none}}
`;
document.head.appendChild(style);

const panel = document.createElement('aside');
panel.id = 'ai-observer-panel';
panel.innerHTML = '<div class="head">AI OBSERVER // LIVE</div><div id="ai-observer-data">waiting for AI…</div><div id="ai-observer-log"></div>';
document.body.appendChild(panel);
const help = document.createElement('div');
help.id = 'ai-observer-help';
help.textContent = 'F1 CHASE · F2 TOP · F3 DEBUG · P PAUSE · O STEP · F8 HUD';
document.body.appendChild(help);

let lastFrame = -1;
function read() {
  const ai = window.__LOWTOWN_AI;
  const test = window.__LOWTOWN_TEST;
  if (!ai || !test) return;
  const s = test.state?.() || {};
  const a = ai.state || ai;
  if (lastFrame === a.frame && !a.decisions) return;
  lastFrame = a.frame;
  const c = a.control || {};
  const p = a.prediction || {};
  const ttc = Number.isFinite(p.ttc) ? `${p.ttc.toFixed(2)}s` : '--';
  const risk = Number(p.risk || 0);
  const riskClass = risk > .8 ? 'warn' : 'ok';
  document.querySelector('#ai-observer-data').innerHTML = [
    `MODE      <b>${a.mode || a.state || 'IDLE'}</b>`,
    `POS       ${Math.round(s.x || 0)}, ${Math.round(s.y || 0)}   SPEED ${Math.round((s.speed || 0) * .19)} km/h`,
    `CONTROL   G ${(+(c.throttle || 0)).toFixed(2)}  B ${(+(c.brake || 0)).toFixed(2)}  S ${(+(c.steer || 0)).toFixed(2)}`,
    `SENSORS   F ${Math.round(a.sensor?.front || 0)}  FL ${Math.round(a.sensor?.frontLeft || 0)}  FR ${Math.round(a.sensor?.frontRight || 0)}`,
    `TRAFFIC   ${a.dynamic?.count || 0}   TTC <span class="${riskClass}">${ttc}</span>   RISK <span class="${riskClass}">${risk.toFixed(2)}</span>`,
    `ROUTE     ${a.node || 0}/${a.route?.length || 0}   REPLANS ${a.replans || 0}   RECOVER ${a.recoveries || 0}`,
    `DISTANCE  ${Math.round(s.distance || a.distance || 0)}   COLLISIONS ${s.collisions || 0}`,
    `CAMERA    ${window.__LOWTOWN_OBSERVER?.camera || 'CHASE'}   ${window.__LOWTOWN_OBSERVER?.paused ? '|| PAUSED' : 'LIVE'}`
  ].join('<br>');
  const log = document.querySelector('#ai-observer-log');
  const decisions = window.__LOWTOWN_OBSERVER?.decisions || a.decisions || [];
  if (decisions.length) log.innerHTML = decisions.slice(-6).reverse().map(d => `<div>${d.t ?? '--'}s ${d.mode || ''} ${d.reason || ''}</div>`).join('');
}

function loop() { read(); requestAnimationFrame(loop); }
function install() {
  const ai = window.__LOWTOWN_AI;
  const test = window.__LOWTOWN_TEST;
  if (!ai || !test) return false;
  if (!window.__LOWTOWN_OBSERVER) {
    window.__LOWTOWN_OBSERVER = {
      active: true, camera: 'CHASE', paused: false, decisions: [],
      setCamera(mode) { if (['CHASE','TOP','DEBUG'].includes(mode)) this.camera = mode; },
      togglePause() { this.paused = !this.paused; return this.paused; }
    };
  }
  return true;
}

addEventListener('keydown', e => {
  const k = e.key.toLowerCase();
  const o = window.__LOWTOWN_OBSERVER;
  if (!o) return;
  if (k === 'f1') o.setCamera('CHASE');
  if (k === 'f2') o.setCamera('TOP');
  if (k === 'f3') o.setCamera('DEBUG');
  if (k === 'p') o.togglePause();
  if (k === 'f8') o.active = !o.active;
  panel.style.display = o.active ? '' : 'none';
  help.style.display = o.active ? '' : 'none';
});

const timer = setInterval(() => { if (install()) { clearInterval(timer); loop(); } }, 100);
