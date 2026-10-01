import assert from 'node:assert/strict';
import {runtimeCity} from './helpers/runtime-city.mjs';
import {mkdirSync,writeFileSync} from 'node:fs';
const city=runtimeCity(73),run=city.run;
const audit=JSON.parse(run(`JSON.stringify({
  shore:shorelineDetails.filter(p=>Array.from({length:16},(_,i)=>[Math.cos(i*Math.PI/8)*36,Math.sin(i*Math.PI/8)*36]).some(([dx,dy])=>onRoadSurface(p.x+dx,p.y+dy,roads,bridges,scenicRoads,roadEnds))).length,
  ends:roadEnds.length,circular:roadEnds.filter(e=>!e.flat).length,
  badEnds:roadEnds.filter(e=>roads.some(r=>r.dir!==e.dir&&e.x>r.x+3&&e.x<r.x+r.w-3&&e.y>r.y+3&&e.y<r.y+r.h-3)).length,
  shelters:streetProps.filter(p=>p.type==='shelter').map(p=>({linked:!!p.busStop,distance:p.busStop?Math.hypot(p.x-p.busStop.x,p.y-p.busStop.y):999})),
  stations:serviceBases.filter(b=>b.kind==='police').map(b=>({x:b.building.x,y:b.building.y,sign:b.building.sign}))
})`));
assert.equal(audit.shore,0,'visible shoreline props must clear the complete road and bridge footprint');
assert(audit.ends>0);assert.equal(audit.circular,0);assert.equal(audit.badEnds,0,'road ends must not be painted inside junctions');
assert(audit.shelters.length>0&&audit.shelters.every(p=>p.linked&&p.distance<=140),'shelters need actual nearby bus stops');
const releases=[];
run(`roam=createFreeRoam(player,parkedCars,buildings,trees,isPositionOnSolidGround,()=>{},solidProps,isPositionOnWaterObstacle);
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
  for(let i=0;i<6000&&incidentPoliceCars.length;i++)updateIncidentPolice(1/60);
  JSON.stringify({units:units.length,dispatched,returned:units.every(u=>u.returnedToBase),remaining:incidentPoliceCars.length});
}`));
assert(policeReturn.units>0&&policeReturn.dispatched===policeReturn.units&&policeReturn.returned&&policeReturn.remaining===0,'ending pursuit must route police back to their station');
const junction=JSON.parse(run(`{
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
const returningCorner=JSON.parse(run(`{
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
    for(let i=0;i<${fps*3};i++){updatePhysics(1/${fps});if(brakeTime===null&&player.speed===0)brakeTime=(i+1)/${fps};}
    const reverse=player.speed;
    state.keys.down=false;state.keys.up=true;state.keys.right=true;
    const startAngle=player.angle;for(let i=0;i<${fps/2};i++)updatePhysics(1/${fps});
    const turn=player.angle-startAngle;state.keys.right=false;for(let i=0;i<${fps/2};i++)updatePhysics(1/${fps});
    JSON.stringify({fps:${fps},time60,brakeTime,reverse,straight,turn,centered:Math.abs(player.steeringAngle)<.001});
  }`));
  assert(result.time60>=4&&result.time60<=7,JSON.stringify(result));
  assert(result.brakeTime>0&&result.brakeTime<1.6,JSON.stringify(result));
  assert(result.reverse<0&&result.reverse>=-1.8,'reverse must stay manoeuvrable');
  assert(result.centered&&result.turn<.2,'steering must return to center without an abrupt yaw');driving.push(result);
}
assert(Math.max(...driving.map(d=>d.straight.x))-Math.min(...driving.map(d=>d.straight.x))<.1,'live controller displacement must be stable at 30/60/120 Hz');
assert(Math.max(...driving.map(d=>d.time60))-Math.min(...driving.map(d=>d.time60))<.04);
mkdirSync('artifacts/mobile-fixes',{recursive:true});writeFileSync('artifacts/mobile-fixes/acceptance.json',JSON.stringify({audit,releases,staging,policeReturn,junction,returningCorner,driving},null,2));
console.log('PASS: unobstructed road visuals, actual bus shelters, station delivery and walking release, saved walking mode, controlled live acceleration/braking/steering at 30/60/120 Hz',JSON.stringify(driving));
