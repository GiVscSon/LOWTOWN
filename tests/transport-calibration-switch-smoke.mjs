import assert from 'node:assert/strict';
import { createTransportController } from '../src/game/transport_controller.js';

const controller=createTransportController('sedan');
const baseSedan=controller.physics;
const profile={version:1,vehicles:{
  sedan:{vehicleId:'sedan',ready:true,confidence:1,accelerationScale:1.2,brakingScale:1.1,steeringScale:1.15,dragScale:.9,turnRadiusScale:.95,samples:120},
  truck:{vehicleId:'truck',ready:true,confidence:1,accelerationScale:.8,brakingScale:1.2,steeringScale:.85,dragScale:1.1,turnRadiusScale:1.1,samples:120}
}};
controller.setCalibrationProfile(profile);
assert.equal(controller.vehicleId,'sedan');
assert.equal(controller.calibration.vehicleId,'sedan');
assert.ok(controller.physics.engineForce>baseSedan.engineForce);
assert.ok(controller.physics.steeringRate>baseSedan.steeringRate);
const sedanEngine=controller.physics.engineForce;
controller.setVehicle('truck');
assert.equal(controller.vehicleId,'truck');
assert.equal(controller.calibration.vehicleId,'truck');
const truckBase=controller.snapshot().typeProfile;
assert.ok(controller.physics.engineForce>0);
assert.notEqual(controller.physics.engineForce,sedanEngine);
controller.setVehicle('sedan');
assert.equal(controller.calibration.vehicleId,'sedan');
assert.equal(controller.physics.engineForce,sedanEngine);
controller.clearCalibration('sedan');
assert.equal(controller.calibration,null);
assert.equal(controller.physics.engineForce,baseSedan.engineForce);
controller.setVehicle('truck');
assert.equal(controller.calibration.vehicleId,'truck');
controller.clearAllCalibration();
assert.equal(controller.calibration,null);
assert.equal(controller.physics.engineForce,controller.snapshot().physics.engineForce);
console.log('TRANSPORT CALIBRATION SWITCH SMOKE: PASS');
