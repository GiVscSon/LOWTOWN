import {populateWorldDetails,mobilizeSmallProps} from './details.js';
import {populateBeaches} from './beaches.js';
// One shared runtime context owns state; this system has no hidden globals.
export function installWorldCity(ctx){
const {AUTHORED_TERRAIN,assignWalkingRoutes,corridorRoad,createCityIncidentDirector,createRoadCircuits,createRoadGraph,createWalkingRoutes,fitBuildingsToStreets,isletWalkways,nearestStreet,normalizeStreetGeometry,onRoadSurface,onStreetCollection,organicStreetNetwork,planStopRoute,pointInCoast,rectangleClearOfStreets,remapBridges,remapLegacyScene,roadTerminals,streetPoints,streetSurfaceGeometry,streetWidth,worldPoint}=ctx.dependencies;
ctx.districtAt = function districtAt(x, y) {
  return ctx.constructingLegacyScene ? ctx.legacyIslands.find(i => x >= i.x && x <= i.x + i.w && y >= i.y && y <= i.y + i.h) : ctx.islands.find(i => pointInCoast(x, y, i));
};
ctx.civicTypeForSign = function civicTypeForSign(sign = '') {
  const label = String(sign).toLowerCase();
  if (/air ambulance/.test(label)) return 'airAmbulanceBase';
  if (/maritime rescue|coast guard/.test(label)) return 'marineRescueBase';
  if (/hospital|clinic|medical|ems|ambulance/.test(label)) return 'hospital';
  if (/fire|rescue/.test(label)) return 'firestation';
  if (/airfield|airport|skyfreight/.test(label)) return 'airfield';
  if (/national guard|armory/.test(label)) return 'guardBase';
  if (/bus depot|terminal|marina|coast guard/.test(label)) return 'depot';
  if (/police|city hall|civil defence|guard|college|library|school|community/.test(label)) return 'civic';
  return null;
};
ctx.junctionCrosswalkStripes = function junctionCrosswalkStripes(horizontal, vertical, approaches = {
  north: true,
  south: true,
  west: true,
  east: true
}) {
  const stripes = [];
  for (let x = vertical.x + 8; x < vertical.x + vertical.w - 8; x += 15) {
    if (approaches.north) stripes.push({
      x,
      y: horizontal.y - 28,
      w: 7,
      h: 20,
      approach: 'north'
    });
    if (approaches.south) stripes.push({
      x,
      y: horizontal.y + horizontal.h + 8,
      w: 7,
      h: 20,
      approach: 'south'
    });
  }
  for (let y = horizontal.y + 8; y < horizontal.y + horizontal.h - 8; y += 15) {
    if (approaches.west) stripes.push({
      x: vertical.x - 28,
      y,
      w: 20,
      h: 7,
      approach: 'west'
    });
    if (approaches.east) stripes.push({
      x: vertical.x + vertical.w + 8,
      y,
      w: 20,
      h: 7,
      approach: 'east'
    });
  }
  return stripes;
};
ctx.subtractRoadIntervals = function subtractRoadIntervals(start, end, masks) {
  const segments = [];
  let cursor = start;
  for (const [a, b] of masks.sort((a, b) => a[0] - b[0])) {
    if (b <= cursor || a >= end) continue;
    if (a > cursor) segments.push([cursor, ctx.env.Math.min(a, end)]);
    cursor = ctx.env.Math.max(cursor, b);
    if (cursor >= end) break;
  }
  if (cursor < end) segments.push([cursor, end]);
  return segments;
};
ctx.buildRoadPaintGeometry = function buildRoadPaintGeometry() {
  if (ctx.roads.some(r => r.points)) return streetSurfaceGeometry(ctx.roads, ctx.bridges, ctx.roadGraph);
  const junctions = [],
    curbs = [],
    lanes = [];
  for (const horizontal of ctx.roads.filter(r => r.dir === 'h')) for (const vertical of ctx.roads.filter(r => r.dir === 'v')) {
    const overlapX = ctx.env.Math.min(horizontal.x + horizontal.w, vertical.x + vertical.w) - ctx.env.Math.max(horizontal.x, vertical.x);
    const overlapY = ctx.env.Math.min(horizontal.y + horizontal.h, vertical.y + vertical.h) - ctx.env.Math.max(horizontal.y, vertical.y);
    if (overlapX < 0 || overlapY < 0 || horizontal.h < 55 || vertical.w < 55) continue;
    const x = vertical.x,
      y = horizontal.y,
      w = vertical.w,
      h = horizontal.h;
    const approaches = {
      north: vertical.y < y - 32,
      south: vertical.y + vertical.h > y + h + 32,
      west: horizontal.x < x - 32,
      east: horizontal.x + horizontal.w > x + w + 32
    };
    const existing = junctions.find(j => j.x === x && j.y === y && j.w === w && j.h === h);
    if (existing) {
      existing.horizontalRoads.push(horizontal);
      existing.verticalRoads.push(vertical);
      for (const face of Object.keys(approaches)) existing.approaches[face] ||= approaches[face];
    } else junctions.push({
      x,
      y,
      w,
      h,
      horizontalRoads: [horizontal],
      verticalRoads: [vertical],
      approaches
    });
  }
  // A few isolated VM depth fixtures load main.js without its module imports.
  // Keep those renderer-only contexts safe while the real game uses the union
  // builder exported by street_network.js.
  const surface = typeof streetSurfaceGeometry === 'function' ? streetSurfaceGeometry(ctx.roads, ctx.bridges) : {
    surfaces: [...ctx.roads, ...ctx.bridges.filter(b => !b.footway)],
    curbs: [],
    lanes: [],
    bridgePaths: []
  };
  const crosswalkJunctions = junctions.filter(j => j.horizontalRoads.some(r => !r.serviceAccess && !r.bridgeApproach) && j.verticalRoads.some(r => !r.serviceAccess && !r.bridgeApproach));
  const signals = junctions.filter(j => Object.values(j.approaches).every(Boolean) && j.horizontalRoads.some(r => !r.serviceAccess && !r.bridgeApproach) && j.verticalRoads.some(r => !r.serviceAccess && !r.bridgeApproach));
  return {
    junctions,
    ...surface,
    crosswalkJunctions,
    signals
  };
};
ctx.initTopology = function initTopology() {
  ctx.constructingLegacyScene = true;
  ctx.bridges.splice(0, ctx.bridges.length, ...ctx.legacyBridges.map(b => ({
    ...b
  })));
  ctx.roadPaintGeometry = null;
  ctx.roads.length = 0;
  ctx.scenicRoads.length = 0;
  ctx.roadEnds.length = 0;
  ctx.buildings.length = 0;
  ctx.breakableProps.length = 0;
  ctx.bridgeRails.length = 0;
  ctx.trafficCars.length = 0;
  ctx.policeCars.length = 0;
  ctx.incidentPoliceCars.length = 0;
  ctx.incidentResponseVehicles.length = 0;
  ctx.airMedicalVehicles.length = 0;
  ctx.serviceBases.length = 0;
  ctx.transitRoutes.length = 0;
  ctx.pedestrians.length = 0;
  ctx.streetLights.length = 0;
  ctx.trees.length = 0;
  ctx.parkedCars.length = 0;
  ctx.cranes.length = 0;
  ctx.billboards.length = 0;
  ctx.parkZones.length = 0;
  ctx.parkObstacles.length = 0;
  ctx.streetProps.length = 0;
  ctx.stuntZones.length = 0;
  ctx.solidProps.length = 0;

  // Expressway
  ctx.roads.push({
    x: 450,
    y: 1135,
    w: 2050,
    h: ctx.ROAD_W,
    dir: 'h',
    name: 'Центральный Проспект'
  }, {
    x: 2850,
    y: 1135,
    w: 2000,
    h: ctx.ROAD_W,
    dir: 'h',
    name: 'Портовая Магистраль'
  }, {
    x: 5200,
    y: 1135,
    w: 1650,
    h: ctx.ROAD_W,
    dir: 'h',
    name: 'Фонарный Бульвар'
  }, {
    x: 450,
    y: 4135,
    w: 2050,
    h: ctx.ROAD_W,
    dir: 'h',
    name: 'Южное Кольцо'
  }, {
    x: 2850,
    y: 4135,
    w: 2000,
    h: ctx.ROAD_W,
    dir: 'h',
    name: 'Рыночная Магистраль'
  }, {
    x: 5200,
    y: 4135,
    w: 1650,
    h: ctx.ROAD_W,
    dir: 'h',
    name: 'Блэквуд Драйв'
  });

  // Downtown
  ctx.roads.push({
    x: 450,
    y: 450,
    w: 1900,
    h: ctx.ROAD_W,
    dir: 'h'
  }, {
    x: 450,
    y: 1850,
    w: 1900,
    h: ctx.ROAD_W,
    dir: 'h'
  }, {
    x: 450,
    y: 450,
    w: ctx.ROAD_W,
    h: 1530,
    dir: 'v'
  }, {
    x: 1200,
    y: 450,
    w: ctx.ROAD_W,
    h: 2050,
    dir: 'v'
  }, {
    x: 2000,
    y: 450,
    w: ctx.ROAD_W,
    h: 1530,
    dir: 'v'
  });

  // Docks
  ctx.roads.push({
    x: 2950,
    y: 450,
    w: 1750,
    h: ctx.ROAD_W,
    dir: 'h'
  }, {
    x: 2950,
    y: 1850,
    w: 1750,
    h: ctx.ROAD_W,
    dir: 'h'
  }, {
    x: 2950,
    y: 450,
    w: ctx.ROAD_W,
    h: 1530,
    dir: 'v'
  }, {
    x: 3850,
    y: 450,
    w: ctx.ROAD_W,
    h: 2050,
    dir: 'v'
  }, {
    x: 4600,
    y: 450,
    w: ctx.ROAD_W,
    h: 1530,
    dir: 'v'
  });

  // Lantern Bay
  ctx.roads.push({
    x: 5300,
    y: 450,
    w: 1550,
    h: ctx.ROAD_W,
    dir: 'h'
  }, {
    x: 5300,
    y: 1850,
    w: 1550,
    h: ctx.ROAD_W,
    dir: 'h'
  }, {
    x: 5300,
    y: 450,
    w: ctx.ROAD_W,
    h: 1530,
    dir: 'v'
  }, {
    x: 6200,
    y: 450,
    w: ctx.ROAD_W,
    h: 2050,
    dir: 'v'
  });

  // Southern city belt
  ctx.roads.push({
    x: 450,
    y: 3350,
    w: 1900,
    h: ctx.ROAD_W,
    dir: 'h'
  }, {
    x: 450,
    y: 4950,
    w: 1900,
    h: ctx.ROAD_W,
    dir: 'h'
  }, {
    x: 450,
    y: 3350,
    w: ctx.ROAD_W,
    h: 1730,
    dir: 'v'
  }, {
    x: 1200,
    y: 3200,
    w: ctx.ROAD_W,
    h: 2200,
    dir: 'v'
  }, {
    x: 2000,
    y: 3350,
    w: ctx.ROAD_W,
    h: 1730,
    dir: 'v'
  }, {
    x: 2950,
    y: 3350,
    w: 1750,
    h: ctx.ROAD_W,
    dir: 'h'
  }, {
    x: 2950,
    y: 4950,
    w: 1750,
    h: ctx.ROAD_W,
    dir: 'h'
  }, {
    x: 2950,
    y: 3350,
    w: ctx.ROAD_W,
    h: 1730,
    dir: 'v'
  }, {
    x: 3850,
    y: 3200,
    w: ctx.ROAD_W,
    h: 2200,
    dir: 'v'
  }, {
    x: 4600,
    y: 3350,
    w: ctx.ROAD_W,
    h: 1730,
    dir: 'v'
  }, {
    x: 5300,
    y: 3350,
    w: 1550,
    h: ctx.ROAD_W,
    dir: 'h'
  }, {
    x: 5300,
    y: 4950,
    w: 1550,
    h: ctx.ROAD_W,
    dir: 'h'
  }, {
    x: 5300,
    y: 3350,
    w: ctx.ROAD_W,
    h: 1730,
    dir: 'v'
  }, {
    x: 6200,
    y: 3200,
    w: ctx.ROAD_W,
    h: 2200,
    dir: 'v'
  });

  // Far south expansion: residential peninsula, freight works and coast road.
  ctx.roads.push({
    x: 450,
    y: 6350,
    w: 1900,
    h: ctx.ROAD_W,
    dir: 'h'
  }, {
    x: 450,
    y: 7135,
    w: 2050,
    h: ctx.ROAD_W,
    dir: 'h',
    name: 'Марроу Авеню'
  }, {
    x: 450,
    y: 7950,
    w: 1900,
    h: ctx.ROAD_W,
    dir: 'h'
  }, {
    x: 450,
    y: 6350,
    w: ctx.ROAD_W,
    h: 1730,
    dir: 'v'
  }, {
    x: 1200,
    y: 6200,
    w: ctx.ROAD_W,
    h: 2200,
    dir: 'v'
  }, {
    x: 2000,
    y: 6350,
    w: ctx.ROAD_W,
    h: 1730,
    dir: 'v'
  }, {
    x: 2850,
    y: 6350,
    w: 2000,
    h: ctx.ROAD_W,
    dir: 'h'
  }, {
    x: 2850,
    y: 7135,
    w: 2000,
    h: ctx.ROAD_W,
    dir: 'h',
    name: 'Фаундри Роу'
  }, {
    x: 2850,
    y: 7950,
    w: 2000,
    h: ctx.ROAD_W,
    dir: 'h'
  }, {
    x: 2950,
    y: 6350,
    w: ctx.ROAD_W,
    h: 1730,
    dir: 'v'
  }, {
    x: 3850,
    y: 6200,
    w: ctx.ROAD_W,
    h: 2200,
    dir: 'v'
  }, {
    x: 4600,
    y: 6350,
    w: ctx.ROAD_W,
    h: 1730,
    dir: 'v'
  }, {
    x: 5200,
    y: 6350,
    w: 1650,
    h: ctx.ROAD_W,
    dir: 'h'
  }, {
    x: 5200,
    y: 7135,
    w: 1650,
    h: ctx.ROAD_W,
    dir: 'h',
    name: 'Вельвет Кост Драйв'
  }, {
    x: 5200,
    y: 7950,
    w: 1650,
    h: ctx.ROAD_W,
    dir: 'h'
  }, {
    x: 5300,
    y: 6350,
    w: ctx.ROAD_W,
    h: 1730,
    dir: 'v'
  }, {
    x: 6200,
    y: 6200,
    w: ctx.ROAD_W,
    h: 2200,
    dir: 'v'
  });

  // Eastern shore and deep-south metropolitan expansion. The repeated local
  // grids keep navigation readable while the bridges preserve island identity.
  for (const baseY of [300, 3200, 6200]) {
    ctx.roads.push({
      x: 7450,
      y: baseY + 150,
      w: 1900,
      h: ctx.ROAD_W,
      dir: 'h'
    }, {
      x: 7450,
      y: baseY + (baseY === 300 ? 835 : 935),
      w: 1900,
      h: ctx.ROAD_W,
      dir: 'h',
      name: baseY === 300 ? 'Истгейт Авеню' : baseY === 3200 ? 'Синдер-Парквей' : 'Кингсвей'
    }, {
      x: 7450,
      y: baseY + 1550,
      w: 1900,
      h: ctx.ROAD_W,
      dir: 'h'
    }, {
      x: 7450,
      y: baseY + 150,
      w: ctx.ROAD_W,
      h: 1530,
      dir: 'v'
    }, {
      x: 8500,
      y: baseY,
      w: ctx.ROAD_W,
      h: 2200,
      dir: 'v'
    }, {
      x: 9220,
      y: baseY + 150,
      w: ctx.ROAD_W,
      h: 1530,
      dir: 'v'
    });
  }
  for (const column of [{
    x: 300,
    w: 2200,
    main: 1200
  }, {
    x: 2850,
    w: 2000,
    main: 3850
  }, {
    x: 5200,
    w: 1800,
    main: 6200
  }, {
    x: 7350,
    w: 2200,
    main: 8500
  }]) {
    ctx.roads.push({
      x: column.x + 150,
      y: 9350,
      w: column.w - 300,
      h: ctx.ROAD_W,
      dir: 'h'
    }, {
      x: column.x + 150,
      y: 10135,
      w: column.w - 300,
      h: ctx.ROAD_W,
      dir: 'h',
      name: 'Саут-Кросс Роуд'
    }, {
      x: column.x + 150,
      y: 10950,
      w: column.w - 300,
      h: ctx.ROAD_W,
      dir: 'h'
    }, {
      x: column.x + 150,
      y: 9350,
      w: ctx.ROAD_W,
      h: 1730,
      dir: 'v'
    }, {
      x: column.main,
      y: 9200,
      w: ctx.ROAD_W,
      h: 2200,
      dir: 'v'
    }, {
      x: column.x + column.w - 250,
      y: 9350,
      w: ctx.ROAD_W,
      h: 1730,
      dir: 'v'
    });
  }

  // Short paved bridge approaches overlap both the curved shore and the deck.
  // This removes the invisible water gaps that previously separated a bridge
  // from the street by roughly one pavement width.
  ctx.bridges.forEach(br => {
    const approach = 170;
    if (br.dir === 'h') ctx.roads.push({
      x: br.x - approach,
      y: br.y,
      w: approach,
      h: br.h,
      dir: 'h',
      bridgeApproach: true
    }, {
      x: br.x + br.w,
      y: br.y,
      w: approach,
      h: br.h,
      dir: 'h',
      bridgeApproach: true
    });else ctx.roads.push({
      x: br.x,
      y: br.y - approach,
      w: br.w,
      h: approach,
      dir: 'v',
      bridgeApproach: true
    }, {
      x: br.x,
      y: br.y + br.h,
      w: br.w,
      h: approach,
      dir: 'v',
      bridgeApproach: true
    });
  });

  // Waterfront lanes bend around the undeveloped edges and join real streets.
  // These are sampled curves shared by the scene and both maps.
  ctx.legacyIslands.forEach((isl, i) => {
    const x = isl.x,
      y = isl.y;
    const endY = y === 300 || x === 7350 && y !== 9200 ? 1615 : 1815;
    const controls = [[x + 240, y + 215], [x + 130, y + 130], [x + 72, y + 330], [x + 85 + i % 3 * 14, y + 760], [x + 65, y + 1180], [x + 125, y + endY - 120], [x + 240, y + endY]];
    const points = [];
    for (let n = 0; n < controls.length - 1; n++) {
      const a = controls[ctx.env.Math.max(0, n - 1)],
        b = controls[n],
        c = controls[n + 1],
        d = controls[ctx.env.Math.min(controls.length - 1, n + 2)];
      for (let k = 0; k < 12; k++) {
        const t = k / 12,
          t2 = t * t,
          t3 = t2 * t;
        points.push([0, 1].map(axis => .5 * (2 * b[axis] + (-a[axis] + c[axis]) * t + (2 * a[axis] - 5 * b[axis] + 4 * c[axis] - d[axis]) * t2 + (-a[axis] + 3 * b[axis] - 3 * c[axis] + d[axis]) * t3)));
      }
    }
    points.push(controls.at(-1));
    ctx.scenicRoads.push({
      points,
      width: 28,
      footway: true,
      name: 'Набережная ' + isl.name
    });
  });

  // Bridges
  ctx.bridges.forEach(br => {
    if (br.dir === 'v') {
      ctx.bridgeRails.push({
        x: br.x - 12,
        y: br.y,
        w: 14,
        h: br.h,
        axis: 'x'
      });
      ctx.bridgeRails.push({
        x: br.x + br.w - 2,
        y: br.y,
        w: 14,
        h: br.h,
        axis: 'x'
      });
    } else {
      ctx.bridgeRails.push({
        x: br.x,
        y: br.y - 12,
        w: br.w,
        h: 14,
        axis: 'y'
      });
      ctx.bridgeRails.push({
        x: br.x,
        y: br.y + br.h - 2,
        w: br.w,
        h: 14,
        axis: 'y'
      });
    }
  });

  // Buildings with neon & AC units
  ctx.buildings.push({
    x: 630,
    y: 630,
    w: 520,
    h: 450,
    sign: '🍸 BAR "WHISKEY CAT"',
    neon: '#f59e0b',
    roof: '#17202f'
  }, {
    x: 1380,
    y: 630,
    w: 570,
    h: 450,
    sign: '💰 PAWN & LOANS',
    neon: '#10b981',
    roof: '#1b2434'
  }, {
    x: 630,
    y: 1320,
    w: 520,
    h: 480,
    sign: '🏨 HOTEL ST. CLAIR',
    neon: '#ec4899',
    roof: '#182130'
  }, {
    x: 1380,
    y: 1320,
    w: 570,
    h: 480,
    sign: '🚓 POLICE PRECINCT',
    neon: '#3b82f6',
    roof: '#1d273a'
  }, {
    x: 3130,
    y: 630,
    w: 670,
    h: 450,
    sign: '⚓ DOCK WAREHOUSE 04',
    neon: '#06b6d4',
    roof: '#1c2535'
  }, {
    x: 4030,
    y: 630,
    w: 520,
    h: 450,
    sign: '📦 CARGO TERMINAL B',
    neon: '#eab308',
    roof: '#192231'
  }, {
    x: 3130,
    y: 1320,
    w: 670,
    h: 480,
    sign: '❄️ COLD STORAGE CORP',
    neon: '#38bdf8',
    roof: '#1e293c'
  }, {
    x: 4030,
    y: 1320,
    w: 520,
    h: 480,
    sign: '🚢 PORT AUTHORITY',
    neon: '#f97316',
    roof: '#1a2332'
  }, {
    x: 5480,
    y: 630,
    w: 670,
    h: 450,
    sign: '🏮 LANTERN BAY TAVERN',
    neon: '#ef4444',
    roof: '#221f1a'
  }, {
    x: 5480,
    y: 1320,
    w: 670,
    h: 480,
    sign: '🌴 OVERLOOK MOTEL',
    neon: '#a855f7',
    roof: '#201d18'
  }, {
    x: 630,
    y: 3530,
    w: 520,
    h: 520,
    sign: '🏭 OLD MILL FOUNDRY',
    neon: '#f97316',
    roof: '#211b19'
  }, {
    x: 1380,
    y: 3530,
    w: 570,
    h: 520,
    sign: '🎱 BLACK DOG BILLIARDS',
    neon: '#22c55e',
    roof: '#171f1c'
  }, {
    x: 630,
    y: 4310,
    w: 520,
    h: 590,
    sign: '🔧 SOUTH SIDE GARAGE',
    neon: '#eab308',
    roof: '#202027'
  }, {
    x: 1380,
    y: 4310,
    w: 570,
    h: 590,
    sign: '📻 RADIO LOWTOWN 96.6',
    neon: '#ec4899',
    roof: '#211b2b'
  }, {
    x: 3130,
    y: 3530,
    w: 670,
    h: 520,
    sign: '🥩 RED HOOK MARKET',
    neon: '#ef4444',
    roof: '#231b1c'
  }, {
    x: 4030,
    y: 3530,
    w: 520,
    h: 520,
    sign: '🚇 SOUTH TERMINAL',
    neon: '#38bdf8',
    roof: '#182333'
  }, {
    x: 3130,
    y: 4310,
    w: 670,
    h: 590,
    sign: '📼 VIDEO PALACE',
    neon: '#a855f7',
    roof: '#201a2b'
  }, {
    x: 4030,
    y: 4310,
    w: 520,
    h: 590,
    sign: '🍜 NIGHT MARKET',
    neon: '#f59e0b',
    roof: '#231f19'
  }, {
    x: 5480,
    y: 3530,
    w: 670,
    h: 520,
    sign: '🌲 BLACKWOOD LODGE',
    neon: '#10b981',
    roof: '#17221d'
  }, {
    x: 5480,
    y: 4310,
    w: 670,
    h: 590,
    sign: '📡 CHANNEL 8 TOWER',
    neon: '#60a5fa',
    roof: '#1a2130'
  }, {
    x: 630,
    y: 6530,
    w: 520,
    h: 520,
    sign: '⚓ MARROW FISH MARKET',
    neon: '#e8b84a',
    roof: '#20251f'
  }, {
    x: 1380,
    y: 6530,
    w: 570,
    h: 520,
    sign: '🎺 BLUE NOTE SOCIAL',
    neon: '#d4523a',
    roof: '#211d20'
  }, {
    x: 630,
    y: 7310,
    w: 520,
    h: 590,
    sign: '🏘 SOUTH TENEMENTS',
    neon: '#9aa0a8',
    roof: '#24221f'
  }, {
    x: 1380,
    y: 7310,
    w: 570,
    h: 590,
    sign: '🥊 MARROW GYM',
    neon: '#e09a3e',
    roof: '#211d1a'
  }, {
    x: 3130,
    y: 6530,
    w: 670,
    h: 520,
    sign: '🏭 SOUTHPORT STEEL',
    neon: '#d4523a',
    roof: '#25221e'
  }, {
    x: 4030,
    y: 6530,
    w: 520,
    h: 520,
    sign: '🚂 FREIGHT DEPOT 12',
    neon: '#e8b84a',
    roof: '#1e2425'
  }, {
    x: 3130,
    y: 7310,
    w: 670,
    h: 590,
    sign: '🛢 MARITIME FUEL',
    neon: '#e09a3e',
    roof: '#24201b'
  }, {
    x: 4030,
    y: 7310,
    w: 520,
    h: 590,
    sign: '🔩 UNION MACHINE',
    neon: '#9aa0a8',
    roof: '#1f2324'
  }, {
    x: 5480,
    y: 6530,
    w: 670,
    h: 520,
    sign: '🎭 VELVET THEATRE',
    neon: '#d4523a',
    roof: '#241d22'
  }, {
    x: 5480,
    y: 7310,
    w: 670,
    h: 590,
    sign: '🌊 COASTLINE HOTEL',
    neon: '#e8b84a',
    roof: '#202429'
  });
  for (const district of ctx.expansionDistricts) {
    const upper = district.y + 330;
    const lower = district.y === 300 ? district.y + 1010 : district.y + 1110;
    const lowerH = district.y === 9200 ? 560 : district.y === 300 ? 480 : 380;
    const left = district.x + 330,
      right = district.main + 180;
    const leftW = ctx.env.Math.min(620, district.main - left - 60),
      rightW = ctx.env.Math.min(620, district.far - right - 60);
    ctx.buildings.push({
      x: left,
      y: upper,
      w: leftW,
      h: 500,
      sign: district.signs[0],
      neon: district.neon,
      roof: district.roof
    }, {
      x: right,
      y: upper,
      w: rightW,
      h: 500,
      sign: district.signs[1],
      neon: district.neon,
      roof: district.roof
    }, {
      x: left,
      y: lower,
      w: leftW,
      h: lowerH,
      sign: district.lowerSigns?.[0] || 'APARTMENTS',
      neon: '#9aa0a8',
      roof: district.roof
    }, {
      x: right,
      y: lower,
      w: rightW,
      h: lowerH,
      sign: district.lowerSigns?.[1] || 'NIGHT SERVICES',
      neon: '#bba77c',
      roof: district.roof
    });
  }

  // Separate street-front properties with driveable service alleys.
  const blocks = ctx.buildings.splice(0);
  let streetscapeIndex = 0;
  let parkStyleIndex = 0;
  blocks.forEach((block, blockIndex) => {
    const gap = 76;
    const bw = (block.w - gap) / 2,
      bh = (block.h - gap) / 2;
    const civicType = ctx.civicTypeForSign(block.sign);
    if (civicType) {
      const insetX = block.w * .03,
        insetY = block.h * .03;
      const floors = civicType === 'hospital' ? 5 : civicType === 'civic' ? 3 : civicType === 'airfield' ? 2 : 2;
      const archetype = ['guardBase', 'airAmbulanceBase', 'marineRescueBase'].includes(civicType) ? 'civic' : civicType;
      ctx.buildings.push({
        ...block,
        x: block.x + insetX,
        y: block.y + insetY,
        w: block.w * .62,
        h: block.h * .66,
        floors,
        archetype,
        civicType,
        cornerRadius: 14,
        serviceParcel: {
          x: block.x,
          y: block.y,
          w: block.w,
          h: block.h
        }
      }, {
        ...block,
        x: block.x + block.w * .68,
        y: block.y + block.h * .08,
        w: block.w * .24,
        h: block.h * .27,
        floors: 1,
        archetype: 'warehouse',
        sign: 'SERVICE BAY',
        neon: '#b88b53'
      }, {
        ...block,
        x: block.x + block.w * .68,
        y: block.y + block.h * .41,
        w: block.w * .24,
        h: block.h * .27,
        floors: 1,
        archetype: 'warehouse',
        sign: 'STORES & GARAGE',
        neon: '#8b7c62'
      }, {
        ...block,
        x: block.x + block.w * .1,
        y: block.y + block.h * .75,
        w: block.w * .5,
        h: block.h * .15,
        floors: 1,
        archetype: 'pavilion',
        sign: 'VISITOR ANNEX',
        neon: '#9aa0a8'
      });
      return;
    }
    const parcelIndex = streetscapeIndex++;
    if (parcelIndex % 4 === 2) {
      // Asymmetric perimeter blocks leave a usable, open-ended inner court.
      // Every wing is also a collision body; the courtyard is genuinely empty.
      const wing = block.w * .22,
        depth = block.h * .21;
      ctx.buildings.push({
        ...block,
        w: block.w * .61,
        h: depth,
        floors: 4,
        archetype: 'tenement'
      }, {
        ...block,
        x: block.x + block.w * .73,
        w: block.w * .27,
        h: depth,
        floors: 2,
        archetype: 'shop',
        sign: 'CORNER CAFE'
      }, {
        ...block,
        y: block.y + depth + 30,
        w: wing,
        h: block.h - depth - 30,
        floors: 3,
        archetype: 'townhouse',
        sign: 'COURT RESIDENCES'
      }, {
        ...block,
        x: block.x + block.w - wing,
        y: block.y + depth + 52,
        w: wing,
        h: block.h - depth - 110,
        floors: 3,
        archetype: 'deco',
        sign: 'STUDIOS'
      });
      ctx.parkZones.push({
        x: block.x + wing + 24,
        y: block.y + depth + 34,
        w: block.w - wing * 2 - 48,
        h: block.h - depth - 64,
        type: parkStyleIndex++ % 8,
        courtyard: true
      });
      return;
    }
    if (parcelIndex % 5 === 0 || parcelIndex % 9 === 4) {
      // Give every few districts breathing room: four low perimeter buildings
      // frame a real civic park instead of another full roof-to-roof block.
      const edgeH = ctx.env.Math.max(82, block.h * .22),
        edgeW = ctx.env.Math.max(92, block.w * .25);
      ctx.buildings.push({
        ...block,
        x: block.x,
        y: block.y,
        w: block.w * .42,
        h: edgeH,
        floors: 2,
        archetype: 'pavilion',
        sign: block.sign
      }, {
        ...block,
        x: block.x + block.w * .58,
        y: block.y,
        w: block.w * .42,
        h: edgeH,
        floors: 2,
        archetype: 'shop',
        sign: 'CAFE'
      }, {
        ...block,
        x: block.x,
        y: block.y + block.h - edgeH,
        w: block.w * .34,
        h: edgeH,
        floors: 1,
        archetype: 'pavilion',
        sign: 'PARK HOUSE'
      }, {
        ...block,
        x: block.x + block.w - edgeW,
        y: block.y + block.h - edgeH,
        w: edgeW,
        h: edgeH,
        floors: 1,
        archetype: 'shop',
        sign: 'NEWS & FLOWERS'
      });
      ctx.parkZones.push({
        x: block.x + 28,
        y: block.y + edgeH + 24,
        w: block.w - 56,
        h: block.h - edgeH * 2 - 48,
        type: parkStyleIndex++ % 8
      });
      ctx.trees.push({
        x: block.x + block.w * .5,
        y: block.y - 28,
        size: 23
      });
      return;
    }
    const district = ctx.districtAt(block.x + block.w / 2, block.y + block.h / 2);
    const districtTypes = ctx.districtProfiles[district?.id]?.types || ['tenement', 'shop', 'warehouse', 'deco', 'townhouse', 'office'];
    const secondarySigns = ['APARTMENTS', 'REPAIR SHOP', 'GROCERY', 'WAREHOUSE', 'LAUNDROMAT', 'DINER', 'PAWN & LOAN', 'OLD BOOKS'];
    const floorRanges = {
      tenement: [4, 6],
      shop: [2, 3],
      warehouse: [1, 2],
      deco: [3, 5],
      townhouse: [2, 4],
      office: [5, 7]
    };
    for (let row = 0; row < 2; row++) for (let col = 0; col < 2; col++) {
      const archetype = districtTypes[(blockIndex + row * 2 + col) % districtTypes.length];
      const range = floorRanges[archetype],
        floors = range[0] + (blockIndex + row + col) % (range[1] - range[0] + 1);
      const inset = archetype === 'townhouse' ? 14 : archetype === 'warehouse' ? 5 : archetype === 'office' ? 9 : 0;
      ctx.buildings.push({
        ...block,
        x: block.x + col * (bw + gap) + inset,
        y: block.y + row * (bh + gap) + (archetype === 'shop' ? 12 : 0),
        w: bw - inset * 1.35,
        h: bh - (archetype === 'warehouse' ? 8 : archetype === 'shop' ? 18 : 0),
        floors,
        archetype,
        cornerRadius: archetype === 'warehouse' ? 5 : archetype === 'deco' ? 11 : archetype === 'townhouse' ? 7 : 18,
        sign: row === 0 && col === 0 ? block.sign.replace(/[^\x20-\x7E]/g, '').trim() : secondarySigns[(blockIndex * 3 + row * 2 + col) % secondarySigns.length],
        neon: ['#e09a3e', '#bba77c', '#9aa0a8', '#d4523a', '#5f9ea0', '#c06b47'][(blockIndex + row + col) % 6]
      });
    }
    ctx.trees.push({
      x: block.x + bw + gap / 2,
      y: block.y - 28,
      size: 23
    });
  });

  // Vary actual footprints inside existing parcels. Collision bodies shrink
  // with the facades, leaving genuine forecourts and accessible side alleys.
  ctx.buildings.forEach((b, i) => {
    const district = ctx.districtAt(b.x + b.w / 2, b.y + b.h / 2);
    b.districtId = district?.id;
    if (!b.civicType) b.roof = ctx.districtProfiles[district?.id]?.roof || b.roof;
    if (b.archetype === 'pavilion') return;
    const sx = [.82, 1, .91, .74, 1, .88][i % 6],
      sy = [1, .84, .93, 1, .79][i % 5];
    const dw = b.w * (1 - sx),
      dh = b.h * (1 - sy);
    b.x += dw * .5;
    b.y += dh * .5;
    b.w -= dw;
    b.h -= dh;
    if (b.archetype === 'townhouse') b.floors = 2 + i % 2;
    if (b.archetype === 'office') b.floors = 4 + i % 4;
    if (b.archetype === 'warehouse') b.floors = 1 + i % 2;
    b.neon = ['#d39b4e', '#bd754d', '#b6a880', '#80988d'][i % 4];
    b.cornerRadius = b.archetype === 'deco' ? 26 : b.archetype === 'shop' ? 18 : 6;
  });

  // Park furniture is real world geometry, not paint on the ground. The same
  // deterministic layouts drive rendering, pedestrian navigation and vehicle
  // contacts so visible trunks, water and street furniture cannot be crossed.
  ctx.parkZones.forEach((park, i) => {
    park.trees = [];
    park.benches = [];
    park.feature = {
      x: park.x + park.w * .53,
      y: park.y + park.h * .51,
      type: park.type
    };
    for (let t = 0; t < 16; t++) {
      const edge = t % 4,
        ratio = (ctx.env.Math.floor(t / 4) + 1) / 5;
      const x = edge === 0 ? park.x + park.w * ratio : edge === 1 ? park.x + park.w - 18 : edge === 2 ? park.x + park.w * (1 - ratio) : park.x + 18;
      const y = edge === 0 ? park.y + 18 : edge === 1 ? park.y + park.h * ratio : edge === 2 ? park.y + park.h - 18 : park.y + park.h * (1 - ratio);
      const tree = {
        x,
        y,
        size: 15 + (t + i) % 5,
        park: true
      };
      park.trees.push(tree);
      ctx.trees.push(tree);
    }
    for (let n = 0; n < 3; n++) {
      const bench = {
        x: park.x + park.w * (.25 + n * .25),
        y: park.y + park.h * .78,
        width: 42,
        height: 10,
        type: 'bench'
      };
      park.benches.push(bench);
      ctx.parkObstacles.push(bench);
    }
    const f = park.feature;
    if (park.type === 0) ctx.parkObstacles.push({
      x: f.x,
      y: f.y,
      width: 88,
      height: 58,
      type: 'fountain'
    });
    if (park.type === 1) ctx.parkObstacles.push({
      x: f.x,
      y: f.y,
      width: park.w * .42,
      height: park.h * .48,
      type: 'pond'
    });
    if (park.type === 3) for (let s = 0; s < 4; s++) ctx.parkObstacles.push({
      x: f.x - 48 + s * 40,
      y: f.y - 6,
      width: 31,
      height: 28,
      type: 'stall'
    });
    if (park.type === 4) {
      ctx.parkObstacles.push({
        x: f.x - 28,
        y: f.y + 10,
        width: 48,
        height: 24,
        type: 'playground'
      }, {
        x: f.x + 40,
        y: f.y - 8,
        width: 24,
        height: 38,
        type: 'swings'
      });
    }
    if (park.type === 5) for (let bed = 0; bed < 4; bed++) ctx.parkObstacles.push({
      x: f.x - 52 + bed % 2 * 68,
      y: f.y - 20 + ctx.env.Math.floor(bed / 2) * 42,
      width: 48,
      height: 24,
      type: 'gardenbed'
    });
    if (park.type === 6) ctx.parkObstacles.push({
      x: f.x - 44,
      y: f.y + 10,
      width: 44,
      height: 25,
      type: 'skateramp'
    }, {
      x: f.x + 38,
      y: f.y - 14,
      width: 36,
      height: 22,
      type: 'skateramp'
    });
    if (park.type === 7) ctx.parkObstacles.push({
      x: f.x - 34,
      y: f.y + 14,
      width: 18,
      height: 42,
      type: 'agility'
    }, {
      x: f.x + 26,
      y: f.y - 14,
      width: 46,
      height: 18,
      type: 'agility'
    });
  });

  // Physical street furniture: these coordinates are shared by rendering,
  // walking and vehicle contacts, so a visible shelter or phone box is solid.
  const shelters = [[820, 1088], [1740, 1284], [3320, 1088], [4260, 1284], [5650, 1088], [6600, 1284], [820, 4088], [3400, 4284], [5720, 4088], [8050, 1088], [8750, 4284]];
  shelters.forEach(([x, y], i) => ctx.streetProps.push({
    x,
    y,
    width: 60,
    height: 25,
    type: 'shelter',
    variant: i % 2
  }));
  const kiosks = [[1060, 1790], [2200, 620], [3670, 1790], [6060, 1790], [9000, 1790], [880, 4790], [4400, 4790], [5900, 7790]];
  kiosks.forEach(([x, y], i) => ctx.streetProps.push({
    x,
    y,
    width: 44,
    height: 32,
    type: 'kiosk',
    variant: i % 2
  }));
  const workZones = [[1890, 1085], [4480, 4085], [5980, 7085], [8300, 10085]];
  workZones.forEach(([x, y]) => ctx.streetProps.push({
    x: x + 34,
    y: y - 5,
    width: 76,
    height: 30,
    type: 'workzone'
  }));
  [[735, 1260], [1540, 1960], [3470, 1260], [5580, 1960], [7830, 1260], [9080, 4960], [760, 7960], [3300, 10940], [8220, 10940]].forEach(([x, y], i) => ctx.streetProps.push({
    x,
    y,
    width: i % 3 === 0 ? 22 : 16,
    height: i % 3 === 0 ? 34 : 18,
    type: i % 3 === 0 ? 'phone' : 'bin',
    variant: i % 2
  }));
  for (const [x, y, dir] of [[2390, 1108, 'h'], [2940, 1278, 'h'], [4740, 4108, 'h'], [5290, 4278, 'h'], [6900, 7108, 'h'], [7440, 7278, 'h']]) for (let n = -1; n <= 1; n++) ctx.streetProps.push({
    x: x + (dir === 'v' ? 0 : n * 22),
    y: y + (dir === 'v' ? n * 22 : 0),
    width: 9,
    height: 9,
    type: 'bollard'
  });
  ctx.solidProps.push(...ctx.parkObstacles, ...ctx.streetProps);

  // Props
  const hydrants = [{
    x: 430,
    y: 1115
  }, {
    x: 1180,
    y: 1115
  }, {
    x: 1980,
    y: 1115
  }, {
    x: 2930,
    y: 1115
  }, {
    x: 3830,
    y: 1115
  }, {
    x: 5280,
    y: 1115
  }, {
    x: 430,
    y: 4115
  }, {
    x: 1980,
    y: 4115
  }, {
    x: 3830,
    y: 4115
  }, {
    x: 5280,
    y: 4115
  }];
  hydrants.forEach(h => ctx.breakableProps.push({
    x: h.x,
    y: h.y,
    type: 'hydrant',
    intact: true,
    w: 14,
    h: 14
  }));
  const dumpsters = [{
    x: 620,
    y: 1100
  }, {
    x: 1370,
    y: 1100
  }, {
    x: 3120,
    y: 1100
  }, {
    x: 5470,
    y: 1100
  }, {
    x: 620,
    y: 4100
  }, {
    x: 3120,
    y: 4100
  }, {
    x: 5470,
    y: 4100
  }];
  dumpsters.forEach(d => ctx.breakableProps.push({
    x: d.x,
    y: d.y,
    type: 'dumpster',
    intact: true,
    w: 26,
    h: 18
  }));

  // District scenery: sodium lamps, parked cars, trees, cranes and billboards.
  for (let x = 520; x <= 10100 - 520; x += 320) {
    ctx.streetLights.push({
      x,
      y: 1110,
      tone: '#e09a3e'
    }, {
      x,
      y: 4290,
      tone: '#e8b84a'
    }, {
      x,
      y: 7110,
      tone: '#e09a3e'
    }, {
      x,
      y: 10110,
      tone: '#e8b84a'
    });
  }
  for (const y of [700, 1000, 1500, 1760, 3600, 3920, 4520, 4820]) {
    ctx.trees.push({
      x: 5255,
      y,
      size: 18 + y % 3 * 3
    }, {
      x: 6765,
      y: y + 35,
      size: 20 + y % 4 * 2
    });
  }
  const parkedPalette = ['#7c2d12', '#1e3a5f', '#4b5563', '#7f1d1d', '#713f12', '#0f766e'];
  for (let i = 0; i < 24; i++) {
    const south = i >= 12;
    const row = i % 12;
    ctx.parkedCars.push({
      x: [710, 880, 1450, 1660, 3190, 3410, 4100, 4320, 5540, 5750, 5910, 6050][row],
      y: south ? 4095 : 1095,
      angle: 0,
      width: 40,
      height: 19,
      color: parkedPalette[i % parkedPalette.length],
      type: ['sedan', 'coupe', 'wagon', 'taxi', 'van', 'sedan'][i % 6]
    });
  }
  ctx.cranes.push({
    x: 3260,
    y: 700,
    reach: 180
  }, {
    x: 4320,
    y: 760,
    reach: -170
  }, {
    x: 3300,
    y: 4450,
    reach: 190
  }, {
    x: 4420,
    y: 4550,
    reach: -160
  }, {
    x: 3000,
    y: 1720,
    reach: 150
  }, {
    x: 4650,
    y: 1650,
    reach: -145
  }, {
    x: 3260,
    y: 6660,
    reach: 205
  }, {
    x: 4380,
    y: 7460,
    reach: -180
  });
  ctx.billboards.push({
    x: 980,
    y: 1050,
    text: 'LOWTOWN FM',
    color: '#ec4899'
  }, {
    x: 1720,
    y: 1050,
    text: 'MIDNIGHT OIL',
    color: '#f59e0b'
  }, {
    x: 3520,
    y: 1050,
    text: 'IRONWORKS',
    color: '#38bdf8'
  }, {
    x: 5860,
    y: 1050,
    text: 'LANTERN BAY',
    color: '#ef4444'
  }, {
    x: 970,
    y: 4050,
    text: 'OLD MILL',
    color: '#f97316'
  }, {
    x: 3520,
    y: 4050,
    text: 'RED HOOK',
    color: '#dc2626'
  }, {
    x: 5850,
    y: 4050,
    text: 'BLACKWOOD',
    color: '#22c55e'
  }, {
    x: 6400,
    y: 4850,
    text: 'CHANNEL 8',
    color: '#60a5fa'
  }, {
    x: 980,
    y: 7050,
    text: 'MARROW POINT',
    color: '#e8b84a'
  }, {
    x: 3520,
    y: 7050,
    text: 'SOUTHPORT',
    color: '#d4523a'
  }, {
    x: 5850,
    y: 7050,
    text: 'VELVET COAST',
    color: '#e09a3e'
  }, {
    x: 8520,
    y: 1050,
    text: 'EASTGATE',
    color: '#e09a3e'
  }, {
    x: 8520,
    y: 4050,
    text: 'CINDER PARK',
    color: '#d4523a'
  }, {
    x: 8520,
    y: 7050,
    text: 'KINGSWAY',
    color: '#e8b84a'
  }, {
    x: 980,
    y: 10050,
    text: 'ALL SAINTS',
    color: '#9aa0a8'
  }, {
    x: 3520,
    y: 10050,
    text: 'ASHCROFT',
    color: '#d4523a'
  }, {
    x: 5850,
    y: 10050,
    text: 'NORTHSTAR',
    color: '#e09a3e'
  }, {
    x: 8520,
    y: 10050,
    text: 'KINGSPORT',
    color: '#e8b84a'
  });

  // Diverse Traffic Roster (Sedans, Taxis, Vans)
  const carTypes = [{
    type: 'sedan',
    color: '#334155',
    w: 46,
    h: 22
  }, {
    type: 'taxi',
    color: '#eab308',
    w: 46,
    h: 22
  }, {
    type: 'sports',
    color: '#dc2626',
    w: 48,
    h: 23
  }, {
    type: 'coupe',
    color: '#2563eb',
    w: 44,
    h: 21
  }, {
    type: 'wagon',
    color: '#475569',
    w: 50,
    h: 23
  }, {
    type: 'black',
    color: '#0f172a',
    w: 46,
    h: 22
  }, {
    type: 'van',
    color: '#7c8287',
    w: 53,
    h: 25
  }, {
    type: 'truck',
    color: '#786c5d',
    w: 60,
    h: 26
  }];
  for (let i = 0; i < 12; i++) {
    const isEast = i % 2 === 0;
    const model = carTypes[i % carTypes.length];
    ctx.trafficCars.push({
      x: 500 + i * 360,
      y: isEast ? 1165 : 1205,
      angle: isEast ? 0 : ctx.env.Math.PI,
      speed: (isEast ? 1 : -1) * (2.0 + ctx.env.Math.random() * 0.5),
      color: model.color,
      type: model.type,
      width: model.w,
      height: model.h,
      minX: 450,
      maxX: 9350
    });
  }
  for (let i = 0; i < 10; i++) {
    const isEast = i % 2 === 0;
    const model = carTypes[(i + 2) % carTypes.length];
    ctx.trafficCars.push({
      x: 520 + i * 455,
      y: isEast ? 4165 : 4205,
      angle: isEast ? 0 : ctx.env.Math.PI,
      speed: (isEast ? 1 : -1) * (1.9 + ctx.env.Math.random() * 0.6),
      color: model.color,
      type: model.type,
      width: model.w,
      height: model.h,
      axis: 'x',
      minX: 450,
      maxX: 9350
    });
  }
  for (let i = 0; i < 10; i++) {
    const isEast = i % 2 === 0;
    const model = carTypes[(i + 4) % carTypes.length];
    ctx.trafficCars.push({
      x: 520 + i * 410,
      y: isEast ? 7165 : 7205,
      angle: isEast ? 0 : ctx.env.Math.PI,
      speed: (isEast ? 1 : -1) * (1.8 + ctx.env.Math.random() * 0.55),
      color: model.color,
      type: model.type,
      width: model.w,
      height: model.h,
      axis: 'x',
      minX: 450,
      maxX: 9350
    });
  }
  [1200, 3850, 6200].forEach((x, lane) => {
    for (let i = 0; i < 4; i++) {
      const isSouth = i % 2 === 0;
      const model = carTypes[(lane * 2 + i) % carTypes.length];
      ctx.trafficCars.push({
        x: x + (isSouth ? 32 : 88),
        y: 700 + i * 1050,
        angle: isSouth ? ctx.env.Math.PI / 2 : -ctx.env.Math.PI / 2,
        speed: (isSouth ? 1 : -1) * (1.6 + ctx.env.Math.random() * 0.5),
        color: model.color,
        type: model.type,
        width: model.w,
        height: model.h,
        axis: 'y',
        minY: 450,
        maxY: 5250
      });
    }
  });
  for (let i = 0; i < 12; i++) {
    const isEast = i % 2 === 0;
    const model = carTypes[(i + 1) % carTypes.length];
    ctx.trafficCars.push({
      x: 520 + i * 515,
      y: isEast ? 10165 : 10205,
      angle: isEast ? 0 : ctx.env.Math.PI,
      speed: (isEast ? 1 : -1) * (1.8 + ctx.env.Math.random() * 0.5),
      color: model.color,
      type: model.type,
      width: model.w,
      height: model.h,
      axis: 'x',
      minX: 450,
      maxX: 9350
    });
  }
  for (let i = 0; i < 6; i++) {
    const isSouth = i % 2 === 0;
    const model = carTypes[(i + 3) % carTypes.length];
    ctx.trafficCars.push({
      x: 8500 + (isSouth ? 32 : 88),
      y: 650 + i * 1320,
      angle: isSouth ? ctx.env.Math.PI / 2 : -ctx.env.Math.PI / 2,
      speed: (isSouth ? 1 : -1) * (1.65 + ctx.env.Math.random() * 0.45),
      color: model.color,
      type: model.type,
      width: model.w,
      height: model.h,
      axis: 'y',
      minY: 450,
      maxY: 11100
    });
  }

  // Traffic actors carry an explicit identity so lane followers are not
  // repeatedly pushed sideways by the generic collision solver. Keep the
  // opening junction clear for a fair first frame and deterministic autotest.
  for (let i = ctx.trafficCars.length - 1; i >= 0; i--) {
    const car = ctx.trafficCars[i];
    car.isTraffic = true;
    car.trafficId = `traffic-${i}`;
    car.waitingAtEdge = false;
    const horizontal = car.axis !== 'y',
      cross = horizontal ? 'y' : 'x';
    const route = [...ctx.roads, ...ctx.bridges].find(r => r.dir === (horizontal ? 'h' : 'v') && car.x >= r.x && car.x <= r.x + r.w && car.y >= r.y && car.y <= r.y + r.h);
    if (route) {
      car.laneCenter = horizontal ? route.y + route.h / 2 : route.x + route.w / 2;
      car.turnRadius = 32;
      car[cross] = car.laneCenter - ctx.env.Math.sign(car.speed) * car.turnRadius;
    }
    if (ctx.env.Math.hypot(car.x - ctx.player.x, car.y - ctx.player.y) < 230) ctx.trafficCars.splice(i, 1);
  }

  // Stylish Pedestrians
  const pedStyles = [{
    shirt: '#825044',
    pants: '#1e293b',
    hair: '#78350f',
    skin: '#fcd34d',
    accessory: 'cap'
  }, {
    shirt: '#4c6373',
    pants: '#334155',
    hair: '#1c1917',
    skin: '#fed7aa',
    accessory: 'backpack'
  }, {
    shirt: '#566952',
    pants: '#0f172a',
    hair: '#d97706',
    skin: '#fcd34d',
    accessory: 'scarf'
  }, {
    shirt: '#9b7948',
    pants: '#1e293b',
    hair: '#451a03',
    skin: '#ffedd5',
    accessory: 'satchel'
  }, {
    shirt: '#73535b',
    pants: '#475569',
    hair: '#172554',
    skin: '#fed7aa',
    accessory: 'hood'
  }, {
    shirt: '#64748b',
    pants: '#090d16',
    hair: '#52525b',
    skin: '#fde047',
    accessory: 'vest'
  }, {
    shirt: '#a15b35',
    pants: '#28333a',
    hair: '#201712',
    skin: '#d8a77f',
    accessory: 'beanie'
  }, {
    shirt: '#426c5d',
    pants: '#3a302a',
    hair: '#7b4d2c',
    skin: '#e9c9a0',
    accessory: 'coat'
  }, {
    shirt: '#4b4d70',
    pants: '#252633',
    hair: '#19191d',
    skin: '#b77e5c',
    accessory: 'shoulderBag'
  }, {
    shirt: '#75624c',
    pants: '#394044',
    hair: '#cac2a5',
    skin: '#edcda8',
    accessory: 'cap'
  }, {
    shirt: '#984f54',
    pants: '#252d42',
    hair: '#271c22',
    skin: '#e4ad88',
    accessory: 'scarf'
  }, {
    shirt: '#576a80',
    pants: '#31372f',
    hair: '#38291e',
    skin: '#9d6849',
    accessory: 'vest'
  }];
  for (let i = 0; i < 28; i++) {
    const style = pedStyles[i % pedStyles.length];
    ctx.pedestrians.push({
      x: 480 + i * 230,
      y: 1120 + (i % 2 === 0 ? -16 : ctx.ROAD_W + 16),
      vx: (ctx.env.Math.random() - 0.5) * 0.9,
      vy: 0,
      shirt: style.shirt,
      pants: style.pants,
      hair: style.hair,
      skin: style.skin,
      accessory: style.accessory,
      walkPhase: ctx.env.Math.random() * ctx.env.Math.PI * 2,
      visualScale: .82 + i % 5 * .035,
      fleeTimer: 0
    });
  }
  for (let i = 0; i < 24; i++) {
    const style = pedStyles[(i + 3) % pedStyles.length];
    ctx.pedestrians.push({
      x: 500 + i * 265,
      y: 4120 + (i % 2 === 0 ? -16 : ctx.ROAD_W + 16),
      vx: (ctx.env.Math.random() - 0.5) * 0.9,
      vy: 0,
      minX: 450,
      maxX: 9350,
      shirt: style.shirt,
      pants: style.pants,
      hair: style.hair,
      skin: style.skin,
      accessory: style.accessory,
      walkPhase: ctx.env.Math.random() * ctx.env.Math.PI * 2,
      visualScale: .82 + i % 4 * .04,
      fleeTimer: 0
    });
  }
  for (let i = 0; i < 24; i++) {
    const style = pedStyles[(i + 2) % pedStyles.length];
    ctx.pedestrians.push({
      x: 500 + i * 265,
      y: 7120 + (i % 2 === 0 ? -16 : ctx.ROAD_W + 16),
      vx: (ctx.env.Math.random() - 0.5) * 0.85,
      vy: 0,
      minX: 450,
      maxX: 9350,
      shirt: style.shirt,
      pants: style.pants,
      hair: style.hair,
      skin: style.skin,
      accessory: style.accessory,
      walkPhase: ctx.env.Math.random() * ctx.env.Math.PI * 2,
      visualScale: .82 + i % 6 * .03,
      fleeTimer: 0
    });
  }
  for (let i = 0; i < 32; i++) {
    const style = pedStyles[(i + 1) % pedStyles.length];
    ctx.pedestrians.push({
      x: 520 + i * 285,
      y: 10120 + (i % 2 === 0 ? -16 : ctx.ROAD_W + 16),
      vx: (ctx.env.Math.random() - 0.5) * 0.85,
      vy: 0,
      minX: 450,
      maxX: 9350,
      shirt: style.shirt,
      pants: style.pants,
      hair: style.hair,
      skin: style.skin,
      walkPhase: ctx.env.Math.random() * ctx.env.Math.PI * 2,
      visualScale: .82 + i % 5 * .035,
      accessory: style.accessory,
      fleeTimer: 0
    });
  }
  ctx.billboards.forEach((b, i) => b.color = ['#d39b4e', '#bd754d', '#b6a880'][i % 3]);
  remapLegacyScene({
    roads: ctx.roads,
    scenicRoads: ctx.scenicRoads,
    buildings: ctx.buildings,
    parkZones: ctx.parkZones,
    breakableProps: ctx.breakableProps,
    trees: ctx.trees,
    parkObstacles: ctx.parkObstacles,
    streetProps: ctx.streetProps,
    solidProps: ctx.solidProps,
    streetLights: ctx.streetLights,
    cranes: ctx.cranes,
    billboards: ctx.billboards,
    pedestrians: ctx.pedestrians,
    parkedCars: ctx.parkedCars,
    trafficCars: ctx.trafficCars
  });
  ctx.constructingLegacyScene = false;
  ctx.bridges.splice(0, ctx.bridges.length, ...remapBridges(ctx.legacyBridges), ...isletWalkways());
  ctx.bridgeRails.length = 0;
  for (const bridge of ctx.bridges) {
    if (!bridge.footway) {
      const a = 340,
        h = bridge.dir === 'h';
      if (bridge.landfallStart) ctx.roads.push(h ? {
        x: bridge.x - a,
        y: bridge.y,
        w: a,
        h: bridge.h,
        dir: 'h',
        bridgeApproach: true
      } : {
        x: bridge.x,
        y: bridge.y - a,
        w: bridge.w,
        h: a,
        dir: 'v',
        bridgeApproach: true
      });
      if (bridge.landfallEnd) ctx.roads.push(h ? {
        x: bridge.x + bridge.w,
        y: bridge.y,
        w: a,
        h: bridge.h,
        dir: 'h',
        bridgeApproach: true
      } : {
        x: bridge.x,
        y: bridge.y + bridge.h,
        w: bridge.w,
        h: a,
        dir: 'v',
        bridgeApproach: true
      });
    }
    if (typeof organicStreetNetwork === 'function' && !bridge.footway) continue;
    if (bridge.dir === 'v') ctx.bridgeRails.push({
      x: bridge.x - 12,
      y: bridge.y,
      w: 14,
      h: bridge.h,
      axis: 'x'
    }, {
      x: bridge.x + bridge.w - 2,
      y: bridge.y,
      w: 14,
      h: bridge.h,
      axis: 'x'
    });else ctx.bridgeRails.push({
      x: bridge.x,
      y: bridge.y - 12,
      w: bridge.w,
      h: 14,
      axis: 'y'
    }, {
      x: bridge.x,
      y: bridge.y + bridge.h - 2,
      w: bridge.w,
      h: 14,
      axis: 'y'
    });
  }
  normalizeStreetGeometry(ctx.roads);
  roadTerminals(ctx.roads, ctx.bridges, ctx.isPositionOnIslandLand);
  if (typeof organicStreetNetwork === 'function') {
    const network = organicStreetNetwork(ctx.roads, ctx.bridges, ctx.islands, createRoadGraph(ctx.roads, ctx.bridges.filter(b => !b.footway)));
    ctx.roads.splice(0, ctx.roads.length, ...network.roads);
    ctx.bridges.splice(0, ctx.bridges.length, ...network.bridges);
    for (const road of ctx.scenicRoads) road.points = road.points.map(([x, y]) => {
      const p = network.bend({
        x,
        y
      });
      return [p.x, p.y];
    });
    const paths = ctx.scenicRoads.map(r => corridorRoad(r.points, r.width));
    fitBuildingsToStreets(ctx.buildings, [...ctx.roads, ...paths, ...ctx.bridges], ctx.isPositionOnIslandLand, ctx.islands, [...ctx.parkZones, ...ctx.PLANE_RUNWAYS, ...ctx.helipads.map(p => ({
      x: p.x - 105,
      y: p.y - 155,
      w: 210,
      h: 250
    }))]);
    ctx.bridgeRails.splice(0, ctx.bridgeRails.length, ...ctx.bridgeRails.filter(rail => ctx.bridges.some(b => b.footway && rail.x + rail.w >= b.x - 14 && rail.x <= b.x + b.w + 14 && rail.y + rail.h >= b.y - 14 && rail.y <= b.y + b.h + 14)));
    for (let i = ctx.parkObstacles.length - 1; i >= 0; i--) if (onStreetCollection(ctx.parkObstacles[i].x, ctx.parkObstacles[i].y, ctx.roads, 45)) ctx.parkObstacles.splice(i, 1);
  }
  const openRails = [];
  for (const rail of ctx.bridgeRails) {
    const vertical = rail.axis === 'x',
      start = vertical ? rail.y : rail.x,
      length = vertical ? rail.h : rail.w;
    const fixed = vertical ? rail.x + rail.w / 2 : rail.y + rail.h / 2;
    if (ctx.roads.some(r => r.points)) {
      const motor = [...ctx.roads, ...ctx.bridges.filter(b => !b.footway)],
        steps = ctx.env.Math.ceil(length / 4);
      let from = null;
      for (let i = 0; i <= steps; i++) {
        const along = start + length * i / steps,
          x = vertical ? fixed : along,
          y = vertical ? along : fixed;
        const clear = !onStreetCollection(x, y, motor, 22);
        if (clear && from === null) from = along;
        if (from !== null && (!clear || i === steps)) {
          const end = clear ? along : along - length / steps;
          if (end - from > 4) openRails.push(vertical ? {
            ...rail,
            y: from,
            h: end - from
          } : {
            ...rail,
            x: from,
            w: end - from
          });
          from = null;
        }
      }
      continue;
    }
    const masks = [...ctx.roads, ...ctx.bridges.filter(b => b.dir !== (vertical ? 'v' : 'h'))].filter(r => fixed >= (vertical ? r.x : r.y) - 12 && fixed <= (vertical ? r.x + r.w : r.y + r.h) + 12).map(r => vertical ? [r.y - 12, r.y + r.h + 12] : [r.x - 12, r.x + r.w + 12]);
    for (const [a, b] of ctx.subtractRoadIntervals(start, start + length, masks)) openRails.push(vertical ? {
      ...rail,
      y: a,
      h: b - a
    } : {
      ...rail,
      x: a,
      w: b - a
    });
  }
  ctx.bridgeRails.splice(0, ctx.bridgeRails.length, ...openRails);
  ctx.relocateStreetObstacles();
  ctx.stuntZones.length = 0;
  ctx.roadEnds.push(...roadTerminals(ctx.roads, ctx.bridges, ctx.isPositionOnIslandLand));
  for (const island of [...ctx.islands, ...ctx.islets]) for (let n = 0; n < (island.natural ? 7 : ctx.districtProfiles[island.id].trees); n++) {
    const x = island.natural ? island.x + island.w * (.25 + n % 3 * .22) : island.x + island.w - 150 - n % 3 * 28;
    const y = island.natural ? island.y + island.h * (.25 + ctx.env.Math.floor(n / 3) * .21) : island.y + 240 + ctx.env.Math.floor(n / 3) * 180;
    if (!ctx.isPositionOnIslandLand(x, y) || ctx.buildings.some(b => x > b.x - 35 && x < b.x + b.w + 35 && y > b.y - 35 && y < b.y + b.h + 35)) continue;
    if ([[0, 0], [38, 0], [-38, 0], [0, 38], [0, -38]].some(([dx, dy]) => onRoadSurface(x + dx, y + dy, ctx.roads, ctx.bridges, ctx.scenicRoads, ctx.roadEnds))) continue;
    ctx.trees.push({
      x,
      y,
      size: 17 + n % 4 * 3,
      shore: true
    });
  }
  for (const terrain of AUTHORED_TERRAIN) {
    if (!['woodland', 'bluff'].includes(terrain.kind)) continue;
    for (let n = 0; n < 22; n++) {
      const angle = n * 2.3999632297,
        radius = terrain.radius * ctx.env.Math.sqrt((n + .5) / 22) * .8;
      const x = terrain.x + ctx.env.Math.cos(angle) * radius,
        y = terrain.y + ctx.env.Math.sin(angle) * radius;
      if (!ctx.isPositionOnIslandLand(x, y) || ctx.buildings.some(b => x > b.x - 40 && x < b.x + b.w + 40 && y > b.y - 40 && y < b.y + b.h + 40)) continue;
      if (ctx.trees.some(t => ctx.env.Math.hypot(t.x - x, t.y - y) < 43)) continue;
      if ([[0, 0], [42, 0], [-42, 0], [0, 42], [0, -42]].some(([dx, dy]) => onRoadSurface(x + dx, y + dy, ctx.roads, ctx.bridges, ctx.scenicRoads, ctx.roadEnds))) continue;
      ctx.trees.push({
        x,
        y,
        size: 18 + n % 4 * 3,
        shore: true
      });
    }
  }
  ctx.buildServiceAccess();
  if (ctx.roads.some(r => r.points)) ctx.roadEnds.splice(0, ctx.roadEnds.length, ...roadTerminals(ctx.roads, ctx.bridges, ctx.isPositionOnIslandLand));
  ctx.relocateStreetObstacles();
  // Reserve the complete visible footprint, including bridge decks and kerbs.
  ctx.shorelineDetails = ctx.shorelineDraft.filter(detail => Array.from({
    length: 17
  }, (_, i) => i === 16 ? [0, 0] : [ctx.env.Math.cos(i * ctx.env.Math.PI / 8) * 40, ctx.env.Math.sin(i * ctx.env.Math.PI / 8) * 40]).every(([dx, dy]) => !onRoadSurface(detail.x + dx, detail.y + dy, ctx.roads, ctx.bridges, ctx.scenicRoads.map(r => ({
    ...r,
    footway: false
  })), ctx.roadEnds)));
  ctx.roadGraph = createRoadGraph(ctx.roads, ctx.bridges.filter(b => !b.footway), ctx.serviceBases.map(base => base.origin));
  if (typeof nearestStreet === 'function') ctx.alignStreetLocations();
  const circuits = createRoadCircuits(ctx.roadGraph);
  for (const car of ctx.trafficCars) {
    let choice = null;
    for (const circuit of circuits) for (let i = 0; i < circuit.length; i++) {
      const a = circuit[i],
        b = circuit[(i + 1) % circuit.length],
        dx = b.x - a.x,
        dy = b.y - a.y;
      const t = ctx.env.Math.max(0, ctx.env.Math.min(1, ((car.x - a.x) * dx + (car.y - a.y) * dy) / (dx * dx + dy * dy || 1)));
      const point = {
          x: a.x + t * dx,
          y: a.y + t * dy
        },
        distance = ctx.env.Math.hypot(car.x - point.x, car.y - point.y);
      if (!choice || distance < choice.distance) choice = {
        circuit,
        i,
        point,
        distance
      };
    }
    if (!choice) continue;
    let points = choice.circuit.map(p => ({
      ...p
    }));
    const next = points[(choice.i + 1) % points.length];
    const heading = ctx.env.Math.atan2(next.y - choice.point.y, next.x - choice.point.x);
    if (ctx.env.Math.cos(heading - car.angle) < 0) {
      points.reverse();
      choice.i = points.length - 2 - choice.i;
    }
    const start = (choice.i + 1 + points.length) % points.length;
    points = [choice.point, ...points.slice(start), ...points.slice(0, start)];
    const lanePoints = [];
    for (let i = 0; i < points.length; i++) {
      const p = points[i],
        before = points[(i - 1 + points.length) % points.length],
        after = points[(i + 1) % points.length];
      const a = ctx.env.Math.atan2(p.y - before.y, p.x - before.x),
        b = ctx.env.Math.atan2(after.y - p.y, after.x - p.x);
      const turn = ctx.env.Math.atan2(ctx.env.Math.sin(b - a), ctx.env.Math.cos(b - a));
      if (ctx.env.Math.abs(turn) < .01) lanePoints.push({
        x: p.x - ctx.env.Math.sin(b) * 30,
        y: p.y + ctx.env.Math.cos(b) * 30
      });else {
        const entry = ctx.env.Math.min(45, ctx.env.Math.hypot(p.x - before.x, p.y - before.y) / 3);
        const exit = ctx.env.Math.min(45, ctx.env.Math.hypot(after.x - p.x, after.y - p.y) / 3);
        lanePoints.push({
          x: p.x - ctx.env.Math.cos(a) * entry - ctx.env.Math.sin(a) * 30,
          y: p.y - ctx.env.Math.sin(a) * entry + ctx.env.Math.cos(a) * 30
        }, {
          x: p.x - (ctx.env.Math.sin(a) + ctx.env.Math.sin(b)) * 15,
          y: p.y + (ctx.env.Math.cos(a) + ctx.env.Math.cos(b)) * 15
        }, {
          x: p.x + ctx.env.Math.cos(b) * exit - ctx.env.Math.sin(b) * 30,
          y: p.y + ctx.env.Math.sin(b) * exit + ctx.env.Math.cos(b) * 30
        });
      }
    }
    points = lanePoints;
    car.x = points[0].x;
    car.y = points[0].y;
    car.angle = ctx.env.Math.atan2(points[1].y - car.y, points[1].x - car.x);
    car.cruiseSpeed = ctx.env.Math.abs(car.cruiseSpeed || car.speed || 1.1);
    car.speed = 0;
    car.routeManaged = true;
    car.route = {
      points,
      loop: true,
      stopIndices: []
    };
    car.routeIndex = 1;
  }
  ctx.cityIncidentDirector = createCityIncidentDirector({
    nodes: ctx.roadGraph,
    chooseLocation: ctx.incidentLocation
  });
  ctx.incidentNoticeId = 0;
  const busLines = [{
    id: 'north-shore',
    stops: [[1200, 1200], [2500, 1200], [3850, 1200], [4850, 1200], [6200, 1200], [7000, 1200], [8500, 1200], [8500, 4200], [7000, 4200], [6200, 4200], [4850, 4200], [3850, 4200], [2500, 4200], [1200, 4200]]
  }, {
    id: 'south-link',
    stops: [[1200, 7200], [2500, 7200], [3850, 7200], [4850, 7200], [6200, 7200], [7000, 7200], [8500, 7200], [8500, 10200], [7000, 10200], [6200, 10200], [4850, 10200], [3850, 10200], [2500, 10200], [1200, 10200]]
  }];
  for (const line of busLines) {
    const route = planStopRoute(ctx.roadGraph, line.stops.map(([x, y]) => {
      const p = worldPoint({
        x,
        y
      });
      return [p.x, p.y];
    }), {
      loop: true,
      id: line.id
    });
    if (route?.points.length > 8) {
      ctx.placeTransitStops(route);
      ctx.transitRoutes.push(route);
    }
  }
  ctx.associateBusShelters();
  ctx.transitRoutes.forEach((route, lineIndex) => {
    for (let busIndex = 0; busIndex < 2; busIndex++) {
      const points = route.points,
        total = points.length,
        origin = ctx.env.Math.floor(total * (busIndex ? 0.58 : 0.16));
      let start = -1;
      for (let offset = 0; offset < total; offset++) {
        const index = (origin + offset) % total,
          p = points[index];
        if (!ctx.trafficCars.some(c => ctx.env.Math.hypot(c.x - p.x, c.y - p.y) < 190) && !ctx.parkedCars.some(c => ctx.env.Math.hypot(c.x - p.x, c.y - p.y) < 130)) {
          start = index;
          break;
        }
      }
      if (start < 0) continue;
      const point = points[start],
        next = points[(start + 1) % total];
      ctx.trafficCars.push({
        x: point.x,
        y: point.y,
        angle: ctx.env.Math.atan2(next.y - point.y, next.x - point.x),
        speed: 0,
        cruiseSpeed: 1.12,
        color: lineIndex ? '#b28a52' : '#5b8f8a',
        type: 'bus',
        width: 82,
        height: 30,
        mass: 8200,
        axis: 'x',
        isTraffic: true,
        trafficId: `bus-${lineIndex}-${busIndex}`,
        routeManaged: true,
        route,
        routeIndex: (start + 1) % total,
        lastStopIndex: -1,
        routeWait: 0
      });
    }
  });
  // Final shelter/scenery relocation can keep array lengths unchanged.
  // Rebuild collision bounds before assigning residents to walking routes.
  ctx.invalidateScenery();
  ctx.walkingRoutes = createWalkingRoutes(ctx.roads, ctx.parkZones, (x, y) => !ctx.isPedestrianSceneryBlocked(x, y) && !onRoadSurface(x, y, ctx.roads, ctx.bridges, [], ctx.roadEnds) && !ctx.parkedCars.some(c => ctx.pedestrianCarBlocked(x, y, c)));
  for (const route of ctx.walkingRoutes) {
    const point = route.points[ctx.env.Math.floor(route.points.length / 2)];
    route.districtId = ctx.districtAt(point.x, point.y)?.id;
  }
  for (const p of ctx.pedestrians) {
    const district = ctx.districtAt(p.x, p.y) || ctx.islands.reduce((best, i) => ctx.env.Math.hypot(p.x - i.x - i.w / 2, p.y - i.y - i.h / 2) < ctx.env.Math.hypot(p.x - best.x - best.w / 2, p.y - best.y - best.h / 2) ? i : best, ctx.islands[0]);
    p.districtId = district.id;
  }
  for (const district of ctx.islands) {
    const count = ctx.pedestrians.filter(p => p.districtId === district.id).length;
    for (let n = count; n < ctx.districtProfiles[district.id].population; n++) {
      const style = pedStyles[(ctx.pedestrians.length + n) % pedStyles.length];
      ctx.pedestrians.push({
        ...style,
        districtId: district.id,
        x: district.x + district.w / 2,
        y: district.y + 1000,
        visualScale: .85 + n % 4 * .035,
        walkPhase: 0,
        fleeTimer: 0
      });
    }
  }
  assignWalkingRoutes(ctx.pedestrians, ctx.walkingRoutes);
  ctx.preparePedestrianRoutines();
  populateWorldDetails(ctx);
  populateBeaches(ctx);
  mobilizeSmallProps(ctx);
  ctx.pedestrians.forEach((person,index)=>{if(!person.beachRoute&&index%23===0)person.weapon=index%2?'pistol':'bat';});
};
ctx.alignStreetLocations = function alignStreetLocations() {
  if (!ctx.roads.some(r => r.points)) return;
  const streets = ctx.roads.filter(r => !r.serviceAccess && !r.bridgeApproach),
    used = [];
  const clear = p => ctx.isPositionOnIslandLand(p.x, p.y) && !ctx.isPedestrianSceneryBlocked(p.x, p.y) && !ctx.buildings.some(b => p.x > b.x - 32 && p.x < b.x + b.w + 32 && p.y > b.y - 32 && p.y < b.y + b.h + 32);
  for (const car of ctx.parkedCars) {
    const owner = ctx.districtAt(car.x, car.y),
      choices = [];
    for (const road of streets) {
      const points = streetPoints(road);
      for (let i = 4; i < points.length - 4; i += 4) {
        const a = points[i - 1],
          b = points[i + 1],
          angle = ctx.env.Math.atan2(b[1] - a[1], b[0] - a[0]);
        if (owner && ctx.districtAt(...points[i])?.id !== owner.id) continue;
        for (const side of [-1, 1]) {
          const distance = streetWidth(road) / 2 + 10,
            p = {
              x: points[i][0] - ctx.env.Math.sin(angle) * side * distance,
              y: points[i][1] + ctx.env.Math.cos(angle) * side * distance,
              angle: angle + (side < 0 ? ctx.env.Math.PI : 0)
            };
          if (!clear(p) || used.some(q => ctx.env.Math.hypot(p.x - q.x, p.y - q.y) < 85) || onStreetCollection(p.x, p.y, ctx.roads, -8)) continue;
          choices.push({
            ...p,
            distance: ctx.env.Math.hypot(p.x - car.x, p.y - car.y)
          });
        }
      }
    }
    choices.sort((a, b) => a.distance - b.distance);
    if (!choices.length) throw new Error('No clear roadside parking bay');
    Object.assign(car, choices[0]);
    used.push(car);
  }
  for (const point of [...ctx.safeSpawnPoints, ...ctx.CARPARTS]) {
    const location = nearestStreet(point.x, point.y, streets);
    if (location) Object.assign(point, {
      x: location.x,
      y: location.y
    });
  }
  const spawn = nearestStreet(ctx.player.x, ctx.player.y, streets);
  if (spawn) Object.assign(ctx.player, {
    x: spawn.x,
    y: spawn.y,
    angle: spawn.angle
  });
};
ctx.relocateStreetObstacles = function relocateStreetObstacles(requested = null) {
  const asphalt = [...ctx.roads, ...ctx.bridges];
  const furniture = [...ctx.solidProps, ...ctx.trees, ...ctx.breakableProps, ...ctx.streetLights, ...ctx.billboards, ...ctx.cranes];
  const lamps = new Set(ctx.streetLights),
    boards = new Set(ctx.billboards);
  const dimensions = new WeakMap(furniture.map(p => [p, {
    w: p.width || p.w || (lamps.has(p) ? 6 : boards.has(p) ? 80 : 20),
    h: p.height || p.h || (lamps.has(p) ? 6 : boards.has(p) ? 12 : 20)
  }]));
  const widthOf = p => dimensions.get(p).w,
    heightOf = p => dimensions.get(p).h;
  const clear = (p, ignore) => {
    const w = widthOf(ignore),
      h = heightOf(ignore);
    const margin = lamps.has(ignore) ? 2 : 8;
    return (typeof rectangleClearOfStreets !== 'function' || rectangleClearOfStreets({
      x: p.x - w / 2,
      y: p.y - h / 2,
      w,
      h
    }, asphalt, margin)) && [[0, 0], [-w / 2, -h / 2], [w / 2, -h / 2], [-w / 2, h / 2], [w / 2, h / 2]].every(([dx, dy]) => ctx.isPositionOnSolidGround(p.x + dx, p.y + dy)) && [[0, 0], [-w / 2 - margin, -h / 2 - margin], [w / 2 + margin, -h / 2 - margin], [-w / 2 - margin, h / 2 + margin], [w / 2 + margin, h / 2 + margin]].every(([dx, dy]) => !onRoadSurface(p.x + dx, p.y + dy, asphalt, [], ctx.scenicRoads, ctx.roadEnds)) && !ctx.buildings.some(b => p.x + w / 2 + 6 > b.x && p.x - w / 2 - 6 < b.x + b.w && p.y + h / 2 + 6 > b.y && p.y - h / 2 - 6 < b.y + b.h) && !furniture.some(o => o !== ignore && ctx.env.Math.abs(o.x - p.x) < (widthOf(o) + w) / 2 + 4 && ctx.env.Math.abs(o.y - p.y) < (heightOf(o) + h) / 2 + 4);
  };
  for (const prop of requested || furniture) {
    if (clear(prop, prop)) continue;
    const home = {
      x: prop.x,
      y: prop.y
    };
    let placed = false;
    for (let radius = 16; radius <= 1600 && !placed; radius += 16) for (let n = 0; n < 16; n++) {
      const a = n * ctx.env.Math.PI / 8,
        candidate = {
          ...prop,
          x: home.x + ctx.env.Math.cos(a) * radius,
          y: home.y + ctx.env.Math.sin(a) * radius
        };
      if (!clear(candidate, prop)) continue;
      Object.assign(prop, candidate);
      placed = true;
      break;
    }
  }
};
ctx.buildServiceAccess = function buildServiceAccess() {
  for (const building of ctx.buildings) {
    const kind = /police\s+(precinct|station)/i.test(building.sign || '') ? 'police' : building.civicType;
    if (!['police', 'hospital', 'firestation', 'guardBase'].includes(kind) || !building.serviceParcel) continue;
    const parcel = building.serviceParcel;
    let choice;
    if (ctx.roads.some(r => r.points)) {
      const sources = [{
        x: building.x + building.w + 70,
        y: building.y + building.h / 2
      }, {
        x: building.x - 70,
        y: building.y + building.h / 2
      }, {
        x: building.x + building.w / 2,
        y: building.y + building.h + 70
      }, {
        x: building.x + building.w / 2,
        y: building.y - 70
      }];
      for (const origin of sources) {
        const entry = nearestStreet(origin.x, origin.y, ctx.roads.filter(r => !r.serviceAccess && !r.bridgeApproach));
        if (!entry || entry.distance > 420) continue;
        const driveway = corridorRoad([[origin.x, origin.y], [entry.x, entry.y]], 110, {
          dir: ctx.env.Math.abs(entry.x - origin.x) > ctx.env.Math.abs(entry.y - origin.y) ? 'h' : 'v',
          serviceAccess: true,
          name: building.sign
        });
        const steps = ctx.env.Math.max(1, ctx.env.Math.ceil(entry.distance / 8));
        let clear = true;
        const angle = ctx.env.Math.atan2(entry.y - origin.y, entry.x - origin.x),
          nx = -ctx.env.Math.sin(angle),
          ny = ctx.env.Math.cos(angle);
        for (let i = 0; i <= steps && clear; i++) for (const side of [-1, 0, 1]) {
          const x = origin.x + (entry.x - origin.x) * i / steps + nx * side * 50,
            y = origin.y + (entry.y - origin.y) * i / steps + ny * side * 50;
          if (!ctx.isPositionOnSolidGround(x, y) || ctx.buildings.some(b => x > b.x - 8 && x < b.x + b.w + 8 && y > b.y - 8 && y < b.y + b.h + 8)) {
            clear = false;
            break;
          }
        }
        if (clear) {
          choice = {
            building,
            kind,
            origin,
            entry: {
              x: entry.x,
              y: entry.y
            },
            driveway
          };
          break;
        }
      }
      if (choice) {
        ctx.serviceBases.push(choice);
        ctx.roads.push(choice.driveway);
      }
      continue;
    }
    for (const ratio of [.84, .88, .80]) {
      const origin = {
        x: parcel.x + parcel.w * .82,
        y: parcel.y + parcel.h * ratio
      };
      const candidates = ctx.roads.filter(r => !r.serviceAccess && !r.bridgeApproach && r.dir === 'v' && origin.y >= r.y + 48 && origin.y <= r.y + r.h - 48).map(r => ({
        x: r.x + r.w / 2,
        y: origin.y
      })).filter(p => p.x > origin.x && p.x - origin.x < 650).sort((a, b) => a.x - b.x);
      for (const entry of candidates) {
        const driveway = {
          x: origin.x - 48,
          y: origin.y - 48,
          w: entry.x - origin.x + 96,
          h: 96,
          dir: 'h',
          serviceAccess: true,
          name: building.sign
        };
        let clear = true;
        for (let x = driveway.x; x <= driveway.x + driveway.w && clear; x += 8) for (const y of [driveway.y, origin.y, driveway.y + 96]) {
          if (ctx.isPedestrianSceneryBlocked(x, y)) {
            clear = false;
            break;
          }
        }
        if (!clear || ctx.parkedCars.some(c => c.x >= driveway.x - 35 && c.x <= driveway.x + driveway.w + 35 && ctx.env.Math.abs(c.y - origin.y) < 65)) continue;
        choice = {
          building,
          kind,
          origin,
          entry,
          driveway
        };
        break;
      }
      if (choice) break;
    }
    if (choice) {
      ctx.serviceBases.push(choice);
      ctx.roads.push(choice.driveway);
    }
  }
};
}
