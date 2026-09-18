import assert from 'node:assert/strict';
import { createTransportController } from '../src/game/transport_controller.js';

function run(id, input, frames=60) {
  const car=createTransportController(id,{x:0,y:0,a:0});
  for(let i=0;i<frames;i++) car.step(1/60,input);
  return car;
}

const straight=run('sedan',{throttle:1,steer:0,brake:0});
assert(straight.state.x>20,'tyre-authoritative engine must still provide useful acceleration');
assert(Math.abs(straight.state.vy)<1,'straight acceleration must not create lateral motion');
assert(straight.state.driveLimit,'drive traction telemetry must exist');
assert(straight.state.driveLimit.force<=straight.state.driveLimit.capacity+1e-6,'drive force must not exceed tyre capacity');

const turning=run('sedan',{throttle:1,steer:.85,brake:0});
assert(Math.abs(turning.state.a)>0.05,'steering must produce heading response');
assert(Number.isFinite(turning.state.vx)&&Number.isFinite(turning.state.vy),'combined tyre motion must remain finite');
assert(turning.state.driveLimit.force<=turning.state.driveLimit.capacity+1e-6,'turning drive force must remain inside tyre capacity');

const braking=run('sedan',{throttle:1,brake:1,steer:0},30);
assert(Number.isFinite(braking.state.vx),'combined braking must remain finite');

console.log('TYRE MODEL: PASS ENGINE TRACTION + COMBINED STEERING + BRAKING');
