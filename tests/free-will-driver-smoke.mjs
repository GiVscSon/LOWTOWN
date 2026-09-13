import assert from 'node:assert/strict';
import { createFreeWillDriver } from '../src/game/free_will_driver.js';

const nodes=[];
for(let y=0;y<7;y++) for(let x=0;x<7;x++) nodes.push({id:`${x}:${y}`,x:x*160,y:y*160,links:[]});
for(const n of nodes){const [x,y]=n.id.split(':').map(Number);for(const m of nodes){const [mx,my]=m.id.split(':').map(Number);if(Math.abs(mx-x)+Math.abs(my-y)===1)n.links.push(m);}}
const brain=createFreeWillDriver({nodes});
const car={x:480,y:480};
const seen=new Set();
for(let i=0;i<80;i++){
  const goal=brain.update(car,{forceDecision:true});
  assert.ok(goal&&goal.links.length>0,'free-will driver produced no safe goal');
  seen.add(goal.id);
  car.x=goal.x; car.y=goal.y;
}
const s=brain.status();
assert.equal(s.enabled,true);
assert.ok(s.decisions>=80,'driver did not make independent decisions');
assert.ok(s.visited>=2,'driver did not build exploration memory');
assert.ok(seen.size>=4,`driver freedom too low: only ${seen.size} unique goals`);
assert.ok(s.reason==='SELF_CHOICE','driver did not report self-choice');
console.log('FREE_WILL_DRIVER_OK',JSON.stringify({decisions:s.decisions,uniqueGoals:seen.size,visited:s.visited,intent:s.intent}));
