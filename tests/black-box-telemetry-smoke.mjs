import assert from 'node:assert/strict';
import { createBlackBox } from '../src/game/black_box.js';

const box=createBlackBox();
box.start();
box.sample({t:0,game:{x:0,y:0,speed:0,maxSpeed:0,distance:0,collisions:0,trafficHits:0},ai:{control:null}},.1);
box.sample({t:100,game:{x:10,y:0,speed:503,maxSpeed:322,distance:10,collisions:0,trafficHits:0},ai:{control:null}},.1);
const report=box.report();
assert.equal(report.summary.maxSpeed,322);
assert.equal(report.summary.distance,10);
assert.equal(report.summary.collisions,0);
console.log('BLACK BOX TELEMETRY SMOKE: PASS');
