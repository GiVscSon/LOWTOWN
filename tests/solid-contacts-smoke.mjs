import assert from 'node:assert/strict';
import { chassis, contact, resolveContact, resolveScenery } from '../src/game/solid_contacts.js';
for (const angle of [0, .3, Math.PI / 2, Math.PI]) {
  const a = { x: 0, y: 0, angle, speed: 8 }, b = { x: 0, y: 0, angle: -.2, speed: 4 };
  assert.equal(resolveContact(a, b), true);
  assert.equal(contact(chassis(a), chassis(b)), null);
}
const car = { x: 90, y: 130, angle: 0, speed: 10 };
assert(resolveScenery(car, [{ x: 100, y: 100, w: 100, h: 100 }]));
assert(car.x <= 76);
const parked = { x: 0, y: 0, width: 40, height: 19 };
resolveContact({ x: 10, y: 0, speed: 6 }, parked, true);
assert.equal(parked.x, 0);
const treeCar = { x: 0, y: 0, speed: 4 };
assert(resolveScenery(treeCar, [], [{ x: 0, y: 0 }]));
console.log('PASS: rotated and coincident cars, wall footprint, fixed parking, tree trunks');
