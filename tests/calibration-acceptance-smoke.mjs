import assert from 'node:assert/strict';
import { acceptCalibration } from '../src/game/calibration_acceptance.js';

const before=[];const after=[];
for(let i=0;i<40;i++){
  before.push({accelerationError:2,steeringError:1,brakingError:.5,turnRadiusError:.4,speedLimitViolation:0});
  after.push({accelerationError:1,steeringError:1,brakingError:.5,turnRadiusError:.4,speedLimitViolation:0});
}
assert(acceptCalibration(before,after).accepted);
const bad=after.map(v=>({...v,steeringError:1.5}));
assert(!acceptCalibration(before,bad).accepted);
const unsafe=after.map(v=>({...v,speedLimitViolation:1}));
assert(!acceptCalibration(before,unsafe).accepted);
console.log('CALIBRATION ACCEPTANCE: PASS MULTI-METRIC SAFETY GATE');
