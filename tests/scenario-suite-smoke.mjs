import { generateScenarios } from '../src/game/scenario_generator.js';
import { scoreRun, aggregateScenarioResults } from './scenario-lab.mjs';

const scenarios=generateScenarios({seed:20260913,count:1000});
const results=scenarios.map((s,i)=>scoreRun([
  {game:{x:0,y:0,speed:180,maxSpeed:420,distance:s.expectedDistance*.5,collisions:0,trafficHits:0,stuck:0,recoveries:s.recovery?1:0,crossTrack:18,prediction:{ttc:2.5,risk:.15},decisions:60,mode:'CRUISE'}},
  {game:{x:s.expectedDistance,y:0,speed:260,maxSpeed:420,distance:s.expectedDistance,collisions:0,trafficHits:0,stuck:0,recoveries:s.recovery?1:0,crossTrack:22,prediction:{ttc:2.2,risk:.1},decisions:120,mode:'CRUISE'}}
],[],s.expectedDistance));
const agg=aggregateScenarioResults(results);
if(results.length!==1000)throw new Error('scenario suite size mismatch');
if(!Number.isFinite(agg.score)||agg.score<=0)throw new Error('invalid aggregate score');
if(agg.completionRate<=0)throw new Error('scenario suite has no completed runs');
console.log(`SCENARIO_SUITE_OK count=${results.length} score=${agg.score.toFixed(1)} completion=${agg.completionRate.toFixed(3)}`);
