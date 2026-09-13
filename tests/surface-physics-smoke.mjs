import assert from 'node:assert/strict';
import { createVehicleState } from '../src/game/vehicle_state.js';
import { resolveTransportPhysics } from '../src/game/transport_profiles.js';
import { stepCarPhysics } from '../src/game/car_physics.js';

function run(surface,steer=0,brake=0){
  const state=createVehicleState({vehicleId:'sedan',mass:1500,vx:180,surface});
  const p=resolveTransportPhysics('sedan');
  let maxSlip=0;
  for(let i=0;i<120;i++){
    const t=stepCarPhysics(state,1/60,{surface,steer,brake},p);
    maxSlip=Math.max(maxSlip,Math.abs(t.slipAngle));
  }
  return {speed:Math.hypot(state.vx,state.vy),distance:state.distance,maxSlip};
}

const dry=run('dry',.45);
const wet=run('wet',.45);
const dirt=run('dirt',.45);
assert(wet.maxSlip>dry.maxSlip,'wet surface must reduce lateral grip');
assert(dirt.maxSlip>dry.maxSlip,'dirt surface must reduce lateral grip');
const dryBrake=run('dry',0,1).speed;
const wetBrake=run('wet',0,1).speed;
const dirtBrake=run('dirt',0,1).speed;
assert(wetBrake>dryBrake,'wet surface must reduce braking effectiveness');
assert(dirtBrake>dryBrake,'dirt surface must reduce braking effectiveness');
for(const sample of [dry,wet,dirt])assert(Number.isFinite(sample.speed)&&Number.isFinite(sample.distance),'surface result must remain finite');
console.log('PASS SURFACE PHYSICS',JSON.stringify({dry:{speed:dry.speed,slip:dry.maxSlip},wet:{speed:wet.speed,slip:wet.maxSlip},dirt:{speed:dirt.speed,slip:dirt.maxSlip},braking:{dry:dryBrake,wet:wetBrake,dirt:dirtBrake}}));
