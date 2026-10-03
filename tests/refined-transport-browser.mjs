import assert from 'node:assert/strict';
import {mkdirSync,writeFileSync} from 'node:fs';
import {spawn} from 'node:child_process';
import {chromium} from 'playwright';
const origin='http://127.0.0.1:4197/',directory='artifacts/refined-transport';mkdirSync(directory,{recursive:true});
const server=spawn(process.execPath,['node_modules/vite/bin/vite.js','--host','127.0.0.1','--port','4197','--strictPort'],{stdio:'ignore'});
let browser;const errors=[],report={models:{}};
try{
 for(let attempt=0;attempt<80;attempt++){try{if((await fetch(origin)).ok)break;}catch{}await new Promise(resolve=>setTimeout(resolve,250));}
 browser=await chromium.launch({headless:true,executablePath:process.env.LOWTOWN_CHROMIUM||undefined});const page=await browser.newPage({viewport:{width:1280,height:800}});
 page.on('pageerror',error=>errors.push(error.message));page.on('console',message=>{if(message.type()==='error')errors.push(message.text());});
 await page.goto(origin+'tests/fixtures/refined-transport.html');await page.waitForFunction(()=>window.gallery);
 for(const type of ['taxi','coupe','police','wagon','van','bus','truck','bike','armoredPolice','nationalGuard','fireEngine','ambulance','plane','helicopter','speedboat','tug']){
  for(const angle of [0,Math.PI/2,Math.PI,Math.PI*1.5]){const stats=await page.evaluate(({type,angle})=>window.gallery(type,angle),{type,angle});assert(stats.triangles<1900);assert(stats.calls<=(['plane','helicopter','speedboat','tug'].includes(type)?5:12),'animated wheels and hinged doors exceeded the draw budget');report.models[type]=stats;}
  await page.evaluate(type=>window.gallery(type,0),type);await page.screenshot({path:`${directory}/model-${type}.png`});
 }
 report.apartment=await page.evaluate(()=>window.apartment());assert(report.apartment.triangles<5000);await page.screenshot({path:`${directory}/apartment.png`});
 assert.deepEqual(errors,[],'material shaders or transport models failed to render');writeFileSync(`${directory}/gallery-report.json`,JSON.stringify(report,null,2));console.log('REFINED_TRANSPORT_BROWSER_OK',JSON.stringify(report));
}finally{await browser?.close();server.kill('SIGTERM');}
