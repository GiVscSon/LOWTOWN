import { strict as assert } from 'node:assert';
import { SCENARIOS, scoreRun, aggregateScenarioResults } from './scenario-lab.mjs';

const results=SCENARIOS.map((scenario,i)=>scoreRun(
  Array.from({length:12},(_,k)=>({
    speed:180+i*8+k*2,
    distance:120+i*85+k*35,
    crossTrack:25+(i%4)*18,
    ttc:i===6?.8:2.8,
    decisions:120+k*8
  })),
  {collisions:i===6?1:0,trafficHits:i%5===0?1:0,nearMisses:i%4===0?3:0,recoveries:i%3===0?1:0,stuck:i===7?1:0},
  600+scenario.risk*30
));
const report=aggregateScenarioResults(results.map((r,i)=>({...r,id:SCENARIOS[i].id,completed:r.distance>400})));
assert.equal(results.length,SCENARIOS.length);
assert(report.score>=0&&report.score<=100);
assert(report.completionRate>=0&&report.completionRate<=1);
console.log('LOWTOWN BENCHMARK PASS');
console.log(JSON.stringify(report,null,2));
