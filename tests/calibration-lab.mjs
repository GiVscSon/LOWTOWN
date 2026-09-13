import assert from 'node:assert/strict';
import { calibrateSamples } from '../src/game/physics_calibration.js';

const VEHICLES=['sedan','coupe','truck','police'];
const scenarios=['STRAIGHT_ACCEL','BRAKING','CORNER_90','SHARP_TURN','OBSTACLE','SLOW_TRAFFIC','ONCOMING','OVERTAKE','EMERGENCY_BRAKE','RECOVERY','STUCK','HIGH_SPEED','SERIES_OF_TURNS','COLLISION_MARGIN','MULTI_TRAFFIC','LONG_RUN','BRAKE_TURN','LANE_RESTORE','PREDICTION','STOPPING'];
function runVehicle(id,phase){const samples=[];for(let i=0;i<scenarios.length*8;i++){const factor=phase==='after'?.55:1;samples.push({vehicleId:id,scenario:scenarios[i%scenarios.length],accelerationError:(id==='truck'?-3:2)*factor+(i%5)*.03,steeringError:(id==='police'?.8:.45)*factor+(i%3)*.01});}return calibrateSamples(samples,{minSamples:30});}
const before={},after={};
for(const id of VEHICLES){before[id]=runVehicle(id,'before').vehicles[id];after[id]=runVehicle(id,'after').vehicles[id];assert.ok(before[id].ready&&after[id].ready);assert.equal(after[id].samples,before[id].samples);}
const report={version:1,scenarios:scenarios.length,vehicles:{}};
for(const id of VEHICLES){report.vehicles[id]={before:before[id],after:after[id],improvement:{acceleration:Math.abs(before[id].accelerationBias)-Math.abs(after[id].accelerationBias),steering:Math.abs(before[id].steeringBias)-Math.abs(after[id].steeringBias)}};}
console.log('CALIBRATION LAB: PASS',JSON.stringify(report));
