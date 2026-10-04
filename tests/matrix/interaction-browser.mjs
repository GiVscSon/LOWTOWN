import assert from 'node:assert/strict';
import {mkdirSync,writeFileSync} from 'node:fs';
import {spawn} from 'node:child_process';
import {chromium} from 'playwright';
const origin='http://127.0.0.1:4194/',directory='artifacts/interaction-world/browser',report={devices:[],errors:[]};mkdirSync(directory,{recursive:true});
const server=spawn(process.execPath,['node_modules/vite/bin/vite.js','preview','--host','127.0.0.1','--port','4194','--strictPort'],{stdio:'ignore'});let browser;
try{
 for(let i=0;i<80;i++){try{if((await fetch(origin)).ok)break;}catch{}await new Promise(r=>setTimeout(r,250));}
 browser=await chromium.launch({headless:true,executablePath:process.env.LOWTOWN_CHROMIUM||undefined});
 for(const device of [{name:'desktop',viewport:{width:1280,height:800}},{name:'mobile',viewport:{width:390,height:844},deviceScaleFactor:2,hasTouch:true,isMobile:true}]){
  const context=await browser.newContext({...device,serviceWorkers:'block'}),page=await context.newPage();page.on('pageerror',e=>report.errors.push(e.message));page.on('console',m=>{if(m.type()==='error')report.errors.push(m.text());});
  await page.goto(origin+'?cityQA=1',{waitUntil:'domcontentloaded'});await page.waitForFunction(()=>window.__lowtownThreeStats?.frames>=5,null,{timeout:90000});
  await page.evaluate(()=>{window.__lowtownCityQA.interactionScene('crate');window.__lowtownCityQA.setWeather('rain',true);});
  assert.equal(await page.locator('#btnHandbrake span').textContent(),'Прыжок');assert.equal(await page.locator('#btnNitro span').textContent(),'Удар');
  if(device.hasTouch)await page.locator('#btnHandbrake').tap();else await page.keyboard.press('Space');
  await page.evaluate(()=>window.__lowtownCityQA.advanceScene(.4));
  const jump=await page.evaluate(()=>window.__lowtownCityQA.interactionState());assert(jump.player.jumpHeight>20);assert(jump.effects>=0);
  await page.screenshot({path:`${directory}/${device.name}-jump.png`});
  await page.evaluate(()=>window.__lowtownCityQA.advanceScene(.6));assert.equal((await page.evaluate(()=>window.__lowtownCityQA.interactionState())).player.jumpHeight,0);
  await page.evaluate(()=>window.__lowtownCityQA.interactionScene('crate'));
  const before=await page.evaluate(()=>window.__lowtownCityQA.interactionState());
  if(device.hasTouch)await page.locator('#btnNitro').tap();else await page.keyboard.press('KeyF');
  await page.evaluate(()=>window.__lowtownCityQA.advanceScene(.18));
  const strike=await page.evaluate(()=>window.__lowtownCityQA.interactionState()),crate=strike.props.find(p=>p.type==='crate'&&Math.abs(p.y-1200)<1&&Math.abs(p.x-1690)<80);assert(crate);assert.equal(crate.hp,24);assert(crate.x>1690);assert(strike.effects>0);assert(strike.player.attackTime>0);
  await page.screenshot({path:`${directory}/${device.name}-strike.png`});
  await page.locator('#btnMenu').click();await page.locator('[data-menu-page=settings]').click();
  const paused=await page.evaluate(()=>window.__lowtownCityQA.interactionState());await page.evaluate(()=>window.__lowtownCityQA.advanceScene(.5));assert.deepEqual(await page.evaluate(()=>window.__lowtownCityQA.interactionState()),paused);
  await page.locator('#menuEffects').selectOption('off');assert.equal((await page.evaluate(()=>window.__lowtownThreeStats)).visualDetail.effects,0);
  await page.locator('#menuEffects').selectOption('medium');assert.equal((await page.evaluate(()=>window.__lowtownThreeStats)).graphics.effects,'medium');await page.locator('#menuClose').click();
  if(!device.hasTouch){
   for(const type of ['barrel','hydrant','sedan','person']){
    await page.evaluate(type=>window.__lowtownCityQA.interactionScene(type),type);await page.keyboard.press('KeyF');await page.evaluate(()=>window.__lowtownCityQA.advanceScene(.18));
    const state=await page.evaluate(()=>window.__lowtownCityQA.interactionState());assert(state.effects>0,type+': missing contact effect');
    if(type==='sedan')assert(state.cars.some(c=>c.hp===97&&c.damage));if(type==='person')assert(state.people.some(p=>p.hp===86));
    await page.screenshot({path:`${directory}/${type}-strike.png`});
   }
   await page.evaluate(()=>window.__lowtownCityQA.interactionScene('hydrant'));
   for(let i=0;i<3;i++){await page.keyboard.press('KeyF');await page.evaluate(()=>window.__lowtownCityQA.advanceScene(.5));}
   assert((await page.evaluate(()=>window.__lowtownCityQA.interactionState())).props.some(p=>p.type==='hydrant'&&p.intact===false));await page.screenshot({path:`${directory}/hydrant-burst.png`});
  }
  await page.reload({waitUntil:'domcontentloaded'});await page.waitForFunction(()=>window.__lowtownThreeStats?.frames>=5,null,{timeout:90000});assert.equal((await page.evaluate(()=>window.__lowtownThreeStats)).graphics.effects,'medium');
  const final=await page.evaluate(()=>window.__lowtownThreeStats);assert.equal(final.contextLost,false);report.devices.push({device:device.name,before,jump,strike,final});await context.close();
 }
 assert.deepEqual(report.errors,[]);writeFileSync(directory+'/report.json',JSON.stringify(report,null,2));console.log('INTERACTION_BROWSER_MATRIX_OK',JSON.stringify(report.devices.map(d=>({device:d.device,jump:d.jump.player.jumpHeight,effects:d.strike.effects,details:d.strike.details}))));
}finally{await browser?.close();server.kill('SIGTERM');}
