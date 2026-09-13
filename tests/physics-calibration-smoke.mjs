import assert from 'node:assert/strict';
import { buildPhysicsErrorProfile, applyPhysicsCalibration, mergeCalibrationProfiles } from '../src/game/physics_calibration.js';

const report={vehicles:{sedan:{samples:120,meanAccelerationError:3.2,meanSteeringError:.4,speedLimitViolations:0},truck:{samples:240,meanAccelerationError:-6,meanSteeringError:-1.2,speedLimitViolations:2}}};
const profile=buildPhysicsErrorProfile(report);
assert.equal(profile.version,1);
assert.ok(profile.vehicles.sedan);
assert.ok(profile.vehicles.truck);
assert.equal(profile.vehicles.sedan.confidence,1);
const adjusted=applyPhysicsCalibration({vehicleId:'truck',throttle:1,steer:.5},profile);
assert.equal(adjusted.calibrationApplied,true);
assert.ok(adjusted.throttle<=1);
assert.ok(adjusted.steer<=.5);
const merged=mergeCalibrationProfiles({vehicles:{sedan:{confidence:.2}}},profile);
assert.ok(merged.vehicles.sedan&&merged.vehicles.truck);
console.log('PHYSICS CALIBRATION SMOKE: PASS');
