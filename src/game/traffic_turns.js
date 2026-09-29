import { chassis, contact } from './solid_contacts.js';

// Traffic lanes are paired within each road. Reverse at a road end on a small
// semicircle instead of relocating a car across the city in one frame.
export function advanceTrafficCar(car, frame, nearby = []) {
  const axis = car.axis === 'y' ? 'y' : 'x';
  const cross = axis === 'x' ? 'y' : 'x';
  const direction = Math.sign(car.cruiseSpeed || car.speed || 1);
  const radius = car.turnRadius || (axis === 'x' ? 20 : 28);
  if (!Number.isFinite(car.laneCenter)) car.laneCenter = car[cross] + direction * radius;

  const min = car[axis === 'x' ? 'minX' : 'minY'];
  const max = car[axis === 'x' ? 'maxX' : 'maxY'];
  const anchor = direction > 0 ? max - radius - 24 : min + radius + 24;
  if (car.turn) {
    const turn = car.turn;
    turn.t = Math.min(Math.PI, turn.t + Math.abs(car.speed) * frame / radius);
    const t = turn.t;
    if (axis === 'x') {
      car.x = turn.anchor + turn.direction * radius * Math.sin(t);
      car.y = car.laneCenter - turn.direction * radius * Math.cos(t);
      car.angle = turn.direction > 0 ? t : Math.PI + t;
    } else {
      car.x = car.laneCenter - turn.direction * radius * Math.cos(t);
      car.y = turn.anchor + turn.direction * radius * Math.sin(t);
      car.angle = turn.direction > 0 ? Math.PI / 2 - t : -Math.PI / 2 - t;
    }
    if (t === Math.PI) {
      car.cruiseSpeed *= -1;
      car.speed = car.cruiseSpeed;
      car.angle = axis === 'x' ? (car.cruiseSpeed > 0 ? 0 : Math.PI) :
        (car.cruiseSpeed > 0 ? Math.PI / 2 : -Math.PI / 2);
      car.turn = null;
    }
    return;
  }

  const next = car[axis] + car.speed * frame;
  if ((direction > 0 && next >= anchor) || (direction < 0 && next <= anchor)) {
    // Wait for the end of the road to clear before entering a turning arc.
    const blocked = nearby.some(other => other !== car &&
      Math.hypot(other.x - (axis === 'x' ? anchor : car.laneCenter),
        other.y - (axis === 'y' ? anchor : car.laneCenter)) < radius + 38);
    car[axis] = anchor;
    if (blocked) { car.speed = 0; return; }
    car.turn = { anchor, direction, t: 0 };
    return;
  }
  car[axis] = next;
}

// Preserve lane placement at contacts. The general car solver would push NPCs
// sideways into sidewalks or water at junctions.
export function resolveTrafficPair(a, b) {
  const hit = contact(chassis(a), chassis(b));
  if (!hit) return false;
  const axisA = a.axis === 'y' ? 'y' : 'x';
  const axisB = b.axis === 'y' ? 'y' : 'x';
  const dirA = Math.sign(a.cruiseSpeed || a.speed || 1);
  const dirB = Math.sign(b.cruiseSpeed || b.speed || 1);
  const shift = Math.min(25, hit.depth + 1);
  if (axisA === axisB && dirA === dirB) {
    const follower = (b[axisA] - a[axisA]) * dirA > 0 ? a : b;
    follower[axisA] -= dirA * shift;
  } else {
    a[axisA] -= dirA * shift * .5;
    b[axisB] -= dirB * shift * .5;
  }
  a.speed *= .25;
  b.speed *= .25;
  a.collisionHold = b.collisionHold = .3;
  return true;
}
