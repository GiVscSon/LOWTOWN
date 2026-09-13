import assert from 'node:assert/strict';
import { createNavigationBrain } from '../src/game/navigation_brain.js';

const nodes=[];
for(let y=0;y<8;y++) for(let x=0;x<8;x++) nodes.push({id:`${x}:${y}`,x:x*160,y:y*160,links:[]});
for(const n of nodes){const [x,y]=n.id.split(':').map(Number);for(const m of nodes){const [mx,my]=m.id.split(':').map(Number);if(Math.abs(mx-x)+Math.abs(my-y)===1)n.links.push(m);}}
const brain=createNavigationBrain({nodes});
const car={x:0,y:0,a:0,vx:100,vy:0};
for(let i=0;i<20;i++) brain.observe(i%4*160,Math.floor(i/4)*160);
const destination=brain.choose(car);
assert.ok(destination,'navigation brain should choose a destination');
assert.ok(brain.state.cells.size>0,'exploration memory should contain cells');
assert.ok(brain.state.loops>=1,'anti-loop detector should detect repeated cells');
car.x=12345;car.y=12345;assert.equal(brain.recover(car),true,'dead-end recovery should find a safe node');
assert.equal(brain.state.recoveries,1);
console.log(JSON.stringify(brain.status(),null,2));
console.log('navigation brain smoke test: PASS');
