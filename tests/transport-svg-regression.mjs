import assert from 'node:assert/strict';
import {SVG_TRANSPORT_TYPES,createTransportSVG} from '../src/game/transport_svg.js';
import {VEHICLE_ASSETS} from '../src/game/assets.js';
assert.equal(SVG_TRANSPORT_TYPES.length,19);
for(const type of SVG_TRANSPORT_TYPES){
 const views=new Set();assert(VEHICLE_ASSETS[type].startsWith('data:image/svg+xml'));
 for(let i=0;i<16;i++){
  const svg=createTransportSVG(type,i*Math.PI/8);assert(!/NaN|undefined|Infinity/.test(svg));
  assert(svg.startsWith('<svg')&&svg.endsWith('</svg>'));views.add(svg);
  for(const points of svg.matchAll(/points="([^"]+)"/g))for(const pair of points[1].split(' ')){
   const [x,y]=pair.split(',').map(Number);assert(x>=0&&x<=220&&y>=0&&y<=170,`${type}: cropped body at ${x},${y}`);
  }
 }assert.equal(views.size,16);
}
assert.throws(()=>createTransportSVG('unknown'));assert.throws(()=>createTransportSVG('sedan',NaN));
console.log('PASS: 19 original SVG transport types, all 304 directional views finite and inside their canvas, garage image sources');
