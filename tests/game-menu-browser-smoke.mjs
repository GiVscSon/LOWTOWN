import assert from 'node:assert/strict';
import {mkdirSync,writeFileSync} from 'node:fs';
import {spawn} from 'node:child_process';
import {chromium} from 'playwright';

const origin='http://127.0.0.1:4191/',directory='artifacts/game-menu';
const server=spawn(process.execPath,['node_modules/vite/bin/vite.js','preview','--host','127.0.0.1','--port','4191','--strictPort'],{stdio:'ignore'});
let browser,page;
const errors=[],report={};mkdirSync(directory,{recursive:true});
const menuState=()=>page.evaluate(()=>window.__lowtownCityQA.menuState());
const world=()=>page.evaluate(()=>{
  const s=window.__lowtownCityQA.snapshot();
  return {player:s.player,people:s.residents,vehicles:s.collisionBodies,weather:s.weather,signals:s.signalPhase,incident:s.incident};
});
async function ready(){await page.waitForFunction(()=>window.__lowtownThreeStats?.frames>=5,null,{timeout:45000});}
async function setVolume(value){
  await page.locator('#menuVolume').evaluate((input,value)=>{input.value=String(value);input.dispatchEvent(new Event('input',{bubbles:true}));},value);
}
async function fits(){
  const box=await page.locator('.menu-card').boundingBox(),viewport=page.viewportSize();
  assert(box&&box.x>=0&&box.y>=0&&box.x+box.width<=viewport.width+1&&box.y+box.height<=viewport.height+1,`menu overflows viewport: ${JSON.stringify({box,viewport})}`);
  assert(await page.locator('.menu-card').evaluate(element=>element.scrollWidth<=element.clientWidth+1),'menu has horizontal overflow');
}
try{
  for(let attempt=0;attempt<80;attempt++){
    try{if((await fetch(origin)).ok)break;}catch{}
    await new Promise(resolve=>setTimeout(resolve,250));
  }
  browser=await chromium.launch({headless:true,executablePath:process.env.LOWTOWN_CHROMIUM||undefined});
  const context=await browser.newContext({viewport:{width:1280,height:800}});
  page=await context.newPage();
  page.on('pageerror',error=>errors.push(error.message));
  await page.addInitScript(()=>{
    if(!localStorage.getItem('lowtown_integrity_save'))localStorage.setItem('lowtown_integrity_save',JSON.stringify({worldVersion:3,cash:913,parts:[{id:'turbo',found:true}]}));
  });
  await page.goto(origin+'?cityQA=1',{waitUntil:'domcontentloaded'});await ready();
  assert(await page.locator('#gameMenu').isHidden());
  await page.keyboard.down('w');await page.waitForTimeout(180);
  await page.keyboard.press('Escape');await page.keyboard.up('w');
  await page.locator('#gameMenu').waitFor({state:'visible'});
  assert.equal(await page.locator('#menuTitle').textContent(),'Пауза');
  assert.equal(await page.evaluate(()=>document.activeElement.id),'menuResume');
  const frozen=await world();
  // Cross a whole traffic-light phase while the menu is open: the city,
  // signal timers and weather must all stay frozen, not only the hero.
  await page.waitForTimeout(6400);
  assert.deepEqual(await world(),frozen,'the world advanced during pause');
  assert((await menuState()).paused);assert(Object.values((await menuState()).keys).every(value=>!value));
  await fits();await page.screenshot({path:directory+'/desktop.png'});
  report.frozenPeople=frozen.people.length;report.frozenVehicles=frozen.vehicles.length;
  for(const key of ['w','e','q','m','g','r'])await page.keyboard.press(key);
  assert.deepEqual(await world(),frozen,'gameplay keys leaked through the menu');
  await page.locator('[data-menu-page=settings]').click();
  await page.locator('[data-camera=near]').click();
  assert.equal(await page.locator('[data-camera=near]').getAttribute('aria-pressed'),'true');
  await setVolume(0);await page.locator('#menuRadio').selectOption('2');
  assert.equal((await menuState()).audio.volume,0);
  await page.keyboard.press('Escape');assert.equal(await page.locator('#menuTitle').textContent(),'Пауза');
  // Keyboard focus stays inside the dialog in both directions.
  await page.locator('#menuClose').focus();await page.keyboard.press('Shift+Tab');
  assert.equal(await page.evaluate(()=>document.activeElement.id),'menuRestart');
  await page.keyboard.press('Tab');assert.equal(await page.evaluate(()=>document.activeElement.id),'menuClose');
  await page.locator('#menuResume').click();assert(!(await menuState()).paused);
  assert.equal(await page.locator('#btnCamera').textContent(),'Камера: Ближе');
  await page.waitForTimeout(250);assert((await menuState()).audio.gain<.001,'muted audio still reaches the output');
  await page.locator('#btnMenu').click();await page.locator('[data-menu-page=settings]').click();
  await setVolume(40);await page.locator('#menuRadio').selectOption('3');
  await page.screenshot({path:directory+'/settings.png'});
  await page.locator('#menuClose').click();await page.waitForTimeout(250);
  const audio=(await menuState()).audio;
  assert(Math.abs(audio.gain-.4)<.005,'master audio volume was not applied');
  report.audio=audio;
  await page.reload({waitUntil:'domcontentloaded'});await ready();
  assert.equal(await page.locator('#btnCamera').textContent(),'Камера: Ближе');
  await page.locator('#btnMenu').click();await page.locator('[data-menu-page=settings]').click();
  assert.equal(await page.locator('#menuVolume').inputValue(),'40');
  assert.equal(await page.locator('#menuRadio').inputValue(),'3');
  await page.keyboard.press('Escape');await page.locator('#menuMap').click();
  await page.locator('#mapModal').waitFor({state:'visible'});assert.equal((await menuState()).view,'map');
  const mapped=await world();await page.waitForTimeout(500);assert.deepEqual(await world(),mapped);
  await page.keyboard.press('Escape');assert(!(await menuState()).paused);
  await page.locator('#btnMenu').click();await page.locator('#menuGarage').click();
  await page.locator('#garageModal').waitFor({state:'visible'});assert.equal((await menuState()).view,'garage');
  await page.keyboard.press('Escape');
  await page.locator('#btnMenu').click();await page.locator('#menuRestart').click();
  const saved=await page.evaluate(()=>JSON.parse(localStorage.getItem('lowtown_integrity_save')));
  assert.equal(saved.cash,913);assert(saved.parts.find(part=>part.id==='turbo').found);
  assert.equal((await world()).player.mode,'sedan');assert(!(await menuState()).paused);
  report.progress={cash:saved.cash,turbo:true};
  // A real captured pointer must be released when the menu interrupts gas.
  await page.setViewportSize({width:390,height:844});
  const gas=await page.locator('#btnGas').boundingBox();
  await page.mouse.move(gas.x+gas.width/2,gas.y+gas.height/2);await page.mouse.down();
  assert((await menuState()).keys.up);assert(await page.locator('#btnGas').evaluate(button=>button.hasPointerCapture(1)));
  await page.keyboard.press('Escape');
  assert(Object.values((await menuState()).keys).every(value=>!value));
  assert(!await page.locator('#btnGas').evaluate(button=>button.hasPointerCapture(1)));
  await page.mouse.up();
  for(const viewport of [{width:390,height:844},{width:320,height:568},{width:844,height:390}]){
    await page.setViewportSize(viewport);await fits();
    await page.locator('[data-menu-page=settings]').click();await fits();
    await page.locator('#menuBack').click();await page.locator('[data-menu-page=controls]').click();await fits();
    await page.screenshot({path:`${directory}/controls-${viewport.width}.png`});
    await page.locator('#menuBack').click();
    await page.screenshot({path:`${directory}/menu-${viewport.width}.png`});
  }
  await page.setViewportSize({width:320,height:568});await page.locator('#menuClose').click();
  for(const id of ['btnMenu','btnCamera']){
    const bounds=await page.locator('#'+id).boundingBox();assert(bounds&&bounds.x>=0&&bounds.x+bounds.width<=320&&bounds.height>=44,`mobile ${id} is not accessible`);
  }
  await page.locator('#btnMenu').click();await page.locator('#menuClose').click();
  await page.evaluate(()=>window.__lowtownCityQA.detain());
  await page.keyboard.press('Escape');await page.locator('#gameMenu').waitFor({state:'visible'});
  assert(await page.locator('#menuRestart').isDisabled(),'menu must not bypass custody');
  assert.equal(await page.locator('#menuContext').evaluate(element=>element.textContent.includes('Задержание')),true);
  const visible=await page.locator('#menuResume').evaluate(button=>{const r=button.getBoundingClientRect();return document.elementFromPoint(r.x+r.width/2,r.y+r.height/2)===button;});
  assert(visible,'custody overlay obscures the pause menu');
  await page.locator('#menuResume').click();
  assert((await world()).player.custodyTimer>0,'resuming skipped the custody timer');
  await page.evaluate(async()=>{await navigator.serviceWorker.ready;});
  await page.waitForFunction(()=>Boolean(navigator.serviceWorker.controller),null,{timeout:30000});
  await context.setOffline(true);await page.reload({waitUntil:'domcontentloaded'});await ready();
  await page.locator('#btnMenu').click();await page.locator('[data-menu-page=settings]').click();
  assert.equal(await page.locator('#menuVolume').inputValue(),'40');
  assert.equal(await page.locator('#menuRadio').inputValue(),'3');
  assert.equal(await page.locator('[data-camera=near]').getAttribute('aria-pressed'),'true');
  await fits();await page.screenshot({path:directory+'/offline-settings.png'});
  await page.goto(origin,{waitUntil:'domcontentloaded'});await ready();
  assert(await page.locator('#driveLab').isHidden(),'diagnostic panel is visible in the normal game');
  await page.locator('#btnMenu').click();await page.locator('#menuResume').click();
  await page.screenshot({path:directory+'/mobile-game.png'});
  assert.equal(await page.locator('#labError').count(),0,'pause tripped the frame watchdog');
  report.offline=true;report.errors=errors;assert.deepEqual(errors,[]);
  writeFileSync(directory+'/report.json',JSON.stringify(report,null,2));
  console.log('GAME_MENU_BROWSER_OK',JSON.stringify(report));
}catch(error){await page?.screenshot({path:directory+'/failure.png'}).catch(()=>{});throw error;}
finally{await browser?.close();server.kill('SIGTERM');}
