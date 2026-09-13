import assert from 'node:assert/strict';
import { generateScenarios } from '../src/game/scenario_generator.js';
import { runScenarioBatch, scoreBlackBox } from '../src/game/scenario_feedback.js';

function syntheticReport(i){
  const hard=i%17===0?7:0;
  const traffic=i%11===0?2:0;
  const corridor=i%13===0?2:0;
  return {summary:{distance:900+(i%9)*180,collisions:0,trafficHits:traffic,nearMisses:traffic*2,overtakes:i%7===0?1:0,recoveries:i%19===0?4:0,corridorRecoveries:corridor,hardBrakes:hard,steeringSpikes:i%23===0?12:0,decisions:300},findings:[...(traffic?[{code:'TRAFFIC_CONTACT'}]:[]),...(corridor?[{code:'CORRIDOR_RECOVERY_LOAD'}]:[])]};
}
for(const count of [20,50,100,1000]){
  const scenarios=generateScenarios({seed:20260913,count});
  const reports=scenarios.map((_,i)=>syntheticReport(i));
  const batch=runScenarioBatch(scenarios,reports);
  assert.equal(batch.count,count);
  assert.ok(batch.meanScore>=0&&batch.meanScore<=100);
  assert.ok(batch.rows.every(r=>r.adapted.feedbackVersion===1));
}
const clean=scoreBlackBox({summary:{distance:2000,collisions:0,trafficHits:0,recoveries:0,corridorRecoveries:0,hardBrakes:0,steeringSpikes:0,decisions:500},findings:[]});
const risky=scoreBlackBox({summary:{distance:800,collisions:2,trafficHits:3,recoveries:4,corridorRecoveries:3,hardBrakes:8,steeringSpikes:14,decisions:20},findings:[{code:'WALL_CONTACT'},{code:'TRAFFIC_CONTACT'},{code:'LATE_AVOIDANCE'}]});
assert.ok(clean.score>risky.score);
assert.ok(risky.priority[0]==='WALL_CONTACT'||risky.priority[0]==='TRAFFIC_CONTACT');
console.log('SCENARIO FEEDBACK SMOKE: PASS 20/50/100/1000');
