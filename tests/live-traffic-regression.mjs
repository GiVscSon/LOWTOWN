import * as authoredWorld from '../src/game/authored_archipelago.js';
import { PLANE_RUNWAYS as LEGACY_RUNWAYS } from '../src/game/free_roam.js';
import * as emergencyPassing from '../src/game/emergency_passing.js';
import * as streetNetwork from '../src/game/street_network.js';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { resolveContact, resolveScenery, contact, chassis } from '../src/game/solid_contacts.js';
import { advanceTrafficCar, resolveTrafficPair } from '../src/game/traffic_turns.js';
import { coastPoints, pointInCoast, pointInBeach, BEACH_WIDTH } from '../src/game/coastline.js';
import * as ocean from '../src/game/ocean_chunks.js';
import * as surfaces from '../src/game/surface_physics.js';
import * as incidents from '../src/game/city_incidents.js';
import { projectIso, velocityForHeading, routeInput } from '../src/game/test_drive_core.js';
const noop=()=>{};
const element={style:{},classList:{add:noop,remove:noop},appendChild:noop,remove:noop,addEventListener:noop,getContext:()=>({})};
let clock=0;
const sandbox={...authoredWorld,LEGACY_RUNWAYS,...emergencyPassing,...streetNetwork,...ocean,...surfaces,...incidents,Math,console,advanceClock:()=>clock+=1000/60,performance:{now:()=>clock},document:{readyState:'loading',getElementById:()=>({...element}),createElement:()=>({...element}),querySelectorAll:()=>[],addEventListener:noop},window:{addEventListener:noop},localStorage:{getItem:()=>null,setItem:noop},setTimeout:noop,setInterval:noop,requestAnimationFrame:noop,resolveContact,resolveScenery,contact,chassis,advanceTrafficCar,resolveTrafficPair,coastPoints,pointInCoast,pointInBeach,BEACH_WIDTH,projectIso,velocityForHeading,routeInput};
vm.createContext(sandbox);
const source=readFileSync(new URL('../src/main.js',import.meta.url),'utf8').replace(/^import .*;\n/gm,'');
vm.runInContext(source+`
initTopology();
let maxJump=0,water=0,invalid=0,turns=0,offRoad=0,pedBlocked=0;
const travel=trafficCars.map(()=>0),dwell=trafficCars.map(()=>0),carTurns=trafficCars.map(()=>0);
for(let tick=0;tick<1800;tick++){
  advanceClock();
  const before=trafficCars.map(c=>({x:c.x,y:c.y}));
  updatePhysics(1/60);
  trafficCars.forEach((c,i)=>{
    const distance=Math.hypot(c.x-before[i].x,c.y-before[i].y);
    maxJump=Math.max(maxJump,distance);travel[i]+=distance;
    if(c.routeWait>0)dwell[i]++;
    if(!isPositionOnSolidGround(c.x,c.y))water++;
    if(!Number.isFinite(c.x+c.y+c.speed+c.angle))invalid++;
    if(c.turn){turns++;carTurns[i]++;}
    if(!onRoadSurface(c.x,c.y,roads,bridges,scenicRoads,roadEnds))offRoad++;
  });
  pedestrians.forEach(p=>{if(isPedestrianSceneryBlocked(p.x,p.y))pedBlocked++;});
}
const target=trafficCars.find(c=>!c.turn&&isPositionOnSolidGround(c.x,c.y));
Object.assign(player,{x:target.x-8,y:target.y,angle:target.angle,speed:4,vx:4,vy:0,hp:100});
state.invulnTimer=0;
updatePhysics(1/60);
const impactDamage=100-player.hp;
Object.assign(player,{x:target.x+65,y:target.y,angle:target.angle,speed:0,vx:0,vy:0,hp:100});
state.wanted=0;state.invulnTimer=0;
for(let tick=0;tick<90;tick++){advanceClock();updatePhysics(1/60);}
const motionByType=Object.fromEntries([...new Set(trafficCars.map(c=>c.type))].map(type=>{
  const indices=trafficCars.flatMap((c,i)=>c.type===type?[i]:[]);
  return [type,{count:indices.length,moving:indices.filter(i=>travel[i]>20).length,
    minTravel:Math.min(...indices.map(i=>travel[i])),maxTravel:Math.max(...indices.map(i=>travel[i])),
    dwellFrames:indices.reduce((sum,i)=>sum+dwell[i],0),turnFrames:indices.reduce((sum,i)=>sum+carTurns[i],0)}];
}));
this.result={cars:trafficCars.length,motionByType,maxJump,water,invalid,turns,offRoad,pedBlocked,impactDamage,stationaryDamage:100-player.hp,stationaryWanted:state.wanted};
`,sandbox);
console.log(sandbox.result);
assert(sandbox.result.cars>=50);
assert.equal(sandbox.result.invalid,0);
assert(sandbox.result.turns>0);
assert(sandbox.result.maxJump<35,'traffic jumped across the scene');
assert.equal(sandbox.result.water,0,'traffic left solid ground');
assert.equal(sandbox.result.offRoad,0,'traffic left the road surface');
assert.equal(sandbox.result.pedBlocked,0,'pedestrian entered solid scenery');
assert(sandbox.result.impactDamage>0,'player and traffic contact did not cause damage');
assert.equal(sandbox.result.stationaryDamage,0,'idle player took damage from traffic');
assert.equal(sandbox.result.stationaryWanted,0,'idle player was blamed for traffic contact');
for(const [type,motion] of Object.entries(sandbox.result.motionByType))assert(motion.moving>0,`${type}: entire class failed to move`);
