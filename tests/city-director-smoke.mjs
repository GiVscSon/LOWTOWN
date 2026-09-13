import assert from 'node:assert/strict';
import { createCityDirector } from '../src/game/city_director.js';
const nodes=[];
for(let y=0;y<6;y++) for(let x=0;x<6;x++) nodes.push({id:`${x}:${y}`,x:x*160,y:y*160,links:[]});
for(const n of nodes){const [x,y]=n.id.split(':').map(Number);for(const m of nodes){const [mx,my]=m.id.split(':').map(Number);if(Math.abs(mx-x)+Math.abs(my-y)===1)n.links.push(m);}}
const director=createCityDirector({nodes});
const car={x:0,y:0};
let unique=new Set();
for(let i=0;i<140;i++){const t=director.update(car);assert.ok(t);unique.add(Math.floor(t.x/480)+':'+Math.floor(t.y/480));if(i%7===0){car.x=t.x;car.y=t.y;}}
assert.ok(director.state.districts.size>=1);
assert.ok(director.state.completed>=1);
assert.ok(unique.size>=2,'director should seek multiple city areas');
const status=director.status();
console.log(JSON.stringify({...status,target:status.target?{id:status.target.id,x:status.target.x,y:status.target.y}:null},null,2));
console.log('city director smoke test: PASS');
