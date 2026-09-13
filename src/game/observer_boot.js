const style = document.createElement('style');
style.textContent = `
#ai-observer-panel{position:fixed;left:14px;top:72px;width:330px;z-index:30;background:rgba(8,9,11,.9);border:1px solid rgba(224,154,62,.55);box-shadow:0 10px 35px rgba(0,0,0,.35);color:#e7e2d8;font:11px/1.35 monospace;padding:10px;pointer-events:none;backdrop-filter:blur(5px)}
#ai-observer-panel .head{color:#e09a3e;font-weight:700;font-size:12px;margin-bottom:6px}#ai-observer-panel .warn{color:#d4523a}#ai-observer-panel .ok{color:#9dbb8c}
#ai-observer-log{margin-top:7px;max-height:105px;overflow:hidden;border-top:1px solid #2d3035;padding-top:5px}
#ai-observer-log div{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
#ai-observer-help{position:fixed;right:14px;top:72px;z-index:30;color:#9aa0a8;background:rgba(8,9,11,.78);border:1px solid #2d3035;padding:7px 9px;font:10px monospace;pointer-events:none}
#ai-observer-canvas{position:fixed;inset:0;width:100vw;height:100vh;z-index:15;pointer-events:none}
@media(max-width:700px){#ai-observer-panel{left:8px;top:58px;width:calc(100vw - 36px);font-size:10px}#ai-observer-help{display:none}}
`;
document.head.appendChild(style);

const overlay = document.createElement('canvas');
overlay.id = 'ai-observer-canvas';
document.body.appendChild(overlay);
const octx = overlay.getContext('2d');
const panel = document.createElement('aside');
panel.id = 'ai-observer-panel';
panel.innerHTML = '<div class="head">AI OBSERVER // LIVE</div><div id="ai-observer-data">waiting for AI…</div><div id="ai-observer-log"></div>';
document.body.appendChild(panel);
const help = document.createElement('div');
help.id = 'ai-observer-help';
help.textContent = 'F1 CHASE · F2 TOP · F3 DEBUG · P PAUSE · O STEP · F8 HUD';
document.body.appendChild(help);

let lastFrame = -1;
const trail = [];
const decisions = [];
let lastDecision = '';
let camera = 'CHASE';
let paused = false;
let step = false;

