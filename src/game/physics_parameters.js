export function derivePhysics(profile) {
  const mass = Math.max(1, Number(profile.mass) || 1);
  const power = Math.max(0, Number(profile.power) || 0);
  const brake = Math.max(0, Number(profile.brake) || 0);
  return {
    mass,
    acceleration: power / mass,
    braking: brake / mass,
    steering: Math.max(0, Number(profile.steering) || 0),
    grip: Math.max(0, Number(profile.grip) || 0),
    drag: Math.max(0, Number(profile.drag) || 0),
    waterDrag: Math.max(0, Number(profile.waterDrag) || 0),
    lift: Math.max(0, Number(profile.lift) || 0),
    verticalControl: Math.max(0, Number(profile.verticalControl) || 0),
    maxSpeed: Math.max(0, Number(profile.maxSpeed) || 0),
  };
}

export function applyLongitudinalForce(speed, throttle, brakeInput, params, dt) {
  const direction = speed < 0 ? -1 : 1;
  const drive = params.acceleration * Math.max(-1, Math.min(1, throttle));
  const braking = params.braking * Math.max(0, Math.min(1, brakeInput));
  const drag = params.drag * speed * Math.abs(speed);
  const next = speed + (drive - direction * braking - direction * drag) * dt;
  return Math.max(-params.maxSpeed, Math.min(params.maxSpeed, next));
}

export function applyLateralGrip(lateralVelocity, params, dt) {
  const grip = Math.max(0, params.grip);
  return lateralVelocity * Math.max(0, 1 - grip * dt);
}
