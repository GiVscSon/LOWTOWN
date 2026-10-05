// One shared runtime context owns state; this system has no hidden globals.
export function installAppPersistence(ctx){
const {migrateWorld2Point,nearestStreet,worldPoint}=ctx.dependencies;
ctx.autoSaveProgress = function autoSaveProgress() {
  if (ctx.driveLab?.running) return;
  ctx.weather.save();
  const saveData = {
    worldVersion: 3,
    streetLayout: 'organic-v1',
    mode: ctx.roam?.mode === 'foot' ? 'foot' : 'sedan',
    cash: ctx.state.cash,
    x: ctx.player.x,
    y: ctx.player.y,
    parts: ctx.CARPARTS.map(p => ({
      id: p.id,
      found: p.found
    }))
  };
  try {
    ctx.env.localStorage.setItem('lowtown_integrity_save', JSON.stringify(saveData));
  } catch {/* Storage may be disabled. */}
};
ctx.loadProgress = function loadProgress() {
  try {
    const saved = ctx.env.localStorage.getItem('lowtown_integrity_save');
    if (saved) {
      const data = JSON.parse(saved);
      if (Number.isFinite(data.x) && Number.isFinite(data.y)) {
        if (data.worldVersion === 2) Object.assign(data, migrateWorld2Point(data));else if (data.worldVersion !== 3) Object.assign(data, worldPoint(data));
      }
      ctx.state.cash = Number.isFinite(data.cash) ? ctx.env.Math.max(0, data.cash) : 750;
      ctx.player.x = Number.isFinite(data.x) && data.x > 0 && data.x < ctx.WORLD_W ? data.x : 1200;
      ctx.player.y = Number.isFinite(data.y) && data.y > 0 && data.y < ctx.WORLD_H ? data.y : 1200;
      if (data.streetLayout !== 'organic-v1' || ctx.isPedestrianSceneryBlocked(ctx.player.x, ctx.player.y) || !ctx.isPositionOnSolidGround(ctx.player.x, ctx.player.y)) {
        const location = nearestStreet(ctx.player.x, ctx.player.y, ctx.roads.filter(r => !r.serviceAccess && !r.bridgeApproach));
        if (location) {
          ctx.player.x = location.x;
          ctx.player.y = location.y;
          ctx.player.angle = location.angle;
        }
      }
      if (data.mode === 'foot' && ctx.roam) {
        const exit = ctx.roam.canWalkAt(ctx.player.x, ctx.player.y) ? ctx.player : ctx.policeStationRelease(ctx.player.x, ctx.player.y);
        if (exit) ctx.roam.resetToFoot(exit.x, exit.y);
      }
      if (data.parts) {
        data.parts.forEach(sp => {
          const p = ctx.CARPARTS.find(item => item.id === sp.id);
          if (p) p.found = sp.found;
        });
      }
    }
  } catch (e) {}
  ctx.updateGaragePartsUI();
};
}
