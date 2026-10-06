import assert from 'node:assert/strict';
import {mkdirSync,writeFileSync} from 'node:fs';
import {spawn} from 'node:child_process';
import {chromium} from 'playwright';
const origin='http://127.0.0.1:4197/',directory='artifacts/living-city-1.1/climate/browser',report={devices:[],errors:[]};mkdirSync(directory,{recursive:true});
const server=spawn(process.execPath,['node_modules/vite/bin/vite.js','preview','--host','127.0.0.1','--port','4197','--strictPort'],{stdio:'ignore'});let browser;
try{
 for(let i=0;i<80;i++){try{if((await fetch(origin)).ok)break;}catch{}await new Promise(r=>setTimeout(r,250));}
 browser=await chromium.launch({headless:true,executablePath:process.env.LOWTOWN_CHROMIUM||undefined,ignoreDefaultArgs:['--mute-audio']});
 for(const device of [{name:'desktop',viewport:{width:1280,height:800}},{name:'mobile',viewport:{width:390,height:844},hasTouch:true,isMobile:true,deviceScaleFactor:2}]){
  const context=await browser.newContext({...device,serviceWorkers:'block'}),page=await context.newPage();context.setDefaultTimeout(90000);
  await page.addInitScript(()=>{const Native=window.AudioContext;window.AudioContext=function(...args){const a=new Native(...args);window.__audioProbe=a;const gain=a.createGain.bind(a);a.createGain=()=>{const g=gain();(window.__audioGains||=[]).push(g);return g;};return a;};});
  page.on('pageerror',e=>report.errors.push(e.message));page.on('console',m=>{if(m.type()==='error')report.errors.push(m.text());});
  await page.goto(origin+'?cityQA=1',{waitUntil:'domcontentloaded'});await page.waitForFunction(()=>window.__lowtownThreeStats?.frames>3);
  await page.locator('#btnMenu').click({noWaitAfter:true});await page.locator('[data-menu-page=settings]').click({noWaitAfter:true});
  await page.locator('#menuTimeMode').selectOption('day');assert.equal(await page.evaluate(()=>window.__lowtownThreeStats.climate.daylight),1);await page.screenshot({path:directory+'/'+device.name+'-day.png'});
  await page.locator('#menuTimeMode').selectOption('night');assert.equal(await page.evaluate(()=>window.__lowtownThreeStats.climate.daylight),0);
  await page.locator('#menuDayLength').selectOption('10');await page.locator('#menuWeatherMode').selectOption('rain');await page.locator('#menuRadio').selectOption('0');
  await page.locator('#menuAmbienceVolume').evaluate(input=>{input.value='0';input.dispatchEvent(new Event('input',{bubbles:true}));});
  await page.locator('#menuEffectsVolume').evaluate(input=>{input.value='0';input.dispatchEvent(new Event('input',{bubbles:true}));});
  await page.waitForFunction(()=>[0,3,4].every(index=>window.__audioGains[index].gain.value===0),null,{timeout:1000,polling:20});
  assert.deepEqual(await page.evaluate(()=>[0,3,4].map(index=>window.__audioGains[index].gain.value)),[0,0,0],'zero levels must mute the engine, effects and ambience before another simulation tick');
  await page.locator('#menuEffectsVolume').evaluate(input=>{input.value='80';input.dispatchEvent(new Event('input',{bubbles:true}));});
  await page.evaluate(()=>{const a=window.__audioProbe;window.__effectsAnalyser=a.createAnalyser();window.__masterAnalyser=a.createAnalyser();window.__audioGains[3].connect(window.__effectsAnalyser);window.__audioGains[2].connect(window.__masterAnalyser);});
  const rms=name=>page.evaluate(async name=>{let peak=0;for(let i=0;i<20;i++){const a=window[name],b=new Float32Array(a.fftSize);a.getFloatTimeDomainData(b);peak=Math.max(peak,Math.sqrt(b.reduce((s,v)=>s+v*v,0)/b.length));await new Promise(r=>setTimeout(r,15));}return peak;},name);
  const paused=await page.evaluate(()=>window.__lowtownCityQA.climateState());await page.evaluate(()=>window.__lowtownCityQA.advanceScene(1));assert.deepEqual(await page.evaluate(()=>window.__lowtownCityQA.climateState()),paused);
  await page.locator('#menuClose').click({noWaitAfter:true});await page.evaluate(()=>window.__lowtownCityQA.interactionScene('sedan'));
  await page.evaluate(async()=>{
    const a=window.__audioProbe,code=`class EnergyProbe extends AudioWorkletProcessor { constructor(){super();this.peak=0;this.port.onmessage=()=>{this.peak=0;};} process(inputs){const b=inputs[0]?.[0];if(b){let sum=0;for(const v of b)sum+=v*v;const rms=Math.sqrt(sum/b.length);if(rms>this.peak){this.peak=rms;this.port.postMessage(rms);}}return true;} } registerProcessor('energy-probe',EnergyProbe);`;
    const url=URL.createObjectURL(new Blob([code],{type:'application/javascript'}));await a.audioWorklet.addModule(url);URL.revokeObjectURL(url);
    const probe=new AudioWorkletNode(a,'energy-probe'),silent=a.createGain();silent.gain.value=0;window.__audioGains[3].connect(probe);probe.connect(silent);silent.connect(a.destination);
    probe.port.onmessage=e=>window.__effectsEnergy=Math.max(window.__effectsEnergy||0,e.data);window.__effectsProbe=probe;
  });
  if(device.hasTouch){await page.locator('#btnWeapon').tap();await page.locator('#btnWeapon').tap();}else await page.keyboard.press('Digit3');
  await page.evaluate(()=>window.__lowtownCityQA.advanceScene(.03));await page.waitForTimeout(400);
  await page.evaluate(()=>{window.__effectsEnergy=0;window.__effectsProbe.port.postMessage('reset');});await page.waitForTimeout(40);
  if(device.hasTouch)await page.locator('#btnNitro').tap();else await page.keyboard.press('KeyF');
  await page.evaluate(()=>window.__lowtownCityQA.advanceScene(.03));await page.waitForTimeout(350);const weaponEnergy=await page.evaluate(()=>window.__effectsEnergy);assert(weaponEnergy>.003,'actual weapon sound is silent');
  await page.evaluate(()=>{window.__effectsEnergy=0;window.__effectsProbe.port.postMessage('reset');});await page.waitForTimeout(40);
  if(device.hasTouch)await page.locator('#btnReload').tap();else await page.keyboard.press('KeyT');await page.evaluate(()=>window.__lowtownCityQA.advanceScene(.02));await page.waitForTimeout(350);assert(await page.evaluate(()=>window.__effectsEnergy)>.001,'reload sound is silent');
  for(let i=0;i<8;i++)await page.evaluate(()=>window.__lowtownCityQA.advanceScene(.5));const state=await page.evaluate(()=>window.__lowtownCityQA.soundState());assert(state.voices<=32&&state.loops.rain>.01);
  await page.locator('#btnMenu').click({noWaitAfter:true});await page.locator('[data-menu-page=settings]').click({noWaitAfter:true});await page.waitForTimeout(350);assert(await rms('__masterAnalyser')<.0001,'pause leaked sound');
  await page.locator('#menuEffectsVolume').evaluate(input=>{input.value='0';input.dispatchEvent(new Event('input',{bubbles:true}));});
  await page.waitForFunction(()=>[0,3,4].every(index=>window.__audioGains[index].gain.value===0),null,{timeout:1000,polling:20});
  await page.locator('#menuClose').click({noWaitAfter:true});await page.waitForTimeout(250);
  assert.deepEqual(await page.evaluate(()=>[0,3,4].map(index=>window.__audioGains[index].gain.value)),[0,0,0]);
  if(device.hasTouch)await page.locator('#btnNitro').tap();else await page.keyboard.press('KeyF');await page.evaluate(()=>window.__lowtownCityQA.advanceScene(.03));assert(await rms('__masterAnalyser')<.0001,'effects volume zero leaked sound');
  await page.reload({waitUntil:'domcontentloaded'});await page.waitForFunction(()=>window.__lowtownThreeStats?.frames>3);await page.locator('#btnMenu').click({noWaitAfter:true});await page.locator('[data-menu-page=settings]').click({noWaitAfter:true});
  assert.equal(await page.locator('#menuTimeMode').inputValue(),'night');assert.equal(await page.locator('#menuDayLength').inputValue(),'10');assert.equal(await page.locator('#menuWeatherMode').inputValue(),'rain');assert.equal(await page.locator('#menuEffectsVolume').inputValue(),'0');assert.equal(await page.locator('#menuAmbienceVolume').inputValue(),'0');
  const stats=await page.evaluate(()=>window.__lowtownThreeStats);assert.equal(stats.contextLost,false);report.devices.push({device:device.name,weaponEnergy,dayAndNight:true,pause:true,saved:true,voices:state.voices});await context.close();
 }
 assert.deepEqual(report.errors,[]);writeFileSync(directory+'/report.json',JSON.stringify(report,null,2));console.log('CLIMATE_SOUND_BROWSER_OK',JSON.stringify(report));
}finally{await browser?.close();server.kill('SIGTERM');}
