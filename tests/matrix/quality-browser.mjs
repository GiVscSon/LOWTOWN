import assert from 'node:assert/strict';
import {mkdirSync,writeFileSync} from 'node:fs';
import {spawn} from 'node:child_process';
import {chromium} from 'playwright';
const origin='http://127.0.0.1:4197/',directory='artifacts/quality-matrix',errors=[],report={devices:[]};mkdirSync(directory,{recursive:true});
const server=spawn(process.execPath,['node_modules/vite/bin/vite.js','preview','--host','127.0.0.1','--port','4197','--strictPort'],{stdio:'ignore'});let browser;
try{
 for(let i=0;i<80;i++){try{if((await fetch(origin)).ok)break;}catch{}await new Promise(r=>setTimeout(r,250));}
 browser=await chromium.launch({headless:true,executablePath:process.env.LOWTOWN_CHROMIUM||undefined});
 for(const device of [{name:'desktop',viewport:{width:1280,height:800},deviceScaleFactor:1},{name:'mobile',viewport:{width:390,height:844},deviceScaleFactor:2}]){
  const context=await browser.newContext(device),page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
  await page.goto(origin+'?cityQA=1',{waitUntil:'domcontentloaded'});await page.waitForFunction(()=>window.__lowtownThreeStats?.frames>=5,null,{timeout:60000});
  const initial=await page.evaluate(()=>window.__lowtownThreeStats);assert.equal(initial.graphics.lighting,'detailed');assert.equal(initial.resolution.ratio,1.5);assert.equal(initial.lowCostMaterials,false);
  assert.equal(initial.resolution.width,Math.floor(device.viewport.width*1.5));assert(initial.streetFurniture.lights>=100);assert(initial.streetFurniture.signals>0);
  await page.screenshot({path:`${directory}/${device.name}-full.png`});
  const frames=await page.evaluate(async()=>{
    const output=[];let previous=window.__lowtownThreeStats.frames;
    while(output.length<24){await new Promise(requestAnimationFrame);const s=window.__lowtownThreeStats;if(s.frames!==previous){output.push({time:performance.now(),render:s.renderCpuMs,calls:s.drawCalls,triangles:s.triangles,resizes:s.resolution.resizes});previous=s.frames;}}
    return output;
  });assert.equal(new Set(frames.map(s=>s.resizes)).size,1,'stable viewport reallocated its framebuffer');
  await page.evaluate(()=>{window.__lowtownCityQA.setWeather('rain',true);window.__lowtownCityQA.advanceScene(.1);});
  await page.screenshot({path:`${directory}/${device.name}-rain.png`});
  await page.locator('#btnMenu').click();await page.locator('[data-menu-page=settings]').click();
  for(const resolution of ['.75','1','1.25','1.5','2']){
    await page.locator('#menuResolution').selectOption(String(Number(resolution)));
    const stats=await page.evaluate(()=>window.__lowtownThreeStats);assert.equal(stats.resolution.ratio,Number(resolution));assert.equal(stats.resolution.width,Math.floor(device.viewport.width*Number(resolution)));
  }
  await page.locator('#menuResolution').selectOption('1.25');await page.locator('#menuFps').selectOption('30');await page.locator('#menuLighting').selectOption('simple');
  assert.equal((await page.evaluate(()=>window.__lowtownThreeStats)).lowCostMaterials,true);await page.reload({waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>window.__lowtownThreeStats?.frames>=5,null,{timeout:60000});const saved=await page.evaluate(()=>window.__lowtownThreeStats);assert.equal(saved.resolution.ratio,1.25);assert.equal(saved.graphics.fps,30);assert.equal(saved.graphics.lighting,'simple');
  await page.locator('#btnMenu').click();await page.locator('[data-menu-page=settings]').click();await page.locator('#menuGraphicsPreset').selectOption('high');assert.equal((await page.evaluate(()=>window.__lowtownThreeStats)).lowCostMaterials,false);await page.locator('#menuClose').click();
  await page.evaluate(()=>window.__lowtownCityQA.collisionScene('car',true));await page.keyboard.press('KeyE');assert.equal((await page.evaluate(()=>window.__lowtownCityQA.snapshot())).player.mode,'sedan');
  await page.screenshot({path:`${directory}/${device.name}-entry.png`});await page.keyboard.press('KeyE');assert.equal((await page.evaluate(()=>window.__lowtownCityQA.snapshot())).player.mode,'foot');
  await page.evaluate(()=>window.__lowtownCityQA.advanceScene(.1));await page.screenshot({path:`${directory}/${device.name}-exit.png`});
  await page.evaluate(()=>window.__lowtownCityQA.viewBridgeSpan(0,.5,true,true));assert((await page.evaluate(()=>window.__lowtownThreeStats)).player.groundElevation>40);await page.screenshot({path:`${directory}/${device.name}-bridge.png`});
  const box=await page.locator('#btnMenu').boundingBox();assert(box.x>=0&&box.x+box.width<=device.viewport.width+1&&box.height>=44);
  const renderTimes=frames.map(s=>s.render).sort((a,b)=>a-b);report.devices.push({device,initial,saved,measuredFullScene:{software:initial.software,frames:frames.length,fps:(frames.length-1)*1000/(frames.at(-1).time-frames[0].time),renderMedianMs:renderTimes[Math.floor(renderTimes.length/2)],renderP95Ms:renderTimes[Math.floor(renderTimes.length*.95)],drawCalls:frames.at(-1).calls,triangles:frames.at(-1).triangles,resizes:frames.at(-1).resizes}});
  await context.close();
 }
 assert.deepEqual(errors,[],'browser or shader errors');report.errors=errors;writeFileSync(directory+'/browser.json',JSON.stringify(report,null,2));console.log('QUALITY_BROWSER_MATRIX_OK',JSON.stringify(report.devices.map(d=>({device:d.device.name,measurement:d.measuredFullScene}))));
}finally{await browser?.close();server.kill('SIGTERM');}
