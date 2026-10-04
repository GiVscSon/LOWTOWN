import {attachRuntime} from './helpers/runtime-vm.mjs';
import {createWalkSurface} from '../src/world/walk_surface.js';
import {createSceneryIndex} from '../src/simulation/solid_contacts.js';
import { VEHICLES } from '../src/simulation/free_roam.js';
import * as authoredWorld from '../src/world/archipelago.js';
import { PLANE_RUNWAYS as LEGACY_RUNWAYS } from '../src/simulation/free_roam.js';
import * as emergencyPassing from '../src/simulation/emergency_passing.js';
import * as streetNetwork from '../src/world/street_network.js';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { resolveContact, resolveScenery, contact, chassis, captureMotion, solveVehicleMotion, createSpatialIndex } from '../src/simulation/solid_contacts.js';
import { advanceTrafficCar, resolveTrafficPair } from '../src/simulation/traffic_turns.js';
import { coastPoints, pointInCoast, pointInBeach, BEACH_WIDTH } from '../src/world/coastline.js';
import * as ocean from '../src/world/ocean_chunks.js';
import * as surfaces from '../src/simulation/surfaces.js';
import * as incidents from '../src/simulation/incidents.js';
import { projectIso, velocityForHeading, stepLandVehicle, routeInput } from '../src/simulation/vehicle_dynamics.js';
const noop=()=>{};
const element={style:{},classList:{add:noop,remove:noop},appendChild:noop,remove:noop,addEventListener:noop,getContext:()=>({})};
let clock=0,seed=Number(process.env.LOWTOWN_TEST_SEED||19);
const math=Object.create(Math);math.random=()=>((seed=Math.imul(seed,1664525)+1013904223>>>0)/4294967296);
const sandbox={...authoredWorld,LEGACY_RUNWAYS,VEHICLES,...emergencyPassing,...streetNetwork,...ocean,...surfaces,...incidents,Math:math,console,advanceClock:()=>clock+=1000/60,performance:{now:()=>clock},document:{readyState:'loading',getElementById:()=>({...element}),createElement:()=>({...element}),querySelectorAll:()=>[],addEventListener:noop},window:{addEventListener:noop},localStorage:{getItem:()=>null,setItem:noop},setTimeout:noop,setInterval:noop,requestAnimationFrame:noop,resolveContact,resolveScenery,contact,chassis,captureMotion,solveVehicleMotion,createSpatialIndex,advanceTrafficCar,resolveTrafficPair,coastPoints,pointInCoast,pointInBeach,BEACH_WIDTH,projectIso,velocityForHeading, stepLandVehicle,routeInput};
vm.createContext(sandbox);
Object.assign(sandbox,{createWalkSurface,createSceneryIndex});
attachRuntime(sandbox,{legacyStreets:true});
vm.runInContext(`
initTopology();
let maxJump=0,water=0,invalid=0,turns=0,offRoad=0,pedBlocked=0,swimming=0,invalidWater=0;
const travel=trafficCars.map(()=>0),dwell=trafficCars.map(()=>0),carTurns=trafficCars.map(()=>0);
for(let tick=0;tick<1800;tick++){
  advanceClock();
  const before=trafficCars.map(c=>({x:c.x,y:c.y,angle:c.angle}));
  updatePhysics(1/60);
  trafficCars.forEach((c,i)=>{
    const distance=Math.hypot(c.x-before[i].x,c.y-before[i].y);
    maxJump=Math.max(maxJump,distance);travel[i]+=distance;
    if(c.routeWait>0)dwell[i]++;
    if(!isPositionOnSolidGround(c.x,c.y))water++;
    if(!Number.isFinite(c.x+c.y+c.speed+c.angle))invalid++;
    if(Math.abs(Math.atan2(Math.sin(c.angle-before[i].angle),Math.cos(c.angle-before[i].angle)))>.001){turns++;carTurns[i]++;}
    if(!onRoadSurface(c.x,c.y,roads,bridges,scenicRoads,roadEnds))offRoad++;
  });
  // Swimming intentionally leaves dry support, but never ignores solid scenery.
  pedestrians.forEach(p=>{if(isPedestrianSceneryBlocked(p.x,p.y,0,!!p.inWater))pedBlocked++;if(p.inWater){swimming++;if(getWalkSurface()(p.x,p.y))invalidWater++;}});
}
const target=trafficCars.find(c=>!c.turn&&isPositionOnSolidGround(c.x,c.y));
Object.assign(player,{x:target.x-Math.cos(target.angle)*60,y:target.y-Math.sin(target.angle)*60,angle:target.angle,speed:6,vx:Math.cos(target.angle)*6,vy:Math.sin(target.angle)*6,hp:100});
state.invulnTimer=0;
for(let tick=0;tick<12;tick++){advanceClock();updatePhysics(1/60);}
const impactDamage=100-player.hp;
// A controlled following lane checks braking. Arbitrary target.x+65 could
// put the player inside another car, crossing lane or a new lamp collider.
const savedTraffic=trafficCars.slice();trafficCars.length=0;
const follower={type:'sedan',model:'sedan',x:1500,y:1200,angle:0,width:48,height:24,mass:1500,
 speed:2,cruiseSpeed:2,vx:2,vy:0,isTraffic:true,axis:'x',minX:400,maxX:2350,laneCenter:1220};
trafficCars.push(follower);policeCars.length=0;incidentPoliceCars.length=0;incidentResponseVehicles.length=0;
cityIncidentDirector.finish();cityIncidentDirector.state.cooldown=99999;
Object.assign(player,{x:1600,y:1200,angle:0,speed:0,vx:0,vy:0,contactVx:0,contactVy:0,hp:100});
state.wanted=0;state.invulnTimer=0;
for(let tick=0;tick<90;tick++){advanceClock();updatePhysics(1/60);}

const stationaryDamage=100-player.hp,stationaryWanted=state.wanted,followingStopped=follower.speed<.05&&follower.x<1555;
trafficCars.splice(0,trafficCars.length,...savedTraffic);
const motionByType=Object.fromEntries([...new Set(trafficCars.map(c=>c.type))].map(type=>{
  const indices=trafficCars.flatMap((c,i)=>c.type===type?[i]:[]);
  return [type,{count:indices.length,moving:indices.filter(i=>travel[i]>20).length,
    minTravel:Math.min(...indices.map(i=>travel[i])),maxTravel:Math.max(...indices.map(i=>travel[i])),
    dwellFrames:indices.reduce((sum,i)=>sum+dwell[i],0),turnFrames:indices.reduce((sum,i)=>sum+carTurns[i],0)}];
}));
this.result={cars:trafficCars.length,motionByType,maxJump,water,invalid,turns,offRoad,pedBlocked,swimming,invalidWater,impactDamage,stationaryDamage,stationaryWanted,followingStopped};
`,sandbox);
console.log(sandbox.result);
assert(sandbox.result.cars>=50);
assert.equal(sandbox.result.invalid,0);
assert(sandbox.result.turns>0);
assert(sandbox.result.maxJump<35,'traffic jumped across the scene');
assert.equal(sandbox.result.water,0,'traffic left solid ground');
assert.equal(sandbox.result.offRoad,0,'traffic left the road surface');
assert.equal(sandbox.result.pedBlocked,0,'pedestrian entered solid scenery');
assert(sandbox.result.swimming>0,'beach residents never entered the sea');
assert.equal(sandbox.result.invalidWater,0,'a dry pedestrian was incorrectly marked as swimming');
assert(sandbox.result.impactDamage>0,'player and traffic contact did not cause damage');
assert(sandbox.result.followingStopped,'following traffic failed to stop before the idle player');
assert.equal(sandbox.result.stationaryDamage,0,'idle player took damage from traffic');
assert.equal(sandbox.result.stationaryWanted,0,'idle player was blamed for traffic contact');
for(const [type,motion] of Object.entries(sandbox.result.motionByType))assert(motion.moving>0,`${type}: entire class failed to move`);
