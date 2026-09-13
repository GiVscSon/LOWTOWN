import { strict as assert } from 'node:assert';

const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const dist=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);

export const SCENARIOS=[
  {id:'S01_FREE_ROAM',name:'Free roam',risk:1},
  {id:'S02_SLOW_LEAD',name:'Slow vehicle ahead',risk:2},
  {id:'S03_DENSE_TRAFFIC',name:'Dense traffic',risk:4},
  {id:'S04_SUDDEN_BLOCK',name:'Sudden obstacle',risk:5},
  {id:'S05_HIGH_SPEED_CORNER',name:'High speed corner',risk:4},
  {id:'S06_OVERTAKE',name:'Safe overtaking opportunity',risk:4},
  {id:'S07_BAD_OVERTAKE',name:'Unsafe overtaking opportunity',risk:6},
  {id:'S08_DEAD_END',name:'Dead end recovery',risk:5},
  {id:'S09_LOST_ROUTE',name:'Route loss',risk:5},
  {id:'S10_POST_RECOVERY',name:'Post recovery stabilization',risk:4},
  {id:'S11_PEDESTRIAN',name:'Pedestrian conflict',risk:6},
  {id:'S12_LONG_TRIP',name:'Long autonomous trip',risk:3}
];

export function scoreRun(samples=[],events={},expectedDistance=1000){
  const n=Math.max(1,samples.length);
  const maxSpeed=Math.max(0,...samples.map(s=>Number(s.speed)||0));
  const distance=Math.max(0,...samples.map(s=>Number(s.distance)||0));
  const maxCrossTrack=Math.max(0,...samples.map(s=>Math.abs(Number(s.crossTrack)||0)));
  const minTtc=samples.reduce((m,s)=>Math.min(m,Number.isFinite(Number(s.ttc))?Number(s.ttc):m),Infinity);
  const decisions=Math.max(0,...samples.map(s=>Number(s.decisions)||0));
  const collisions=Number(events.collisions)||0;
  const trafficHits=Number(events.trafficHits)||0;
  const recoveries=Number(events.recoveries)||0;
  const stuck=Number(events.stuck)||0;
  const nearMisses=Math.max(0,Number(events.nearMisses)||0);
  const progress=clamp(distance/expectedDistance,0,1);
  const safety=clamp(1-collisions*.18-trafficHits*.12-nearMisses*.008,0,1);
  const stability=clamp(1-Math.max(0,maxCrossTrack-55)/180,0,1);
  const decisiveness=clamp(decisions/n/8,0,1);
  const recovery=clamp(1-stuck*.18+recoveries*.03,0,1);
  const prediction=clamp(minTtc===Infinity?1:minTtc<.7?.25:minTtc<1.2?.55:minTtc<2?.8:1,0,1);
  const speed=clamp(maxSpeed/400,0,1);
  const score=Math.round(100*(progress*.27+safety*.30+stability*.16+decisiveness*.07+recovery*.08+prediction*.07+speed*.05));
  return {score,progress,safety,stability,decisiveness,recovery,prediction,speed,maxSpeed,distance,maxCrossTrack,minTtc,collisions,trafficHits,recoveries,stuck,nearMisses};
}

export function aggregateScenarioResults(results=[]){
  const total=Math.max(1,results.length);
  const avg=k=>results.reduce((s,r)=>s+(Number(r[k])||0),0)/total;
  const completed=results.filter(r=>r.completed).length;
  const safety=avg('safety');
  const stability=avg('stability');
  const score=Math.round(results.reduce((s,r)=>s+(Number(r.score)||0),0)/total);
  return {score,completed,total,completionRate:completed/total,safety,stability,weakest:results.slice().sort((a,b)=>(a.score||0)-(b.score||0)).slice(0,3).map(r=>r.id)};
}

function selfTest(){
  const clean=scoreRun([{speed:300,distance:1000,crossTrack:20,ttc:4,decisions:200}],{collisions:0,trafficHits:0,nearMisses:0},1000);
  const bad=scoreRun([{speed:100,distance:300,crossTrack:230,ttc:.4,decisions:20}],{collisions:2,trafficHits:4,nearMisses:20,stuck:2},1000);
  assert(clean.score>bad.score);
  assert(clean.safety>bad.safety);
  const a=aggregateScenarioResults([{id:'S01',score:90,safety:1,stability:1,completed:true},{id:'S02',score:50,safety:.5,stability:.5,completed:false}]);
  assert.equal(a.completed,1);
  assert(a.score>0);
  console.log('LOWTOWN SCENARIO LAB PASS',JSON.stringify({clean,bad,aggregate:a},null,2));
}

if (process.argv[1] && process.argv[1].endsWith('scenario-lab.mjs')) selfTest();
