import assert from 'node:assert/strict';
import { createTransportController } from '../src/game/transport_controller.js';
import { predictVehicle } from '../src/game/physics_prediction.js';

for(const vehicleId of ['sedan','coupe','truck','police']){
  const transport=createTransportController(vehicleId,{x:0,y:0,a:0,vx:0,vy:0});
  const before={...transport.state};
  const prediction=predictVehicle(before,1,{throttle:1,brake:0,steer:0},transport.physics);
  assert(Number.isFinite(prediction.x));
  assert(Number.isFinite(prediction.speed));
  assert(prediction.points.length>0);
  assert(prediction.speed>0,`${vehicleId}: prediction did not accelerate`);
  transport.step(1,{throttle:1,brake:0,steer:0});
  assert(transport.state.distance>0,`${vehicleId}: real transport did not move`);
  assert(Math.abs(prediction.x-transport.state.x)<1e-6,`${vehicleId}: prediction diverges from physics kernel`);
}
console.log('PHYSICS PREDICTION: PASS SAME TRANSPORT PHYSICS KERNEL');
