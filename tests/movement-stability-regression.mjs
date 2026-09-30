import assert from 'node:assert/strict';
import {mkdirSync,writeFileSync} from 'node:fs';
import {runtimeCity} from './helpers/runtime-city.mjs';
import {roadPath,nextWalkingGoal} from '../src/game/street_network.js';

mkdirSync('artifacts/movement',{recursive:true});

const graph=[{x:0,y:0,edges:new Set([1])},{x:100,y:0,edges:new Set([0,2])},
  {x:200,y:0,edges:new Set([1])}];
assert.deepEqual(roadPath(graph,{x:25,y:0},graph[2],{fromSegment:true}).map(p=>p.x),[25,100,200]);
assert.deepEqual(roadPath(graph,{x:175,y:0},graph[0],{fromSegment:true}).map(p=>p.x),[175,100,0]);
assert.deepEqual(roadPath(graph,{x:74,y:0},{x:75,y:0},{fromSegment:true}).map(p=>p.x),[74,75]);
assert.equal(graph.length,3,'replanning must not alter the shared road graph');
const walker={route:{points:Array.from({length:10},(_,i)=>({x:i*8,y:0}))},routeIndex:8,routeDirection:1};
assert.equal(nextWalkingGoal(walker).x,72,'walk to the actual endpoint before turning back');
assert.equal(walker.routeDirection,1);nextWalkingGoal(walker);assert(walker.pause>=3);

const crowd=runtimeCity(19);
const people=JSON.parse(crowd.run(`{
  roads.length=0;bridges.length=0;buildings.length=0;trees.length=0;solidProps.length=0;
  trafficCars.length=0;parkedCars.length=0;pedestrians.length=0;isPositionOnSolidGround=()=>true;
  Object.assign(player,{x:10000,y:10000,speed:0});
  const route={points:Array.from({length:101},(_,i)=>({x:i*8,y:0})),kind:'sidewalk',loop:false};
  const p={x:80,y:0,route,routeIndex:10,routeDirection:-1,reaction:'calm',pause:0,activityTimer:999,socialCooldown:999};
  pedestrians.push(p);
  const incident={id:1,x:0,y:0,kind:'fight',dangerRadius:145,audienceRadius:470,interest:1,reported:true};
  let exited=false,reentries=0,wrongHeading=0;
  for(let t=0;t<1800;t++){
    const x=p.x,y=p.y;updateCrowdReactions(pedestrians,incident,1/60);updatePedestrians(1/60);
    if(p.x>=145)exited=true;else if(exited)reentries++;
    if(Math.hypot(p.x-x,p.y-y)>.1&&Math.cos(p.heading)*(p.x-x)+Math.sin(p.heading)*(p.y-y)<0)wrongHeading++;
  }
  const safePosition={x:p.x,y:p.y};
  for(let t=0;t<180;t++){updateCrowdReactions(pedestrians,null,1/60);updatePedestrians(1/60);}
  JSON.stringify({exited,reentries,wrongHeading,safePosition,
    resumed:Math.hypot(p.x-safePosition.x,p.y-safePosition.y)>10&&!p.evacuation});
}`));
assert(people.exited&&people.resumed,JSON.stringify(people));assert.equal(people.reentries,0);
assert.equal(people.wrongHeading,0,'moving spectators must face their actual direction of travel');

const pursuit=runtimeCity(37);
const police=JSON.parse(pursuit.run(`{
  const a=roadGraph.find(a=>[...a.edges].some(i=>roadGraph[i].y===a.y&&roadGraph[i].x>a.x+700&&
    policeFootprintOnRoad({x:a.x+(roadGraph[i].x-a.x)*.25,y:a.y,angle:0,width:48,height:24})));
  const b=roadGraph[[...a.edges].find(i=>roadGraph[i].y===a.y&&roadGraph[i].x>a.x+700&&
    policeFootprintOnRoad({x:a.x+(roadGraph[i].x-a.x)*.25,y:a.y,angle:0,width:48,height:24}))];
  const start=a.x+(b.x-a.x)*.25;
  reconcilePoliceRoster=()=>{};trafficCars.length=0;parkedCars.length=0;pedestrians.length=0;
  state.wanted=1;state.evadeTimer=999;state.invulnTimer=99999;
  Object.assign(player,{x:b.x,y:b.y,angle:0,speed:0});
  const cop={x:start,y:a.y,angle:0,speed:0,maxSpeed:3,route:[],routeTimer:0,strobePhase:0};policeCars.push(cop);
  let minimum=start,lateral=0;
  for(let t=0;t<900;t++){updatePoliceAI(1/60);minimum=Math.min(minimum,cop.x);lateral=Math.max(lateral,Math.abs(cop.y-a.y));}
  JSON.stringify({progress:cop.x-start,available:b.x-start,backtrack:start-minimum,lateral,status:cop.status});
}`));
assert(police.progress>police.available*.7,JSON.stringify(police));assert(police.backtrack<2);
assert(police.lateral<5,JSON.stringify(police));

