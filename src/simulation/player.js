// One shared runtime context owns state; this system has no hidden globals.
export function installSimulationPlayer(ctx){
const {onRoadSurface}=ctx.dependencies;
ctx.nearestSafeSpawn = function nearestSafeSpawn(x, y) {
  return ctx.safeSpawnPoints.reduce((best, sp) => ctx.env.Math.hypot(sp.x - x, sp.y - y) < ctx.env.Math.hypot(best.x - x, best.y - y) ? sp : best, ctx.safeSpawnPoints[0]);
};
ctx.pedestrianExitPath = function pedestrianExitPath(start, maxDistance = 650) {
  const step = 12,
    queue = [{
      ...start,
      parent: -1
    }],
    seen = new Set(['0,0']);
  const clear = (x, y) => [[0, 0], [-5, -5], [-5, 5], [5, -5], [5, 5]].every(([dx, dy]) => !ctx.isPedestrianSceneryBlocked(x + dx, y + dy));
  for (let head = 0; head < queue.length && head < 12000; head++) {
    const p = queue[head];
    if (onRoadSurface(p.x, p.y, ctx.roads, ctx.bridges, ctx.scenicRoads, ctx.roadEnds)) {
      const path = [];
      let i = head;
      while (i >= 0) {
        path.push({
          x: queue[i].x,
          y: queue[i].y
        });
        i = queue[i].parent;
      }
      return path.reverse();
    }
    for (const [dx, dy] of [[step, 0], [-step, 0], [0, step], [0, -step]]) {
      const x = p.x + dx,
        y = p.y + dy,
        key = `${ctx.env.Math.round((x - start.x) / step)},${ctx.env.Math.round((y - start.y) / step)}`;
      if (seen.has(key) || ctx.env.Math.hypot(x - start.x, y - start.y) > maxDistance) continue;
      seen.add(key);
      if (clear(x, y) && clear(p.x + dx / 2, p.y + dy / 2)) queue.push({
        x,
        y,
        parent: head
      });
    }
  }
  return null;
};
ctx.policeStationRelease = function policeStationRelease(x, y) {
  const stations = ctx.serviceBases.filter(base => base.kind === 'police').sort((a, b) => ctx.env.Math.hypot(a.building.x - x, a.building.y - y) - ctx.env.Math.hypot(b.building.x - x, b.building.y - y));
  const clear = (px, py) => [[0, 0], [-5, -5], [-5, 5], [5, -5], [5, 5]].every(([dx, dy]) => !ctx.isPedestrianSceneryBlocked(px + dx, py + dy) && !onRoadSurface(px + dx, py + dy, ctx.roads, ctx.bridges, ctx.scenicRoads, ctx.roadEnds)) && [...ctx.parkedCars, ...ctx.trafficCars, ...ctx.incidentPoliceCars, ...ctx.incidentResponseVehicles, ...(ctx.roam?.fleet || [])].every(c => !ctx.pedestrianCarBlocked(px, py, c));
  for (const station of stations) {
    const b = station.building;
    // Release at a walkable front entrance, away from the response driveway.
    for (const offset of [20, 36, 52, 68, 84, 100]) for (const ratio of [.12, .88, .2, .8, .35, .65, .5]) {
      const facing = b.streetFacing || 'south',
        px = facing === 'east' ? b.x + b.w + offset : facing === 'west' ? b.x - offset : b.x + b.w * ratio,
        py = facing === 'north' ? b.y - offset : facing === 'south' ? b.y + b.h + offset : b.y + b.h * ratio;
      if (clear(px, py)) {
        const path = ctx.pedestrianExitPath({
          x: px,
          y: py
        });
        if (path) {
          b.exitPath = path;
          return {
            x: px,
            y: py,
            sign: b.sign,
            exitPath: path
          };
        }
      }
    }
    for (let radius = 24; radius <= 240; radius += 16) for (let n = 0; n < 24; n++) {
      const px = b.x + b.w / 2 + ctx.env.Math.cos(n * ctx.env.Math.PI / 12) * (b.w / 2 + radius),
        py = b.y + b.h / 2 + ctx.env.Math.sin(n * ctx.env.Math.PI / 12) * (b.h / 2 + radius);
      if (clear(px, py)) {
        const path = ctx.pedestrianExitPath({
          x: px,
          y: py
        });
        if (path) {
          b.exitPath = path;
          return {
            x: px,
            y: py,
            sign: b.sign,
            exitPath: path
          };
        }
      }
    }
  }
  return null;
};
ctx.respawnPlayer = function respawnPlayer(reason = 'авария') {
  const detained = reason === 'задержание';
  const station = detained ? ctx.policeStationRelease(ctx.player.x, ctx.player.y) : null;
  const spawn = station || ctx.nearestSafeSpawn(ctx.player.x, ctx.player.y);
  if (detained) {
    ctx.roam?.resetToFoot(spawn.x, spawn.y, ctx.env.Math.PI / 4);
    if (!ctx.roam) Object.assign(ctx.player, {
      entityType: 'pedestrian',
      x: spawn.x,
      y: spawn.y,
      angle: ctx.env.Math.PI / 4,
      width: 9,
      height: 9,
      speed: 0,
      vx: 0,
      vy: 0,
      gear: 'ПЕШКОМ'
    });
    ctx.state.custodyTimer = 2.2;
    ctx.state.custodyStation = station?.sign || 'Полицейский участок';
    Object.keys(ctx.state.keys).forEach(key => ctx.state.keys[key] = false);
    ctx.env.document.querySelectorAll('.btn-drive').forEach(b => b.classList.remove('active'));
    const overlay = ctx.env.document.getElementById('custodyOverlay');
    if (overlay) {
      overlay.textContent = `ДОСТАВЛЕНЫ В УЧАСТОК\n${ctx.state.custodyStation}\nШтраф $100 · освобождение у входа`;
      overlay.style.display = 'flex';
      overlay.style.opacity = '1';
    }
  } else {
    ctx.roam?.resetToSedan(spawn.x, spawn.y, 0);
    if (!ctx.roam) Object.assign(ctx.player, {
      x: spawn.x,
      y: spawn.y,
      angle: 0,
      speed: 0,
      vx: 0,
      vy: 0
    });
  }
  ctx.player.hp = ctx.player.maxHp || 100;
  ctx.state.isDrowning = false;
  ctx.state.drownProgress = 0;
  ctx.state.deathFlash = detained ? 0 : 1;
  ctx.state.invulnTimer = 180;
  ctx.state.detainProgress = 0;
  ctx.state.wanted = 0;
  ctx.state.wantedCooldown = 0;
  ctx.state.evading = false;
  ctx.releaseWantedPolice();
  ctx.state.tacticalCallDispatched = false;
  ctx.state.guardCallDispatched = false;
  ctx.state.cash = ctx.env.Math.max(0, ctx.state.cash - 100);
  ctx.showToast(detained ? '🚨 ДОСТАВЛЕНЫ В УЧАСТОК · ШТРАФ (-$100)' : `☠️ ВЫ ПОГИБЛИ: ${reason.toUpperCase()} · ВОЗРОЖДЕНИЕ (-$100)`);
  if (detained) ctx.autoSaveProgress();
};
ctx.setWanted = function setWanted(lvl) {
  ctx.state.wanted = ctx.env.Math.min(5, ctx.env.Math.max(0, lvl));
  ctx.state.evading = false;
  ctx.state.evadeTimer = 5.0;
  if (ctx.state.wanted > 0) ctx.showToast(`🚨 УРОВЕНЬ РОЗЫСКА: ★ x ${ctx.state.wanted}!`);
};
ctx.wantedResponseProfile = function wantedResponseProfile(level) {
  const wanted = ctx.env.Math.max(0, ctx.env.Math.min(5, ctx.env.Math.floor(Number(level) || 0)));
  return {
    wanted,
    patrolCount: wanted ? ctx.env.Math.min(4, wanted + 1) : 0,
    tacticalCount: wanted >= 4 ? 1 : 0,
    guardCount: wanted >= 5 ? 1 : 0
  };
};
ctx.raiseWantedFromCrime = function raiseWantedFromCrime(maxLevel = 5, cooldown = 2.5) {
  if (ctx.state.wanted >= maxLevel || ctx.state.wantedCooldown > 0) return false;
  ctx.setWanted(ctx.env.Math.min(maxLevel, ctx.state.wanted + 1));
  ctx.state.wantedCooldown = cooldown;
  return true;
};
}
