import assert from 'node:assert/strict';
import { createWorldDirector } from '../src/game/world_director.js';
const nodes=[];
for(let y=0;y<5;y++)for(let x=0;x<5;x++)nodes.push({id:`${x}:${y}`,x:x*160,y:y*160,links:[]});
for(const n of nodes){const [x,y]=n.id.split(':').map(Number);for(const m of nodes){const [mx,my]=m.id.split(':').map(Number);if(Math.abs(mx-x)+Math.abs(my-y)===1)n.links.push(m);}}
const d=createWorldDirector({nodes});
const car={x:0,y:0};
for(let i=0;i<8;i++){const goal=d.update(car);assert.ok(goal);car.x=goal.x;car.y=goal.y;}
assert.ok(d.state.started>=2);assert.ok(d.state.completed>=1);assert.ok(d.state.history.length>0);
console.log(JSON.stringify(d.status(),null,2));
console.log('world director smoke test: PASS');
