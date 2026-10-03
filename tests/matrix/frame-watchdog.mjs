import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

let now=0,box=null,check;
const listeners={},window={addEventListener:(name,fn)=>listeners[name]=fn};
const document={hidden:false,getElementById:()=>box,createElement:()=>({dataset:{},setAttribute(){},remove(){box=null;}}),body:{appendChild:element=>box=element}};
const source=readFileSync(new URL('../../index.html',import.meta.url),'utf8').match(/<script>([\s\S]*?)<\/script>/)[1];
vm.runInNewContext(source,{window,document,performance:{now:()=>now},setInterval:fn=>check=fn});listeners.load();
now=6000;check();assert.equal(box.dataset.transient,'true');
window.__lowtownLastFrame=now;window.__lowtownFrameReady();assert.equal(box,null,'a late successful frame must clear its stale-frame warning');
now+=6000;window.__lowtownRenderPaused=true;check();assert.equal(box,null,'intentional pause is not a rendering failure');
window.__lowtownFail('shader failed');window.__lowtownFrameReady();assert(box.textContent.includes('shader failed'),'real errors must survive a later frame');
window.__lowtownRenderPaused=false;check();assert(box.textContent.includes('shader failed'),'the frame watchdog must not overwrite a real error');
console.log('FRAME_WATCHDOG_OK: delayed frame recovery, intentional pause, persistent real error');
