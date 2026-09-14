import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';

const RUN_MS=18000;
const server=spawn('npx',['vite','--host','127.0.0.1','--port','4173'],{stdio:'inherit',shell:true});
const browser=await chromium.launch({headless:true});
const page=await browser.newPage({viewport:{width:1280,height:800}});
let failure=null;
try{
  for(let i=0;i<60;i++){
    try{await page.goto('http://127.0.0.1:4173/?autotest&aiTest',{waitUntil:'domcontentloaded',timeout:1000});break;}
    catch(e){if(i===59)throw e;await new Promise(r=>setTimeout(r,250));}
  }
  await page.waitForFunction(()=>Boolean(window.__LOWTOWN_TEST&&window.__LOWTOWN_AI));
  const telemetry=await page.evaluate(async runMs=>{
    const samples=[];
    const started=performance.now();
    return await new Promise(resolve=>{
      function sample(t){
        const s=window.__LOWTOWN_TEST.state(),a=window.__LOWTOWN_AI.state;
        samples.push({t,x:s.x,y:s.y,speed:s.speed,maxSpeed:s.maxSpeed,mode:a.mode,control:{...a.control},prediction:{...a.prediction},positionDelta:a.control?null:null});
        if(t-started>=runMs)resolve(samples);else requestAnimationFrame(sample);
      }
      requestAnimationFrame(sample);
    });
  },RUN_MS);
  assert.ok(telemetry.length>500,`expected frame-level telemetry, got ${telemetry.length}`);
  const first=telemetry[0],last=telemetry.at(-1);
  const maxSpeed=Math.max(...telemetry.map(x=>Number(x.speed)||0));
  const moved=Math.hypot(last.x-first.x,last.y-first.y);
  const nonzeroFrames=telemetry.filter(x=>(Number(x.speed)||0)>20).length;
  assert.ok(maxSpeed>80,`AI never reached cruising speed: ${maxSpeed.toFixed(1)}`);
  assert.ok(nonzeroFrames>300,`AI speed was only briefly nonzero: ${nonzeroFrames} frames`);
  assert.ok(moved>500,`AI position barely moved: ${moved.toFixed(1)}`);
  const commandFrames=telemetry.filter(x=>Number.isFinite(x.control?.throttle)||Number.isFinite(x.control?.steer));
  assert.ok(commandFrames.length>300,`missing AI command telemetry: ${commandFrames.length}`);
  console.log('LOWTOWN AI 15S BROWSER CAPTURE: PASS',JSON.stringify({runMs:RUN_MS,frames:telemetry.length,maxSpeed,moved,nonzeroFrames,commandFrames:commandFrames.length}));
}catch(e){failure=e;console.error('LOWTOWN AI 15S BROWSER CAPTURE: FAIL',e.stack||e);throw e;}
finally{await browser.close();server.kill('SIGTERM');if(failure)console.error('AI capture ended with failure.');}
