import assert from 'node:assert/strict';
import { createFreeRoam } from '../src/game/free_roam.js';
import { pointInCoast, coastPoints } from '../src/game/coastline.js';
const island={x:300,y:300,w:2200,h:2200};
assert(pointInCoast(1200,1200,island));assert(!pointInCoast(300,300,island));
assert(coastPoints(island).length>12);
const player={x:1200,y:1200,angle:0,speed:0,width:48,height:24};
const solid=(x,y)=>pointInCoast(x,y,island);
const roam=createFreeRoam(player,[],[],[],solid);
roam.interact();assert.equal(roam.mode,'foot');
assert.equal(player.entityType,'pedestrian');assert.equal(player.width,9);
assert(roam.fleet.some(c=>c.type==='sedan'&&c.x===1200));
roam.interact();assert.equal(roam.mode,'sedan');
assert.equal(player.entityType,'vehicle');
player.speed=4;roam.interact();assert.equal(roam.mode,'sedan');player.speed=0;
roam.interact();Object.assign(player,{x:1040,y:2130});roam.interact();assert.equal(roam.mode,'helicopter');
roam.toggleFlight();for(let i=0;i<100;i++)roam.step({},1/60);assert(roam.altitude>100);
roam.interact();assert.equal(roam.mode,'helicopter');
roam.toggleFlight();for(let i=0;i<160;i++)roam.step({handbrake:true},1/60);assert.equal(roam.altitude,0);
roam.interact();assert.equal(roam.mode,'foot');
Object.assign(player,{x:2490,y:1800});roam.interact();assert.equal(roam.mode,'speedboat');
for(let i=0;i<30;i++)roam.step({up:true},1/60);assert(player.y>1800);assert(!solid(player.x,player.y));
player.speed=0;roam.interact();assert.equal(roam.mode,'foot');assert(solid(player.x,player.y));
// Every advertised vehicle can be entered and has finite geometry/physics state.
for(const type of ['van','truck','bike','speedboat','tug','helicopter','plane']){
  const p={x:1200,y:1200,angle:0,speed:0,width:48,height:24};
  const r=createFreeRoam(p,[],[],[],solid);r.interact();
  const target=r.fleet.find(v=>v.type===type);assert(target,`missing ${type}`);
  Object.assign(p,{x:target.x+20,y:target.y});r.interact();assert.equal(r.mode,type);
  const handled=r.step({up:true,right:true},1/60);
  if(['speedboat','tug','helicopter','plane'].includes(type))assert.equal(handled,true);
  assert(Number.isFinite(p.x)&&Number.isFinite(p.y)&&Number.isFinite(p.angle));
}
// A nine-unit pedestrian fits a narrow passage and slides on a wall instead of becoming a car collision body.
const walker={x:1000,y:1000,angle:0,speed:0,width:48,height:24};
const corridor=createFreeRoam(walker,[],[{x:0,y:0,w:10,h:100},{x:30,y:0,w:10,h:100}],[],()=>true);
corridor.interact();Object.assign(walker,{x:20,y:50});for(let i=0;i<10;i++)corridor.step({up:true,right:true},1/60);
assert.equal(walker.entityType,'pedestrian');assert(walker.y<50);assert(walker.x<25);
console.log('PASS: smooth coastline, pedestrian identity/corridors, every vehicle, flight, boats and shore disembarkation');
