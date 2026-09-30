import assert from 'node:assert/strict';
import {mkdirSync,writeFileSync} from 'node:fs';
import {runtimeCity} from './helpers/runtime-city.mjs';
import {DISTRICT_DRAFTS,AUTHORED_ISLETS,ARTERIAL_X,ARTERIAL_Y,worldPoint} from '../src/game/authored_archipelago.js';
import {coastPoints} from '../src/game/coastline.js';

const districts=Object.values(DISTRICT_DRAFTS);
assert.equal(new Set(districts.map(d=>d.w*d.h)).size,16,'every major island needs its own area');
assert.equal(new Set(districts.map(d=>JSON.stringify(d.coast))).size,16,'coasts must have distinct authored control points');
const gaps=[];
for(const a of districts)for(const b of districts){
 if(a.row===b.row&&b.column===a.column+1){
  const gap=Math.min(...coastPoints(b).map(p=>p[0]))-Math.max(...coastPoints(a).map(p=>p[0]));gaps.push(gap);assert(gap>400,`${a.id} / ${b.id}: ${gap}`);
 }
 if(a.column===b.column&&b.row===a.row+1){
  const gap=Math.min(...coastPoints(b).map(p=>p[1]))-Math.max(...coastPoints(a).map(p=>p[1]));gaps.push(gap);assert(gap>400,`${a.id} / ${b.id}: ${gap}`);
 }
}
const city=runtimeCity(73);
const report=JSON.parse(city.run(`JSON.stringify((()=>{
 const overlap=(a,b)=>a.x<b.x+b.w&&a.x+a.w>b.x&&a.y<b.y+b.h&&a.y+a.h>b.y;
 const propsOnRoad=solidProps.filter(p=>roads.some(r=>overlap({x:p.x-(p.width||12)/2,y:p.y-(p.height||12)/2,w:p.width||12,h:p.height||12},r)));
 const blockingRails=bridgeRails.filter(rail=>roads.some(r=>overlap(rail,r)));
 const streetSceneryOnRoad=[...trees,...breakableProps,...streetLights,...billboards,...cranes].filter(p=>{
  const w=p.width||p.w||(streetLights.includes(p)?6:billboards.includes(p)?80:20),h=p.height||p.h||(streetLights.includes(p)?6:billboards.includes(p)?12:20);
  return [[0,0],[-w/2,-h/2],[w/2,-h/2],[-w/2,h/2],[w/2,h/2]].some(([dx,dy])=>onRoadSurface(p.x+dx,p.y+dy,roads,bridges,scenicRoads,roadEnds));
 });
 const duplicateRoads=roads.flatMap((a,i)=>roads.slice(i+1).filter(b=>a.dir===b.dir&&Math.abs(a.x-b.x)<.01&&Math.abs(a.y-b.y)<.01&&Math.abs(a.w-b.w)<.01&&Math.abs(a.h-b.h)<.01));
 const stackedLines=buildRoadPaintGeometry().lanes.flatMap((a,i,lines)=>lines.slice(i+1).filter(b=>
  (Math.abs(a.y1-b.y1)<.01&&a.y1===a.y2&&b.y1===b.y2&&Math.max(a.x1,b.x1)<Math.min(a.x2,b.x2)-.1)||
  (Math.abs(a.x1-b.x1)<.01&&a.x1===a.x2&&b.x1===b.x2&&Math.max(a.y1,b.y1)<Math.min(a.y2,b.y2)-.1)));
 const footways=bridges.filter(b=>b.footway),blockedWalks=[];
 for(const b of footways){
  const distance=b.dir==='h'?b.w:b.h;
  for(let along=0;along<=distance;along+=8){
   const x=b.x+(b.dir==='h'?along:b.w/2),y=b.y+(b.dir==='v'?along:b.h/2);
   if(isPedestrianSceneryBlocked(x,y))blockedWalks.push({id:b.id,x,y});
  }
 }
 const fleet=createFreeRoam(player,parkedCars,buildings,trees,isPositionOnSolidGround,()=>{},solidProps,isPositionOnWaterObstacle,()=>[],{mapPoint:worldPoint,runways:PLANE_RUNWAYS}).fleet;
 const unsafeFleet=fleet.filter(v=>{
  const cs=Math.cos(v.angle),sn=Math.sin(v.angle),w=v.width/2,h=v.height/2;
  return [[0,0],[w,h],[w,-h],[-w,h],[-w,-h]].some(([a,b])=>v.kind==='water'?isPositionOnWaterObstacle(v.x+a*cs-b*sn,v.y+a*sn+b*cs):!isPositionOnSolidGround(v.x+a*cs-b*sn,v.y+a*sn+b*cs));
 });
 return {width:WORLD_W,height:WORLD_H,islands:islands.length,islets:islets.length,bridges:bridges.length,
  roadBridges:bridges.filter(b=>!b.footway).length,footways:footways.length,
  disconnectedNodes:roadGraph.filter(n=>!roadPath(roadGraph,roadGraph[0],n).length).length,
  propsOnRoad,blockingRails,streetSceneryOnRoad,duplicateRoads,stackedLines,blockedWalks,unsafeFleet,stunts:stuntZones.length,
  fleetCount:fleet.length,runways:PLANE_RUNWAYS.every(r=>[[0,0],[r.w,0],[0,r.h],[r.w,r.h]].every(([dx,dy])=>isPositionOnSolidGround(r.x+dx,r.y+dy)))};
})())`));
assert.equal(report.disconnectedNodes,0,'all road components must connect');
for(const key of ['propsOnRoad','blockingRails','streetSceneryOnRoad','duplicateRoads','stackedLines','blockedWalks','unsafeFleet'])assert.equal(report[key].length,0,`${key}: ${JSON.stringify(report[key].slice(0,4))}`);
assert.equal(report.stunts,0);assert.equal(report.roadBridges,24);assert.equal(report.footways,14);assert(report.runways);
const landings=city.run(`bridges.filter(b=>b.footway).filter(b=>b.id.endsWith('-1')).map(b=>({x:b.x+b.w/2,y:b.y+b.h-8}))`);
assert.equal(landings.length,AUTHORED_ISLETS.length);
for(const islet of AUTHORED_ISLETS){
 const parent=DISTRICT_DRAFTS[islet.parent];
 assert(city.run(`roadPath(roadGraph,{x:1265,y:1200},{x:${ARTERIAL_X[parent.column]},y:${ARTERIAL_Y[parent.row]}}).length>0`));
}
const expected=worldPoint({x:6200,y:4200});
const migration=JSON.parse(city.run(`{
 localStorage.getItem=()=>JSON.stringify({cash:913,x:6200,y:4200,parts:[{id:'turbo',found:true}]});loadProgress();
 const migrated={x:player.x,y:player.y,cash:state.cash,turbo:CARPARTS.find(p=>p.id==='turbo').found};
 let saved;localStorage.setItem=(key,value)=>saved=JSON.parse(value);autoSaveProgress();
 localStorage.getItem=()=>JSON.stringify(saved);loadProgress();
 JSON.stringify({migrated,saved,stable:player.x===saved.x&&player.y===saved.y});
}`));
assert.equal(migration.migrated.x,expected.x);assert.equal(migration.migrated.y,expected.y);
assert.equal(migration.migrated.cash,913);assert(migration.migrated.turbo&&migration.stable);assert.equal(migration.saved.worldVersion,2);
mkdirSync('artifacts/authored-world',{recursive:true});
writeFileSync('artifacts/authored-world/report.json',JSON.stringify({...report,minCoastGap:Math.min(...gaps),maxCoastGap:Math.max(...gaps),migration},null,2));
console.log('AUTHORED ARCHIPELAGO PASS',JSON.stringify({...report,minCoastGap:Math.min(...gaps),maxCoastGap:Math.max(...gaps),saveMigration:true}));
