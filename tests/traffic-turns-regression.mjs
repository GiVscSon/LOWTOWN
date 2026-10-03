import assert from 'node:assert/strict';
import { advanceTrafficCar, resolveTrafficPair } from '../src/simulation/traffic_turns.js';

const horizontal={x:50,y:10,axis:'x',angle:0,speed:2,cruiseSpeed:2,minX:0,maxX:100,width:46,height:22};
let maxJump=0,turns=0,previous={x:horizontal.x,y:horizontal.y};
for(let i=0;i<200;i++){
  advanceTrafficCar(horizontal,1,[]);
  maxJump=Math.max(maxJump,Math.hypot(horizontal.x-previous.x,horizontal.y-previous.y));
  assert(horizontal.x>=0&&horizontal.x<=100);
  if(horizontal.turn)turns++;
  previous={x:horizontal.x,y:horizontal.y};
}
assert(turns>0,'car must turn at a road end');
assert(maxJump<4,'car teleported at a road end');
assert.equal(horizontal.laneCenter,30);

const vertical={x:32,y:60,axis:'y',angle:Math.PI/2,speed:2,cruiseSpeed:2,minY:0,maxY:140,width:46,height:22};
previous={x:vertical.x,y:vertical.y};maxJump=0;
for(let i=0;i<150;i++){
  advanceTrafficCar(vertical,1,[]);
  maxJump=Math.max(maxJump,Math.hypot(vertical.x-previous.x,vertical.y-previous.y));
  assert(vertical.y>=0&&vertical.y<=140);
  previous={x:vertical.x,y:vertical.y};
}
assert(maxJump<4);assert.equal(vertical.laneCenter,60);

const rear={x:10,y:10,axis:'x',angle:0,speed:2,cruiseSpeed:2,width:46,height:22};
const front={x:30,y:10,axis:'x',angle:0,speed:2,cruiseSpeed:2,width:46,height:22};
assert(resolveTrafficPair(rear,front));
assert(rear.x<10,'following car must fall back');
assert.equal(rear.y,10);assert.equal(front.y,10);
assert(rear.collisionHold>0&&front.collisionHold>0);
console.log('PASS: horizontal/vertical traffic turns without jumps; collision recovery stays in lane');
