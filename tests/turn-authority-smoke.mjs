import assert from 'node:assert/strict';
import { createTrajectoryLab } from '../src/game/trajectory_lab.js';

const simulate = (car, horizon, steer, throttle, brake) => ({
  safe: true,
  collisionT: horizon,
  x: car.x + Math.cos(car.a || 0) * 10,
  y: car.y + Math.sin(car.a || 0) * 10,
  minWall: 120,
  speed: Math.max(0, Math.hypot(car.vx || 0, car.vy || 0) + throttle * 20 - brake * 20)
});
const trafficRisk = () => ({ risk: 0, minTtc: Infinity });
const lab = createTrajectoryLab({ simulate, trafficRisk });

const expected = [
  [0, 0.72],
  [12, 0.72],
  [24.9, 0.72],
  [25, 0.65],
  [40, 0.65],
  [49.9, 0.65],
  [50, 0.58],
  [60, 0.58],
  [74.9, 0.58],
  [75, 0.35],
  [120, 0.35]
];
for (const [speed, throttle] of expected) {
  const c = lab.buildCandidates({ headingError: -2.7, curvature: Math.PI, speed })[0];
  assert.equal(c.throttle, throttle, `speed ${speed} expected throttle ${throttle}`);
  assert.equal(c.brake, 0);
  assert.equal(c.steer, -1);
}

for (const speed of [5, 20, 40, 60]) {
  const result = lab.evaluate({ x: 0, y: 0, a: 0, vx: speed, vy: 0 }, {
    headingError: -2.7,
    curvature: Math.PI,
    baseSteer: -1,
    speed,
    target: { x: -180, y: 0 },
    hazards: []
  });
  assert.equal(result.maneuver, 'TURN_AROUND');
  assert.equal(result.reason, 'LOW_SPEED_TURN_AUTHORITY');
  assert.ok(result.selected.steer < -0.7);
  assert.equal(result.selected.brake, 0);
}

console.log('TURN AUTHORITY SMOKE: PASS');
