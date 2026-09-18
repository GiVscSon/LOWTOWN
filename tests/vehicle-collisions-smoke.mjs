import assert from 'node:assert/strict';
import { resolveVehicleOverlap, handlePoliceBuildingSlide } from '../src/game/vehicle_collision.js';

// Test mutual vehicle collision resolution
const carA = { x: 100, y: 100, radius: 20, v: 50 };
const carB = { x: 110, y: 100, radius: 20, v: 40 };

const collided = resolveVehicleOverlap(carA, carB);
assert.equal(collided, true, 'overlapping vehicles must register collision');
assert.ok(carA.x < 100, 'carA must be pushed backward/away');
assert.ok(carB.x > 110, 'carB must be pushed forward/away');
assert.ok(carA.v < 50, 'velocity must be dampened upon collision');

// Test police building avoidance/slide
const copInBuilding = { x: 250, y: -800, v: 60 };
handlePoliceBuildingSlide(copInBuilding);
assert.ok(copInBuilding.v <= 30, 'police velocity must be dampened when hitting building');
console.log('vehicle-collisions-police-ai smoke OK');
