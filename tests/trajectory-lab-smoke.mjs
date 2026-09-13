import assert from 'node:assert/strict';
import { createTrajectoryLab } from '../src/game/trajectory_lab.js';

const wrap = a => { while (a > Math.PI) a -= Math.PI * 2; while (a < -Math.PI) a += Math.PI * 2; return a; };
const simulate = (car, horizon, steer, throttle, brake) => {
  let x = car.x, y = car.y, a = car.a, v = Math.hypot(car.vx || 0, car.vy || 0);
  v = Math.max(0, v + throttle * 80 * horizon - brake * 120 * horizon);
  a = wrap(a + steer * 1.4 * Math.min(1, v / 80) * horizon);
  x += Math.cos(a) * v * horizon;
  y += Math.sin(a) * v * horizon;
  return { safe: true, collisionT: horizon, x, y, minWall: 120, speed: v };
};
const trafficRisk = () => ({ risk: 0, minTtc: Infinity });

const lab = createTrajectoryLab({ simulate, trafficRisk, blocked: () => false });
const normal = lab.evaluate({ x: 0, y: 0, a: 0, vx: 80, vy: 0 }, {
  headingError: 0.2,
  curvature: 0.2,
  baseSteer: 0.2,
  speed: 80,
  target: { x: 300, y: 0 },
  hazards: []
});
assert.equal(normal.candidateCount, 5);
assert.ok(normal.safeCandidates >= 1);
assert.ok(Number.isFinite(normal.selected.score));

const blockedSimulate = (car, horizon, steer, throttle, brake) => {
  const result = simulate(car, horizon, steer, throttle, brake);
  if (steer > 0.3) result.safe = false;
  return result;
};
const blockedLab = createTrajectoryLab({ simulate: blockedSimulate, trafficRisk, blocked: () => false });
const filtered = blockedLab.evaluate({ x: 0, y: 0, a: 0, vx: 100, vy: 0 }, {
  headingError: 0.1,
  curvature: 0.1,
  baseSteer: 0.1,
  speed: 100,
  target: { x: 300, y: 0 },
  hazards: []
});
assert.ok(filtered.safeCandidates < filtered.candidateCount);
assert.equal(filtered.selected.safe, true);

const uturn = lab.evaluate({ x: 0, y: 0, a: 0, vx: 90, vy: 0 }, {
  headingError: Math.PI - 0.03,
  curvature: Math.PI,
  baseSteer: 1,
  speed: 90,
  target: { x: -220, y: 0 },
  hazards: []
});
assert.equal(uturn.maneuver, 'TURN_AROUND');
assert.equal(uturn.candidateCount, 5);
assert.ok(['CONTROLLED_TURN_AROUND', 'CONTROLLED_STOP_BEFORE_TURN'].includes(uturn.reason));
assert.ok(uturn.cause.includes('HEADING_ERROR_'));
assert.ok(uturn.candidates.every(c => Number.isFinite(c.score)));

console.log('TRAJECTORY_LAB_OK', JSON.stringify({
  normal: { candidates: normal.candidateCount, safe: normal.safeCandidates, selected: normal.selected.id },
  filtered: { candidates: filtered.candidateCount, safe: filtered.safeCandidates, selected: filtered.selected.id },
  uturn: { maneuver: uturn.maneuver, selected: uturn.selected.id, reason: uturn.reason }
}));
