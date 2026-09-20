import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { pointInCoast } from '../src/game/coastline.js';

const noop=()=>{};
const element={style:{},classList:{add:noop,remove:noop},appendChild:noop,addEventListener:noop,getContext:()=>({}),remove:noop};
const sandbox={console,Math,performance:{now:()=>0},document:{readyState:'loading',getElementById:()=>({...element}),createElement:()=>({...element}),querySelectorAll:()=>[],addEventListener:noop},window:{addEventListener:noop},localStorage:{getItem:()=>null,setItem:noop},setTimeout:noop,setInterval:noop,requestAnimationFrame:noop,pointInCoast};
vm.createContext(sandbox);
const source=readFileSync(new URL('../src/main.js',import.meta.url),'utf8').replace(/^import .*;\n/gm,'');
vm.runInContext(source+`
initTopology();
const overlap=(a,b)=>a.x<b.x+b.w&&a.x+a.w>b.x&&a.y<b.y+b.h&&a.y+a.h>b.y;
this.report={
  width:WORLD_W,height:WORLD_H,islands:islands.length,bridges:bridges.length,
  roads:roads.length,buildings:buildings.length,traffic:trafficCars.length,pedestrians:pedestrians.length,
  outOfBounds:[...roads,...buildings].filter(r=>r.x<0||r.y<0||r.x+r.w>WORLD_W||r.y+r.h>WORLD_H).length,
  roadBuildingConflicts:buildings.flatMap((b,buildingIndex)=>roads.map((r,roadIndex)=>({b,r,buildingIndex,roadIndex})).filter(hit=>overlap(hit.b,hit.r))).map(({b,r,buildingIndex,roadIndex})=>({buildingIndex,roadIndex,b,r})),
  bridgeLandfalls:bridges.every(br=>{
    const a=br.dir==='h'?{x:br.x-5,y:br.y+br.h/2}:{x:br.x+br.w/2,y:br.y-5};
    const b=br.dir==='h'?{x:br.x+br.w+5,y:br.y+br.h/2}:{x:br.x+br.w/2,y:br.y+br.h+5};
    return islands.some(i=>pointInCoast(a.x,a.y,i))&&islands.some(i=>pointInCoast(b.x,b.y,i));
  })
};`,sandbox);

assert.equal(sandbox.report.width,10100);
assert.equal(sandbox.report.height,11700);
assert.equal(sandbox.report.islands,16);
assert.equal(sandbox.report.bridges,20);
assert.ok(sandbox.report.roads>=90);
assert.ok(sandbox.report.buildings>=220);
assert.ok(sandbox.report.traffic>=80);
assert.ok(sandbox.report.pedestrians>=100);
assert.equal(sandbox.report.outOfBounds,0);
assert.equal(sandbox.report.roadBuildingConflicts.length,0);
assert.equal(sandbox.report.bridgeLandfalls,true);
console.log('HUGE_WORLD_OK',JSON.stringify(sandbox.report));
