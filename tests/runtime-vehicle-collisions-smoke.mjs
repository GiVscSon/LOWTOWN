import assert from 'node:assert/strict';
import { initializeTrafficCar, stepTrafficFleet } from '../src/game/runtime_traffic.js';
import { resolveRuntimeVehicleCollisions } from '../src/game/runtime_vehicle_collisions.js';

const node=(id,x,y)=>({id,x,y,links:[]});

{
  const a=node('A',0,0),b=node('B',120,0);
  a.links=[b];b.links=[a];

  const car={
    trafficId:'npc-head-on',currentSegment:[a,b],segmentProgress:.42,segmentLength:120,
    speed:55,cruiseSpeed:70,laneOffset:12,width:50,height:26,angle:0
  };
  initializeTrafficCar(car);

  const player={
    x:car.x+24,y:car.y,vx:-80,vy:0,angle:Math.PI,
    width:48,height:24,hp:100
  };
  let callbackDamage=0;
  const beforeVx=player.vx;
  const result=resolveRuntimeVehicleCollisions(player,[car],1/60,{
    onPlayerImpact:({damage})=>{callbackDamage+=damage;}
  });

  assert.equal(result.playerHits,1,'player/NPC impact must be reported once');
  assert.ok(result.damage>0&&callbackDamage>0,'player/NPC impact must produce damage');
  assert.ok(player.vx>beforeVx,'impact must change player velocity');
  assert.ok(car.speed<55,'NPC must lose speed after a head-on impact');
  assert.ok(Number.isFinite(player.x)&&Number.isFinite(player.y),'player response must remain finite');
}

{
  const west=node('W',0,0),east=node('E',100,0);
  const south=node('S',50,-50),north=node('N',50,50);
  west.links=[east];east.links=[west];south.links=[north];north.links=[south];

  const horizontal={
    trafficId:'cross-h',currentSegment:[west,east],segmentProgress:.5,segmentLength:100,
    speed:65,cruiseSpeed:65,laneOffset:12,width:50,height:26
  };
  const vertical={
    trafficId:'cross-v',currentSegment:[south,north],segmentProgress:.5,segmentLength:100,
    speed:65,cruiseSpeed:65,laneOffset:12,width:50,height:26
  };
  initializeTrafficCar(horizontal);
  initializeTrafficCar(vertical);
  const before=[horizontal.speed,vertical.speed];

  const result=resolveRuntimeVehicleCollisions(null,[horizontal,vertical],1/60);
  assert.ok(result.trafficContacts>=1,'crossing NPCs must register contact');
  assert.ok(horizontal.speed<before[0]||vertical.speed<before[1],'NPC contact must change speed');
  assert.ok(horizontal.collisionHold>0&&vertical.collisionHold>0,'NPC contact must create a short recovery hold');

  const p0={x:horizontal.x,y:horizontal.y};
  for(let i=0;i<30;i++)stepTrafficFleet([horizontal,vertical],1/60);
  assert.ok(Math.hypot(horizontal.x-p0.x,horizontal.y-p0.y)>1,'traffic must recover and continue after contact');
}

{
  const a=node('A2',0,0),b=node('B2',200,0);
  a.links=[b];b.links=[a];
  const far={
    trafficId:'far',currentSegment:[a,b],segmentProgress:.8,segmentLength:200,
    speed:50,cruiseSpeed:50,laneOffset:12,width:50,height:26
  };
  initializeTrafficCar(far);
  const player={x:-200,y:-200,vx:10,vy:0,angle:0,width:48,height:24};
  const result=resolveRuntimeVehicleCollisions(player,[far],1/60);
  assert.equal(result.playerHits,0,'far vehicles must not produce false player impacts');
  assert.equal(result.trafficContacts,0,'single NPC cannot collide with itself');
}

console.log('RUNTIME VEHICLE COLLISIONS: PASS player impulse + damage + NPC recovery + no false positives');
