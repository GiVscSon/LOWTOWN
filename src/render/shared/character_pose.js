const clamp = (n, low = 0, high = 1) => Math.max(low, Math.min(high, n));
const smooth = n => { const t = clamp(n); return t * t * (3 - 2 * t); };

// Shared joint poses for both renderers. Selecting a pose never moves a collider.
export function characterPose(p) {
  const clock = p.animationTime || 0, phase = p.walkPhase || 0;
  const gait = clamp(p.gaitBlend ?? p.gait ?? (phase ? 1 : 0));
  const down = !p.inWater && (p.knockdownTimer > 0 || p.stance === 'down');
  const gettingUp = !p.inWater && !down && p.getUpRemaining > 0;
  const moving = gait > .06;
  const running = moving && !p.inWater && (p.runIntent || p.fleeTimer > 0 || p.reaction === 'fleeing');
  const social = !moving && (!p.weapon || p.weapon === 'fists') && ['coffee','reading','talking','checkingPhone','checkingTimetable','shopping','resting','looking'].includes(p.activity) ? p.activity : null;
  const attack = p.provokedTimer > 0 && p.weapon === 'bat' ? Math.max(0,(p.attackTime||0)-.51) : p.attackTime;
  const t = p.meleeRecoveryRemaining > 0 ? .14+.28-p.meleeRecoveryRemaining : attack || (p.stance === 'fighting' ? clock % .7 : 0), contact = p.combatTimer > 0 ? .35 : .14, duration = p.combatTimer > 0 ? .7 : .42;
  const strike = t > 0 ? (t < contact ? Math.sin(t / contact * Math.PI / 2) : Math.max(0, Math.cos(clamp((t - contact) / (duration - contact)) * Math.PI / 2))) : 0;
  const gun = ['pistol', 'shotgun', 'flare'].includes(p.weapon);
  const reloading = gun && p.reloadRemaining > 0;
  const reload = reloading ? 1 - clamp(p.reloadRemaining / (p.reloadDuration || 1.8)) : 0;
  const reloadReach = reloading ? Math.sin(reload * Math.PI) : 0;
  const firing = gun && (p.shotRemaining > 0 || t > 0 && !p.provokedTimer);
  const aiming = gun && (firing || p.provokedTimer > 0);
  const draw = p.weaponDrawRemaining > 0 ? Math.sin(clamp(1 - p.weaponDrawRemaining / .28) * Math.PI) : 0;
  const stagger = !down && !gettingUp && (p.hitFlash || 0) / .18;
  const landing = p.landingRemaining > 0 ? Math.sin(clamp(1 - p.landingRemaining / .22) * Math.PI) : 0;
  const swimming = !!p.inWater;
  const swimPitch = swimming ? -1.25 * gait : 0;
  const swimPhase = (p.swimPhase || clock * 6.5) * (p.swimBoost ? 1.3 : 1);
  const rootPitch = down ? -Math.PI / 2 * smooth((p.fallElapsed ?? .18) / .18)
    : gettingUp ? -Math.PI / 2 * smooth(p.getUpRemaining / .55)
    : swimming ? swimPitch : p.jumpHeight > 0 ? ((p.jumpVelocity ?? 0) >= 0 ? -.08 : .1) : (running ? -.13 : 0);
  const action = down ? 'fall' : gettingUp ? 'get-up' : swimming ? (moving ? 'swim' : 'tread-water')
    : p.transitionAction || (p.visualTransition ? (p.visualTransition.kind === 'enter' ? 'enter-vehicle' : 'exit-vehicle') : null) || (p.jumpHeight > 0 ? ((p.jumpVelocity ?? 0) >= 0 ? 'jump-rise' : 'jump-fall') : landing > 0 ? 'land'
    : reloading ? 'reload' : firing ? 'fire' : draw > 0 ? 'weapon-change' : strike > 0 ? (p.weapon === 'bat' ? 'bat-swing' : 'punch')
    : stagger > 0 ? 'stagger' : running ? 'run' : moving ? 'walk' : p.stance === 'handsUp' ? 'hands-up' : p.medicalTreated ? 'treated' : social || 'idle');
  const torsoPitch = swimming ? 0 : p.transitionAction ? -.16 : reloading ? -.13 * reloadReach : -.12 * strike + .13 * clamp(stagger) - .1 * landing + Math.sin(clock * 2) * .012;
  const torsoYaw = p.weapon === 'bat' && strike > 0 ? .38 * Math.sin(t / .42 * Math.PI * 2) : 0;
  const stride = Math.sin(phase) * (running ? .7 : .42) * gait;
  const arms = [-1, 1].map(side => {
    const punch = side === (p.attackSide || 1) ? strike : 0;
    let upper = -stride * side * (running ? 1.05 : .85) + .08;
    let lower = upper - (running ? .65 : .15);
    if (swimming) {
      const stroke = swimPhase + (side > 0 ? Math.PI : 0);
      upper = moving ? .7 + Math.sin(stroke) * 1.3 : 1.45 + Math.sin(stroke) * .35;
      lower = upper - .35 - Math.max(0, Math.cos(stroke)) * .9;
    } else if (down || gettingUp) { upper = .6; lower = 1.3; }
    else if (reloading) { upper = side > 0 ? .9 - reloadReach * .35 : .35 + reloadReach * .65; lower = side > 0 ? 1.1 : .7 + reloadReach * .9; }
    else if (gun && (side > 0 || p.weapon === 'shotgun' && aiming)) { upper = aiming ? 1.25 : .25 + draw * .55; lower = aiming ? 1.4 : -.35 + draw * 1.1; }
    else if (p.weapon === 'bat' && punch > 0) { upper = -.6 + punch * 2.3; lower = upper - .4; }
    else if (punch > 0) { upper = 1.65 * punch - .15; lower = upper - .15; }
    else if (p.jumpHeight > 0) { upper = -.35; lower = -.7; }
    else if (draw > 0) { upper = .35 + draw * .5; lower = .9; }
    else if (stagger > 0) { upper = .5; lower = 1.25; }
    else if (p.stance === 'handsUp') { upper = 2.55; lower = 2.75; }
    else if (p.transitionAction) { upper = .65; lower = 1.1; }
    else if (social === 'reading') { upper = .5; lower = 1.25; }
    else if (social === 'coffee' && side > 0) { upper = .55 + .25 * Math.sin(clock * 1.5); lower = 1.6 + .25 * Math.sin(clock * 1.5); }
    else if ((social === 'checkingPhone' || social === 'checkingTimetable') && side > 0) { upper = .5; lower = 1.35; }
    else if (social === 'talking') { upper = .3 + Math.sin(clock * 2.8 + side) * .2; lower = .8 + Math.sin(clock * 2.8 + side) * .3; }
    const recoil = firing ? .15 * clamp((p.shotRemaining || Math.max(0, .16 - t)) / .16) : 0;
    if (side > 0 && gun) { upper -= recoil; lower -= recoil; }
    return {upper, lower};
  });
  const legs = [-1, 1].map(side => {
    const upper = swimming ? Math.sin(swimPhase * 1.7 + side) * .28 : down || gettingUp ? -.2 : p.jumpHeight > 0 ? -.38 : stride * side - landing * .3;
    const knee = p.jumpHeight > 0 ? ((p.jumpVelocity ?? 0) >= 0 ? .65 : .85) : swimming ? .2 : gettingUp ? .65 * p.getUpRemaining / .55 : Math.max(0, -upper) * .9 + landing * .5;
    return {upper, lower: upper - knee};
  });
  const weaponPitch = p.weapon === 'bat' ? .25 + (1 - strike) * .65 : reloading ? -.5 - reloadReach * .65 : aiming ? (firing ? .12 : 0) : -.9 + draw * .6;
  return {action, rootPitch, rootRoll: swimming ? Math.sin(swimPhase) * .06 : 0, torsoPitch, torsoYaw,
    headYaw: moving || aiming || strike > 0 || ['reading','checkingPhone','coffee'].includes(social) ? 0 : Math.sin(clock * .8) * .12,
    headPitch: reloading || ['reading','checkingPhone','checkingTimetable'].includes(social) ? -.12 : 0, arms, legs, weaponPitch,
    item: social === 'coffee' ? 'cup' : social === 'reading' ? 'book' : social === 'checkingPhone' || social === 'checkingTimetable' ? 'phone' : p.activity === 'shopping' && !gun ? 'bag' : null,
    bob: swimming ? Math.sin(swimPhase) * .35 : Math.abs(Math.sin(phase)) * .3 * gait - landing * 1.3,
    waterBase: -5.4 - 20.8 * Math.cos(swimPitch) + 2 * Math.sin(-swimPitch), down, gettingUp};
}

export function presentedCharacters(player, people, foot) {
  const list = [...people], tr = player.visualTransition;
  if (foot) list.push({...player, heading:player.angle, shirt:'#b99964'});
  else if (tr?.kind === 'enter') list.push({...tr.person, heading:tr.heading, weapon:'fists', gait:1, animationTime:player.animationTime, walkPhase:tr.elapsed * 12, transitionAction:'enter-vehicle'});
  if (tr && (foot || tr.kind === 'enter')) {
    const actor = list[list.length - 1], t = smooth(tr.elapsed / tr.duration);
    const endX = foot ? player.x : tr.toX, endY = foot ? player.y : tr.toY;
    actor.x = tr.fromX + (endX - tr.fromX) * t; actor.y = tr.fromY + (endY - tr.fromY) * t;
    actor.heading = Math.atan2(endY-tr.fromY,endX-tr.fromX);
    actor.transitionAction = tr.kind === 'enter' ? 'enter-vehicle' : 'exit-vehicle';
    actor.gait = 1; actor.gaitBlend = 1; actor.walkPhase = tr.elapsed * 12;
  }
  return list;
}