const traffic=runtimeCity(73);
const yielding=JSON.parse(traffic.run(`{
  trafficCars.length=0;parkedCars.length=0;pedestrians.length=0;policeCars.length=0;
  Object.assign(player,{x:10000,y:11000});
  const unit={x:2065,y:1405,angle:-Math.PI/2,width:48,height:24,status:'enroute'};
  incidentPoliceCars.push(unit);
  const crossing={x:2046,y:1232,angle:Math.PI,width:46,height:22};trafficCars.push(crossing);
  const clearsIntersection=!yieldTrafficToServices(crossing,1/60);
  const parallel={x:14446.5,y:1208.9,angle:Math.PI/2,width:44,height:21,
    yieldHome:{cross:'x',value:14467}};
  Object.assign(unit,{x:14499,y:1285,angle:-Math.PI/2});
  const clearsJunctionWhileYielding=!yieldTrafficToServices(parallel,1/60);
  incidentPoliceCars.length=0;trafficCars.length=0;
  Object.assign(unit,{x:1350,y:1200,angle:0});incidentPoliceCars.push(unit);
  const car={x:1500,y:1200,angle:0,width:46,height:24};trafficCars.push(car);
  for(let t=0;t<150;t++)yieldTrafficToServices(car,1/60);
  const movedAside=car.y<1170&&policeFootprintOnRoad(car);unit.x=1650;
  for(let t=0;t<150;t++)yieldTrafficToServices(car,1/60);
  const rejoined=Math.abs(car.y-1200)<.5&&!car.yieldHome;
  incidentPoliceCars.length=0;trafficCars.length=0;
  Object.assign(unit,{x:2030,y:1200,angle:.21,rotationBlocked:true});incidentPoliceCars.push(unit);
  const bus={x:2008,y:1244.76,angle:-.39,width:82,height:30,routeManaged:true,yieldHome:{cross:'y',value:1200}};trafficCars.push(bus);
  let contacts=0;
  for(let tick=0;tick<150;tick++){yieldTrafficToServices(bus,1/60);contacts+=!!contact(chassis(bus),chassis(unit));}
  const stableBusYield=bus.y>1240&&bus.angle>-.28&&bus.yieldHome.side===1&&contacts===0;
  JSON.stringify({clearsIntersection,clearsJunctionWhileYielding,movedAside,rejoined,stableBusYield,bus:{x:bus.x,y:bus.y,angle:bus.angle,side:bus.yieldHome?.side,contacts}});
}`));
assert(yielding.clearsIntersection&&yielding.clearsJunctionWhileYielding&&yielding.movedAside&&yielding.rejoined&&yielding.stableBusYield,JSON.stringify(yielding));

const turns=runtimeCity(19);
assert(turns.run(`{
  trafficCars.length=0;parkedCars.length=0;pedestrians.length=0;policeCars.length=0;
  incidentPoliceCars.length=0;incidentResponseVehicles.length=0;emergencyPassingGroundClear=()=>true;
  const engine={x:200,y:100,angle:3.3456774,width:72,height:34};
  const ambulance={x:201,y:146,angle:-1.5529,width:54,height:27};
  incidentResponseVehicles.push(engine,ambulance);
  !!contact(chassis(engine),chassis(ambulance))&&!emergencyPassingPoseClear(ambulance,ambulance);
}`),'clearance checks must include the rotated length of both vehicles');

