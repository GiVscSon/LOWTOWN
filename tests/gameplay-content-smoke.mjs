import assert from 'node:assert/strict';
import { createMissionSystem } from '../src/game/missions.js';
import { CITY_DESTINATIONS, destinationPoint, vehicleRoute } from '../src/game/city_semantics.js';

const missions = createMissionSystem({ mission: { x: 1200, y: -420, radius: 70 } });
assert.equal(missions.templates.length, 3);
assert.ok(CITY_DESTINATIONS.length >= 6);
for (const mission of missions.templates) {
  assert.ok(mission.route.length >= 2, `${mission.id} must have multiple destinations`);
  for (const id of mission.route) assert.ok(destinationPoint(id), `${mission.id} references missing destination ${id}`);
}
let s = missions.state();
assert.equal(s.stage, 0);
assert.ok(s.target && Number.isFinite(s.target.x) && Number.isFinite(s.target.y));
assert.ok(s.routePreview.length >= 2, 'mission must expose a semantic route preview');
const first = destinationPoint(s.route[0]);
const second = destinationPoint(s.route[1]);
const route = vehicleRoute(first, second);
assert.ok(route.length >= 2, 'semantic destinations must be vehicle-connected');

const aiStub = {
  state: {
    enabled: true, route: [], node: 0, goal: null, routeTimer: 2.9, mode: 'CRUISE', state: 'CRUISE',
    replans: 0, stuckTime: 0, recoveries: 0
  },
  replan(car) {
    this.state.replans++;
    this.state.route = vehicleRoute({ x: car.x, y: car.y }, this.state.goal || first).filter(Boolean);
    this.state.node = 0;
    this.state.routeTimer = 0;
    return this.state.route.length >= 2;
  }
};
globalThis.__LOWTOWN_AI = aiStub;
missions.update({ x: -320, y: 0 });
assert.ok(aiStub.state.route.length >= 2, 'active mission must take control of the AI route');
assert.equal(aiStub.state.mode, 'MISSION', 'AI must enter mission navigation mode');
assert.ok(aiStub.state.goal && Number.isFinite(aiStub.state.goal.x) && Number.isFinite(aiStub.state.goal.y));
assert.equal(aiStub.state.routeTimer, 0, 'mission navigation must suppress free-roam replanning');
assert.equal(aiStub.state.routeLocked, true, 'mission route must be explicitly locked');
assert.equal(aiStub.state.routeLockReason, 'MISSION');
assert.ok(aiStub.state.routeLockRemaining > 0, 'mission route lock must expose a cooldown');

const replanBefore = aiStub.state.replans;
aiStub.state.stuckTime = 2;
missions.update({ x: -320, y: 0 });
assert.ok(aiStub.state.replans > replanBefore, 'stuck mission AI must trigger an emergency replan');
assert.equal(aiStub.state.stuckTime, 0, 'successful emergency replan must clear stuck time');
assert.equal(aiStub.state.routeLockReason, 'MISSION_EMERGENCY');

missions.update({ x: first.x, y: first.y });
s = missions.state();
assert.equal(s.stage, 1, 'reaching a destination must advance the mission');
missions.update({ x: -320, y: 0 });
assert.ok(aiStub.state.route.length >= 2, 'next mission stage must install a new AI route');
assert.ok(aiStub.state.goal && Number.isFinite(aiStub.state.goal.x) && Number.isFinite(aiStub.state.goal.y));
assert.equal(aiStub.state.routeLocked, true);

delete globalThis.__LOWTOWN_AI;
// Finish the active DROP before unlocking the next job. next() intentionally
// refuses to skip an incomplete mission.
missions.update({ x: second.x, y: second.y });
assert.equal(missions.state().complete, true, 'DROP must complete at its final destination');
assert.equal(missions.next(), true);
assert.equal(missions.state().id, 'RUN');
for (const id of missions.state().route) {
  const p = destinationPoint(id);
  missions.update({ x: p.x, y: p.y });
}
assert.equal(missions.state().complete, true, 'RUN must complete before GETAWAY unlocks');
assert.equal(missions.next(), true);
assert.equal(missions.state().id, 'GETAWAY');
missions.reset();
assert.equal(missions.state().stage, 0);
console.log('GAMEPLAY CONTENT PASS: PASS SEMANTIC MISSIONS + DESTINATIONS + MISSION AI ROUTING + ROUTE LOCK + EMERGENCY REPLAN');
