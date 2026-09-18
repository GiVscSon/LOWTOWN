import assert from 'node:assert/strict';
import { buildLayeredRoadTopology, layeredRoadSegments, nearestLayeredRoadPoint, ROAD_LEVELS } from '../src/game/road_topology.js';
import { createTransportController } from '../src/game/transport_controller.js';

const nodes = buildLayeredRoadTopology();
const segments = layeredRoadSegments(nodes);
assert(segments.length > 0, 'road topology must expose real segments');

function roadHit(car) {
  return nearestLayeredRoadPoint(car.state.x, car.state.y, nodes, car.state.roadLevel ?? ROAD_LEVELS.STREET);
}

function distanceToHeading(a, b) {
  const d = Math.atan2(Math.sin(a - b), Math.cos(a - b));
  return Math.abs(d);
}

// Start on Lowtown Boulevard and verify straight-line acceleration stays on its segment corridor.
const car = createTransportController('sedan', { x: -200, y: -360, a: 0, roadLines: segments });
car.state.roadLevel = ROAD_LEVELS.STREET;
const start = { x: car.state.x, y: car.state.y };

for (let i = 0; i < 90; i++) car.step(1 / 60, { throttle: 1, brake: 0, steer: 0 });

assert(car.state.x > start.x + 30, 'car must make forward progress on the road');
assert(car.state.v > 10, 'car must build forward speed');
const straightHit = roadHit(car);
assert(straightHit && straightHit.distance < 32, `straight run left road corridor: distance=${straightHit?.distance}`);
assert(distanceToHeading(car.state.a, 0) < 0.25, `straight run heading drifted: a=${car.state.a}`);

// Approach the real Central Avenue junction, then command a left turn.
// In LOWTOWN coordinates negative steer rotates from east toward north.
let sawJunction = false;
let maxRoadDistance = 0;
for (let i = 0; i < 150; i++) {
  const steer = i < 42 ? -1 : -0.35;
  car.step(1 / 60, { throttle: 0.55, brake: 0, steer });
  const hit = roadHit(car);
  if (hit) {
    maxRoadDistance = Math.max(maxRoadDistance, hit.distance);
    if (hit.distance < 31 && hit.t > 0.8) sawJunction = true;
  }
}

const turnHit = roadHit(car);
assert(sawJunction, 'vehicle never reached the true segment junction');
assert(turnHit && turnHit.distance < 32, `turn ended outside road corridor: distance=${turnHit?.distance}`);
assert(Number.isFinite(car.state.a), 'turn heading must remain finite');
assert(Number.isFinite(car.state.vx) && Number.isFinite(car.state.vy), 'turn velocity must remain finite');
assert(maxRoadDistance < 45, `road tracking exceeded safe envelope: maxDistance=${maxRoadDistance}`);
assert(car.state.distance > 100, `turn test did not travel enough distance: ${car.state.distance}`);

console.log('ROAD/TRANSPORT INTEGRATION: PASS SEGMENT MOTION + TRUE JUNCTION TURN + ROAD ENVELOPE');
console.log(JSON.stringify({
  final: { x: +car.state.x.toFixed(2), y: +car.state.y.toFixed(2), heading: +car.state.a.toFixed(3), speed: +car.state.v.toFixed(2) },
  roadDistance: +turnHit.distance.toFixed(2),
  maxRoadDistance: +maxRoadDistance.toFixed(2),
  distance: +car.state.distance.toFixed(2),
}));
