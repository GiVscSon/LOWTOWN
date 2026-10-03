import assert from 'node:assert/strict';
import * as THREE from 'three';
import {runtimeCity} from './helpers/runtime-city.mjs';
import {createBridgeProfiles,bridgeSurfaceIndex,raisedBridgeGeometry,addBridgeStructures} from '../src/three/bridges.js';
import {createBoxBatch} from '../src/three/geometry.js';
import {mkdirSync,writeFileSync} from 'node:fs';
const city=runtimeCity(73),report=JSON.parse(city.run(`JSON.stringify((()=>{
 const paint=buildRoadPaintGeometry(),network=[...roads,...bridges.filter(b=>!b.footway)],seen=new Set([0]),queue=[0];
 for(let i=0;i<queue.length;i++)for(const id of roadGraph[queue[i]].edges)if(!seen.has(id)){seen.add(id);queue.push(id);}
 const lots=buildings.map(b=>({sign:b.sign,facing:b.streetFacing,road:b.streetId,
  clear:rectangleClearOfStreets(b,[...network.filter(r=>!r.serviceAccess),...scenicRoads.map(r=>corridorRoad(r.points,r.width)),...bridges.filter(b=>b.footway)],18),
  land:[[0,0],[1,0],[0,1],[1,1]].every(([u,v])=>isPositionOnIslandLand(b.x+b.w*u,b.y+b.h*v))}));
 const bent=roads.filter(r=>!r.serviceAccess&&!r.bridgeApproach&&r.points.some(p=>{const a=r.points[0],b=r.points.at(-1);return Math.abs((b[0]-a[0])*(p[1]-a[1])-(b[1]-a[1])*(p[0]-a[0]))/Math.hypot(b[0]-a[0],b[1]-a[1])>25;})).length;
 const badCaps=roadEnds.filter(end=>{const forward={x:end.x+Math.cos(end.angle)*12,y:end.y+Math.sin(end.angle)*12};return network.some(r=>r.id!==end.roadId&&corridorContains(forward.x,forward.y,r,-5));});
 return {roads:roads.length,bent,nodes:roadGraph.length,connected:seen.size,buildings:lots,paths:paint.bridgePaths,badCaps,
  bases:serviceBases.length,buses:trafficCars.filter(c=>c.type==='bus').length,residents:pedestrians.length};
})())`));
assert(report.bent>=45,'district streets must have genuine curves');assert.equal(report.connected,report.nodes);
assert.equal(report.buildings.length,232);assert(report.buildings.every(b=>b.clear&&b.land&&b.road&&b.facing),JSON.stringify(report.buildings.filter(b=>!b.clear||!b.land||!b.road||!b.facing)));
assert.equal(report.bases,10);assert.equal(report.buses,4);assert.equal(report.residents,152);
assert.equal(report.badCaps.length,0,'end caps must not seal a connected road');
const profiles=createBridgeProfiles(report.paths),surface=bridgeSurfaceIndex(profiles),scene=new THREE.Scene();
const details=createBoxBatch(scene,'#ffffff'),reflectors=createBoxBatch(scene,'#ffffff');let arches=0,piers=0;
for(const profile of profiles){
 assert(profile.organic);assert(profile.samples.length>10);
 assert(Math.abs(profile.samples[0].height-3.6)<1e-8&&Math.abs(profile.samples.at(-1).height-3.6)<1e-8,'ramps must meet the street height');
 assert(Math.max(...profile.samples.map(p=>p.height))>55,'deck has no visible clearance above water');
 for(let i=0;i<profile.samples.length;i++){
  const p=profile.samples[i];assert(Math.abs(surface(p.point.x,p.point.y).height-p.height)<1e-5);
  if(i){const previous=profile.samples[i-1];assert(Math.abs(p.height-previous.height)/(p.distance-previous.distance)<.34,'bridge ramp is too steep');}
 }
 for(const underside of [false,true]){
  const geometry=raisedBridgeGeometry(profile,underside),pos=geometry.attributes.position;
  assert([...pos.array,...geometry.attributes.normal.array].every(Number.isFinite));
  for(let i=0;i<profile.samples.length;i++){
   assert(Math.abs(pos.getY(i*2)-profile.samples[i].height+(underside?12:0))<.001);
   const a=new THREE.Vector3().fromBufferAttribute(pos,i*2),b=new THREE.Vector3().fromBufferAttribute(pos,i*2+1);
   assert(Math.abs(a.distanceTo(b)-profile.width)<.003,'bridge width drifts at the bend');
  }
  geometry.dispose();
 }
 const counts=addBridgeStructures(profile,{details,reflectors});assert(counts.arches>=1&&counts.piers>=1);arches+=counts.arches;piers+=counts.piers;
}
details.flush();reflectors.flush();assert(scene.children.every(m=>Number.isFinite(m.boundingSphere.radius)));
mkdirSync('artifacts/organic-streets',{recursive:true});const summary={roads:report.roads,bent:report.bent,nodes:report.nodes,buildings:232,bridges:profiles.length,arches,piers,bases:10};
writeFileSync('artifacts/organic-streets/geometry.json',JSON.stringify(summary,null,2));console.log('ORGANIC_STREETS_PASS',summary);
