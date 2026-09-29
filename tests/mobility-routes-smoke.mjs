import assert from 'node:assert/strict';
import { advanceRouteActor, createRoadGraph, planStopRoute } from '../src/game/street_network.js';

const roads=[
  {x:0,y:0,w:100,h:20,dir:'h'}, {x:80,y:0,w:20,h:100,dir:'v'},
  {x:0,y:80,w:100,h:20,dir:'h'}, {x:0,y:0,w:20,h:100,dir:'v'}
];
const graph=createRoadGraph(roads,[]);
const route=planStopRoute(graph,[[10,10],[90,10],[90,90],[10,90]],{loop:true,id:'test-loop'});
assert.ok(route&&route.loop&&route.points.length>=4);
assert.equal(route.stopCount,4);
assert.ok(route.stopPoints.every(p=>route.points.includes(p)));
const actor={...route.points[0],angle:0,speed:0,routeIndex:1,lastStopIndex:-1};
const start={x:actor.x,y:actor.y};
for(let i=0;i<360;i++)advanceRouteActor(actor,route,1/60,{speed:1.1,dwell:.1});
assert.ok(Number.isFinite(actor.x)&&Number.isFinite(actor.y)&&Number.isFinite(actor.angle));
assert.ok(Math.hypot(actor.x-start.x,actor.y-start.y)>25,'route-following vehicles should progress without teleporting');
assert.ok(actor.x>=-8&&actor.x<=108&&actor.y>=-8&&actor.y<=108,'route followers must remain inside the connected street layout');
console.log('PASS: looped stop routes and smooth route-following movement');
