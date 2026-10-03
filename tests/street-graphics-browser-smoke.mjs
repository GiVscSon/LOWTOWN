import assert from 'node:assert/strict';
import {mkdirSync,writeFileSync} from 'node:fs';
import {spawn} from 'node:child_process';
import {chromium} from 'playwright';

const origin='http://127.0.0.1:4184/',directory='artifacts/street-graphics';
const server=spawn(process.execPath,['node_modules/vite/bin/vite.js','preview','--host','127.0.0.1','--port','4184','--strictPort'],{stdio:'ignore'});
let browser;
const errors=[],report={};mkdirSync(directory,{recursive:true});
try{
  for(let attempt=0;attempt<80;attempt++){
    try{if((await fetch(origin)).ok)break;}catch{}
    await new Promise(resolve=>setTimeout(resolve,250));
  }
  browser=await chromium.launch({headless:true,executablePath:process.env.LOWTOWN_CHROMIUM||undefined});
  const context=await browser.newContext({viewport:{width:1280,height:800}}),page=await context.newPage();
  page.on('pageerror',error=>errors.push(error.message));
  page.on('console',message=>{if(message.type()==='error')errors.push(message.text());});
  await page.goto(origin+'?cityQA=1',{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>window.__lowtownThreeStats?.frames>=5,null,{timeout:30000});
  const camera=page.locator('#btnCamera');
  assert.equal(await camera.textContent(),'Камера: Обычный');
  report.cameras={};
  for(const [preset,label] of [['overview','Обзор'],['near','Ближе'],['normal','Обычный']]){
    await camera.click();assert.equal(await camera.textContent(),'Камера: '+label);
    const before=await page.evaluate(()=>window.__lowtownThreeStats.frames);
    await page.waitForFunction(start=>window.__lowtownThreeStats.frames>=start+12,before,{timeout:30000});
    const framing=await page.evaluate(()=>window.__lowtownThreeStats.camera);
    assert.equal(framing.preset,preset);report.cameras[preset]=framing;
    await page.screenshot({path:`${directory}/camera-${preset}.png`});
  }
  assert(report.cameras.near.y<report.cameras.normal.y-100);
  assert(report.cameras.normal.y<report.cameras.overview.y-150);
  await camera.click();await camera.click(); // Close view is persisted across restart.
  await page.reload({waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>window.__lowtownThreeStats?.frames>=5,null,{timeout:30000});
  assert.equal(await camera.textContent(),'Камера: Ближе');
  await page.evaluate(()=>window.__lowtownCityQA.setWeather('rain',true));
  await page.waitForFunction(()=>window.__lowtownThreeStats.frames>=10,null,{timeout:20000});
  await page.screenshot({path:`${directory}/wet-street.png`});
  for(const index of [0,7,15]){
    await page.evaluate(index=>window.__lowtownCityQA.viewBridgeEntrance(index),index);
    const before=await page.evaluate(()=>window.__lowtownThreeStats.frames);
    await page.waitForFunction(start=>window.__lowtownThreeStats.frames>start+5,before,{timeout:20000});
    await page.screenshot({path:`${directory}/bridge-${index}.png`});
  }
  await page.evaluate(()=>window.__lowtownCityQA.collisionScene('person',true));
  await page.keyboard.down('ArrowDown');
  await page.evaluate(()=>window.__lowtownCityQA.advanceScene(1.2));
  await page.keyboard.up('ArrowDown');
  const snapshot=await page.evaluate(()=>window.__lowtownCityQA.snapshot());
  const resident=snapshot.residents.reduce((best,p)=>Math.hypot(p.x-snapshot.player.x,p.y-snapshot.player.y)<Math.hypot(best.x-snapshot.player.x,best.y-snapshot.player.y)?p:best);
  assert(Math.abs(snapshot.player.x-resident.x)>=8.99||Math.abs(snapshot.player.y-resident.y)>=8.99,'player overlapped resident');
  assert.equal(resident.hp,100);assert(!(resident.knockdownTimer>0));assert.equal(snapshot.player.hp,100);
  report.contact={player:snapshot.player,resident};
  await page.screenshot({path:`${directory}/pedestrian-contact.png`});
  // Reload exits the manual QA clock, then test the actual touch button size
  // and visibility in the small portrait viewport.
  await page.setViewportSize({width:390,height:844});await page.reload({waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>window.__lowtownThreeStats?.frames>=5,null,{timeout:30000});
  const box=await camera.boundingBox();assert(box.x>=0&&box.x+box.width<=390&&box.height>=36);
  await camera.click();assert.equal(await camera.textContent(),'Камера: Обычный');
  await page.screenshot({path:`${directory}/mobile-street.png`});
  report.stats=await page.evaluate(()=>window.__lowtownThreeStats);
  assert.equal(report.stats.contextLost,false);assert(report.stats.triangles<220000,'nearby static geometry should be culled by district');
  assert.equal(report.stats.lowCostMaterials,report.stats.software);
  // CI has a software GPU; exercise the hardware/PBR shader path as well.
  await page.goto(origin+'?cityQA=1&fullMaterials=1',{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>window.__lowtownThreeStats?.frames>=5,null,{timeout:30000});
  await page.evaluate(()=>window.__lowtownCityQA.setWeather('rain',true));
  await page.waitForFunction(()=>window.__lowtownThreeStats.frames>=10,null,{timeout:30000});
  report.fullMaterials=await page.evaluate(()=>window.__lowtownThreeStats);
  assert.equal(report.fullMaterials.lowCostMaterials,false);
  await page.screenshot({path:`${directory}/mobile-full-materials.png`});
  report.raisedBridges=[];
  await page.setViewportSize({width:1280,height:800});
  for(const index of [0,7,17]){
    for(const foot of [false,true]){
      const result=await page.evaluate(({index,foot})=>{
        const point=window.__lowtownCityQA.viewBridgeSpan(index,.5,foot,false);return {point,stats:window.__lowtownThreeStats};
      },{index,foot});
      assert(result.point.height>50);
      assert(Math.abs(result.stats.player.groundElevation-result.point.height+3.6)<.01);
      assert(Math.abs(result.stats.player.visualY-result.point.height)<1);
      report.raisedBridges.push({index,foot,...result});
    }
    await page.evaluate(index=>window.__lowtownCityQA.viewBridgeSpan(index,.5,false,true),index);
    await page.screenshot({path:`${directory}/raised-bridge-${index}.png`});
  }
  assert.deepEqual(errors,[],'graphics generated browser or shader errors');
  writeFileSync(`${directory}/report.json`,JSON.stringify(report,null,2));
  console.log('STREET_GRAPHICS_BROWSER_OK',JSON.stringify({cameras:report.cameras,stats:report.stats,contactHp:resident.hp}));
}finally{await browser?.close();server.kill('SIGTERM');}
