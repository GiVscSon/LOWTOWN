import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { runtimeCity } from './helpers/runtime-city.mjs';
import { roadPath } from '../src/game/street_network.js';
import { createFreeRoam } from '../src/game/free_roam.js';
import { chassis, contact } from '../src/game/solid_contacts.js';

const graph=[{x:0,y:0,edges:new Set([1,2])},{x:100,y:100,edges:new Set([0,3])},
  {x:5,y:0,edges:new Set([0,3])},{x:10,y:0,edges:new Set([1,2])}];
assert.equal(roadPath(graph,graph[0],graph[3])[1].x,5,'routes must minimise distance, not junction count');
const city=runtimeCity(19);
const coverage=JSON.parse(city.run(`JSON.stringify({
  districts:islands.map(i=>({id:i.id,people:pedestrians.filter(p=>p.districtId===i.id).length,
    routes:walkingRoutes.filter(r=>r.districtId===i.id).length,roof:districtProfiles[i.id].roof})),
  bases:serviceBases.map(b=>({sign:b.building.sign,kind:b.kind,
    clear:!isPedestrianSceneryBlocked(b.origin.x,b.origin.y),
    routes:safeSpawnPoints.every(p=>roadPath(roadGraph,b.origin,p).length>0)})),
  misplaced:pedestrians.filter(p=>p.route?.districtId!==p.districtId).length
})`));
assert.equal(coverage.districts.length,16);
assert(coverage.districts.every(d=>d.people>=8&&d.routes>0),'all districts need residents and local routes');
assert.equal(new Set(coverage.districts.map(d=>d.roof)).size,16,'districts must have distinct materials');
assert.equal(coverage.misplaced,0,'assigning a park route must not move residents to a different island');
assert.equal(coverage.bases.length,10,'every ground response facility must have an actual road entrance');
assert(coverage.bases.every(b=>b.clear&&b.routes),'base entrances must be clear and connected');

// Exercise arrival, service and the entire return leg, including shore nodes.
// Traffic is tested separately below; this isolates navigation failures.
const services=JSON.parse(city.run(`JSON.stringify(safeSpawnPoints.map(destination=>{
  incidentResponseVehicles.length=0;incidentPoliceCars.length=0;
  const incident=cityIncidentDirector.start('fire',destination,{duration:600});
  dispatchIncidentResponse(incident);dispatchIncidentPolice(incident);
  const units=[...incidentResponseVehicles,...incidentPoliceCars];
  let offRoad=0,maxStep=0,scenery=0;
  for(let tick=0;tick<24000&&(incidentResponseVehicles.length||incidentPoliceCars.length);tick++){
    const before=new Map(units.map(unit=>[unit,{x:unit.x,y:unit.y}]));
    updateIncidentResponse(1/60);updateIncidentPolice(1/60);
    for(const unit of [...incidentResponseVehicles,...incidentPoliceCars]){
      if(!policeFootprintOnRoad(unit))offRoad++;
      if(isPedestrianSceneryBlocked(unit.x,unit.y))scenery++;
      maxStep=Math.max(maxStep,Math.hypot(unit.x-before.get(unit).x,unit.y-before.get(unit).y));
    }
  }
  return {destination,units:units.length,offRoad,scenery,maxStep,fire:!!incident.fireSuppressed,
    medical:!!incident.medicalTreated,returned:units.every(unit=>unit.returnedToBase),
    remaining:[...incidentResponseVehicles,...incidentPoliceCars].map(u=>({model:u.model,status:u.status,x:u.x,y:u.y,head:u.route?.[0]}))};
}))`));
for(const result of services){
  assert.equal(result.units,3,JSON.stringify(result));assert.equal(result.offRoad,0,JSON.stringify(result));
  assert.equal(result.scenery,0,JSON.stringify(result));assert(result.maxStep<6.1,JSON.stringify(result));
  assert(result.fire&&result.medical&&result.returned&&result.remaining.length===0,JSON.stringify(result));
}

