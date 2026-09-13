import assert from 'node:assert/strict';
import { createTrajectoryLab } from '../src/game/trajectory_lab.js';
import { createCorridorGuardian } from '../src/game/corridor_guardian.js';
import { createAISafetyLayer } from '../src/game/ai_safety_layer.js';

const simulate=(car,horizon,steer,throttle,brake)=>({safe:true,collisionT:horizon,x:car.x,y:car.y,minWall:100,speed:Math.max(0,(car.vx||0)+throttle*40-brake*80)});
const trafficRisk=()=>({risk:0,minTtc:Infinity});
const lab=createTrajectoryLab({simulate,trafficRisk});
const guardian=createCorridorGuardian();
const safety=createAISafetyLayer();

const cases=[
  {speed:10,expected:.72},
  {speed:40,expected:.65},
  {speed:60,expected:.58},
  {speed:90,expected:.35}
];
for(const c of cases){
  const candidates=lab.buildCandidates({headingError:-2.7,curvature:Math.PI,speed:c.speed});
  assert.equal(candidates[0].throttle,c.expected,`wrong turn throttle at ${c.speed}`);
  assert.equal(candidates[0].brake,0);
  assert.ok(candidates[0].steer<0);

  const guarded=guardian.apply(candidates[0],{crossTrack:130,headingError:-2.7,mode:'TURN_AROUND'});
  assert.ok(guarded.throttle<=.56,`guardian failed to cap turn at ${c.speed}`);
  assert.equal(guarded.brake,0);
  assert.ok(guarded.steer<0);

  const sanitized=safety.sanitizeControl(guarded,c.speed);
  assert.ok(sanitized.throttle>=0&&sanitized.throttle<=1);
  assert.ok(sanitized.brake>=0&&sanitized.brake<=1);
  assert.ok(sanitized.steer>=-1&&sanitized.steer<=1);
}

const recovery=guardian.apply({steer:.1,throttle:1,brake:0},{crossTrack:150,headingError:0,mode:'CRUISE'});
assert.equal(guardian.state.mode,'CORRIDOR_RECOVERY');
assert.ok(recovery.throttle<=.34);
assert.ok(recovery.brake>=.28);

const prediction=safety.validatePrediction({safe:true,risk:0.9,ttc:1.1});
assert.equal(prediction.safe,true);
assert.equal(prediction.urgent,true);
const danger=safety.validatePrediction({safe:false,risk:1.4,ttc:0.5});
assert.equal(danger.safe,false);
assert.equal(danger.urgent,true);

console.log('TURN ARBITRATION SMOKE: PASS',JSON.stringify({bands:cases.map(c=>[c.speed,c.expected]),guardian:guardian.status(),safety:safety.status()}));
