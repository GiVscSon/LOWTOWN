import assert from 'node:assert/strict';

globalThis.Image=class{constructor(){this.complete=false;this.naturalWidth=0;}set src(v){this._src=v;}};
globalThis.location={search:''};
const {createTrafficSystem}=await import('../src/game/traffic.js');

const a={id:'A',x:0,y:0,roadId:'r',links:[]};
const b={id:'B',x:160,y:0,roadId:'r',links:[]};
a.links=[b];b.links=[a];
const traffic=createTrafficSystem({nodes:[a,b],blocked:()=>true,seed:7});
assert.equal(traffic.cars.length,12,'default traffic load should be bounded');

traffic.cars[0].x=traffic.cars[1].x=80;
traffic.cars[0].y=traffic.cars[1].y=0;
traffic.cars[0].v=traffic.cars[1].v=0;
for(let i=0;i<12;i++)traffic.update(1/60,{x:10000,y:10000});
const d=Math.hypot(traffic.cars[0].x-traffic.cars[1].x,traffic.cars[0].y-traffic.cars[1].y);
assert.ok(d>30,'overlapping cars must be separated instead of remaining stacked');

const stuck=traffic.cars[2];
const start={x:stuck.x,y:stuck.y};
for(let i=0;i<120;i++)traffic.update(1/60,{x:10000,y:10000});
assert.equal(stuck.x,start.x,'stuck NPC must not teleport to a random node');
assert.equal(stuck.y,start.y,'stuck NPC must not teleport to a random node');
assert.equal(stuck.v,0,'stuck NPC should settle to wait/replan state');
console.log('TRAFFIC STABILITY: PASS bounded load + overlap separation + no stuck teleport');
