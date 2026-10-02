import * as authoredWorld from '../src/game/authored_archipelago.js';
import { PLANE_RUNWAYS as LEGACY_RUNWAYS } from '../src/game/free_roam.js';
import * as emergencyPassing from '../src/game/emergency_passing.js';
import * as streetNetwork from '../src/game/street_network.js';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import * as core from '../src/game/test_drive_core.js';
import * as contacts from '../src/game/solid_contacts.js';
import * as coast from '../src/game/coastline.js';
import * as roamModule from '../src/game/free_roam.js';
import * as architecture from '../src/game/architecture.js';
import * as trafficTurns from '../src/game/traffic_turns.js';
import * as ocean from '../src/game/ocean_chunks.js';
import * as surfaces from '../src/game/surface_physics.js';
import * as incidents from '../src/game/city_incidents.js';
let depth=0,draws=0;const mapLabels=[];
const noop=()=>{};
const context=new Proxy({save(){depth++;},restore(){depth--;assert(depth>=0);},fillText(value){mapLabels.push(String(value));},createRadialGradient(){return {addColorStop:noop};},createLinearGradient(){return {addColorStop:noop};}}, {get(target,key){return key in target?target[key]:(...args)=>{for(const arg of args)if(typeof arg==='number')assert(Number.isFinite(arg),`Non-finite ${key}`);draws++;};},set(target,key,value){target[key]=value;return true;}});
const element=()=>({width:900,height:700,style:{},classList:{add:noop,remove:noop},appendChild:noop,append:noop,addEventListener:noop,getContext:()=>context,remove:noop});
const sandbox={...authoredWorld,LEGACY_RUNWAYS,...emergencyPassing,...streetNetwork,...ocean,...surfaces,...incidents,assert,console,Math,mapLabels,depth,draws,performance:{now:()=>100},document:{readyState:'loading',getElementById:element,createElement:element,querySelectorAll:()=>[],addEventListener:noop},window:{innerWidth:1100,innerHeight:800,addEventListener:noop},localStorage:{getItem:()=>null,setItem:noop},setTimeout:noop,setInterval:noop,requestAnimationFrame:noop,...core,...contacts,...coast,...roamModule,...architecture,...trafficTurns};
Object.defineProperties(sandbox,{depth:{get:()=>depth},draws:{get:()=>draws}});
vm.createContext(sandbox);
const source=readFileSync(new URL('../src/main.js',import.meta.url),'utf8').replace(/^import .*;\n/gm,'');
vm.runInContext(source+`\ninitTopology();
const expectedFacilityTypes={
  'EASTGATE FIRE & RESCUE':'firestation','NORTHSIDE CLINIC':'hospital',
  'CINDER FIRE STATION':'firestation','KINGSWAY AIRFIELD':'airfield','SKYFREIGHT 90':'airfield',
  'AIR AMBULANCE BASE':'airAmbulanceBase','AIRPORT FIRE CREW':'firestation',
  'ALL SAINTS HOSPITAL':'hospital','EMS DISPATCH':'hospital','FAMILY CLINIC':'hospital',
  'NATIONAL GUARD ARMORY':'guardBase','FIRE SERVICE DEPOT':'firestation',
  'KINGSPORT MARINA':'depot','MARITIME RESCUE':'marineRescueBase','COAST GUARD STATION':'marineRescueBase'
};
const serviceFacilities=buildings.filter(building=>Object.hasOwn(expectedFacilityTypes,building.sign));
for(const [sign,type] of Object.entries(expectedFacilityTypes)){
  const matches=serviceFacilities.filter(building=>building.sign===sign);
  assert.equal(matches.length,1,'facility parcel should survive district styling: '+sign);
  assert.equal(matches[0].civicType,type,'facility should retain its service classification: '+sign);
  if(type==='airAmbulanceBase'||type==='marineRescueBase')assert.equal(matches[0].archetype,'civic','non-road response bases should use civic architecture: '+sign);
}
const roadServiceBases=serviceFacilities.filter(building=>building.civicType==='firestation'||building.civicType==='hospital');
const facilityRouteAudit=roadServiceBases.map(building=>{
  const center={x:building.x+building.w/2,y:building.y+building.h/2},start=nearestRoadNode(center);
  return {sign:building.sign,nearestRoadDistance:Math.hypot(start.x-center.x,start.y-center.y),routes:safeSpawnPoints.map(target=>roadPath(roadGraph,start,target))};
});
const brokenFacilityRoutes=facilityRouteAudit.filter(base=>base.nearestRoadDistance>=600||base.routes.some(route=>route.length<1||!route.every(node=>onRoadSurface(node.x,node.y,roads,bridges,scenicRoads,roadEnds)))).map(base=>({sign:base.sign,nearestRoadDistance:base.nearestRoadDistance,routeLengths:base.routes.map(route=>route.length)}));
assert.equal(brokenFacilityRoutes.length,0,'road response bases should connect across the whole road network: '+JSON.stringify(brokenFacilityRoutes));
this.facilityRouteAudit=facilityRouteAudit.map(base=>({sign:base.sign,nearestRoadDistance:+base.nearestRoadDistance.toFixed(1),destinations:base.routes.length}));
this.nonRoadFacilities=serviceFacilities.filter(building=>building.civicType==='airAmbulanceBase'||building.civicType==='marineRescueBase').map(building=>({sign:building.sign,type:building.civicType}));
roam=createFreeRoam(player,parkedCars,buildings,trees,isPositionOnSolidGround);
renderWorld();renderFullMap();roam.interact();renderWorld();
Object.assign(player,{x:1040,y:2130});roam.interact();roam.toggleFlight();
for(let i=0;i<100;i++)updatePhysics(1/60);renderWorld();renderFullMap();
mapLabels.length=0;renderFullMap();
const smokeIncident=cityIncidentDirector.start('fire',{x:pedestrians[3].x,y:pedestrians[3].y});
smokeIncident.reported=true;
updatePhysics(1/60);renderWorld();
const responseStartDistance=incidentPoliceCars.length?Math.hypot(incidentPoliceCars[0].x-incidentPoliceCars[0].responseTarget.x,incidentPoliceCars[0].y-incidentPoliceCars[0].responseTarget.y):Infinity;
// Independently advancing only the services leaves every traffic obstacle frozen.
// This render fixture isolates routes; dynamic bypass has its own live obstacle regression.
[...incidentResponseVehicles,...incidentPoliceCars].forEach(unit=>unit.priorityPassing=false);
const incidentUnits=incidentResponseVehicles.slice();
const serviceStartDistances=incidentUnits.map(c=>Math.hypot(c.x-c.responseTarget.x,c.y-c.responseTarget.y));
const remainingRoute=unit=>responseRouteLength(unit.route)+(unit.route[0]?Math.hypot(unit.x-unit.route[0].x,unit.y-unit.route[0].y):0);
const serviceStartRoutes=incidentUnits.map(remainingRoute);
for(let i=0;i<240;i++)updateIncidentPolice(1/60);
for(let i=0;i<240;i++)updateIncidentResponse(1/60);
const responseEndDistance=incidentPoliceCars.length?Math.hypot(incidentPoliceCars[0].x-incidentPoliceCars[0].responseTarget.x,incidentPoliceCars[0].y-incidentPoliceCars[0].responseTarget.y):Infinity;
const serviceEndDistances=incidentUnits.map(c=>Math.hypot(c.x-c.responseTarget.x,c.y-c.responseTarget.y));
const serviceEndRoutes=incidentUnits.map(remainingRoute);
for(let i=0;i<9000&&(!smokeIncident.fireSuppressed||!smokeIncident.medicalTreated);i++)updateIncidentResponse(1/60);
for(let i=0;i<9000&&incidentResponseVehicles.length;i++)updateIncidentResponse(1/60);
renderWorld();
this.runwayTaxiAudit=PLANE_RUNWAYS.map(runwayTaxiwayPlan).filter(Boolean);
this.modeResult={mode:roam.mode,x:player.x,y:player.y,altitude:roam.altitude};
this.mapLabels=mapLabels.slice();this.vehicleNames=roam.fleet.map(v=>v.name);
this.routeAudit={walkingRoutes:walkingRoutes.length,transitRoutes:transitRoutes.map(r=>({id:r.id,points:r.points.length,stops:r.stopCount,roadBound:r.points.every(p=>onRoadSurface(p.x,p.y,roads,bridges,scenicRoads,roadEnds))})),buses:trafficCars.filter(c=>c.routeManaged).length};
this.incidentAudit={active:!!cityIncidentDirector.current(),reactions:pedestrians.filter(p=>p.reaction==='fleeing'||p.reaction==='curious').length,responders:incidentPoliceCars.length,roadBound:incidentPoliceCars.every(c=>c.route.length>0&&c.route.every(p=>onRoadSurface(p.x,p.y,roads,bridges,scenicRoads,roadEnds))),responseStartDistance,responseEndDistance,responseCar:incidentPoliceCars.map(c=>({x:c.x,y:c.y,target:c.responseTarget,speed:c.speed,routeTimer:c.routeTimer,routeLength:c.route?.length,arrived:c.arrived})),arrivalAccurate:incidentPoliceCars.every(c=>!c.arrived||Math.hypot(c.x-c.responseTarget.x,c.y-c.responseTarget.y)<35),visible:mapLabels.includes('ПОЖАР')};
this.incidentAudit.serviceCount=incidentUnits.length;
this.incidentAudit.serviceTypes=incidentUnits.map(c=>c.model);
this.incidentAudit.serviceStartDistances=serviceStartDistances;
this.incidentAudit.serviceEndDistances=serviceEndDistances;
this.incidentAudit.serviceStartRoutes=serviceStartRoutes;
this.incidentAudit.serviceEndRoutes=serviceEndRoutes;
this.incidentAudit.serviceFinal=incidentUnits.map(c=>({model:c.model,status:c.status,x:c.x,y:c.y,target:c.responseTarget,base:c.baseTarget,speed:c.speed,routeLength:c.route?.length,routeTimer:c.routeTimer,routeHead:c.route?.[0],distance:Math.hypot(c.x-c.responseTarget.x,c.y-c.responseTarget.y)}));
this.incidentAudit.servicesRoadBound=incidentUnits.every(c=>c.route.length>0&&c.route.every(p=>onRoadSurface(p.x,p.y,roads,bridges,scenicRoads,roadEnds)));
this.incidentAudit.fireSuppressed=smokeIncident.fireSuppressed;
this.incidentAudit.medicalTreated=smokeIncident.medicalTreated;
this.incidentAudit.treatedPatients=smokeIncident.actors.filter(p=>p.medicalTreated).length;
this.incidentAudit.serviceUnitsReturned=incidentResponseVehicles.length===0&&incidentUnits.every(c=>c.returnedToBase);
assert.equal(depth,0,'Balanced canvas state in car, pedestrian and aircraft rendering');
assert(draws>800);assert.equal(modeResult.mode,'helicopter');
assert(Number.isFinite(modeResult.x));assert(modeResult.altitude>100);
assert.equal(mapLabels.filter(label=>label==='ВПП').length,PLANE_RUNWAYS.length,'Every runway must be clearly marked on the map');
assert(PLANE_RUNWAYS.every(r=>[[r.x,r.y],[r.x+r.w,r.y],[r.x,r.y+r.h],[r.x+r.w,r.y+r.h]].every(([x,y])=>isPositionOnIslandLand(x,y))),'runway corners must be dry land');
assert(runwayTaxiAudit.length>=1,'at least one runway should have a safe taxiway on the authored islands');
assert(runwayTaxiAudit.every(plan=>plan.samples.every(p=>isPositionOnIslandLand(p.x,p.y)&&!onRoadSurface(p.x,p.y,roads,bridges,scenicRoads,roadEnds))),'taxiway samples must stay on dry non-road ground');
assert(vehicleNames.every(name=>!mapLabels.includes(name)),'Fleet names must not cover map landmarks');
assert(routeAudit.walkingRoutes>0,'pedestrians need generated footpaths');
assert(routeAudit.transitRoutes.length>=2&&routeAudit.transitRoutes.every(r=>r.points>20&&r.stops>=10&&r.roadBound),'bus routes must connect city districts on the actual road graph');
assert(routeAudit.buses>=4,'public transit should run on the planned routes');
assert(incidentAudit.active&&incidentAudit.reactions>0,'city events should trigger pedestrian reactions');
assert(incidentAudit.responders===1&&incidentAudit.roadBound,'reported events should dispatch police over the road graph');
assert(incidentAudit.responseEndDistance<incidentAudit.responseStartDistance,'dispatched patrol should progress toward the incident: '+JSON.stringify(incidentAudit));
assert(incidentAudit.serviceCount===2,'a fire should dispatch an engine and an ambulance: '+JSON.stringify(incidentAudit));
assert.deepEqual([...incidentAudit.serviceTypes].sort(),['ambulance','fireEngine']);
assert(incidentAudit.servicesRoadBound,'emergency vehicle routes must stay on connected roads');
assert(incidentAudit.serviceEndRoutes.every((distance,index)=>distance<incidentAudit.serviceStartRoutes[index]),'fire and medical crews should make progress along their actual road route: '+JSON.stringify(incidentAudit));
assert.equal(incidentAudit.fireSuppressed,true,'the fire crew should contain the scene fire: '+JSON.stringify(incidentAudit));
assert.equal(incidentAudit.medicalTreated,true,'the ambulance should stabilize injured scene actors: '+JSON.stringify(incidentAudit));
assert(incidentAudit.treatedPatients>0,'medical crews should treat visible patients');
assert(incidentAudit.serviceUnitsReturned,'response vehicles should route back to base and leave the active scene');
assert(incidentAudit.arrivalAccurate,'a patrol must not count an intermediate road node as arrival');
assert(incidentAudit.visible,'incident should have a visible in-world marker');

// Change the test trail on every run, but keep one run reproducible if it fails.
initTopology();
roam=createFreeRoam(player,parkedCars,buildings,trees,isPositionOnSolidGround);
trafficCars.length=0;policeCars.length=0;incidentPoliceCars.length=0;incidentResponseVehicles.length=0;parkedCars.length=0;
const seed=(Date.now()^Math.floor(Math.random()*0xffffffff))>>>0;
let rng=seed||1;
const random=()=>{rng=(Math.imul(rng,1664525)+1013904223)>>>0;return rng/0x100000000;};
const safeRoadNodes=roadGraph.filter(n=>isPositionOnSolidGround(n.x,n.y)&&
  onRoadSurface(n.x,n.y,roads,bridges,scenicRoads,roadEnds)&&
  [...n.edges].some(id=>roadGraph[id]&&Math.hypot(roadGraph[id].x-n.x,roadGraph[id].y-n.y)>90)&&
  !buildings.some(b=>n.x>b.x-70&&n.x<b.x+b.w+70&&n.y>b.y-70&&n.y<b.y+b.h+70)&&
  !trees.some(t=>Math.hypot(n.x-t.x,n.y-t.y)<65)&&
  !solidProps.some(o=>Math.abs(n.x-o.x)<o.width/2+60&&Math.abs(n.y-o.y)<o.height/2+60)&&
  !roam.fleet.some(v=>Math.hypot(n.x-v.x,n.y-v.y)<110));
const travelSamples=[];
for(let row=0;row<3;row++)for(let col=0;col<4;col++){
  const x0=col*WORLD_W/4,x1=(col+1)*WORLD_W/4,y0=row*WORLD_H/3,y1=(row+1)*WORLD_H/3;
  const region=safeRoadNodes.filter(n=>n.x>=x0&&n.x<x1&&n.y>=y0&&n.y<y1);
  if(!region.length)continue;
  const start=region[Math.floor(random()*region.length)];
  const links=[...start.edges].map(id=>roadGraph[id]).filter(n=>n&&Math.hypot(n.x-start.x,n.y-start.y)>90);
  if(!links.length)continue;
  const end=links[Math.floor(random()*links.length)],angle=Math.atan2(end.y-start.y,end.x-start.x);
  roam.resetToSedan(start.x,start.y,angle);
  Object.assign(state,{isDrowning:false,drownProgress:0,wanted:0,invulnTimer:999});
  Object.assign(state.keys,{up:true,down:false,left:false,right:false,handbrake:false,nitro:false});
  for(let frame=0;frame<30;frame++)updatePhysics(1/60);
  state.keys.up=false;
  const distance=Math.hypot(player.x-start.x,player.y-start.y);
  assert(Number.isFinite(player.x)&&Number.isFinite(player.y)&&Number.isFinite(player.speed),'random drive produced a non-finite state');
  assert(isPositionOnSolidGround(player.x,player.y),'random drive left dry ground');
  assert(onRoadSurface(player.x,player.y,roads,bridges,scenicRoads,roadEnds),'random drive slipped out of the road corridor');
  assert(distance>4,'random drive failed to move from its sampled location');
  travelSamples.push({row,col,surface:player.surface,distance:+distance.toFixed(1)});
}
const peopleOnLand=pedestrians.every(p=>Number.isFinite(p.x)&&Number.isFinite(p.y)&&isPositionOnSolidGround(p.x,p.y));
assert(peopleOnLand,'pedestrian route update moved a person off the world surface');
assert(travelSamples.length>=9,'random drive samples did not cover enough city regions; seed='+seed+' samples='+travelSamples.length);
assert(new Set(travelSamples.map(p=>p.col)).size===4&&new Set(travelSamples.map(p=>p.row)).size===3,'random drive samples must reach the full city span; seed='+seed);
this.randomTravelAudit={seed,samples:travelSamples.length,regions:travelSamples,people:pedestrians.length,peopleOnLand};
console.log('PASS: facility classification and routes, actual rendering, event response, and randomized travel across the road network',JSON.stringify({facilities:this.facilityRouteAudit,nonRoadFacilities:this.nonRoadFacilities,travel:this.randomTravelAudit}));
`,sandbox);
