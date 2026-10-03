import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {spawn} from 'node:child_process';

const PORT='4174';
const origin='http://127.0.0.1:'+PORT+'/';
const server=spawn(process.execPath,['node_modules/vite/bin/vite.js','preview','--host','127.0.0.1','--port',PORT,'--strictPort'],{stdio:'ignore'});
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));

async function waitServer(){
  for(let i=0;i<80;i++){
    try{const response=await fetch(origin,{signal:AbortSignal.timeout(900)});if(response.ok)return;}
    catch{}
    await sleep(250);
  }
  throw new Error('preview server did not become ready');
}

const browser=await chromium.launch({headless:true,executablePath:process.env.LOWTOWN_CHROMIUM||undefined});
const context=await browser.newContext({viewport:{width:1280,height:800}});
const page=await context.newPage();
const errors=[];
page.on('pageerror',error=>errors.push(error.message));
page.on('console',message=>{if(message.type()==='error')console.log('BROWSER_CONSOLE',message.text());});
try{
  await waitServer();
  await page.goto(origin+'?renderer=three',{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>window.__lowtownRenderer==='three'&&window.__lowtownThreeStats?.frames>3&&performance.now()-window.__lowtownLastFrame<1500,null,{timeout:20000});
  const first=await page.evaluate(()=>({
    renderer:window.__lowtownRenderer,
    frames:window.__lowtownThreeStats?.frames||0,
    error:String(window.__lowtownLastError||''),
    threeDisplay:getComputedStyle(document.getElementById('threeCanvas')).display,
    legacyDisplay:getComputedStyle(document.getElementById('gameCanvas')).display
  }));
  assert.equal(first.error,'');
  assert.equal(first.renderer,'three');
  assert.notEqual(first.threeDisplay,'none');
  assert.equal(first.legacyDisplay,'none');
  const manifest=await(await page.request.get(origin+'manifest.webmanifest')).json();
  for(const icon of manifest.icons){
    const dimensions=await page.evaluate(async url=>{const image=new Image();image.src=url;await image.decode();return [image.naturalWidth,image.naturalHeight];},new URL(icon.src,origin).href);
    assert.equal(dimensions.join('x'),icon.sizes);
  }
  const saved=JSON.stringify({cash:837,worldVersion:3,x:1200,y:1200});
  await page.evaluate(saved=>localStorage.setItem('lowtown_integrity_save',saved),saved);

  await page.waitForFunction(async()=>!!(await navigator.serviceWorker.getRegistration())?.active,null,{timeout:20000});
  const registration=await page.evaluate(async()=>{const reg=await navigator.serviceWorker.ready;return {scope:reg.scope};});
  assert(registration.scope.includes('/'));
  if(!await page.evaluate(()=>Boolean(navigator.serviceWorker.controller))){
    await page.reload({waitUntil:'domcontentloaded'});
    await page.waitForFunction(()=>Boolean(navigator.serviceWorker.controller),null,{timeout:10000});
  }
  // The first installation must already contain every production chunk. No
  // controlled online reload is allowed to populate missing JS or CSS assets.
  await context.setOffline(true);
  await page.reload({waitUntil:'domcontentloaded',timeout:15000});
  await page.waitForFunction(()=>window.__lowtownRenderer==='three'&&window.__lowtownThreeStats?.frames>2,null,{timeout:15000});
  const offline=await page.evaluate(()=>({renderer:window.__lowtownRenderer,pwa:window.__lowtownPwa,frames:window.__lowtownThreeStats?.frames||0}));
  assert.equal(offline.renderer,'three');
  assert(offline.frames>2);
  assert.equal(await page.evaluate(()=>localStorage.getItem('lowtown_integrity_save')),saved);
  assert.equal(errors.length,0,JSON.stringify(errors));
  console.log('THREE_PWA_BROWSER_OK',JSON.stringify({first,offline:{renderer:offline.renderer,frames:offline.frames}}));
} catch(error){
  console.log('THREE_PWA_FAILURE',JSON.stringify(await page.evaluate(async()=>({renderer:window.__lowtownRenderer,error:window.__lowtownRendererError,lastError:window.__lowtownLastError,stats:window.__lowtownThreeStats,
    scripts:[...document.scripts].map(s=>s.src),caches:await Promise.all((await caches.keys()).map(async key=>({key,requests:(await(await caches.open(key)).keys()).map(r=>r.url)})))}))),errors);
  throw error;
} finally {
  await context.setOffline(false).catch(()=>{});
  await browser.close();
  server.kill('SIGTERM');
}
