import assert from 'node:assert/strict';
import {mkdirSync,writeFileSync} from 'node:fs';
import {spawn} from 'node:child_process';
import {chromium} from 'playwright';

const origin='http://127.0.0.1:4197/',directory='artifacts/crowd-performance/browser';
const report={devices:[],errors:[]};mkdirSync(directory,{recursive:true});
const server=spawn(process.execPath,['node_modules/vite/bin/vite.js','preview','--host','127.0.0.1','--port','4197','--strictPort'],{stdio:'ignore'});
let browser;
try{
 for(let i=0;i<80;i++){try{if((await fetch(origin)).ok)break;}catch{}await new Promise(r=>setTimeout(r,250));}
 browser=await chromium.launch({headless:true,executablePath:process.env.LOWTOWN_CHROMIUM||undefined});
 for(const device of [{name:'desktop',viewport:{width:960,height:640}},{name:'mobile',viewport:{width:390,height:844},isMobile:true,hasTouch:true,deviceScaleFactor:2}]){
  const context=await browser.newContext(device),page=await context.newPage();context.setDefaultTimeout(90000);let offline=false;
  page.on('pageerror',e=>report.errors.push(e.message));page.on('console',m=>{if(m.type()==='error'&&!(offline&&m.text().includes('net::ERR_INTERNET_DISCONNECTED')))report.errors.push(m.text());});
  await page.goto(origin,{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>window.__lowtownThreeStats?.frames>=3);
  assert.equal(await page.evaluate(()=>window.__lowtownCityQA),undefined);
  const initial=await page.evaluate(()=>window.__lowtownThreeStats);
  assert.equal(initial.graphics.preset,'balanced');assert.equal(initial.resolution.requested,1);assert(initial.resolution.adaptive);
  assert(initial.resolution.ratio<=1&&initial.resolution.ratio>=.75);
  if(initial.software)assert.equal(initial.resolution.ratio,.75);
  console.log('AUTOMATIC_DEFAULTS_OK',device.name);
  assert.equal(initial.bridges.spans,24);assert(initial.pedestrians>100);
  await page.locator('#btnMenu').click({noWaitAfter:true});await page.locator('[data-menu-page=settings]').click({noWaitAfter:true});
  assert(await page.locator('#menuAdaptive').isChecked());
  const paused=await page.evaluate(()=>({player:window.__lowtownThreeStats.player,climate:window.__lowtownThreeStats.climate,frames:window.__lowtownThreeStats.frames}));
  await page.waitForTimeout(600);
  assert.deepEqual(await page.evaluate(()=>({player:window.__lowtownThreeStats.player,climate:window.__lowtownThreeStats.climate,frames:window.__lowtownThreeStats.frames})),paused);
  await page.locator('#menuAdaptive').uncheck();await page.locator('#menuGraphicsPreset').selectOption('high');await page.locator('#menuResolution').selectOption('1.5');
  const maximum=await page.evaluate(()=>window.__lowtownThreeStats);
  assert.equal(maximum.resolution.ratio,1.5);assert.equal(maximum.resolution.width,Math.floor(device.viewport.width*1.5));assert.equal(maximum.lowCostMaterials,false);
  assert.deepEqual(maximum.peopleTypes,initial.peopleTypes);assert.deepEqual(maximum.streetDetail,initial.streetDetail);
  console.log('MANUAL_MAXIMUM_OK',device.name);
  await page.locator('#menuGraphicsPreset').selectOption('balanced');await page.locator('#menuResolution').selectOption('1');await page.locator('#menuAdaptive').check();
  await page.evaluate(async()=>{await navigator.serviceWorker.ready;});await page.waitForFunction(()=>!!navigator.serviceWorker.controller);
  offline=true;await context.setOffline(true);await page.reload({waitUntil:'domcontentloaded'});await page.waitForFunction(()=>window.__lowtownThreeStats?.frames>=3);
  await page.locator('#btnMenu').click({noWaitAfter:true});await page.locator('[data-menu-page=settings]').click({noWaitAfter:true});
  assert(await page.locator('#menuAdaptive').isChecked());assert.equal(await page.locator('#menuResolution').inputValue(),'1');assert.equal(await page.locator('#menuLighting').inputValue(),'simple');
  await page.screenshot({path:directory+'/'+device.name+'-settings.png'});
  await page.locator('#menuClose').click({noWaitAfter:true});
  if(device.hasTouch)await page.locator('#btnRoamEnter').tap();else await page.keyboard.press('KeyE');
  await page.waitForFunction(()=>document.querySelector('#btnHandbrake span')?.textContent==='Прыжок');
  if(device.hasTouch){await page.locator('#btnWeapon').tap();await page.locator('#btnWeapon').tap();}else await page.keyboard.press('Digit3');
  await page.waitForFunction(()=>document.querySelector('#btnNitro span')?.textContent==='Огонь');
  for(const id of device.hasTouch?['btnWeapon','btnReload','btnNitro','btnHandbrake']:['btnWeapon','btnReload']){
   const box=await page.locator('#'+id).boundingBox();assert(box&&box.x>=0&&box.y>=0&&box.x+box.width<=device.viewport.width+1&&box.y+box.height<=device.viewport.height+1,id+' is outside the viewport');
  }
  assert.equal(await page.evaluate(()=>window.__lowtownThreeStats.contextLost),false);
  report.devices.push({device:device.name,software:initial.software,initialRatio:initial.resolution.ratio,manualRatio:maximum.resolution.ratio,paused:true,offline:true,saved:true,controls:true,population:initial.pedestrians});
  console.log('OFFLINE_CONTROLS_OK',device.name);
  await context.close();
 }
 assert.deepEqual(report.errors,[]);writeFileSync(directory+'/report.json',JSON.stringify(report,null,2));console.log('CROWD_PERFORMANCE_BROWSER_OK',JSON.stringify(report));
}finally{await browser?.close();server.kill('SIGTERM');}
