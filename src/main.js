import './style.css';
import { WORLD } from './game/world.js';

const app = document.querySelector('#app');
app.innerHTML = `<main class="shell"><header class="hud"><div class="brand"><span>LOW</span>TOWN <b>// NIGHT SHIFT</b></div><div class="status"><i></i> FREE ROAM <strong id="speed">000</strong> KM/H</div></header><section class="game-wrap"><canvas id="game"></canvas><div class="mission"><small>JOB 01</small><strong>SHAKE THE NIGHT</strong><span>Drive to the amber marker.</span></div><div class="hint">WASD / ARROWS · SPACE HANDBRAKE · R RESET</div><div class="toast" id="toast">ENGINE READY</div><div class="touch" aria-label="Touch controls"><button data-key="arrowup">▲</button><div><button data-key="arrowleft">◀</button><button data-key=" ">■</button><button data-key="arrowright">▶</button></div><button data-key="arrowdown">▼</button></div></section></main>`;

const canvas = document.querySelector('#game');
const ctx = canvas.getContext('2d');
const speedEl = document.querySelector('#speed');
const toast = document.querySelector('#toast');
const keys = new Set();
addEventListener('keydown', e => { keys.add(e.key.toLowerCase()); if (['arrowup','arrowdown','arrowleft','arrowright',' '].includes(e.key.toLowerCase())) e.preventDefault(); });
addEventListener('keyup', e => keys.delete(e.key.toLowerCase()));
document.querySelectorAll('[data-key]').forEach(button => { const key=button.dataset.key; const press=e=>{e.preventDefault();keys.add(key);button.classList.add('pressed')}; const release=e=>{e.preventDefault();keys.delete(key);button.classList.remove('pressed')}; button.addEventListener('pointerdown',press); button.addEventListener('pointerup',release); button.addEventListener('pointercancel',release); button.addEventListener('pointerleave',release); });

const buildings=WORLD.buildings, lamps=WORLD.lamps;
const testMode=new URLSearchParams(location.search).has('autotest');
const GRID=160;
const S={car:{x:0,y:0,a:-0.35,vx:0,vy:0},cam:{x:0,y:0},target:WORLD.mission,t:0,done:false,damage:0,collisions:0,stuck:0,maxSpeed:0,distance:0,test:{active:testMode,node:0,lap:0,lastX:0,lastY:0,timer:0,recoveries:0,visited:new Set()}};

