import assert from 'node:assert/strict';
import {mkdirSync,writeFileSync} from 'node:fs';
import {runtimeCity} from './helpers/runtime-city.mjs';

const city=runtimeCity(73);
city.run(`trafficCars.length=0;parkedCars.length=0;pedestrians.length=0;policeCars.length=0;
incidentPoliceCars.length=0;incidentResponseVehicles.length=0;Object.assign(player,{x:10000,y:11000});`);
const results=[];
for(const [model,width,height,maxSpeed] of [['police',48,24,5.6],['ambulance',54,27,5.9],['fireEngine',72,34,4.35]]){
 for(const moving of [false,true]){
  const result=JSON.parse(city.run(`
    trafficCars.length=0;incidentPoliceCars.length=0;incidentResponseVehicles.length=0;
    var unit={x:1350,y:1200,angle:0,width:${width},height:${height},maxSpeed:${maxSpeed},speed:0,
      model:'${model}',status:'enroute',route:[{x:2065,y:1200}],responseTarget:{x:2065,y:1200},baseTarget:{x:1350,y:1200}};
    incidentResponseVehicles.push(unit);
    var blocker={x:1640,y:1200,angle:0,width:48,height:24,speed:${moving?.3:0}};trafficCars.push(blocker);
    var collisions=0,unsafe=0,lateral=0,maxStep=0;
    for(var tick=0;tick<1200;tick++){
      if(trafficCars.includes(blocker))blocker.x+=blocker.speed;
      var before={x:unit.x,y:unit.y};tryPlanEmergencyPassing(unit,1/60);advanceServiceRoute(unit,1/60);
      collisions+=trafficCars.includes(blocker)&&!!contact(chassis(unit),chassis(blocker));unsafe+=!emergencyPassingGroundClear(unit);
      lateral=Math.max(lateral,Math.abs(unit.y-1200));maxStep=Math.max(maxStep,Math.hypot(unit.x-before.x,unit.y-before.y));
      if(unit.x>blocker.x+(unit.width+blocker.width)/2+15&&trafficCars.length)trafficCars.length=0;
    }
    JSON.stringify({model:'${model}',moving:${moving},x:unit.x,y:unit.y,passes:unit.emergencyPasses||0,
      rejoined:!unit.emergencyManeuver&&policeFootprintOnRoad(unit),collisions,unsafe,lateral,maxStep});
  `));
  assert(result.passes>=1&&result.lateral>28,JSON.stringify(result));
  assert(result.x>2040&&Math.abs(result.y-1200)<12&&result.rejoined,JSON.stringify(result));
  // Contact counts are diagnostic: a bump is acceptable if the responder
  // clears the blocker, rejoins its route, and stays on safe ground.
  assert.equal(result.unsafe,0,JSON.stringify(result));
  assert(result.maxStep<=maxSpeed+.01,JSON.stringify(result));results.push(result);
 }
}
const safeWait=JSON.parse(city.run(`
 trafficCars.length=0;incidentResponseVehicles.length=0;
 var unit={x:1350,y:1200,angle:0,width:72,height:34,maxSpeed:4.35,speed:0,model:'fireEngine',
 status:'enroute',route:[{x:2065,y:1200}]};incidentResponseVehicles.push(unit);
 var blocker={x:1600,y:1200,width:48,height:24,angle:0};trafficCars.push(blocker);
 var obstacles=[{x:1510,y:1130,width:380,height:60},{x:1510,y:1270,width:380,height:60}];solidProps.push(...obstacles);
 for(var tick=0;tick<240;tick++){tryPlanEmergencyPassing(unit,1/60);advanceServiceRoute(unit,1/60);}
 var blocked=unit.emergencyBlocked&&!unit.emergencyManeuver;
 var collision=!!contact(chassis(unit),chassis(blocker)),safe=emergencyPassingGroundClear(unit);
 solidProps.splice(solidProps.length-2,2);trafficCars.length=0;
 for(var tick=0;tick<600;tick++){tryPlanEmergencyPassing(unit,1/60);advanceServiceRoute(unit,1/60);}
 JSON.stringify({blocked,collision,safe,resumed:unit.x>2040});
`));
assert(safeWait.blocked&&safeWait.safe&&safeWait.resumed,JSON.stringify(safeWait));

