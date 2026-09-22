import { CITY_ROADS, roadById } from './city_semantics.js';
import { sidewalkOffset } from './road_geometry.js';

// 12 appearance combos: varied skin tones, shirt/pants, accessories
const PEDESTRIAN_LOOKS = [
  { skin: '#f5c5a3', shirt: '#94a3b8', pants: '#1e293b', hat: false, bag: false },
  { skin: '#e8a87c', shirt: '#f59e0b', pants: '#334155', hat: true,  bag: false },
  { skin: '#c68642', shirt: '#38bdf8', pants: '#0f172a', hat: false, bag: true  },
  { skin: '#8d5524', shirt: '#ef4444', pants: '#1e293b', hat: false, bag: false },
  { skin: '#f5c5a3', shirt: '#10b981', pants: '#1e293b', hat: true,  bag: true  },
  { skin: '#e8a87c', shirt: '#a78bfa', pants: '#1e3a5f', hat: false, bag: false },
  { skin: '#c68642', shirt: '#fb923c', pants: '#292524', hat: true,  bag: false },
  { skin: '#8d5524', shirt: '#f9fafb', pants: '#374151', hat: false, bag: true  },
  { skin: '#4a2c0a', shirt: '#6366f1', pants: '#1e293b', hat: false, bag: false },
  { skin: '#f5c5a3', shirt: '#ec4899', pants: '#18181b', hat: false, bag: true  },
  { skin: '#c68642', shirt: '#14b8a6', pants: '#1c1917', hat: true,  bag: true  },
  { skin: '#4a2c0a', shirt: '#facc15', pants: '#1e293b', hat: false, bag: false },
];

function randomChoice(arr, rng = Math.random) {
  return arr[Math.floor(rng() * arr.length)];
}

export function createPeopleSystem({ count = 32, seed = 101 } = {}) {
  let seedVal = seed;
  const rng = () => {
    seedVal = (seedVal * 9301 + 49297) % 233280;
    return seedVal / 233280;
  };

  const people = [];
  const validRoads = CITY_ROADS.filter(r => Array.isArray(r.points) && r.points.length >= 2);

  function spawnPerson(id) {
    const road = randomChoice(validRoads, rng);
    const segIdx = Math.floor(rng() * (road.points.length - 1));
    const side = rng() > 0.5 ? 1 : -1;
    const direction = rng() > 0.5 ? 1 : -1;
    const isChild = rng() < 0.15;
    const speed = isChild ? 7 + rng() * 6 : 11 + rng() * 14;
    const scale = isChild ? 0.62 + rng() * 0.1 : 0.88 + rng() * 0.18;
    const look = randomChoice(PEDESTRIAN_LOOKS, rng);
    const pauseChance = 0.22;
    const pauseDuration = 0.5 + rng() * 1.5;

    return {
      id: `ped_${id}`,
      roadId: road.id,
      segIdx,
      t: rng(),
      side,
      direction,
      speed,
      scale,
      isChild,
      x: 0,
      y: 0,
      animTime: rng() * 10,
      state: 'WALK',
      idleTimer: 0,
      pauseChance,
      pauseDuration,
      look,
      get colors() { return { shirt: this.look.shirt, pants: this.look.pants }; },
    };
  }

  const totalPeople = Math.max(1, count || 32);
  for (let i = 0; i < totalPeople; i++) {
    const p = spawnPerson(i);
    updatePersonPosition(p);
    people.push(p);
  }

  function updatePersonPosition(p) {
    const road = roadById(p.roadId) || validRoads[0];
    const p1 = road.points[p.segIdx];
    const p2 = road.points[p.segIdx + 1];
    if (!p1 || !p2) return;
    const dx = p2[0] - p1[0];
    const dy = p2[1] - p1[1];
    const len = Math.hypot(dx, dy) || 1;
    const nx = -dy / len;
    const ny = dx / len;
    const offset = sidewalkOffset(road) * p.side;
    p.x = p1[0] + dx * p.t + nx * offset;
    p.y = p1[1] + dy * p.t + ny * offset;
  }

  function step(dt = 1 / 60) {
    const safeDt = Math.max(0.001, Math.min(dt, 0.1));
    for (let i = 0; i < people.length; i++) {
      const p = people[i];
      if (p.state === 'IDLE') {
        p.idleTimer -= safeDt;
        p.animTime += safeDt * 0.5;
        if (p.idleTimer <= 0) p.state = 'WALK';
        continue;
      }
      if (rng() < p.pauseChance * safeDt * 0.4) {
        p.state = 'IDLE';
        p.idleTimer = p.pauseDuration;
        continue;
      }
      const road = roadById(p.roadId) || validRoads[0];
      if (!road || road.points.length < 2) continue;
      const p1 = road.points[p.segIdx];
      const p2 = road.points[p.segIdx + 1];
      if (!p1 || !p2) { p.segIdx = 0; p.t = 0; continue; }
      const dx = p2[0] - p1[0];
      const dy = p2[1] - p1[1];
      const segLen = Math.hypot(dx, dy) || 1;
      p.t += (p.speed * p.direction * safeDt) / segLen;
      p.animTime += safeDt * (p.speed / 10);
      if (p.t >= 1) {
        p.t = 0; p.segIdx++;
        if (p.segIdx >= road.points.length - 1) {
          p.direction = -1; p.segIdx = road.points.length - 2; p.t = 1;
        }
      } else if (p.t <= 0) {
        p.t = 1; p.segIdx--;
        if (p.segIdx < 0) { p.direction = 1; p.segIdx = 0; p.t = 0; }
      }
      updatePersonPosition(p);
    }
  }

  return { people, step, update: step };
}
