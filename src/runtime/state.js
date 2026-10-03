// One shared runtime context owns state; this system has no hidden globals.
export function installRuntimeState(ctx){
const {ARCHIPELAGO_HEIGHT,ARCHIPELAGO_WIDTH,AUTHORED_ISLETS,BEACH_WIDTH,LEGACY_RUNWAYS,authoredDistricts,coastPoints,createWeather,districtPoint,pointInBeach,sourceDistrict,worldPoint}=ctx.dependencies;
ctx.LOWTOWN_QUERY = String(ctx.env.window.location?.search || '');
ctx.localBridgeQA = ['127.0.0.1', 'localhost'].includes(ctx.env.window.location?.hostname) && /(?:\?|&)cityQA=1(?:&|$)/.test(ctx.LOWTOWN_QUERY);
ctx.bridgeEndCap = ctx.localBridgeQA && /(?:\?|&)bridgeCaps=round(?:&|$)/.test(ctx.LOWTOWN_QUERY) ? 'round' : 'butt';
ctx.perfEnabled = ctx.localBridgeQA && /(?:\?|&)perf=1(?:&|$)/.test(ctx.LOWTOWN_QUERY);
ctx.perfSamples = {
  logic: [],
  render: [],
  frame: []
};
ctx.PERF_SAMPLE_LIMIT = 600;
if (ctx.perfEnabled) ctx.env.window.__LOWTOWN_PERF__ = {
  get bridgeCaps() {
    return ctx.bridgeEndCap;
  },
  setBridgeCaps(value) {
    ctx.bridgeEndCap = value === 'round' ? 'round' : 'butt';
    return ctx.bridgeEndCap;
  },
  reset: ctx.resetPerfSamples,
  summary: ctx.perfSummary
};
ctx.sound = new ctx.SynthAudio();
ctx.canvas = ctx.env.document.getElementById('gameCanvas');
ctx.ctx = ctx.canvas.getContext('2d');
ctx.threeCanvas = ctx.env.document.getElementById('threeCanvas');
ctx.threeRenderer = null;
ctx.env.window.__lowtownRenderer = 'canvas';
ctx.radarCanvas = ctx.env.document.getElementById('radarCanvas');
ctx.radarCtx = ctx.radarCanvas.getContext('2d');
ctx.fullMapCanvas = ctx.env.document.getElementById('fullMapCanvas');
ctx.fullMapCtx = ctx.fullMapCanvas.getContext('2d');
ctx.WORLD_W = ARCHIPELAGO_WIDTH;
ctx.WORLD_H = ARCHIPELAGO_HEIGHT;
ctx.ROAD_W = 130;
ctx.PALETTE = {
  waterDark: '#06141b',
  waterShore: '#12313a',
  asphalt: '#111417',
  asphaltWet: '#1a1d1e',
  roadMarkingYellow: '#d4a34b',
  roadMarkingWhite: 'rgba(218, 216, 205, 0.56)',
  sidewalk: '#262422',
  curb: '#5b5750',
  buildingWall: '#11151e',
  buildingRoof: '#181e2b',
  bridgeAsphalt: '#1e2533',
  bridgeRail: '#64748b'
};
ctx.CARPARTS = [{
  id: 'turbo',
  name: 'Турбина Garrett T28',
  bonus: '+15% макс. скорость',
  x: 850,
  y: 1550,
  found: false
}, {
  id: 'diff',
  name: 'Дифференциал 2-Way LSD',
  bonus: '+20% сцепление в заносе',
  x: 1750,
  y: 850,
  found: false
}, {
  id: 'exhaust',
  name: 'Выхлоп HKS Hi-Power',
  bonus: 'Звук прямотока',
  x: 2150,
  y: 1950,
  found: false
}, {
  id: 'nitro',
  name: 'Баллон NOS Nitrous',
  bonus: '+50% объем N2O',
  x: 3350,
  y: 850,
  found: false
}, {
  id: 'brakes',
  name: 'Суппорты Brembo 4-Pot',
  bonus: '+30% торможение',
  x: 4250,
  y: 1550,
  found: false
}, {
  id: 'tires',
  name: 'Шины Toyo Proxes R888',
  bonus: '+15% разгон',
  x: 3850,
  y: 2250,
  found: false
}, {
  id: 'cams',
  name: 'Валы Tomei Poncam',
  bonus: '+10% тяга',
  x: 5350,
  y: 850,
  found: false
}, {
  id: 'ecu',
  name: 'Прошивка Apexi PowerFC',
  bonus: '+8% макс. RPM',
  x: 6250,
  y: 1550,
  found: false
}, {
  id: 'coilovers',
  name: 'Койловеры Tein Flex-Z',
  bonus: '-20% крен',
  x: 5750,
  y: 2250,
  found: false
}];
ctx.state = {
  cash: 750,
  wanted: 0,
  wantedCooldown: 0,
  evading: false,
  evadeTimer: 5.0,
  isDrowning: false,
  drownProgress: 0,
  deathFlash: 0,
  custodyTimer: 0,
  custodyStation: null,
  invulnTimer: 180,
  nitroAmount: 100,
  isMapOpen: false,
  isGarageOpen: false,
  isMenuOpen: false,
  pauseStarted: null,
  pausedDuration: 0,
  lastFrameTime: ctx.env.performance.now(),
  keys: {
    up: false,
    down: false,
    left: false,
    right: false,
    handbrake: false,
    nitro: false
  }
};
ctx.weather = createWeather();
ctx.player = {
  entityType: 'vehicle',
  x: 1200,
  y: 1200,
  vx: 0,
  vy: 0,
  angle: 0,
  speed: 0,
  rpm: 0,
  gear: 'D1',
  hp: 100,
  maxHp: 100,
  width: 48,
  height: 24,
  bodyColor: '#e59d35'
};
ctx.legacyIslands = [{
  id: 'core',
  name: 'Lowtown Downtown',
  x: 300,
  y: 300,
  w: 2200,
  h: 2200
}, {
  id: 'docks',
  name: 'Ironworks Docks',
  x: 2850,
  y: 300,
  w: 2000,
  h: 2200
}, {
  id: 'lantern',
  name: 'Lantern Bay Heights',
  x: 5200,
  y: 300,
  w: 1800,
  h: 2200
}, {
  id: 'oldmill',
  name: 'Old Mill Ward',
  x: 300,
  y: 3200,
  w: 2200,
  h: 2200
}, {
  id: 'redhook',
  name: 'Red Hook Market',
  x: 2850,
  y: 3200,
  w: 2000,
  h: 2200
}, {
  id: 'blackwood',
  name: 'Blackwood Hills',
  x: 5200,
  y: 3200,
  w: 1800,
  h: 2200
}, {
  id: 'marrow',
  name: 'Marrow Point',
  x: 300,
  y: 6200,
  w: 2200,
  h: 2200
}, {
  id: 'southport',
  name: 'Southport Works',
  x: 2850,
  y: 6200,
  w: 2000,
  h: 2200
}, {
  id: 'velvet',
  name: 'Velvet Coast',
  x: 5200,
  y: 6200,
  w: 1800,
  h: 2200
}, {
  id: 'eastgate',
  name: 'Eastgate',
  x: 7350,
  y: 300,
  w: 2200,
  h: 2200
}, {
  id: 'cinder',
  name: 'Cinder Park',
  x: 7350,
  y: 3200,
  w: 2200,
  h: 2200
}, {
  id: 'aerodrome',
  name: 'Kingsway Aerodrome',
  x: 7350,
  y: 6200,
  w: 2200,
  h: 2200
}, {
  id: 'saints',
  name: 'All Saints',
  x: 300,
  y: 9200,
  w: 2200,
  h: 2200
}, {
  id: 'refinery',
  name: 'Ashcroft Refinery',
  x: 2850,
  y: 9200,
  w: 2000,
  h: 2200
}, {
  id: 'campus',
  name: 'Northstar Campus',
  x: 5200,
  y: 9200,
  w: 1800,
  h: 2200
}, {
  id: 'marina',
  name: 'Kingsport Marina',
  x: 7350,
  y: 9200,
  w: 2200,
  h: 2200
}];
ctx.islands = authoredDistricts(ctx.legacyIslands);
ctx.constructingLegacyScene = false;
ctx.PLANE_RUNWAYS = LEGACY_RUNWAYS.map(r => {
  const d = sourceDistrict(r),
    p = districtPoint(r, d.id);
  return {
    ...r,
    ...p,
    w: r.w * d.w / d.source.w,
    h: r.h * d.h / d.source.h
  };
});
ctx.helipads = [[1040, 2070], [6550, 2070], [6500, 8080], [8188.4, 7629.2]].map(([x, y]) => worldPoint({
  x,
  y
}));
ctx.districtProfiles = {
  core: {
    types: ['tenement', 'office', 'deco', 'shop'],
    land: '#292821',
    roof: '#39362d',
    trees: 10,
    population: 12
  },
  docks: {
    types: ['warehouse', 'warehouse', 'shop', 'office'],
    land: '#292c2a',
    roof: '#394241',
    trees: 6,
    population: 8
  },
  lantern: {
    types: ['townhouse', 'deco', 'shop', 'townhouse'],
    land: '#29372a',
    roof: '#4c4235',
    trees: 24,
    population: 8
  },
  oldmill: {
    types: ['warehouse', 'tenement', 'warehouse', 'shop'],
    land: '#302c25',
    roof: '#494136',
    trees: 8,
    population: 8
  },
  redhook: {
    types: ['shop', 'tenement', 'shop', 'deco'],
    land: '#332d25',
    roof: '#4b3d32',
    trees: 10,
    population: 12
  },
  blackwood: {
    types: ['townhouse', 'townhouse', 'shop', 'deco'],
    land: '#1f3327',
    roof: '#354837',
    trees: 28,
    population: 8
  },
  marrow: {
    types: ['tenement', 'shop', 'warehouse', 'townhouse'],
    land: '#2b3028',
    roof: '#414639',
    trees: 14,
    population: 8
  },
  southport: {
    types: ['warehouse', 'warehouse', 'office', 'shop'],
    land: '#30312c',
    roof: '#46483e',
    trees: 6,
    population: 8
  },
  velvet: {
    types: ['deco', 'deco', 'shop', 'office'],
    land: '#302c2c',
    roof: '#4b3c3b',
    trees: 16,
    population: 10
  },
  eastgate: {
    types: ['tenement', 'office', 'shop', 'deco'],
    land: '#2e3029',
    roof: '#41453d',
    trees: 12,
    population: 10
  },
  cinder: {
    types: ['shop', 'townhouse', 'tenement', 'shop'],
    land: '#29342a',
    roof: '#3d493c',
    trees: 22,
    population: 10
  },
  aerodrome: {
    types: ['warehouse', 'warehouse', 'office', 'shop'],
    land: '#2b3030',
    roof: '#3e4849',
    trees: 6,
    population: 8
  },
  saints: {
    types: ['deco', 'townhouse', 'tenement', 'shop'],
    land: '#30342e',
    roof: '#4b4c40',
    trees: 20,
    population: 10
  },
  refinery: {
    types: ['warehouse', 'warehouse', 'office', 'warehouse'],
    land: '#332e26',
    roof: '#4a4135',
    trees: 6,
    population: 8
  },
  campus: {
    types: ['office', 'deco', 'townhouse', 'shop'],
    land: '#26372c',
    roof: '#3e4b40',
    trees: 26,
    population: 10
  },
  marina: {
    types: ['townhouse', 'shop', 'deco', 'warehouse'],
    land: '#29332d',
    roof: '#424b40',
    trees: 18,
    population: 10
  }
};
ctx.legacyIslets = [{
  id: 'reed-bank',
  x: 600,
  y: 2770,
  w: 290,
  h: 165
}, {
  id: 'gull-rock',
  x: 3320,
  y: 2790,
  w: 300,
  h: 150
}, {
  id: 'willow-key',
  x: 5400,
  y: 5600,
  w: 280,
  h: 190
}, {
  id: 'marsh-point',
  x: 1750,
  y: 8600,
  w: 330,
  h: 180
}, {
  id: 'ashcroft-key',
  x: 4180,
  y: 8650,
  w: 420,
  h: 170
}, {
  id: 'salt-marsh',
  x: 7650,
  y: 8700,
  w: 420,
  h: 150
}, {
  id: 'long-key',
  x: 9680,
  y: 4700,
  w: 270,
  h: 660
}].map(i => ({
  ...i,
  natural: true
}));
ctx.islets = AUTHORED_ISLETS;
ctx.allIslands = [...ctx.islands, ...ctx.islets];
ctx.legacyLand = [...ctx.legacyIslands, ...ctx.legacyIslets];
ctx.legacyPiers = [{
  x: 2470,
  y: 1760,
  w: 45,
  h: 400
}, {
  x: 4820,
  y: 1760,
  w: 45,
  h: 400
}, {
  x: 2470,
  y: 7480,
  w: 45,
  h: 430
}, {
  x: 4820,
  y: 7480,
  w: 45,
  h: 430
}];
ctx.piers = ctx.legacyPiers.map(r => {
  const d = sourceDistrict(r),
    p = districtPoint(r, d.id);
  return {
    ...r,
    ...p,
    w: r.w * d.w / d.source.w,
    h: r.h * d.h / d.source.h
  };
});
ctx.shorelineDraft = [...ctx.islands, ...ctx.islets].flatMap((island, islandIndex) => {
  const points = coastPoints(island),
    stride = ctx.env.Math.max(1, ctx.env.Math.floor(points.length / (island.natural ? 22 : 21)));
  return points.filter((_, i) => i % stride === 0).map(([x, y], i) => {
    const before = points[(i * stride - 1 + points.length) % points.length],
      after = points[(i * stride + 1) % points.length];
    const tangent = ctx.env.Math.atan2(after[1] - before[1], after[0] - before[0]);
    const dx = island.x + island.w / 2 - x,
      dy = island.y + island.h / 2 - y,
      length = ctx.env.Math.hypot(dx, dy) || 1;
    const inset = 24 + ctx.stableVisualHash(islandIndex, i, 31) * 28;
    const variety = ctx.stableVisualHash(islandIndex, i, 43);
    return {
      x: x + dx / length * inset,
      y: y + dy / length * inset,
      tangent,
      type: island.natural ? variety > .68 ? 'rock' : 'reeds' : variety < .16 ? 'rock' : variety < .36 ? 'brush' : variety < .5 ? 'timber' : 'tideline',
      seed: ctx.stableVisualHash(islandIndex, i, 37),
      natural: !!island.natural
    };
  });
});
ctx.shorelineDetails = [];
ctx.beachDetails = [...ctx.islands, ...ctx.islets].flatMap((island, islandIndex) => {
  const points = coastPoints(island),
    stride = ctx.env.Math.max(1, ctx.env.Math.floor(points.length / (island.natural ? 18 : 34)));
  return points.filter((_, i) => i % stride === 0).map(([x, y], i) => {
    const dx = x - (island.x + island.w / 2),
      dy = y - (island.y + island.h / 2),
      length = ctx.env.Math.hypot(dx, dy) || 1;
    const seed = ctx.stableVisualHash(islandIndex, i, 71),
      distance = (island.natural ? 8 : 12) + seed * (island.natural ? 32 : 88);
    return {
      x: x + dx / length * distance,
      y: y + dy / length * distance,
      seed,
      natural: !!island.natural,
      island
    };
  }).filter(detail => pointInBeach(detail.x, detail.y, island, island.natural ? 42 : BEACH_WIDTH));
});
ctx.expansionDistricts = [{
  id: 'eastgate',
  x: 7350,
  y: 300,
  w: 2200,
  main: 8500,
  far: 9220,
  signs: ['EASTGATE FIRE & RESCUE', 'MIDNIGHT DINER'],
  lowerSigns: ['NORTHSIDE CLINIC', 'CIVIL DEFENCE'],
  neon: '#e09a3e',
  roof: '#26231f'
}, {
  id: 'cinder',
  x: 7350,
  y: 3200,
  w: 2200,
  main: 8500,
  far: 9220,
  signs: ['CINDER CITY HALL', 'CITY BUS DEPOT'],
  lowerSigns: ['CINDER FIRE STATION', 'CITY WORKS'],
  neon: '#d4523a',
  roof: '#242125'
}, {
  id: 'aerodrome',
  x: 7350,
  y: 6200,
  w: 2200,
  main: 8500,
  far: 9220,
  signs: ['KINGSWAY AIRFIELD', 'SKYFREIGHT 90'],
  lowerSigns: ['AIR AMBULANCE BASE', 'AIRPORT FIRE CREW'],
  neon: '#e8b84a',
  roof: '#20272a'
}, {
  id: 'saints',
  x: 300,
  y: 9200,
  w: 2200,
  main: 1200,
  far: 2250,
  signs: ['ALL SAINTS HOSPITAL', 'MEMORIAL ARCADE'],
  lowerSigns: ['EMS DISPATCH', 'FAMILY CLINIC'],
  neon: '#9aa0a8',
  roof: '#272522'
}, {
  id: 'refinery',
  x: 2850,
  y: 9200,
  w: 2000,
  main: 3850,
  far: 4600,
  signs: ['ASHCROFT OIL', 'RIVER GAS WORKS'],
  lowerSigns: ['NATIONAL GUARD ARMORY', 'FIRE SERVICE DEPOT'],
  neon: '#d4523a',
  roof: '#2a241d'
}, {
  id: 'campus',
  x: 5200,
  y: 9200,
  w: 1800,
  main: 6200,
  far: 6750,
  signs: ['NORTHSTAR COLLEGE', 'LOWTOWN LIBRARY'],
  lowerSigns: ['LOWTOWN SCHOOL', 'COMMUNITY CENTRE'],
  neon: '#e09a3e',
  roof: '#22272a'
}, {
  id: 'marina',
  x: 7350,
  y: 9200,
  w: 2200,
  main: 8500,
  far: 9300,
  signs: ['KINGSPORT MARINA', 'MARITIME RESCUE'],
  lowerSigns: ['COAST GUARD STATION', 'CASINO MIRAGE'],
  neon: '#e8b84a',
  roof: '#24242a'
}];
ctx.legacyBridges = [{
  id: 'b1',
  x: 2500,
  y: 1135,
  w: 350,
  h: ctx.ROAD_W,
  dir: 'h',
  name: 'Мост Железного Порта'
}, {
  id: 'b2',
  x: 4850,
  y: 1135,
  w: 350,
  h: ctx.ROAD_W,
  dir: 'h',
  name: 'Мост Фонарного Залива'
}, {
  id: 'b3',
  x: 2500,
  y: 4135,
  w: 350,
  h: ctx.ROAD_W,
  dir: 'h',
  name: 'Мост Красного Крюка'
}, {
  id: 'b4',
  x: 4850,
  y: 4135,
  w: 350,
  h: ctx.ROAD_W,
  dir: 'h',
  name: 'Мост Чёрного Леса'
}, {
  id: 'b5',
  x: 1200,
  y: 2500,
  w: ctx.ROAD_W,
  h: 700,
  dir: 'v',
  name: 'Дамба Старой Мельницы'
}, {
  id: 'b6',
  x: 3850,
  y: 2500,
  w: ctx.ROAD_W,
  h: 700,
  dir: 'v',
  name: 'Портовый Виадук'
}, {
  id: 'b7',
  x: 6200,
  y: 2500,
  w: ctx.ROAD_W,
  h: 700,
  dir: 'v',
  name: 'Высотная Эстакада'
}, {
  id: 'b8',
  x: 1200,
  y: 5400,
  w: ctx.ROAD_W,
  h: 800,
  dir: 'v',
  name: 'Дамба Марроу'
}, {
  id: 'b9',
  x: 3850,
  y: 5400,
  w: ctx.ROAD_W,
  h: 800,
  dir: 'v',
  name: 'Южный Грузовой Мост'
}, {
  id: 'b10',
  x: 6200,
  y: 5400,
  w: ctx.ROAD_W,
  h: 800,
  dir: 'v',
  name: 'Вельветская Эстакада'
}, {
  id: 'b11',
  x: 7000,
  y: 1135,
  w: 350,
  h: ctx.ROAD_W,
  dir: 'h',
  name: 'Восточный Мост'
}, {
  id: 'b12',
  x: 7000,
  y: 4135,
  w: 350,
  h: ctx.ROAD_W,
  dir: 'h',
  name: 'Мост Синдер-Парк'
}, {
  id: 'b13',
  x: 7000,
  y: 7135,
  w: 350,
  h: ctx.ROAD_W,
  dir: 'h',
  name: 'Аэродромный Мост'
}, {
  id: 'b14',
  x: 1200,
  y: 8400,
  w: ctx.ROAD_W,
  h: 800,
  dir: 'v',
  name: 'Мемориальная Дамба'
}, {
  id: 'b15',
  x: 3850,
  y: 8400,
  w: ctx.ROAD_W,
  h: 800,
  dir: 'v',
  name: 'Мост Эшкрофт'
}, {
  id: 'b16',
  x: 6200,
  y: 8400,
  w: ctx.ROAD_W,
  h: 800,
  dir: 'v',
  name: 'Университетский Мост'
}, {
  id: 'b17',
  x: 8500,
  y: 8400,
  w: ctx.ROAD_W,
  h: 800,
  dir: 'v',
  name: 'Марина Скайвей'
}, {
  id: 'b18',
  x: 2500,
  y: 10135,
  w: 350,
  h: ctx.ROAD_W,
  dir: 'h',
  name: 'Мост Всех Святых'
}, {
  id: 'b19',
  x: 4850,
  y: 10135,
  w: 350,
  h: ctx.ROAD_W,
  dir: 'h',
  name: 'Речной Мост'
}, {
  id: 'b20',
  x: 7000,
  y: 10135,
  w: 350,
  h: ctx.ROAD_W,
  dir: 'h',
  name: 'Кингспортский Мост'
}, {
  id: 'b21',
  x: 2500,
  y: 7135,
  w: 350,
  h: ctx.ROAD_W,
  dir: 'h',
  name: 'Марроу-Бридж'
}, {
  id: 'b22',
  x: 4850,
  y: 7135,
  w: 350,
  h: ctx.ROAD_W,
  dir: 'h',
  name: 'Вельветский Мост'
}, {
  id: 'b23',
  x: 8500,
  y: 2500,
  w: ctx.ROAD_W,
  h: 700,
  dir: 'v',
  name: 'Истгейтская Эстакада'
}, {
  id: 'b24',
  x: 8500,
  y: 5400,
  w: ctx.ROAD_W,
  h: 800,
  dir: 'v',
  name: 'Синдерский Виадук'
}];
ctx.bridges = ctx.legacyBridges.map(b => ({
  ...b
}));
ctx.roads = [];
ctx.scenicRoads = [];
ctx.roadEnds = [];
ctx.walkingRoutes = [];
ctx.roadGraph = [];
ctx.buildings = [];
ctx.breakableProps = [];
ctx.bridgeRails = [];
ctx.trafficCars = [];
ctx.policeCars = [];
ctx.incidentPoliceCars = [];
ctx.incidentResponseVehicles = [];
ctx.airMedicalVehicles = [];
ctx.serviceBases = [];
ctx.transitRoutes = [];
ctx.pedestrians = [];
ctx.cityIncidentDirector = null;
ctx.incidentNoticeId = 0;
ctx.skidmarks = [];
ctx.waterSplashes = [];
ctx.streetLights = [];
ctx.trees = [];
ctx.parkedCars = [];
ctx.cranes = [];
ctx.billboards = [];
ctx.parkZones = [];
ctx.parkObstacles = [];
ctx.streetProps = [];
ctx.stuntZones = [];
ctx.solidProps = [];
ctx.roam = undefined;
ctx.safeSpawnPoints = [{
  x: 1200,
  y: 1200
}, {
  x: 2450,
  y: 1200
}, {
  x: 2950,
  y: 1200
}, {
  x: 3850,
  y: 1200
}, {
  x: 4800,
  y: 1200
}, {
  x: 5300,
  y: 1200
}, {
  x: 1200,
  y: 4200
}, {
  x: 2950,
  y: 4200
}, {
  x: 3850,
  y: 4200
}, {
  x: 5300,
  y: 4200
}, {
  x: 6200,
  y: 4200
}, {
  x: 1200,
  y: 7200
}, {
  x: 3850,
  y: 7200
}, {
  x: 6200,
  y: 7200
}, {
  x: 8500,
  y: 1200
}, {
  x: 8500,
  y: 4200
}, {
  x: 8500,
  y: 7200
}, {
  x: 1200,
  y: 10200
}, {
  x: 3850,
  y: 10200
}, {
  x: 6200,
  y: 10200
}, {
  x: 8500,
  y: 10200
}];
for (const point of [...ctx.safeSpawnPoints, ...ctx.CARPARTS]) Object.assign(point, worldPoint(point));
ctx.roadPaintGeometry = null;
ctx.qaSignalTimeOffset = 0;
ctx.qaManualSceneClock = null;
ctx.pedestrianSceneryIndex = null;
ctx.citySceneryCache = null;
ctx.walkSurfaceCache = null;
ctx.accumulator = 0;
ctx.lastGameRenderTime = -Infinity;
ctx.driveLab = undefined;
ctx.gameMenu = undefined;
ctx.drivePointerSets = [];
}
