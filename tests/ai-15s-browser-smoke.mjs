import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';

const RUN_MS=18000;
const HARD_TIMEOUT_MS=35000;
const SAMPLE_LOG_MS=1000;
const server=spawn('npx',['vite','--host','127.0.0.1','--port','4173'],{stdio:'inherit',shell:true});
const browser=await chromium.launch({headless:true});
const page=await browser.newPage({viewport:{width:1280,height:800}});
let failure=null;
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const hardTimeout=setTimeout(()=>{
  console.error(`AI capture hard timeout after ${HARD_TIMEOUT_MS}ms`);
  process.exitCode=1;
  server.kill('SIGTERM');
  browser.close().catch(()=>{});
},HARD_TIMEOUT_MS);
try{
  for(let i=0;i<60;i++){
    try{await page.goto('http://127.0.0.1:4173/?autotest&aiTest',{waitUntil:'domcontentloaded',timeout:1000});break;}
    catch(e){if(i===59)throw e;await sleep(250);}
  }
  await page.waitForFunction(()=>Boolean(window.__LOWTOWN_TEST&&window.__LOWTOWN_AI),null,{timeout:5000});
  const telemetry=await page.evaluate(async runMs=>{
    const samples=[];
    const started=performance.now();
    let lastLog=started;
    return await new Promise((resolve,reject)=>{
      const timeout=setTimeout(()=>reject(new Error(`browser capture timeout after ${runMs+5000}ms`)),runMs+5000);
      function sample(t){
        try{
          const s=window.__LOWTOWN_TEST.state(),a=window.__LOWTOWN_AI.state;
          samples.push({t,x:s.x,y:s.y,speed:s.speed,maxSpeed:s.maxSpeed,mode:a.mode,control:{...a.control},prediction:{...a.prediction}});
          if(t-lastLog>=1000){
            console.log('AI SAMPLE',JSON.stringify({elapsedMs:Math.round(t-started),frames:samples.length,x:Number(s.x).toFixed(1),y:Number(s.y).toFixed(1),speed:Number(s.speed).toFixed(1),mode:a.mode}));
            lastLog=t;
          }
          if(t-started>=runMs){clearTimeout(timeout);resolve(samples);return;}
          requestAnimationFrame(sample);
        }catch(err){clearTimeout(timeout);reject(err);}
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
finally{clearTimeout(hardTimeout);await browser.close();server.kill('SIGTERM');if(failure)console.error('AI capture ended with failure.');}
