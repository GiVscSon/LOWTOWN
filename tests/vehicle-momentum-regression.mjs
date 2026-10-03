import assert from 'node:assert/strict';
import {captureMotion,solveVehicleMotion,contact,chassis,resolveContact,resolveScenery} from '../src/simulation/solid_contacts.js';
import {runtimeCity} from './helpers/runtime-city.mjs';
const body=(x,mass=1500,width=48,height=24)=>({x,y:0,angle:0,width,height,mass,speed:0,vx:0,vy:0});
const results=[];
for(const hz of [30,60,120]){
  const car=body(0),parked=body(60);car.speed=car.vx=5;
  let contacts=0;
  for(let i=0;i<hz;i++){
    const starts=captureMotion([car,parked]);car.x+=car.vx*60/hz;
    solveVehicleMotion([car,parked],starts,1/hz,{player:car,passive:new Set([parked]),onImpact:()=>contacts++});
    assert(!contact(chassis(car),chassis(parked)),'parked cars must not overlap');
  }
  assert(parked.x>110,'parked sedan must be pushed and coast');
  assert(contacts>0);results.push({hz,car:car.x,parked:parked.x});
}
assert(Math.max(...results.map(r=>r.parked))-Math.min(...results.map(r=>r.parked))<5,JSON.stringify(results));
const heavy=body(0,5200,84),light=body(60,900);heavy.vx=heavy.speed=4;
const heavierStart=captureMotion([heavy,light]);heavy.x+=12;
solveVehicleMotion([heavy,light],heavierStart,.05,{player:heavy,passive:new Set([light])});
assert(light.vx>3&&heavy.vx>3,'heavy truck must transfer momentum while retaining more speed than an equal-mass collision');
for(const angle of [0,.4,Math.PI/2]){
  const car={...body(-100),angle,vx:60*Math.cos(angle),vy:60*Math.sin(angle),speed:60,x:-100*Math.cos(angle),y:-100*Math.sin(angle)};
  const starts=captureMotion([car]);car.x+=car.vx*3;car.y+=car.vy*3;
  const wall={x:0,y:0,width:angle===Math.PI/2?200:2,height:angle===Math.PI/2?2:200};
  solveVehicleMotion([car],starts,.05,{player:car,props:[wall]});
  const projection=car.x*Math.cos(angle)+car.y*Math.sin(angle);
  assert(projection<0,'fast rotating chassis crossed a thin wall');assert(!contact(chassis(car),chassis(wall)));
}
const truck={...body(0,5200,120),vx:2,speed:2};
assert(resolveScenery(truck,[],[{x:55,y:0}]),'long truck nose must detect small objects beyond old broadphase');
const glancing={...body(0),vx:3,vy:4,speed:3};resolveContact(glancing,{...body(20),width:2,height:100},true);
assert(Math.abs(glancing.vy-4)<1e-9,'wall contact must preserve tangential velocity');
// A pile-up pinned against a wall must settle without cars stacking inside one another.
const chain=[body(0,5200),body(55),body(110)],wall={x:160,y:0,width:4,height:100};
for(let i=0;i<90;i++){
 const starts=captureMotion(chain);chain[0].speed=chain[0].vx=2;chain[0].x+=2;
 solveVehicleMotion(chain,starts,1/60,{player:chain[0],passive:new Set(chain.slice(1)),props:[wall]});
 for(let j=0;j<2;j++)assert(!contact(chassis(chain[j]),chassis(chain[j+1])),'cars squeezed into a wall must not overlap');
 assert(!contact(chassis(chain[2]),chassis(wall)));
}
const walker={x:50,y:0,angle:0,width:9,height:9,hp:100},striker={...body(0),vx:8,speed:8};
const walkStarts=captureMotion([walker,striker]);striker.x+=24;let pedestrianHit=0;
solveVehicleMotion([striker,walker],walkStarts,.05,{player:walker,people:new Set([walker]),onImpact:(a,b,speed)=>{pedestrianHit=Math.max(pedestrianHit,speed);}});
assert(pedestrianHit>5&&!contact(chassis(striker),chassis(walker)),'on-foot player must have a swept vehicle contact');
// Real game controller: parked cars, movable bins and knockdowns, not a separate physics sandbox.
const {run}=runtimeCity();
run(`trafficCars.length=0;pedestrians.length=0;parkedCars.length=0;policeCars.length=0;incidentPoliceCars.length=0;incidentResponseVehicles.length=0;
 cityIncidentDirector.state.cooldown=99999;roam=createFreeRoam(player,parkedCars,buildings,trees,isPositionOnSolidGround,()=>{},solidProps,isPositionOnWaterObstacle);roam.fleet.length=0;
 const target={x:1710,y:1200,angle:0,width:48,height:24,mass:1500,speed:0,type:'sedan'};parkedCars.push(target);
 roam.resetToSedan(1640,1200,0);Object.assign(player,{vx:4,vy:0,speed:4});state.invulnTimer=9999;state.keys.up=true;
 for(let i=0;i<90;i++)updatePhysics(1/60);state.keys.up=false;`);
assert(run('target.x')>1740,'live parked car did not move');assert.equal(run('contact(chassis(player),chassis(target))'),null);
run(`parkedCars.length=0;breakableProps.length=0;roam.resetToSedan(1600,1200,0);Object.assign(player,{vx:5,vy:0,speed:5});
 const bin={x:1655,y:1200,w:26,h:18,type:'dumpster',intact:true,mass:130};breakableProps.push(bin);
 for(let i=0;i<30;i++)updatePhysics(1/60);`);
assert(run('bin.x')>1680,'live dumpster must move instead of disappearing');assert(run('bin.intact'));
run(`breakableProps.length=0;roam.resetToSedan(1600,1200,0);Object.assign(player,{vx:6,vy:0,speed:6});
 const person={x:1650,y:1200,heading:0,walkSpeed:0,pause:999,reaction:'calm',hp:100};pedestrians.push(person);
 updatePhysics(.05);updatePhysics(.05);`);
assert.equal(run('person.stance'),'down');assert(run('person.hp')<100,'collision must affect the person');assert(run('state.wanted')>0);
assert.equal(run('contact(chassis(player),{x:person.x,y:person.y,angle:0,length:9,breadth:9})'),null);
run('state.wanted=0;releaseWantedPolice();roam.resetToSedan(1900,1200);for(let i=0;i<400;i++)updatePhysics(1/60);');
assert.equal(run('person.stance'),null,'pedestrian must recover instead of remaining stuck');
console.log('PASS: live mass-dependent pushing, moving bins, pedestrian knockdown/recovery, thin-wall sweeps, truck nose and frame rates',JSON.stringify(results));