const returnTurn=JSON.parse(turns.run(`{
  incidentResponseVehicles.length=0;
  const unit={x:1700,y:1200,angle:2.6166,width:72,height:34,maxSpeed:4.35,speed:0,
    model:'fireEngine',status:'returning',route:[{x:2350,y:1200}],responseTarget:{x:2350,y:1200}};
  incidentResponseVehicles.push(unit);
  trafficCars.push({x:1606,y:1200,angle:Math.PI,width:82,height:30},
    {x:1700,y:1151,angle:Math.PI,width:82,height:30});
  let reversed=false,contacts=0;
  for(let tick=0;tick<1200;tick++){
    tryPlanEmergencyPassing(unit,1/60);advanceServiceRoute(unit,1/60);reversed||=unit.speed<0;
    contacts+=trafficCars.filter(car=>contact(chassis(unit),chassis(car))).length;
  }
  JSON.stringify({reversed,contacts,x:unit.x,y:unit.y,angle:unit.angle,speed:unit.speed,route:unit.route,points:unit.emergencyManeuver?.points,rotationBlocked:unit.rotationBlocked,completed:!unit.emergencyManeuver});
}`));
assert(returnTurn.reversed&&returnTurn.completed&&returnTurn.x>2300,JSON.stringify(returnTurn));
assert.equal(returnTurn.contacts,0,'a blocked return turn must make space before rotating');

// Replay the browser deadlock: a tilted yielding bus between two responders.
const junction=runtimeCity(73);
const junctionYield=JSON.parse(junction.run(`{
 trafficCars.length=0;parkedCars.length=0;pedestrians.length=0;policeCars.length=0;incidentPoliceCars.length=0;incidentResponseVehicles.length=0;cityIncidentDirector=null;
 Object.assign(player,{x:17000,y:17000,speed:0});state.invulnTimer=999999;
 const home=serviceBases.find(b=>b.building.sign==='EASTGATE FIRE & RESCUE').origin;
 const cop={x:8953.387181,y:1200,angle:0,width:72,height:34,maxSpeed:4.7,speed:0,model:'fireEngine',status:'returning',responseTarget:home,baseTarget:home,rotationBlocked:false};
 cop.route=[{x:8975,y:1200},...roadPath(roadGraph,{x:8975,y:1200},home).slice(1)];incidentResponseVehicles.push(cop);
 const target={x:8975,y:1200},ambHome=serviceBases.find(b=>b.building.sign==='NORTHSIDE CLINIC').origin;
 const amb={x:9036.179455,y:1197.517612,angle:-3.182145922,width:54,height:27,maxSpeed:5.9,speed:0,model:'ambulance',status:'enroute',sceneTimer:1,responseTarget:target,baseTarget:ambHome,route:[target]};incidentResponseVehicles.push(amb);
 const bus={x:8976.445335,y:1238.783562,angle:-.4,width:82,height:30,speed:0,cruiseSpeed:1.12,routeManaged:true,type:'bus',axis:'x',routeIndex:1,routeWait:0,lastStopIndex:-1,route:{points:[{x:8787,y:1200},{x:10000,y:1200}],loop:false,stopIndices:[]},yieldHome:{cross:'y',value:1200}};
 trafficCars.push({x:9024.925185,y:1158.2,angle:0,width:46,height:22,type:'sedan',axis:'x',speed:0,cruiseSpeed:1.2,minX:450,maxX:10800,yieldHome:{cross:'y',value:1168,side:-1}},{x:9092.879823,y:1147.5,angle:0,width:48,height:23,type:'sports',axis:'x',speed:0,cruiseSpeed:1.2,minX:450,maxX:10800,yieldHome:{cross:'y',value:1168,side:-1}},bus,{x:8847.299667,y:1147.5,angle:0,width:48,height:23,type:'sports',axis:'x',speed:0,cruiseSpeed:1.2,minX:450,maxX:10800,yieldHome:{cross:'y',value:1168,side:-1}});
 let arrived=false,contacts=0,unsafe=0,reversed=false;
 const resolve=resolveContact;resolveContact=(a,b,f)=>{if((a===amb||a===cop||b===amb||b===cop)&&contact(chassis(a),chassis(b)))contacts++;return resolve(a,b,f);};
 for(let tick=0;tick<1800;tick++){updatePhysics(1/60);arrived||=amb.status==='onscene';reversed||=cop.speed<0||amb.speed<0;unsafe+=!emergencyPassingGroundClear(amb)||!emergencyPassingGroundClear(cop);}
 JSON.stringify({arrived,contacts,unsafe,reversed,police:{x:cop.x,y:cop.y,status:cop.status},ambulance:{x:amb.x,y:amb.y,status:amb.status,goal:amb.route?.[0],passing:amb.emergencyManeuver?.points},bus:{x:bus.x,y:bus.y,angle:bus.angle,side:bus.yieldHome?.side}});
}`));
assert(junctionYield.arrived&&junctionYield.reversed,JSON.stringify(junctionYield));
assert.equal(junctionYield.contacts,0);assert.equal(junctionYield.unsafe,0);

