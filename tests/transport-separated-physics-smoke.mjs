import assert from 'node:assert/strict';
import { createTransportState, TRANSPORT_TYPES } from '../src/game/transport_physics.js';
import { getTypePhysics } from '../src/game/transport_type_physics.js';
import { resolveTransportPhysics } from '../src/game/transport_profiles.js';
import { stepCarPhysics } from '../src/game/car_physics.js';
import { stepBoatPhysics } from '../src/game/boat_physics.js';
import { stepPlanePhysics } from '../src/game/plane_physics.js';

const car=createTransportState({type:TRANSPORT_TYPES.CAR,vehicleId:'sedan'});
const boat=createTransportState({type:TRANSPORT_TYPES.BOAT,vehicleId:'speedboat'});
const plane=createTransportState({type:TRANSPORT_TYPES.PLANE,vehicleId:'light_plane',z:100});
const cp=getTypePhysics(TRANSPORT_TYPES.CAR);
const bp=getTypePhysics(TRANSPORT_TYPES.BOAT);
const pp=getTypePhysics(TRANSPORT_TYPES.PLANE);

const c=stepCarPhysics(car,1/60,{throttle:1,steer:.5},resolveTransportPhysics('sedan'));
const b=stepBoatPhysics(boat,1/60,{throttle:1,steer:.5},resolveTransportPhysics('speedboat'));
const p=stepPlanePhysics(plane,1/60,{throttle:1,steer:.5,climb:.5},resolveTransportPhysics('light_plane'));

assert.equal(c.type,'CAR');assert.equal(c.surface,'road');assert.equal(c.drift,false);
assert.equal(b.type,'BOAT');assert.equal(b.surface,'water');assert.equal(b.drift,false);
assert.equal(p.type,'PLANE');assert.equal(p.surface,'air');assert.ok(p.altitude>=40);
assert.notEqual(c.surface,b.surface);assert.notEqual(b.surface,p.surface);
assert.equal(cp.controls.handbrake,true);assert.equal(bp.controls.handbrake,false);assert.equal(pp.controls.climb,true);
for(const v of [c,b,p])for(const k of ['x','y','velocity','forwardSpeed','yawRate'])assert.ok(Number.isFinite(v[k]));
console.log('TRANSPORT SEPARATED PHYSICS SMOKE: PASS CAR/BOAT/PLANE');
