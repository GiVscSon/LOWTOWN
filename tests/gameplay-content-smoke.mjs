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

const aiStub = { state: { enabled: true, route: [], node: 0, goal: null, routeTimer: 2.9, mode: 'CRUISE', state: 'CRUISE', replans: 0 } };
globalThis.__LOWTOWN_AI = aiStub;
missions.update({ x: -320, y: 0 });
assert.ok(aiStub.state.route.length >= 2, 'active mission must take control of the AI route');
assert.equal(aiStub.state.mode, 'MISSION', 'AI must enter mission navigation mode');
assert.ok(aiStub.state.goal && Number.isFinite(aiStub.state.goal.x) && Number.isFinite(aiStub.state.goal.y));
assert.equal(aiStub.state.routeTimer, 0, 'mission navigation must suppress free-roam replanning');

missions.update({ x: first.x, y: first.y });
s = missions.state();
assert.equal(s.stage, 1, 'reaching a destination must advance the mission');
missions.update({ x: -320, y: 0 });
assert.ok(aiStub.state.route.length >= 2, 'next mission stage must install a new AI route');
assert.ok(aiStub.state.goal && Number.isFinite(aiStub.state.goal.x) && Number.isFinite(aiStub.state.goal.y));

delete globalThis.__LOWTOWN_AI;
missions.next();
assert.equal(missions.state().id, 'RUN');
missions.next();
assert.equal(missions.state().id, 'GETAWAY');
missions.reset();
assert.equal(missions.state().stage, 0);
console.log('GAMEPLAY CONTENT PASS: PASS SEMANTIC MISSIONS + DESTINATIONS + MISSION AI ROUTING');
