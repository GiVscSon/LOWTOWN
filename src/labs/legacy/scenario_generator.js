const BASE = [
  ['FREE_ROAM', { trafficDensity:[.2,.7], leadSpeed:[80,320], obstacleTime:[2,12], curvature:[0,.45], targetDistance:[600,2400], spawnOffset:[-80,80], pedestrianDensity:[.1,.7], overtakingPressure:[0,.5], recovery:false }],
  ['SLOW_LEAD', { trafficDensity:[.25,.75], leadSpeed:[35,140], obstacleTime:[3,10], curvature:[0,.35], targetDistance:[500,1800], spawnOffset:[-40,40], pedestrianDensity:[.1,.6], overtakingPressure:[.2,.8], recovery:false }],
  ['DENSE_TRAFFIC', { trafficDensity:[.7,1], leadSpeed:[60,260], obstacleTime:[2,8], curvature:[0,.55], targetDistance:[500,2200], spawnOffset:[-70,70], pedestrianDensity:[.3,1], overtakingPressure:[.3,1], recovery:false }],
  ['SUDDEN_BLOCK', { trafficDensity:[.3,.8], leadSpeed:[80,280], obstacleTime:[.5,4], curvature:[0,.6], targetDistance:[700,2200], spawnOffset:[-100,100], pedestrianDensity:[.2,.8], overtakingPressure:[.1,.8], recovery:false }],
  ['HIGH_SPEED_CORNER', { trafficDensity:[.1,.6], leadSpeed:[100,340], obstacleTime:[3,12], curvature:[.45,.9], targetDistance:[700,2600], spawnOffset:[-60,60], pedestrianDensity:[.05,.5], overtakingPressure:[0,.6], recovery:false }],
  ['OVERTAKE', { trafficDensity:[.4,.9], leadSpeed:[45,180], obstacleTime:[3,10], curvature:[0,.4], targetDistance:[800,2400], spawnOffset:[-100,100], pedestrianDensity:[.1,.6], overtakingPressure:[.6,1], recovery:false }],
  ['BAD_OVERTAKE', { trafficDensity:[.65,1], leadSpeed:[50,190], obstacleTime:[1,6], curvature:[.2,.7], targetDistance:[700,2200], spawnOffset:[-120,120], pedestrianDensity:[.3,.9], overtakingPressure:[.8,1], recovery:false }],
  ['DEAD_END', { trafficDensity:[.2,.7], leadSpeed:[60,260], obstacleTime:[2,10], curvature:[.1,.7], targetDistance:[500,1800], spawnOffset:[-80,80], pedestrianDensity:[.1,.7], overtakingPressure:[.1,.7], recovery:true }],
  ['LOST_ROUTE', { trafficDensity:[.1,.8], leadSpeed:[50,300], obstacleTime:[2,10], curvature:[.1,.8], targetDistance:[900,2800], spawnOffset:[-150,150], pedestrianDensity:[.1,.8], overtakingPressure:[.1,.8], recovery:true }],
  ['POST_RECOVERY', { trafficDensity:[.2,.8], leadSpeed:[60,300], obstacleTime:[2,10], curvature:[0,.7], targetDistance:[700,2300], spawnOffset:[-80,80], pedestrianDensity:[.1,.8], overtakingPressure:[.2,.8], recovery:true }],
  ['PEDESTRIAN', { trafficDensity:[.2,.7], leadSpeed:[70,280], obstacleTime:[2,9], curvature:[0,.55], targetDistance:[600,2200], spawnOffset:[-80,80], pedestrianDensity:[.65,1], overtakingPressure:[.1,.7], recovery:false }],
  ['LONG_TRIP', { trafficDensity:[.2,.8], leadSpeed:[70,320], obstacleTime:[3,14], curvature:[0,.75], targetDistance:[1800,5000], spawnOffset:[-150,150], pedestrianDensity:[.1,.8], overtakingPressure:[.1,.8], recovery:false }]
];

const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
function rng(seed){let s=(seed>>>0)||1;return()=>{s=(Math.imul(s,1664525)+1013904223)>>>0;return s/4294967296;};}
function between(r,[a,b]){return a+(b-a)*r();}
function int(r,[a,b]){return Math.round(between(r,[a,b]));}
function make(id,template,params,seed,index){return {id:`${template}_${index+1}`,template,seed,trafficDensity:+clamp(params.trafficDensity,0,1).toFixed(4),leadSpeed:Math.round(params.leadSpeed),obstacleTime:+params.obstacleTime.toFixed(3),curvature:+params.curvature.toFixed(4),targetDistance:Math.round(params.targetDistance),spawnOffset:Math.round(params.spawnOffset),pedestrianDensity:+clamp(params.pedestrianDensity,0,1).toFixed(4),overtakingPressure:+clamp(params.overtakingPressure,0,1).toFixed(4),recovery:!!params.recovery,expectedDistance:Math.round(params.targetDistance),version:1};}
export function generateScenario(seed=1,index=0){const r=rng((seed>>>0)^Math.imul(index+1,0x9e3779b1));const [template,range]=BASE[Math.floor(r()*BASE.length)];return make(index,template,{trafficDensity:between(r,range.trafficDensity),leadSpeed:between(r,range.leadSpeed),obstacleTime:between(r,range.obstacleTime),curvature:between(r,range.curvature),targetDistance:between(r,range.targetDistance),spawnOffset:between(r,range.spawnOffset),pedestrianDensity:between(r,range.pedestrianDensity),overtakingPressure:between(r,range.overtakingPressure),recovery:range.recovery},seed,index);}
export function generateScenarios({seed=1,count=1000,startIndex=0}={}){if(!Number.isInteger(count)||count<1)throw new Error('count must be a positive integer');if(count>100000)throw new Error('count exceeds safety limit');return Array.from({length:count},(_,i)=>generateScenario(seed,startIndex+i));}
export function scenarioSignature(s){return JSON.stringify(s);}
export function scenarioTemplates(){return BASE.map(([name])=>name);}
