import { createWeather } from '../src/game/surface_physics.js';
import * as authoredWorld from '../src/game/authored_archipelago.js';
import { PLANE_RUNWAYS as LEGACY_RUNWAYS } from '../src/game/free_roam.js';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { projectIso } from '../src/game/test_drive_core.js';
import { coastPoints, pointInBeach, BEACH_WIDTH } from '../src/game/coastline.js';
const noop=()=>{};
const order=[];
const context={save:noop,restore:noop,translate:noop,transform:noop,
  beginPath:noop,moveTo:noop,lineTo:noop,stroke:noop};
const element={style:{},classList:{add:noop,remove:noop},addEventListener:noop,getContext:()=>context};
const sandbox={...authoredWorld,LEGACY_RUNWAYS,createWeather,Math,projectIso,coastPoints,pointInBeach,BEACH_WIDTH,performance:{now:()=>0},document:{readyState:'loading',getElementById:()=>({...element}),createElement:()=>({...element}),querySelectorAll:()=>[],addEventListener:noop},window:{addEventListener:noop},localStorage:{getItem:()=>null},setTimeout:noop,setInterval:noop,requestAnimationFrame:noop};
vm.createContext(sandbox);
const source=readFileSync(new URL('../src/main.js',import.meta.url),'utf8').replace(/^import .*;\n/gm,'');
sandbox.order=order;
vm.runInContext(source+`
buildings.length=0;
Object.assign(player,{x:9000,y:9000});
roam={mode:'foot',special:true,fleet:[]};
pedestrians.push({x:100,y:100},{x:200,y:200});
trafficCars.push({x:150,y:150,angle:0,color:'#aaa'});
drawScreenPedestrian=(ped)=>order.push('person:'+ped.x);
drawDetailedCar=(ctx,x)=>order.push('car:'+x);
drawStreetActors(1000,700,{x:0,y:150},1);
`,sandbox);
assert.deepEqual(order.slice(0,3),['person:100','car:150','person:200'],'street occupants must share one ground-depth order');
console.log('PASS: pedestrians and traffic render in ground-depth order');
