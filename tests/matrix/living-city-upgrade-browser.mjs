import assert from 'node:assert/strict';
import {mkdirSync,writeFileSync} from 'node:fs';
import {spawn} from 'node:child_process';
import {chromium} from 'playwright';
const origin='http://127.0.0.1:4196/',directory='artifacts/living-city-1.1/browser',report={devices:[],errors:[]};mkdirSync(directory,{recursive:true});
const server=spawn(process.execPath,['node_modules/vite/bin/vite.js','preview','--host','127.0.0.1','--port','4196','--strictPort'],{stdio:'ignore'});let browser;
try{
 for(let i=0;i<80;i++){try{if((await fetch(origin)).ok)break;}catch{}await new Promise(r=>setTimeout(r,250));}
 browser=await chromium.launch({headless:true,executablePath:process.env.LOWTOWN_CHROMIUM||undefined,ignoreDefaultArgs:['--mute-audio'],args:['--autoplay-policy=user-gesture-required']});
 for(const device of [{name:'desktop',viewport:{width:1280,height:800}},{name:'mobile',viewport:{width:390,height:844},deviceScaleFactor:2,hasTouch:true,isMobile:true}]){
  const context=await browser.newContext({...device,serviceWorkers:'block'}),page=await context.newPage();context.setDefaultTimeout(90000);
  await page.addInitScript(()=>{const Native=window.AudioContext;window.AudioContext=function(...args){const context=new Native(...args);window.__audioProbe=context;const gain=context.createGain.bind(context);context.createGain=()=>{const node=gain();(window.__audioGains||=[]).push(node);return node;};return context;};});
  page.on('pageerror',e=>report.errors.push(e.message));page.on('console',m=>{if(m.type()==='error')report.errors.push(m.text());});
  await page.goto(origin+'?cityQA=1',{waitUntil:'domcontentloaded'});await page.waitForFunction(()=>window.__lowtownThreeStats?.frames>=3,null,{timeout:90000});
  await page.locator('#btnMenu').click({noWaitAfter:true});await page.locator('[data-menu-page=settings]').click({noWaitAfter:true});
  assert.equal(await page.locator('#menuRadio').inputValue(),'1','new saves should start with radio on');
  await page.locator('#menuReflectionQuality').selectOption('high');
  await page.evaluate(()=>{window.__lowtownCityQA.setWeather('rain',true);window.__lowtownCityQA.livingCityScene();const a=window.__audioProbe;window.__radioAnalyser=a.createAnalyser();window.__masterAnalyser=a.createAnalyser();window.__audioGains[1].connect(window.__radioAnalyser);window.__audioGains[2].connect(window.__masterAnalyser);});
  const rms=async analyser=>page.evaluate(async name=>{let peak=0;for(let i=0;i<20;i++){const a=window[name],b=new Float32Array(a.fftSize);a.getFloatTimeDomainData(b);peak=Math.max(peak,Math.sqrt(b.reduce((s,v)=>s+v*v,0)/b.length));await new Promise(r=>setTimeout(r,25));}return peak;},analyser);
  await page.waitForTimeout(400);assert(await rms('__masterAnalyser')<.0001,'pause must mute actual audio');
  await page.locator('#menuClose').click({noWaitAfter:true});
  await page.waitForFunction(()=>window.__audioProbe?.state==='running',null,{timeout:90000});
  const radioRms=await rms('__radioAnalyser');assert(radioRms>.005,'radio produced no audible signal');
  const before=await page.evaluate(()=>window.__lowtownThreeStats.frames);await page.evaluate(()=>window.__lowtownCityQA.advanceScene(.02));
  await page.waitForFunction(n=>window.__lowtownThreeStats.frames>n,before,{timeout:90000});
  const stats=await page.evaluate(()=>window.__lowtownThreeStats);assert.equal(stats.wetReflections.mode,'planar');assert(stats.wetReflections.updates>0);assert(stats.pursuitSearchLight);assert.equal(Object.keys(stats.peopleTypes).filter(k=>k!=='player').length,8);assert.equal(stats.contextLost,false);
  await page.screenshot({path:`${directory}/${device.name}-people-rain-searchlight.png`});
  await page.locator('#btnMenu').click({noWaitAfter:true});await page.locator('[data-menu-page=settings]').click({noWaitAfter:true});
  const stations=[];for(const station of ['2','3']){await page.locator('#menuRadio').selectOption(station);await page.locator('#menuClose').click({noWaitAfter:true});const energy=await rms('__radioAnalyser');assert(energy>.005);stations.push({station,energy});await page.locator('#btnMenu').click({noWaitAfter:true});await page.locator('[data-menu-page=settings]').click({noWaitAfter:true});}
  await page.locator('#menuReflectionQuality').selectOption('low');await page.locator('#menuRadio').selectOption('0');await page.locator('#menuClose').click({noWaitAfter:true});await page.waitForTimeout(350);assert(await rms('__radioAnalyser')<.0001,'OFF must stop music voices');
  await page.evaluate(()=>window.__lowtownCityQA.advanceScene(.02));assert.equal(await page.evaluate(()=>window.__lowtownThreeStats.wetReflections.mode),'streaks');
  assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('lowtown_graphics_settings_v1')).reflectionQuality),'low');
  report.devices.push({device:device.name,radioRms,stations,wet:stats.wetReflections,types:stats.peopleTypes,searchlight:stats.pursuitSearchLight});await context.close();
 }
 assert.deepEqual(report.errors,[]);writeFileSync(directory+'/report.json',JSON.stringify(report,null,2));console.log('LIVING_CITY_UPGRADE_BROWSER_OK',JSON.stringify(report.devices));
}finally{await browser?.close();server.kill('SIGTERM');}
