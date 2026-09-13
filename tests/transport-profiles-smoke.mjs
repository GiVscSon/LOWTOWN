import assert from 'node:assert/strict';
import { VEHICLE_PROFILES, getTransportProfile, resolveTransportPhysics, listTransportProfiles } from '../src/game/transport_profiles.js';
import { TRANSPORT_TYPES } from '../src/game/transport_constants.js';

assert.ok(Object.keys(VEHICLE_PROFILES).length >= 10);
assert.equal(getTransportProfile('coupe').type,TRANSPORT_TYPES.CAR);
assert.equal(getTransportProfile('ferry').type,TRANSPORT_TYPES.BOAT);
assert.equal(getTransportProfile('light_plane').type,TRANSPORT_TYPES.PLANE);
assert.notEqual(resolveTransportPhysics('truck').maxForwardSpeed,resolveTransportPhysics('coupe').maxForwardSpeed);
assert.ok(resolveTransportPhysics('truck').mass>resolveTransportPhysics('sedan').mass);
assert.ok(resolveTransportPhysics('coupe').steeringRate>resolveTransportPhysics('truck').steeringRate);
assert.ok(resolveTransportPhysics('speedboat').engineForce>resolveTransportPhysics('ferry').engineForce);
assert.ok(listTransportProfiles(TRANSPORT_TYPES.CAR).every(v=>v.type===TRANSPORT_TYPES.CAR));
assert.ok(listTransportProfiles(TRANSPORT_TYPES.BOAT).every(v=>v.type===TRANSPORT_TYPES.BOAT));
assert.ok(listTransportProfiles(TRANSPORT_TYPES.PLANE).every(v=>v.type===TRANSPORT_TYPES.PLANE));
for(const id of Object.keys(VEHICLE_PROFILES)){
  const p=resolveTransportPhysics(id);
  for(const key of ['mass','engineForce','brakeForce','steeringRate','lateralGrip','maxForwardSpeed']) assert.ok(Number.isFinite(p[key]),`${id}:${key}`);
}
console.log('TRANSPORT PROFILES SMOKE: PASS',Object.keys(VEHICLE_PROFILES).length,'profiles');
