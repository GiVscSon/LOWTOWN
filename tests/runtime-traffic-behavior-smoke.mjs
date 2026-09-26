import assert from 'node:assert/strict';
import { initializeTrafficCar, nextTrafficSegment, stepTrafficFleet } from '../src/game/runtime_traffic.js';

const a={id:'A',x:0,y:0,links:[]};
const b={id:'B',x:100,y:0,links:[]};
const c={id:'C',x:200,y:0,links:[]};
const d={id:'D',x:100,y:100,links:[]};
a.links=[b];b.links=[a,c,d];c.links=[b];d.links=[b];

const car={
  trafficId:'traffic-0',
  currentSegment:[a,b],
  segmentProgress:.9,
  segmentLength:100,
  speed:80,
  cruiseSpeed:80,
  laneOffset:12
};
initializeTrafficCar(car);
assert.ok(Math.abs(car.angle)<1e-6,'car body must align with movement heading');

const before={x:car.x,y:car.y};
stepTrafficFleet([car],.25);
assert.ok(Math.hypot(car.x-before.x,car.y-before.y)>5,'traffic car must advance');
assert.ok(car.segmentProgress>=0&&car.segmentProgress<=1,'traffic progress must stay normalized');
assert.ok(car.speed>=0,'runtime traffic speed must remain non-negative');
assert.ok(Math.abs(Math.sin(car.angle))<.05||Math.abs(Math.cos(car.angle))<.05,'traffic heading must remain aligned to a road segment');

const reverse={
  trafficId:'traffic-reverse',
  currentSegment:[a,b],
  segmentProgress:.25,
  segmentLength:100,
  speed:-70,
  cruiseSpeed:70
};
initializeTrafficCar(reverse);
assert.equal(reverse.currentSegment[0],b,'negative-speed spawn must reverse travel segment');
assert.equal(reverse.currentSegment[1],a,'negative-speed spawn must reverse travel target');
assert.ok(Math.abs(reverse.segmentProgress-.75)<1e-6,'reversed progress must preserve world position');
assert.ok(reverse.speed>0,'negative-speed spawn must normalize to positive travel speed');

const alias={id:'B_ALIAS',x:100,y:0,links:[]};
const e={id:'E',x:100,y:-100,links:[]};
alias.links=[b,e];b.links.push(alias);e.links=[alias];
const turnCar={trafficId:'turner',currentSegment:[a,b],segmentProgress:1,segmentLength:100,speed:60,cruiseSpeed:60,turnCounter:0};
const next=nextTrafficSegment(turnCar);
assert.ok(next&&next[0]===b,'junction transition must start at reached node');
assert.ok(Math.hypot(next[1].x-b.x,next[1].y-b.y)>0,'junction transition must skip zero-length alias link');

const lead={trafficId:'lead',currentSegment:[a,c],segmentProgress:.60,segmentLength:200,speed:60,cruiseSpeed:60,laneOffset:12};
const follow={trafficId:'follow',currentSegment:[a,c],segmentProgress:.42,segmentLength:200,speed:60,cruiseSpeed:60,laneOffset:12};
initializeTrafficCar(lead);initializeTrafficCar(follow);
const initialGap=(lead.segmentProgress-follow.segmentProgress)*200;
for(let i=0;i<60;i++)stepTrafficFleet([lead,follow],1/60);
assert.ok(follow.speed<follow.cruiseSpeed,'following car must reduce speed when headway is short');
assert.ok((lead.segmentProgress-follow.segmentProgress)*200>8||lead.currentSegment!==follow.currentSegment,'headway controller must avoid a stacked same-segment pair');

console.log('RUNTIME TRAFFIC BEHAVIOR: PASS direction + junction + alias skip + headway');
