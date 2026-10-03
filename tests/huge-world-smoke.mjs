import {attachRuntime} from './helpers/runtime-vm.mjs';
import {createWalkSurface} from '../src/world/walk_surface.js';
import {createSceneryIndex} from '../src/simulation/solid_contacts.js';
import * as authoredWorld from '../src/world/archipelago.js';
import { PLANE_RUNWAYS as LEGACY_RUNWAYS } from '../src/simulation/free_roam.js';
import * as streetNetwork from '../src/world/street_network.js';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { pointInCoast, pointInBeach, coastPoints, BEACH_WIDTH } from '../src/world/coastline.js';
import * as ocean from '../src/world/ocean_chunks.js';
import * as surfaces from '../src/simulation/surfaces.js';
import * as incidents from '../src/simulation/incidents.js';

const noop=()=>{};
const element={style:{},classList:{add:noop,remove:noop},appendChild:noop,addEventListener:noop,getContext:()=>({}),remove:noop};
const sandbox={...authoredWorld,LEGACY_RUNWAYS,...streetNetwork,...ocean,...surfaces,...incidents,console,Math,performance:{now:()=>0},document:{readyState:'loading',getElementById:()=>({...element}),createElement:()=>({...element}),querySelectorAll:()=>[],addEventListener:noop},window:{addEventListener:noop},localStorage:{getItem:()=>null,setItem:noop},setTimeout:noop,setInterval:noop,requestAnimationFrame:noop,pointInCoast,pointInBeach,coastPoints,BEACH_WIDTH};
vm.createContext(sandbox);
Object.assign(sandbox,{createWalkSurface,createSceneryIndex});
attachRuntime(sandbox,{legacyStreets:true});
vm.runInContext(`
initTopology();
const overlap=(a,b)=>a.x<b.x+b.w&&a.x+a.w>b.x&&a.y<b.y+b.h&&a.y+a.h>b.y;
const motor=bridges.filter(b=>!b.footway);
const motorGroups=[...new Set(motor.map(b=>b.logicalId||b.id))].map(id=>motor.filter(b=>(b.logicalId||b.id)===id));
const landfalls=motor.flatMap(br=>[
 ...(br.landfallStart?[{br,point:br.dir==='h'?{x:br.x-5,y:br.y+br.h/2}:{x:br.x+br.w/2,y:br.y-5},start:true}]:[]),
 ...(br.landfallEnd?[{br,point:br.dir==='h'?{x:br.x+br.w+5,y:br.y+br.h/2}:{x:br.x+br.w/2,y:br.y+br.h+5},start:false}]:[])
]);
const failedLandfalls=landfalls.filter(({point})=>!islands.some(i=>pointInCoast(point.x,point.y,i)));
const failedTrafficSamples=trafficCars.flatMap(car=>{
 const points=car.route?.points||[];
 if(points.length<2)return [{type:car.type,missingRoute:true}];
 return points.flatMap((a,index)=>{
  if(!car.route.loop&&index===points.length-1)return [];
  const b=points[(index+1)%points.length],angle=Math.atan2(b.y-a.y,b.x-a.x),steps=Math.max(1,Math.ceil(Math.hypot(b.x-a.x,b.y-a.y)/12)),bad=[];
  for(let step=0;step<=steps;step++){
   const t=step/steps,pose={...car,x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t,angle};
   if(!policeFootprintOnRoad(pose))bad.push({type:car.type,x:pose.x,y:pose.y,angle});
  }return bad;
 });
});
this.report={
  width:WORLD_W,height:WORLD_H,islands:islands.length,bridges:bridges.length,
  roads:roads.length,buildings:buildings.length,traffic:trafficCars.length,pedestrians:pedestrians.length,parks:parkZones.length,
  outOfBounds:[...roads,...buildings].filter(r=>r.x<0||r.y<0||r.x+r.w>WORLD_W||r.y+r.h>WORLD_H).length,
  roadBuildingConflicts:buildings.flatMap((b,buildingIndex)=>roads.map((r,roadIndex)=>({b,r,buildingIndex,roadIndex})).filter(hit=>overlap(hit.b,hit.r))).map(({b,r,buildingIndex,roadIndex})=>({buildingIndex,roadIndex,b,r})),
  bridgeLandfalls:failedLandfalls.length===0,
  failedLandfalls:failedLandfalls.map(({br,point})=>({id:br.id,point})),
  logicalMotorLinks:motorGroups.length,landfallCount:landfalls.length,
  bridgeDeckJoints:motorGroups.every(group=>group.length===1||group.every((br,i)=>i===0||overlap(group[i-1],br))),
  bridgeRoadLinks:landfalls.every(({br,start})=>{
    const end=br.dir==='h'?{x:start?br.x-150:br.x+br.w,y:br.y,w:150,h:br.h}:
      {x:br.x,y:start?br.y-150:br.y+br.h,w:br.w,h:150};
    return roads.some(r=>overlap(end,r));
  }),
  failedTrafficSamples:failedTrafficSamples.slice(0,12),safeTraffic:failedTrafficSamples.length===0,
  streetProps:streetProps.length,
  trafficModels:new Set(trafficCars.map(c=>c.type)).size,
  courtyards:parkZones.filter(p=>p.courtyard).length,
  clearParks:parkZones.every(p=>!buildings.some(b=>overlap(p,b))),
  scenicLanes:scenicRoads.length,
  scenicLanesSafe:scenicRoads.every(r=>r.points.every(([x,y])=>[[-r.width/2,0],[r.width/2,0],[0,-r.width/2],[0,r.width/2]].every(([dx,dy])=>isPositionOnIslandLand(x+dx,y+dy))&&!buildings.some(b=>x>b.x-r.width/2&&x<b.x+b.w+r.width/2&&y>b.y-r.width/2&&y<b.y+b.h+r.width/2))),
  naturalIslets:islets.length,
  connectedDistricts:safeSpawnPoints.every(sp=>roadPath(roadGraph,safeSpawnPoints[0],sp).length>0),
  terminals:roadEnds.length,
  unfinishedRoadEnds:roads.filter(r=>!r.bridgeApproach&&!r.serviceAccess).flatMap(r=>r.dir==='h'?[{x:r.x,y:r.y+r.h/2,road:r},{x:r.x+r.w,y:r.y+r.h/2,road:r}]:[{x:r.x+r.w/2,y:r.y,road:r},{x:r.x+r.w/2,y:r.y+r.h,road:r}]).filter(p=>![...roads,...bridges].some(r=>r!==p.road&&p.x>=r.x-1&&p.x<=r.x+r.w+1&&p.y>=r.y-1&&p.y<=r.y+r.h+1)&&!roadEnds.some(t=>Math.hypot(t.x-p.x,t.y-p.y)<=t.radius)).length,
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
`,sandbox);