function resize(){const r=canvas.getBoundingClientRect(),d=Math.min(devicePixelRatio||1,2);canvas.width=r.width*d;canvas.height=r.height*d;ctx.setTransform(d,0,0,d,0,0)}
addEventListener('resize',resize);resize();
function iso(x,y){return{x:canvas.clientWidth/2+(x-S.cam.x)*.78+(y-S.cam.y)*.42,y:canvas.clientHeight/2+(y-S.cam.y)*.42-(x-S.cam.x)*.78}}
function poly(p,f,s){ctx.beginPath();p.forEach((q,i)=>i?ctx.lineTo(q.x,q.y):ctx.moveTo(q.x,q.y));ctx.closePath();ctx.fillStyle=f;ctx.fill();if(s){ctx.strokeStyle=s;ctx.stroke()}}
function roads(){ctx.fillStyle='#14161a';ctx.fillRect(0,0,canvas.clientWidth,canvas.clientHeight);for(let i=-1600;i<=1600;i+=GRID){const a=iso(i,-1700),b=iso(i,1700),c=iso(-1700,i),d=iso(1700,i);ctx.strokeStyle='#272a2f';ctx.lineWidth=92;ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);ctx.stroke();ctx.beginPath();ctx.moveTo(c.x,c.y);ctx.lineTo(d.x,d.y);ctx.stroke()}ctx.setLineDash([18,20]);ctx.lineWidth=2;ctx.strokeStyle='rgba(224,154,62,.28)';for(let i=-1600;i<=1600;i+=GRID){const a=iso(i,-1700),b=iso(i,1700),c=iso(-1700,i),d=iso(1700,i);ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);ctx.stroke();ctx.beginPath();ctx.moveTo(c.x,c.y);ctx.lineTo(d.x,d.y);ctx.stroke()}ctx.setLineDash([])}
function building(x,y,w,h){const top=[iso(x,y),iso(x+w,y),iso(x+w,y+h),iso(x,y+h)],f=top.map(p=>({x:p.x,y:p.y-70}));poly(f,'#34373c','#111317');poly([f[0],f[1],top[1],top[0]],'#26292e');poly([f[1],f[2],top[2],top[1]],'#1e2125');for(let yy=18;yy<h;yy+=38)for(let xx=22;xx<w;xx+=48){if(((xx+yy)/38|0)%3===0)continue;const p=iso(x+xx,y+yy);ctx.fillStyle='rgba(224,154,62,.32)';ctx.fillRect(p.x-3,p.y-2,6,4)}}
function lamp(x,y){const p=iso(x,y);ctx.strokeStyle='#55585d';ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(p.x,p.y);ctx.lineTo(p.x,p.y-35);ctx.stroke();ctx.fillStyle='#e09a3e';ctx.beginPath();ctx.arc(p.x,p.y-39,4,0,7);ctx.fill()}
function target(){const p=iso(S.target.x,S.target.y),r=18+Math.sin(S.t*5)*4;ctx.strokeStyle='#e09a3e';ctx.lineWidth=3;ctx.beginPath();ctx.arc(p.x,p.y,r,0,7);ctx.stroke();ctx.fillStyle='rgba(224,154,62,.18)';ctx.fill();ctx.fillStyle='#e09a3e';ctx.font='bold 10px monospace';ctx.textAlign='center';ctx.fillText('DROP',p.x,p.y-27)}
function car(){const p=iso(S.car.x,S.car.y);ctx.save();ctx.translate(p.x,p.y);ctx.rotate(-S.car.a-.15);ctx.shadowColor='rgba(0,0,0,.65)';ctx.shadowBlur=16;ctx.fillStyle='#08090b';ctx.fillRect(-22,-12,44,24);ctx.shadowBlur=0;ctx.fillStyle='#e8b84a';ctx.fillRect(-18,-9,36,18);ctx.fillStyle='#15171b';ctx.fillRect(-9,-7,16,14);ctx.fillStyle='#d4523a';ctx.fillRect(13,-7,5,4);ctx.fillRect(13,3,5,4);ctx.restore()}
function speed(){return Math.hypot(S.car.vx,S.car.vy)}
function blocked(x,y){const r=18;return buildings.some(([bx,by,bw,bh])=>x>bx-r&&x<bx+bw+r&&y>by-r&&y<by+bh+r)}
function openRoad(x,y){return !blocked(x,y)}
function recover(){const c=S.car;const candidates=[[GRID,0],[-GRID,0],[0,GRID],[0,-GRID],[GRID,GRID],[-GRID,GRID],[GRID,-GRID],[-GRID,-GRID],[0,0]];let best=null;for(const [dx,dy] of candidates){const x=Math.round((c.x+dx)/GRID)*GRID,y=Math.round((c.y+dy)/GRID)*GRID;if(openRoad(x,y)){best={x,y};break}}if(best){c.x=best.x;c.y=best.y}c.vx=0;c.vy=0;S.test.recoveries++;S.stuck++;toast.textContent='ROUTE RECOVERED'}

function drive(dt,throttle,brake,steer,handbrake=false){const c=S.car;const sub=Math.max(1,Math.ceil(dt/(1/120)));const h=dt/sub;for(let n=0;n<sub;n++){
 const fx=Math.cos(c.a),fy=Math.sin(c.a),rx=-fy,ry=fx;const fs=c.vx*fx+c.vy*fy,ls=c.vx*rx+c.vy*ry;
 const engine=throttle*460;c.vx+=fx*engine*h;c.vy+=fy*engine*h;
 if(brake){const amount=fs>10?Math.min(Math.abs(fs),760*brake*h):260*brake*h;c.vx-=fx*Math.sign(fs||1)*amount;c.vy-=fy*Math.sign(fs||1)*amount}
 const grip=handbrake?2.0:10.5;const correction=Math.min(1,grip*h);c.vx-=rx*ls*correction;c.vy-=ry*ls*correction;
 const drag=handbrake?.972:.993;c.vx*=Math.pow(drag,h*60);c.vy*=Math.pow(drag,h*60);
 const cur=c.vx*fx+c.vy*fy;const authority=Math.min(1,Math.abs(cur)/55);const steerRate=(handbrake?1.65:1.9)*authority; c.a+=steer*steerRate*h*(cur>=0?1:-1);
 const nfx=Math.cos(c.a),nfy=Math.sin(c.a),forward=c.vx*nfx+c.vy*nfy;if(forward>520){const e=forward-520;c.vx-=nfx*e;c.vy-=nfy*e}if(forward<-180){const e=forward+180;c.vx-=nfx*e;c.vy-=nfy*e}
 const nx=c.x+c.vx*h,ny=c.y+c.vy*h;if(!blocked(nx,ny)){c.x=nx;c.y=ny}else{const oldV=speed();let moved=false;if(!blocked(nx,c.y)){c.x=nx;moved=true}else if(!blocked(c.x,ny)){c.y=ny;moved=true}if(!moved){c.vx*= -0.12;c.vy*= -0.12}S.collisions++;S.damage+=Math.max(.5,oldV/220);toast.textContent='BODY HIT'}
 }}

