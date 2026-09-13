import assert from 'node:assert/strict';
import { createAIWorldModel } from '../src/game/ai_world_model.js';
import { createAutonomyStack } from '../src/game/autonomy_stack.js';

const world=createAIWorldModel({cellSize:160});
const stack=createAutonomyStack({worldModel:world});
stack.observe({x:0,y:0,speed:180,risk:0.1});
stack.observe({x:160,y:0,speed:160,risk:0.2});
const result=stack.evaluate({risk:0.1,ttc:3.2,stuck:0,candidates:[
  {steer:0,throttle:1,brake:0,safe:true,score:120,ttc:3.4,collisionT:1.2},
  {steer:0.8,throttle:.45,brake:0,safe:true,score:100,ttc:2.0,collisionT:1.0},
  {steer:0,throttle:0,brake:1,safe:false,score:300,ttc:.4,collisionT:.3}
]});
assert.ok(result.best,'stack selected no trajectory');
assert.equal(result.best.safe,true,'unsafe trajectory selected');
assert.equal(result.decision.action,'CRUISE');
assert.ok(result.decision.confidence>=0&&result.decision.confidence<=1);
const s=stack.status();
assert.equal(s.decisions,1);
assert.equal(s.world.cells,2);
console.log('AUTONOMY_STACK_OK',JSON.stringify({decisions:s.decisions,worldCells:s.world.cells,action:result.decision.action,confidence:result.decision.confidence}));
