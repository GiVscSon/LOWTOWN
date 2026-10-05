import {createJunctionPriority,approachSignal} from './junction_priority.js';
// One shared runtime context owns state; this system has no hidden globals.
export function installSimulationTraffic(ctx){
const {chassis,contact,corridorContains,nearestStreet,streetWidth}=ctx.dependencies;
ctx.streetSignal = function streetSignal(axis, now = ctx.qaManualSceneClock ?? (ctx.state.pauseStarted ?? ctx.env.performance.now()) - ctx.state.pausedDuration) {
  const phase = ((now + ctx.qaSignalTimeOffset) / 1000 % 12 + 12) % 12,
    active = phase < 6 ? 'x' : 'y',
    elapsed = phase % 6;
  return elapsed >= 5.7 || axis !== active ? 'red' : elapsed >= 5 ? 'amber' : 'green';
};
ctx.trafficMustStopAtSignal = function trafficMustStopAtSignal(car, paint = ctx.roadPaintGeometry || (ctx.roadPaintGeometry = ctx.buildRoadPaintGeometry())) {
  car.signalGap = Infinity;
  if(paint.organic){car.signalGap=approachSignal(car,paint,axis=>ctx.streetSignal(axis));return Number.isFinite(car.signalGap);}
  if (car.turn) return false;
  const axis = car.routeManaged ? ctx.env.Math.abs(ctx.env.Math.cos(car.angle)) > ctx.env.Math.abs(ctx.env.Math.sin(car.angle)) ? 'x' : 'y' : car.axis === 'y' ? 'y' : 'x';
  const signal = ctx.streetSignal(axis);
  if (signal === 'green') return false;
  const direction = car.routeManaged ? ctx.env.Math.sign(axis === 'x' ? ctx.env.Math.cos(car.angle) : ctx.env.Math.sin(car.angle)) : ctx.env.Math.sign(car.cruiseSpeed || car.speed || 1);
  const halfLength = (car.width || 46) / 2;
  return paint.signals.some(j => {
    const cross = axis === 'x' ? car.y : car.x,
      lo = axis === 'x' ? j.y : j.x,
      span = axis === 'x' ? j.h : j.w;
    if (cross < lo || cross > lo + span) return false;
    const entry = axis === 'x' ? direction > 0 ? j.x : j.x + j.w : direction > 0 ? j.y : j.y + j.h;
    const gap = (entry - car[axis]) * direction - halfLength - 36;
    const stop = gap >= -4 && gap < 90 && (signal === 'red' || gap > ctx.env.Math.abs(car.speed || 0) * 10);
    if (stop) car.signalGap = gap;
    return stop;
  });
};
ctx.updateJunctionPriority=(cars,dt)=>{ctx.junctionPriority ||= createJunctionPriority(ctx.roadPaintGeometry||(ctx.roadPaintGeometry=ctx.buildRoadPaintGeometry()));ctx.junctionPriority.update(cars,dt);};
ctx.planTrafficDetour=(car,blockers,dt)=>{
  car.detourCooldown=Math.max(0,(car.detourCooldown||0)-dt);
  if(!car.routeManaged||car.detourRoute||car.detourCooldown)return;
  const c=Math.cos(car.angle),s=Math.sin(car.angle);
  const block=blockers.find(b=>b!==car&&(!(ctx.trafficCars.includes(b))||b.burning||b.hp<40)&&Math.abs(b.speed||0)<.2&&
    (b.x-car.x)*c+(b.y-car.y)*s>25&&(b.x-car.x)*c+(b.y-car.y)*s<150&&Math.abs(-(b.x-car.x)*s+(b.y-car.y)*c)<(car.height||24)/2+15);
  if(!block)return;
  car.detourCooldown=8;
  const finish=car.route.points[((car.routeIndex||0)+2)%car.route.points.length];
  const radius=(block.height||block.h||24)/2+(car.height||24)/2+8;
  const edgeClear=(a,b)=>{const dx=b.x-a.x,dy=b.y-a.y,t=Math.max(0,Math.min(1,((block.x-a.x)*dx+(block.y-a.y)*dy)/(dx*dx+dy*dy||1)));return Math.hypot(block.x-a.x-dx*t,block.y-a.y-dy*t)>radius;};
  const path=ctx.dependencies.roadPath(ctx.roadGraph,car,finish,{fromSegment:true,edgeClear});
  if(path.length>2){car.detourRoute={points:path,loop:false};car.detourIndex=1;}
};
ctx.yieldTrafficToServices = function yieldTrafficToServices(car, dt) {
  if (car.turn) return false;
  const cs = ctx.env.Math.cos(car.angle),
    sn = ctx.env.Math.sin(car.angle);
  const horizontal = car.routeManaged ? ctx.env.Math.abs(cs) >= ctx.env.Math.abs(sn) : ctx.env.Math.abs(cs) > .98;
  const vertical = car.routeManaged ? !horizontal : ctx.env.Math.abs(sn) > .98;
  if (!horizontal && !vertical) return false;
  const axis = horizontal ? 'x' : 'y',
    cross = horizontal ? 'y' : 'x';
  // Finish crossing before pulling over. Waiting for a parallel responder
  // inside the junction can block another responder that must turn through it.
  const reach = (car.width || 46) / 2 + 16;
  const inJunction = (ctx.roadPaintGeometry || (ctx.roadPaintGeometry = ctx.buildRoadPaintGeometry())).junctions.some(j => ctx.env.Math.hypot(car.x - (j.cx ?? j.x + j.w / 2), car.y - (j.cy ?? j.y + j.h / 2)) < j.w / 2 + reach);
  const units = [...ctx.policeCars, ...ctx.incidentPoliceCars, ...ctx.incidentResponseVehicles];
  const heldByResponder = units.some(unit => {
    const dx = unit.x - car.x,
      dy = unit.y - car.y,
      along = dx * cs + dy * sn;
    return along > 0 && along < ctx.env.Math.max(72, (car.width || 46) + 34) && ctx.env.Math.abs(-dx * sn + dy * cs) < ((car.height || 24) + (unit.height || 24)) / 2 + 12;
  });
  const turningResponder = units.some(unit => (unit.rotationBlocked || unit.emergencyBlocked) && ctx.env.Math.hypot(unit.x - car.x, unit.y - car.y) < 160);
  if (inJunction && !(car.routeManaged && car.yieldHome) && !heldByResponder && !turningResponder && !ctx.trafficTouchesResponder({
    ...car,
    x: car.x + cs * 8,
    y: car.y + sn * 8
  })) return false;
  const approaching = units.some(unit => {
    if (!['enroute', 'returning'].includes(unit.status)) return false;
    const uc = ctx.env.Math.cos(unit.angle),
      us = ctx.env.Math.sin(unit.angle),
      dx = car.x - unit.x,
      dy = car.y - unit.y;
    if (car.yieldHome && ctx.env.Math.abs(cs * uc + sn * us) < .85 && ctx.env.Math.hypot(dx, dy) < 160) return true;
    // Let crossing traffic clear the junction. Stopping it across the route
    // would build a permanent barrier in front of the responder.
    if (ctx.env.Math.abs(cs * uc + sn * us) < .85 && !unit.rotationBlocked && !unit.emergencyBlocked) return false;
    const along = dx * uc + dy * us;
    return along > -((car.width || 46) + (unit.width || 48)) / 2 - 18 && along < 200 && ctx.env.Math.abs(-dx * us + dy * uc) < ctx.env.Math.max(62, ((unit.width || 48) + (car.width || 46)) / 2 + 24);
  });
  if (!approaching && !car.yieldHome) return false;
  if (ctx.roads.some(r => r.points)) {
    const collection = [...ctx.roads, ...ctx.bridges.filter(b => !b.footway)],
      home = car.yieldHome;
    const hit = nearestStreet(car.x, car.y, home?.road && corridorContains(car.x, car.y, home.road, 20) ? [home.road] : collection);
    if (!hit) return approaching;
    const nx = -ctx.env.Math.sin(hit.angle),
      ny = ctx.env.Math.cos(hit.angle),
      offset = (car.x - hit.x) * nx + (car.y - hit.y) * ny;
    if (approaching && !home) car.yieldHome = {
      organic: true,
      road: hit.road,
      offset,
      side: ctx.env.Math.sign(offset) || -1
    };
    const current = car.yieldHome;
    if (!current) return false;
    const direction = ctx.env.Math.cos(car.angle - hit.angle) >= 0 ? 1 : -1,
      heading = hit.angle + (direction < 0 ? ctx.env.Math.PI : 0);
    const error = ctx.env.Math.atan2(ctx.env.Math.sin(heading - car.angle), ctx.env.Math.cos(heading - car.angle));
    const desiredAngle = car.angle + ctx.env.Math.sign(error) * ctx.env.Math.min(ctx.env.Math.abs(error), .07 * dt * 60);
    const across = ctx.env.Math.abs(ctx.env.Math.sin(desiredAngle - hit.angle)) * (car.width || 46) / 2 + ctx.env.Math.abs(ctx.env.Math.cos(desiredAngle - hit.angle)) * (car.height || 24) / 2;
    const target = approaching ? current.side * (streetWidth(hit.road) / 2 - across - 2) : current.offset;
    const delta = ctx.env.Math.max(-.35 * dt * 60, ctx.env.Math.min(.35 * dt * 60, target - offset));
    const pose = {
      ...car,
      x: car.x + nx * delta,
      y: car.y + ny * delta,
      angle: desiredAngle
    };
    const shifted = ctx.policeFootprintOnRoad(pose) && ctx.emergencyPassingPoseClear(pose, car);
    if (shifted) Object.assign(car, {
      x: pose.x,
      y: pose.y,
      angle: pose.angle
    });
    // Once at the kerb, clear a crossing responder along the verified lane.
    // Holding an entire bus beside its turning nose can otherwise deadlock.
    const crossing = units.some(u => ctx.env.Math.hypot(u.x - car.x, u.y - car.y) < 160 && ctx.env.Math.abs(ctx.env.Math.cos(u.angle - car.angle)) < .85);
    if (approaching && (!shifted || crossing && ctx.env.Math.abs(target - offset) < 2)) for (const sign of [1, -1]) {
      const step = sign * .8 * dt * 60,
        p = {
          ...car,
          x: car.x + cs * step,
          y: car.y + sn * step
        };
      if (ctx.policeFootprintOnRoad(p) && ctx.emergencyPassingPoseClear(p, car)) {
        car.x = p.x;
        car.y = p.y;
        break;
      }
    }
    if (!approaching && ctx.env.Math.abs(offset - target) < .5) {
      car.yieldHome = null;
      return false;
    }
    return true;
  }
  const road = [...ctx.roads, ...ctx.bridges].find(r => r.dir === (horizontal ? 'h' : 'v') && car.x >= r.x && car.x <= r.x + r.w && car.y >= r.y && car.y <= r.y + r.h);
  if (!road) return approaching;
  const center = horizontal ? road.y + road.h / 2 : road.x + road.w / 2;
  if (approaching && !car.yieldHome) {
    const turning = units.find(unit => (unit.rotationBlocked || unit.emergencyBlocked) && ctx.env.Math.hypot(unit.x - car.x, unit.y - car.y) < 160 && ctx.env.Math.abs(cs * ctx.env.Math.cos(unit.angle) + sn * ctx.env.Math.sin(unit.angle)) < .85);
    car.yieldHome = {
      cross,
      value: car[cross],
      side: turning ? ctx.env.Math.sign(car[cross] - turning[cross]) || 1 : ctx.env.Math.sign(car[cross] - center) || -ctx.env.Math.sign(horizontal ? cs : sn)
    };
  }
  const side = car.yieldHome.side ?? (ctx.env.Math.sign(car[cross] - center) || ctx.env.Math.sign(car.yieldHome.value - center) || -ctx.env.Math.sign(horizontal ? cs : sn));
  car.yieldHome.side = side;
  if (approaching && car.routeManaged) {
    const heading = horizontal ? cs >= 0 ? 0 : ctx.env.Math.PI : sn >= 0 ? ctx.env.Math.PI / 2 : -ctx.env.Math.PI / 2;
    const error = ctx.env.Math.atan2(ctx.env.Math.sin(heading - car.angle), ctx.env.Math.cos(heading - car.angle));
    const pose = {
      ...car,
      angle: car.angle + ctx.env.Math.sign(error) * ctx.env.Math.min(ctx.env.Math.abs(error), .07 * dt * 60)
    };
    if (ctx.emergencyPassingPoseClear(pose, car)) car.angle = pose.angle;
  }
  const across = horizontal ? ctx.env.Math.abs(ctx.env.Math.sin(car.angle)) * (car.width || 46) / 2 + ctx.env.Math.abs(ctx.env.Math.cos(car.angle)) * (car.height || 24) / 2 : ctx.env.Math.abs(ctx.env.Math.cos(car.angle)) * (car.width || 46) / 2 + ctx.env.Math.abs(ctx.env.Math.sin(car.angle)) * (car.height || 24) / 2;
  const target = approaching ? center + side * ((horizontal ? road.h : road.w) / 2 - across - 1) : car.yieldHome.value;
  const delta = ctx.env.Math.max(-.35 * dt * 60, ctx.env.Math.min(.35 * dt * 60, target - car[cross]));
  const pose = {
    ...car,
    [cross]: car[cross] + delta
  };
  if (ctx.policeFootprintOnRoad(pose) && ctx.emergencyPassingPoseClear(pose, car)) car[cross] = pose[cross];else if (approaching && ctx.env.Math.abs(delta) > .01) {
    // Another car may already occupy the shoulder. Clear its length on the
    // verified lane before continuing to pull over, rather than holding both
    // the adjacent responder and the yielding convoy indefinitely.
    for (const sign of [1, -1]) {
      const step = sign * .8 * dt * 60,
        next = {
          ...car,
          x: car.x + cs * step,
          y: car.y + sn * step
        };
      if (!ctx.policeFootprintOnRoad(next) || !ctx.emergencyPassingPoseClear(next, car)) continue;
      car.x = next.x;
      car.y = next.y;
      break;
    }
  }
  if (!approaching && ctx.env.Math.abs(car[cross] - target) < .5) {
    car.yieldHome = null;
    return false;
  }
  return true;
};
ctx.trafficTouchesResponder = function trafficTouchesResponder(car) {
  if ((ctx.roam?.altitude || 0) < 12) {
    const width = ctx.roam?.mode === 'foot' ? 9 : ctx.player.width || 48,
      height = ctx.roam?.mode === 'foot' ? 9 : ctx.player.height || 24;
    if (ctx.env.Math.hypot(car.x - ctx.player.x, car.y - ctx.player.y) < ctx.env.Math.hypot(car.width || 46, car.height || 24) / 2 + ctx.env.Math.hypot(width, height) / 2 && contact(chassis(car), chassis({
      ...ctx.player,
      width,
      height
    }))) return true;
  }
  for (const list of [ctx.policeCars, ctx.incidentPoliceCars, ctx.incidentResponseVehicles]) for (const unit of list) {
    if (ctx.env.Math.hypot(car.x - unit.x, car.y - unit.y) > ctx.env.Math.hypot(car.width || 46, car.height || 24) / 2 + ctx.env.Math.hypot(unit.width || 48, unit.height || 24) / 2) continue;
    if (contact(chassis(car), chassis(unit))) return true;
  }
  return false;
};
}
