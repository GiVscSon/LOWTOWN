const wrappedAngle = angle => Math.atan2(Math.sin(angle), Math.cos(angle));

function projectedRadius(actor, angle, lateral = false) {
  const difference = (actor.angle || 0) - angle;
  const along = Math.abs(Math.cos(difference)) * (actor.width || 48) / 2 +
    Math.abs(Math.sin(difference)) * (actor.height || 24) / 2;
  const across = Math.abs(Math.sin(difference)) * (actor.width || 48) / 2 +
    Math.abs(Math.cos(difference)) * (actor.height || 24) / 2;
  return lateral ? across : along;
}

function sampledPathIsClear(unit, points, blocker, canOccupy, sampleStep) {
  let previous = { x: unit.x, y: unit.y, angle: unit.angle || 0 };
  for (const point of points) {
    const distance = Math.hypot(point.x - previous.x, point.y - previous.y);
    const targetAngle = wrappedAngle(Math.atan2(point.y - previous.y, point.x - previous.x)+(point.reverse?Math.PI:0));
    const turn = wrappedAngle(targetAngle - previous.angle);
    // The steering controller slows at corners. Reserve room for its chassis
    // throughout that turn, including when it rotates before translating.
    const turnSamples=Math.max(1,Math.ceil(Math.abs(turn)/.07));
    for(let index=0;index<=turnSamples;index+=1){
      if(!canOccupy({...unit,x:previous.x,y:previous.y,angle:previous.angle+turn*index/turnSamples},blocker))return false;
    }
    const samples = Math.max(1, Math.ceil(distance / sampleStep));
    for (let index = 1; index <= samples; index += 1) {
      const t = index / samples;
      const pose = {
        ...unit,
        x: previous.x + (point.x - previous.x) * t,
        y: previous.y + (point.y - previous.y) * t,
        angle: targetAngle
      };
      if (!canOccupy(pose, blocker)) return false;
    }
    previous = { x: point.x, y: point.y, angle: targetAngle };
  }
  return true;
}

export function emergencyPassingPathClear(unit,points,canOccupy,sampleStep=10){
  return sampledPathIsClear(unit,points,null,canOccupy,sampleStep);
}

/** Plan a short passing path; the caller validates the entire chassis and corridor. */
export function planEmergencyPassingManeuver(unit, actors, {
  canOccupy,
  lookAhead = 260,
  lateralPadding = 12,
  passPadding = 40,
  sampleStep = 10,
  maxForward = Infinity,
  offsets = [46, 58, 72, 86, 42, 38, 34, 30]
} = {}) {
  if (typeof canOccupy !== 'function' || !unit || !Number.isFinite(unit.x) || !Number.isFinite(unit.y)) return null;
  const angle = unit.angle || 0;
  const forwardX = Math.cos(angle), forwardY = Math.sin(angle);
  const sideX = -forwardY, sideY = forwardX;
  const blocker = (actors || []).filter(actor => actor && actor !== unit &&
    Number.isFinite(actor.x) && Number.isFinite(actor.y)).map(actor => {
    const dx = actor.x - unit.x, dy = actor.y - unit.y;
    const along = dx * forwardX + dy * forwardY;
    const across = dx * sideX + dy * sideY;
    const longitudinalRadius = projectedRadius(actor, angle);
    const lateralRadius = projectedRadius(actor, angle, true);
    return {
      actor, along, across,
      longitudinalClearance: (unit.width || 48) / 2 + longitudinalRadius + passPadding,
      lateralClearance: (unit.height || 24) / 2 + lateralRadius + lateralPadding
    };
  }).filter(item => item.along > 0 && item.along < lookAhead &&
    Math.abs(item.across) < item.lateralClearance)
    .sort((a, b) => a.along - b.along)[0];

  if (!blocker) return null;
  const entry = Math.max(10, blocker.along - blocker.longitudinalClearance);
  const pass = Math.max(entry + 22, blocker.along + blocker.longitudinalClearance);

  for (const offset of offsets) {
    if(pass+Math.max(42,offset+10)>maxForward)continue;
    for (const side of [1, -1]) {
      const forwardPoints = [
        { x: unit.x + forwardX * entry + sideX * side * offset,
          y: unit.y + forwardY * entry + sideY * side * offset },
        { x: unit.x + forwardX * pass + sideX * side * offset,
          y: unit.y + forwardY * pass + sideY * side * offset },
        { x: unit.x + forwardX * (pass + Math.max(42, offset + 10)),
          y: unit.y + forwardY * (pass + Math.max(42, offset + 10)) }
      ];
      for(const points of [forwardPoints,[{x:unit.x-forwardX*48,y:unit.y-forwardY*48,reverse:true},...forwardPoints]]){
       if (sampledPathIsClear(unit, points, blocker.actor, canOccupy, sampleStep)) {
        return { blocker: blocker.actor, points, side, offset, angle,
          remainingAdvance:maxForward-pass-Math.max(42,offset+10),
          lastBlockerPosition:{x:blocker.actor.x,y:blocker.actor.y},reason:'CLEAR_PASSING_LINE' };
       }
      }
    }
  }
  return { blocker: blocker.actor, points: [], side: 0, offset: 0, reason: 'NO_SAFE_PASSING_LINE' };
}
