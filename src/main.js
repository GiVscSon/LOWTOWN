import './style.css';
import './game/mobile_controls_v3.js';
import { WORLD } from './game/world.js';
import { ISLANDS, BRIDGES, isLand, islandAt } from './game/islands.js';
import { createTrafficSystem } from './game/traffic.js';
import { createPeopleSystem } from './game/people.js';
import { createEventSystem } from './game/events.js';
import { createMissionSystem } from './game/missions.js';
import { createAIDriver } from './game/ai_driver.js';
import { createTransportSystem } from './game/transport.js';
import { createTransportController } from './game/transport_controller.js';
import { createCityVisuals } from './game/city_visuals.js';
import { ROAD_GRID, ROAD_LIMIT, ROAD_WIDTH, ROAD_HALF_WIDTH, ROAD_EDGE_TOLERANCE } from './game/road_authority.js';
import { buildLayeredRoadTopology, layeredRoadSegments, nearestLayeredRoadPoint, nearestAnyRoadPoint, ROAD_LEVELS, ROAD_LEVEL_Z } from './game/road_topology.js';
import { vehicleWorldBlocked } from './game/vehicle_collision.js';

const app=document.querySelector('#app');
app.innerHTML=`<main class="shell"><header class="hud"><div class="brand"><span>LOW</span>TOWN <b>// NIGHT SHIFT</b></div><div class="status"><i></i> FREE ROAM <strong id="speed">000</strong> KM/H</div></header><section class="game-wrap"><canvas id="game"></canvas><div class="mission"><small id="job-id">JOB 01</small><strong id="job-title">SHAKE THE NIGHT</strong><span id="job-text">Drive to the amber marker.</span></div><div class="hint">WASD / ARROWS · SPACE HANDBRAKE · I AI DRIVE · R RESET · N NEXT JOB</div><div class="toast" id="toast">ENGINE READY</div></section></main>`;
const canvas=document.querySelector('#game'),ctx=canvas.getContext('2d');
const toast=document.querySelector('#toast');
const jobId=document.querySelector('#job-id');
const jobTitle=document.querySelector('#job-title');
const jobText=document.querySelector('#job-text');
const speedEl=document.querySelector('#speed');
const keys=new Set();
addEventListener('keydown',e=>{const k=e.key.toLowerCase();keys.add(k);if(['arrowup','arrowdown','arrowleft','arrowright',' ','n','r','i'].includes(k))e.preventDefault();});
addEventListener('keyup',e=>keys.delete(e.key.toLowerCase()));
const buildings=WORLD.buildings||[];
const lamps=WORLD.lamps||[];
const cityVisuals=createCityVisuals();
const testMode=new URLSearchParams(location.search).has('autotest');
const roadNodes=buildLayeredRoadTopology({isLand,blocked:()=>false,limit:ROAD_LIMIT,grid:ROAD_GRID});
const roadLines=layeredRoadSegments(roadNodes);
const streetNodes=roadNodes.filter(n=>n.level===ROAD_LEVELS.STREET);
const ROAD_CORRIDOR=ROAD_HALF_WIDTH+ROAD_EDGE_TOLERANCE;
function onRoadCorridor(x,y,level=ROAD_LEVELS.STREET){const hit=nearestLayeredRoadPoint(x,y,roadNodes,level)||nearestAnyRoadPoint(x,y,roadNodes);return!!hit&&hit.distance<=ROAD_CORRIDOR;}
const blocked=(x,y,level=ROAD_LEVELS.STREET)=>{if(level!==ROAD_LEVELS.STREET)return false;const r=18;if(buildings.some(([bx,by,bw,bh])=>x>bx-r&&x<bx+bw+r&&y>by-r&&y<by+bh+r))return true;return!onRoadCorridor(x,y,level);};
function nearestRoadPoint(x,y,level=S.car?.roadLevel??ROAD_LEVELS.STREET){return nearestLayeredRoadPoint(x,y,roadNodes,level)||nearestAnyRoadPoint(x,y,roadNodes);}
const start=nearestRoadPoint(-120,0,ROAD_LEVELS.STREET)||{x:-120,y:0,heading:0,level:ROAD_LEVELS.STREET};
const playerTransport=createTransportController('sedan',{x:start.x,y:start.y,a:start.heading});
playerTransport.state.roadLevel=ROAD_LEVELS.STREET;
const traffic=createTrafficSystem({nodes:streetNodes,blocked});
const people=createPeopleSystem({nodes:streetNodes,blocked});
const events=createEventSystem({nodes:streetNodes});
const missions=createMissionSystem(WORLD);
const ai=createAIDriver({nodes:roadNodes,blocked,getTraffic:()=>traffic.cars});
const transport=createTransportSystem();
const S={car:playerTransport.state,cam:{x:start.x,y:start.y},target:WORLD.mission||{x:start.x,y:start.y},t:0,done:false,damage:0,collisions:0,trafficHits:0,stuck:0,maxSpeed:0,distance:0,missionReward:0,money:0,completedJobs:0,aiActive:testMode,aiDebug:{frames:0,elapsed:0,movedDistance:0,initialX:start.x,initialY:start.y,last:null}};
S.car.roadLevel=ROAD_LEVELS.STREET;
function resize(){const r=canvas.getBoundingClientRect(),d=Math.min(devicePixelRatio||1,2);canvas.width=Math.max(1,Math.round(r.width*d));canvas.height=Math.max(1,Math.round(r.height*d));ctx.setTransform(d,0,0,d,0,0);}addEventListener('resize',resize);resize();
function iso(x,y,z=ROAD_LEVEL_Z[ROAD_LEVELS.STREET]){return{x:canvas.clientWidth/2+(x-S.cam.x)*.78+(y-S.cam.y)*.42,y:canvas.clientHeight/2+(y-S.cam.y)*.42-(x-S.cam.x)*.78-z*.72};}
function poly(points,fill,stroke){ctx.beginPath();points.forEach((p,i)=>i?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y));ctx.closePath();ctx.fillStyle=fill;ctx.fill();if(stroke){ctx.strokeStyle=stroke;ctx.stroke();}}
function ellipseWorld(island){const pts=[];for(let i=0;i<48;i++){const a=i/48*Math.PI*2;pts.push(iso(island.center.x+Math.cos(a)*island.rx,island.center.y+Math.sin(a)*island.ry,0));}return pts;}
function bridgeEndpoints(b){if(Array.isArray(b.points)&&b.points.length>=2)return[{x:b.points[0][0],y:b.points[0][1]},{x:b.points[b.points.length-1][0],y:b.points[b.points.length-1][1]}];return[{x:b.a.x,y:b.a.y},{x:b.b.x,y:b.b.y}];}
function terrain(){ctx.fillStyle='#0b171b';ctx.fillRect(0,0,canvas.clientWidth,canvas.clientHeight);for(const island of ISLANDS){poly(ellipseWorld(island),island.colors.land,'#0b0d0f');const inner={...island,rx:island.rx-42,ry:island.ry-42};poly(ellipseWorld(inner),island.biome==='FOREST_HIGHLAND'?'#263329':island.biome==='INDUSTRIAL_COAST'?'#292c2d':'#24272a');}for(const b of BRIDGES){const[ep0,ep1]=bridgeEndpoints(b);const a=iso(ep0.x,ep0.y,ROAD_LEVEL_Z[ROAD_LEVELS.STREET]),z=iso(ep1.x,ep1.y,ROAD_LEVEL_Z[ROAD_LEVELS.STREET]);ctx.strokeStyle='#4b4035';ctx.lineWidth=b.width||40;ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(z.x,z.y);ctx.stroke();ctx.strokeStyle='#d6a15a';ctx.lineWidth=2;ctx.setLineDash([10,10]);ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(z.x,z.y);ctx.stroke();ctx.setLineDash([]);}}
function roads(){terrain();}
function building(x,y,w,h){const island=islandAt(x+w/2,y+h/2);if(!island)return;const z=ROAD_LEVEL_Z[ROAD_LEVELS.STREET],top=[iso(x,y,z),iso(x+w,y,z),iso(x+w,y+h,z),iso(x,y+h,z)],f=top.map(p=>({x:p.x,y:p.y-(island.biome==='FOREST_HIGHLAND'?48:70)}));poly(f,island.biome==='INDUSTRIAL_COAST'?'#3a3b3b':'#34373c','#111317');poly([f[0],f[1],top[1],top[0]],'#292b2e');poly([f[1],f[2],top[2],top[1]],'#202226');for(let yy=18;yy<h;yy+=38)for(let xx=22;xx<w;xx+=48){if(((xx+yy)/38|0)%3===0)continue;const p=iso(x+xx,y+yy,z);ctx.fillStyle='rgba(224,154,62,.32)';ctx.fillRect(p.x-3,p.y-2,6,4);}}
function lamp(x,y){if(!isLand(x,y))return;const p=iso(x,y,ROAD_LEVEL_Z[ROAD_LEVELS.STREET]);ctx.strokeStyle='#55585d';ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(p.x,p.y);ctx.lineTo(p.x,p.y-35);ctx.stroke();ctx.fillStyle='#e09a3e';ctx.beginPath();ctx.arc(p.x,p.y-39,4,0,Math.PI*2);ctx.fill();}
function target(){const p=iso(S.target.x,S.target.y,ROAD_LEVEL_Z[S.car.roadLevel]??ROAD_LEVEL_Z[1]),r=18+Math.sin(S.t*5)*4;ctx.strokeStyle='#e09a3e';ctx.lineWidth=3;ctx.beginPath();ctx.arc(p.x,p.y,r,0,Math.PI*2);ctx.stroke();ctx.fillStyle='rgba(224,154,62,.18)';ctx.fill();ctx.fillStyle='#e09a3e';ctx.font='bold 10px monospace';ctx.textAlign='center';ctx.fillText('DROP',p.x,p.y-27);}
function playerCar(){const z=ROAD_LEVEL_Z[S.car.roadLevel]??ROAD_LEVEL_Z[1],p=iso(S.car.x,S.car.y,z),f=iso(S.car.x+Math.cos(S.car.a)*12,S.car.y+Math.sin(S.car.a)*12,z),ang=Math.atan2(f.y-p.y,f.x-p.x);ctx.save();ctx.translate(p.x,p.y);ctx.rotate(ang);ctx.lineJoin='round';ctx.fillStyle='rgba(0,0,0,.62)';ctx.beginPath();ctx.ellipse(0,10,31,8,0,0,Math.PI*2);ctx.fill();ctx.fillStyle='#111419';ctx.beginPath();ctx.roundRect(-31,-10,62,22,6);ctx.fill();ctx.fillStyle='#e8b84a';ctx.strokeStyle='#171a1e';ctx.lineWidth=2;ctx.beginPath();ctx.roundRect(-28,-9,56,20,5);ctx.fill();ctx.stroke();ctx.fillStyle='#252b31';ctx.beginPath();ctx.moveTo(-13,-7);ctx.lineTo(10,-7);ctx.lineTo(19,2);ctx.lineTo(13,7);ctx.lineTo(-16,7);ctx.lineTo(-20,2);ctx.closePath();ctx.fill();ctx.fillStyle='#59636b';ctx.globalAlpha=.72;ctx.beginPath();ctx.moveTo(-10,-5);ctx.lineTo(8,-5);ctx.lineTo(14,1);ctx.lineTo(-14,1);ctx.closePath();ctx.fill();ctx.globalAlpha=1;ctx.fillStyle='#0b0d10';ctx.fillRect(-22,-13,11,4);ctx.fillRect(11,-13,11,4);ctx.fillRect(-22,9,11,4);ctx.fillRect(11,9,11,4);ctx.fillStyle='#fff0a6';ctx.fillRect(24,-5,4,6);ctx.fillStyle='#d4523a';ctx.fillRect(-28,3,4,6);ctx.fillStyle='rgba(255,255,255,.18)';ctx.fillRect(-4,-8,7,2);ctx.restore();}
function speed(){return Math.hypot(S.car.vx||0,S.car.vy||0);}
function updateRoadLevel(){const current=S.car.roadLevel??ROAD_LEVELS.STREET;const hit=nearestLayeredRoadPoint(S.car.x,S.car.y,roadNodes,current);if(hit&&hit.distance<=ROAD_CORRIDOR)return;const any=nearestAnyRoadPoint(S.car.x,S.car.y,roadNodes);if(any&&any.distance<=ROAD_CORRIDOR)S.car.roadLevel=any.level;}
function keepPlayerOnRoad(before){updateRoadLevel();const level=S.car.roadLevel??ROAD_LEVELS.STREET;const near=nearestLayeredRoadPoint(S.car.x,S.car.y,roadNodes,level);const blockedNow=vehicleWorldBlocked(S.car.x,S.car.y,S.car.a,roadLines,{length:56,width:28})||!near||near.distance>ROAD_CORRIDOR;if(blockedNow){const fallback=nearestLayeredRoadPoint(before.x,before.y,roadNodes,level)||nearestAnyRoadPoint(before.x,before.y,roadNodes);if(fallback){S.car.x=fallback.x;S.car.y=fallback.y;S.car.roadLevel=fallback.level??level;S.car.a=fallback.heading;}else{S.car.x=before.x;S.car.y=before.y;S.car.a=before.a;}S.car.v*=.2;S.car.vx*=.2;S.car.vy*=.2;S.car.yawRate*=.2;S.stuck++;return false;}S.stuck=0;return true;}
function drive(input,dt){const before={x:S.car.x,y:S.car.y,a:S.car.a};playerTransport.step(dt,input);keepPlayerOnRoad(before);S.distance+=speed()*dt;}
function trafficCollisions(){const now=performance.now();for(const n of traffic.cars){if((n.level??ROAD_LEVELS.STREET)!==(S.car.roadLevel??ROAD_LEVELS.STREET))continue;const dx=n.x-S.car.x,dy=n.y-S.car.y,d=Math.hypot(dx,dy);if(d<34&&now-(n.hitAt||0)>550){const nx=dx/(d||1),ny=dy/(d||1),impact=Math.max(20,speed()-n.v);S.car.vx-=nx*impact*.12;S.car.vy-=ny*impact*.12;n.v=Math.max(0,n.v-impact*.12);n.x-=nx*(34-d)*.5;n.y-=ny*(34-d)*.5;n.hitAt=now;S.trafficHits++;S.damage+=Math.min(3,impact/90);toast.textContent='TRAFFIC HIT';}}}
function refreshMission(){const m=missions.state();if(!m)return;const idx=missions.templates.findIndex(t=>t.id===m.id);S.target=m.target||S.target;jobId.textContent=`JOB ${String(idx+1).padStart(2,'0')}`;jobTitle.textContent=m.title||'FREE ROAM';jobText.textContent=m.text||'Drive through LOWTOWN.';}
function reset(){const near=nearestLayeredRoadPoint(S.car.x,S.car.y,roadNodes,S.car.roadLevel??ROAD_LEVELS.STREET)||start;S.car.x=near.x;S.car.y=near.y;S.car.z=ROAD_LEVEL_Z[near.level]??0;S.car.roadLevel=near.level;S.car.a=near.heading;S.car.v=0;S.car.vx=0;S.car.vy=0;S.car.vz=0;S.car.yawRate=0;S.car.distance=0;S.car.age=0;playerTransport.resetActuators();playerTransport.setVehicle('sedan');S.cam.x=S.car.x;S.cam.y=S.car.y;S.done=false;S.damage=0;S.collisions=0;S.trafficHits=0;S.stuck=0;S.maxSpeed=0;S.distance=0;S.aiDebug={frames:0,elapsed:0,movedDistance:0,initialX:S.car.x,initialY:S.car.y,last:null};if(S.aiActive)ai.start(S.car);else ai.state.enabled=false;toast.classList.remove('visible','hot');refreshMission();}
function toggleAI(){S.aiActive=!S.aiActive;if(S.aiActive){ai.start(S.car);toast.textContent='AI DRIVE // ONLINE';}else{ai.state.enabled=false;toast.textContent='AI DRIVE // OFF';}}
function updateAI(dt){const before={x:S.car.x,y:S.car.y};const control=ai.update(S.car,dt);if(control)drive(control,dt);const moved=Math.hypot(S.car.x-before.x,S.car.y-before.y);S.aiDebug.frames++;S.aiDebug.elapsed+=dt;S.aiDebug.movedDistance+=moved;S.aiDebug.last={command:{...control},prediction:{ttc:ai.state.prediction.ttc,risk:ai.state.prediction.risk,safe:ai.state.prediction.safe}};return control;}
function update(dt){if(keys.has('n')){if(missions.next()){S.done=false;refreshMission();}keys.delete('n');}if(keys.has('r')){reset();keys.delete('r');}if(keys.has('i')){toggleAI();keys.delete('i');}if(S.aiActive)updateAI(dt);else{const u=keys.has('w')||keys.has('arrowup'),d=keys.has('s')||keys.has('arrowdown'),l=keys.has('a')||keys.has('arrowleft'),r=keys.has('d')||keys.has('arrowright');drive({throttle:u?1:d?-1:0,brake:d?1:0,steer:(r?1:0)-(l?1:0),handbrake:keys.has(' ')},dt);}events.update(dt,S.car);traffic.update(dt,S.car,events.state());people.update(dt,S.car,0);transport.update(dt);trafficCollisions();if(!S.done&&missions.update(S.car)){S.done=true;S.missionReward+=missions.state().reward||0;S.money+=missions.state().reward||0;toast.textContent=`JOB COMPLETE // +$${missions.state().reward||0}`;toast.classList.add('hot');}const v=speed();S.maxSpeed=Math.max(S.maxSpeed,v);S.cam.x+=(S.car.x-S.cam.x)*Math.min(1,dt*7);S.cam.y+=(S.car.y-S.cam.y)*Math.min(1,dt*7);speedEl.textContent=String(Math.round(v*.19)).padStart(3,'0');}
function draw(){roads();for(const b of buildings)building(...b);for(const l of lamps)lamp(...l);cityVisuals.draw(ctx,(x,y)=>iso(x,y,ROAD_LEVEL_Z[ROAD_LEVELS.STREET]),buildings,lamps,S.t);traffic.draw(ctx,(x,y)=>iso(x,y,ROAD_LEVEL_Z[ROAD_LEVELS.STREET]));people.draw(ctx,(x,y)=>iso(x,y,ROAD_LEVEL_Z[ROAD_LEVELS.STREET]),S.car);transport.draw(ctx,(x,y)=>iso(x,y,ROAD_LEVEL_Z[ROAD_LEVELS.STREET]),S.t*1000);target();playerCar();}
let last=performance.now();function frame(now){const dt=Math.min(.05,Math.max(.001,(now-last)/1000));last=now;S.t+=dt;update(dt);draw();requestAnimationFrame(frame);}requestAnimationFrame(frame);
window.__LOWTOWN_AI=ai;
window.__LOWTOWN_TRANSPORT={player:playerTransport,system:transport.state};
window.__LOWTOWN_ROAD_TOPOLOGY={nodes:roadNodes,levels:ROAD_LEVELS,z:ROAD_LEVEL_Z,segments:roadLines,state:()=>({level:S.car.roadLevel,x:S.car.x,y:S.car.y,roadDistance:nearestLayeredRoadPoint(S.car.x,S.car.y,roadNodes,S.car.roadLevel??1)?.distance??Infinity})};
window.__LOWTOWN_TEST={state:()=>({x:S.car.x,y:S.car.y,z:S.car.z,roadLevel:S.car.roadLevel,speed:speed(),maxSpeed:S.maxSpeed,distance:S.distance,collisions:S.collisions,trafficHits:S.trafficHits,damage:S.damage,stuck:S.stuck,recoveries:ai.state.recoveries,replans:ai.state.replans,safeStarts:ai.state.safeStarts,trafficCars:traffic.cars.length,pedestrians:people.people.length,missionComplete:S.done,missionReward:S.missionReward,mode:ai.state.mode,ttc:ai.state.prediction.ttc,risk:S.aiActive?ai.state.prediction.risk:0,aiActive:S.aiActive,roadDistance:nearestLayeredRoadPoint(S.car.x,S.car.y,roadNodes,S.car.roadLevel??1)?.distance??Infinity})};
if(testMode)reset();
