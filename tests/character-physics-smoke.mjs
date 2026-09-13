import assert from 'node:assert/strict';
import { createCharacterState, stepCharacterPhysics } from '../src/game/character_physics.js';

const c=createCharacterState({x:0,y:0,a:0,walkSpeed:34});
for(let i=0;i<60;i++)stepCharacterPhysics(c,1/60,{x:1,y:0});
assert(c.x>10,'character must move using character physics');
assert(Math.hypot(c.vx,c.vy)>1,'character must build walking velocity');
const before=c.x;
for(let i=0;i<30;i++)stepCharacterPhysics(c,1/60,{x:0,y:1});
assert(c.y>1,'character must move in a different direction');
assert(c.distance>before,'character distance must be independent of transport');
const blocked=()=>true;
const stuck=createCharacterState({x:5,y:7});
stepCharacterPhysics(stuck,1/60,{x:1,y:0},blocked);
assert.equal(stuck.x,5,'blocked character must not pass obstacle');
console.log('CHARACTER PHYSICS: PASS WALKING + TURNING + COLLISION + INDEPENDENT STATE');
