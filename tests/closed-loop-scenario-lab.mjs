import { strict as assert } from 'node:assert';
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import { generateScenarios } from '../src/game/scenario_generator.js';
import { adaptScenario, scoreBlackBox } from '../src/game/scenario_feedback.js';
import { createBlackBox } from '../src/game/black_box.js';

const COUNT = Number(process.env.LOWTOWN_SCENARIOS || 20);
const RUN_MS = Number(process.env.LOWTOWN_SCENARIO_RUN_MS || 12000);
const SAMPLE_MS = 100;
const SEED = Number(process.env.LOWTOWN_SCENARIO_SEED || 20260913);
const ARTIFACT_DIR = 'scenario-lab-artifacts';

assert(Number.isInteger(COUNT) && COUNT > 0 && COUNT <= 100, 'scenario count must be 1..100');
await mkdir(ARTIFACT_DIR, { recursive: true });
const server = spawn('npx', ['vite', '--host', '127.0.0.1', '--port', '4173'], { stdio: 'inherit', shell: true });
const browser = await chromium.launch({ headless: true });
const results = [];
let scenario = null;

function sleep(ms){ return new Promise(r => setTimeout(r, ms)); }
async function openScenario(page, current){
  const encoded = encodeURIComponent(JSON.stringify(current));
  const url = `http://127.0.0.1:4173/?autotest&scenario=${encoded}`;
  for(let i=0;i<60;i++){
    try{ await page.goto(url,{waitUntil:'domcontentloaded',timeout:1000}); return; }
    catch(error){ if(i===59) throw error; await sleep(250); }
  }
}
function snapshot(page){
  return page.evaluate(() => {
    const test=window.__LOWTOWN_TEST,ai=window.__LOWTOWN_AI;
    if(!test||!ai)return null;
    const s=test.state(),a=ai.state||ai,p=a.prediction||{},sensor=a.sensor||{},dynamic=a.dynamic||{};
    return {t:performance.now(),game:{x:s.x,y:s.y,speed:Number.isFinite(s.speed)?s.speed:0,maxSpeed:Number.isFinite(s.maxSpeed)?s.maxSpeed:0,distance:Number.isFinite(s.distance)?s.distance:0,collisions:s.collisions||0,trafficHits:s.trafficHits||0,stuck:s.stuck||0,trafficCars:s.trafficCars||0,pedestrians:s.pedestrians||0},ai:{enabled:a.enabled,mode:a.mode,tactical:a.tactical,node:a.node,routeLength:Array.isArray(a.route)?a.route.length:0,replans:a.replans,recoveries:a.recoveries,safeStarts:a.safeStarts,crossTrack:a.crossTrack,curvature:a.curvature,headingError:a.headingError,targetSpeed:a.targetSpeed,decisions:a.decisions,overtakes:a.overtakes||0,nearMisses:a.nearMisses||0,collisionsAvoided:a.collisionsAvoided||0,control:a.control||null,prediction:{safe:p.safe,ttc:p.ttc,risk:p.risk},sensor:{front:sensor.front,frontLeft:sensor.frontLeft,frontRight:sensor.frontRight,left:sensor.left,right:sensor.right},nearest:dynamic.nearest&&dynamic.nearest.o?{x:dynamic.nearest.o.x,y:dynamic.nearest.o.y,v:dynamic.nearest.o.v}:null}};
  });
}
function enrichSpeed(sample,previous){
  if(!sample||!previous||Number(sample.game.speed)>0)return sample;
  const dt=Math.max(.001,(sample.t-previous.t)/1000),dx=sample.game.x-previous.game.x,dy=sample.game.y-previous.game.y;
  return {...sample,game:{...sample.game,speed:Math.hypot(dx,dy)/dt,speedSource:'position-delta'}};
}

try {
  const page=await browser.newPage({viewport:{width:1280,height:800}});
  const baseScenarios=generateScenarios({seed:SEED,count:COUNT});
  let previousReport=null;
  for(let i=0;i<baseScenarios.length;i++){
    scenario=i===0?baseScenarios[i]:adaptScenario(results[i-1].scenario,previousReport);
    scenario={...scenario,id:`CL${String(i+1).padStart(2,'0')}_${scenario.template}`,iteration:i+1};
    await openScenario(page,scenario);
    await page.waitForFunction(() => Boolean(window.__LOWTOWN_TEST&&window.__LOWTOWN_AI));
    const box=createBlackBox({capacity:900,eventCapacity:120}); box.start();
    const telemetry=[]; let previous=null; const started=Date.now();
    while(Date.now()-started<RUN_MS){
      const raw=await snapshot(page); if(raw){const s=enrichSpeed(raw,previous); const dt=previous?Math.max(0,(s.t-previous.t)/1000):SAMPLE_MS/1000; telemetry.push(s);box.sample(s,dt);previous=s;}
      await sleep(SAMPLE_MS);
    }
    const finalRaw=await snapshot(page); if(finalRaw){const final=enrichSpeed(finalRaw,previous); if(!previous||final.t>previous.t)box.sample(final,Math.max(0,(final.t-(previous?.t||final.t))/1000)); telemetry.push(final);}
    const blackBox=box.report({runMs:RUN_MS,scenario});
    const score=scoreBlackBox(blackBox);
    const last=telemetry.at(-1)||{};
    const completed=(last.game?.distance||0)>=Math.max(400,Number(scenario.expectedDistance||scenario.targetDistance)*.25);
    const row={scenario,score,completed,samples:telemetry.length,final:last.game?last:null,blackBox,priority:score.priority};
    results.push(row); previousReport=blackBox;
    console.log(`CLOSED LOOP ${i+1}/${COUNT}: ${scenario.template} score=${score.score} safety=${score.safety} findings=${score.priority.join(',')||'CLEAN'}`);
    await writeFile(`${ARTIFACT_DIR}/scenario-${String(i+1).padStart(2,'0')}.json`,JSON.stringify({row,telemetry},null,2));
  }
  const mean=results.reduce((s,r)=>s+r.score.score,0)/results.length;
  const summary={status:'PASS',seed:SEED,count:results.length,runMs:RUN_MS,meanScore:+mean.toFixed(2),completed:results.filter(r=>r.completed).length,completionRate:results.filter(r=>r.completed).length/results.length,results};
  await writeFile(`${ARTIFACT_DIR}/summary.json`,JSON.stringify(summary,null,2));
  assert(results.length===COUNT); assert(mean>=0&&mean<=100);
  console.log('LOWTOWN CLOSED-LOOP SCENARIO LAB: PASS');
  console.log(JSON.stringify({count:COUNT,meanScore:summary.meanScore,completionRate:summary.completionRate},null,2));
} catch(error) {
  const summary={status:'FAIL',seed:SEED,count:results.length,error:{message:error.message,stack:error.stack},results};
  await writeFile(`${ARTIFACT_DIR}/summary.json`,JSON.stringify(summary,null,2));
  console.error('LOWTOWN CLOSED-LOOP SCENARIO LAB: FAIL',error.stack||error);
  throw error;
} finally {
  await browser.close(); server.kill('SIGTERM');
}
