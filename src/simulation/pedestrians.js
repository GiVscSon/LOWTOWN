// One shared runtime context owns state; this system has no hidden globals.
export function installSimulationPedestrians(ctx){
const {nextWalkingGoal,onRoadSurface}=ctx.dependencies;
ctx.pedestrianCarBlocked = function pedestrianCarBlocked(x, y, c) {
  const dx = x - c.x,
    dy = y - c.y,
    reach = ((c.width || 48) + (c.height || 24)) / 2 + 7;
  if (ctx.env.Math.abs(dx) > reach || ctx.env.Math.abs(dy) > reach) return false;
  const cs = ctx.env.Math.cos(c.angle || 0),
    sn = ctx.env.Math.sin(c.angle || 0);
  return ctx.env.Math.abs(dx * cs + dy * sn) < (c.width || 48) / 2 + 5 && ctx.env.Math.abs(-dx * sn + dy * cs) < (c.height || 24) / 2 + 5;
};
ctx.isPedestrianBlocked = function isPedestrianBlocked(x, y) {
  if (ctx.isPedestrianSceneryBlocked(x, y)) return true;
  return ctx.parkedCars.some(c => ctx.pedestrianCarBlocked(x, y, c)) || (ctx.roam?.fleet || []).some(c => c.kind !== 'water' && ctx.pedestrianCarBlocked(x, y, c)) || ctx.trafficCars.some(c => ctx.pedestrianCarBlocked(x, y, c)) || ctx.policeCars.some(c => ctx.pedestrianCarBlocked(x, y, c)) || ctx.incidentPoliceCars.some(c => ctx.pedestrianCarBlocked(x, y, c)) || ctx.incidentResponseVehicles.some(c => ctx.pedestrianCarBlocked(x, y, c)) || ctx.roam?.mode !== 'foot' && !(ctx.roam?.altitude > 12) && ctx.pedestrianCarBlocked(x, y, ctx.player);
};
ctx.movePedestrian = function movePedestrian(p, dx, dy) {
  if (ctx.env.Math.hypot(dx, dy) < .001) return false;
  const attempts = [[dx, dy], [dx, 0], [0, dy], [-dy * .75, dx * .75], [dy * .75, -dx * .75]];
  for (const [mx, my] of attempts) {
    const distance = ctx.env.Math.hypot(mx, my);
    if (distance < .001) continue;
    if (p.route && p.goal && !p.fleeTimer && !p.eventFleeTimer && !p.evacuation && ctx.env.Math.hypot(p.goal.x - p.x - mx, p.goal.y - p.y - my) >= ctx.env.Math.hypot(p.goal.x - p.x, p.goal.y - p.y) - .001) continue;
    const steps = ctx.env.Math.ceil(distance / 2);
    let clear = true;
    for (let i = 1; i <= steps; i++) {
      const x = p.x + mx * i / steps,
        y = p.y + my * i / steps;
      if (ctx.isPedestrianBlocked(x, y) || p.route && onRoadSurface(x, y, ctx.roads, ctx.bridges, [], ctx.roadEnds)) {
        clear = false;
        break;
      }
    }
    if (!clear) continue;
    p.x += mx;
    p.y += my;
    p.heading = ctx.env.Math.atan2(my, mx);
    p.walkPhase = (p.walkPhase || 0) + distance * .23;
    p.movedDistance = (p.movedDistance || 0) + distance;
    return true;
  }
  return false;
};
ctx.preparePedestrianRoutines = function preparePedestrianRoutines() {
  const stops = ctx.transitStopSigns();
  ctx.pedestrians.forEach((person, index) => {
    if (!person.route) return;
    person.purpose = ['strolling', 'commuting', 'errands', 'workBreak'][index % 4];
    person.walkSpeed = .38 + index % 7 * .035;
    person.routineCooldown = 3 + index % 9;
    person.dailyStops = [.24, .72].map((ratio, stopIndex) => {
      const point = person.route.points[ctx.env.Math.min(person.route.points.length - 1, ctx.env.Math.floor(person.route.points.length * ratio))];
      const nearby = ctx.buildings.filter(b => ctx.env.Math.hypot(b.x + b.w / 2 - point.x, b.y + b.h - point.y) < 300);
      let activity = person.route.kind === 'park' ? index % 8 === 0 ? 'reading' : 'resting' : 'looking';
      if (person.route.kind !== 'park') {
        if (nearby.some(b => /cafe|diner|coffee/i.test(b.sign || ''))) activity = 'coffee';else if (nearby.some(b => /shop|market|store|news|bakery/i.test(b.sign || ''))) activity = 'shopping';
        if (stopIndex === 1 && stops.some(stop => ctx.env.Math.hypot(stop.x - point.x, stop.y - point.y) < 55)) activity = 'checkingTimetable';
      }
      return {
        ...point,
        activity
      };
    });
  });
};
ctx.pedestrianEvacuation = function pedestrianEvacuation(person) {
  const route = person.route,
    zone = person.avoidZone;
  if (!route || !zone) return null;
  if (person.evacuation?.id === zone.id) return person.evacuation;
  const points = route.points,
    nearest = points.reduce((best, p, i) => ctx.env.Math.hypot(p.x - person.x, p.y - person.y) < ctx.env.Math.hypot(points[best].x - person.x, points[best].y - person.y) ? i : best, 0);
  const candidates = [1, -1].map(direction => {
    const path = [];
    let length = 0,
      previous = person,
      bestDistance = -1,
      bestLength = 0,
      index = nearest;
    for (let step = 0; step < points.length; step++, index += direction) {
      if (route.loop) index = (index + points.length) % points.length;else if (index < 0 || index >= points.length) break;
      const point = points[index];
      length += ctx.env.Math.hypot(point.x - previous.x, point.y - previous.y);
      path.push({
        point,
        index
      });
      previous = point;
      const clearance = ctx.env.Math.hypot(point.x - zone.x, point.y - zone.y);
      if (clearance > bestDistance) {
        bestDistance = clearance;
        bestLength = path.length;
      }
      if (clearance >= zone.radius + 12) return {
        path,
        length,
        safe: true,
        direction
      };
    }
    return {
      path: path.slice(0, bestLength),
      length,
      safe: false,
      clearance: bestDistance,
      direction
    };
  });
  candidates.sort((a, b) => Number(b.safe) - Number(a.safe) || (a.safe ? a.length - b.length : b.clearance - a.clearance));
  person.evacuation = {
    id: zone.id,
    ...candidates[0]
  };
  return person.evacuation;
};
ctx.updatePedestrians = function updatePedestrians(dt) {
  const frame = ctx.env.Math.min(dt, .05) * 60;
  ctx.pedestrianSceneryIndex = ctx.getCityScenery().pedestrians;
  const cars = [...ctx.trafficCars, ...ctx.policeCars, ...ctx.incidentPoliceCars, ...ctx.incidentResponseVehicles, ...(ctx.roam?.mode !== 'foot' && !(ctx.roam?.altitude > 12) ? [ctx.player] : [])];
  ctx.pedestrians.forEach((p, index) => {
    if(p.beachRoute||p.inWater){
      const goal=p.beachRoute?.[p.beachRouteIndex||0]||p.waterSafe||ctx.nearestSafeSpawn(p.x,p.y),dx=goal.x-p.x,dy=goal.y-p.y,d=ctx.env.Math.hypot(dx,dy)||1;
      const move=ctx.env.Math.min(d,dt*(p.inWater?28:34));
      const x=p.x+dx/d*move,y=p.y+dy/d*move;
      if(!ctx.isPedestrianSceneryBlocked(x,y,0,true)){p.x=x;p.y=y;p.heading=ctx.env.Math.atan2(dy,dx);p.gait=1;p.walkPhase=(p.walkPhase||0)+move*.23;}
      if(d<8&&p.beachRoute)p.beachRouteIndex=((p.beachRouteIndex||0)+1)%p.beachRoute.length;
      return;
    }
    if (p.homeY === undefined) {
      p.homeY = p.y;
      p.homeX = p.x;
      p.pause = index % 7 * .18;
      p.trip = 0;
    }
    p.movedDistance = 0;
    p.hitCooldown = ctx.env.Math.max(0, (p.hitCooldown || 0) - dt);
    if (p.knockdownTimer > 0) {
      p.knockdownTimer = ctx.env.Math.max(0, p.knockdownTimer - dt);
      p.gait = 0;
      p.activity = 'recovering';
      if (!p.knockdownTimer) {
        p.stance = null;
        p.activity = null;
        p.fleeTimer = 1;
        p.wasFleeing = true;
      }
      return;
    }
    if(p.combatTimer>0){p.gait=0;return;}
    p.pause = ctx.env.Math.max(0, p.pause - dt);
    p.routeRecoveryCooldown = ctx.env.Math.max(0, (p.routeRecoveryCooldown || 0) - dt);
    const panicking = p.reaction === 'fleeing' || p.fleeTimer > 0 || p.eventFleeTimer > 0 || !!p.avoidZone;
    p.routineCooldown = ctx.env.Math.max(0, (p.routineCooldown || 0) - dt);
    p.socialCooldown = ctx.env.Math.max(0, (p.socialCooldown ?? 8 + index % 17 * 2) - dt);
    if (panicking) {
      p.activity = null;
      p.activityRemaining = 0;
      p.conversationPartner = null;
    } else if ((p.activityRemaining || 0) > 0) {
      p.activityRemaining = ctx.env.Math.max(0, p.activityRemaining - dt);
      p.pause = ctx.env.Math.max(p.pause, p.activityRemaining);
      if (p.conversationPartner) {
        const other = p.conversationPartner;
        if (other.reaction === 'fleeing' || ctx.env.Math.hypot(other.x - p.x, other.y - p.y) > 46) {
          p.activityRemaining = 0;
          p.pause = 0;
          p.conversationPartner = null;
        } else p.heading = ctx.env.Math.atan2(other.y - p.y, other.x - p.x);
      }
      if (!p.activityRemaining) {
        p.activity = null;
        p.conversationPartner = null;
      }
    }
    if (!panicking && !p.pause && !p.activityRemaining && !p.routineCooldown && p.dailyStops) {
      const stop = p.dailyStops.find(s => ctx.env.Math.hypot(s.x - p.x, s.y - p.y) < 10);
      if (stop) {
        p.activity = stop.activity;
        p.activityRemaining = 1.7 + index % 4 * .2;
        p.pause = p.activityRemaining;
        p.routineCooldown = 22 + index % 11;
      }
    }
    if (!panicking && !p.pause && !p.activityRemaining && p.socialCooldown === 0) {
      const other = ctx.pedestrians.find(o => o !== p && o.districtId === p.districtId && o.reaction === 'calm' && !o.pause && !o.activityRemaining && o.socialCooldown < 20 && ctx.env.Math.hypot(o.x - p.x, o.y - p.y) > 18 && ctx.env.Math.hypot(o.x - p.x, o.y - p.y) < 42);
      p.socialCooldown = 24 + index % 13;
      if (other) for (const person of [p, other]) {
        person.activity = 'talking';
        person.activityRemaining = 2.2;
        person.pause = 2.2;
        person.socialCooldown = 35;
        person.conversationPartner = person === p ? other : p;
      }
    }
    if (p.reaction === 'calm' && !p.pause && !p.activityRemaining) {
      p.activityTimer = (p.activityTimer ?? 5 + index % 11) - dt;
      if (p.activityTimer <= 0) {
        p.pause = 1.4 + index % 4 * .35;
        p.activity = index % 3 === 0 ? 'checkingPhone' : p.route?.kind === 'park' ? 'resting' : 'looking';
        p.activityTimer = 9 + index % 13;
      } else p.activity = null;
    } else if (p.reaction !== 'calm') p.activity = null;
    // React to the approach of traffic, rather than shoving a person on contact.
    const threat = cars.find(c => ctx.env.Math.abs(c.x - p.x) < 90 && ctx.env.Math.abs(c.y - p.y) < 90 && ctx.env.Math.abs(c.speed || 0) > 1.5 && ctx.env.Math.hypot(c.x - p.x, c.y - p.y) < 90 && ctx.env.Math.abs(-(p.x - c.x) * ctx.env.Math.sin(c.angle) + (p.y - c.y) * ctx.env.Math.cos(c.angle)) < (c.height || 24) / 2 + 15 && ((p.x - c.x) * ctx.env.Math.cos(c.angle) + (p.y - c.y) * ctx.env.Math.sin(c.angle)) * (c.isTraffic ? ctx.env.Math.abs(c.speed || 0) : c.speed || 0) > 0);
    if (threat) {
      const distance = ctx.env.Math.hypot(p.x - threat.x, p.y - threat.y) || 1;
      p.fleeX = (p.x - threat.x) / distance;
      p.fleeY = (p.y - threat.y) / distance;
    }
    if (threat) {
      p.reaction = 'fleeing';
      p.activity = null;
      p.activityRemaining = 0;
      p.conversationPartner = null;
    }
    p.fleeTimer = threat ? .8 : ctx.env.Math.max(0, (p.fleeTimer || 0) - dt);
    let dx = 0,
      dy = 0;
    const evacuation = ctx.pedestrianEvacuation(p);
    if (evacuation && !threat) {
      while (evacuation.path.length && ctx.env.Math.hypot(evacuation.path[0].point.x - p.x, evacuation.path[0].point.y - p.y) < 5) {
        p.routeIndex = evacuation.path.shift().index;
        p.routeDirection = evacuation.direction;
      }
      const point = evacuation.path[0]?.point;
      if (point) {
        const distance = ctx.env.Math.hypot(point.x - p.x, point.y - p.y);
        const pace = p.reaction === 'fleeing' ? 1.3 : p.walkSpeed || .45;
        dx = (point.x - p.x) / distance * pace * frame;
        dy = (point.y - p.y) / distance * pace * frame;
      } else {
        p.reaction = 'curious';
        p.activity = 'watching';
        p.lookAt = p.avoidZone;
      }
    } else if (p.fleeTimer > 0 || (p.eventFleeTimer || 0) > 0) {
      p.reaction = 'fleeing';
      const eventPanic = (p.eventFleeTimer || 0) > 0 && !threat;
      const fleeX = eventPanic ? p.eventFleeX || 0 : p.fleeX || 0;
      const fleeY = eventPanic ? p.eventFleeY || 0 : p.fleeY || 0;
      const pace = eventPanic ? 1.9 : 1.3;
      dx = fleeX * pace * frame;
      dy = fleeY * pace * frame;
    } else if (!p.pause) {
      if (p.evacuation) {
        p.evacuation = null;
        p.wasFleeing = true;
        p.activity = null;
      }
      if (p.wasFleeing && p.route) {
        p.routeIndex = p.route.points.reduce((best, point, i) => ctx.env.Math.hypot(point.x - p.x, point.y - p.y) < ctx.env.Math.hypot(p.route.points[best].x - p.x, p.route.points[best].y - p.y) ? i : best, 0);
        p.goal = p.route.points[p.routeIndex];
      }
      if (!p.goal || ctx.env.Math.hypot(p.goal.x - p.x, p.goal.y - p.y) < 9) {
        if (p.route) {
          p.goal = nextWalkingGoal(p);
        } else {
          p.trip++;
          const direction = p.trip % 2 ? 1 : -1;
          const gx = ctx.env.Math.max(p.minX ?? 450, ctx.env.Math.min(p.maxX ?? 9350, p.homeX + direction * (45 + index % 5 * 19)));
          const gy = p.homeY + (p.trip % 3 - 1) * 12;
          p.goal = {
            x: gx,
            y: gy
          };
          p.pause = .5 + index % 4 * .3;
        }
      } else {
        const distance = ctx.env.Math.hypot(p.goal.x - p.x, p.goal.y - p.y);
        const curiosity = p.reaction === 'curious' ? .48 : 1;
        const speed = (p.walkSpeed ?? .42 + index % 5 * .045) * frame * curiosity;
        dx = (p.goal.x - p.x) / distance * speed;
        dy = (p.goal.y - p.y) / distance * speed;
        const neighbor = ctx.pedestrians.find(o => o !== p && ctx.env.Math.abs(o.x - p.x) < 15 && ctx.env.Math.abs(o.y - p.y) < 15 && ctx.env.Math.hypot(o.x - p.x, o.y - p.y) < 15);
        if (neighbor) {
          const d = ctx.env.Math.hypot(p.x - neighbor.x, p.y - neighbor.y) || 1;
          dx += (p.x - neighbor.x) / d * .3 * frame;
          dy += (p.y - neighbor.y) / d * .3 * frame;
        }
      }
    }
    const goalDistance = p.goal ? ctx.env.Math.hypot(p.goal.x - p.x, p.goal.y - p.y) : Infinity;
    if ((dx || dy) && !ctx.movePedestrian(p, dx, dy)) {
      p.pause = .2;
      p.blockedTimer = (p.blockedTimer || 0) + .2;
    } else if (p.movedDistance > 0) {
      const closer = p.goal && ctx.env.Math.hypot(p.goal.x - p.x, p.goal.y - p.y) < goalDistance - .01;
      p.blockedTimer = p.route && !closer && !p.fleeTimer && !p.eventFleeTimer ? (p.blockedTimer || 0) + dt : 0;
    }
    if (p.route && !evacuation && p.blockedTimer > 1 && !p.routeRecoveryCooldown) {
      // A sideways shuffle is not progress toward the destination.
      p.routeDirection *= -1;
      p.goal = nextWalkingGoal(p);
      p.blockedTimer = 0;
      p.pause = .8;
      p.routeRecoveryCooldown = 6;
    }
    if (p.fleeTimer > 0 || p.eventFleeTimer > 0) p.wasFleeing = true;else if (!p.pause) p.wasFleeing = false;
    if (p.reaction === 'curious' && p.lookAt && p.movedDistance === 0) p.heading = ctx.env.Math.atan2(p.lookAt.y - p.y, p.lookAt.x - p.x);
    p.gait = ctx.env.Math.min(1, p.movedDistance / ctx.env.Math.max(.01, frame * .42));
    if (p.gait === 0) p.walkPhase = 0;
  });
};
}
