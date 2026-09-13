import assert from 'node:assert/strict';
import { createAIDriver } from '../src/game/ai_driver.js';
import { createTransportController } from '../src/game/transport_controller.js';
import { TRANSPORT_TYPES } from '../src/game/transport_constants.js';
import { resolveTransportPhysics } from '../src/game/transport_profiles.js';

const GRID=160;
const nodes=[];
for(let x=0;x<=960;x+=GRID)for(let y=0;y<=960;y+=GRID)nodes.push({x,y,id:nodes.length,links:[]});
for(const n of nodes)for(const m of nodes){
  if(Math.abs(n.x-m.x)+Math.abs(n.y-m.y)===GRID)n.links.push(m);
}

const walls=new Set();
const key=(x,y)=>`${Math.round(x)},${Math.round(y)}`;
const blocked=(x,y)=>{
  const gx=Math.round(x/GRID)*GRID,gy=Math.round(y/GRID)*GRID;
  return walls.has(key(gx,gy));
};

function makeTraffic(){
  return [
    {x:320,y:320,a:0,v:70},
    {x:640,y:320,a:Math.PI,v:55},
    {x:480,y:640,a:Math.PI/2,v:80}
  ];
}

function run(vehicleId,index){
  walls.clear();
  if(index%2===0){ walls.add(key(480,320)); walls.add(key(480,480)); }
  else { walls.add(key(320,480)); walls.add(key(640,480)); }

  const traffic=makeTraffic();
  const transport=createTransportController(vehicleId,{x:160,y:160});
  const ai=createAIDriver({nodes,blocked,getTraffic:()=>traffic});
  const physics=resolveTransportPhysics(vehicleId);
  ai.start(transport.state);

  let finiteFrames=0, maxSpeed=0, minTtc=Infinity, throttleFrames=0;
  for(let frame=0;frame<360;frame++){
    for(const o of traffic){
      o.x+=Math.cos(o.a)*o.v/60;
      o.y+=Math.sin(o.a)*o.v/60;
      if(o.x<80||o.x>880)o.a=Math.PI-o.a;
      if(o.y<80||o.y>880)o.a=-o.a;
    }

    if(frame===120){
      transport.state.vx*=0.55;
      transport.state.vy*=0.55;
    }
    if(frame===240){
      transport.state.x=Math.max(80,transport.state.x-24);
      transport.state.y+=18;
    }

    const control=ai.update(transport.state,1/60);
    assert.ok(control,`${vehicleId}: AI returned no control at frame ${frame}`);
    transport.step(1/60,control);
    const s=transport.state;
    const t=s.telemetry;
    for(const k of ['x','y','z','a','vx','vy','vz','yawRate','distance'])assert.ok(Number.isFinite(s[k]),`${vehicleId}:${k} non-finite at ${frame}`);
    for(const k of ['velocity','forwardSpeed','lateralSpeed','yawRate','slipAngle','traction'])assert.ok(Number.isFinite(t[k]),`${vehicleId}:telemetry.${k} non-finite at ${frame}`);
    for(const k of ['throttle','brake','steer'])assert.ok(Number.isFinite(control[k]),`${vehicleId}:control.${k} non-finite at ${frame}`);
    assert.equal(s.physics,transport.physics,`${vehicleId}: live physics reference lost`);
    assert.equal(s.mass,physics.mass,`${vehicleId}: mass desynchronised`);
    assert.ok(ai.state.targetSpeed<=physics.maxForwardSpeed+1e-6,`${vehicleId}: target speed exceeds profile`);
    if(control.throttle>.05)throttleFrames++;
    maxSpeed=Math.max(maxSpeed,t.velocity);
    minTtc=Math.min(minTtc,Number.isFinite(ai.state.prediction?.ttc)?ai.state.prediction.ttc:Infinity);
    finiteFrames++;
  }

  assert.equal(finiteFrames,360);
  assert.ok(throttleFrames>30,`${vehicleId}: AI never applied meaningful throttle`);
  assert.ok(maxSpeed>.5,`${vehicleId}: vehicle did not move; max speed=${maxSpeed}`);
  assert.ok(transport.state.distance>.5,`${vehicleId}: transport distance did not increase`);
  assert.ok(ai.state.distance>.5,`${vehicleId}: AI distance did not increase`);
  assert.ok(ai.state.decisions>100,`${vehicleId}: insufficient AI decisions`);
  assert.ok(ai.state.route.length>0,`${vehicleId}: route lost permanently`);
  assert.ok(ai.state.replans>0,`${vehicleId}: no route replanning observed`);
  return {vehicleId,frames:finiteFrames,decisions:ai.state.decisions,replans:ai.state.replans,recoveries:ai.state.recoveries,maxSpeed:+maxSpeed.toFixed(2),minTtc:minTtc===Infinity?null:+minTtc.toFixed(3),distance:+transport.state.distance.toFixed(2),aiDistance:+ai.state.distance.toFixed(2),throttleFrames};
}

const results=['sedan','coupe','truck','police'].map((id,i)=>run(id,i));
assert.equal(results.length,4);
assert.ok(results.every(r=>r.frames===360));
console.log('TRANSPORT AI CLOSED-LOOP STRESS: PASS REAL MOTION');
console.log(JSON.stringify(results,null,2));
