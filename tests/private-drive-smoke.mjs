import { VEHICLES } from '../src/game/free_roam.js';
import * as authoredWorld from '../src/game/authored_archipelago.js';
import { PLANE_RUNWAYS as LEGACY_RUNWAYS } from '../src/game/free_roam.js';
import * as emergencyPassing from '../src/game/emergency_passing.js';
import * as streetNetwork from '../src/game/street_network.js';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { resolveContact, resolveScenery, contact, chassis, captureMotion, solveVehicleMotion } from '../src/game/solid_contacts.js';
import { coastPoints, pointInCoast, pointInBeach, BEACH_WIDTH } from '../src/game/coastline.js';
import * as ocean from '../src/game/ocean_chunks.js';
import * as surfaces from '../src/game/surface_physics.js';
import * as incidents from '../src/game/city_incidents.js';
import { velocityForHeading, stepLandVehicle, projectIso, routeInput } from '../src/game/test_drive_core.js';

for(let angle=-Math.PI;angle<Math.PI;angle+=0.1){
  const v=velocityForHeading({angle,speed:4,vx:0,vy:0});
  assert.ok(Math.abs(v.vx*Math.cos(angle)+v.vy*Math.sin(angle)-4)<1e-9);
  const p=projectIso(v.vx,v.vy), nose=projectIso(Math.cos(angle),Math.sin(angle));
  assert.ok(p.x*nose.x+p.y*nose.y>0);
}
assert.equal(routeInput({x:0,y:0,angle:0,speed:1},{x:0,y:100}).right,true);
assert.equal(routeInput({x:0,y:0,angle:0,speed:1},{x:0,y:-100}).left,true);

// Run the CURRENT game physics, not the legacy disconnected modules.
const noop=()=>{};
const element={style:{},classList:{add:noop,remove:noop},appendChild:noop,addEventListener:noop,getContext:()=>({}),remove:noop};
const sandbox={...authoredWorld,LEGACY_RUNWAYS,VEHICLES,...emergencyPassing,...streetNetwork,...ocean,...surfaces,...incidents,console,Math,performance:{now:()=>0},document:{readyState:'loading',getElementById:()=>({...element}),createElement:()=>({...element}),querySelectorAll:()=>[],addEventListener:noop},window:{addEventListener:noop},localStorage:{getItem:()=>null,setItem:noop},setTimeout:noop,setInterval:noop,requestAnimationFrame:noop,velocityForHeading, stepLandVehicle,projectIso,routeInput,pointInCoast,pointInBeach,coastPoints,BEACH_WIDTH};
vm.createContext(sandbox);
Object.assign(sandbox, { resolveContact, resolveScenery, contact, chassis, captureMotion, solveVehicleMotion });
const source=readFileSync(new URL('../src/main.js',import.meta.url),'utf8').replace(/^import .*;\n/gm,'');
vm.runInContext(source+`\ninitTopology(); const initialTreeCount=trees.length,initialRoadCount=roads.length,initialBridgeCount=bridges.length,initialVerticalRails=bridgeRails.filter(r=>r.axis==='x').length; trafficCars.length=0; pedestrians.length=0;
Object.assign(player,{x:1265,y:1200,angle:0,speed:0,vx:0,vy:0});
const destinations=[{x:2065,y:1200},{x:2065,y:515},{x:1265,y:515},{x:1265,y:4135},{x:2065,y:4135},{x:2065,y:5015},{x:1265,y:5015},{x:1265,y:1200}].map(worldPoint);
let previous={x:player.x,y:player.y};
const points=destinations.flatMap(target=>{const path=roadPath(roadGraph,previous,target,{fromSegment:true}).slice(1);previous=target;return path;});
const length=points.reduce((sum,p,i)=>sum+Math.hypot(p.x-(points[i-1]?.x??player.x),p.y-(points[i-1]?.y??player.y)),0);
const limit=Math.ceil(length/100*60)+points.length*300;
let point=0, ticks=0, maxSlip=0, hits=0;
while(point<points.length&&ticks<limit){
 if(Math.hypot(player.x-points[point].x,player.y-points[point].y)<42){point++;continue;}
 Object.assign(state.keys,routeInput(player,points[point]));
 const oldX=player.x,oldY=player.y;
 updatePhysics(1/60);
 const dx=player.x-oldX,dy=player.y-oldY;
 const forward=dx*Math.cos(player.angle)+dy*Math.sin(player.angle);
 const lateral=-dx*Math.sin(player.angle)+dy*Math.cos(player.angle);
 if(Math.hypot(dx,dy)>0.3)maxSlip=Math.max(maxSlip,Math.abs(Math.atan2(lateral,forward))*180/Math.PI);
 if(buildings.some(b=>player.x>b.x-15&&player.x<b.x+b.w+15&&player.y>b.y-15&&player.y<b.y+b.h+15))hits++;
 ticks++;
}
Object.assign(player,{x:4000,y:6000,hp:0});state.cash=500;respawnPlayer('test');
this.result={segments:point,expectedSegments:points.length,destinations:destinations.length,seconds:ticks/60,maxSlip,hits,drowned:state.isDrowning,respawned:player.hp===100&&isPositionOnSolidGround(player.x,player.y)&&state.cash===400,initialTrees:initialTreeCount,initialRoads:initialRoadCount,initialBridges:initialBridgeCount,initialVerticalRails,world:{islands:islands.length,bridges:bridges.length,roads:roads.length,buildings:buildings.length,traffic:trafficCars.length,pedestrians:pedestrians.length,verticalRails:bridgeRails.filter(r=>r.axis==='x').length,streetLights:streetLights.length,trees:trees.length,parkedCars:parkedCars.length,cranes:cranes.length,billboards:billboards.length}};`,sandbox);
console.log(JSON.stringify(sandbox.result,null,2));
assert.equal(sandbox.result.destinations,8);
assert.equal(sandbox.result.segments,sandbox.result.expectedSegments,'Road-graph route through all eight destinations must complete');
assert.ok(sandbox.result.maxSlip<18,'No excessive lateral slide');
assert.equal(sandbox.result.hits,0);
assert.equal(sandbox.result.drowned,false);
assert.equal(sandbox.result.respawned,true,'death did not restore the player at a safe spawn');
const expectedWorld={islands:16,bridges:sandbox.result.initialBridges,roads:sandbox.result.initialRoads,buildings:232,traffic:0,pedestrians:0,verticalRails:sandbox.result.initialVerticalRails,streetLights:116,parkedCars:24,cranes:8,billboards:18};
const actualWorld={...sandbox.result.world};delete actualWorld.trees;
assert.deepEqual(actualWorld,expectedWorld,'driving and respawn should not change world geometry');
assert.equal(sandbox.result.world.trees,sandbox.result.initialTrees,'driving should not alter generated trees');
assert.ok(sandbox.result.world.trees>=400,'city tree coverage is too sparse');
console.log('PASS: heading, projection, steering and sixteen-district world route through actual game physics');