assert.equal(sandbox.report.connectedDistricts,true,'every district must have a road route');
assert.equal(sandbox.report.routedPedestrians,sandbox.report.pedestrians,'every resident must have a walking route');
assert(sandbox.report.terminals>0);
console.log('HUGE_WORLD_REPORT',JSON.stringify(sandbox.report));
assert.equal(sandbox.report.unfinishedRoadEnds,0);
assert.equal(sandbox.report.width,18500);
assert.equal(sandbox.report.height,19800);
assert.equal(sandbox.report.islands,16);
assert.equal(sandbox.report.bridges,88);
assert.ok(sandbox.report.roads>=90);
assert.ok(sandbox.report.buildings>=220);
assert.ok(sandbox.report.traffic>=55);
assert.ok(sandbox.report.pedestrians>=100);
assert.ok(sandbox.report.parks>=8);
assert.ok(sandbox.report.courtyards>=8);
assert.equal(sandbox.report.clearParks,true,'park or courtyard overlaps a building');
assert.equal(sandbox.report.outOfBounds,0);
assert.equal(sandbox.report.roadBuildingConflicts.length,0);
assert.equal(sandbox.report.logicalMotorLinks,24);
assert.equal(sandbox.report.landfallCount,48);
assert.equal(sandbox.report.bridgeDeckJoints,true,'intermediate motor bridge decks must overlap');
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
assert.equal(sandbox.report.stuntZones,0,'public roads must contain no stunt installations');
assert.equal(sandbox.report.crosswalkApproaches,4);
console.log('HUGE_WORLD_OK',JSON.stringify(sandbox.report));
