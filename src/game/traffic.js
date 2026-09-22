import { CITY_ROADS, roadById } from './city_semantics.js';
import { ROAD_LEVELS } from './road_topology.js';
import { laneCenterOffset } from './road_geometry.js';

const VEHICLE_TYPES = [
  { id: 'sedan', length: 52, width: 24, colors: ['#2e3d48', '#3b4d3c', '#4a3b32', '#2f343b', '#5c3d2e'] },
  { id: 'taxi', length: 52, width: 24, colors: ['#d99b26', '#e0a025'] },
  { id: 'van', length: 60, width: 26, colors: ['#22252a', '#3a3d42', '#444b52'] }
];

function randomChoice(arr, rng = Math.random) {
  return arr[Math.floor(rng() * arr.length)];
}

// `nodes` and `blocked` are accepted for backwards-compatibility with callers
// compiled against the pre-unified API. The unified system sources its road
// graph from city_semantics directly, so both params are intentional no-ops.
export function createTrafficSystem({ nodes = [], count = 12, seed = 42, blocked = () => false } = {}) {
  void nodes; void blocked; // acknowledged no-ops — see comment above
  let seedVal = seed;
  const rng = () => {
    seedVal = (seedVal * 9301 + 49297) % 233280;
    return seedVal / 233280;
  };

  const cars = [];
  const validRoads = CITY_ROADS.filter(r => Array.isArray(r.points) && r.points.length >= 2);

  function spawnCar(id) {
    const road = randomChoice(validRoads, rng);
    const type = randomChoice(VEHICLE_TYPES, rng);
    const segIdx = Math.floor(rng() * (road.points.length - 1));
    const p1 = road.points[segIdx];
    const p2 = road.points[segIdx + 1];
    const t = rng();
    const x = p1[0] + (p2[0] - p1[0]) * t;
    const y = p1[1] + (p2[1] - p1[1]) * t;
    const dx = p2[0] - p1[0];
    const dy = p2[1] - p1[1];
    const heading = Math.atan2(dy, dx);
    const lanes = road.lanes || 2;
    const lane = Math.floor(rng() * lanes);

    return {
      id: `traffic_${id}`,
      type: type.id,
      color: randomChoice(type.colors, rng),
      roadId: road.id,
      segIdx,
      t,
      lane,
      x,
      y,
      a: heading,
      v: (road.speed || 50) * 0.7 * (0.85 + rng() * 0.3),
      targetSpeed: (road.speed || 50) * 0.7,
      length: type.length,
      width: type.width,
      level: ROAD_LEVELS.STREET,
      braking: false,
      hitAt: 0
    };
  }

  const totalCars = Math.max(1, count || 12);
  for (let i = 0; i < totalCars; i++) {
    cars.push(spawnCar(i));
  }

  function step(dt = 1 / 60) {
    const safeDt = Math.max(0.001, Math.min(dt, 0.1));

    for (let i = 0; i < cars.length; i++) {
      const car = cars[i];
      const road = roadById(car.roadId) || validRoads[0];
      if (!road || road.points.length < 2) continue;

      const p1 = road.points[car.segIdx];
      const p2 = road.points[car.segIdx + 1];
      if (!p1 || !p2) {
        car.segIdx = 0;
        car.t = 0;
        continue;
      }

      const dx = p2[0] - p1[0];
      const dy = p2[1] - p1[1];
      const segLen = Math.hypot(dx, dy) || 1;
      const heading = Math.atan2(dy, dx);
      car.a = heading;

      // Follow distance & speed regulation
      let targetV = car.targetSpeed;
      car.braking = false;

      for (let j = 0; j < cars.length; j++) {
        if (i === j) continue;
        const other = cars[j];
        if (other.roadId === car.roadId && other.lane === car.lane) {
          const distVecX = other.x - car.x;
          const distVecY = other.y - car.y;
          const forwardDist = distVecX * Math.cos(heading) + distVecY * Math.sin(heading);
          if (forwardDist > 0 && forwardDist < 75) {
            targetV = Math.min(targetV, other.v * 0.8);
            car.braking = true;
          }
        }
      }

      if (car.v < targetV) car.v += 45 * safeDt;
      else if (car.v > targetV) car.v -= 70 * safeDt;
      car.v = Math.max(0, car.v);

      // Advance along segment
      const advanceT = (car.v * safeDt) / segLen;
      car.t += advanceT;

      if (car.t >= 1) {
        car.t -= 1;
        car.segIdx++;
        if (car.segIdx >= road.points.length - 1) {
          if (road.oneWay) {
            car.segIdx = 0;
          } else {
            const respawn = spawnCar(i);
            Object.assign(car, respawn);
            continue;
          }
        }
      }

      const curP1 = road.points[car.segIdx];
      const curP2 = road.points[car.segIdx + 1];
      if (curP1 && curP2) {
        const curDx = curP2[0] - curP1[0];
        const curDy = curP2[1] - curP1[1];
        const curLen = Math.hypot(curDx, curDy) || 1;
        const nx = -curDy / curLen;
        const ny = curDx / curLen;
        const laneOffset = laneCenterOffset(road, car.lane);

        car.x = curP1[0] + curDx * car.t + nx * laneOffset;
        car.y = curP1[1] + curDy * car.t + ny * laneOffset;
      }
    }
  }

  return {
    cars,
    step,
    update: step
  };
}
