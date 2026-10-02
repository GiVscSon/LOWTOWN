import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';

const PORT='4175';
const VIEWPORT={width:1280,height:800};
const WARMUP_MS=1200;
const SAMPLE_FRAMES=40;
const ORDER=['round','butt','butt','round'];
const server=spawn('npx',['vite','--host','127.0.0.1','--port',PORT],{stdio:'inherit',shell:true});
const browser=await chromium.launch({headless:true});
mkdirSync('test-results',{recursive:true});
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));

async function waitForServer(){
  const url=`http://127.0.0.1:${PORT}/`;
  for(let attempt=0;attempt<80;attempt++){
    try{
      const response=await fetch(url,{signal:AbortSignal.timeout(1000)});
      if(response.ok)return;
    }catch{}
    await sleep(250);
  }
  throw new Error(`Vite did not become ready at ${url}`);
}

async function openVariant(mode,passIndex){
  const context=await browser.newContext({viewport:VIEWPORT,deviceScaleFactor:1});
  const page=await context.newPage();
  await page.addInitScript(()=>{
    let seed=0x1f2e3d4c;
    Math.random=()=>((seed=Math.imul(seed,1664525)+1013904223>>>0)/4294967296);
  });
  await page.goto(`http://127.0.0.1:${PORT}/?cityQA=1&perf=1&bridgeCaps=${mode}`,{waitUntil:'domcontentloaded',timeout:10000});
  await page.waitForFunction(()=>Boolean(window.__LOWTOWN_PERF__&&window.__lowtownCityQA)&&
    Number.isFinite(window.__lowtownLastFrame)&&performance.now()-window.__lowtownLastFrame<1200,null,{timeout:10000});
  const scene=await page.evaluate(()=>{
    const qa=window.__lowtownCityQA;
    qa.setWeather('clear');
    const bridge=qa.viewBridgeEntrance(0);
    window.__LOWTOWN_PERF__.reset();
    return bridge;
  });
  await page.waitForTimeout(WARMUP_MS);
  await page.evaluate(()=>window.__LOWTOWN_PERF__.reset());
  await page.waitForFunction(target=>window.__LOWTOWN_PERF__.summary().render.count>=target,SAMPLE_FRAMES,{timeout:30000});
  const result=await page.evaluate(()=>({
    perf:window.__LOWTOWN_PERF__.summary(),
    error:String(window.__lowtownLastError||''),
    frameAge:performance.now()-window.__lowtownLastFrame,
    viewport:{width:innerWidth,height:innerHeight}
  }));
  result.scene=scene;
  if(!passIndex||!ORDER.slice(0,passIndex).includes(mode))await page.screenshot({path:`test-results/bridge-caps-${mode}.png`,fullPage:true});
  assert.equal(result.error,'',`${mode}: runtime error: ${result.error}`);
  assert(result.frameAge<1200,`${mode}: frame loop stalled for ${result.frameAge.toFixed(1)} ms`);
  assert.equal(result.perf.bridgeCaps,mode);
  assert(result.perf.logic.count>=SAMPLE_FRAMES,`${mode}: too few logic samples: ${result.perf.logic.count}`);
  assert(result.perf.render.count>=SAMPLE_FRAMES,`${mode}: too few render samples: ${result.perf.render.count}`);
  await context.close();
  return {...result.perf,scene:result.scene};
}

const pct=(current,baseline)=>baseline?((current-baseline)/baseline)*100:0;
const average=values=>values.reduce((sum,value)=>sum+value,0)/Math.max(1,values.length);
const aggregate=passes=>({
  logic:{mean:average(passes.map(pass=>pass.logic.mean)),p95:average(passes.map(pass=>pass.logic.p95))},
  render:{mean:average(passes.map(pass=>pass.render.mean)),p95:average(passes.map(pass=>pass.render.p95))},
  frame:{mean:average(passes.map(pass=>pass.frame.mean)),p95:average(passes.map(pass=>pass.frame.p95))},
  renderPerLogic:average(passes.map(pass=>pass.render.mean/Math.max(.001,pass.logic.mean)))
});
try{
  await waitForServer();
  const passes=[];
  for(let index=0;index<ORDER.length;index++)passes.push({mode:ORDER[index],index,perf:await openVariant(ORDER[index],index)});
  const roundPasses=passes.filter(pass=>pass.mode==='round').map(pass=>pass.perf);
  const buttPasses=passes.filter(pass=>pass.mode==='butt').map(pass=>pass.perf);
  const round=aggregate(roundPasses),butt=aggregate(buttPasses);
  const report={
    viewport:VIEWPORT,warmupMs:WARMUP_MS,sampleFrames:SAMPLE_FRAMES,order:ORDER,passes,round,butt,
    deltaPercent:{
      logicMean:pct(butt.logic.mean,round.logic.mean),
      logicP95:pct(butt.logic.p95,round.logic.p95),
      renderMean:pct(butt.render.mean,round.render.mean),
      renderP95:pct(butt.render.p95,round.render.p95),
      frameMean:pct(butt.frame.mean,round.frame.mean),
      frameP95:pct(butt.frame.p95,round.frame.p95),
      renderPerLogic:pct(butt.renderPerLogic,round.renderPerLogic)
    }
  };
  writeFileSync('test-results/bridge-cap-benchmark.json',JSON.stringify(report,null,2));
  console.log('LOWTOWN BRIDGE CAP A/B ABBA',JSON.stringify(report,null,2));
} finally {
  await browser.close();
  server.kill('SIGTERM');
}
