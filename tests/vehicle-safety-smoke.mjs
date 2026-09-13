import assert from 'node:assert/strict';
import { stoppingDistance, safeFollowingGap, collisionSafety, actuatorStep, applyActuatorDelay } from '../src/game/vehicle_safety.js';

assert(Math.abs(stoppingDistance(20,10,.5)-30)<1e-9);
assert(stoppingDistance(30,10,.5)>stoppingDistance(20,10,.5));
assert(safeFollowingGap({speed:30,relativeSpeed:10,brakingAcceleration:10,reactionTime:.25,margin:12})>0);
const safe=collisionSafety({gap:120,speed:20,relativeSpeed:5,brakingAcceleration:10,reactionTime:.25,margin:8});
const unsafe=collisionSafety({gap:20,speed:30,relativeSpeed:20,brakingAcceleration:6,reactionTime:.5,margin:8});
assert(safe.safe);
assert(!unsafe.safe);
assert(Number.isFinite(safe.requiredGap));
const fast=actuatorStep(0,1,20,.1);
assert(fast>0&&fast<1);
assert.equal(actuatorStep(1,0,0,.1),1);
const delayed=applyActuatorDelay({throttle:1,brake:0,steer:1},{throttle:0,brake:0,steer:0},1/60);
assert(delayed.throttle>0&&delayed.throttle<1);
assert(delayed.steer>0&&delayed.steer<1);
console.log('VEHICLE SAFETY: PASS STOPPING DISTANCE + ACTUATOR DYNAMICS');
