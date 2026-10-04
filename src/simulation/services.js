// One shared runtime context owns state; this system has no hidden globals.
export function installSimulationServices(ctx){
const {chassis,contact,emergencyPassingPathClear,nearestStreet,onRoadSurface,planEmergencyPassingManeuver,roadPath,streetPoints}=ctx.dependencies;
ctx.advanceServiceRoute = function advanceServiceRoute(unit, dt) {
  const frame = ctx.env.Math.min(ctx.env.Math.max(Number(dt) || 0, 0), .05) * 60;
  if (!frame || !unit.route?.length) return;
  const passing = unit.emergencyManeuver;
  if (passing?.points.length && passing.lastBlockerPosition) {
    const along = (passing.blocker.x - passing.lastBlockerPosition.x) * ctx.env.Math.cos(passing.angle) + (passing.blocker.y - passing.lastBlockerPosition.y) * ctx.env.Math.sin(passing.angle);
    // Keep the merge point beyond a moving car instead of returning to its lane
    // using the position at which the initial maneuver was planned.
    const shift = ctx.env.Math.max(0, ctx.env.Math.min(along, passing.remainingAdvance));
    if (shift > 0 && !passing.recovering && ctx.emergencyPassingActors(unit).includes(passing.blocker)) {
      const shifted = passing.points.map((point, index) => index < passing.points.length - 2 ? point : {
        ...point,
        x: point.x + ctx.env.Math.cos(passing.angle) * shift,
        y: point.y + ctx.env.Math.sin(passing.angle) * shift
      });
      if (emergencyPassingPathClear(unit, shifted, pose => ctx.emergencyPassingGroundClear({
        ...pose,
        width: (pose.width || 48) + 10,
        height: (pose.height || 24) + 10
      }))) {
        passing.points = shifted;
        passing.remainingAdvance -= shift;
      }
    }
    passing.lastBlockerPosition = {
      x: passing.blocker.x,
      y: passing.blocker.y
    };
  }
  const path = unit.emergencyManeuver?.points || unit.route;
  const maneuver = !!unit.emergencyManeuver;
  while (path.length > (maneuver ? 0 : 1) && ctx.env.Math.hypot(path[0].x - unit.x, path[0].y - unit.y) < (passing?.recovering ? .5 : maneuver ? 4 : 8)) {
    if (path.shift().reverse) unit.speed = 0;
  }
  if (maneuver && !path.length) {
    if (Number.isFinite(passing.finalHeading)) {
      const error = ctx.env.Math.atan2(ctx.env.Math.sin(passing.finalHeading - unit.angle), ctx.env.Math.cos(passing.finalHeading - unit.angle));
      if (ctx.env.Math.abs(error) > .02) {
        const pose = {
          ...unit,
          angle: unit.angle + ctx.env.Math.sign(error) * ctx.env.Math.min(ctx.env.Math.abs(error), .105 * frame)
        };
        unit.speed = 0;
        if (ctx.policeFootprintOnRoad(pose) && ctx.emergencyPassingPoseClear(pose, unit)) {
          unit.angle = pose.angle;
          unit.rotationBlocked = false;
        } else {
          unit.emergencyStalled = (unit.emergencyStalled || 0) + dt;
          if (unit.emergencyStalled > 1) {
            unit.emergencyManeuver = null;
            unit.rotationBlocked = true;
            unit.emergencyPassCheck = .5;
          }
        }
        return;
      }
    }
    unit.emergencyManeuver = null;
    unit.emergencyBlocked = false;
    unit.emergencyPassCheck = .75;
    // A staged turn already faces the next street. Sending it back through
    // the old centre node restores the blocked nose-to-nose approach.
    if (passing?.reason === 'CLEAR_TURN' && unit.route?.length) return;
    const destination = unit.responseTarget || unit.route.at(-1);
    if (destination) unit.route = ctx.serviceRoadPath(unit, destination).slice(1);
    return;
  }
  const target = path[0],
    distance = ctx.env.Math.hypot(target.x - unit.x, target.y - unit.y);
  const wanted = ctx.env.Math.atan2(target.y - unit.y, target.x - unit.x) + (target.reverse ? ctx.env.Math.PI : 0);
  const diff = ctx.env.Math.atan2(ctx.env.Math.sin(wanted - unit.angle), ctx.env.Math.cos(wanted - unit.angle));
  const old = {
    x: unit.x,
    y: unit.y,
    angle: unit.angle
  };
  unit.angle += ctx.env.Math.sign(diff) * ctx.env.Math.min(ctx.env.Math.abs(diff), .105 * frame);
  const turning = ctx.env.Math.abs(diff) > .12;
  const blocker = unit.emergencyBlocker;
  const waitingGap = blocker ? ctx.env.Math.hypot(blocker.x - unit.x, blocker.y - unit.y) - (ctx.env.Math.hypot(unit.width || 48, unit.height || 24) + ctx.env.Math.hypot(blocker.width || 48, blocker.height || 24)) / 2 - 16 : 0;
  // An unavailable passing lane does not require stopping far back in the
  // previous junction. Approach the obstruction while preserving a safe gap.
  const speedLimit = unit.emergencyBlocked ? ctx.env.Math.min(unit.maxSpeed, ctx.env.Math.max(0, waitingGap) / 18) : unit.maxSpeed;
  const desired = turning ? 0 : (target.reverse ? -ctx.env.Math.min(2, speedLimit) : speedLimit) * ctx.env.Math.min(1, distance / 50);
  unit.speed += (desired - unit.speed) * (1 - ctx.env.Math.pow(1 - (unit.model === 'fireEngine' ? .075 : .12), frame));
  if (turning) unit.speed = 0;
  const step = ctx.env.Math.min(distance, ctx.env.Math.abs(unit.speed) * frame) * ctx.env.Math.sign(unit.speed);
  unit.x += ctx.env.Math.cos(unit.angle) * step;
  unit.y += ctx.env.Math.sin(unit.angle) * step;
  if (!ctx.serviceFootprintSupported(unit) || unit.priorityPassing !== false && !ctx.emergencyPassingPoseClear(unit, unit)) {
    unit.x = old.x;
    unit.y = old.y;
    unit.speed = 0;
    if (!ctx.serviceFootprintSupported(unit) || unit.priorityPassing !== false && !ctx.emergencyPassingPoseClear(unit, unit)) {
      unit.angle = old.angle;
      unit.rotationBlocked = ctx.env.Math.abs(diff) > .12;
    } else unit.rotationBlocked = false;
    if (maneuver) {
      unit.emergencyStalled = (unit.emergencyStalled || 0) + dt;
      if (unit.emergencyStalled > 1 && !passing.recovering) {
        if (ctx.policeFootprintOnRoad(unit)) {
          unit.emergencyManeuver = null;
          unit.emergencyPassCheck = 1.5;
          const destination = unit.responseTarget || unit.route.at(-1);
          if (destination) unit.route = ctx.serviceRoadPath(unit, destination).slice(1);
        } else {
          // Retrace the verified approach instead of abandoning a vehicle on
          // the pavement with an unreachable merge point.
          passing.points = [...(passing.trail || [])].reverse().filter(p => ctx.env.Math.hypot(p.x - unit.x, p.y - unit.y) > .5).map(p => ({
            ...p,
            reverse: true
          }));
          passing.recovering = true;
          unit.emergencyRecoveries = (unit.emergencyRecoveries || 0) + 1;
        }
        unit.emergencyStalled = 0;
      }
    }
  } else {
    unit.rotationBlocked = false;
    unit.emergencyStalled = 0;
    if (passing && !passing.recovering) {
      const last = passing.trail?.at(-1);
      if (!last || ctx.env.Math.hypot(unit.x - last.x, unit.y - last.y) > 8) (passing.trail ||= []).push({
        x: unit.x,
        y: unit.y,
        angle: unit.angle
      });
    }
  }
  const progress = ctx.env.Math.hypot(unit.x - old.x, unit.y - old.y);
  unit.emergencyMotionStall = progress < .05 && distance > 4 ? (unit.emergencyMotionStall || 0) + dt : 0;
  if (progress > .05 && !target.reverse) unit.emergencyReverseDistance = 0;
};
ctx.emergencyPassingActors = function emergencyPassingActors(unit) {
  const groundFleet = (ctx.roam?.fleet || []).filter(actor => actor.kind !== 'water');
  const playerIsAirborne = (ctx.roam?.altitude || 0) > 12;
  const actors = [...ctx.trafficCars, ...ctx.parkedCars, ...ctx.policeCars, ...ctx.incidentPoliceCars, ...ctx.incidentResponseVehicles, ...groundFleet, ...(!playerIsAirborne && ctx.roam?.mode !== 'foot' && !unit.role ? [ctx.player] : [])];
  return [...new Set(actors)].filter(actor => actor && actor !== unit);
};
ctx.emergencyPassingGroundClear = function emergencyPassingGroundClear(pose) {
  const cs = ctx.env.Math.cos(pose.angle || 0),
    sn = ctx.env.Math.sin(pose.angle || 0),
    hl = (pose.width || 48) / 2,
    hw = (pose.height || 24) / 2;
  if (!ctx.policeFootprintOnRoad(pose) && ![[0, 0], [hl, hw], [hl, -hw], [-hl, hw], [-hl, -hw]].every(([x, y]) => ctx.isPositionOnSolidGround(pose.x + x * cs - y * sn, pose.y + x * sn + y * cs))) return false;
  const body = chassis(pose);
  const radius = ctx.env.Math.hypot(hl, hw);
  const near = (x, y, w, h) => ctx.env.Math.abs(pose.x - x) <= w / 2 + radius && ctx.env.Math.abs(pose.y - y) <= h / 2 + radius;
  const overlaps = rect => {
    const width = rect.w || rect.width || 12,
      height = rect.h || rect.height || 12,
      x = rect.x + width / 2,
      y = rect.y + height / 2;
    return near(x, y, width, height) && contact(body, chassis({
      x,
      y,
      width,
      height,
      angle: rect.angle || 0
    }));
  };
  if (ctx.buildings.some(building => overlaps(building))) return false;
  if (ctx.trees.some(tree => near(tree.x, tree.y, 20, 20) && contact(body, chassis({
    x: tree.x,
    y: tree.y,
    width: 20,
    height: 20
  })))) return false;
  if (ctx.solidProps.some(prop => {
    const width = prop.width || 12,
      height = prop.height || 12,
      bounds = ctx.env.Math.hypot(width, height);
    return near(prop.x, prop.y, bounds, bounds) && contact(body, chassis({
      x: prop.x,
      y: prop.y,
      width,
      height,
      angle: prop.angle || 0
    }));
  })) return false;
  if (ctx.bridgeRails.some(rail => overlaps(rail))) return false;
  // The passing planner must reserve the same solid organic parapets as the
  // contact solver; otherwise a staged turn is planned through the guardrail.
  if (ctx.getCityScenery().contacts.query(pose.x-radius,pose.y-radius,pose.x+radius,pose.y+radius).some(rail=>rail.type==='bridgeRail'&&contact(body,chassis(rail)))) return false;
  return true;
};
ctx.serviceFootprintSupported = function serviceFootprintSupported(unit) {
  return ctx.policeFootprintOnRoad(unit) || !!unit.emergencyManeuver && ctx.emergencyPassingGroundClear(unit);
};
ctx.emergencyPassingPoseClear = function emergencyPassingPoseClear(pose, unit = pose) {
  if (!ctx.emergencyPassingGroundClear(pose)) return false;
  const body = chassis(pose);
  const halfLength = (pose.width || 48) / 2,
    halfWidth = (pose.height || 24) / 2;
  const cs = ctx.env.Math.abs(ctx.env.Math.cos(pose.angle || 0)),
    sn = ctx.env.Math.abs(ctx.env.Math.sin(pose.angle || 0));
  const extentX = halfLength * cs + halfWidth * sn,
    extentY = halfLength * sn + halfWidth * cs;
  const near = (x, y, width, height, angle = 0) => {
    const ac = ctx.env.Math.abs(ctx.env.Math.cos(angle)),
      as = ctx.env.Math.abs(ctx.env.Math.sin(angle));
    return ctx.env.Math.abs(pose.x - x) <= extentX + (width * ac + height * as) / 2 + 12 && ctx.env.Math.abs(pose.y - y) <= extentY + (width * as + height * ac) / 2 + 12;
  };
  for (const person of ctx.pedestrians) {
    if (near(person.x, person.y, 18, 18) && contact(body, chassis({
      x: person.x,
      y: person.y,
      width: 18,
      height: 18,
      angle: person.angle || 0
    }))) return false;
  }
  if (ctx.roam?.mode === 'foot' && near(ctx.player.x, ctx.player.y, 18, 18) && contact(body, chassis({
    x: ctx.player.x,
    y: ctx.player.y,
    width: 18,
    height: 18,
    angle: ctx.player.angle || 0
  }))) return false;
  const actorClear = actor => {
    if (!actor || actor === unit) return true;
    const width = actor.width || 48,
      height = actor.height || 24;
    return !near(actor.x, actor.y, width, height, actor.angle || 0) || !contact(body, chassis({
      ...actor,
      width,
      height
    }));
  };
  for (const list of [ctx.trafficCars, ctx.parkedCars, ctx.policeCars, ctx.incidentPoliceCars, ctx.incidentResponseVehicles]) {
    for (const actor of list) if (!actorClear(actor)) return false;
  }
  for (const actor of ctx.roam?.fleet || []) {
    if (actor.kind !== 'air' && actor.kind !== 'water' && !actorClear(actor)) return false;
  }
  const playerIsAirborne = (ctx.roam?.altitude || 0) > 12;
  if (!playerIsAirborne && ctx.roam?.mode !== 'foot' && !unit.role && !actorClear(ctx.player)) return false;
  return true;
};
ctx.tryReverseForServiceYield = function tryReverseForServiceYield(unit) {
  // A yielding bus may need room to straighten before either responder can
  // pass it. Back away on the verified lane instead of waiting nose to nose.
  if (unit.emergencyMotionStall > 1 && !unit.emergencyReverseWait && (unit.emergencyReverseDistance || 0) < 128) {
    const nearby = ctx.emergencyPassingActors(unit).some(actor => (actor.routeManaged || ['enroute', 'returning'].includes(actor.status)) && ctx.env.Math.hypot(actor.x - unit.x, actor.y - unit.y) < 140);
    if (nearby) for (const distance of [32, 48, 64]) {
      const stage = {
        x: unit.x - ctx.env.Math.cos(unit.angle) * distance,
        y: unit.y - ctx.env.Math.sin(unit.angle) * distance,
        reverse: true
      };
      if (!emergencyPassingPathClear(unit, [stage], pose => ctx.policeFootprintOnRoad(pose) && ctx.emergencyPassingPoseClear(pose, unit), 4)) continue;
      unit.emergencyManeuver = {
        points: [stage],
        trail: [{
          x: unit.x,
          y: unit.y,
          angle: unit.angle
        }],
        reason: 'MAKE_YIELD_ROOM'
      };
      unit.emergencyBlocked = false;
      unit.emergencyMotionStall = 0;
      unit.emergencyReverseWait = 5;
      unit.emergencyReverseDistance = (unit.emergencyReverseDistance || 0) + distance;
      return true;
    }
  }
  return false;
};
ctx.yieldBetweenResponders = function yieldBetweenResponders(unit) {
  if (unit.priorityPassing === false) return false;
  const responders = [...ctx.incidentPoliceCars, ...ctx.incidentResponseVehicles];
  const rank = u => u.model === 'fireEngine' ? 3 : u.model === 'ambulance' ? 2 : 1;
  let leader = unit.cooperativeYield;
  if (leader && (!responders.includes(leader) || ctx.env.Math.hypot(leader.x - unit.x, leader.y - unit.y) > 190)) {
    unit.cooperativeYield = null;
    leader = null;
  }
  if (!leader) {
    const index = responders.indexOf(unit);
    leader = responders.find(other => other !== unit && ['enroute', 'returning'].includes(other.status) && (rank(other) > rank(unit) || rank(other) === rank(unit) && responders.indexOf(other) < index) && ctx.env.Math.hypot(other.x - unit.x, other.y - unit.y) < 150 && (other.rotationBlocked || other.emergencyMotionStall > 1) && unit.emergencyMotionStall > 1);
    if (!leader) return false;
    unit.cooperativeYield = leader;
  }
  if (unit.emergencyManeuver) return false;
  const next = unit.route?.[0];
  const ahead = (unit.x - leader.x) * ctx.env.Math.cos(leader.angle) + (unit.y - leader.y) * ctx.env.Math.sin(leader.angle);
  const wanted = next ? ctx.env.Math.atan2(next.y - unit.y, next.x - unit.x) : null;
  // A responder already ahead on the same road clears forward. Reversing
  // would approach its follower; holding would permanently block the convoy.
  if (ahead > 20 && wanted !== null && ctx.env.Math.cos(wanted - leader.angle) > .9 && ctx.env.Math.cos(unit.angle - leader.angle) > .8) {
    const turn = ctx.env.Math.atan2(ctx.env.Math.sin(wanted - unit.angle), ctx.env.Math.cos(wanted - unit.angle));
    if (ctx.env.Math.abs(turn) > .12) for (const distance of [64, 48, 32]) {
      const stage = {
        x: unit.x + ctx.env.Math.cos(unit.angle) * distance,
        y: unit.y + ctx.env.Math.sin(unit.angle) * distance
      };
      if (!emergencyPassingPathClear(unit, [stage], pose => ctx.policeFootprintOnRoad(pose) && ctx.emergencyPassingPoseClear(pose, unit), 4)) continue;
      unit.emergencyManeuver = {
        points: [stage],
        finalHeading: wanted,
        trail: [{
          x: unit.x,
          y: unit.y,
          angle: unit.angle
        }],
        reason: 'CLEAR_TURN'
      };
      unit.cooperativeYield = null;
      unit.emergencyBlocked = false;
      unit.emergencyMotionStall = 0;
      return false;
    }
    if (ctx.env.Math.abs(turn) <= .12) {
      unit.cooperativeYield = null;
      return false;
    }
  }
  // A responder ahead of the leader may need to return in the opposite
  // direction. Clear its current nose into the other lane, then travel beyond
  // the leader before merging; reversing here would enter the follower.
  if (ahead > 20 && wanted !== null && ctx.env.Math.cos(wanted - leader.angle) < -.8) {
    for (const distance of [68, 64, 72, 48, 32, 80, 96]) {
      const stage = {
        x: unit.x + ctx.env.Math.cos(unit.angle) * distance,
        y: unit.y + ctx.env.Math.sin(unit.angle) * distance
      };
      const exit = {
        x: stage.x - ctx.env.Math.cos(leader.angle) * 160,
        y: stage.y - ctx.env.Math.sin(leader.angle) * 160
      };
      if (!emergencyPassingPathClear(unit, [stage, exit], pose => ctx.policeFootprintOnRoad(pose) && ctx.emergencyPassingPoseClear(pose, unit), 4)) continue;
      unit.emergencyManeuver = {
        points: [stage, exit],
        trail: [{
          x: unit.x,
          y: unit.y,
          angle: unit.angle
        }],
        reason: 'RESPONDER_RETURN_CLEAR'
      };
      unit.cooperativeYield = null;
      unit.emergencyBlocked = false;
      unit.emergencyMotionStall = 0;
      return false;
    }
  }
  // Keep the space open after reversing; immediately rejoining was restoring
  // the very same three-vehicle blockage on every planning cycle.
  if (ctx.env.Math.hypot(leader.x - unit.x, leader.y - unit.y) < 115) {
    for (const distance of [64, 48, 32, 24, 16, 8]) {
      const stage = {
        x: unit.x - ctx.env.Math.cos(unit.angle) * distance,
        y: unit.y - ctx.env.Math.sin(unit.angle) * distance,
        reverse: true
      };
      // A diagonal chassis may only have room for a short first retreat.
      // Increase separation in verified steps rather than requiring the full
      // waiting gap before allowing either vehicle to move.
      if (ctx.env.Math.hypot(stage.x - leader.x, stage.y - leader.y) < ctx.env.Math.hypot(unit.x - leader.x, unit.y - leader.y) + 4) continue;
      if (!emergencyPassingPathClear(unit, [stage], pose => ctx.policeFootprintOnRoad(pose) && ctx.emergencyPassingPoseClear(pose, unit), 4)) continue;
      unit.emergencyManeuver = {
        points: [stage],
        trail: [{
          x: unit.x,
          y: unit.y,
          angle: unit.angle
        }],
        reason: 'RESPONDER_YIELD'
      };
      unit.emergencyBlocked = false;
      unit.emergencyMotionStall = 0;
      return false;
    }
  }
  unit.speed = 0;
  return true;
};
ctx.recoverServiceRoad = function recoverServiceRoad(unit) {
  if (unit.emergencyManeuver || ctx.policeFootprintOnRoad(unit) || !ctx.emergencyPassingGroundClear(unit)) return false;
  const candidates = [...ctx.roads, ...ctx.bridges.filter(b => !b.footway)].map(r => nearestStreet(unit.x, unit.y, [r])).filter(p => p && p.distance < 180).sort((a, b) => a.distance - b.distance);
  for (const point of candidates) {
    const goal = unit.route?.[0],
      finalHeading = goal ? ctx.env.Math.atan2(goal.y - point.y, goal.x - point.x) : unit.angle;
    if (!ctx.policeFootprintOnRoad({
      ...unit,
      ...point,
      angle: finalHeading
    })) continue;
    const end = {
      x: point.x + ctx.env.Math.cos(finalHeading),
      y: point.y + ctx.env.Math.sin(finalHeading)
    };
    if (!emergencyPassingPathClear(unit, [point, end], pose => ctx.emergencyPassingGroundClear(pose) && ctx.emergencyPassingPoseClear(pose, unit), 4)) continue;
    unit.emergencyManeuver = {
      points: [point],
      finalHeading,
      trail: [{
        x: unit.x,
        y: unit.y,
        angle: unit.angle
      }],
      reason: 'ROAD_RECOVERY'
    };
    unit.emergencyBlocked = false;
    unit.cooperativeYield = null;
    unit.emergencyMotionStall = 0;
    return true;
  }
  return false;
};
ctx.tryPlanEmergencyPassing = function tryPlanEmergencyPassing(unit, dt) {
  if (ctx.recoverServiceRoad(unit)) return;
  unit.emergencyReverseWait = ctx.env.Math.max(0, (unit.emergencyReverseWait || 0) - dt);
  if (!['enroute', 'returning'].includes(unit.status) || unit.priorityPassing === false) {
    unit.emergencyBlocked = false;
    return;
  }
  if (unit.emergencyManeuver?.points?.length) return;
  unit.emergencyPassCheck = ctx.env.Math.max(0, (unit.emergencyPassCheck || 0) - dt);
  if (unit.emergencyPassCheck > 0) return;
  unit.emergencyPassCheck = .25;
  const next = unit.route?.[0];
  if (next) {
    const error = ctx.env.Math.atan2(ctx.env.Math.sin(ctx.env.Math.atan2(next.y - unit.y, next.x - unit.x) - unit.angle), ctx.env.Math.cos(ctx.env.Math.atan2(next.y - unit.y, next.x - unit.x) - unit.angle));
    if (ctx.env.Math.abs(error) > ctx.env.Math.PI * .6 || unit.rotationBlocked && ctx.env.Math.abs(error) > .12) {
      for (const heading of [...new Set([ctx.env.Math.round(unit.angle / (ctx.env.Math.PI / 2)) * ctx.env.Math.PI / 2, unit.angle])]) {
        for (const reverse of [false, true]) for (const distance of [32, 48, 64, 96, 128]) {
          const direction = reverse ? -1 : 1;
          const stage = {
            x: unit.x + ctx.env.Math.cos(heading) * distance * direction,
            y: unit.y + ctx.env.Math.sin(heading) * distance * direction,
            reverse
          };
          const finalHeading = ctx.env.Math.atan2(next.y - stage.y, next.x - stage.x);
          const points = [stage, {
            x: stage.x + ctx.env.Math.cos(finalHeading),
            y: stage.y + ctx.env.Math.sin(finalHeading)
          }];
          if (!emergencyPassingPathClear(unit, points, pose => {
            const reserved = ctx.env.Math.hypot(pose.x - unit.x, pose.y - unit.y) < 10 ? pose : {
              ...pose,
              width: (pose.width || 48) + 8,
              height: (pose.height || 24) + 8
            };
            return ctx.policeFootprintOnRoad(reserved) && ctx.emergencyPassingPoseClear(reserved, unit);
          })) continue;
          unit.emergencyManeuver = {
            points: [stage],
            finalHeading,
            trail: [{
              x: unit.x,
              y: unit.y,
              angle: unit.angle
            }],
            reason: 'CLEAR_TURN'
          };
          unit.emergencyTurns = (unit.emergencyTurns || 0) + 1;
          unit.emergencyBlocked = false;
          return;
        }
      }
    }
  }
  if (next && ctx.env.Math.abs(ctx.env.Math.atan2(ctx.env.Math.sin(ctx.env.Math.atan2(next.y - unit.y, next.x - unit.x) - unit.angle), ctx.env.Math.cos(ctx.env.Math.atan2(next.y - unit.y, next.x - unit.x) - unit.angle))) > .32) {
    unit.emergencyBlocked = false;
    unit.emergencyPassCheck = .75;
    ctx.tryReverseForServiceYield(unit);
    return;
  }
  let corridor = next ? ctx.env.Math.hypot(next.x - unit.x, next.y - unit.y) : 260;
  let reachesDestination = true;
  for (const point of unit.route || []) {
    const dx = point.x - unit.x,
      dy = point.y - unit.y;
    if (ctx.env.Math.abs(-dx * ctx.env.Math.sin(unit.angle) + dy * ctx.env.Math.cos(unit.angle)) > 16) {
      reachesDestination = false;
      break;
    }
    corridor = ctx.env.Math.max(corridor, dx * ctx.env.Math.cos(unit.angle) + dy * ctx.env.Math.sin(unit.angle));
  }
  // A curbside vehicle can enter the planner's precautionary corridor while
  // leaving the actual route open, particularly after merging back to it.
  // Keep following that route when its turn and immediate approach are clear.
  if (next) {
    const distance = ctx.env.Math.hypot(next.x - unit.x, next.y - unit.y),
      length = ctx.env.Math.min(distance, 100);
    const point = {
      x: unit.x + (next.x - unit.x) * length / ctx.env.Math.max(distance, 1),
      y: unit.y + (next.y - unit.y) * length / ctx.env.Math.max(distance, 1)
    };
    if (emergencyPassingPathClear(unit, [point], pose => ctx.policeFootprintOnRoad(pose) && ctx.emergencyPassingPoseClear(pose, unit), 4)) {
      unit.emergencyBlocked = false;
      unit.emergencyBlocker = null;
      return;
    }
  }
  const plan = planEmergencyPassingManeuver(unit, ctx.emergencyPassingActors(unit), {
    canOccupy: pose => ctx.emergencyPassingPoseClear(ctx.env.Math.hypot(pose.x - unit.x, pose.y - unit.y) < 10 ? pose : {
      ...pose,
      width: (pose.width || 48) + 10,
      height: (pose.height || 24) + 10
    }, unit),
    lookAhead: ctx.env.Math.min(260, corridor),
    maxForward: reachesDestination ? corridor + 260 : ctx.env.Math.max(0, corridor - 15),
    canRejoin: pose => ctx.policeFootprintOnRoad(pose)
  });
  unit.emergencyBlocked = !!plan && !plan.points.length;
  if (unit.emergencyBlocked) unit.emergencyPassCheck = 1;
  unit.emergencyBlocker = unit.emergencyBlocked ? plan.blocker : null;
  if (!plan?.points.length) {
    ctx.tryReverseForServiceYield(unit);
    return;
  }
  unit.emergencyManeuver = plan;
  plan.trail = [{
    x: unit.x,
    y: unit.y,
    angle: unit.angle
  }];
  unit.emergencyPasses = (unit.emergencyPasses || 0) + 1;
  unit.emergencyBlocked = false;
};
ctx.incidentLocation = function incidentLocation(kind, anchor) {
  if (kind === 'crash') {
    const bay = ctx.responseParkingTarget(anchor, 'crash', false);
    return bay ? {
      ...bay,
      site: 'street'
    } : null;
  }
  const candidates = ctx.buildings.filter(b => !b.serviceParcel).sort((a, b) => ctx.env.Math.hypot(a.x + a.w / 2 - anchor.x, a.y + a.h - anchor.y) - ctx.env.Math.hypot(b.x + b.w / 2 - anchor.x, b.y + b.h - anchor.y));
  for (const b of candidates.slice(0, 30)) for (const offset of [32, 48, 64]) {
    const facing = b.streetFacing || 'south',
      x = facing === 'east' ? b.x + b.w + offset : facing === 'west' ? b.x - offset : b.x + b.w / 2,
      y = facing === 'north' ? b.y - offset : facing === 'south' ? b.y + b.h + offset : b.y + b.h / 2;
    if (ctx.env.Math.hypot(x - anchor.x, y - anchor.y) > 600) continue;
    if ([[-40, 18], [0, 0], [0, 18], [60, 28]].every(([dx, dy]) => !ctx.isPedestrianBlocked(x + dx, y + dy) && !onRoadSurface(x + dx, y + dy, ctx.roads, ctx.bridges, ctx.scenicRoads, ctx.roadEnds))) return {
      x,
      y,
      site: 'building',
      buildingSign: b.sign
    };
  }
  return null;
};
ctx.responseParkingTarget = // Reserve different full-body parking positions on straight streets. Graph
// junction nodes are routing waypoints, never the shared parking destination.
function responseParkingTarget(incident, model, reserve = true) {
  const junctions = ctx.buildRoadPaintGeometry().junctions.filter(j => j.horizontalRoads.some(r => !r.serviceAccess) && j.verticalRoads.some(r => !r.serviceAccess));
  const reserved = reserve ? [...ctx.incidentPoliceCars, ...ctx.incidentResponseVehicles].filter(u => u.responseIncidentId === incident.id).map(u => u.responseTarget) : [];
  const candidates = [];
  for (const r of ctx.roads) {
    if (r.bridgeApproach || r.serviceAccess) continue;
    let points = typeof streetPoints === 'function' ? streetPoints(r) : r.dir === 'h' ? [[r.x, r.y + r.h / 2], [r.x + r.w, r.y + r.h / 2]] : [[r.x + r.w / 2, r.y], [r.x + r.w / 2, r.y + r.h]];
    if (points.length === 2) {
      const [a, b] = points,
        n = ctx.env.Math.ceil(ctx.env.Math.hypot(b[0] - a[0], b[1] - a[1]) / 40);
      points = Array.from({
        length: n + 1
      }, (_, i) => [a[0] + (b[0] - a[0]) * i / n, a[1] + (b[1] - a[1]) * i / n]);
    }
    for (let i = 3; i < points.length - 3; i += 2) for (const side of [-1, 1]) {
      const a = points[i - 1],
        b = points[i + 1],
        heading = ctx.env.Math.atan2(b[1] - a[1], b[0] - a[0]);
      const p = {
        x: points[i][0] - ctx.env.Math.sin(heading) * side * 24,
        y: points[i][1] + ctx.env.Math.cos(heading) * side * 24,
        parkingHeading: heading
      };
      if (ctx.env.Math.hypot(p.x - incident.x, p.y - incident.y) > 2200 || reserved.some(t => ctx.env.Math.hypot(p.x - t.x, p.y - t.y) < 115) || model !== 'crash' && ctx.env.Math.hypot(p.x - incident.x, p.y - incident.y) < 100 || junctions.some(j => ctx.env.Math.hypot(p.x - (j.cx ?? j.x + j.w / 2), p.y - (j.cy ?? j.y + j.h / 2)) < j.w / 2 + 120)) continue;
      const pose = {
        ...p,
        width: 84,
        height: 38,
        angle: heading
      };
      if (!ctx.policeFootprintOnRoad(pose) || !ctx.emergencyPassingGroundClear(pose)) continue;
      candidates.push({
        ...p,
        distance: ctx.env.Math.hypot(p.x - incident.x, p.y - incident.y)
      });
    }
  }
  candidates.sort((a, b) => a.distance - b.distance);
  return candidates[0] || null;
};
ctx.serviceRoadPath = function serviceRoadPath(start, target) {
  const route = roadPath(ctx.roadGraph, start, target, {
    fromSegment: true
  });
  if (!route.length || !target.parkingAxis && !Number.isFinite(target.parkingHeading)) return route;
  const end = route.at(-1);
  if (ctx.env.Math.hypot(end.x - target.x, end.y - target.y) < 1) return route;
  // A shallow approach reaches the kerb without pivoting across a lane.
  const previous = route.at(-2) || start,
    heading = target.parkingHeading ?? (target.parkingAxis === 'h' ? 0 : ctx.env.Math.PI / 2);
  const cs = ctx.env.Math.cos(heading),
    sn = ctx.env.Math.sin(heading),
    sign = ctx.env.Math.sign((end.x - previous.x) * cs + (end.y - previous.y) * sn) || 1;
  const approach = {
    x: end.x - cs * sign * 100,
    y: end.y - sn * sign * 100
  };
  if (ctx.env.Math.hypot(previous.x - end.x, previous.y - end.y) > 105) route.splice(-1, 1, approach, {
    ...target
  });else route.push({
    ...target
  });
  return route;
};
ctx.dispatchIncidentPolice = function dispatchIncidentPolice(incident) {
  if (!incident || incident.policeDispatched || !ctx.roadGraph.length) return false;
  const target = ctx.responseParkingTarget(incident, 'police');
  if (!target) return false;
  const candidates = ctx.serviceBases.filter(base => base.kind === 'police').map(base => ({
    base,
    node: base.origin,
    distance: ctx.env.Math.hypot(base.origin.x - target.x, base.origin.y - target.y)
  })).sort((a, b) => a.distance - b.distance);
  if (!candidates.length) return false;
  const supportedCandidates = candidates.flatMap(({
    node,
    base
  }) => {
    const route = ctx.serviceRoadPath(node, target);
    if (route.length < 2) return [];
    const angle = ctx.env.Math.atan2(route[1].y - route[0].y, route[1].x - route[0].x),
      cs = ctx.env.Math.cos(angle),
      sn = ctx.env.Math.sin(angle);
    const supported = [[24, 12], [24, -12], [-24, 12], [-24, -12]].every(([x, y]) => onRoadSurface(node.x + x * cs - y * sn, node.y + x * sn + y * cs, ctx.roads, ctx.bridges, ctx.scenicRoads, ctx.roadEnds));
    return supported ? [{
      node,
      route,
      base
    }] : [];
  });
  if (!supportedCandidates.length) return false;
  const {
    node: start,
    route,
    base
  } = supportedCandidates[0];
  ctx.incidentPoliceCars.push({
    x: start.x,
    y: start.y,
    angle: ctx.env.Math.atan2(route[1].y - route[0].y, route[1].x - route[0].x),
    speed: 0,
    maxSpeed: 5.6,
    width: 48,
    height: 24,
    model: 'police',
    route: route.slice(1),
    routeTimer: 1,
    responseTarget: {
      ...target
    },
    baseTarget: {
      ...base.origin
    },
    responseBase: base.building.sign,
    status: 'enroute',
    responseIncidentId: incident.id,
    strobePhase: 0,
    arrived: false,
    arrivalTimer: 0
  });
  incident.policeDispatched = true;
  incident.timer = ctx.env.Math.max(incident.timer, ctx.responseRouteLength(route) / (5.6 * 60) * 1.65 + 12);
  return true;
};
ctx.updateIncidentPolice = function updateIncidentPolice(dt) {
  const frame = ctx.env.Math.min(ctx.env.Math.max(dt, 0), .05) * 60;
  for (let i = ctx.incidentPoliceCars.length - 1; i >= 0; i--) {
    const unit = ctx.incidentPoliceCars[i];
    unit.strobePhase = (unit.strobePhase || 0) + dt * 12;
    if (unit.arrived) {
      unit.arrivalTimer -= dt;
      if (unit.arrivalTimer <= 0) {
        unit.arrived = false;
        ctx.beginIncidentResponseReturn(unit);
      }
      continue;
    }
    const responseDistance = ctx.env.Math.hypot(unit.responseTarget.x - unit.x, unit.responseTarget.y - unit.y);
    if (responseDistance < (unit.status === 'returning' ? 18 : 6) && !unit.emergencyManeuver && !unit.emergencyBlocked) {
      if (unit.status === 'returning') {
        unit.returnedToBase = true;
        ctx.incidentPoliceCars.splice(i, 1);
        continue;
      }
      unit.emergencyManeuver = null;
      unit.emergencyBlocked = false;
      unit.arrived = true;
      unit.status = 'onscene';
      unit.arrivalTimer = 8;
      unit.speed = 0;
      continue;
    }
    if (!unit.route?.length) unit.route = ctx.serviceRoadPath(unit, unit.responseTarget);
    if (ctx.yieldBetweenResponders(unit)) continue;
    ctx.tryPlanEmergencyPassing(unit, dt);
    ctx.advanceServiceRoute(unit, dt);
  }
};
ctx.nearestRoadNode = function nearestRoadNode(point) {
  return ctx.roadGraph.reduce((best, node) => ctx.env.Math.hypot(node.x - point.x, node.y - point.y) < ctx.env.Math.hypot(best.x - point.x, best.y - point.y) ? node : best, ctx.roadGraph[0]);
};
ctx.nearestResponseRoadNode = function nearestResponseRoadNode(point) {
  // End nodes can support a point while leaving the nose of a truck over water.
  const nearest = [...ctx.roadGraph].sort((a, b) => (a.x - point.x) ** 2 + (a.y - point.y) ** 2 - (b.x - point.x) ** 2 - (b.y - point.y) ** 2);
  return nearest.find(node => [0, ctx.env.Math.PI / 2].every(angle => ctx.policeFootprintOnRoad({
    ...node,
    width: 72,
    height: 34,
    angle
  }))) || nearest[0];
};
ctx.responseRouteLength = function responseRouteLength(route) {
  let length = 0;
  for (let i = 1; i < route.length; i++) length += ctx.env.Math.hypot(route[i].x - route[i - 1].x, route[i].y - route[i - 1].y);
  return length;
};
ctx.dispatchIncidentResponse = function dispatchIncidentResponse(incident) {
  if (!incident || incident.responseDispatched || incident.responseDispatchAttempted || !ctx.roadGraph.length) return 0;
  const services = incident.kind === 'fire' ? ['fireEngine', 'ambulance'] : ['crash', 'fight', 'killing'].includes(incident.kind) ? ['ambulance'] : [];
  incident.responseDispatchAttempted = true;
  if (!services.length) return 0;
  const dispatchedServices = [];
  for (const serviceType of services) {
    const target = ctx.responseParkingTarget(incident, serviceType);
    if (!target) continue;
    const civicType = serviceType === 'fireEngine' ? 'firestation' : 'hospital';
    const bases = ctx.serviceBases.filter(base => base.kind === civicType).map(base => ({
      ...base.origin,
      building: base.building
    })).sort((a, b) => ctx.env.Math.hypot(a.x - incident.x, a.y - incident.y) - ctx.env.Math.hypot(b.x - incident.x, b.y - incident.y));
    const candidates = [];
    for (const base of bases.slice(0, 5)) {
      const start = ctx.nearestRoadNode(base);
      const route = ctx.serviceRoadPath(start, target);
      if (route.length < 2 || !route.every(node => onRoadSurface(node.x, node.y, ctx.roads, ctx.bridges, ctx.scenicRoads, ctx.roadEnds))) continue;
      candidates.push({
        base,
        start,
        route,
        distance: ctx.responseRouteLength(route)
      });
    }
    candidates.sort((a, b) => a.distance - b.distance);
    const choice = candidates[0];
    if (!choice) continue;
    const fireEngine = serviceType === 'fireEngine';
    const next = choice.route[1];
    ctx.incidentResponseVehicles.push({
      x: choice.start.x,
      y: choice.start.y,
      angle: ctx.env.Math.atan2(next.y - choice.start.y, next.x - choice.start.x),
      speed: 0,
      maxSpeed: fireEngine ? 4.35 : 5.9,
      width: fireEngine ? 72 : 54,
      height: fireEngine ? 34 : 27,
      mass: fireEngine ? 8400 : 3300,
      model: serviceType,
      color: fireEngine ? '#bd3e30' : '#dedbd1',
      route: choice.route.slice(1),
      routeTimer: 0,
      responseTarget: {
        ...target
      },
      baseTarget: {
        x: choice.start.x,
        y: choice.start.y
      },
      responseBase: choice.base.building.sign,
      responseIncidentId: incident.id,
      status: 'enroute',
      sceneTimer: fireEngine ? 4.8 : 4.1,
      strobePhase: ctx.env.Math.random() * ctx.env.Math.PI * 2
    });
    dispatchedServices.push(serviceType);
    // A scene must remain present long enough for responders to reach it.
    const arrivalSeconds = choice.distance / ((fireEngine ? 4.35 : 5.9) * 60) * 1.65 + 14;
    incident.timer = ctx.env.Math.max(incident.timer, arrivalSeconds);
  }
  if (dispatchedServices.length) {
    incident.responseDispatched = true;
    incident.respondingServices = dispatchedServices;
  }
  return dispatchedServices.length;
};
ctx.applyMedicalResponse = function applyMedicalResponse(incident, provider = 'ambulance') {
  if (!incident) return;
  incident.medicalTreated = true;
  incident.medicalOutcome = 'checked';
  incident.medicalProvider ??= provider;
  for (const actor of incident.actors || []) {
    if (actor.stance === 'down' || ['victim', 'injured', 'evacuee', 'defender'].includes(actor.role)) {
      actor.medicalTreated = true;
      if (actor.stance === 'down') actor.stance = 'assisted';
      actor.reaction = 'calm';
    }
  }
};
ctx.airMedicalBases = function airMedicalBases() {
  return ctx.buildings.filter(b => b.civicType === 'airAmbulanceBase').map(building => ({
    building,
    x: building.x + building.w / 2,
    y: building.y + building.h / 2,
    altitude: (building.floors ?? 2) * 24 + 12
  }));
};
ctx.dispatchAirMedicalResponse = function dispatchAirMedicalResponse(incident) {
  if (!incident || incident.airMedicalDispatched || incident.medicalTreated || !incident.actors?.some(actor => actor.stance === 'down')) return false;
  const ambulance = ctx.incidentResponseVehicles.find(unit => unit.responseIncidentId === incident.id && unit.model === 'ambulance');
  // Reserve the aircraft for injuries with a long or unavailable road response.
  const roadDistance = ambulance ? ctx.responseRouteLength([{
    x: ambulance.x,
    y: ambulance.y
  }, ...ambulance.route]) : Infinity;
  if (roadDistance <= 2600) return false;
  const bases = ctx.airMedicalBases().filter(base => !ctx.airMedicalVehicles.some(unit => unit.responseBase === base.building.sign));
  bases.sort((a, b) => ctx.env.Math.hypot(a.x - incident.x, a.y - incident.y) - ctx.env.Math.hypot(b.x - incident.x, b.y - incident.y));
  const base = bases[0];
  if (!base) return false;
  const cruiseAltitude = ctx.env.Math.max(220, ...ctx.buildings.map(b => (b.floors ?? 5) * 24 + 72));
  const hoverAltitude = ctx.env.Math.max(50, ...ctx.buildings.filter(b => ctx.env.Math.abs(b.x + b.w / 2 - incident.x) < b.w / 2 + 90 && ctx.env.Math.abs(b.y + b.h / 2 - incident.y) < b.h / 2 + 90).map(b => (b.floors ?? 5) * 24 + 50));
  const flightSeconds = (cruiseAltitude - base.altitude) / 70 + ctx.env.Math.hypot(base.x - incident.x, base.y - incident.y) / 480 + (cruiseAltitude - hoverAltitude) / 50 + 6;
  if (ambulance && flightSeconds + 5 >= roadDistance / (ambulance.maxSpeed * 60) + 4.1) return false;
  ctx.airMedicalVehicles.push({
    x: base.x,
    y: base.y,
    angle: 0,
    speed: 0,
    width: 64,
    height: 26,
    type: 'helicopter',
    kind: 'air',
    color: '#e5e4d9',
    medical: true,
    altitude: base.altitude,
    cruiseAltitude,
    hoverAltitude,
    baseTarget: {
      x: base.x,
      y: base.y,
      altitude: base.altitude
    },
    responseTarget: {
      x: incident.x,
      y: incident.y
    },
    responseBase: base.building.sign,
    responseIncidentId: incident.id,
    status: 'takingOff',
    sceneTimer: 5
  });
  incident.airMedicalDispatched = true;
  incident.airMedicalResponse = 'enroute';
  incident.timer = ctx.env.Math.max(incident.timer, flightSeconds + 15);
  return true;
};
ctx.updateAirMedicalResponse = function updateAirMedicalResponse(dt) {
  const step = ctx.env.Math.min(.05, ctx.env.Math.max(0, Number(dt) || 0));
  if (!step) return;
  const active = ctx.cityIncidentDirector?.current();
  for (let i = ctx.airMedicalVehicles.length - 1; i >= 0; i--) {
    const unit = ctx.airMedicalVehicles[i];
    const incident = active?.id === unit.responseIncidentId ? active : null;
    if (['takingOff', 'enroute', 'descending', 'onscene'].includes(unit.status) && (!incident || incident.medicalTreated)) {
      unit.status = 'climbingReturn';
      unit.speed = 0;
      if (incident) incident.airMedicalResponse = 'returning';
    }
    if (unit.status === 'takingOff' || unit.status === 'climbingReturn') {
      unit.altitude = ctx.env.Math.min(unit.cruiseAltitude, unit.altitude + 70 * step);
      if (unit.altitude === unit.cruiseAltitude) unit.status = unit.status === 'takingOff' ? 'enroute' : 'returning';
      continue;
    }
    if (unit.status === 'descending' || unit.status === 'landing') {
      const targetAltitude = unit.status === 'landing' ? unit.baseTarget.altitude : unit.hoverAltitude;
      unit.altitude = ctx.env.Math.max(targetAltitude, unit.altitude - 50 * step);
      if (unit.altitude === targetAltitude) {
        if (unit.status === 'landing') {
          unit.returnedToBase = true;
          ctx.airMedicalVehicles.splice(i, 1);
        } else {
          unit.status = 'onscene';
          incident.airMedicalResponse = 'onScene';
        }
      }
      continue;
    }
    if (unit.status === 'onscene') {
      unit.sceneTimer -= step;
      if (unit.sceneTimer <= 0) {
        ctx.applyMedicalResponse(incident, 'helicopter');
        incident.medicalResponse = 'treated';
        incident.airMedicalResponse = 'treated';
        unit.status = 'climbingReturn';
        unit.speed = 0;
      }
      continue;
    }
    const target = unit.status === 'returning' ? unit.baseTarget : unit.responseTarget;
    const dx = target.x - unit.x,
      dy = target.y - unit.y,
      distance = ctx.env.Math.hypot(dx, dy);
    const desired = ctx.env.Math.atan2(dy, dx),
      turn = ctx.env.Math.atan2(ctx.env.Math.sin(desired - unit.angle), ctx.env.Math.cos(desired - unit.angle));
    unit.angle += ctx.env.Math.sign(turn) * ctx.env.Math.min(ctx.env.Math.abs(turn), 1.5 * step);
    unit.speed = ctx.env.Math.min(8, unit.speed + 6 * step, distance / 60);
    const travel = ctx.env.Math.min(distance, unit.speed * 60 * step);
    if (distance > 0) {
      unit.x += dx / distance * travel;
      unit.y += dy / distance * travel;
    }
    if (distance - travel < 1) {
      unit.x = target.x;
      unit.y = target.y;
      unit.speed = 0;
      unit.status = unit.status === 'returning' ? 'landing' : 'descending';
    }
  }
};
ctx.beginIncidentResponseReturn = function beginIncidentResponseReturn(unit) {
  unit.status = 'returning';
  unit.emergencyManeuver = null;
  unit.emergencyBlocked = false;
  unit.responseTarget = {
    ...unit.baseTarget
  };
  unit.route = ctx.serviceRoadPath(unit, unit.responseTarget).slice(1);
  unit.routeTimer = 0;
  if (!unit.route.length) {
    unit.returnedToBase = true;
    unit.removeAfterScene = true;
  }
};
ctx.updateIncidentResponse = function updateIncidentResponse(dt) {
  const frame = ctx.env.Math.min(ctx.env.Math.max(dt, 0), .05) * 60;
  const active = ctx.cityIncidentDirector?.current();
  for (let i = ctx.incidentResponseVehicles.length - 1; i >= 0; i--) {
    const unit = ctx.incidentResponseVehicles[i];
    unit.strobePhase = (unit.strobePhase || 0) + dt * 14;
    const incident = active?.id === unit.responseIncidentId ? active : null;
    if (unit.status === 'onscene') {
      unit.sceneTimer -= dt;
      if (unit.sceneTimer <= 0) {
        if (unit.model === 'fireEngine' && incident) {
          incident.fireSuppressed = true;
          incident.fireResponse = 'contained';
        }
        if (unit.model === 'ambulance' && incident) {
          ctx.applyMedicalResponse(incident);
          incident.medicalResponse = 'treated';
        }
        ctx.beginIncidentResponseReturn(unit);
      }
      continue;
    }
    if (unit.removeAfterScene) {
      ctx.incidentResponseVehicles.splice(i, 1);
      continue;
    }
    if (!unit.route?.length) unit.route = ctx.serviceRoadPath(unit, unit.responseTarget).slice(1);
    if (!unit.route.length) {
      ctx.incidentResponseVehicles.splice(i, 1);
      continue;
    }
    const responseDistance = ctx.env.Math.hypot(unit.responseTarget.x - unit.x, unit.responseTarget.y - unit.y);
    if (responseDistance < (unit.status === 'returning' ? 18 : 6) && !unit.emergencyManeuver && !unit.emergencyBlocked) {
      if (unit.status === 'returning') {
        unit.returnedToBase = true;
        ctx.incidentResponseVehicles.splice(i, 1);
        continue;
      }
      unit.emergencyManeuver = null;
      unit.emergencyBlocked = false;
      unit.status = 'onscene';
      unit.sceneTimer = unit.model === 'fireEngine' ? 4.8 : 4.1;
      unit.speed = 0;
      if (incident && unit.model === 'fireEngine') incident.fireResponse = 'onScene';
      if (incident && unit.model === 'ambulance') incident.medicalResponse = 'onScene';
      continue;
    }
    if (ctx.yieldBetweenResponders(unit)) continue;
    ctx.tryPlanEmergencyPassing(unit, dt);
    ctx.advanceServiceRoute(unit, dt);
  }
};
}
