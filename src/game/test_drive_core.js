export const projectIso = (x, y) => ({ x: (x - y) * Math.sqrt(3) / 2, y: (x + y) / 2 });
export const angleDifference = (a, b) => Math.atan2(Math.sin(a - b), Math.cos(a - b));

// Preserve only intentional lateral inertia; longitudinal speed follows the engine.
export function velocityForHeading(car, retention = 0.18) {
  const c = Math.cos(car.angle), s = Math.sin(car.angle);
  const lateral = (-car.vx * s + car.vy * c) * retention;
  return { vx: c * car.speed - s * lateral, vy: s * car.speed + c * lateral };
}

export function routeInput(car, target) {
  const distance = Math.hypot(target.x - car.x, target.y - car.y);
  const error = angleDifference(Math.atan2(target.y - car.y, target.x - car.x), car.angle);
  const desired = Math.abs(error) > 0.35 || distance < 110 ? 2 : 4.8;
  return { up: car.speed < desired, down: car.speed > desired + 0.3,
    left: error < -0.025, right: error > 0.025, handbrake: false, nitro: false };
}
