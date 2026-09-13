import { createAIScoreModel } from '../src/game/ai_score_model.js';
import { createAIManeuverPlanner, choosePassingSide } from '../src/game/ai_maneuver_planner.js';
import { createAIWorldModel } from '../src/game/ai_world_model.js';

const model=createAIScoreModel();
const before=model.status().weights.safety;
model.adapt({collisions:2,trafficHits:2,nearMisses:3,risk:1,crossTrack:90,steeringSpikes:2,exploration:.1,progress:.2,targetProgress:1});
if(model.status().weights.safety<=before) throw new Error('score model did not adapt safety weight');

const planner=createAIManeuverPlanner();
planner.start(0,-1);
planner.update({sideFree:true,lateralClear:false,speed:100,risk:0});
planner.update({sideFree:true,lateralClear:true,speed:120,risk:0});
planner.update({sideFree:true,lateralClear:true,speed:120,passed:true,risk:0});
planner.update({sideFree:true,lateralClear:true,speed:120,passed:true,clear:true,risk:0});
planner.update({sideFree:true,lateralClear:true,speed:120,passed:true,clear:true,risk:0});
if(planner.state.completed!==1) throw new Error('maneuver planner did not complete');
if(choosePassingSide({left:140,right:60})!==-1) throw new Error('passing-side selection failed');

const world=createAIWorldModel({cellSize:160});
world.observe({x:0,y:0,speed:100,risk:0});
world.observe({x:0,y:0,speed:80,risk:1});
const choice=world.best([{x:320,y:0},{x:0,y:0}],{distance:100});
if(!choice||choice.x!==320) throw new Error('world model novelty selection failed');

console.log('LOWTOWN AI EXPANSION SMOKE: PASS');
console.log(JSON.stringify({score:model.status(),maneuver:planner.status(),world:world.status()}));
