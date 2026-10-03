import {attachRuntime} from './helpers/runtime-vm.mjs';
import {createWalkSurface} from '../src/world/walk_surface.js';
import {createSceneryIndex} from '../src/simulation/solid_contacts.js';
import * as authoredWorld from '../src/world/archipelago.js';
import { PLANE_RUNWAYS as LEGACY_RUNWAYS } from '../src/simulation/free_roam.js';
import * as streetNetwork from '../src/world/street_network.js';
// Render the actual game's Canvas calls without a browser. This does not test DOM input.
import { createRequire } from 'node:module';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import vm from 'node:vm';
import * as core from '../src/simulation/vehicle_dynamics.js';
import * as contacts from '../src/simulation/solid_contacts.js';
import * as coast from '../src/world/coastline.js';
import * as roaming from '../src/simulation/free_roam.js';
import * as architecture from '../src/render/canvas/architecture.js';
import * as traffic from '../src/simulation/traffic_turns.js';
import * as ocean from '../src/world/ocean_chunks.js';
import * as surfaces from '../src/simulation/surfaces.js';
import * as incidents from '../src/simulation/incidents.js';
const require=createRequire(import.meta.url);
const {createCanvas}=require(process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES+'/@napi-rs/canvas');
const noop=()=>{},canvas=createCanvas(1440,960),elements=new Map(),renderTargets=new Map();
const element=id=>{
  if(elements.has(id))return elements.get(id);
  const target=createCanvas(900,900);renderTargets.set(id,target);
  const e={width:900,height:900,style:{},classList:{add:noop,remove:noop},appendChild:noop,append:noop,remove:noop,addEventListener:noop,getContext:()=>target.getContext('2d')};
  elements.set(id,e);return e;
};
element('gameCanvas').getContext=()=>canvas.getContext('2d');
let tick=900;
const math=Object.create(Math);let seed=7;math.random=()=>((seed=Math.imul(seed,1664525)+1013904223>>>0)/4294967296);
const sandbox={...authoredWorld,LEGACY_RUNWAYS,...streetNetwork,...ocean,...surfaces,...incidents,Math:math,console,performance:{now:()=>tick*1000/60},document:{readyState:'loading',getElementById:element,createElement:()=>element(Symbol()),querySelectorAll:()=>[],addEventListener:noop},window:{innerWidth:1440,innerHeight:960,addEventListener:noop},localStorage:{getItem:()=>null,setItem:noop},setTimeout:noop,setInterval:noop,requestAnimationFrame:noop,...core,...contacts,...coast,...roaming,...architecture,...traffic};
vm.createContext(sandbox);
Object.assign(sandbox,{createWalkSurface,createSceneryIndex});
attachRuntime(sandbox,{legacyStreets:true});
vm.runInContext(source+'\ninitTopology();roam=createFreeRoam(player,parkedCars,buildings,trees,isPositionOnSolidGround,()=>{},solidProps,isPositionOnWaterObstacle);',sandbox);
const dir=process.argv[2]||'/tmp/lowtown-scenes';mkdirSync(dir,{recursive:true});
for(const [name,x,y] of [['downtown',1200,1200],['harbour',2540,1800],['park',950,850],['marsh',1750,8600]]){
  vm.runInContext(`roam.resetToSedan(1200,1200);`,sandbox);
  if(name==='harbour')vm.runInContext(`roam.interact();Object.assign(player,{x:2490,y:1800});roam.interact();renderWorld();`,sandbox);
  else if(name==='park')vm.runInContext(`roam.interact();Object.assign(player,{x:${x},y:${y}});renderWorld();`,sandbox);
  else if(name==='marsh')vm.runInContext(`roam.interact();Object.assign(player,{x:1915,y:8690});renderWorld();`,sandbox);
  else vm.runInContext(`Object.assign(player,{x:${x},y:${y},speed:0});renderWorld();`,sandbox);
  writeFileSync(`${dir}/${name}.png`,canvas.toBuffer('image/png'));
}
vm.runInContext(`roam.resetToSedan(1200,1200);roam.interact();Object.assign(player,{x:1680,y:2190,angle:0});roam.interact();player.speed=9;roam.toggleFlight();for(let i=0;i<85;i++)roam.step({up:true},1/60);renderWorld();`,sandbox);
writeFileSync(`${dir}/plane-overview.png`,canvas.toBuffer('image/png'));
vm.runInContext('renderFullMap();this.renderSedan=drawDetailedCar;',sandbox);
writeFileSync(`${dir}/map.png`,renderTargets.get('fullMapCanvas').toBuffer('image/png'));
const gallery=createCanvas(1440,960),g=gallery.getContext('2d');g.fillStyle='#0d1419';g.fillRect(0,0,1440,960);
Object.entries(roaming.VEHICLES).forEach(([type,profile],i)=>{
  const x=i%2*720,y=Math.floor(i/2)*240;
  g.fillStyle='#d3b576';g.font='20px sans-serif';g.fillText(profile.name,x+35,y+34);
  [0,Math.PI/2,Math.PI*.8].forEach((angle,j)=>{
    g.save();g.translate(x+130+j*220,y+145);g.scale(2.2,2.2);g.transform(Math.sqrt(3)/2,.5,-Math.sqrt(3)/2,.5,0,0);
    if(type==='sedan')sandbox.renderSedan(g,0,0,angle,profile.color,profile.width,profile.height,false,'taxi');
    else roaming.drawTransport(g,{...profile,type,x:0,y:0,angle,occupied:true},2.3);
    g.restore();
  });
});
writeFileSync(`${dir}/transport.png`,gallery.toBuffer('image/png'));
console.log(dir);
