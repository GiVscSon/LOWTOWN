import * as streetNetwork from '../src/game/street_network.js';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { pointInCoast, pointInBeach, coastPoints, BEACH_WIDTH } from '../src/game/coastline.js';
import * as ocean from '../src/game/ocean_chunks.js';
import * as surfaces from '../src/game/surface_physics.js';
import * as incidents from '../src/game/city_incidents.js';

const noop=()=>{};
const element={style:{},classList:{add:noop,remove:noop},appendChild:noop,addEventListener:noop,getContext:()=>({}),remove:noop};
const sandbox={...streetNetwork,...ocean,...surfaces,...incidents,console,Math,performance:{now:()=>0},document:{readyState:'loading',getElementById:()=>({...element}),createElement:()=>({...element}),querySelectorAll:()=>[],addEventListener:noop},window:{addEventListener:noop},localStorage:{getItem:()=>null,setItem:noop},setTimeout:noop,setInterval:noop,requestAnimationFrame:noop,pointInCoast,pointInBeach,coastPoints,BEACH_WIDTH};
vm.createContext(sandbox);
const source=readFileSync(new URL('../src/main.js',import.meta.url),'utf8').replace(/^import .*;\n/gm,'');
vm.runInContext(source+`
initTopology();
const overlap=(a,b)=>a.x<b.x+b.w&&a.x+a.w>b.x&&a.y<b.y+b.h&&a.y+a.h>b.y;
this.report={
  width:WORLD_W,height:WORLD_H,islands:islands.length,bridges:bridges.length,
  roads:roads.length,buildings:buildings.length,traffic:trafficCars.length,pedestrians:pedestrians.length,parks:parkZones.length,
  outOfBounds:[...roads,...buildings].filter(r=>r.x<0||r.y<0||r.x+r.w>WORLD_W||r.y+r.h>WORLD_H).length,
  roadBuildingConflicts:buildings.flatMap((b,buildingIndex)=>roads.map((r,roadIndex)=>({b,r,buildingIndex,roadIndex})).filter(hit=>overlap(hit.b,hit.r))).map(({b,r,buildingIndex,roadIndex})=>({buildingIndex,roadIndex,b,r})),
  bridgeLandfalls:bridges.every(br=>{
    const a=br.dir==='h'?{x:br.x-5,y:br.y+br.h/2}:{x:br.x+br.w/2,y:br.y-5};
    const b=br.dir==='h'?{x:br.x+br.w+5,y:br.y+br.h/2}:{x:br.x+br.w/2,y:br.y+br.h+5};
    return islands.some(i=>pointInCoast(a.x,a.y,i))&&islands.some(i=>pointInCoast(b.x,b.y,i));
  }),
  failedLandfalls:bridges.filter(br=>{
    const a=br.dir==='h'?{x:br.x-5,y:br.y+br.h/2}:{x:br.x+br.w/2,y:br.y-5};
    const b=br.dir==='h'?{x:br.x+br.w+5,y:br.y+br.h/2}:{x:br.x+br.w/2,y:br.y+br.h+5};
    return !islands.some(i=>pointInCoast(a.x,a.y,i))||!islands.some(i=>pointInCoast(b.x,b.y,i));
  }).map(br=>{
    const a=br.dir==='h'?{x:br.x-5,y:br.y+br.h/2}:{x:br.x+br.w/2,y:br.y-5};
    const b=br.dir==='h'?{x:br.x+br.w+5,y:br.y+br.h/2}:{x:br.x+br.w/2,y:br.y+br.h+5};
    return {id:br.id,a,b,landA:islands.filter(i=>pointInCoast(a.x,a.y,i)).map(i=>i.id),landB:islands.filter(i=>pointInCoast(b.x,b.y,i)).map(i=>i.id)};
  }),
  bridgeRoadLinks:bridges.every(br=>{
    const ends=br.dir==='h'?[{x:br.x-150,y:br.y,w:150,h:br.h},{x:br.x+br.w,y:br.y,w:150,h:br.h}]:[{x:br.x,y:br.y-150,w:br.w,h:150},{x:br.x,y:br.y+br.h,w:br.w,h:150}];
    return ends.every(end=>roads.some(r=>overlap(end,r)));
  }),
  failedTrafficSamples:trafficCars.flatMap(c=>{
    const lo=c.axis==='y'?c.minY:c.minX,hi=c.axis==='y'?c.maxY:c.maxX,bad=[];
    for(let v=lo;v<=hi;v+=35){const x=c.axis==='y'?c.x:v,y=c.axis==='y'?v:c.y;if(!isPositionOnSolidGround(x,y))bad.push({x,y});}return bad;
  }).slice(0,12),
  safeTraffic:trafficCars.every(c=>{
    const lo=c.axis==='y'?c.minY:c.minX,hi=c.axis==='y'?c.maxY:c.maxX;
    for(let v=lo;v<=hi;v+=35)if(!isPositionOnSolidGround(c.axis==='y'?c.x:v,c.axis==='y'?v:c.y))return false;
    return true;
  }),
  streetProps:streetProps.length,
  trafficModels:new Set(trafficCars.map(c=>c.type)).size,
  courtyards:parkZones.filter(p=>p.courtyard).length,
  clearParks:parkZones.every(p=>!buildings.some(b=>overlap(p,b))),
  scenicLanes:scenicRoads.length,
  scenicLanesSafe:scenicRoads.every(r=>r.points.every(([x,y])=>[[-29,0],[29,0],[0,-29],[0,29]].every(([dx,dy])=>isPositionOnIslandLand(x+dx,y+dy))&&!buildings.some(b=>x>b.x-29&&x<b.x+b.w+29&&y>b.y-29&&y<b.y+b.h+29))),
  naturalIslets:islets.length,
  connectedDistricts:safeSpawnPoints.every(sp=>roadPath(roadGraph,safeSpawnPoints[0],sp).length>0),
  terminals:roadEnds.length,
  unfinishedRoadEnds:roads.filter(r=>!r.bridgeApproach).flatMap(r=>r.dir==='h'?[{x:r.x,y:r.y+r.h/2,road:r},{x:r.x+r.w,y:r.y+r.h/2,road:r}]:[{x:r.x+r.w/2,y:r.y,road:r},{x:r.x+r.w/2,y:r.y+r.h,road:r}]).filter(p=>![...roads,...bridges].some(r=>r!==p.road&&p.x>=r.x-1&&p.x<=r.x+r.w+1&&p.y>=r.y-1&&p.y<=r.y+r.h+1)&&!roadEnds.some(t=>Math.hypot(t.x-p.x,t.y-p.y)<=t.radius)).length,
  routedPedestrians:pedestrians.filter(p=>p.route?.points.length>=5).length,
  uniqueCoasts:new Set(islands.map(i=>coastPoints(i).slice(0,12).map(p=>p.map(Math.round).join(':')).join('|'))).size,
  civicBuildings:buildings.filter(b=>b.civicType).length,
  civicTypes:new Set(buildings.filter(b=>b.civicType).map(b=>b.civicType)).size,
  parkStyles:new Set(parkZones.map(p=>p.type)).size,
  pedestrianLooks:new Set(pedestrians.map(p=>p.accessory)).size,
  stuntZones:stuntZones.length,
  stuntStyles:new Set(stuntZones.map(z=>z.type)).size,
  stuntZonesOnRoad:stuntZones.every(z=>roads.some(r=>r.dir===z.axis&&z.x>=r.x&&z.x<=r.x+r.w&&z.y>=r.y&&z.y<=r.y+r.h)),
  badStuntPlacements:stuntZones.filter(z=>!roads.some(r=>r.dir===z.axis&&z.x>=r.x&&z.x<=r.x+r.w&&z.y>=r.y&&z.y<=r.y+r.h)).map(z=>({id:z.id,x:z.x,y:z.y,axis:z.axis})),
  stuntZonesClear:stuntZones.every(z=>!roads.some(r=>!r.bridgeApproach&&r.dir!==(z.axis)&&
    (z.axis==='h'?z.x>=r.x-z.length/2-10&&z.x<=r.x+r.w+z.length/2+10&&z.y>=r.y-60&&z.y<=r.y+r.h+60:
      z.y>=r.y-z.length/2-10&&z.y<=r.y+r.h+z.length/2+10&&z.x>=r.x-60&&z.x<=r.x+r.w+60))),
  crosswalkApproaches:new Set(junctionCrosswalkStripes({x:0,y:0,w:520,h:100},{x:210,y:-200,w:100,h:500}).map(s=>s.approach)).size
};
const testRamp=stuntZones.find(z=>z.type==='ramp');
const stuntTestVehicle={x:testRamp?.x||0,y:testRamp?.y||0,speed:7,width:40,height:20,mass:1250,type:'sports'};
if(testRamp){
  const offset=(axis,distance)=>{if(testRamp.axis==='h')stuntTestVehicle.x=testRamp.x+distance;else stuntTestVehicle.y=testRamp.y+distance;};
  offset(testRamp.axis,-78);updateStuntVehicle(stuntTestVehicle,1/60);offset(testRamp.axis,-22);const airborne=updateStuntVehicle(stuntTestVehicle,1/60);
  for(let i=0;i<80;i++)updateStuntVehicle(stuntTestVehicle,1/60);
  this.stuntFlight={takeoff:airborne,landing:stuntHeightFor(stuntTestVehicle),score:stuntStates.get(stuntTestVehicle)?.score||0};
}`,sandbox);