function buildRoadNodes(){const nodes=[];for(let x=-1280;x<=1280;x+=GRID)for(let y=-1280;y<=1280;y+=GRID)if(openRoad(x,y))nodes.push({x,y});return nodes}
const roadNodes=buildRoadNodes();
function nearestNode(x,y){let best=roadNodes[0],bd=Infinity;for(const n of roadNodes){const d=(n.x-x)**2+(n.y-y)**2;if(d<bd){bd=d;best=n}}return best}
function chooseNode(){const origin=nearestNode(S.car.x,S.car.y);const pool=roadNodes.filter(n=>Math.hypot(n.x-origin.x,n.y-origin.y)>320);let candidate=pool[(Math.random()*pool.length)|0]||origin;return candidate}
function autonomousDrive(dt){let target=roadNodes[S.test.node];if(!target||Math.hypot(target.x-S.car.x,target.y-S.car.y)<42){target=chooseNode();S.test.node=roadNodes.indexOf(target);S.test.visited.add(S.test.node);if(S.test.visited.size>=Math.min(18,roadNodes.length)){S.test.lap++;S.test.visited.clear()}}
 const dx=target.x-S.car.x,dy=target.y-S.car.y,desired=Math.atan2(dy,dx);let d=desired-S.car.a;while(d>Math.PI)d-=Math.PI*2;while(d<-Math.PI)d+=Math.PI*2;const v=speed();const turn=Math.abs(d);const steer=Math.max(-1,Math.min(1,d*2.0));const cornerSpeed=Math.max(90,420-turn*150);const throttle=v<cornerSpeed?.92:.18;const brake=v>cornerSpeed+35?Math.min(1,(v-cornerSpeed)/180):0;drive(dt,throttle,brake,steer,turn>1.45&&v>250);
 S.test.timer+=dt;S.distance+=v*dt;if(S.test.timer>2){const moved=Math.hypot(S.car.x-S.test.lastX,S.car.y-S.test.lastY);if(moved<28&&v<22)recover();S.test.lastX=S.car.x;S.test.lastY=S.car.y;S.test.timer=0}}
function reset(){S.car={x:0,y:0,a:-.35,vx:0,vy:0};S.cam={x:0,y:0};S.done=false;S.damage=0;S.collisions=0;S.stuck=0;S.maxSpeed=0;S.distance=0;S.test.node=0;S.test.timer=0;S.test.visited.clear();toast.textContent='ENGINE READY';toast.classList.remove('hot')}
function update(dt){if(S.test.active)autonomousDrive(dt);else{const u=keys.has('w')||keys.has('arrowup'),d=keys.has('s')||keys.has('arrowdown'),l=keys.has('a')||keys.has('arrowleft'),r=keys.has('d')||keys.has('arrowright');drive(dt,u?1:0,d?1:0,(r?1:0)-(l?1:0),keys.has(' '));S.distance+=speed()*dt}const v=speed();S.maxSpeed=Math.max(S.maxSpeed,v);S.cam.x+=(S.car.x-S.cam.x)*Math.min(1,dt*5);S.cam.y+=(S.car.y-S.cam.y)*Math.min(1,dt*5);if(!S.done&&Math.hypot(S.car.x-S.target.x,S.car.y-S.target.y)<S.target.radius){S.done=true;S.car.vx=0;S.car.vy=0;toast.textContent=`JOB COMPLETE // +$${S.target.reward}`;toast.classList.add('hot')}if(keys.has('r')){reset();keys.delete('r')}speedEl.textContent=String(Math.round(v*.19)).padStart(3,'0')}
function drawTestOverlay(){if(!S.test.active)return;const lines=['AI DRIVER // FREE ROAM','ROUTE '+S.test.node,'COLLISIONS '+S.collisions+'  DAMAGE '+S.damage.toFixed(1),'MAX '+Math.round(S.maxSpeed*.19)+' KM/H  RECOVERIES '+S.test.recoveries];ctx.save();ctx.font='11px monospace';ctx.textAlign='left';lines.forEach((line,i)=>{ctx.fillStyle=i===0?'#e8b84a':'#a6abb1';ctx.fillText(line,18,92+i*16)});ctx.restore()}
function draw(){S.t+=1/60;roads();buildings.forEach(b=>building(...b));lamps.forEach(l=>lamp(...l));if(!S.done)target();car();drawTestOverlay()}
window.__LOWTOWN_TEST={state:()=>({x:S.car.x,y:S.car.y,speed:speed(),maxSpeed:S.maxSpeed,distance:S.distance,collisions:S.collisions,damage:S.damage,stuck:S.stuck,recoveries:S.test.recoveries,missionComplete:S.done}),start:()=>{S.test.active=true},stop:()=>{S.test.active=false},reset};
let last=performance.now();function loop(now){const dt=Math.min(.05,(now-last)/1000);last=now;update(dt);draw();requestAnimationFrame(loop)}requestAnimationFrame(loop);
