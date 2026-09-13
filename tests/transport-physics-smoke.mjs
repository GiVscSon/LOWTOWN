import assert from 'node:assert/strict';
import { createTransportState, transportStep, transportSpeed, TRANSPORT_TYPES } from '../src/game/transport_physics.js';

for (const type of Object.values(TRANSPORT_TYPES)) {
  const s=createTransportState({type,x:0,y:0,z:type==='PLANE'?100:0});
  const start={x:s.x,y:s.y,z:s.z};
  const samples=[];
  for(let i=0;i<2400;i++) {
    const t=i/120;
    const input=type==='PLANE'
      ? {throttle:.7,steer:Math.sin(t*.35)*.35,climb:i<600?.25:i>1500?-.18:0,descend:0}
      : {throttle:.7,steer:Math.sin(t*.35)*.25,brake:0,handbrake:false};
    const tele=transportStep(s,1/120,input);
    samples.push(tele);
    assert.ok(Number.isFinite(tele.velocity));
    assert.ok(Number.isFinite(tele.forwardSpeed));
    assert.ok(Number.isFinite(tele.lateralSpeed));
    assert.ok(Number.isFinite(tele.yawRate));
    assert.equal(tele.vehicleType,type);
  }
  assert.ok(transportSpeed(s)>0,`${type} failed to move`);
  assert.ok(Math.hypot(s.x-start.x,s.y-start.y)>1,`${type} failed horizontal movement`);
  assert.ok(s.distance>0,`${type} failed distance accumulation`);
  if(type==='PLANE') assert.ok(s.z>40 && s.z<1800);
  assert.ok(samples.length===2400);
}

const car=createTransportState({type:'CAR'});
const before=transportStep(car,1/60,{throttle:.8,steer:.2});
assert.equal(before.vehicleType,'CAR');
const boat=createTransportState({type:'BOAT'});
const boatTele=transportStep(boat,1/60,{throttle:.8,steer:.2,handbrake:true});
assert.equal(boatTele.controls.handbrake,false);
const plane=createTransportState({type:'PLANE',z:100});
const planeTele=transportStep(plane,1/60,{throttle:.8,steer:.2,climb:.5});
assert.equal(planeTele.controls.climb,.5);
console.log('TRANSPORT PHYSICS SMOKE: PASS CAR/BOAT/PLANE 2400 STEPS EACH');
