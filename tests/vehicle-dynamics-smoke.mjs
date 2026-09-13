import assert from 'node:assert/strict';
import { estimateLoadTransfer, estimateFriction, applyTireFriction } from '../src/game/vehicle_dynamics.js';

const neutral=estimateLoadTransfer({mass:1500});
const accel=estimateLoadTransfer({mass:1500,longitudinalAccel:4});
assert(accel.front<neutral.front&&accel.rear>neutral.rear);
const corner=estimateLoadTransfer({mass:1500,lateralAccel:5});
assert(corner.left!==corner.right);
const clean=estimateFriction({speed:80,slipAngle:.02,mu:1});
const fast=estimateFriction({speed:500,slipAngle:.45,mu:1});
assert(fast.effectiveMu<clean.effectiveMu);
assert(fast.uncertainty>clean.uncertainty);
assert(Math.abs(applyTireFriction(10000,1000,clean))<=1000*clean.effectiveMu+1e-9);
console.log('VEHICLE DYNAMICS: PASS LOAD TRANSFER + FRICTION + UNCERTAINTY');
