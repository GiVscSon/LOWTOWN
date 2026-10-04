// One shared runtime context owns state; this system has no hidden globals.
export function installRenderFrame(ctx){
const {AUTHORED_TERRAIN,BEACH_WIDTH,coastPath,coastPoints,createLowtownThreeRenderer,drawRoadTerminals,drawStreetFurniture,drawStreetTree,drawTransport,pointInBeach,projectIso,visibleOceanChunks}=ctx.dependencies;
ctx.initThreeRuntime = function initThreeRuntime() {
  if (typeof createLowtownThreeRenderer !== 'function' || !ctx.threeCanvas) return false;
  if (/(?:\?|&)renderer=canvas(?:&|$)/.test(ctx.LOWTOWN_QUERY)) return false;
  try {
    const world = {
      width: ctx.WORLD_W,
      height: ctx.WORLD_H,
      islands: ctx.allIslands.map(island => ({
        id: island.id,
        natural: !!island.natural,
        points: coastPoints(island)
      })),
      roads: ctx.roads,
      scenicRoads: ctx.scenicRoads,
      bridges: ctx.bridges,
      bridgeRails: ctx.bridgeRails,
      roadEnds: ctx.roadEnds,
      paint: ctx.roadPaintGeometry || (ctx.roadPaintGeometry = ctx.buildRoadPaintGeometry()),
      crosswalks: (ctx.roadPaintGeometry || (ctx.roadPaintGeometry = ctx.buildRoadPaintGeometry())).crosswalks || ctx.roadPaintGeometry.crosswalkJunctions.flatMap(j => ctx.junctionCrosswalkStripes({
        y: j.y,
        h: j.h
      }, {
        x: j.x,
        w: j.w
      }, j.approaches)),
      buildings: ctx.buildings,
      trees: ctx.trees,
      runways: ctx.PLANE_RUNWAYS,
      helipads: ctx.helipads,
      parks: ctx.parkZones,
      piers: ctx.piers,
      props: ctx.solidProps,
      lights: ctx.streetLights,
      stops: ctx.transitStopSigns(),
      billboards: ctx.billboards,
      cranes: ctx.cranes
    };
    ctx.threeRenderer = createLowtownThreeRenderer({
      canvas: ctx.threeCanvas,
      world,
      forceFullMaterials: ctx.localBridgeQA && /(?:\?|&)fullMaterials=1(?:&|$)/.test(ctx.LOWTOWN_QUERY)
    });
    ctx.canvas.classList?.add('renderer-hidden');
    ctx.threeCanvas.classList?.add('active');
    ctx.env.window.__lowtownRenderer = 'three';
    return true;
  } catch (error) {
    ctx.threeRenderer = null;
    ctx.env.window.__lowtownRenderer = 'canvas';
    ctx.env.window.__lowtownRendererError = String(error?.message || error);
    ctx.canvas.classList?.remove('renderer-hidden');
    ctx.threeCanvas.classList?.remove('active');
    ctx.env.console.warn('LOWTOWN Three.js fallback:', error);
    return false;
  }
};
ctx.renderWorld = function renderWorld() {
  ctx.env.window.__lowtownRenderPaused = ctx.isGamePaused() || ctx.qaManualSceneClock !== null;
  const w = ctx.env.window.innerWidth;
  const h = ctx.env.window.innerHeight;
  if (ctx.threeRenderer) {
    ctx.threeRenderer.render({
      player: ctx.player,
      mode: ctx.roam?.mode || 'sedan',
      altitude: ctx.roam?.altitude || 0,
      vehicles: [...ctx.trafficCars, ...ctx.parkedCars, ...ctx.policeCars, ...ctx.incidentPoliceCars, ...ctx.incidentResponseVehicles, ...(ctx.roam?.fleet || []), ...ctx.airMedicalVehicles, ...(ctx.cityIncidentDirector?.current()?.wrecks || [])],
      pedestrians: [...ctx.pedestrians, ...(ctx.cityIncidentDirector?.current()?.actors || [])],
      props: ctx.breakableProps,
      effects: ctx.effects.particles,
      parts: ctx.CARPARTS,
      incident: ctx.cityIncidentDirector?.current(),
      signals: {
        x: ctx.streetSignal('x'),
        y: ctx.streetSignal('y')
      },
      weather: {
        kind: ctx.weather?.kind || 'clear',
        rain: ctx.weather?.rain || 0,
        fog: ctx.weather?.fog || 0,
        wetness: ctx.weather?.wetness || 0,
        wind: ctx.weather?.gust || 0,
        flash: ctx.weather?.flash || 0
      }
    });
    ctx.renderHud();
    ctx.env.window.__lowtownFrameReady?.();
    return;
  }
  if (ctx.canvas.width !== w || ctx.canvas.height !== h) {
    ctx.canvas.width = w;
    ctx.canvas.height = h;
  }
  ctx.ctx.fillStyle = ctx.PALETTE.waterDark;
  ctx.ctx.fillRect(0, 0, w, h);
  ctx.ctx.save();
  const leadX = ctx.env.Math.cos(ctx.player.angle) * ctx.player.speed * 6;
  const leadY = ctx.env.Math.sin(ctx.player.angle) * ctx.player.speed * 6;
  const flightAltitude = ctx.roam?.profile?.kind === 'air' ? ctx.roam.altitude : 0;
  // Follow the aircraft itself, not its ground shadow, so the airframe stays
  // inside the viewport while the island below remains visible as an overview.
  const center = projectIso(ctx.player.x + leadX - flightAltitude, ctx.player.y + leadY - flightAltitude);
  ctx.ctx.translate(w / 2, h / 2);
  const baseZoom = w > 900 ? 1.32 : 1.0;
  const cameraZoom = baseZoom * (1 - .5 * ctx.env.Math.min(1, flightAltitude / 220));
  ctx.ctx.scale(cameraZoom, cameraZoom);
  ctx.ctx.translate(-center.x, -center.y);
  ctx.ctx.transform(ctx.env.Math.sqrt(3) / 2, 0.5, -ctx.env.Math.sqrt(3) / 2, 0.5, 0, 0);

  // Layered harbour water: depth colour, broad current bands, small wavelets
  // and broken light reflections continue beyond the playable archipelago.
  const waterRange = ctx.env.Math.max(4300, ctx.env.Math.ceil(ctx.env.Math.max(w, h) / cameraZoom * 2)),
    now = ctx.env.performance.now();
  const sea = ctx.ctx.createLinearGradient(ctx.player.x - waterRange, ctx.player.y - waterRange, ctx.player.x + waterRange, ctx.player.y + waterRange);
  sea.addColorStop(0, '#07151d');
  sea.addColorStop(.42, '#0b222b');
  sea.addColorStop(.72, '#0b2a31');
  sea.addColorStop(1, '#061820');
  ctx.ctx.fillStyle = sea;
  ctx.ctx.fillRect(ctx.player.x - waterRange, ctx.player.y - waterRange, waterRange * 2, waterRange * 2);
  ctx.ctx.lineWidth = 1;
  const oceanViewRadius = ctx.env.Math.max(2200, ctx.env.Math.ceil(ctx.env.Math.max(w, h) / cameraZoom * 1.3));
  for (const chunk of visibleOceanChunks(ctx.player.x, ctx.player.y, oceanViewRadius)) {
    for (const [i, wave] of chunk.waves.entries()) {
      const phase = now * .00065 + wave.phase;
      const px = chunk.x + wave.x + ctx.env.Math.sin(phase) * 4,
        py = chunk.y + wave.y;
      ctx.ctx.strokeStyle = wave.bright ? 'rgba(142,184,176,.18)' : 'rgba(64,116,128,.15)';
      ctx.ctx.beginPath();
      ctx.ctx.moveTo(px, py);
      ctx.ctx.quadraticCurveTo(px + wave.length * .45, py - 2 - ctx.env.Math.sin(phase) * 2, px + wave.length, py + 1);
      ctx.ctx.stroke();
      if (i % 4 === 0) {
        ctx.ctx.strokeStyle = 'rgba(181,198,182,.09)';
        ctx.ctx.beginPath();
        ctx.ctx.moveTo(px + 4, py + 5);
        ctx.ctx.lineTo(px + wave.length * .7, py + 6);
        ctx.ctx.stroke();
      }
    }
    if (chunk.glint) {
      const px = chunk.x + 360 + chunk.seed % 410,
        py = chunk.y + 260 + (chunk.seed >>> 9) % 520;
      ctx.ctx.fillStyle = 'rgba(172,204,197,.2)';
      ctx.ctx.beginPath();
      ctx.ctx.ellipse(px, py, 11, 2.4, .08, 0, ctx.env.Math.PI * 2);
      ctx.ctx.fill();
    }
  }
  // 1. A broad, layered shore blends deep water into shallows and sand.
  // The same coastline remains the land/navmesh boundary, so roads and bridges
  // keep their authored connections while the beach is walkable ground.
  ctx.allIslands.forEach(isl => {
    const coastalScale = isl.natural ? 0.48 : 1;
    coastPath(ctx.ctx, isl);
    ctx.ctx.strokeStyle = 'rgba(9,31,38,.94)';
    ctx.ctx.lineWidth = 420 * coastalScale;
    ctx.ctx.stroke();
    ctx.ctx.strokeStyle = 'rgba(20,56,61,.96)';
    ctx.ctx.lineWidth = 330 * coastalScale;
    ctx.ctx.stroke();
    ctx.ctx.strokeStyle = 'rgba(64,104,96,.98)';
    ctx.ctx.lineWidth = 255 * coastalScale;
    ctx.ctx.stroke();
    ctx.ctx.strokeStyle = 'rgba(174,151,103,.98)';
    ctx.ctx.lineWidth = 188 * coastalScale;
    ctx.ctx.stroke();
    ctx.ctx.fillStyle = ctx.districtProfiles[isl.id]?.land || '#202721';
    ctx.ctx.fill();
    ctx.ctx.strokeStyle = 'rgba(213,203,165,.38)';
    ctx.ctx.lineWidth = 3 * coastalScale;
    ctx.ctx.stroke();
  });
  for (const terrain of AUTHORED_TERRAIN) {
    if (ctx.env.Math.abs(terrain.x - ctx.player.x) > 3200 || ctx.env.Math.abs(terrain.y - ctx.player.y) > 3200) continue;
    const island = ctx.islands.find(i => i.id === terrain.islandId);
    ctx.ctx.save();
    coastPath(ctx.ctx, island);
    ctx.ctx.clip();
    const colors = {
      woodland: ['#2b4331', '#304c36'],
      marsh: ['#3d4c39', '#4d5942'],
      bluff: ['#485044', '#626355'],
      rock: ['#414944', '#616258']
    };
    const palette = colors[terrain.kind];
    for (let layer = 0; layer < 4; layer++) {
      const r = terrain.radius * (1 - layer * .20);
      ctx.ctx.fillStyle = palette[layer % 2];
      ctx.ctx.globalAlpha = .35;
      ctx.ctx.beginPath();
      ctx.ctx.ellipse(terrain.x + layer * 8, terrain.y - layer * 10, r, r * .58, -.4, 0, ctx.env.Math.PI * 2);
      ctx.ctx.fill();
      if (['bluff', 'rock'].includes(terrain.kind)) {
        ctx.ctx.strokeStyle = 'rgba(148,151,129,.28)';
        ctx.ctx.lineWidth = 3;
        ctx.ctx.stroke();
      }
    }
    ctx.ctx.restore();
  }
  for (const detail of ctx.beachDetails) {
    if (ctx.env.Math.abs(detail.x - ctx.player.x) > 3200 || ctx.env.Math.abs(detail.y - ctx.player.y) > 3200) continue;
    if (!pointInBeach(detail.x, detail.y, detail.island, detail.natural ? 42 : BEACH_WIDTH)) continue;
    const radius = 1.2 + detail.seed * 2.2;
    ctx.ctx.fillStyle = detail.seed > .5 ? 'rgba(231,213,164,.32)' : 'rgba(73,68,51,.24)';
    ctx.ctx.beginPath();
    ctx.ctx.ellipse(detail.x, detail.y, radius * 1.8, radius * .62, detail.seed * ctx.env.Math.PI, 0, ctx.env.Math.PI * 2);
    ctx.ctx.fill();
    if (detail.seed > .86) {
      ctx.ctx.strokeStyle = 'rgba(91,79,53,.35)';
      ctx.ctx.lineWidth = 1.1;
      ctx.ctx.beginPath();
      ctx.ctx.moveTo(detail.x - 4, detail.y + 3);
      ctx.ctx.lineTo(detail.x + 4, detail.y - 2);
      ctx.ctx.stroke();
    }
  }
  // Harbour piers, landing pads and a small airstrip occupy open waterfront land.
  for (const pier of ctx.piers) {
    ctx.ctx.fillStyle = '#686357';
    ctx.ctx.fillRect(pier.x, pier.y, pier.w, pier.h);
    ctx.ctx.strokeStyle = '#b8a77e';
    ctx.ctx.lineWidth = 2;
    for (let y = pier.y; y < pier.y + pier.h; y += 20) {
      ctx.ctx.beginPath();
      ctx.ctx.moveTo(pier.x, y);
      ctx.ctx.lineTo(pier.x + pier.w, y);
      ctx.ctx.stroke();
    }
  }
  ctx.PLANE_RUNWAYS.forEach((runway, index) => ctx.drawRunwaySurface(runway, index));
  for (const {
    x,
    y
  } of ctx.helipads) {
    ctx.ctx.strokeStyle = '#d3c58e';
    ctx.ctx.lineWidth = 4;
    ctx.ctx.beginPath();
    ctx.ctx.arc(x, y, 55, 0, ctx.env.Math.PI * 2);
    ctx.ctx.stroke();
    ctx.ctx.fillStyle = '#d3c58e';
    ctx.ctx.font = 'bold 42px sans-serif';
    ctx.ctx.textAlign = 'center';
    ctx.ctx.fillText('H', x, y + 15);
  }

  // Watercraft are below bridge decks in the scene graph. They remain visible
  // in open water and are naturally occluded while passing underneath.
  for (const vehicle of ctx.roam?.fleet || []) if (vehicle.kind === 'water') drawTransport(ctx.ctx, vehicle, ctx.env.performance.now() / 1000);
  if (ctx.roam?.profile?.kind === 'water') drawTransport(ctx.ctx, {
    ...ctx.roam.profile,
    type: ctx.roam.mode,
    x: ctx.player.x,
    y: ctx.player.y,
    angle: ctx.player.angle
  }, ctx.env.performance.now() / 1000);

  // Boardwalks remain wood; motor bridges participate in the asphalt union.
  for (const br of ctx.bridges.filter(b => b.footway)) {
    ctx.ctx.fillStyle = '#70634e';
    ctx.ctx.fillRect(br.x, br.y, br.w, br.h);
    ctx.ctx.strokeStyle = '#a18a62';
    ctx.ctx.lineWidth = 1;
    ctx.ctx.beginPath();
    if (br.dir === 'h') for (let x = br.x; x < br.x + br.w; x += 16) {
      ctx.ctx.moveTo(x, br.y);
      ctx.ctx.lineTo(x, br.y + br.h);
    } else for (let y = br.y; y < br.y + br.h; y += 16) {
      ctx.ctx.moveTo(br.x, y);
      ctx.ctx.lineTo(br.x + br.w, y);
    }
    ctx.ctx.stroke();
  }
  ctx.drawScenicRoads(ctx.ctx);
  // Paint the entire sidewalk union before asphalt. Individual road rectangles
  // must never put a kerb or an opaque repair patch across another street.
  const roadPaint = ctx.roadPaintGeometry || (ctx.roadPaintGeometry = ctx.buildRoadPaintGeometry());
  ctx.roads.forEach(r => ctx.drawStreetCorridor(ctx.ctx, r, ctx.PALETTE.sidewalk, 80));
  roadPaint.surfaces.filter(r => !r.logicalId).forEach(r => ctx.drawStreetCorridor(ctx.ctx, r, ctx.PALETTE.asphalt));
  roadPaint.surfaces.filter(r => !r.logicalId && !r.points).forEach(ctx.drawWetRoadSurface);
  (roadPaint.bridgePaths || []).forEach((bridgePath, index) => ctx.drawSmoothBridgeDeck(bridgePath, index));
  ctx.ctx.strokeStyle = ctx.PALETTE.curb;
  ctx.ctx.lineWidth = 2;
  ctx.ctx.beginPath();
  for (const edge of roadPaint.curbs.filter(edge => !edge.bridge && ctx.streetPaintVisible(edge.x1, edge.y1, edge.x2, edge.y2))) {
    ctx.ctx.moveTo(edge.x1, edge.y1);
    ctx.ctx.lineTo(edge.x2, edge.y2);
  }
  ctx.ctx.stroke();
  ctx.ctx.strokeStyle = ctx.PALETTE.roadMarkingYellow;
  ctx.ctx.lineWidth = 2.5;
  ctx.ctx.setLineDash([16, 20]);
  for (const lane of roadPaint.lanes.filter(lane => !lane.bridge && ctx.streetPaintVisible(lane.x1, lane.y1, lane.x2, lane.y2))) {
    ctx.ctx.lineDashOffset = -lane.phase;
    ctx.ctx.beginPath();
    ctx.ctx.moveTo(lane.x1, lane.y1);
    ctx.ctx.lineTo(lane.x2, lane.y2);
    ctx.ctx.stroke();
  }
  ctx.ctx.setLineDash([]);
  ctx.ctx.lineDashOffset = 0;
  drawRoadTerminals(ctx.ctx, ctx.roadEnds);
  ctx.drawTransitStops();
  ctx.ctx.fillStyle = 'rgba(220,216,197,.48)';
  const canvasCrosswalks = roadPaint.crosswalks || roadPaint.crosswalkJunctions.flatMap(j => ctx.junctionCrosswalkStripes({
    y: j.y,
    h: j.h
  }, {
    x: j.x,
    w: j.w
  }, j.approaches));
  for (const stripe of canvasCrosswalks) {
    if (!ctx.streetPaintVisible(stripe.x, stripe.y)) continue;
    ctx.ctx.save();
    ctx.ctx.translate(stripe.x + stripe.w / 2, stripe.y + stripe.h / 2);
    ctx.ctx.rotate(-(stripe.angle || 0));
    ctx.ctx.fillRect(-stripe.w / 2, -stripe.h / 2, stripe.w, stripe.h);
    ctx.ctx.restore();
  }
  for (const j of roadPaint.signals) {
    ctx.ctx.fillRect(j.x - 39, j.y + 7, 3, j.h / 2 - 14);
    ctx.ctx.fillRect(j.x + j.w + 36, j.y + j.h / 2 + 7, 3, j.h / 2 - 14);
    ctx.ctx.fillRect(j.x + j.w / 2 + 7, j.y + j.h + 36, j.w / 2 - 14, 3);
    ctx.ctx.fillRect(j.x + 7, j.y - 39, j.w / 2 - 14, 3);
  }

  // 4. District texture and lived-in ground detail.
  ctx.drawDistrictGroundDetails();
  ctx.ctx.strokeStyle = '#777362';
  ctx.ctx.lineWidth = 14;
  ctx.ctx.lineCap = 'round';
  ctx.ctx.lineJoin = 'round';
  ctx.walkingRoutes.filter(r => r.kind === 'park').forEach(r => {
    ctx.ctx.beginPath();
    r.points.forEach((p, i) => i ? ctx.ctx.lineTo(p.x, p.y) : ctx.ctx.moveTo(p.x, p.y));
    if (r.loop) ctx.ctx.closePath();
    ctx.ctx.stroke();
  });

  // 5. Tire Skidmarks
  ctx.skidmarks.forEach(sm => {
    ctx.ctx.save();
    ctx.ctx.translate(sm.x, sm.y);
    ctx.ctx.rotate(sm.angle);
    ctx.ctx.fillStyle = `rgba(5, 7, 10, ${sm.alpha * 1.2})`;
    ctx.ctx.fillRect(-14, -8, 10, 4);
    ctx.ctx.fillRect(-14, 6, 10, 4);
    ctx.ctx.restore();
  });

  // 5. Breakable Hydrants & Dumpsters
  ctx.breakableProps.forEach(prop => {
    if (prop.intact) {
      if (prop.type === 'hydrant') {
        ctx.ctx.fillStyle = '#dc2626';
        ctx.ctx.beginPath();
        ctx.ctx.arc(prop.x, prop.y, 7, 0, ctx.env.Math.PI * 2);
        ctx.ctx.fill();
        ctx.ctx.fillStyle = '#fca5a5';
        ctx.ctx.fillRect(prop.x - 3, prop.y - 3, 6, 6);
      } else {
        ctx.ctx.fillStyle = '#1e3a29';
        ctx.ctx.fillRect(prop.x - prop.w / 2, prop.y - prop.h / 2, prop.w, prop.h);
        ctx.ctx.strokeStyle = '#0f2419';
        ctx.ctx.lineWidth = 1.5;
        ctx.ctx.strokeRect(prop.x - prop.w / 2, prop.y - prop.h / 2, prop.w, prop.h);
      }
    }
  });

  // 6. Tuning Parts Glow
  const pulse = ctx.env.Math.sin(ctx.env.performance.now() * 0.005) * 5;
  ctx.CARPARTS.forEach(p => {
    if (!p.found) {
      const g = ctx.ctx.createRadialGradient(p.x, p.y, 2, p.x, p.y, 28 + pulse);
      g.addColorStop(0, 'rgba(245, 158, 11, 0.45)');
      g.addColorStop(1, 'rgba(245, 158, 11, 0)');
      ctx.ctx.fillStyle = g;
      ctx.ctx.beginPath();
      ctx.ctx.arc(p.x, p.y, 28 + pulse, 0, ctx.env.Math.PI * 2);
      ctx.ctx.fill();
      ctx.ctx.fillStyle = '#f59e0b';
      ctx.ctx.fillRect(p.x - 10, p.y - 10, 20, 20);
      ctx.ctx.fillStyle = '#fff';
      ctx.ctx.font = '900 11px Inter, sans-serif';
      ctx.ctx.textAlign = 'center';
      ctx.ctx.fillText('⭐', p.x, p.y + 4);
    }
  });

  // 7. Volumetric district scenery and detailed buildings.
  ctx.drawShoreLife();
  ctx.drawCityScenery();

  // Ground depth determines whether a pedestrian passes in front of or behind
  // nearby traffic. The person is drawn upright inside the world transform.
  ctx.drawStreetActors(w, h, center, cameraZoom);

  // Water Splashes
  for(const particle of ctx.effects.particles)if(particle.life>0){
    ctx.ctx.save();ctx.ctx.globalAlpha=Math.min(.7,particle.life/.3);
    ctx.ctx.fillStyle={water:'#a7d3de',chip:'#ac9063',spark:'#ffd787',steam:'#9ca6a7',dust:'#a99c83'}[particle.kind];
    ctx.ctx.beginPath();ctx.ctx.arc(particle.x-particle.z,particle.y-particle.z,particle.size,0,ctx.env.Math.PI*2);ctx.ctx.fill();ctx.ctx.restore();
  }
  ctx.waterSplashes.forEach((sp, idx) => {
    ctx.ctx.fillStyle = `rgba(180, 210, 240, ${sp.alpha})`;
    ctx.ctx.beginPath();
    ctx.ctx.arc(sp.x, sp.y, sp.size, 0, ctx.env.Math.PI * 2);
    ctx.ctx.fill();
    sp.x += sp.vx;
    sp.y += sp.vy;
    sp.alpha -= 0.02;
    if (sp.alpha <= 0) ctx.waterSplashes.splice(idx, 1);
  });
  ctx.ctx.restore();
  ctx.drawWeather(w, h);
  ctx.drawNoirPostFx(w, h);
  if (ctx.state.deathFlash > 0) {
    ctx.ctx.save();
    ctx.ctx.fillStyle = `rgba(90,0,0,${ctx.state.deathFlash * .58})`;
    ctx.ctx.fillRect(0, 0, w, h);
    ctx.ctx.fillStyle = `rgba(245,224,205,${ctx.env.Math.min(1, ctx.state.deathFlash * 1.8)})`;
    ctx.ctx.font = '900 34px Inter, sans-serif';
    ctx.ctx.textAlign = 'center';
    ctx.ctx.fillText('ВОЗРОЖДЕНИЕ', w * .5, h * .5);
    ctx.ctx.restore();
  }
  ctx.renderHud();
};
ctx.streetActorDepth = function streetActorDepth(actor) {
  let depth = actor.x + actor.y;
  for (const b of ctx.buildings) {
    const right = b.x + b.w,
      front = b.y + b.h;
    // A person beside either visible wall is in front of that wall, even
    // before reaching the building's nearest corner. Rear walls still occlude
    // naturally through painter order; never discard the entire sprite.
    const alongRight = actor.x >= right - 1 && actor.x <= right + 60 && actor.y >= b.y && actor.y <= front + 30;
    const alongFront = actor.y >= front - 1 && actor.y <= front + 60 && actor.x >= b.x && actor.x <= right + 30;
    if (alongRight || alongFront) depth = ctx.env.Math.max(depth, right + front + 1);
  }
  return depth;
};
ctx.drawStreetActors = function drawStreetActors(w, h, center, zoom) {
  const actors = [];
  // Small shoreline flocks stay above the scenery and never enter collision lists.
  for (const [index, island] of ctx.islands.entries()) {
    const phase = ctx.env.performance.now() / 18000 + index * .8;
    const x = island.x + island.w * .12 + ctx.env.Math.cos(phase) * 190,
      y = island.y + island.h * .3 + ctx.env.Math.sin(phase) * 130;
    if (ctx.env.Math.abs(x - ctx.player.x) > 1800 || ctx.env.Math.abs(y - ctx.player.y) > 1800) continue;
    actors.push({
      depth: Infinity,
      draw: () => {
        for (let bird = 0; bird < 3; bird++) {
          const wing = 3 + ctx.env.Math.sin(ctx.env.performance.now() / 160 + bird * 1.6) * 2;
          ctx.ctx.strokeStyle = 'rgba(202,208,188,.65)';
          ctx.ctx.lineWidth = 1.2;
          ctx.ctx.beginPath();
          ctx.ctx.moveTo(x + bird * 17 - 6 - 85, y + bird * 9 - wing - 85);
          ctx.ctx.lineTo(x + bird * 17 - 85, y + bird * 9 - 85);
          ctx.ctx.lineTo(x + bird * 17 + 6 - 85, y + bird * 9 - wing - 85);
          ctx.ctx.stroke();
        }
      }
    });
  }
  for (const j of (ctx.roadPaintGeometry || (ctx.roadPaintGeometry = ctx.buildRoadPaintGeometry())).signals) {
    for (const [x, y, axis] of [[j.x - 42, j.y - 16, 'x'], [j.x + j.w + 42, j.y + j.h + 16, 'x'], [j.x - 16, j.y - 42, 'y'], [j.x + j.w + 16, j.y + j.h + 42, 'y']]) {
      if (ctx.env.Math.abs(x - ctx.player.x) < 1700 && ctx.env.Math.abs(y - ctx.player.y) < 1700) actors.push({
        depth: x + y,
        draw: () => ctx.drawStreetSignal(x, y, axis)
      });
    }
  }
  ctx.buildings.forEach((b, index) => {
    if (ctx.env.Math.abs(b.x + b.w / 2 - ctx.player.x) > 1800 || ctx.env.Math.abs(b.y + b.h / 2 - ctx.player.y) > 1800) return;
    actors.push({
      depth: b.x + b.y + b.w + b.h,
      draw: () => ctx.drawBuilding(b, index)
    });
  });
  ctx.trees.forEach((tree, index) => {
    if (ctx.env.Math.abs(tree.x - ctx.player.x) > 1500 || ctx.env.Math.abs(tree.y - ctx.player.y) > 1500) return;
    actors.push({
      depth: tree.x + tree.y,
      draw: () => {
        ctx.ctx.save();
        const sway = ctx.env.Math.sin(ctx.weather.time * 2 + index) * ctx.weather.gust * .016;
        ctx.ctx.translate(tree.x, tree.y);
        ctx.ctx.transform(1, 0, sway, 1, 0, 0);
        ctx.ctx.translate(-tree.x, -tree.y);
        drawStreetTree(ctx.ctx, tree, index);
        ctx.ctx.restore();
      }
    });
  });
  ctx.streetProps.forEach(p => actors.push({
    depth: p.x + p.y + p.height / 2,
    draw: () => drawStreetFurniture(ctx.ctx, p)
  }));
  ctx.billboards.forEach(board => actors.push({
    depth: board.x + board.y,
    draw: () => ctx.drawBillboard(board)
  }));
  ctx.streetLights.forEach((lamp, index) => actors.push({
    depth: lamp.x + lamp.y,
    draw: () => ctx.drawStreetLamp(lamp, index)
  }));
  const activeIncident = ctx.cityIncidentDirector?.current();
  if (activeIncident && ctx.env.Math.abs(activeIncident.x - ctx.player.x) < 1500 && ctx.env.Math.abs(activeIncident.y - ctx.player.y) < 1500) {
    actors.push({
      depth: activeIncident.x + activeIncident.y + 2,
      draw: () => ctx.drawCityIncidentMarker(activeIncident)
    });
  }
  const addVehicle = (vehicle, draw) => actors.push({
    depth: ctx.streetActorDepth(vehicle),
    draw
  });
  ctx.parkedCars.forEach(c => addVehicle(c, () => ctx.drawDetailedCar(ctx.ctx, c.x, c.y, c.angle, c.color, c.width || 40, c.height || 19, false, c.type, 0, c)));
  ctx.trafficCars.forEach(c => addVehicle(c, () => ctx.drawDetailedCar(ctx.ctx, c.x, c.y, c.angle, c.color, c.width || 46, c.height || 22, false, c.type, ctx.stuntHeightFor(c), c)));
  ctx.policeCars.forEach(c => addVehicle(c, () => ctx.drawDetailedCar(ctx.ctx, c.x, c.y, c.angle, '#0f172a', c.width || 48, c.height || 24, true, c.model || 'police', ctx.stuntHeightFor(c), c)));
  ctx.incidentPoliceCars.forEach(c => addVehicle(c, () => ctx.drawDetailedCar(ctx.ctx, c.x, c.y, c.angle, '#0f172a', 48, 24, true, 'police', ctx.stuntHeightFor(c), c)));
  ctx.incidentResponseVehicles.forEach(c => addVehicle(c, () => ctx.drawDetailedCar(ctx.ctx, c.x, c.y, c.angle, c.color, c.width, c.height, false, c.model, ctx.stuntHeightFor(c), c)));
  ctx.airMedicalVehicles.forEach(unit => actors.push({
    depth: Infinity,
    draw: () => {
      if (unit.status === 'onscene') {
        ctx.ctx.strokeStyle = 'rgba(220,226,213,.7)';
        ctx.ctx.lineWidth = 1.5;
        ctx.ctx.beginPath();
        ctx.ctx.moveTo(unit.x - unit.altitude, unit.y - unit.altitude);
        ctx.ctx.lineTo(unit.x, unit.y);
        ctx.ctx.stroke();
      }
      drawTransport(ctx.ctx, unit, ctx.env.performance.now() / 1000, unit.altitude);
    }
  }));
  for (const wreck of activeIncident?.wrecks || []) addVehicle(wreck, () => ctx.drawDetailedCar(ctx.ctx, wreck.x, wreck.y, wreck.angle, wreck.color, wreck.width, wreck.height, false, wreck.type));
  for (const vehicle of ctx.roam?.fleet || []) if (vehicle.kind !== 'water') addVehicle(vehicle, () => vehicle.kind === 'land' ? ctx.drawDetailedCar(ctx.ctx, vehicle.x, vehicle.y, vehicle.angle, vehicle.color, vehicle.width, vehicle.height, false, vehicle.type, ctx.stuntHeightFor(vehicle), vehicle) : drawTransport(ctx.ctx, vehicle, ctx.env.performance.now() / 1000, ctx.stuntHeightFor(vehicle)));
  const people = [...ctx.pedestrians, ...(activeIncident?.actors || [])];
  if (ctx.roam?.mode === 'foot') people.push({
    x: ctx.player.x,
    y: ctx.player.y,
    heading: ctx.player.angle,
    gait: ctx.player.gait || 0,
    walkPhase: ctx.player.walkPhase || 0,
    shirt: '#735235',
    pants: '#22272b',
    skin: '#d5b594',
    hair: '#1a1512',
    jumpHeight: ctx.player.jumpHeight,
    attackTime: ctx.player.attackTime,
    stance: ctx.player.stance,
    player: true
  });
  people.forEach((ped, index) => {
    const ground = projectIso(ped.x, ped.y);
    const sx = w / 2 + (ground.x - center.x) * zoom,
      sy = h / 2 + (ground.y - center.y) * zoom;
    if (sx < -40 || sx > w + 40 || sy < -60 || sy > h + 30) return;
    actors.push({
      depth: ctx.streetActorDepth(ped),
      draw: () => {
        ctx.ctx.save();
        ctx.ctx.translate(ped.x, ped.y);
        // Undo the isometric basis. The outer camera zoom still applies.
        ctx.ctx.transform(1 / ctx.env.Math.sqrt(3), -1 / ctx.env.Math.sqrt(3), 1, 1, 0, 0);
        ctx.drawScreenPedestrian(ped, 0, 0, index);
        ctx.ctx.restore();
      }
    });
  });
  if (ctx.roam?.special) {
    if (ctx.roam.mode !== 'foot' && ctx.roam.profile.kind !== 'water') actors.push({
      depth: ctx.roam.altitude > 12 ? Infinity : ctx.player.x + ctx.player.y,
      draw: () => drawTransport(ctx.ctx, {
        ...ctx.roam.profile,
        type: ctx.roam.mode,
        x: ctx.player.x,
        y: ctx.player.y,
        angle: ctx.player.angle,
        speed: ctx.player.speed,
        occupied: true
      }, ctx.env.performance.now() / 1000, ctx.roam.altitude + ctx.stuntHeightFor(ctx.player))
    });
  } else {
    if (!ctx.state.isDrowning) {
      ctx.ctx.save();
      ctx.ctx.translate(ctx.player.x, ctx.player.y);
      ctx.ctx.rotate(ctx.player.angle);
      ctx.ctx.translate(88, 0);
      ctx.ctx.scale(1, .34);
      const light = ctx.ctx.createRadialGradient(0, 0, 2, 0, 0, 110);
      light.addColorStop(0, 'rgba(255,245,210,.28)');
      light.addColorStop(.55, 'rgba(255,230,160,.12)');
      light.addColorStop(1, 'rgba(255,230,160,0)');
      ctx.ctx.fillStyle = light;
      ctx.ctx.fillRect(-110, -110, 220, 220);
      ctx.ctx.restore();
    }
    addVehicle(ctx.player, () => {
      ctx.ctx.save();
      ctx.ctx.globalAlpha = ctx.state.isDrowning ? ctx.env.Math.max(.2, 1 - ctx.state.drownProgress) : 1;
      if (ctx.roam && ctx.roam.mode !== 'sedan') ctx.drawDetailedCar(ctx.ctx, ctx.player.x, ctx.player.y, ctx.player.angle, ctx.player.bodyColor, ctx.roam.profile.width, ctx.roam.profile.height, false, ctx.roam.mode, ctx.stuntHeightFor(ctx.player), ctx.player);else ctx.drawDetailedCar(ctx.ctx, ctx.player.x, ctx.player.y, ctx.player.angle, ctx.player.bodyColor, ctx.player.width, ctx.player.height, false, ctx.roam?.mode || 'sedan', ctx.stuntHeightFor(ctx.player), ctx.player);
      ctx.ctx.restore();
    });
  }
  actors.sort((a, b) => a.depth - b.depth).forEach(actor => actor.draw());
};
}
