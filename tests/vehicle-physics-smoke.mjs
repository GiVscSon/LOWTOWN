import assert from 'node:assert/strict';
import { createVehicleState, vehicleStep, vehicleSpeed, VEHICLE_PHYSICS } from '../src/game/vehicle_physics.js';

const car=createVehicleState();
vehicleStep(car,1,{throttle:1});
assert(vehicleSpeed(car)>250,'vehicle failed to accelerate');
assert(vehicleSpeed(car)<=VEHICLE_PHYSICS.maxForwardSpeed+1e-6,'forward speed limiter failed');

const turning=createVehicleState({a:0});
vehicleStep(turning,.8,{throttle:1,steer:1});
assert(Math.abs(turning.a)>.15,'steering has no authority');
assert(Math.hypot(turning.x,turning.y)>100,'vehicle did not translate');

const braking=createVehicleState({vx:300});
vehicleStep(braking,.5,{brake:1});
assert(vehicleSpeed(braking)<300,'brakes failed to reduce speed');

const reverse=createVehicleState({a:0});
vehicleStep(reverse,1,{throttle:-1});
assert(reverse.vx<0,'reverse direction failed');
assert(reverse.vx>=-VEHICLE_PHYSICS.maxReverseSpeed-1e-6,'reverse speed limiter failed');

const drift=createVehicleState({vx:160,vy:70});
const before=Math.abs(drift.vy);
vehicleStep(drift,.25,{throttle:0});
assert(Math.abs(drift.vy)<before,'normal lateral grip failed');

const handbrake=createVehicleState({vx:160,vy:70});
vehicleStep(handbrake,.25,{throttle:0,handbrake:true});
assert(Math.abs(handbrake.vy)>Math.abs(drift.vy),'handbrake should preserve more lateral motion');

console.log('VEHICLE PHYSICS SMOKE: PASS');
