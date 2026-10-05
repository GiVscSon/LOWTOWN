import assert from 'node:assert/strict';
import {runtimeCity} from './helpers/runtime-city.mjs';
import {mkdirSync,writeFileSync} from 'node:fs';
const city=runtimeCity(73),run=city.run;
const audit=JSON.parse(run(`JSON.stringify({
  shore:shorelineDetails.filter(p=>Array.from({length:16},(_,i)=>[Math.cos(i*Math.PI/8)*36,Math.sin(i*Math.PI/8)*36]).some(([dx,dy])=>onRoadSurface(p.x+dx,p.y+dy,roads,bridges,scenicRoads,roadEnds))).length,
  ends:roadEnds.length,badOrientation:roadEnds.filter(e=>!Number.isFinite(e.angle)).length,
  badEnds:roadEnds.filter(e=>roads.some(r=>r.id!==e.roadId&&corridorContains(e.x,e.y,r,-3))).length,
  shelters:streetProps.filter(p=>p.type==='shelter').map(p=>({linked:!!p.busStop,distance:p.busStop?Math.hypot(p.x-p.busStop.x,p.y-p.busStop.y):999})),
  stations:serviceBases.filter(b=>b.kind==='police').map(b=>({x:b.building.x,y:b.building.y,sign:b.building.sign}))
})`));
assert.equal(audit.shore,0,'visible shoreline props must clear the complete road and bridge footprint');
assert(audit.ends>0);assert.equal(audit.badOrientation,0);assert.equal(audit.badEnds,0,'road ends must not be painted inside junctions');
assert(audit.shelters.length>0&&audit.shelters.every(p=>p.linked&&p.distance<=140),'shelters need actual nearby bus stops');
const releases=[];
run(`roam=createFreeRoam(player,parkedCars,buildings,trees,isPositionOnSolidGround,()=>{},solidProps,isPositionOnWaterObstacle,()=>[],{mapPoint:worldPoint,runways:PLANE_RUNWAYS,streets:roads});
localStorage.setItem=(key,value)=>this.savedProgress=value;localStorage.getItem=()=>this.savedProgress||null;`);
for(const station of audit.stations){
  run(`state.cash=750;Object.assign(player,{x:${station.x},y:${station.y}});respawnPlayer('задержание');`);
  const release=JSON.parse(run(`JSON.stringify({x:player.x,y:player.y,mode:roam.mode,sign:state.custodyStation,cash:state.cash,clear:!isPedestrianBlocked(player.x,player.y),offStreet:!onRoadSurface(player.x,player.y,roads,bridges,scenicRoads,roadEnds)})`));
  assert.equal(release.mode,'foot');assert.equal(release.sign,station.sign);assert.equal(release.cash,650);
  assert(release.clear&&release.offStreet,JSON.stringify(release));
  run(`state.keys.up=true;for(let i=0;i<120;i++)updatePhysics(1/60);`);
  assert.equal(run('player.x'),release.x,'controls must be locked during delivery');assert.equal(run('player.y'),release.y);
  run('for(let i=0;i<15;i++)updatePhysics(1/60);state.keys.up=true;for(let i=0;i<30;i++)updatePhysics(1/60);state.keys.up=false;');
  assert(Math.hypot(run('player.x')-release.x,run('player.y')-release.y)>10,'released player must be able to walk away');
  releases.push(release);
}
run(`state.cash=0;autoSaveProgress();roam.resetToSedan(1200,1200);state.cash=750;loadProgress();`);
assert.equal(run('roam.mode'),'foot','reloading a release must preserve walking mode');assert.equal(run('state.cash'),0,'reloading must not refund a fine to a player without money');
const staging=JSON.parse(run(`{
  incidentPoliceCars.length=0;incidentResponseVehicles.length=0;trafficCars.length=0;parkedCars.length=0;
  const site=incidentLocation('fire',worldPoint({x:3850,y:1200}));
  const incident=cityIncidentDirector.start('fire',site,{duration:.5});incident.reported=true;
  dispatchIncidentPolice(incident);dispatchIncidentResponse(incident);
  const targets=[...incidentPoliceCars,...incidentResponseVehicles].map(u=>u.responseTarget);
  incident.responsePending=true;for(let i=0;i<10;i++)cityIncidentDirector.update(.25,{player,people:pedestrians});
  JSON.stringify({site,targets,pending:cityIncidentDirector.current()?.id===incident.id,
    clearance:targets.every((a,i)=>targets.every((b,j)=>i===j||Math.hypot(a.x-b.x,a.y-b.y)>=115)),
    offFire:targets.every(a=>Math.hypot(a.x-site.x,a.y-site.y)>=100)});
}`));
assert.equal(staging.site.site,'building');assert(staging.site.buildingSign);
assert.equal(staging.targets.length,3);assert(staging.pending&&staging.clearance&&staging.offFire,'responders must reserve separate parking and retain a scene while responding');
const policeReturn=JSON.parse(run(`{
  cityIncidentDirector.finish();incidentPoliceCars.length=0;incidentResponseVehicles.length=0;
  state.wanted=1;state.invulnTimer=999;updatePoliceAI(1/60);const units=[...policeCars];
  state.wanted=0;updatePoliceAI(1/60);const dispatched=incidentPoliceCars.length;
  for(let i=0;i<6000&&incidentPoliceCars.length;i++)updatePhysics(1/60);
  JSON.stringify({units:units.length,dispatched,returned:units.every(u=>u.returnedToBase),remaining:incidentPoliceCars.length});
}`));
assert(policeReturn.units>0&&policeReturn.dispatched===policeReturn.units&&policeReturn.returned&&policeReturn.remaining===0,'ending pursuit must route police back to their station: '+JSON.stringify(policeReturn));
// The following recorded deadlocks use their original straight geometry.
const replay=runtimeCity(73,{legacyStreets:true}).run;
const junction=JSON.parse(replay(`{
  trafficCars.length=0;parkedCars.length=0;pedestrians.length=0;incidentPoliceCars.length=0;incidentResponseVehicles.length=0;
  roam=undefined;Object.assign(player,{x:1200,y:5000,speed:0});
  const police={x:8891.188,y:1224.044,angle:-.279374,width:48,height:24,model:'police',maxSpeed:5.6,status:'enroute',speed:0,
    responseTarget:{x:8975,y:1460},baseTarget:{x:9200,y:1200},arrivalTimer:8};
  const engine={x:8948.280,y:1200,angle:2.72159,width:72,height:34,model:'fireEngine',maxSpeed:4.35,status:'enroute',speed:0,
    responseTarget:{x:8975,y:1620},baseTarget:{x:9400,y:1200}};
  const ambulance={x:9014.480,y:1193.006,angle:-3.316928,width:54,height:27,model:'ambulance',maxSpeed:5.9,status:'enroute',speed:0,
    responseTarget:{x:8975,y:1800},baseTarget:{x:9600,y:1200}};
  incidentPoliceCars.push(police);incidentResponseVehicles.push(engine,ambulance);
  const units=[police,engine,ambulance];units.forEach(u=>{u.route=serviceRoadPath(u,u.responseTarget).slice(1);});
  let contacts=0,unsafe=0;const arrived=new Set();
  for(let i=0;i<7200&&arrived.size<3;i++){
    updateIncidentPolice(1/60);updateIncidentResponse(1/60);
    for(const u of units){if(u.status==='onscene'||u.status==='returning')arrived.add(u.model);if(!emergencyPassingGroundClear(u))unsafe++;}
    for(let a=0;a<units.length;a++)for(let b=a+1;b<units.length;b++)if(contact(chassis(units[a]),chassis(units[b])))contacts++;
  }
  JSON.stringify({arrived:[...arrived],contacts,unsafe,units:units.map(u=>({model:u.model,x:u.x,y:u.y,status:u.status,yielding:!!u.cooperativeYield,blocked:u.rotationBlocked}))});
}`));
assert.equal(junction.contacts,0,JSON.stringify(junction));assert.equal(junction.unsafe,0,JSON.stringify(junction));assert.equal(junction.arrived.length,3,JSON.stringify(junction));
const returningCorner=JSON.parse(replay(`{
  trafficCars.length=0;parkedCars.length=0;pedestrians.length=0;incidentPoliceCars.length=0;incidentResponseVehicles.length=0;
  const van={x:8955.9606,y:1167.3,angle:0,width:53,height:25,type:'van'};trafficCars.push(van);
  const unit={x:8975.25,y:1204.2708,angle:-1.629264,width:48,height:24,model:'police',maxSpeed:5.6,status:'returning',speed:0,
    responseTarget:{x:8800,y:1200},baseTarget:{x:8800,y:1200}};
  unit.route=serviceRoadPath(unit,unit.responseTarget).slice(1);incidentPoliceCars.push(unit);
  let contacts=0,unsafe=0;
  for(let i=0;i<1800&&incidentPoliceCars.length;i++){
    updateIncidentPolice(1/60);contacts+=!!contact(chassis(unit),chassis(van));unsafe+=!emergencyPassingGroundClear(unit);
  }
  JSON.stringify({returned:!!unit.returnedToBase,contacts,unsafe,x:unit.x,y:unit.y,angle:unit.angle,goal:unit.route?.[0]});
}`));
assert(returningCorner.returned&&returningCorner.contacts===0&&returningCorner.unsafe===0,JSON.stringify(returningCorner));
const convoy=JSON.parse(replay(`{
  trafficCars.length=0;parkedCars.length=0;pedestrians.length=0;incidentPoliceCars.length=0;incidentResponseVehicles.length=0;
  roam=undefined;Object.assign(player,{x:1200,y:5000,speed:0});
  const engine={x:13061.9203,y:1199.9969,angle:3.1414715,width:72,height:34,mass:8400,model:'fireEngine',maxSpeed:4.35,status:'enroute',speed:0,
    responseTarget:{x:12000,y:1200},baseTarget:{x:14046,y:1200},emergencyMotionStall:2};
  const ambulance={x:13009.9236,y:1174.6699,angle:-3.5097772,width:54,height:27,mass:3300,model:'ambulance',maxSpeed:5.9,status:'enroute',speed:0,
    responseTarget:{x:11800,y:1200},baseTarget:{x:14046,y:1200},emergencyMotionStall:2,cooperativeYield:engine};
  engine.route=serviceRoadPath(engine,engine.responseTarget).slice(1);ambulance.route=serviceRoadPath(ambulance,ambulance.responseTarget).slice(1);
  incidentResponseVehicles.push(engine,ambulance);let contacts=0,unsafe=0,clearedForward=false;
  for(let i=0;i<2400&&(!engine.returnedToBase||!ambulance.returnedToBase);i++){
    updateIncidentResponse(1/60);clearedForward ||= ambulance.emergencyManeuver?.reason==='CLEAR_TURN'&&ambulance.emergencyManeuver.points[0].x<ambulance.x;
    if(incidentResponseVehicles.includes(engine)&&incidentResponseVehicles.includes(ambulance))contacts+=!!contact(chassis(engine),chassis(ambulance));
    unsafe+=incidentResponseVehicles.some(u=>!emergencyPassingGroundClear(u));
  }
  JSON.stringify({clearedForward,contacts,unsafe,engine:engine.x,ambulance:ambulance.x,returned:[!!engine.returnedToBase,!!ambulance.returnedToBase]});
}`));
assert(convoy.clearedForward&&convoy.contacts===0&&convoy.unsafe===0&&convoy.returned.every(Boolean),JSON.stringify(convoy));
const curbYield=JSON.parse(replay(`{
trafficCars.length=0;parkedCars.length=0;pedestrians.length=0;incidentPoliceCars.length=0;incidentResponseVehicles.length=0;roam=undefined;Object.assign(player,{x:1200,y:5000,speed:0});
const police={x:8998.148993593644,y:1596.6018577280065,angle:1.035275934511709,width:48,height:24,model:'police',maxSpeed:5.6,status:'returning',speed:0,responseTarget:{x:8975,y:1200},baseTarget:{x:8975,y:1200},emergencyMotionStall:2,rotationBlocked:true};
const engine={x:8971.770268142885,y:1614.2663236914764,angle:1.0860070859292457,width:72,height:34,model:'fireEngine',maxSpeed:4.35,status:'enroute',speed:0,responseTarget:{x:8999,y:1720.3981818181817,parkingAxis:'v'},baseTarget:{x:9200,y:1200},emergencyMotionStall:2,rotationBlocked:true};
police.cooperativeYield=engine;police.route=serviceRoadPath(police,police.responseTarget).slice(1);engine.route=[engine.responseTarget];incidentPoliceCars.push(police);incidentResponseVehicles.push(engine);
let contacts=0,unsafe=0;for(let i=0;i<7200&&(incidentPoliceCars.length||incidentResponseVehicles.length);i++){
updateIncidentPolice(1/60);updateIncidentResponse(1/60);
if(incidentPoliceCars.includes(police)&&incidentResponseVehicles.includes(engine))contacts+=!!contact(chassis(police),chassis(engine));
unsafe+=[...incidentPoliceCars,...incidentResponseVehicles].some(u=>!emergencyPassingGroundClear(u));
}JSON.stringify({returned:[!!police.returnedToBase,!!engine.returnedToBase],contacts,unsafe});
}`));
assert(curbYield.returned.every(Boolean)&&curbYield.contacts===0&&curbYield.unsafe===0,JSON.stringify(curbYield));
const returnClear=JSON.parse(replay(`{
trafficCars.length=0;parkedCars.length=0;pedestrians.length=0;incidentPoliceCars.length=0;incidentResponseVehicles.length=0;roam=undefined;Object.assign(player,{x:1200,y:5000,speed:0});
const engine={x:8978.513740756676,y:1425.8436384104716,angle:1.5888548040380424,width:72,height:34,model:'fireEngine',maxSpeed:4.35,status:'enroute',speed:0,responseTarget:{x:8999,y:1620.398181818182,parkingAxis:'v'},baseTarget:{x:14046,y:1200},emergencyMotionStall:2,rotationBlocked:true};
const ambulance={x:8941.728586070956,y:1475.341217558623,angle:-6.283185307179587,width:54,height:27,model:'ambulance',maxSpeed:5.9,status:'returning',speed:0,responseTarget:{x:14046,y:1200},baseTarget:{x:14046,y:1200},emergencyMotionStall:2,rotationBlocked:true,cooperativeYield:engine};
engine.route=serviceRoadPath(engine,engine.responseTarget).slice(1);ambulance.route=serviceRoadPath(ambulance,ambulance.responseTarget).slice(1);incidentResponseVehicles.push(engine,ambulance);let contacts=0,unsafe=0,clear=false;
for(let i=0;i<7200&&incidentResponseVehicles.length;i++){updateIncidentResponse(1/60);clear ||= ambulance.emergencyManeuver?.reason==='RESPONDER_RETURN_CLEAR';if(incidentResponseVehicles.length===2)contacts+=!!contact(chassis(engine),chassis(ambulance));unsafe+=incidentResponseVehicles.some(u=>!emergencyPassingGroundClear(u));}
JSON.stringify({clear,contacts,unsafe,returned:[!!engine.returnedToBase,!!ambulance.returnedToBase]});
}`));
assert(returnClear.clear&&returnClear.contacts===0&&returnClear.unsafe===0&&returnClear.returned.every(Boolean),JSON.stringify(returnClear));
const roadRecovery=JSON.parse(replay(`{
 trafficCars.length=0;parkedCars.length=0;pedestrians.length=0;incidentPoliceCars.length=0;incidentResponseVehicles.length=0;
 roam=undefined;Object.assign(player,{x:1200,y:5000,speed:0});
 const unit={x:13815.282992456945,y:1156.1752346433693,angle:-3.8118102892186085,width:54,height:27,model:'ambulance',maxSpeed:5.9,status:'returning',speed:0,
   responseTarget:{x:14046,y:1200},baseTarget:{x:14046,y:1200}};
 unit.route=serviceRoadPath(unit,unit.responseTarget).slice(1);incidentResponseVehicles.push(unit);
 const started=recoverServiceRoad(unit);let unsafe=0;
 for(let i=0;i<1800&&incidentResponseVehicles.length;i++){updateIncidentResponse(1/60);unsafe+=incidentResponseVehicles.some(u=>!serviceFootprintSupported(u)||!emergencyPassingGroundClear(u));}
 JSON.stringify({started,unsafe,returned:!!unit.returnedToBase});
}`));
assert(roadRecovery.started&&roadRecovery.unsafe===0&&roadRecovery.returned,JSON.stringify(roadRecovery));
const shoulderYield=JSON.parse(replay(`{
trafficCars.length=0;parkedCars.length=0;pedestrians.length=0;incidentPoliceCars.length=0;incidentResponseVehicles.length=0;roam=undefined;Object.assign(player,{x:1200,y:5000,speed:0});
const unit={x:8815.449758083221,y:1200.8959252346153,angle:-3.110019146852433,width:48,height:24,model:'police',maxSpeed:5.6,status:'returning',speed:0,responseTarget:{x:8600,y:1200},baseTarget:{x:8600,y:1200}};
const black={x:8844.277063355483,y:1147,angle:-Math.PI,width:46,height:22,type:'black',routeManaged:true,yieldHome:{cross:'y',value:1170,side:-1}};
const truck={x:8923.578671187559,y:1172.62523796628,angle:-3.140062865962657,width:60,height:26,type:'truck',routeManaged:true,yieldHome:{cross:'y',value:1170,side:-1}};
const bus={x:8808.736134035427,y:1173.1442590698446,angle:0,width:82,height:30,type:'bus',routeManaged:true,yieldHome:{cross:'y',value:1200,side:-1}};
trafficCars.push(black,truck,bus);incidentPoliceCars.push(unit);unit.route=serviceRoadPath(unit,unit.responseTarget).slice(1);let contacts=0,unsafe=0,moved=false;
for(let i=0;i<2400&&incidentPoliceCars.length;i++){for(const c of trafficCars)yieldTrafficToServices(c,1/60);moved ||= Math.abs(bus.x-8808.736134035427)>8;updateIncidentPolice(1/60);unsafe+=!serviceFootprintSupported(unit);contacts+=trafficCars.some(c=>!!contact(chassis(c),chassis(unit)));}
JSON.stringify({returned:!!unit.returnedToBase,moved,contacts,unsafe});
}`));
assert(shoulderYield.returned&&shoulderYield.moved&&shoulderYield.contacts===0&&shoulderYield.unsafe===0,JSON.stringify(shoulderYield));
const turningTraffic=JSON.parse(replay(`{
trafficCars.length=0;parkedCars.length=0;pedestrians.length=0;incidentPoliceCars.length=0;incidentResponseVehicles.length=0;roam=undefined;Object.assign(player,{x:1200,y:5000,speed:0});
const unit={x:9926.244081368397,y:1246.244282947288,angle:-.20671139606728367,width:54,height:27,model:'ambulance',maxSpeed:5.9,status:'returning',speed:0,rotationBlocked:true,responseTarget:{x:11000,y:1200},baseTarget:{x:11000,y:1200}};
const wagon={x:9964.40883469971,y:1215.9232480505543,angle:Math.PI/2,width:50,height:23,type:'wagon',routeManaged:true};
const second={x:9970.002662692707,y:1141.3840959189806,angle:Math.PI/2,width:50,height:23,type:'wagon',routeManaged:true};
trafficCars.push(wagon,second);incidentResponseVehicles.push(unit);unit.route=serviceRoadPath(unit,unit.responseTarget).slice(1);let contacts=0,unsafe=0,moved=false;
for(let i=0;i<3600&&incidentResponseVehicles.length;i++){for(const c of trafficCars)yieldTrafficToServices(c,1/60);moved ||= Math.hypot(wagon.x-9964.40883469971,wagon.y-1215.9232480505543)>8;updateIncidentResponse(1/60);unsafe+=!serviceFootprintSupported(unit);contacts+=trafficCars.some(c=>!!contact(chassis(c),chassis(unit)));}
JSON.stringify({returned:!!unit.returnedToBase,moved,contacts,unsafe,unit,wagon,second});
}`));
assert(turningTraffic.returned&&turningTraffic.moved&&turningTraffic.contacts===0&&turningTraffic.unsafe===0,JSON.stringify(turningTraffic));
const driving=[];
for(const fps of [30,60,120]){
  const c=runtimeCity(19);
  const result=JSON.parse(c.run(`{
    roads.length=0;roads.push({x:0,y:0,w:12000,h:6000,dir:'h'});bridges.length=0;roadEnds.length=0;scenicRoads.length=0;
    buildings.length=0;trees.length=0;solidProps.length=0;breakableProps.length=0;bridgeRails.length=0;
    trafficCars.length=0;parkedCars.length=0;pedestrians.length=0;cityIncidentDirector.state.cooldown=999;
    isPositionOnSolidGround=()=>true;isPositionOnIslandLand=()=>true;
    Object.assign(player,{x:1000,y:1000,angle:0,speed:0,vx:0,vy:0,steeringAngle:0});
    state.keys.up=true;let time60=null;
    for(let i=0;i<${fps*8};i++){updatePhysics(1/${fps});if(time60===null&&player.speed>=5)time60=(i+1)/${fps};}
    const straight={x:player.x,y:player.y,speed:player.speed};
    state.keys.up=false;state.keys.down=true;let brakeTime=null;
    for(let i=0;i<${fps*6};i++){updatePhysics(1/${fps});if(brakeTime===null&&player.speed===0)brakeTime=(i+1)/${fps};}
    const reverse=player.speed;
    state.keys.down=false;state.keys.up=true;state.keys.right=true;
    const startAngle=player.angle;for(let i=0;i<${fps/2};i++)updatePhysics(1/${fps});
    const turn=player.angle-startAngle;state.keys.right=false;for(let i=0;i<${fps/2};i++)updatePhysics(1/${fps});
    JSON.stringify({fps:${fps},time60,brakeTime,reverse,straight,turn,centered:Math.abs(player.steeringAngle)<.001});
  }`));
  assert(result.time60>=4&&result.time60<=7,JSON.stringify(result));
  // Tyre-limited braking must obey the friction bound, then settle and reverse.
  assert(result.brakeTime>=result.straight.speed*6/9.81-1/fps&&result.brakeTime<4.5,JSON.stringify(result));
  assert(result.reverse<0&&result.reverse>=-1.8,'reverse must stay manoeuvrable');
  assert(result.centered&&Math.abs(result.turn)<.3,'steering must return to center without an abrupt yaw');driving.push(result);
}
assert(Math.max(...driving.map(d=>d.straight.x))-Math.min(...driving.map(d=>d.straight.x))<.1,'live controller displacement must be stable at 30/60/120 Hz');
assert(Math.max(...driving.map(d=>d.time60))-Math.min(...driving.map(d=>d.time60))<.04);
mkdirSync('artifacts/mobile-fixes',{recursive:true});writeFileSync('artifacts/mobile-fixes/acceptance.json',JSON.stringify({audit,releases,staging,policeReturn,junction,returningCorner,driving},null,2));
console.log('PASS: unobstructed road visuals, actual bus shelters, station delivery and walking release, saved walking mode, controlled live acceleration/braking/steering at 30/60/120 Hz',JSON.stringify(driving));
