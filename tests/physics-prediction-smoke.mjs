import assert from 'node:assert/strict';
import { createTransportController } from '../src/game/transport_controller.js';
import { predictVehicle } from '../src/game/physics_prediction.js';

for(const vehicleId of ['sedan','coupe','truck','police']){
  const transport=createTransportController(vehicleId,{x:0,y:0,a:0,vx:0,vy:0});
  transport.setActuatorResponse({steer:1e9,throttle:1e9,brake:1e9,climb:1e9,descend:1e9});
  const before={...transport.state};
  const prediction=predictVehicle(before,1,{throttle:1,brake:0,steer:0},transport.physics,{useActuatorDelay:false});
  assert(Number.isFinite(prediction.x));
  assert(Number.isFinite(prediction.speed));
  assert(prediction.points.length>0);
  assert(prediction.speed>0,`${vehicleId}: prediction did not accelerate`);
  transport.step(1,{throttle:1,brake:0,steer:0});
  assert(transport.state.distance>0,`${vehicleId}: real transport did not move`);
  assert(Math.abs(prediction.x-transport.state.x)<1e-6,`${vehicleId}: prediction diverges from physics kernel`);
}

const delayed=createTransportController('sedan',{x:0,y:0,a:0,vx:0,vy:0});
const delayedBefore={...delayed.state,actuatorState:{...delayed.snapshot().actuator}};
const delayedPrediction=predictVehicle(delayedBefore,1,{throttle:1,brake:0,steer:0},delayed.physics,{useActuatorDelay:true});
delayed.step(1,{throttle:1,brake:0,steer:0});
assert(delayedPrediction.speed>0);
assert(delayed.state.distance>0);
assert(Math.abs(delayedPrediction.x-delayed.state.x)<.5,'actuator-aware prediction diverged materially');

console.log('PHYSICS PREDICTION: PASS SHARED KERNEL + ACTUATOR-AWARE PATH');
