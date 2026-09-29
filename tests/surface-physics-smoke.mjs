import assert from 'node:assert/strict';
import { applySurfacePhysics, classifySurface, surfaceMovement, sampleVehicleSurface, surfaceTelemetry, SURFACE_TYPES } from '../src/game/surface_physics.js';

const landAt=(x,y)=>x>=0&&x<700&&y>=0&&y<300;
const world={
  roads:[{x:0,y:40,w:200,h:40,dir:'h'}],
  bridges:[{x:180,y:40,w:80,h:40,dir:'h'}],
  scenicRoads:[{width:32,points:[[300,100],[400,100]]}],
  piers:[{x:400,y:160,w:80,h:30}],
  parks:[{x:500,y:40,w:100,h:100}],
  landAt,beachAt:(x,y)=>x>=200&&x<300&&y>=0&&y<300
};

assert.equal(classifySurface(80,55,world),SURFACE_TYPES.ROAD);
assert.equal(classifySurface(200,55,world),SURFACE_TYPES.BRIDGE,'bridge deck must keep its own material');
assert.equal(classifySurface(350,100,world),SURFACE_TYPES.GRAVEL);
assert.equal(classifySurface(440,170,world),SURFACE_TYPES.TIMBER);
assert.equal(classifySurface(240,150,world),SURFACE_TYPES.SAND);
assert.equal(classifySurface(550,80,world),SURFACE_TYPES.GRASS);
assert.equal(classifySurface(680,250,world),SURFACE_TYPES.OFFROAD);
assert.equal(classifySurface(900,900,world),SURFACE_TYPES.WATER);
assert.equal(sampleVehicleSurface(40,55,0,48,24,world),SURFACE_TYPES.ROAD);

const sedan={offroad:.78},truck={offroad:1.28};
assert.ok(surfaceMovement(SURFACE_TYPES.ROAD,sedan).maxSpeed>surfaceMovement(SURFACE_TYPES.SAND,sedan).maxSpeed);
assert.ok(surfaceMovement(SURFACE_TYPES.SAND,truck).maxSpeed>surfaceMovement(SURFACE_TYPES.SAND,sedan).maxSpeed,
  'off-road capable trucks should lose less speed in sand');
assert.ok(surfaceMovement(SURFACE_TYPES.SAND,sedan).slipRetention>surfaceMovement(SURFACE_TYPES.ROAD,sedan).slipRetention,
  'sand should reduce grip and increase sideways slip');
const dryPhysics=applySurfacePhysics({engineForce:8000,brakeForce:12000,lateralGrip:10.5},SURFACE_TYPES.ROAD);
const sandPhysics=applySurfacePhysics({engineForce:8000,brakeForce:12000,lateralGrip:10.5},SURFACE_TYPES.SAND);
assert.ok(sandPhysics.lateralGrip<dryPhysics.lateralGrip&&sandPhysics.brakeForce<dryPhysics.brakeForce&&sandPhysics.engineForce<dryPhysics.engineForce,
  'the transport simulation API should apply lower grip, braking, and drive on sand');
assert.equal(surfaceTelemetry('road',dryPhysics).effectiveGrip,1);
console.log('PASS: surface materials change speed, acceleration, steering and grip');
