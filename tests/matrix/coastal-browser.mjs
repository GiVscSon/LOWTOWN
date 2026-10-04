import assert from 'node:assert/strict';
import {mkdirSync,writeFileSync} from 'node:fs';
import {spawn} from 'node:child_process';
import {chromium} from 'playwright';
const origin='http://127.0.0.1:4195/',directory='artifacts/coastal-weapons/browser',report={devices:[],errors:[]};mkdirSync(directory,{recursive:true});
const server=spawn(process.execPath,['node_modules/vite/bin/vite.js','preview','--host','127.0.0.1','--port','4195','--strictPort'],{stdio:'ignore'});let browser;
try{
 for(let i=0;i<80;i++){try{if((await fetch(origin)).ok)break;}catch{}await new Promise(r=>setTimeout(r,250));}
 browser=await chromium.launch({headless:true,executablePath:process.env.LOWTOWN_CHROMIUM||undefined});
 for(const device of [{name:'desktop',viewport:{width:1280,height:800}},{name:'mobile',viewport:{width:390,height:844},deviceScaleFactor:2,hasTouch:true,isMobile:true}]){
  const context=await browser.newContext({...device,serviceWorkers:'block'}),page=await context.newPage();context.setDefaultTimeout(90000);
  page.on('pageerror',e=>report.errors.push(e.message));page.on('console',m=>{if(m.type()==='error')report.errors.push(m.text());});
  await page.goto(origin+'?cityQA=1',{waitUntil:'domcontentloaded'});await page.waitForFunction(()=>window.__lowtownThreeStats?.frames>=5,null,{timeout:90000});
  await page.evaluate(()=>window.__lowtownCityQA.coastalScene());
  const swimming=await page.evaluate(()=>window.__lowtownCityQA.coastalState());assert(swimming.player.inWater);assert.equal(swimming.beaches.length,3);assert.equal(swimming.beachPeople,30);assert(swimming.effects>0);
  await page.screenshot({path:`${directory}/${device.name}-swimming.png`});
  await page.locator('#btnMenu').click({noWaitAfter:true});const paused=await page.evaluate(()=>window.__lowtownCityQA.coastalState());
  await page.evaluate(()=>window.__lowtownCityQA.advanceScene(1));assert.deepEqual(await page.evaluate(()=>window.__lowtownCityQA.coastalState()),paused);await page.locator('#menuClose').click({noWaitAfter:true});
  // Real keyboard event held while advancing the real runtime at 60 Hz.
  await page.keyboard.down('ArrowDown');for(let i=0;i<12;i++)await page.evaluate(()=>window.__lowtownCityQA.advanceScene(.25));await page.keyboard.up('ArrowDown');
  const ashore=await page.evaluate(()=>window.__lowtownCityQA.coastalState());assert(!ashore.player.inWater,'could not swim back onto the beach');
  await page.evaluate(()=>window.__lowtownCityQA.interactionScene('sedan'));
  if(device.hasTouch){await page.locator('#btnWeapon').tap();await page.locator('#btnWeapon').tap();}else await page.keyboard.press('Digit3');
  assert.equal((await page.evaluate(()=>window.__lowtownCityQA.coastalState())).player.weapon,'pistol');
  await page.evaluate(()=>window.__lowtownCityQA.advanceScene(.02));
  assert.equal(await page.locator('#btnNitro span').textContent(),'Огонь');
  if(device.hasTouch)await page.locator('#btnNitro').tap();else await page.keyboard.press('KeyF');
  await page.evaluate(()=>window.__lowtownCityQA.advanceScene(.18));
  const shot=await page.evaluate(()=>({coast:window.__lowtownCityQA.coastalState(),world:window.__lowtownCityQA.interactionState()}));assert.equal(shot.coast.player.ammo.pistol,11);assert(shot.world.cars.some(c=>c.hp<100&&c.damage));assert(shot.world.effects>0);
  await page.screenshot({path:`${directory}/${device.name}-pistol.png`});
  if(device.hasTouch)await page.locator('#btnReload').tap();else await page.keyboard.press('KeyT');
  for(let i=0;i<6;i++)await page.evaluate(()=>window.__lowtownCityQA.advanceScene(.25));assert.equal((await page.evaluate(()=>window.__lowtownCityQA.coastalState())).player.ammo.pistol,12);
  if(!device.hasTouch){await page.evaluate(()=>window.__lowtownCityQA.interactionScene('sedan'));await page.keyboard.press('Digit5');await page.keyboard.press('KeyF');await page.evaluate(()=>window.__lowtownCityQA.advanceScene(.18));assert.equal((await page.evaluate(()=>window.__lowtownCityQA.coastalState())).incident,'fire');await page.screenshot({path:`${directory}/flare-fire.png`});}
  else for(const id of ['btnWeapon','btnReload','btnNitro','btnHandbrake']){const box=await page.locator('#'+id).boundingBox();assert(box&&box.x>=0&&box.x+box.width<=390&&box.y+box.height<=844,id+' overflows mobile viewport');}
  const stats=await page.evaluate(()=>window.__lowtownThreeStats);assert.equal(stats.contextLost,false);report.devices.push({device:device.name,swimming,ashore,shot,triangles:stats.triangles});await context.close();
 }
 assert.deepEqual(report.errors,[]);writeFileSync(directory+'/report.json',JSON.stringify(report,null,2));console.log('COASTAL_BROWSER_MATRIX_OK',JSON.stringify(report.devices.map(d=>({device:d.device,swim:d.swimming.player.inWater,ashore:!d.ashore.player.inWater,ammo:d.shot.coast.player.ammo.pistol}))));
}finally{await browser?.close();server.kill('SIGTERM');}
