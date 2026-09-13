import assert from 'node:assert/strict';
import { TRANSPORT_TYPES } from '../src/game/transport_physics.js';
import { getTypePhysics, normalizeTypeInput, typeTelemetry } from '../src/game/transport_type_physics.js';

const car=getTypePhysics(TRANSPORT_TYPES.CAR);
const boat=getTypePhysics(TRANSPORT_TYPES.BOAT);
const plane=getTypePhysics(TRANSPORT_TYPES.PLANE);

assert.equal(car.environment.surface,'road');
assert.equal(boat.environment.surface,'water');
assert.equal(plane.environment.surface,'air');
assert.equal(car.controls.handbrake,true);
assert.equal(boat.controls.handbrake,false);
assert.equal(plane.controls.climb,true);
assert.equal(car.dimensions.altitude,false);
assert.equal(plane.dimensions.altitude,true);

const ci=normalizeTypeInput({throttle:2,brake:-1,steer:2,handbrake:true,climb:1},TRANSPORT_TYPES.CAR);
assert.deepEqual(ci,{throttle:1,brake:0,steer:1,handbrake:true,climb:0,descend:0});
const bi=normalizeTypeInput({throttle:2,handbrake:true,climb:1},TRANSPORT_TYPES.BOAT);
assert.equal(bi.handbrake,false);assert.equal(bi.climb,0);
const pi=normalizeTypeInput({throttle:-1,climb:2,descend:-1},TRANSPORT_TYPES.PLANE);
assert.equal(pi.throttle,-1);assert.equal(pi.climb,1);assert.equal(pi.descend,0);

const t=typeTelemetry(TRANSPORT_TYPES.PLANE,{x:1,y:2,z:100});
assert.equal(t.altitudeEnabled,true);
assert.deepEqual(t.position,{x:1,y:2,z:100});
console.log('TRANSPORT TYPE PHYSICS SMOKE: PASS CAR/BOAT/PLANE');
