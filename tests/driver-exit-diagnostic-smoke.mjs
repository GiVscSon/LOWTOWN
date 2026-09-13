import assert from 'node:assert/strict';
import { createDriverExitDiagnostic, DRIVER_EXIT_STATES } from '../src/game/driver_exit_diagnostic.js';

const healthy=createDriverExitDiagnostic({stallSeconds:1});
for(let i=0;i<10;i++)healthy.update(.1,{x:i+1,y:0,velocity:12,frameDistance:1,acceleration:2,controls:{throttle:1},actuator:{target:{throttle:1},applied:{throttle:1}}});
assert.equal(healthy.state.phase,DRIVER_EXIT_STATES.DRIVING);
assert.equal(healthy.state.physicsHealthy,true);

const stalled=createDriverExitDiagnostic({stallSeconds:1});
for(let i=0;i<10;i++)stalled.update(.1,{x:0,y:0,velocity:0,frameDistance:0,acceleration:0,controls:{throttle:1},actuator:{target:{throttle:1},applied:{throttle:1}}});
assert.equal(stalled.state.phase,DRIVER_EXIT_STATES.EXITING);
assert.equal(stalled.state.exitReason,'NO_ENGINE_RESPONSE');
stalled.exit({x:4,y:2,heading:1});
assert.equal(stalled.state.phase,DRIVER_EXIT_STATES.ON_FOOT);
assert.equal(stalled.state.driverX,4);
console.log('DRIVER EXIT DIAGNOSTIC: PASS HEALTHY MOTION + STALL DETECTION + ON-FOOT FALLBACK');
