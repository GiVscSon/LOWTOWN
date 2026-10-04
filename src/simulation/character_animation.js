// Presentation timers run on the physics clock: pause and fixed-step replay agree.
export function advanceCharacterAnimation(person, dt, controls = {}) {
  const h = Math.max(0, Math.min(.1, dt));
  person.animationTime = (person.animationTime || 0) + h;
  person.gaitBlend = (person.gaitBlend || 0) + ((person.gait || 0) - (person.gaitBlend || 0)) * (1 - Math.exp(-10 * h));
  for (const key of ['landingRemaining', 'getUpRemaining', 'shotRemaining', 'meleeRecoveryRemaining', 'weaponDrawRemaining', 'hitFlash']) person[key] = Math.max(0, (person[key] || 0) - h);
  if (person.landed && !person.inWater) person.landingRemaining = .22;
  const down = !person.inWater && (person.knockdownTimer > 0 || person.stance === 'down');
  if (down) person.fallElapsed = person.animationWasDown ? (person.fallElapsed || 0) + h : 0;
  else if (person.animationWasDown && !person.inWater) person.getUpRemaining = .55;
  person.animationWasDown = down;
  person.runIntent = !!controls.nitro && !controls.attack;
  person.swimBoost = !!controls.handbrake && !!person.inWater;
  if (person.visualTransition) {
    person.visualTransition.elapsed += h;
    if (person.visualTransition.elapsed >= person.visualTransition.duration || person.visualTransition.kind === 'enter' && Math.abs(person.speed || 0) > .5) person.visualTransition = null;
  }
}