assert.equal(sandbox.report.connectedDistricts,true,'every district must have a road route');
assert.equal(sandbox.report.routedPedestrians,108);
assert(sandbox.report.terminals>0);
assert.equal(sandbox.report.unfinishedRoadEnds,0);
console.log('HUGE_WORLD_REPORT',JSON.stringify(sandbox.report));
assert.equal(sandbox.report.width,10100);
assert.equal(sandbox.report.height,11700);
assert.equal(sandbox.report.islands,16);
assert.equal(sandbox.report.bridges,24);
assert.ok(sandbox.report.roads>=90);
assert.ok(sandbox.report.buildings>=220);
assert.ok(sandbox.report.traffic>=55);
assert.ok(sandbox.report.pedestrians>=100);
assert.ok(sandbox.report.parks>=8);
assert.ok(sandbox.report.courtyards>=8);
assert.equal(sandbox.report.clearParks,true,'park or courtyard overlaps a building');
assert.equal(sandbox.report.outOfBounds,0);
assert.equal(sandbox.report.roadBuildingConflicts.length,0);
assert.equal(sandbox.report.bridgeLandfalls,true);
assert.equal(sandbox.report.bridgeRoadLinks,true);
assert.equal(sandbox.report.safeTraffic,true,'traffic corridor crosses open water');
assert.ok(sandbox.report.streetProps>=40,'street furniture is too sparse');
assert.ok(sandbox.report.trafficModels>=8,'traffic fleet lacks distinct vehicle classes');
assert.equal(sandbox.report.scenicLanes,16);
assert.equal(sandbox.report.scenicLanesSafe,true,'curved waterfront lane intersects water or a building');
assert.equal(sandbox.report.uniqueCoasts,16,'island silhouettes are repeated');
assert.ok(sandbox.report.civicBuildings>=8,'emergency and community buildings are missing');
assert.ok(sandbox.report.civicTypes>=4,'civic buildings need distinct types');
assert.ok(sandbox.report.parkStyles>=8,'parks need more than the original four layouts');
assert.ok(sandbox.report.pedestrianLooks>=8,'pedestrian clothing/accessories lack variety');
assert.ok(sandbox.report.stuntZones>=6,'road stunt features are too sparse');
assert.ok(sandbox.report.stuntStyles>=2,'both ramps and speed bumps should be present');
assert.equal(sandbox.report.stuntZonesOnRoad,true,'a stunt feature was placed off road');
assert.equal(sandbox.report.stuntZonesClear,true,'a stunt feature sits inside a junction');
assert.equal(sandbox.report.crosswalkApproaches,4,'junction crossings do not cover all four approaches');
assert.ok(sandbox.stuntFlight.takeoff>0,'a car did not leave the ground after a ramp');
assert.equal(sandbox.stuntFlight.landing,0,'the car did not settle back onto the road');
assert.ok(sandbox.stuntFlight.score>0,'the ramp should register trick points');
console.log('HUGE_WORLD_OK',JSON.stringify(sandbox.report));
