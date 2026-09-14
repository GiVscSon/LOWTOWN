import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { destinationPoint } from '../src/game/city_semantics.js';

const RUN_MS=30000;
const server=spawn('npx',['vite','--host','127.0.0.1','--port','4173'],{stdio:'inherit',shell:true});
const browser=await chromium.launch({headless:true});
const page=await browser.newPage({viewport:{width:1280,height:800}});
try{
  for(let i=0;i<60;i++){
    try{await page.goto('http://127.0.0.1:4173/?autotest&aiTest',{waitUntil:'domcontentloaded',timeout:1000});break;}
    catch(e){if(i===59)throw e;await new Promise(r=>setTimeout(r,250));}
  }
  await page.waitForFunction(()=>Boolean(window.__LOWTOWN_TEST));
  const target=destinationPoint('MARKET_HALL');
  const trace=await page.evaluate(async runMs=>{
    const out=[];const started=performance.now();
    return await new Promise(resolve=>{
      function sample(t){
        const s=window.__LOWTOWN_TEST.state();
        out.push({t,x:s.x,y:s.y,d:s.objectiveDistance,money:s.money,reward:s.missionReward,complete:s.missionComplete,trace:s.objectiveTrace.length});
        if(s.missionComplete||t-started>=runMs)resolve(out);else setTimeout(()=>requestAnimationFrame(sample),50);
      }
      requestAnimationFrame(sample);
    });
  },RUN_MS);
  assert.ok(trace.length>20,'gameplay browser trace is empty');
  const expected=trace.map(s=>({ ...s, expectedDistance:Math.hypot(s.x-target.x,s.y-target.y) }));
  const distanceError=Math.max(...expected.map(s=>Math.abs(s.d-s.expectedDistance)));
  assert.ok(distanceError<=1.1,`DIST is not live straight-line distance: max error ${distanceError.toFixed(2)}`);
  const completed=expected.find(s=>s.complete);
  assert.ok(completed,'automated car did not reach the DROP objective');
  assert.equal(completed.reward,250,'Job 1 payout must be $250');
  assert.ok(completed.money>=250,`money HUD state did not receive payout: $${completed.money}`);
  const decreasing=expected.reduce((run,s,i)=>i&&s.d<expected[i-1].d?run+1:0,0);
  assert.ok(decreasing>=10,`DIST did not show a sustained decreasing approach: ${decreasing} consecutive frames`);
  const finalText=await page.locator('#toast').textContent();
  assert.match(finalText||'',/\+\$250|JOB COMPLETE/,'completion toast did not expose the payout');
  console.log('LOWTOWN GAMEPLAY BROWSER ACCEPTANCE: PASS',JSON.stringify({samples:expected.length,distanceError,finalMoney:completed.money,reward:completed.reward,decreasing}));
}catch(e){console.error('LOWTOWN GAMEPLAY BROWSER ACCEPTANCE: FAIL',e.stack||e);throw e;}
finally{await browser.close();server.kill('SIGTERM');}
