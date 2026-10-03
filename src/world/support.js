import {infrastructureColliders} from './furniture_layout.js';
// One shared runtime context owns state; this system has no hidden globals.
export function installWorldSupport(ctx){
ctx.invalidateScenery = ()=>{ctx.citySceneryCache=null;ctx.pedestrianSceneryIndex=null;};
ctx.invalidateTerrain = ()=>{ctx.walkSurfaceCache=null;};
const {BEACH_WIDTH,classifySurface,corridorContains,createSceneryIndex,createSpatialIndex,createWalkSurface,pointInBeach,pointInCoast}=ctx.dependencies;
ctx.isPositionOnIslandLand = function isPositionOnIslandLand(x, y) {
  for (let isl of ctx.constructingLegacyScene ? ctx.legacyLand : ctx.allIslands) {
    if (pointInCoast(x, y, isl)) return true;
  }
  return false;
};
ctx.isPositionOnSolidGround = function isPositionOnSolidGround(x, y) {
  if (ctx.isPositionOnIslandLand(x, y) || (ctx.constructingLegacyScene ? ctx.legacyLand : ctx.allIslands).some(isl => pointInBeach(x, y, isl, isl.natural ? 42 : BEACH_WIDTH)) || (ctx.constructingLegacyScene ? ctx.legacyPiers : ctx.piers).some(p => x >= p.x && x <= p.x + p.w && y >= p.y && y <= p.y + p.h)) return true;
  for (let br of ctx.bridges) {
    if (br.points) {
      if (corridorContains(x, y, br, 8)) return true;
      continue;
    }
    if (x >= br.x - 10 && x <= br.x + br.w + 10 && y >= br.y - 12 && y <= br.y + br.h + 12) return true;
  }
  return false;
};
ctx.isPositionOnWaterObstacle = function isPositionOnWaterObstacle(x, y) {
  return ctx.isPositionOnIslandLand(x, y) || (ctx.constructingLegacyScene ? ctx.legacyPiers : ctx.piers).some(p => x >= p.x && x <= p.x + p.w && y >= p.y && y <= p.y + p.h);
};
ctx.surfaceAt = function surfaceAt(x, y) {
  return classifySurface(x, y, {
    roads: ctx.roads,
    bridges: ctx.bridges,
    scenicRoads: ctx.scenicRoads,
    piers: ctx.piers,
    parks: ctx.parkZones,
    landAt: ctx.isPositionOnIslandLand,
    beachAt: (px, py) => (ctx.constructingLegacyScene ? ctx.legacyLand : ctx.allIslands).some(isl => pointInBeach(px, py, isl, isl.natural ? 42 : BEACH_WIDTH))
  });
};
ctx.getWalkSurface = function getWalkSurface() {
  const terrain = ctx.constructingLegacyScene ? ctx.legacyLand : ctx.allIslands,
    landings = ctx.constructingLegacyScene ? ctx.legacyPiers : ctx.piers;
  const arrays = [terrain, landings, ctx.bridges],
    stamp = arrays.map(a => a.length).join(':');
  if (!ctx.walkSurfaceCache || ctx.walkSurfaceCache.stamp !== stamp || arrays.some((a, i) => a !== ctx.walkSurfaceCache.arrays[i])) ctx.walkSurfaceCache = {
    arrays,
    stamp,
    supported: createWalkSurface({
      islands: terrain,
      piers: landings,
      bridges: ctx.bridges
    })
  };
  return ctx.walkSurfaceCache.supported;
};
ctx.getCityScenery = function getCityScenery() {
  const arrays = [ctx.buildings, ctx.trees, ctx.solidProps, ctx.bridgeRails, ctx.breakableProps,ctx.streetLights],
    stamp = arrays.map(a => a.length).join(':');
  if (!ctx.citySceneryCache || ctx.citySceneryCache.stamp !== stamp || arrays.some((a, i) => a !== ctx.citySceneryCache.arrays[i])) {
    const rails = ctx.bridgeRails.map(r => ({
      x: r.x + r.w / 2,
      y: r.y + r.h / 2,
      width: r.w,
      height: r.h
    }));
    const infrastructure=infrastructureColliders(ctx.streetLights,ctx.roadPaintGeometry?.signals);
    ctx.citySceneryCache = {
      arrays,
      stamp,
      contacts: createSceneryIndex(ctx.buildings, ctx.trees, [...ctx.solidProps, ...rails, ...ctx.breakableProps.filter(p => p.type === 'hydrant'),...infrastructure]),
      pedestrians: createSpatialIndex(ctx.pedestrianSceneryBounds(infrastructure), p => p)
    };
  }
  return ctx.citySceneryCache;
};
ctx.pedestrianSceneryBounds = function pedestrianSceneryBounds(infrastructure=[]) {
  return [...ctx.buildings.map(b => ({
    left: b.x - 7,
    top: b.y - 7,
    right: b.x + b.w + 7,
    bottom: b.y + b.h + 7
  })), ...[...ctx.solidProps,...infrastructure,...ctx.breakableProps.filter(p=>p.type==='hydrant'&&p.intact)].map(p => ({
    left: p.x - (p.width||p.w||12) * .5 - 5,
    top: p.y - (p.height||p.h||12) * .5 - 5,
    right: p.x + (p.width||p.w||12) * .5 + 5,
    bottom: p.y + (p.height||p.h||12) * .5 + 5,source:p
  })), ...ctx.trees.map(t => ({
    left: t.x - 11,
    top: t.y - 11,
    right: t.x + 11,
    bottom: t.y + 11,
    tree: true,
    source: t
  }))];
};
ctx.isPedestrianSceneryBlocked = function isPedestrianSceneryBlocked(x, y) {
  if (!ctx.getWalkSurface()(x, y)) return true;
  ctx.pedestrianSceneryIndex = ctx.getCityScenery().pedestrians;
  if (ctx.pedestrianSceneryIndex) return ctx.pedestrianSceneryIndex.query(x, y, x, y).some(p => p.source?.intact!==false && (p.tree ? ctx.env.Math.hypot(x - p.source.x, y - p.source.y) < 11 : x > p.left && x < p.right && y > p.top && y < p.bottom));
  if (ctx.buildings.some(b => x > b.x - 7 && x < b.x + b.w + 7 && y > b.y - 7 && y < b.y + b.h + 7)) return true;
  if (ctx.solidProps.some(o => ctx.env.Math.abs(x - o.x) < o.width * .5 + 5 && ctx.env.Math.abs(y - o.y) < o.height * .5 + 5)) return true;
  if (ctx.trees.some(t => ctx.env.Math.hypot(x - t.x, y - t.y) < 11)) return true;
  return false;
};
}
