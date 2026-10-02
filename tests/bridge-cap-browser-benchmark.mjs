import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';

const PORT='4175';
const VIEWPORT={width:1280,height:800};
const WARMUP_MS=1500;
const SAMPLE_MS=4500;
const server=spawn('npx',['vite','--host','127.0.0.1','--port',PORT],{stdio:'inherit',shell:true});
const browser=await chromium.launch({headless:true});
mkdirSync('test-results',{recursive:true});

async function openVariant(mode){
  const context=await browser.newContext({viewport:VIEWPORT,deviceScaleFactor:1});
  const page=await context.newPage();
  await page.addInitScript(()=>{
    let seed=0x1f2e3d4c;
    Math.random=()=>((seed=Math.imul(seed,1664525)+1013904223>>>0)/4294967296);
  });
  for(let attempt=0;attempt<60;attempt++){
    try{
      await page.goto(`http://127.0.0.1:${PORT}/?cityQA=1&perf=1&bridgeCaps=${mode}`,{waitUntil:'domcontentloaded',timeout:1000});
      break;
    }catch(error){
      if(attempt===59)throw error;
      await new Promise(resolve=>setTimeout(resolve,250));
    }
  }
  await page.waitForFunction(()=>Boolean(window.__LOWTOWN_PERF__&&window.__lowtownCityQA)&&
    Number.isFinite(window.__lowtownLastFrame)&&performance.now()-window.__lowtownLastFrame<1200,null,{timeout:10000});
  await page.evaluate(()=>{
    const qa=window.__lowtownCityQA,snapshot=qa.snapshot();
    qa.setWeather('clear');
    qa.viewStreet(snapshot.player.x,snapshot.player.y);
    window.__LOWTOWN_PERF__.reset();
  });
  await page.waitForTimeout(WARMUP_MS);
  await page.evaluate(()=>window.__LOWTOWN_PERF__.reset());
  await page.waitForTimeout(SAMPLE_MS);
  const result=await page.evaluate(()=>({
    perf:window.__LOWTOWN_PERF__.summary(),
    error:String(window.__lowtownLastError||''),
    frameAge:performance.now()-window.__lowtownLastFrame,
    viewport:{width:innerWidth,height:innerHeight}
  }));
  await page.screenshot({path:`test-results/bridge-caps-${mode}.png`,fullPage:true});
  assert.equal(result.error,'',`${mode}: runtime error: ${result.error}`);
  assert(result.frameAge<1200,`${mode}: frame loop stalled for ${result.frameAge.toFixed(1)} ms`);
  assert.equal(result.perf.bridgeCaps,mode);
  assert(result.perf.logic.count>=120,`${mode}: too few logic samples: ${result.perf.logic.count}`);
  assert(result.perf.render.count>=120,`${mode}: too few render samples: ${result.perf.render.count}`);
  await context.close();
  return result.perf;
}

const pct=(current,baseline)=>baseline?((current-baseline)/baseline)*100:0;
try{
  const round=await openVariant('round');
  const butt=await openVariant('butt');
  const report={
    viewport:VIEWPORT,warmupMs:WARMUP_MS,sampleMs:SAMPLE_MS,
    round,butt,
    deltaPercent:{
      logicMean:pct(butt.logic.mean,round.logic.mean),
      logicP95:pct(butt.logic.p95,round.logic.p95),
      renderMean:pct(butt.render.mean,round.render.mean),
      renderP95:pct(butt.render.p95,round.render.p95),
      frameMean:pct(butt.frame.mean,round.frame.mean),
      frameP95:pct(butt.frame.p95,round.frame.p95)
    }
  };
  writeFileSync('test-results/bridge-cap-benchmark.json',JSON.stringify(report,null,2));
  console.log('LOWTOWN BRIDGE CAP A/B',JSON.stringify(report,null,2));
} finally {
  await browser.close();
  server.kill('SIGTERM');
}