function resize(){ const d=Math.min(devicePixelRatio||1,2); overlay.width=innerWidth*d; overlay.height=innerHeight*d; octx.setTransform(d,0,0,d,0,0); }
addEventListener('resize',resize); resize();
function worldToScreen(x,y,s){ const scale=.78; return {x:innerWidth/2+(x-s.x)*scale+(y-s.y)*.42,y:innerHeight/2+(y-s.y)*.42-(x-s.x)*scale}; }
function record(){
  const ai=window.__LOWTOWN_AI, test=window.__LOWTOWN_TEST; if(!ai||!test)return;
  const s=test.state(), a=ai.state||ai;
  const p={x:s.x,y:s.y}; const last=trail[trail.length-1];
  if(!last||Math.hypot(p.x-last.x,p.y-last.y)>3){trail.push({...p});if(trail.length>180)trail.shift();}
  const ttc=Number.isFinite(a.prediction?.ttc)?a.prediction.ttc:Infinity;
  const reason=a.mode==='BRAKE'?`BRAKE wall ${Math.round(a.sensor?.front||0)}`:a.mode==='AVOID'?`AVOID TTC ${ttc.toFixed(2)}s`:a.mode==='CORNER'?`CORNER ${a.curvature.toFixed(2)}`:a.mode==='LANE_CORRECT'?`CORRECT ${Math.round(a.crossTrack)}m`:a.mode==='REPLAN'?'REPLAN blocked prediction':'CRUISE route tracking';
  const key=`${a.mode}:${reason}`;
  if(key!==lastDecision){decisions.push({t:performance.now()/1000,mode:a.mode,reason});if(decisions.length>30)decisions.shift();lastDecision=key;}
  if(a.prediction?.ttc<1.8&&a.prediction?.ttc>.7) a.nearMisses=(a.nearMisses||0)+1;
}
function draw(){
  const ai=window.__LOWTOWN_AI,test=window.__LOWTOWN_TEST;if(!ai||!test){requestAnimationFrame(draw);return;}
  const s=test.state(),a=ai.state||ai; record(); octx.clearRect(0,0,innerWidth,innerHeight);
  if(camera==='DEBUG'||camera==='TOP'||camera==='CHASE'){
    const cam={x:s.x,y:s.y};
    if(trail.length>1){octx.save();octx.strokeStyle='rgba(232,184,74,.55)';octx.lineWidth=2;octx.beginPath();trail.forEach((p,i)=>{const q=worldToScreen(p.x,p.y,cam);i?octx.lineTo(q.x,q.y):octx.moveTo(q.x,q.y);});octx.stroke();octx.restore();}
    const origin=worldToScreen(s.x,s.y,cam);
    const sensors=a.sensor||{};
    const rays=[[0,sensors.front],[-.34,sensors.frontLeft],[.34,sensors.frontRight],[-Math.PI/2,sensors.left],[Math.PI/2,sensors.right]];
    octx.save();octx.lineWidth=1.5;rays.forEach(([ang,len])=>{const l=Math.min(Number(len)||0,340),q=worldToScreen(s.x+Math.cos(s.a+ang)*l,s.y+Math.sin(s.a+ang)*l,cam);octx.strokeStyle=l<90?'rgba(212,82,58,.9)':'rgba(224,154,62,.42)';octx.beginPath();octx.moveTo(origin.x,origin.y);octx.lineTo(q.x,q.y);octx.stroke();});
    const v=Math.hypot(s.vx||0,s.vy||0),horizon=Math.max(80,Math.min(300,v*.9+80)),pq=worldToScreen(s.x+Math.cos(s.a)*horizon,s.y+Math.sin(s.a)*horizon,cam);octx.setLineDash([7,6]);octx.strokeStyle=a.prediction?.safe?'rgba(157,187,140,.9)':'rgba(212,82,58,.95)';octx.lineWidth=3;octx.beginPath();octx.moveTo(origin.x,origin.y);octx.lineTo(pq.x,pq.y);octx.stroke();octx.setLineDash([]);octx.fillStyle=a.prediction?.safe?'#9dbb8c':'#d4523a';octx.beginPath();octx.arc(pq.x,pq.y,5,0,Math.PI*2);octx.fill();octx.restore();
    if(a.dynamic?.nearest?.o){const h=a.dynamic.nearest.o,q=worldToScreen(h.x,h.y,cam);octx.save();octx.strokeStyle=a.prediction?.ttc<2?'#d4523a':'rgba(224,154,62,.6)';octx.lineWidth=3;octx.beginPath();octx.arc(q.x,q.y,14,0,Math.PI*2);octx.stroke();octx.restore();}
    if(a.goal){const q=worldToScreen(a.goal.x,a.goal.y,cam);octx.save();octx.strokeStyle='#e09a3e';octx.setLineDash([4,4]);octx.beginPath();octx.arc(q.x,q.y,12,0,Math.PI*2);octx.stroke();octx.restore();}
    if(camera==='DEBUG'&&a.route?.length){octx.save();octx.fillStyle='rgba(224,154,62,.7)';for(let i=a.node;i<Math.min(a.node+10,a.route.length);i++){const q=worldToScreen(a.route[i].x,a.route[i].y,cam);octx.beginPath();octx.arc(q.x,q.y,3,0,Math.PI*2);octx.fill();}octx.restore();}
  }
  readPanel(s,a); requestAnimationFrame(draw);
}
function readPanel(s,a){
  const p=a.prediction||{},ttc=Number.isFinite(p.ttc)?`${p.ttc.toFixed(2)}s`:'--',risk=Number(p.risk||0),c=a.control||{};
  const rc=risk>.8?'warn':'ok';
  document.querySelector('#ai-observer-data').innerHTML=[
    `MODE      <b>${a.mode||a.state||'IDLE'}</b>`,
    `POS       ${Math.round(s.x||0)}, ${Math.round(s.y||0)}   SPEED ${Math.round((s.speed||0)*.19)} km/h`,
    `CONTROL   G ${(+(c.throttle||0)).toFixed(2)}  B ${(+(c.brake||0)).toFixed(2)}  S ${(+(c.steer||0)).toFixed(2)}`,
    `SENSORS   F ${Math.round(a.sensor?.front||0)}  FL ${Math.round(a.sensor?.frontLeft||0)}  FR ${Math.round(a.sensor?.frontRight||0)}`,
    `TRAFFIC   ${a.dynamic?.count||0}   TTC <span class="${rc}">${ttc}</span>   RISK <span class="${rc}">${risk.toFixed(2)}</span>`,
    `ROUTE     ${a.node||0}/${a.route?.length||0}   REPLANS ${a.replans||0}   RECOVER ${a.recoveries||0}`,
    `DISTANCE  ${Math.round(s.distance||0)}   COLLISIONS ${s.collisions||0}`,
    `TRACE     ${trail.length} pts   MIN TTC ${Number.isFinite(a.prediction?.ttc)?a.prediction.ttc.toFixed(2):'--'}   ${paused?'|| PAUSED':'LIVE'}`
  ].join('<br>');
  const log=document.querySelector('#ai-observer-log');log.innerHTML=decisions.slice(-6).reverse().map(d=>`<div>${d.mode} · ${d.reason}</div>`).join('');
}

addEventListener('keydown',e=>{if(e.repeat)return;const k=e.key.toLowerCase();if(k==='f1')camera='CHASE';if(k==='f2')camera='TOP';if(k==='f3')camera='DEBUG';if(k==='p'){paused=!paused;if(window.__LOWTOWN_OBSERVER)window.__LOWTOWN_OBSERVER.paused=paused;}if(k==='o'&&paused)step=true;if(k==='f8'){const active=panel.style.display!=='none';panel.style.display=active?'none':'';help.style.display=active?'none':'';overlay.style.display=active?'none':'';}});

const timer=setInterval(()=>{if(window.__LOWTOWN_AI&&window.__LOWTOWN_TEST){window.__LOWTOWN_OBSERVER={active:true,get camera(){return camera},get paused(){return paused},set paused(v){paused=v},decisions};clearInterval(timer);draw();}},100);