const policeByFps=[];
for(const fps of [30,60,120]){
  const c=runtimeCity(31);
  const result=JSON.parse(c.run(`
    reconcilePoliceRoster=()=>{};state.wanted=1;state.invulnTimer=999;
    Object.assign(player,{x:1900,y:1200,angle:0,speed:0});
    policeCars.push({x:1200,y:1200,angle:0,speed:0,maxSpeed:3,route:[{x:1900,y:1200}],routeTimer:99,strobePhase:0});
    for(let tick=0;tick<${fps*2};tick++)updatePoliceAI(1/${fps});
    JSON.stringify({fps:${fps},x:policeCars[0].x,y:policeCars[0].y,speed:policeCars[0].speed});
  `));
  policeByFps.push(result);
}
assert(Math.max(...policeByFps.map(c=>c.x))-Math.min(...policeByFps.map(c=>c.x))<4,
  `police motion must represent elapsed seconds at every frame rate: ${JSON.stringify(policeByFps)}`);

const people=JSON.parse(city.run(`
  trafficCars.length=0;policeCars.length=0;incidentPoliceCars.length=0;incidentResponseVehicles.length=0;
  Object.assign(player,{x:1200,y:1200,angle:0,speed:5});roam={mode:'helicopter',altitude:220};
  const saved=pedestrians.splice(0),testPerson={x:1200,y:1200,walkPhase:0,pause:10};pedestrians.push(testPerson);
  state.wanted=0;updatePedestrians(1/60);const aerialWanted=state.wanted;
  incidentResponseVehicles.push({x:1500,y:1200,angle:Math.PI/2,width:72,height:34,speed:0});
  const ambulanceBlocked=isPedestrianBlocked(1500,1230),ambulanceSideClear=!isPedestrianBlocked(1530,1200);
  incidentResponseVehicles.length=0;pedestrians.splice(0,1,...saved);roam=undefined;
  Object.assign(player,{x:10000,y:11000,speed:0});
  const before=pedestrians.map(p=>({x:p.x,y:p.y}));
  let activities=0,blocked=0,roadWalking=0;
  for(let tick=0;tick<720;tick++){
    updateCrowdReactions(pedestrians,null,1/60);updatePedestrians(1/60);
    activities+=pedestrians.filter(p=>p.activity==='checkingPhone').length;
    blocked+=pedestrians.filter(p=>isPedestrianSceneryBlocked(p.x,p.y)).length;
    roadWalking+=pedestrians.filter(p=>onRoadSurface(p.x,p.y,roads,bridges,[],roadEnds)).length;
  }
  JSON.stringify({aerialWanted,ambulanceBlocked,ambulanceSideClear,activities,blocked,roadWalking,
    progressed:pedestrians.filter((p,i)=>Math.hypot(p.x-before[i].x,p.y-before[i].y)>10).length,
    people:pedestrians.length});
`));
assert.equal(people.aerialWanted,0,'overflying a person is not a road collision');
assert(people.ambulanceBlocked&&people.ambulanceSideClear,'pedestrians must respect rotated service chassis');
assert(people.activities>0,'residents should take visible breaks');assert.equal(people.blocked,0);
assert.equal(people.roadWalking,0,'authored sidewalk routes must remain off the carriageway');
assert(people.progressed>people.people*.7,'activity pauses must not stop city movement');

const walker={x:0,y:0,angle:0,speed:0,hp:100};
const actors=[];
const foot=createFreeRoam(walker,[],[],[],()=>true,()=>{},[],()=>false,()=>actors);
foot.interact();const footStart={x:walker.x,y:walker.y};
actors.push({x:walker.x+50,y:walker.y+50,width:72,height:34,angle:Math.PI/4});
for(let tick=0;tick<60;tick++){
  foot.step({down:true},1/60);
  assert.equal(contact(chassis(walker),chassis(actors[0])),null,'player on foot entered a service vehicle');
}
assert(Math.hypot(walker.x-footStart.x,walker.y-footStart.y)<45,'a moving actor must block the player on foot');
const stopped={x:walker.x,y:walker.y};actors.length=0;
for(let tick=0;tick<20;tick++)foot.step({down:true},1/60);
assert(Math.hypot(walker.x-stopped.x,walker.y-stopped.y)>45,'walking must resume after the car moves away');

const directory=new URL('../artifacts/living-city/',import.meta.url);
mkdirSync(directory,{recursive:true});
writeFileSync(new URL('report.json',directory),JSON.stringify({seed:19,coverage,services,policeByFps,people},null,2));
console.log('LIVING CITY PASS',JSON.stringify({districts:coverage.districts.length,bases:coverage.bases.length,
  closedLoops:services.length*3,offRoad:services.reduce((n,r)=>n+r.offRoad,0),policeByFps,people}));
