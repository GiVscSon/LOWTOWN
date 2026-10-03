// One shared runtime context owns state; this system has no hidden globals.
export function installWorldTransit(ctx){
const {onRoadSurface}=ctx.dependencies;
ctx.placeTransitStops = function placeTransitStops(route) {
  const original = route.points,
    points = [],
    stopIndices = [],
    inserts = new Map();
  const junctions = ctx.buildRoadPaintGeometry().junctions.filter(j => j.horizontalRoads.some(r => !r.serviceAccess) && j.verticalRoads.some(r => !r.serviceAccess));
  for (const requested of route.stopIndices) {
    // Graph edges can be split into short pieces by driveways. Walk the full
    // outgoing path before choosing a stop, rather than dropping those stops.
    const offsets = Array.from({
      length: 11
    }, (_, i) => 160 + i * 32);
    for (const offset of [...offsets, ...offsets.map(n => -n)]) {
      const backwards = offset < 0;
      let remaining = ctx.env.Math.abs(offset),
        segment = backwards ? (requested - 1 + original.length) % original.length : requested,
        point;
      for (let step = 0; step < original.length; step++) {
        const a = original[segment],
          b = original[(segment + 1) % original.length],
          length = ctx.env.Math.hypot(b.x - a.x, b.y - a.y);
        if (length && remaining <= length) {
          const ratio = backwards ? 1 - remaining / length : remaining / length;
          point = {
            x: a.x + (b.x - a.x) * ratio,
            y: a.y + (b.y - a.y) * ratio,
            angle: ctx.env.Math.atan2(b.y - a.y, b.x - a.x),
            ratio
          };
          break;
        }
        remaining -= length;
        segment = (segment + (backwards ? -1 : 1) + original.length) % original.length;
      }
      if (!point || point.ratio < .001 || point.ratio > .999 || !ctx.policeFootprintOnRoad({
        ...point,
        width: 82,
        height: 30
      }) || junctions.some(j => point.x > j.x - 60 && point.x < j.x + j.w + 60 && point.y > j.y - 60 && point.y < j.y + j.h + 60)) continue;
      if (![-1, 1].some(side => {
        const x = point.x - ctx.env.Math.sin(point.angle) * 72 * side,
          y = point.y + ctx.env.Math.cos(point.angle) * 72 * side;
        return !ctx.isPedestrianSceneryBlocked(x, y) && !onRoadSurface(x, y, ctx.roads, ctx.bridges, ctx.scenicRoads, ctx.roadEnds);
      })) continue;
      const entries = inserts.get(segment) || [];
      if (!entries.some(p => ctx.env.Math.hypot(p.x - point.x, p.y - point.y) < 70)) entries.push(point);
      inserts.set(segment, entries);
      break;
    }
  }
  for (let i = 0; i < original.length; i++) {
    points.push(original[i]);
    for (const point of (inserts.get(i) || []).sort((a, b) => a.ratio - b.ratio)) {
      points.push({
        x: point.x,
        y: point.y
      });
      stopIndices.push(points.length - 1);
    }
  }
  route.points = points;
  route.stopIndices = stopIndices;
  route.stopPoints = stopIndices.map(i => points[i]);
  route.stopCount = stopIndices.length;
};
ctx.transitStopSigns = function transitStopSigns() {
  return ctx.transitRoutes.flatMap(route => route.stopIndices.flatMap((index, stopOrder) => {
    const point = route.points[index],
      next = route.points[(index + 1) % route.points.length];
    const dx = next.x - point.x,
      dy = next.y - point.y,
      length = ctx.env.Math.hypot(dx, dy) || 1;
    for (const side of [stopOrder % 2 ? -1 : 1, stopOrder % 2 ? 1 : -1]) {
      const x = point.x - dy / length * 72 * side,
        y = point.y + dx / length * 72 * side;
      // Stop-side selection must not depend on mutable streetProps. Shelters,
      // kiosks and buses are placed after this pass; including them here made
      // the chosen side flip during init and detached signs from shelters.
      if (ctx.transitStopSideClear(x, y)) return [{
        x,
        y,
        line: route.id,
        routeId: route.id,
        stopIndex: index,
        stopOrder
      }];
    }
    return [];
  }));
};
ctx.transitStopSideClear = function transitStopSideClear(x, y) {
  if (!ctx.isPositionOnSolidGround(x, y) || onRoadSurface(x, y, ctx.roads, ctx.bridges, ctx.scenicRoads, ctx.roadEnds)) return false;
  if (ctx.buildings.some(b => x > b.x - 8 && x < b.x + b.w + 8 && y > b.y - 8 && y < b.y + b.h + 8)) return false;
  if (ctx.trees.some(t => ctx.env.Math.hypot(x - t.x, y - t.y) < 14)) return false;
  if (ctx.parkObstacles.some(o => ctx.env.Math.abs(x - o.x) < (o.width || o.w || 12) * .5 + 10 && ctx.env.Math.abs(y - o.y) < (o.height || o.h || 12) * .5 + 10)) return false;
  // Existing non-transit furniture is static input and can reject a side;
  // shelters themselves are deliberately excluded because they are assigned
  // after the stable sign side has been chosen.
  return !ctx.streetProps.some(o => o.type !== 'shelter' && ctx.env.Math.abs(x - o.x) < (o.width || o.w || 12) * .5 + 25 && ctx.env.Math.abs(y - o.y) < (o.height || o.h || 12) * .5 + 22);
};
ctx.associateBusShelters = function associateBusShelters() {
  const available = ctx.transitStopSigns();
  for (const shelter of ctx.streetProps.filter(p => p.type === 'shelter')) {
    const home = {
      x: shelter.x,
      y: shelter.y
    };
    available.sort((a, b) => ctx.env.Math.hypot(a.x - home.x, a.y - home.y) - ctx.env.Math.hypot(b.x - home.x, b.y - home.y));
    for (let i = 0; i < available.length; i++) {
      const stop = available[i];
      const route = ctx.transitRoutes.find(r => r.id === stop.routeId);
      const point = route?.points[stop.stopIndex] || {
        x: stop.x,
        y: stop.y
      };
      const normalLength = ctx.env.Math.hypot(stop.x - point.x, stop.y - point.y) || 1;
      // The sign marks the boarding edge. The shelter sits farther onto the
      // pavement so its solid body cannot cover the boarding point or lane.
      const outwardX = (stop.x - point.x) / normalLength,
        outwardY = (stop.y - point.y) / normalLength;
      const shelterHome = {
        x: stop.x + outwardX * 64,
        y: stop.y + outwardY * 64
      };
      Object.assign(shelter, shelterHome);
      ctx.relocateStreetObstacles([shelter]);
      // A relocation around a nearby facade may find a point too close to the
      // boarding edge. Keep a guaranteed clear gap for the waiting pedestrian.
      if (ctx.env.Math.hypot(shelter.x - stop.x, shelter.y - stop.y) < 48) Object.assign(shelter, shelterHome);
      if (ctx.env.Math.hypot(shelter.x - stop.x, shelter.y - stop.y) > 140) continue;
      shelter.busStop = {
        ...stop
      };
      available.splice(i, 1);
      break;
    }
    if (!shelter.busStop) Object.assign(shelter, home);
  }
};
}
