import assert from 'node:assert/strict';
import { createAIDriver } from '../src/game/ai_driver.js';

const n0 = { id: 'A', x: 0, y: 0, links: [] };
const n1 = { id: 'B', x: 100, y: 0, links: [] };
const n2 = { id: 'C', x: 200, y: 0, links: [] };
n0.links = [n1];
n1.links = [n0, n2];
n2.links = [n1];

const ai = createAIDriver({ nodes: [n0, n1, n2], blocked: () => false, getTraffic: () => [] });
const car = { x: 37, y: 0, a: 0, v: 0, vx: 0, vy: 0, vz: 0 };

assert.equal(ai.setMissionGoal(n2), true);
assert.equal(ai.state.missionLocked, true);
assert.equal(ai.state.missionGoalId, 'C');
assert.equal(ai.state.goal.id, 'C');
const lockedGoal = ai.state.goal;

assert.equal(ai.start(car), true, 'mission AI must start without safe-start teleport');
assert.equal(car.x, 37, 'mission AI start must not teleport the car');
assert.equal(ai.state.goal, lockedGoal, 'mission goal must survive AI start');
assert.ok(ai.state.route.length >= 2);

const versionBeforeTimer = ai.state.routeVersion;
ai.state.routeTimer = 3.5;
ai.update(car, 1 / 60);
assert.equal(ai.state.missionLocked, true);
assert.equal(ai.state.goal.id, 'C');
assert.equal(ai.state.missionGoalId, 'C');
assert.equal(ai.state.routeVersion, versionBeforeTimer, 'mission timer must not create an explore goal');

const versionBeforeRecovery = ai.state.routeVersion;
ai.state.stuckTime = 2.6;
ai.update(car, 1 / 60);
assert.equal(ai.state.goal.id, 'C');
assert.equal(ai.state.missionGoalId, 'C');
assert.ok(ai.state.routeVersion > versionBeforeRecovery, 'stuck recovery must replan toward the same mission goal');
assert.equal(ai.state.missionLocked, true);

ai.clearMissionLock();
assert.equal(ai.state.missionLocked, false);
assert.equal(ai.state.goal, null);
assert.equal(ai.state.missionGoalId, null);
assert.equal(ai.state.routeLocked, false);
console.log('AI ROUTE LOCK: PASS mission goal authority + no explore fallback + same-goal recovery + clear');
