import {infrastructureColliders} from './furniture_layout.js';
import {bridgeRailBodies} from './bridge_rails.js';
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
  if((ctx.beachZones||[]).some(b=>pointInCoast(x,y,b)||pointInBeach(x,y,b,42)))return true;
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
  const baseTerrain = ctx.constructingLegacyScene ? ctx.legacyLand : ctx.allIslands,
    landings = ctx.constructingLegacyScene ? ctx.legacyPiers : ctx.piers;
  const arrays = [baseTerrain, landings, ctx.bridges,ctx.beachZones],
    stamp = arrays.map(a => a?.length||0).join(':');
  if (!ctx.walkSurfaceCache || ctx.walkSurfaceCache.stamp !== stamp || arrays.some((a, i) => a !== ctx.walkSurfaceCache.arrays[i])) ctx.walkSurfaceCache = {
    arrays,
    stamp,
    supported: createWalkSurface({
      islands: [...baseTerrain,...(ctx.beachZones||[])],
      piers: landings,
      bridges: ctx.bridges
    })
  };
  return ctx.walkSurfaceCache.supported;
};
ctx.getCityScenery = function getCityScenery() {
  const arrays = [ctx.buildings, ctx.trees, ctx.solidProps, ctx.bridgeRails, ctx.breakableProps,ctx.streetLights,ctx.bridges,ctx.roads],
    stamp = arrays.map(a => a.length).join(':');
  if (!ctx.citySceneryCache || ctx.citySceneryCache.stamp !== stamp || arrays.some((a, i) => a !== ctx.citySceneryCache.arrays[i])) {
    const rails = [...ctx.bridgeRails.map(r => ({
      x: r.x + r.w / 2,
      y: r.y + r.h / 2,
      width: r.w,
      height: r.h
    })),...bridgeRailBodies(ctx.bridges.filter(b=>!b.footway&&b.points).map(b=>({id:b.logicalId||b.id,railAccess:ctx.roads.filter(r=>!r.bridgeApproach),railFootways:ctx.bridges.filter(b=>b.footway),width:b.width||b.w||100,path:b.points.map(([x,y])=>({x,y})),organic:true})))];
    const infrastructure=infrastructureColliders(ctx.streetLights,ctx.roadPaintGeometry?.signals);
    ctx.citySceneryCache = {
      arrays,
      stamp,
      contacts: createSceneryIndex(ctx.buildings, ctx.trees, [...ctx.solidProps, ...rails, ...ctx.breakableProps.filter(p => p.type === 'hydrant'&&!p.movable),...infrastructure]),
      pedestrians: createSpatialIndex(ctx.pedestrianSceneryBounds([...infrastructure,...rails]), p => p)
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
  })), ...[...ctx.solidProps,...infrastructure,...ctx.breakableProps.filter(p=>p.type==='hydrant'&&p.intact&&!p.movable)].map(p => ({
    left: p.x - (Math.abs(Math.cos(p.angle||0))*(p.width||p.w||12)+Math.abs(Math.sin(p.angle||0))*(p.height||p.h||12))*.5 - 5,
    top: p.y - (Math.abs(Math.sin(p.angle||0))*(p.width||p.w||12)+Math.abs(Math.cos(p.angle||0))*(p.height||p.h||12))*.5 - 5,
    right: p.x + (Math.abs(Math.cos(p.angle||0))*(p.width||p.w||12)+Math.abs(Math.sin(p.angle||0))*(p.height||p.h||12))*.5 + 5,
    bottom: p.y + (Math.abs(Math.sin(p.angle||0))*(p.width||p.w||12)+Math.abs(Math.cos(p.angle||0))*(p.height||p.h||12))*.5 + 5,source:p
  })), ...ctx.trees.map(t => ({
    left: t.x - 11,
    top: t.y - 11,
    right: t.x + 11,
    bottom: t.y + 11,
    tree: true,
    source: t
  }))];
};
ctx.isPedestrianSceneryBlocked = function isPedestrianSceneryBlocked(x, y, jumpHeight=0, allowWater=false) {
  if (!allowWater && !ctx.getWalkSurface()(x, y)) return true;
  ctx.pedestrianSceneryIndex = ctx.getCityScenery().pedestrians;
  if (ctx.pedestrianSceneryIndex) return ctx.pedestrianSceneryIndex.query(x, y, x, y).some(p => {
    if(p.source?.intact===false||p.source?.collisionHeight&&jumpHeight>=p.source.collisionHeight)return false;
    if(p.tree)return ctx.env.Math.hypot(x-p.source.x,y-p.source.y)<11;
    if(p.source?.angle){const dx=x-p.source.x,dy=y-p.source.y,c=ctx.env.Math.cos(p.source.angle),s=ctx.env.Math.sin(p.source.angle);return ctx.env.Math.abs(dx*c+dy*s)<p.source.width/2+5&&ctx.env.Math.abs(-dx*s+dy*c)<p.source.height/2+5;}
    return x>p.left&&x<p.right&&y>p.top&&y<p.bottom;
  });
  if (ctx.buildings.some(b => x > b.x - 7 && x < b.x + b.w + 7 && y > b.y - 7 && y < b.y + b.h + 7)) return true;
  if (ctx.solidProps.some(o => ctx.env.Math.abs(x - o.x) < o.width * .5 + 5 && ctx.env.Math.abs(y - o.y) < o.height * .5 + 5)) return true;
  if (ctx.trees.some(t => ctx.env.Math.hypot(x - t.x, y - t.y) < 11)) return true;
  return false;
};
}
