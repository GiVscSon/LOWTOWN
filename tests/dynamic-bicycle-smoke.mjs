import assert from 'node:assert/strict';
import { createTransportController } from '../src/game/transport_controller.js';

const low=createTransportController('sedan',{x:0,y:0,a:0,vx:70,vy:0});
low.step(1/60,{throttle:.2,steer:.4,brake:0});
assert.equal(low.state.handlingModel,'kinematic-grip','low-speed model must remain stable');

const high=createTransportController('sedan',{x:0,y:0,a:0,vx:220,vy:0});
for(let i=0;i<30;i++)high.step(1/60,{throttle:.2,steer:.45,brake:0});
assert.equal(high.state.handlingModel,'dynamic-bicycle','high-speed model must switch automatically');
assert(Number.isFinite(high.state.yawRate));
assert(Number.isFinite(high.state.vx)&&Number.isFinite(high.state.vy));
assert(Math.abs(high.state.a)>1e-4,'dynamic model must produce real heading response');
assert(high.state.distance>0,'dynamic model must preserve real motion');
console.log('DYNAMIC BICYCLE: PASS LOW/HIGH SPEED MODEL SWITCH + REAL YAW');
