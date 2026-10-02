import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {spawn} from 'node:child_process';

const PORT='4174';
const origin='http://127.0.0.1:'+PORT+'/';
const server=spawn('npm',['run','preview','--','--host','127.0.0.1','--port',PORT],{stdio:'ignore',shell:true});
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));

async function waitServer(){
  for(let i=0;i<80;i++){
    try{const response=await fetch(origin,{signal:AbortSignal.timeout(900)});if(response.ok)return;}
    catch{}
    await sleep(250);
  }
  throw new Error('preview server did not become ready');
}

const browser=await chromium.launch({headless:true});
const context=await browser.newContext({viewport:{width:1280,height:800}});
const page=await context.newPage();
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

  const registration=await page.evaluate(async()=>{const reg=await navigator.serviceWorker.ready;return {scope:reg.scope};});
  assert(registration.scope.includes('/'));
  if(!await page.evaluate(()=>Boolean(navigator.serviceWorker.controller))){
    await page.reload({waitUntil:'domcontentloaded'});
    await page.waitForFunction(()=>Boolean(navigator.serviceWorker.controller),null,{timeout:10000});
  }
  await page.reload({waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>window.__lowtownRenderer==='three'&&window.__lowtownThreeStats?.frames>2,null,{timeout:15000});
  await context.setOffline(true);
  await page.reload({waitUntil:'domcontentloaded',timeout:15000});
  await page.waitForFunction(()=>window.__lowtownRenderer==='three'&&window.__lowtownThreeStats?.frames>2,null,{timeout:15000});
  const offline=await page.evaluate(()=>({renderer:window.__lowtownRenderer,pwa:window.__lowtownPwa,frames:window.__lowtownThreeStats?.frames||0}));
  assert.equal(offline.renderer,'three');
  assert(offline.frames>2);
  console.log('THREE_PWA_BROWSER_OK',JSON.stringify({first,offline:{renderer:offline.renderer,frames:offline.frames}}));
} finally {
  await context.setOffline(false).catch(()=>{});
  await browser.close();
  server.kill('SIGTERM');
}
