import assert from 'node:assert/strict';
import { createAIDriver } from '../src/game/ai_driver.js';
import { buildRoadNetwork, roadSegments } from '../src/game/road_authority.js';
import { createTransportController } from '../src/game/transport_controller.js';
import { pointInBuilding } from '../src/game/world_geometry.js';
import { vehicleWorldBlocked } from '../src/game/vehicle_collision.js';

// Mirror the browser integration setup without requiring a browser. The AI's
// prediction and the transport controller must share the same drivable-world
// boundary check for this seeded 18-second route.
const nodes = buildRoadNetwork();
const roadLines = roadSegments(nodes);
const transport = createTransportController('sedan', {
  x: 640, y: -360, a: 0, vx: 0, vy: 0, roadLines
});
const ai = createAIDriver({
  nodes,
  blocked: (x, y) => pointInBuilding(x, y, 10),
  blockedVehicle: (x, y, angle) => vehicleWorldBlocked(
    x, y, Number.isFinite(angle) ? angle : transport.state.a, roadLines
  ),
  getTraffic: () => []
});

assert.equal(ai.start(transport.state), true, 'AI must find an initial road route');
const route = ai.state.route;
if (route.length >= 2) {
  transport.state.a = Math.atan2(route[1].y - route[0].y, route[1].x - route[0].x);
  transport.state.vx = 0;
  transport.state.vy = 0;
}
transport.state.lastSafe = { x: transport.state.x, y: transport.state.y, a: transport.state.a };

let worldContactEpisodes = 0;
let previouslyBlocked = false;
for (let frame = 0; frame < 1100; frame++) {
  const dt = 1 / 60;
  const control = ai.update(transport.state, dt) || ai.state.control;
  const telemetry = transport.step(dt, control);
  const blocked = !!telemetry.collisionBlocked;
  if (blocked && !previouslyBlocked) worldContactEpisodes++;
  previouslyBlocked = blocked;
}

assert.ok(transport.state.distance > 900, 'AI must make sustained progress');
assert.ok(worldContactEpisodes <= 10,
  `AI exceeded the browser gate's world-contact limit: ${worldContactEpisodes}`);
assert.ok(ai.state.route.length >= 2, 'AI must replan after reaching a terminal road node');
console.log('AUTOPILOT ROAD SAFETY: PASS', JSON.stringify({
  frames: 1100,
  distance: +transport.state.distance.toFixed(1),
  worldContactEpisodes,
  replans: ai.state.replans,
  routeFailures: ai.state.routeFailures
}));
