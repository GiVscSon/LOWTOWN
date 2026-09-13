import assert from 'node:assert/strict';
import { createVehicleState } from '../src/game/vehicle_state.js';
import { resolveTransportPhysics, listTransportProfiles } from '../src/game/transport_profiles.js';
import { stepCarPhysics } from '../src/game/car_physics.js';

const cars=listTransportProfiles('CAR');
assert(cars.length>=6,'LOWTOWN must expose the core car roster');

const results=[];
for(const profile of cars){
  const state=createVehicleState({vehicleId:profile.id,mass:profile.mass});
  const p=resolveTransportPhysics(profile.id);
  const start={x:state.x,y:state.y};
  let maxSpeed=0,maxSlip=0;
  for(let i=0;i<180;i++){
    const steer=i<90?.35:-.2;
    const t=stepCarPhysics(state,1/60,{throttle:1,steer},p);
    maxSpeed=Math.max(maxSpeed,t.velocity);maxSlip=Math.max(maxSlip,Math.abs(t.slipAngle));
    assert(Number.isFinite(t.velocity)&&Number.isFinite(t.heading),'vehicle telemetry must stay finite');
  }
  assert(state.x!==start.x||state.y!==start.y,`${profile.id} must move`);
  assert(maxSpeed>0,`${profile.id} must accelerate`);
  results.push({id:profile.id,drivetrain:p.drivetrain,maxSpeed,maxSlip,distance:state.distance});
}

assert(new Set(results.map(r=>r.maxSpeed.toFixed(3))).size>2,'vehicle profiles must produce differentiated handling');
console.log('PASS HANDLING CHARACTER',JSON.stringify(results));
