import { generateScenario, generateScenarios, scenarioSignature, scenarioTemplates } from '../src/game/scenario_generator.js';

const a=generateScenarios({seed:12345,count:1000});
const b=generateScenarios({seed:12345,count:1000});
const c=generateScenarios({seed:54321,count:1000});
if(a.length!==1000)throw new Error('generator count mismatch');
if(a.map(scenarioSignature).join('|')!==b.map(scenarioSignature).join('|'))throw new Error('generator is not deterministic');
if(a.map(scenarioSignature).join('|')===c.map(scenarioSignature).join('|'))throw new Error('different seeds produced identical suite');
if(new Set(a.map(s=>s.template)).size<8)throw new Error('scenario diversity too low');
for(const s of a){
  if(!(s.trafficDensity>=0&&s.trafficDensity<=1))throw new Error('traffic density out of range');
  if(!(s.pedestrianDensity>=0&&s.pedestrianDensity<=1))throw new Error('pedestrian density out of range');
  if(!(s.overtakingPressure>=0&&s.overtakingPressure<=1))throw new Error('overtaking pressure out of range');
  if(!(s.leadSpeed>0&&s.targetDistance>0&&s.obstacleTime>0))throw new Error('invalid positive parameter');
  if(!Number.isFinite(s.curvature)||s.curvature<0||s.curvature>1)throw new Error('curvature out of range');
}
const edge=generateScenario(7,999999);
if(!edge.id||!scenarioTemplates().length)throw new Error('generator API incomplete');
console.log(`SCENARIO_GENERATOR_OK count=${a.length} templates=${new Set(a.map(s=>s.template)).size} seed=12345`);
