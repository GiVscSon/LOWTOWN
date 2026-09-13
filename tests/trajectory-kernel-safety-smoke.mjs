import assert from 'node:assert/strict';
import { createTrajectoryLab } from '../src/game/trajectory_lab.js';
import { createTransportController } from '../src/game/transport_controller.js';

const blocked=()=>false;
const trafficRisk=()=>({risk:0,minTtc:Infinity});
const lab=createTrajectoryLab({simulate:()=>({safe:true,x:0,y:0,speed:0,minWall:999,collisionT:1,points:[]}),trafficRisk,blocked});
const transport=createTransportController('sedan',{x:0,y:0,a:0,vx:80,vy:0});
const result=lab.evaluate(transport.state,{headingError:0.2,curvature:0.1,baseSteer:0.1,speed:80,target:{x:200,y:0},hazards:[{longitudinal:25,closing:40}]});
assert(result.candidateCount>0);
assert(result.selected);
assert(result.candidates.every(c=>Number.isFinite(c.score)));
assert(result.candidates.some(c=>c.safetySafe===false));
console.log('TRAJECTORY KERNEL SAFETY: PASS SHARED PHYSICS + STOPPING DISTANCE GATE');