// A complete dispatched fire cycle with one slow traffic obstacle. Other
// responders are covered by the independent complete-route matrix.
const loop=JSON.parse(city.run(`
 trafficCars.length=0;incidentResponseVehicles.length=0;
 var incident=cityIncidentDirector.start('fire',{x:9500,y:1200},{duration:600});dispatchIncidentResponse(incident);
 var engine=incidentResponseVehicles.find(u=>u.model==='fireEngine');
 incidentResponseVehicles.splice(0,incidentResponseVehicles.length,engine);
 var blocker={x:9100,y:1200,width:48,height:24,angle:0,speed:0};trafficCars.push(blocker);
 var collisions=0,unsafe=0,ticks=0;
 for(;ticks<10000&&incidentResponseVehicles.length;ticks++){
   if(trafficCars.includes(blocker))blocker.x+=blocker.speed;updateIncidentResponse(1/60);
   collisions+=trafficCars.includes(blocker)&&!!contact(chassis(engine),chassis(blocker));unsafe+=!emergencyPassingGroundClear(engine);
   if(engine.x>blocker.x+100)trafficCars.length=0;
 }
 JSON.stringify({ticks,passes:engine.emergencyPasses||0,returned:!!engine.returnedToBase,
  suppressed:!!incident.fireSuppressed,collisions,unsafe,x:engine.x,y:engine.y,status:engine.status,target:engine.responseTarget,route:engine.route,angle:engine.angle,blocked:engine.emergencyBlocked,points:engine.emergencyManeuver?.points});
`));
assert(loop.passes>0&&loop.returned&&loop.suppressed&&!loop.unsafe,JSON.stringify(loop));
// Exercise yielding through the real shared physics loop, not a second copy
// of the traffic rule. Record contacts before the solver could hide them.
const integratedCity=runtimeCity(91);
const yielding=JSON.parse(integratedCity.run(`
 trafficCars.length=0;parkedCars.length=0;pedestrians.length=0;policeCars.length=0;
 incidentPoliceCars.length=0;incidentResponseVehicles.length=0;cityIncidentDirector=null;
 Object.assign(player,{x:4500,y:1200,angle:0,speed:0});state.invulnTimer=99999;
 var unit={x:1350,y:1200,angle:0,width:54,height:27,maxSpeed:5.9,speed:0,model:'ambulance',
  status:'enroute',sceneTimer:99,route:[{x:2065,y:1200}],responseTarget:{x:2065,y:1200},baseTarget:{x:1350,y:1200}};
 incidentResponseVehicles.push(unit);
 var car={x:1640,y:1200,angle:0,width:48,height:24,speed:1.2,cruiseSpeed:1.2,
  axis:'x',minX:450,maxX:2450,turnRadius:20};trafficCars.push(car);
 var contacts=0,yielded=false,safe=true,arrived=false,reverseSteps=0;var originalResolve=resolveContact;
 resolveContact=(a,b,fixed)=>{if((a===unit||b===unit)&&contact(chassis(a),chassis(b)))contacts++;return originalResolve(a,b,fixed);};
 for(var tick=0;tick<1800&&incidentResponseVehicles.length;tick++){
  updatePhysics(1/60);yielded||=unit.status==='enroute'&&car.speed<.1;arrived||=unit.status==='onscene';
  safe&&=emergencyPassingGroundClear(unit);reverseSteps+=unit.speed<0;
 }
 JSON.stringify({yielded,contacts,safe,reverseSteps,passes:unit.emergencyPasses||0,arrived,returned:!!unit.returnedToBase,x:unit.x,y:unit.y,status:unit.status,points:unit.emergencyManeuver?.points,car:{x:car.x,y:car.y,speed:car.speed}});
`));
assert(yielding.yielded&&yielding.safe&&yielding.passes>0&&yielding.arrived&&yielding.returned&&yielding.reverseSteps>0,JSON.stringify(yielding));
const directory=new URL('../artifacts/living-city/',import.meta.url);mkdirSync(directory,{recursive:true});
writeFileSync(new URL('service-bypass.json',directory),JSON.stringify({results,safeWait,loop,yielding},null,2));
console.log('EMERGENCY SERVICE BYPASS PASS',JSON.stringify({results,safeWait,loop,yielding}));
