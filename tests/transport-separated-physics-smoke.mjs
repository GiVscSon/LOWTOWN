import assert from 'node:assert/strict';
import { createTransportState, TRANSPORT_PROFILES, TRANSPORT_TYPES } from '../src/game/transport_physics.js';
import { getTypePhysics } from '../src/game/transport_type_physics.js';
import { stepCarPhysics } from '../src/game/car_physics.js';
import { stepBoatPhysics } from '../src/game/boat_physics.js';
import { stepPlanePhysics } from '../src/game/plane_physics.js';

const car=createTransportState({type:TRANSPORT_TYPES.CAR});
const boat=createTransportState({type:TRANSPORT_TYPES.BOAT});
const plane=createTransportState({type:TRANSPORT_TYPES.PLANE,z:100});
const cp=getTypePhysics(TRANSPORT_TYPES.CAR);
const bp=getTypePhysics(TRANSPORT_TYPES.BOAT);
const pp=getTypePhysics(TRANSPORT_TYPES.PLANE);

const c=stepCarPhysics(car,1/60,{throttle:1,steer:.5},TRANSPORT_PROFILES.CAR);
const b=stepBoatPhysics(boat,1/60,{throttle:1,steer:.5},TRANSPORT_PROFILES.BOAT);
const p=stepPlanePhysics(plane,1/60,{throttle:1,steer:.5,climb:.5},TRANSPORT_PROFILES.PLANE);

assert.equal(c.type,'CAR');assert.equal(c.surface,'road');assert.equal(c.drift,false);
assert.equal(b.type,'BOAT');assert.equal(b.surface,'water');assert.equal(b.drift,false);
assert.equal(p.type,'PLANE');assert.equal(p.surface,'air');assert.ok(p.altitude>=40);
assert.notEqual(c.surface,b.surface);assert.notEqual(b.surface,p.surface);
assert.equal(cp.controls.handbrake,true);assert.equal(bp.controls.handbrake,false);assert.equal(pp.controls.climb,true);
for(const v of [c,b,p])for(const k of ['x','y','velocity','forwardSpeed','yawRate'])assert.ok(Number.isFinite(v[k]));
console.log('TRANSPORT SEPARATED PHYSICS SMOKE: PASS CAR/BOAT/PLANE');
