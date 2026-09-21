import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { resolveContact, resolveScenery } from '../src/game/solid_contacts.js';
import { pointInCoast } from '../src/game/coastline.js';
import { velocityForHeading, projectIso, routeInput } from '../src/game/test_drive_core.js';

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
const sandbox={console,Math,performance:{now:()=>0},document:{readyState:'loading',getElementById:()=>({...element}),createElement:()=>({...element}),querySelectorAll:()=>[],addEventListener:noop},window:{addEventListener:noop},localStorage:{getItem:()=>null,setItem:noop},setTimeout:noop,setInterval:noop,requestAnimationFrame:noop,velocityForHeading,projectIso,routeInput};
vm.createContext(sandbox);
Object.assign(sandbox, { resolveContact, resolveScenery, pointInCoast });
const source=readFileSync(new URL('../src/main.js',import.meta.url),'utf8').replace(/^import .*;\n/gm,'');
vm.runInContext(source+`\ninitTopology(); trafficCars.length=0; pedestrians.length=0;
Object.assign(player,{x:1265,y:1200,angle:0,speed:0,vx:0,vy:0});
const points=[{x:2065,y:1200},{x:2065,y:515},{x:1265,y:515},{x:1265,y:4135},{x:2065,y:4135},{x:2065,y:5015},{x:1265,y:5015},{x:1265,y:1200}];
let point=0, ticks=0, maxSlip=0, hits=0;
while(point<points.length&&ticks<6000){
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
this.result={segments:point,seconds:ticks/60,maxSlip,hits,drowned:state.isDrowning,world:{islands:islands.length,bridges:bridges.length,roads:roads.length,buildings:buildings.length,traffic:trafficCars.length,pedestrians:pedestrians.length,verticalRails:bridgeRails.filter(r=>r.axis==='x').length,streetLights:streetLights.length,trees:trees.length,parkedCars:parkedCars.length,cranes:cranes.length,billboards:billboards.length}};`,sandbox);
console.log(JSON.stringify(sandbox.result,null,2));
assert.equal(sandbox.result.segments,8,'Expanded route must complete');
assert.ok(sandbox.result.maxSlip<18,'No excessive lateral slide');
assert.equal(sandbox.result.hits,0);
assert.equal(sandbox.result.drowned,false);
assert.equal(JSON.stringify(sandbox.result.world),JSON.stringify({islands:16,bridges:20,roads:93,buildings:232,traffic:0,pedestrians:0,verticalRails:20,streetLights:116,trees:278,parkedCars:24,cranes:8,billboards:18}));
console.log('PASS: heading, projection, steering and sixteen-district world route through actual game physics');
