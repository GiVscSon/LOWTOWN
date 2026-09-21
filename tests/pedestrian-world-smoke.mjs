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
const target=buildings.find(b=>b.archetype==='warehouse'&&isPositionOnSolidGround(b.x-12,b.y+b.h*.5));
const walker={x:target.x-12,y:target.y+target.h*.5,vx:1,visualScale:.91,fleeTimer:1,pause:0};
const initialScale=walker.visualScale;
for(let i=0;i<160;i++)movePedestrian(walker,3,0);
this.report={
  parks:parkZones.length,
  archetypes:[...new Set(buildings.map(b=>b.archetype).filter(Boolean))],
  blockedBuildingCentre:isPedestrianBlocked(target.x+target.w*.5,target.y+target.h*.5),
  walkerBlocked:isPedestrianBlocked(walker.x,walker.y),
  scaleStable:walker.visualScale===initialScale,
  configuredScales:pedestrians.every(p=>Number.isFinite(p.visualScale))
};`,sandbox);

assert.ok(sandbox.report.parks>=16,'city needs frequent open civic spaces');
assert.ok(sandbox.report.archetypes.length>=6,'building silhouettes need multiple archetypes');
assert.equal(sandbox.report.blockedBuildingCentre,true,'building must block pedestrians');
assert.equal(sandbox.report.walkerBlocked,false,'pedestrian entered an obstacle');
assert.equal(sandbox.report.scaleStable,true,'walking changed pedestrian scale');
assert.equal(sandbox.report.configuredScales,true,'pedestrian identity scale is missing');
console.log('PEDESTRIAN_WORLD_OK',JSON.stringify(sandbox.report));
