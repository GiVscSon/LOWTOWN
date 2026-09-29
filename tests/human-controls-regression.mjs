import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import * as core from '../src/game/test_drive_core.js';
import * as contacts from '../src/game/solid_contacts.js';
import * as coast from '../src/game/coastline.js';
import * as roaming from '../src/game/free_roam.js';
import * as street from '../src/game/street_network.js';
import * as traffic from '../src/game/traffic_turns.js';
import * as ocean from '../src/game/ocean_chunks.js';
import * as surfaces from '../src/game/surface_physics.js';
import * as incidents from '../src/game/city_incidents.js';
const noop=()=>{},events={},elements=new Map();let clock=0;
const element=id=>{if(elements.has(id))return elements.get(id);const listeners={};const e={style:{},classList:{add:noop,remove:noop},remove:noop,append:noop,appendChild:noop,listeners,addEventListener:(name,fn)=>listeners[name]=fn,getContext:()=>({})};elements.set(id,e);return e;};
const sandbox={Math,console,assert,performance:{now:()=>clock},navigator:{vibrate:noop},document:{readyState:'loading',getElementById:element,createElement:()=>element(Symbol()),querySelectorAll:()=>[],addEventListener:noop},window:{addEventListener:(name,fn)=>events[name]=fn},localStorage:{getItem:()=>null,setItem:noop},setTimeout:noop,setInterval:noop,requestAnimationFrame:noop,...core,...contacts,...coast,...roaming,...street,...traffic,...ocean,...surfaces,...incidents};
vm.createContext(sandbox);
const source=readFileSync(new URL('../src/main.js',import.meta.url),'utf8').replace(/^import .*;\n/gm,'');
vm.runInContext(source+`\ninitTopology();roam=createFreeRoam(player,parkedCars,buildings,trees,isPositionOnSolidGround,()=>{},solidProps,isPositionOnWaterObstacle);sound.init=()=>{};setupInputListeners();trafficCars.length=0;pedestrians.length=0;`,sandbox);
const run=s=>vm.runInContext(s,sandbox);
const press=code=>events.keydown({code,repeat:false,preventDefault:noop});
const release=code=>events.keyup({code,preventDefault:noop});
const step=n=>{for(let i=0;i<n;i++){clock+=1000/60;run('updatePhysics(1/60)');}};
run('Object.assign(player,{x:1200,y:1200,angle:0,speed:0,vx:0,vy:0});');
press('KeyE');assert.equal(run('roam.mode'),'foot');
run('Object.assign(player,{x:1140,y:1260});');
const before=run('projectIso(player.x,player.y)');press('ArrowUp');step(10);release('ArrowUp');const after=run('projectIso(player.x,player.y)');
assert(after.y<before.y-15,'up input must move up on screen');assert(Math.abs(after.x-before.x)<.01,'up input must not move sideways');
press('KeyE');assert.equal(run('roam.mode'),'sedan');
const start=run('player.x');press('KeyW');step(30);release('KeyW');assert(run('player.x')>start+60);
press('KeyD');step(10);release('KeyD');assert(run('player.angle')>0);
run('roam.resetToSedan(1600,1200,0);');
elements.get('btnGas').listeners.touchstart({cancelable:true,preventDefault:noop});step(12);elements.get('btnGas').listeners.touchend({cancelable:true,preventDefault:noop});
assert(run('player.x')>1610,'touch throttle must drive the car');assert.equal(run('state.keys.up'),false);
press('KeyW');events.blur();assert.equal(run('state.keys.up'),false,'lost focus must release controls');
const driven=[];
for(const type of ['van','truck','bike']){
  run(`roam.resetToSedan(1200,1200);roam.interact();const target_${type}=roam.fleet.find(c=>c.type==='${type}');Object.assign(player,{x:target_${type}.x+20,y:target_${type}.y});`);
  press('KeyE');assert.equal(run('roam.mode'),type);
  run('Object.assign(player,{x:1600,y:1200,angle:0,speed:0,vx:0,vy:0});');press('KeyW');step(25);release('KeyW');
  assert(run('player.x')>1615,`${type} must move with keyboard input`);driven.push(type);
}
run("roam.resetToSedan(1200,1200);roam.interact();Object.assign(player,{x:2490,y:1800});");press('KeyE');assert.equal(run('roam.mode'),'speedboat');
run('Object.assign(player,{x:2670,y:1370,angle:-Math.PI/2,speed:0});');press('KeyW');step(90);release('KeyW');assert(run('player.y')<1100,'boat must pass below the real bridge');
run("roam.resetToSedan(1200,1200);roam.interact();Object.assign(player,{x:1040,y:2130});");press('KeyE');assert.equal(run('roam.mode'),'helicopter');press('KeyQ');step(100);assert(run('roam.altitude')>110);press('KeyQ');step(160);assert.equal(run('roam.altitude'),0);press('KeyE');assert.equal(run('roam.mode'),'foot');
for(const type of ['tug','plane']){
  run(`roam.resetToSedan(1200,1200);roam.interact();const extra_${type}=roam.fleet.find(c=>c.type==='${type}');Object.assign(player,{x:extra_${type}.x+20,y:extra_${type}.y});`);
  press('KeyE');assert.equal(run('roam.mode'),type);
  if(type==='plane'){press('KeyW');step(70);release('KeyW');press('KeyQ');}
  const x=run('player.x'),y=run('player.y');press('KeyW');step(type==='plane'?150:50);release('KeyW');
  assert(Math.hypot(run('player.x')-x,run('player.y')-y)>25,`${type} did not respond to throttle: from ${x},${y} to ${run('player.x')},${run('player.y')} speed=${run('player.speed')}`);
  if(type==='plane')assert(run('roam.altitude')>50,`plane failed to climb in full-world setup: altitude=${run('roam.altitude')} x=${run('player.x')} y=${run('player.y')} speed=${run('player.speed')}`);
}
run('roam.resetToSedan(1200,1200);state.wanted=2;state.invulnTimer=99999;policeCars.length=0;');
let seenPolice=0;
for(let i=0;i<180;i++){
  step(1);seenPolice=Math.max(seenPolice,run('policeCars.length'));
  assert(run('policeCars.every(c=>onRoadSurface(c.x,c.y,roads,bridges,scenicRoads,roadEnds))'),'police left the road surface');
}
assert(seenPolice>0,'police must be able to spawn on the road network');
const responseMatrix=[[0,0,0,0],[1,2,0,0],[2,3,0,0],[3,4,0,0],[4,4,1,0],[5,4,1,1]];
for(const [level,patrols,tactical,guard] of responseMatrix){
  run(`state.wanted=${level};state.wantedCooldown=0;state.tacticalCallDispatched=false;state.guardCallDispatched=false;policeCars.length=0;updatePoliceAI(1/60);`);
  assert.equal(run(`wantedResponseProfile(${level}).patrolCount`),patrols,`wanted level ${level} patrol profile`);
  assert.equal(run(`wantedResponseProfile(${level}).tacticalCount`),tactical,`wanted level ${level} tactical profile`);
  assert.equal(run(`wantedResponseProfile(${level}).guardCount`),guard,`wanted level ${level} guard profile`);
  assert.equal(run("policeCars.filter(c=>c.role==='patrol').length"),patrols,`wanted level ${level} patrol dispatch`);
  assert.equal(run("policeCars.filter(c=>c.role==='tactical').length"),tactical,`wanted level ${level} tactical dispatch`);
  assert.equal(run("policeCars.filter(c=>c.role==='nationalGuard').length"),guard,`wanted level ${level} guard dispatch`);
  assert(run('policeCars.every(c=>policeFootprintOnRoad(c))'),`wanted level ${level} response vehicle footprint must stay on connected roads: ${run('JSON.stringify(policeCars.map(c=>({role:c.role,x:c.x,y:c.y,angle:c.angle,width:c.width,height:c.height,center:onRoadSurface(c.x,c.y,roads,bridges,scenicRoads,roadEnds),foot:policeFootprintOnRoad(c)})))')}`);
}
assert(run("policeCars.some(c=>c.role==='tactical'&&/police precinct/i.test(c.responseBase)&&c.route.length>0)"),'SWAT must route from the police precinct');
assert(run("policeCars.some(c=>c.role==='nationalGuard'&&/national guard armory/i.test(c.responseBase)&&c.route.length>0)"),'National Guard must route from the armory');
run('state.wanted=3;state.wantedCooldown=0;state.tacticalCallDispatched=false;state.guardCallDispatched=false;policeCars.length=0;Object.assign(player,{x:1200,y:1200,angle:0,speed:0});policeCars.push({role:"patrol",x:1224,y:1200,angle:0,speed:0,maxSpeed:0,route:[{x:1300,y:1200}],routeTimer:2});player.speed=4;updatePoliceAI(1/60);');
assert.equal(run('state.wanted'),4,'a deliberate moving collision with police should call tactical units');
run('state.wantedCooldown=0;player.speed=4;updatePoliceAI(1/60);updatePoliceAI(1/60);');
assert.equal(run('state.wanted'),5,'a second deliberate police collision should trigger the maximum wanted tier');
assert.equal(run("policeCars.filter(c=>c.role==='nationalGuard').length"),1,`maximum wanted tier should dispatch an armoured National Guard vehicle; wanted=${run('state.wanted')} bases=${run("JSON.stringify(buildings.filter(b=>/national guard|armory/i.test(b.sign||'')).map(b=>({sign:b.sign,civicType:b.civicType,x:b.x,y:b.y,w:b.w,h:b.h})))")} units=${run("JSON.stringify(policeCars.map(c=>({role:c.role,responseBase:c.responseBase,x:c.x,y:c.y,route:c.route?.length})))")}`);
// The descent must stop above a roof, not go through it to a floor-level hover.
const pilot={x:0,y:0,angle:0,speed:0,width:48,height:24,hp:100};
const flight=roaming.createFreeRoam(pilot,[],[{x:400,y:400,w:200,h:200,floors:6}],[],()=>true);
flight.interact();const heli=flight.fleet.find(c=>c.type==='helicopter');Object.assign(pilot,{x:heli.x+20,y:heli.y});flight.interact();flight.toggleFlight();for(let i=0;i<220;i++)flight.step({},1/60);
Object.assign(pilot,{x:500,y:500});flight.toggleFlight();for(let i=0;i<300;i++)flight.step({},1/60);assert(flight.altitude>=156,'descent crossed a building roof');
console.log('PASS: controls and transport regression plus five-tier patrol/SWAT/National Guard dispatch, road-bound units and pursuit escalation');