// Preserve normal traffic and pedestrians: the previous isolated route matrix
// could pass even while all responders got stuck in a populated city.
const city=runtimeCity(73);
city.run(`Object.assign(player,{x:10000,y:11000,speed:0});state.invulnTimer=999999;
  this.incident=cityIncidentDirector.start('fire',safeSpawnPoints[5],{duration:600});incident.reported=true;
  this.units=new Set();this.contacts=0;this.contactSamples=[];this.unsafe=0;this.maxStep=0;
  const original=resolveContact;
  resolveContact=(a,b,fixed)=>{if((units.has(a)||units.has(b))&&contact(chassis(a),chassis(b))){
    contacts++;if(contactSamples.length<20)contactSamples.push({a:{model:a.model,type:a.type,x:a.x,y:a.y,angle:a.angle},b:{model:b.model,type:b.type,x:b.x,y:b.y,angle:b.angle}});
  }return original(a,b,fixed);};`);
let ticks=0;
for(;ticks<5400;ticks++){
  city.tick(1/30);
  city.run(`{
    const before=new Map([...units].map(u=>[u,{x:u.x,y:u.y}]));updatePhysics(1/30);
    for(const u of [...incidentPoliceCars,...incidentResponseVehicles]){
      units.add(u);if(!emergencyPassingGroundClear(u))unsafe++;
      const p=before.get(u);if(p)maxStep=Math.max(maxStep,Math.hypot(p.x-u.x,p.y-u.y));
    }
  }`);
  if(ticks%300===0)writeFileSync('artifacts/movement/populated-progress.json',city.run(`JSON.stringify({seconds:${ticks}/30,units:[...units].map(u=>({model:u.model,status:u.status,x:u.x,y:u.y,returned:!!u.returnedToBase,blocked:!!u.emergencyBlocked,rotationBlocked:!!u.rotationBlocked,goal:u.route?.[0],points:u.emergencyManeuver?.points,neighbors:emergencyPassingActors(u).filter(a=>Math.hypot(a.x-u.x,a.y-u.y)<160).map(a=>({model:a.model,type:a.type,x:a.x,y:a.y,angle:a.angle,width:a.width,height:a.height}))}))})`));
  if(city.run('units.size===3&&[...units].every(u=>u.returnedToBase)'))break;
}
const services=JSON.parse(city.run(`JSON.stringify({units:units.size,contacts,unsafe,maxStep,
  contactSamples,
  fire:!!incident.fireSuppressed,medical:!!incident.medicalTreated,
  returned:[...units].map(u=>({model:u.model,returned:!!u.returnedToBase,status:u.status,
    x:u.x,y:u.y,angle:u.angle,goal:u.route?.[0],blocked:!!u.emergencyBlocked})),traffic:trafficCars.length,people:pedestrians.length})`));
writeFileSync('artifacts/movement/service-contact-report.json',JSON.stringify(services,null,2));
assert.equal(services.units,3);assert(services.fire&&services.medical,JSON.stringify(services));
assert(services.returned.every(u=>u.returned),JSON.stringify(services));assert.equal(services.unsafe,0);
assert.equal(services.contacts,0,'response vehicles must not collide with traffic while giving way');
assert(services.maxStep<12.1,JSON.stringify(services));assert.equal(services.people,152);assert.equal(services.traffic,65);
const report={people,police,yielding,returnTurn,junctionYield,services:{...services,seconds:ticks/30}};
writeFileSync('artifacts/movement/regression-report.json',JSON.stringify(report,null,2));
console.log('MOVEMENT STABILITY PASS',JSON.stringify(report));
