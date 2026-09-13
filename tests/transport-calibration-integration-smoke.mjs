import assert from 'node:assert/strict';
import { createTransportController } from '../src/game/transport_controller.js';
import { resolveTransportPhysics } from '../src/game/transport_profiles.js';

const transport=createTransportController('sedan',{x:0,y:0});
const base=resolveTransportPhysics('sedan');
assert.equal(transport.physics.engineForce,base.engineForce);
assert.equal(transport.state.physics,transport.physics);

transport.setCalibration({
  ready:true,
  confidence:1,
  accelerationScale:1.10,
  brakingScale:.90,
  steeringScale:1.05,
  dragScale:1.10,
  turnRadiusScale:.95
});

assert.equal(transport.state.physics,transport.physics);
assert.ok(transport.physics.engineForce>base.engineForce);
assert.ok(transport.physics.brakeForce<base.brakeForce);
assert.ok(transport.physics.steeringRate>base.steeringRate);
assert.ok(transport.physics.drag>base.drag);
assert.ok(transport.physics.turnRadius<base.turnRadius);
assert.equal(transport.physics.calibration.confidence,1);

const calibratedEngine=transport.physics.engineForce;
transport.setVehicle('truck');
const truckBase=resolveTransportPhysics('truck');
assert.equal(transport.state.vehicleId,'truck');
assert.equal(transport.state.physics,transport.physics);
assert.ok(transport.physics.engineForce>truckBase.engineForce);
assert.notEqual(transport.physics.engineForce,calibratedEngine);

transport.clearCalibration();
assert.equal(transport.physics.engineForce,truckBase.engineForce);
assert.equal(transport.physics.brakeForce,truckBase.brakeForce);
assert.equal(transport.physics.steeringRate,truckBase.steeringRate);
assert.equal(transport.physics.drag,truckBase.drag);
assert.equal(transport.physics.turnRadius,truckBase.turnRadius);
assert.equal(transport.state.physics,transport.physics);

console.log('TRANSPORT CALIBRATION INTEGRATION SMOKE: PASS DIRECT CALIBRATION -> LIVE PHYSICS -> VEHICLE SWITCH -> CLEAR');
