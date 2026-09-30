import { drawArchitecture, drawRoundedJunction, drawStreetTree, drawStreetFurniture } from './game/architecture.js';
import { velocityForHeading, projectIso, routeInput } from './game/test_drive_core.js';
import { createDriveLab } from './game/test_drive_lab.js';
import { resolveContact, resolveScenery, contact, chassis } from './game/solid_contacts.js';
import { planEmergencyPassingManeuver } from './game/emergency_passing.js';
import { coastPath, coastPoints, pointInCoast, pointInBeach, BEACH_WIDTH } from './game/coastline.js';
import { createFreeRoam, drawTransport, PLANE_RUNWAYS } from './game/free_roam.js';
import { visibleOceanChunks } from './game/ocean_chunks.js';
import { classifySurface, surfaceMovement } from './game/surface_physics.js';
import { createCityIncidentDirector, updateCrowdReactions } from './game/city_incidents.js';
import { advanceTrafficCar, resolveTrafficPair } from './game/traffic_turns.js';
import { createRoadGraph, roadPath, roadTerminals, onRoadSurface, createWalkingRoutes, assignWalkingRoutes, nextWalkingGoal, planStopRoute, advanceRouteActor, drawRoadTerminals } from './game/street_network.js';
import './game/test_drive.css';
// LOWTOWN // THREE ISLANDS VISUAL OVERHAUL // GTA 2 RETRO-NOIR ENGINE
// High-detail procedural pedestrian sprites, isometric vehicle chassis, wet road reflections, neon glow & audio

class SynthAudio {
  constructor() {
    this.ctx = null;
    this.motorOsc = null;
    this.motorGain = null;
    this.radioGain = null;
    this.radioInterval = null;
    this.enabled = false;
    this.stationIdx = 0;
    this.stations = ['📻 OFF', '📻 90s RETROWAVE', '📻 NOIR ELECTRO', '📻 SYNTH ROCK'];
  }
  init() {
    if (this.ctx) return;
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      this.ctx = new AudioContext();
      if (this.ctx.state === 'suspended') this.ctx.resume();
      this.motorOsc = this.ctx.createOscillator();
      this.motorGain = this.ctx.createGain();
      this.radioGain = this.ctx.createGain();
      this.radioGain.gain.setValueAtTime(0.04, this.ctx.currentTime);
      this.radioGain.connect(this.ctx.destination);

      this.motorOsc.type = 'sawtooth';
      this.motorOsc.frequency.setValueAtTime(45, this.ctx.currentTime);
      this.motorGain.gain.setValueAtTime(0.035, this.ctx.currentTime);
      const filter = this.ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(380, this.ctx.currentTime);
      this.motorOsc.connect(filter);
      filter.connect(this.motorGain);
      this.motorGain.connect(this.ctx.destination);
      this.motorOsc.start();
      this.enabled = true;
    } catch (e) {}
  }
  update(rpmRatio, speed) {
    if (!this.enabled || !this.ctx) return;
    const targetFreq = 42 + rpmRatio * 110 + Math.abs(speed) * 3;
    this.motorOsc.frequency.setTargetAtTime(targetFreq, this.ctx.currentTime, 0.05);
  }
  nextStation() {
    this.stationIdx = (this.stationIdx + 1) % this.stations.length;
    if (this.radioInterval) clearInterval(this.radioInterval);
    if (this.stationIdx === 0) return this.stations[0];
    this.startSynthRadio();
    return this.stations[this.stationIdx];
  }
  startSynthRadio() {
    if (!this.ctx) return;
    const notes = this.stationIdx === 1 ? [130, 164, 196, 246, 261, 329] : this.stationIdx === 2 ? [110, 138, 165, 220, 277] : [98, 123, 147, 196, 220];
    let step = 0;
    this.radioInterval = setInterval(() => {
      if (!this.ctx || this.stationIdx === 0) return;
      try {
        const osc = this.ctx.createOscillator();
        const g = this.ctx.createGain();
        osc.type = this.stationIdx === 1 ? 'sawtooth' : this.stationIdx === 2 ? 'sine' : 'square';
        const freq = notes[step % notes.length];
        osc.frequency.setValueAtTime(freq, this.ctx.currentTime);
        g.gain.setValueAtTime(0.03, this.ctx.currentTime);
        g.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.22);
        osc.connect(g);
        g.connect(this.radioGain);
        osc.start();
        osc.stop(this.ctx.currentTime + 0.24);
        step++;
      } catch (e) {}
    }, 240);
  }
  playSplash() {
    if (!this.enabled || !this.ctx) return;
    try {
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(240, now);
      osc.frequency.exponentialRampToValueAtTime(40, now + 0.35);
      gain.gain.setValueAtTime(0.3, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.35);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(now);
      osc.stop(now + 0.36);
    } catch (e) {}
  }
  playImpact() {
    if (!this.enabled || !this.ctx) return;
    try {
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(110, now);
      osc.frequency.exponentialRampToValueAtTime(30, now + 0.18);
      gain.gain.setValueAtTime(0.2, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.18);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(now);
      osc.stop(now + 0.19);
    } catch (e) {}
  }
  playPropBreak() {
    if (!this.enabled || !this.ctx) return;
    try {
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'square';
      osc.frequency.setValueAtTime(450, now);
      osc.frequency.exponentialRampToValueAtTime(80, now + 0.15);
      gain.gain.setValueAtTime(0.15, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.15);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(now);
      osc.stop(now + 0.16);
    } catch (e) {}
  }
}

const sound = new SynthAudio();

const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const radarCanvas = document.getElementById('radarCanvas');
const radarCtx = radarCanvas.getContext('2d');
const fullMapCanvas = document.getElementById('fullMapCanvas');
const fullMapCtx = fullMapCanvas.getContext('2d');

const WORLD_W = 10100;
const WORLD_H = 11700;
const ROAD_W = 130;

const PALETTE = {
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

const CARPARTS = [
  { id: 'turbo', name: 'Турбина Garrett T28', bonus: '+15% макс. скорость', x: 850, y: 1550, found: false },
  { id: 'diff', name: 'Дифференциал 2-Way LSD', bonus: '+20% сцепление в заносе', x: 1750, y: 850, found: false },
  { id: 'exhaust', name: 'Выхлоп HKS Hi-Power', bonus: 'Звук прямотока', x: 2150, y: 1950, found: false },
  { id: 'nitro', name: 'Баллон NOS Nitrous', bonus: '+50% объем N2O', x: 3350, y: 850, found: false },
  { id: 'brakes', name: 'Суппорты Brembo 4-Pot', bonus: '+30% торможение', x: 4250, y: 1550, found: false },
  { id: 'tires', name: 'Шины Toyo Proxes R888', bonus: '+15% разгон', x: 3850, y: 2250, found: false },
  { id: 'cams', name: 'Валы Tomei Poncam', bonus: '+10% тяга', x: 5350, y: 850, found: false },
  { id: 'ecu', name: 'Прошивка Apexi PowerFC', bonus: '+8% макс. RPM', x: 6250, y: 1550, found: false },
  { id: 'coilovers', name: 'Койловеры Tein Flex-Z', bonus: '-20% крен', x: 5750, y: 2250, found: false }
];

const state = {
  cash: 750,
  wanted: 0,
  wantedCooldown: 0,
  evading: false,
  evadeTimer: 5.0,
  isDrowning: false,
  drownProgress: 0,
  deathFlash: 0,
  invulnTimer: 180,
  nitroAmount: 100,
  isMapOpen: false,
  isGarageOpen: false,
  lastFrameTime: performance.now(),
  keys: { up: false, down: false, left: false, right: false, handbrake: false, nitro: false }
};

const player = {
  entityType: 'vehicle',
  x: 1200, y: 1200,
  vx: 0, vy: 0,
  angle: 0, speed: 0,
  rpm: 0, gear: 'D1',
  hp: 100, maxHp: 100,
  width: 48, height: 24,
  bodyColor: '#e59d35'
};

const islands = [
  { id: 'core', name: 'Lowtown Downtown', x: 300, y: 300, w: 2200, h: 2200 },
  { id: 'docks', name: 'Ironworks Docks', x: 2850, y: 300, w: 2000, h: 2200 },
  { id: 'lantern', name: 'Lantern Bay Heights', x: 5200, y: 300, w: 1800, h: 2200 },
  { id: 'oldmill', name: 'Old Mill Ward', x: 300, y: 3200, w: 2200, h: 2200 },
  { id: 'redhook', name: 'Red Hook Market', x: 2850, y: 3200, w: 2000, h: 2200 },
  { id: 'blackwood', name: 'Blackwood Hills', x: 5200, y: 3200, w: 1800, h: 2200 }
  ,{ id: 'marrow', name: 'Marrow Point', x: 300, y: 6200, w: 2200, h: 2200 }
  ,{ id: 'southport', name: 'Southport Works', x: 2850, y: 6200, w: 2000, h: 2200 }
  ,{ id: 'velvet', name: 'Velvet Coast', x: 5200, y: 6200, w: 1800, h: 2200 }
  ,{ id: 'eastgate', name: 'Eastgate', x: 7350, y: 300, w: 2200, h: 2200 }
  ,{ id: 'cinder', name: 'Cinder Park', x: 7350, y: 3200, w: 2200, h: 2200 }
  ,{ id: 'aerodrome', name: 'Kingsway Aerodrome', x: 7350, y: 6200, w: 2200, h: 2200 }
  ,{ id: 'saints', name: 'All Saints', x: 300, y: 9200, w: 2200, h: 2200 }
  ,{ id: 'refinery', name: 'Ashcroft Refinery', x: 2850, y: 9200, w: 2000, h: 2200 }
  ,{ id: 'campus', name: 'Northstar Campus', x: 5200, y: 9200, w: 1800, h: 2200 }
  ,{ id: 'marina', name: 'Kingsport Marina', x: 7350, y: 9200, w: 2200, h: 2200 }
];

// District identity changes architecture and vegetation inside the established
// street envelope. Civic parcels and bridge positions remain authoritative.
const districtProfiles={
  core:{types:['tenement','office','deco','shop'],land:'#292821',roof:'#39362d',trees:10,population:12},
  docks:{types:['warehouse','warehouse','shop','office'],land:'#292c2a',roof:'#394241',trees:6,population:8},
  lantern:{types:['townhouse','deco','shop','townhouse'],land:'#29372a',roof:'#4c4235',trees:24,population:8},
  oldmill:{types:['warehouse','tenement','warehouse','shop'],land:'#302c25',roof:'#494136',trees:8,population:8},
  redhook:{types:['shop','tenement','shop','deco'],land:'#332d25',roof:'#4b3d32',trees:10,population:12},
  blackwood:{types:['townhouse','townhouse','shop','deco'],land:'#1f3327',roof:'#354837',trees:28,population:8},
  marrow:{types:['tenement','shop','warehouse','townhouse'],land:'#2b3028',roof:'#414639',trees:14,population:8},
  southport:{types:['warehouse','warehouse','office','shop'],land:'#30312c',roof:'#46483e',trees:6,population:8},
  velvet:{types:['deco','deco','shop','office'],land:'#302c2c',roof:'#4b3c3b',trees:16,population:10},
  eastgate:{types:['tenement','office','shop','deco'],land:'#2e3029',roof:'#41453d',trees:12,population:10},
  cinder:{types:['shop','townhouse','tenement','shop'],land:'#29342a',roof:'#3d493c',trees:22,population:10},
  aerodrome:{types:['warehouse','warehouse','office','shop'],land:'#2b3030',roof:'#3e4849',trees:6,population:8},
  saints:{types:['deco','townhouse','tenement','shop'],land:'#30342e',roof:'#4b4c40',trees:20,population:10},
  refinery:{types:['warehouse','warehouse','office','warehouse'],land:'#332e26',roof:'#4a4135',trees:6,population:8},
  campus:{types:['office','deco','townhouse','shop'],land:'#26372c',roof:'#3e4b40',trees:26,population:10},
  marina:{types:['townhouse','shop','deco','warehouse'],land:'#29332d',roof:'#424b40',trees:18,population:10}
};
function districtAt(x,y){return islands.find(i=>x>=i.x&&x<=i.x+i.w&&y>=i.y&&y<=i.y+i.h);}

const islets=[
  {id:'reed-bank',x:600,y:2770,w:290,h:165},
  {id:'gull-rock',x:3320,y:2790,w:300,h:150},
  {id:'willow-key',x:5400,y:5600,w:280,h:190},
  {id:'marsh-point',x:1750,y:8600,w:330,h:180},
  {id:'ashcroft-key',x:4180,y:8650,w:420,h:170},
  {id:'salt-marsh',x:7650,y:8700,w:420,h:150},
  {id:'long-key',x:9680,y:4700,w:270,h:660}
].map(i=>({...i,natural:true}));
const allIslands=[...islands,...islets];
const piers=[{x:2470,y:1760,w:45,h:400},{x:4820,y:1760,w:45,h:400},{x:2470,y:7480,w:45,h:430},{x:4820,y:7480,w:45,h:430}];

const shorelineDetails=[...islands,...islets].flatMap((island,islandIndex)=>{
  const points=coastPoints(island),stride=Math.max(1,Math.floor(points.length/(island.natural?22:21)));
  return points.filter((_,i)=>i%stride===0).map(([x,y],i)=>{
    const before=points[(i*stride-1+points.length)%points.length],after=points[(i*stride+1)%points.length];
    const tangent=Math.atan2(after[1]-before[1],after[0]-before[0]);
    const dx=island.x+island.w/2-x,dy=island.y+island.h/2-y,length=Math.hypot(dx,dy)||1;
    const inset=24+stableVisualHash(islandIndex,i,31)*28;
    const variety=stableVisualHash(islandIndex,i,43);
    return {x:x+dx/length*inset,y:y+dy/length*inset,tangent,
      type:island.natural?(variety>.68?'rock':'reeds'):
        variety<.16?'rock':variety<.36?'brush':variety<.5?'timber':'tideline',
      seed:stableVisualHash(islandIndex,i,37),natural:!!island.natural};
  });
});
const beachDetails=[...islands,...islets].flatMap((island,islandIndex)=>{
  const points=coastPoints(island),stride=Math.max(1,Math.floor(points.length/(island.natural?18:34)));
  return points.filter((_,i)=>i%stride===0).map(([x,y],i)=>{
    const dx=x-(island.x+island.w/2),dy=y-(island.y+island.h/2),length=Math.hypot(dx,dy)||1;
    const seed=stableVisualHash(islandIndex,i,71),distance=(island.natural?8:12)+seed*(island.natural?32:88);
    return {x:x+dx/length*distance,y:y+dy/length*distance,seed,natural:!!island.natural,island};
  }).filter(detail=>pointInBeach(detail.x,detail.y,island,island.natural?42:BEACH_WIDTH));
});

const expansionDistricts = [
  { id:'eastgate', x:7350, y:300, w:2200, main:8500, far:9220, signs:['EASTGATE FIRE & RESCUE','MIDNIGHT DINER'], lowerSigns:['NORTHSIDE CLINIC','CIVIL DEFENCE'], neon:'#e09a3e', roof:'#26231f' },
  { id:'cinder', x:7350, y:3200, w:2200, main:8500, far:9220, signs:['CINDER CITY HALL','CITY BUS DEPOT'], lowerSigns:['CINDER FIRE STATION','CITY WORKS'], neon:'#d4523a', roof:'#242125' },
  { id:'aerodrome', x:7350, y:6200, w:2200, main:8500, far:9220, signs:['KINGSWAY AIRFIELD','SKYFREIGHT 90'], lowerSigns:['AIR AMBULANCE BASE','AIRPORT FIRE CREW'], neon:'#e8b84a', roof:'#20272a' },
  { id:'saints', x:300, y:9200, w:2200, main:1200, far:2250, signs:['ALL SAINTS HOSPITAL','MEMORIAL ARCADE'], lowerSigns:['EMS DISPATCH','FAMILY CLINIC'], neon:'#9aa0a8', roof:'#272522' },
  { id:'refinery', x:2850, y:9200, w:2000, main:3850, far:4600, signs:['ASHCROFT OIL','RIVER GAS WORKS'], lowerSigns:['NATIONAL GUARD ARMORY','FIRE SERVICE DEPOT'], neon:'#d4523a', roof:'#2a241d' },
  { id:'campus', x:5200, y:9200, w:1800, main:6200, far:6750, signs:['NORTHSTAR COLLEGE','LOWTOWN LIBRARY'], lowerSigns:['LOWTOWN SCHOOL','COMMUNITY CENTRE'], neon:'#e09a3e', roof:'#22272a' },
  { id:'marina', x:7350, y:9200, w:2200, main:8500, far:9300, signs:['KINGSPORT MARINA','MARITIME RESCUE'], lowerSigns:['COAST GUARD STATION','CASINO MIRAGE'], neon:'#e8b84a', roof:'#24242a' }
];

const bridges = [
  { id: 'b1', x: 2500, y: 1135, w: 350, h: ROAD_W, dir: 'h', name: 'Мост Железного Порта' },
  { id: 'b2', x: 4850, y: 1135, w: 350, h: ROAD_W, dir: 'h', name: 'Мост Фонарного Залива' },
  { id: 'b3', x: 2500, y: 4135, w: 350, h: ROAD_W, dir: 'h', name: 'Мост Красного Крюка' },
  { id: 'b4', x: 4850, y: 4135, w: 350, h: ROAD_W, dir: 'h', name: 'Мост Чёрного Леса' },
  { id: 'b5', x: 1200, y: 2500, w: ROAD_W, h: 700, dir: 'v', name: 'Дамба Старой Мельницы' },
  { id: 'b6', x: 3850, y: 2500, w: ROAD_W, h: 700, dir: 'v', name: 'Портовый Виадук' },
  { id: 'b7', x: 6200, y: 2500, w: ROAD_W, h: 700, dir: 'v', name: 'Высотная Эстакада' },
  { id: 'b8', x: 1200, y: 5400, w: ROAD_W, h: 800, dir: 'v', name: 'Дамба Марроу' },
  { id: 'b9', x: 3850, y: 5400, w: ROAD_W, h: 800, dir: 'v', name: 'Южный Грузовой Мост' },
  { id: 'b10', x: 6200, y: 5400, w: ROAD_W, h: 800, dir: 'v', name: 'Вельветская Эстакада' }
  ,{ id: 'b11', x: 7000, y: 1135, w: 350, h: ROAD_W, dir: 'h', name: 'Восточный Мост' }
  ,{ id: 'b12', x: 7000, y: 4135, w: 350, h: ROAD_W, dir: 'h', name: 'Мост Синдер-Парк' }
  ,{ id: 'b13', x: 7000, y: 7135, w: 350, h: ROAD_W, dir: 'h', name: 'Аэродромный Мост' }
  ,{ id: 'b14', x: 1200, y: 8400, w: ROAD_W, h: 800, dir: 'v', name: 'Мемориальная Дамба' }
  ,{ id: 'b15', x: 3850, y: 8400, w: ROAD_W, h: 800, dir: 'v', name: 'Мост Эшкрофт' }
  ,{ id: 'b16', x: 6200, y: 8400, w: ROAD_W, h: 800, dir: 'v', name: 'Университетский Мост' }
  ,{ id: 'b17', x: 8500, y: 8400, w: ROAD_W, h: 800, dir: 'v', name: 'Марина Скайвей' }
  ,{ id: 'b18', x: 2500, y: 10135, w: 350, h: ROAD_W, dir: 'h', name: 'Мост Всех Святых' }
  ,{ id: 'b19', x: 4850, y: 10135, w: 350, h: ROAD_W, dir: 'h', name: 'Речной Мост' }
  ,{ id: 'b20', x: 7000, y: 10135, w: 350, h: ROAD_W, dir: 'h', name: 'Кингспортский Мост' }
  ,{ id: 'b21', x: 2500, y: 7135, w: 350, h: ROAD_W, dir: 'h', name: 'Марроу-Бридж' }
  ,{ id: 'b22', x: 4850, y: 7135, w: 350, h: ROAD_W, dir: 'h', name: 'Вельветский Мост' }
  ,{ id: 'b23', x: 8500, y: 2500, w: ROAD_W, h: 700, dir: 'v', name: 'Истгейтская Эстакада' }
  ,{ id: 'b24', x: 8500, y: 5400, w: ROAD_W, h: 800, dir: 'v', name: 'Синдерский Виадук' }
];

const roads = [];
const scenicRoads = [];
const roadEnds = [];
let walkingRoutes = [];
let roadGraph = [];
const buildings = [];
const breakableProps = [];
const bridgeRails = [];
const trafficCars = [];
const policeCars = [];
const incidentPoliceCars = [];
const incidentResponseVehicles = [];
const airMedicalVehicles = [];
const serviceBases = [];
const transitRoutes=[];
const pedestrians = [];
let cityIncidentDirector = null;
let incidentNoticeId = 0;
const skidmarks = [];
const waterSplashes = [];
const streetLights = [];
const trees = [];
const parkedCars = [];
const cranes = [];
const billboards = [];
const parkZones = [];
const parkObstacles = [];
const streetProps = [];
const stuntZones = [];
let stuntStates = new WeakMap();
let lastStuntNoticeAt=-Infinity;
const solidProps = [];
let roam;

const safeSpawnPoints = [
  { x: 1200, y: 1200 },
  { x: 2450, y: 1200 },
  { x: 2950, y: 1200 },
  { x: 3850, y: 1200 },
  { x: 4800, y: 1200 },
  { x: 5300, y: 1200 },
  { x: 1200, y: 4200 },
  { x: 2950, y: 4200 },
  { x: 3850, y: 4200 },
  { x: 5300, y: 4200 },
  { x: 6200, y: 4200 }
  ,{ x: 1200, y: 7200 }
  ,{ x: 3850, y: 7200 }
  ,{ x: 6200, y: 7200 }
  ,{ x: 8500, y: 1200 }
  ,{ x: 8500, y: 4200 }
  ,{ x: 8500, y: 7200 }
  ,{ x: 1200, y: 10200 }
  ,{ x: 3850, y: 10200 }
  ,{ x: 6200, y: 10200 }
  ,{ x: 8500, y: 10200 }
];

function civicTypeForSign(sign='') {
  const label=String(sign).toLowerCase();
  if(/air ambulance/.test(label))return 'airAmbulanceBase';
  if(/maritime rescue|coast guard/.test(label))return 'marineRescueBase';
  if(/hospital|clinic|medical|ems|ambulance/.test(label))return 'hospital';
  if(/fire|rescue/.test(label))return 'firestation';
  if(/airfield|airport|skyfreight/.test(label))return 'airfield';
  if(/national guard|armory/.test(label))return 'guardBase';
  if(/bus depot|terminal|marina|coast guard/.test(label))return 'depot';
  if(/police|city hall|civil defence|guard|college|library|school|community/.test(label))return 'civic';
  return null;
}

function buildStuntZones() {
  const roadList=roads.filter(r=>!r.bridgeApproach&&!r.serviceAccess);
  const candidates=[];
  for(const road of roadList){
    const horizontal=road.dir==='h',length=horizontal?road.w:road.h;
    if(length<850)continue;
    const start=horizontal?road.x:road.y,end=start+length,center=horizontal?road.y+road.h/2:road.x+road.w/2;
    const limits=[start+180,end-180];
    const rawBlocked=roadList.filter(other=>other!==road&&other.dir!==(horizontal?'h':'v'))
      .filter(other=>horizontal?center>=other.y-12&&center<=other.y+other.h+12:center>=other.x-12&&center<=other.x+other.w+12)
      .map(other=>{const a=horizontal?other.x:other.y,b=a+(horizontal?other.w:other.h);return[Math.max(limits[0],a-155),Math.min(limits[1],b+155)]})
      .sort((a,b)=>a[0]-b[0]);
    const blocked=[];
    for(const interval of rawBlocked){
      if(interval[1]<=interval[0])continue;
      const last=blocked.at(-1);
      if(last&&interval[0]<=last[1])last[1]=Math.max(last[1],interval[1]);else blocked.push([...interval]);
    }
    const gaps=[];let cursor=limits[0];
    for(const [a,b] of blocked){if(a-cursor>=260)gaps.push([cursor,a]);cursor=Math.max(cursor,b)}
    if(limits[1]-cursor>=260)gaps.push([cursor,limits[1]]);
    const gap=gaps.sort((a,b)=>(b[1]-b[0])-(a[1]-a[0]))[0];
    if(!gap)continue;
    const pos=(gap[0]+gap[1])/2;
    const x=horizontal?pos:center,y=horizontal?center:pos;
    if(bridges.some(br=>x>=br.x-100&&x<=br.x+br.w+100&&y>=br.y-100&&y<=br.y+br.h+100))continue;
    if(buildings.some(b=>x>=b.x-125&&x<=b.x+b.w+125&&y>=b.y-125&&y<=b.y+b.h+125))continue;
    candidates.push({x,y,axis:horizontal?'h':'v',roadWidth:horizontal?road.h:road.w,roadLength:length,roadIndex:roadList.indexOf(road)});
  }
  candidates.sort((a,b)=>a.roadIndex-b.roadIndex);
  for(const [i,candidate] of candidates.entries()){
    // Keep the ramps on calmer local roads, away from bridges and junctions.
    if(i%6!==0)continue;
    const type=Math.floor(i/6)%2===0?'ramp':'speed_bump';
    stuntZones.push({...candidate,id:`stunt-${i}`,type,length:type==='ramp'?72:58,launchColor:type==='ramp'?'#d48b38':'#d9c77b'});
  }
}

function stuntHeightFor(vehicle) { return stuntStates.get(vehicle)?.height||0; }

function updateStuntVehicle(vehicle,dt=1/60) {
  if(!vehicle||!stuntZones.length)return 0;
  const frame=Math.min(Math.max(dt,0),.05)*60;
  let state=stuntStates.get(vehicle);
  if(!state){state={x:vehicle.x,y:vehicle.y,height:0,verticalSpeed:0,cooldown:0,score:0};stuntStates.set(vehicle,state);return 0;}
  state.cooldown=Math.max(0,state.cooldown-dt);
  const dx=vehicle.x-state.x,dy=vehicle.y-state.y;
  const speed=Math.abs(vehicle.speed??vehicle.cruiseSpeed??Math.hypot(dx,dy));
  if(state.cooldown<=0&&speed>1.8){
    const hit=stuntZones.find(zone=>{
      const along=zone.axis==='h'?vehicle.x:vehicle.y,cross=zone.axis==='h'?vehicle.y:vehicle.x;
      const alongDelta=zone.axis==='h'?dx:dy,crossDelta=zone.axis==='h'?dy:dx;
      const aligned=Math.abs(alongDelta)>Math.abs(crossDelta)*.68;
      return aligned&&Math.abs(along-(zone.axis==='h'?zone.x:zone.y))<=zone.length*.5+(vehicle.width||40)*.35&&
        Math.abs(cross-(zone.axis==='h'?zone.y:zone.x))<=zone.roadWidth*.5+(vehicle.height||20)*.28;
    });
    if(hit){
      const mass=vehicle.mass??({bus:8200,truck:5200,van:2200,police:1600}[vehicle.type]||1450);
      const massFactor=Math.max(.5,Math.min(1.12,1.18-mass/10500));
      state.verticalSpeed=Math.max(1.8,Math.min(8.2,speed*(hit.type==='ramp'?.78:.34)*massFactor));
      state.cooldown=hit.type==='ramp'?1.05:.7;
      state.lastZone=hit.id;
      const points=Math.round(speed*(hit.type==='ramp'?12:4));
      state.score+=points;
      if(vehicle===player&&hit.type==='ramp'&&speed>3.2){
        vehicle.stuntScore=(vehicle.stuntScore||0)+points;
        const now=performance.now?.()||0;
        if(now-lastStuntNoticeAt>1500){showToast(`🏁 ТРЮК +${points} · ВСЕГО ${vehicle.stuntScore}`);lastStuntNoticeAt=now;}
      }
    }
  }
  if(state.height>0||state.verticalSpeed>0){
    state.verticalSpeed-=.34*frame;
    state.height+=state.verticalSpeed*frame;
    if(state.height<=0){state.height=0;state.verticalSpeed=0;state.landedAt=performance.now?.()||0;}
  }
  state.x=vehicle.x;state.y=vehicle.y;
  return state.height;
}

let roadPaintGeometry=null;

function junctionCrosswalkStripes(horizontal,vertical,approaches={north:true,south:true,west:true,east:true}) {
  const stripes=[];
  for(let x=vertical.x+8;x<vertical.x+vertical.w-8;x+=15){
    if(approaches.north)stripes.push({x,y:horizontal.y-28,w:7,h:20,approach:'north'});
    if(approaches.south)stripes.push({x,y:horizontal.y+horizontal.h+8,w:7,h:20,approach:'south'});
  }
  for(let y=horizontal.y+8;y<horizontal.y+horizontal.h-8;y+=15){
    if(approaches.west)stripes.push({x:vertical.x-28,y,w:20,h:7,approach:'west'});
    if(approaches.east)stripes.push({x:vertical.x+vertical.w+8,y,w:20,h:7,approach:'east'});
  }
  return stripes;
}

function subtractRoadIntervals(start,end,masks){
  const segments=[];let cursor=start;
  for(const [a,b] of masks.sort((a,b)=>a[0]-b[0])){
    if(b<=cursor||a>=end)continue;
    if(a>cursor)segments.push([cursor,Math.min(a,end)]);
    cursor=Math.max(cursor,b);if(cursor>=end)break;
  }
  if(cursor<end)segments.push([cursor,end]);return segments;
}

function buildRoadPaintGeometry(){
  const junctions=[],curbs=[],lanes=[];
  for(const horizontal of roads.filter(r=>r.dir==='h'))for(const vertical of roads.filter(r=>r.dir==='v')){
    const overlapX=Math.min(horizontal.x+horizontal.w,vertical.x+vertical.w)-Math.max(horizontal.x,vertical.x);
    const overlapY=Math.min(horizontal.y+horizontal.h,vertical.y+vertical.h)-Math.max(horizontal.y,vertical.y);
    if(overlapX<0||overlapY<0||horizontal.h<55||vertical.w<55)continue;
    const x=vertical.x,y=horizontal.y,w=vertical.w,h=horizontal.h;
    const approaches={
      north:vertical.y<y-32,south:vertical.y+vertical.h>y+h+32,
      west:horizontal.x<x-32,east:horizontal.x+horizontal.w>x+w+32};
    const existing=junctions.find(j=>j.x===x&&j.y===y&&j.w===w&&j.h===h);
    if(existing){
      existing.horizontalRoads.push(horizontal);existing.verticalRoads.push(vertical);
      for(const face of Object.keys(approaches))existing.approaches[face]||=approaches[face];
    }else junctions.push({x,y,w,h,horizontalRoads:[horizontal],verticalRoads:[vertical],approaches});
  }
  for(const road of roads){
    const horizontal=road.dir==='h',start=horizontal?road.x:road.y,end=start+(horizontal?road.w:road.h);
    for(const side of [0,1]){
      const fixed=horizontal?road.y+side*road.h:road.x+side*road.w,masks=[];
      for(const other of [...roads,...bridges]){
        if(other===road)continue;
        const lo=horizontal?other.y:other.x,hi=lo+(horizontal?other.h:other.w);
        if(fixed>lo+.01&&fixed<hi-.01)masks.push(horizontal?[other.x,other.x+other.w]:[other.y,other.y+other.h]);
      }
      for(const j of junctions){
        if(horizontal&&Math.abs(fixed-(j.y+side*j.h))<.01){
          const face=side?'south':'north';
          masks.push([j.x-(j.approaches.west&&j.approaches[face]?34:0),j.x+j.w+(j.approaches.east&&j.approaches[face]?34:0)]);
        }else if(!horizontal&&Math.abs(fixed-(j.x+side*j.w))<.01){
          const face=side?'east':'west';
          masks.push([j.y-(j.approaches.north&&j.approaches[face]?34:0),j.y+j.h+(j.approaches.south&&j.approaches[face]?34:0)]);
        }
      }
      for(const [a,b] of subtractRoadIntervals(start,end,masks))curbs.push(horizontal?{x1:a,y1:fixed,x2:b,y2:fixed}:{x1:fixed,y1:a,x2:fixed,y2:b});
    }
    const masks=junctions.filter(j=>(horizontal?j.horizontalRoads:j.verticalRoads).includes(road)).map(j=>horizontal?[j.x-40,j.x+j.w+40]:[j.y-40,j.y+j.h+40]);
    const fixed=horizontal?road.y+road.h/2:road.x+road.w/2;
    for(const [a,b] of subtractRoadIntervals(start,end,masks))lanes.push(horizontal?{x1:a,y1:fixed,x2:b,y2:fixed,phase:a}:{x1:fixed,y1:a,x2:fixed,y2:b,phase:a});
  }
  const signals=junctions.filter(j=>Object.values(j.approaches).every(Boolean)&&
    j.horizontalRoads.some(r=>!r.serviceAccess&&!r.bridgeApproach)&&
    j.verticalRoads.some(r=>!r.serviceAccess&&!r.bridgeApproach));
  return {junctions,curbs,lanes,signals};
}

function streetSignal(axis,now=performance.now()){
  const phase=((now/1000)%12+12)%12,active=phase<6?'x':'y',elapsed=phase%6;
  return elapsed>=5.7||axis!==active?'red':elapsed>=5?'amber':'green';
}

function trafficMustStopAtSignal(car,paint=roadPaintGeometry||(roadPaintGeometry=buildRoadPaintGeometry())){
  car.signalGap=Infinity;
  if(car.turn)return false;
  const axis=car.routeManaged?(Math.abs(Math.cos(car.angle))>Math.abs(Math.sin(car.angle))?'x':'y'):car.axis==='y'?'y':'x';
  const signal=streetSignal(axis);
  if(signal==='green')return false;
  const direction=car.routeManaged?Math.sign(axis==='x'?Math.cos(car.angle):Math.sin(car.angle)):Math.sign(car.cruiseSpeed||car.speed||1);
  const halfLength=(car.width||46)/2;
  return paint.signals.some(j=>{
    const cross=axis==='x'?car.y:car.x,lo=axis==='x'?j.y:j.x,span=axis==='x'?j.h:j.w;
    if(cross<lo||cross>lo+span)return false;
    const entry=axis==='x'?(direction>0?j.x:j.x+j.w):(direction>0?j.y:j.y+j.h);
    const gap=(entry-car[axis])*direction-halfLength-36;
    const stop=gap>=-4&&gap<90&&(signal==='red'||gap>Math.abs(car.speed||0)*10);
    if(stop)car.signalGap=gap;
    return stop;
  });
}

function drawStreetSignal(x,y,axis){
  ctx.save();ctx.translate(x,y);ctx.transform(1/Math.sqrt(3),-1/Math.sqrt(3),1,1,0,0);
  ctx.strokeStyle='#5f6560';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(0,0);ctx.lineTo(0,-28);ctx.stroke();
  ctx.fillStyle='#151b1c';ctx.fillRect(-4,-37,8,20);
  const active=streetSignal(axis),colors={red:'#df6352',amber:'#e7b656',green:'#7dc793'};
  ['red','amber','green'].forEach((color,i)=>{
    ctx.fillStyle=active===color?colors[color]:'#343a36';ctx.shadowColor=colors[color];ctx.shadowBlur=active===color?4:0;
    ctx.beginPath();ctx.arc(0,-33+i*6,2.1,0,Math.PI*2);ctx.fill();
  });ctx.restore();
}

function initTopology() {
  roadPaintGeometry=null;
  roads.length = 0;
  scenicRoads.length = 0;
  roadEnds.length = 0;
  buildings.length = 0;
  breakableProps.length = 0;
  bridgeRails.length = 0;
  trafficCars.length = 0;
  policeCars.length = 0;
  incidentPoliceCars.length = 0;
  incidentResponseVehicles.length = 0;
  airMedicalVehicles.length = 0;
  serviceBases.length = 0;
  transitRoutes.length = 0;
  pedestrians.length = 0;
  streetLights.length = 0;
  trees.length = 0;
  parkedCars.length = 0;
  cranes.length = 0;
  billboards.length = 0;
  parkZones.length = 0;
  parkObstacles.length = 0;
  streetProps.length = 0;
  stuntZones.length = 0;
  stuntStates = new WeakMap();
  lastStuntNoticeAt=-Infinity;
  solidProps.length = 0;

  // Expressway
  roads.push(
    { x: 450, y: 1135, w: 2050, h: ROAD_W, dir: 'h', name: 'Центральный Проспект' },
    { x: 2850, y: 1135, w: 2000, h: ROAD_W, dir: 'h', name: 'Портовая Магистраль' },
    { x: 5200, y: 1135, w: 1650, h: ROAD_W, dir: 'h', name: 'Фонарный Бульвар' },
    { x: 450, y: 4135, w: 2050, h: ROAD_W, dir: 'h', name: 'Южное Кольцо' },
    { x: 2850, y: 4135, w: 2000, h: ROAD_W, dir: 'h', name: 'Рыночная Магистраль' },
    { x: 5200, y: 4135, w: 1650, h: ROAD_W, dir: 'h', name: 'Блэквуд Драйв' }
  );

  // Downtown
  roads.push(
    { x: 450, y: 450, w: 1900, h: ROAD_W, dir: 'h' },
    { x: 450, y: 1850, w: 1900, h: ROAD_W, dir: 'h' },
    { x: 450, y: 450, w: ROAD_W, h: 1530, dir: 'v' },
    { x: 1200, y: 450, w: ROAD_W, h: 2050, dir: 'v' },
    { x: 2000, y: 450, w: ROAD_W, h: 1530, dir: 'v' }
  );

  // Docks
  roads.push(
    { x: 2950, y: 450, w: 1750, h: ROAD_W, dir: 'h' },
    { x: 2950, y: 1850, w: 1750, h: ROAD_W, dir: 'h' },
    { x: 2950, y: 450, w: ROAD_W, h: 1530, dir: 'v' },
    { x: 3850, y: 450, w: ROAD_W, h: 2050, dir: 'v' },
    { x: 4600, y: 450, w: ROAD_W, h: 1530, dir: 'v' }
  );

  // Lantern Bay
  roads.push(
    { x: 5300, y: 450, w: 1550, h: ROAD_W, dir: 'h' },
    { x: 5300, y: 1850, w: 1550, h: ROAD_W, dir: 'h' },
    { x: 5300, y: 450, w: ROAD_W, h: 1530, dir: 'v' },
    { x: 6200, y: 450, w: ROAD_W, h: 2050, dir: 'v' }
  );

  // Southern city belt
  roads.push(
    { x: 450, y: 3350, w: 1900, h: ROAD_W, dir: 'h' },
    { x: 450, y: 4950, w: 1900, h: ROAD_W, dir: 'h' },
    { x: 450, y: 3350, w: ROAD_W, h: 1730, dir: 'v' },
    { x: 1200, y: 3200, w: ROAD_W, h: 2200, dir: 'v' },
    { x: 2000, y: 3350, w: ROAD_W, h: 1730, dir: 'v' },
    { x: 2950, y: 3350, w: 1750, h: ROAD_W, dir: 'h' },
    { x: 2950, y: 4950, w: 1750, h: ROAD_W, dir: 'h' },
    { x: 2950, y: 3350, w: ROAD_W, h: 1730, dir: 'v' },
    { x: 3850, y: 3200, w: ROAD_W, h: 2200, dir: 'v' },
    { x: 4600, y: 3350, w: ROAD_W, h: 1730, dir: 'v' },
    { x: 5300, y: 3350, w: 1550, h: ROAD_W, dir: 'h' },
    { x: 5300, y: 4950, w: 1550, h: ROAD_W, dir: 'h' },
    { x: 5300, y: 3350, w: ROAD_W, h: 1730, dir: 'v' },
    { x: 6200, y: 3200, w: ROAD_W, h: 2200, dir: 'v' }
  );

  // Far south expansion: residential peninsula, freight works and coast road.
  roads.push(
    { x: 450, y: 6350, w: 1900, h: ROAD_W, dir: 'h' },
    { x: 450, y: 7135, w: 2050, h: ROAD_W, dir: 'h', name: 'Марроу Авеню' },
    { x: 450, y: 7950, w: 1900, h: ROAD_W, dir: 'h' },
    { x: 450, y: 6350, w: ROAD_W, h: 1730, dir: 'v' },
    { x: 1200, y: 6200, w: ROAD_W, h: 2200, dir: 'v' },
    { x: 2000, y: 6350, w: ROAD_W, h: 1730, dir: 'v' },
    { x: 2850, y: 6350, w: 2000, h: ROAD_W, dir: 'h' },
    { x: 2850, y: 7135, w: 2000, h: ROAD_W, dir: 'h', name: 'Фаундри Роу' },
    { x: 2850, y: 7950, w: 2000, h: ROAD_W, dir: 'h' },
    { x: 2950, y: 6350, w: ROAD_W, h: 1730, dir: 'v' },
    { x: 3850, y: 6200, w: ROAD_W, h: 2200, dir: 'v' },
    { x: 4600, y: 6350, w: ROAD_W, h: 1730, dir: 'v' },
    { x: 5200, y: 6350, w: 1650, h: ROAD_W, dir: 'h' },
    { x: 5200, y: 7135, w: 1650, h: ROAD_W, dir: 'h', name: 'Вельвет Кост Драйв' },
    { x: 5200, y: 7950, w: 1650, h: ROAD_W, dir: 'h' },
    { x: 5300, y: 6350, w: ROAD_W, h: 1730, dir: 'v' },
    { x: 6200, y: 6200, w: ROAD_W, h: 2200, dir: 'v' }
  );

  // Eastern shore and deep-south metropolitan expansion. The repeated local
  // grids keep navigation readable while the bridges preserve island identity.
  for (const baseY of [300, 3200, 6200]) {
    roads.push(
      { x: 7450, y: baseY + 150, w: 1900, h: ROAD_W, dir: 'h' },
      { x: 7450, y: baseY + (baseY===300?835:935), w: 1900, h: ROAD_W, dir: 'h', name: baseY === 300 ? 'Истгейт Авеню' : baseY === 3200 ? 'Синдер-Парквей' : 'Кингсвей' },
      { x: 7450, y: baseY + 1550, w: 1900, h: ROAD_W, dir: 'h' },
      { x: 7450, y: baseY + 150, w: ROAD_W, h: 1530, dir: 'v' },
      { x: 8500, y: baseY, w: ROAD_W, h: 2200, dir: 'v' },
      { x: 9220, y: baseY + 150, w: ROAD_W, h: 1530, dir: 'v' }
    );
  }
  for (const column of [{x:300,w:2200,main:1200},{x:2850,w:2000,main:3850},{x:5200,w:1800,main:6200},{x:7350,w:2200,main:8500}]) {
    roads.push(
      { x: column.x + 150, y: 9350, w: column.w - 300, h: ROAD_W, dir: 'h' },
      { x: column.x + 150, y: 10135, w: column.w - 300, h: ROAD_W, dir: 'h', name: 'Саут-Кросс Роуд' },
      { x: column.x + 150, y: 10950, w: column.w - 300, h: ROAD_W, dir: 'h' },
      { x: column.x + 150, y: 9350, w: ROAD_W, h: 1730, dir: 'v' },
      { x: column.main, y: 9200, w: ROAD_W, h: 2200, dir: 'v' },
      { x: column.x + column.w - 250, y: 9350, w: ROAD_W, h: 1730, dir: 'v' }
    );
  }

  // Short paved bridge approaches overlap both the curved shore and the deck.
  // This removes the invisible water gaps that previously separated a bridge
  // from the street by roughly one pavement width.
  bridges.forEach(br=>{
    const approach=170;
    if(br.dir==='h')roads.push(
      {x:br.x-approach,y:br.y,w:approach,h:br.h,dir:'h',bridgeApproach:true},
      {x:br.x+br.w,y:br.y,w:approach,h:br.h,dir:'h',bridgeApproach:true}
    );
    else roads.push(
      {x:br.x,y:br.y-approach,w:br.w,h:approach,dir:'v',bridgeApproach:true},
      {x:br.x,y:br.y+br.h,w:br.w,h:approach,dir:'v',bridgeApproach:true}
    );
  });

  // Waterfront lanes bend around the undeveloped edges and join real streets.
  // These are sampled curves shared by the scene and both maps.
  islands.forEach((isl,i)=>{
    const x=isl.x,y=isl.y;
    const endY=(y===300||(x===7350&&y!==9200))?1615:1815;
    const controls=[[x+240,y+215],[x+130,y+130],[x+72,y+330],[x+85+(i%3)*14,y+760],[x+65,y+1180],[x+125,y+endY-120],[x+240,y+endY]];
    const points=[];
    for(let n=0;n<controls.length-1;n++){
      const a=controls[Math.max(0,n-1)],b=controls[n],c=controls[n+1],d=controls[Math.min(controls.length-1,n+2)];
      for(let k=0;k<12;k++){const t=k/12,t2=t*t,t3=t2*t;points.push([0,1].map(axis=>.5*(2*b[axis]+(-a[axis]+c[axis])*t+(2*a[axis]-5*b[axis]+4*c[axis]-d[axis])*t2+(-a[axis]+3*b[axis]-3*c[axis]+d[axis])*t3)));}
    }
    points.push(controls.at(-1));scenicRoads.push({points,width:58,name:'Набережная '+isl.name});
  });

  // Bridges
  bridges.forEach(br => {
    if (br.dir === 'v') {
      bridgeRails.push({ x: br.x - 12, y: br.y, w: 14, h: br.h, axis: 'x' });
      bridgeRails.push({ x: br.x + br.w - 2, y: br.y, w: 14, h: br.h, axis: 'x' });
    } else {
      bridgeRails.push({ x: br.x, y: br.y - 12, w: br.w, h: 14, axis: 'y' });
      bridgeRails.push({ x: br.x, y: br.y + br.h - 2, w: br.w, h: 14, axis: 'y' });
    }
  });

  // Buildings with neon & AC units
  buildings.push(
    { x: 630, y: 630, w: 520, h: 450, sign: '🍸 BAR "WHISKEY CAT"', neon: '#f59e0b', roof: '#17202f' },
    { x: 1380, y: 630, w: 570, h: 450, sign: '💰 PAWN & LOANS', neon: '#10b981', roof: '#1b2434' },
    { x: 630, y: 1320, w: 520, h: 480, sign: '🏨 HOTEL ST. CLAIR', neon: '#ec4899', roof: '#182130' },
    { x: 1380, y: 1320, w: 570, h: 480, sign: '🚓 POLICE PRECINCT', neon: '#3b82f6', roof: '#1d273a' },
    { x: 3130, y: 630, w: 670, h: 450, sign: '⚓ DOCK WAREHOUSE 04', neon: '#06b6d4', roof: '#1c2535' },
    { x: 4030, y: 630, w: 520, h: 450, sign: '📦 CARGO TERMINAL B', neon: '#eab308', roof: '#192231' },
    { x: 3130, y: 1320, w: 670, h: 480, sign: '❄️ COLD STORAGE CORP', neon: '#38bdf8', roof: '#1e293c' },
    { x: 4030, y: 1320, w: 520, h: 480, sign: '🚢 PORT AUTHORITY', neon: '#f97316', roof: '#1a2332' },
    { x: 5480, y: 630, w: 670, h: 450, sign: '🏮 LANTERN BAY TAVERN', neon: '#ef4444', roof: '#221f1a' },
    { x: 5480, y: 1320, w: 670, h: 480, sign: '🌴 OVERLOOK MOTEL', neon: '#a855f7', roof: '#201d18' },
    { x: 630, y: 3530, w: 520, h: 520, sign: '🏭 OLD MILL FOUNDRY', neon: '#f97316', roof: '#211b19' },
    { x: 1380, y: 3530, w: 570, h: 520, sign: '🎱 BLACK DOG BILLIARDS', neon: '#22c55e', roof: '#171f1c' },
    { x: 630, y: 4310, w: 520, h: 590, sign: '🔧 SOUTH SIDE GARAGE', neon: '#eab308', roof: '#202027' },
    { x: 1380, y: 4310, w: 570, h: 590, sign: '📻 RADIO LOWTOWN 96.6', neon: '#ec4899', roof: '#211b2b' },
    { x: 3130, y: 3530, w: 670, h: 520, sign: '🥩 RED HOOK MARKET', neon: '#ef4444', roof: '#231b1c' },
    { x: 4030, y: 3530, w: 520, h: 520, sign: '🚇 SOUTH TERMINAL', neon: '#38bdf8', roof: '#182333' },
    { x: 3130, y: 4310, w: 670, h: 590, sign: '📼 VIDEO PALACE', neon: '#a855f7', roof: '#201a2b' },
    { x: 4030, y: 4310, w: 520, h: 590, sign: '🍜 NIGHT MARKET', neon: '#f59e0b', roof: '#231f19' },
    { x: 5480, y: 3530, w: 670, h: 520, sign: '🌲 BLACKWOOD LODGE', neon: '#10b981', roof: '#17221d' },
    { x: 5480, y: 4310, w: 670, h: 590, sign: '📡 CHANNEL 8 TOWER', neon: '#60a5fa', roof: '#1a2130' },
    { x: 630, y: 6530, w: 520, h: 520, sign: '⚓ MARROW FISH MARKET', neon: '#e8b84a', roof: '#20251f' },
    { x: 1380, y: 6530, w: 570, h: 520, sign: '🎺 BLUE NOTE SOCIAL', neon: '#d4523a', roof: '#211d20' },
    { x: 630, y: 7310, w: 520, h: 590, sign: '🏘 SOUTH TENEMENTS', neon: '#9aa0a8', roof: '#24221f' },
    { x: 1380, y: 7310, w: 570, h: 590, sign: '🥊 MARROW GYM', neon: '#e09a3e', roof: '#211d1a' },
    { x: 3130, y: 6530, w: 670, h: 520, sign: '🏭 SOUTHPORT STEEL', neon: '#d4523a', roof: '#25221e' },
    { x: 4030, y: 6530, w: 520, h: 520, sign: '🚂 FREIGHT DEPOT 12', neon: '#e8b84a', roof: '#1e2425' },
    { x: 3130, y: 7310, w: 670, h: 590, sign: '🛢 MARITIME FUEL', neon: '#e09a3e', roof: '#24201b' },
    { x: 4030, y: 7310, w: 520, h: 590, sign: '🔩 UNION MACHINE', neon: '#9aa0a8', roof: '#1f2324' },
    { x: 5480, y: 6530, w: 670, h: 520, sign: '🎭 VELVET THEATRE', neon: '#d4523a', roof: '#241d22' },
    { x: 5480, y: 7310, w: 670, h: 590, sign: '🌊 COASTLINE HOTEL', neon: '#e8b84a', roof: '#202429' }
  );

  for (const district of expansionDistricts) {
    const upper = district.y + 330;
    const lower = district.y === 300 ? district.y + 1010 : district.y + 1110;
    const lowerH = district.y === 9200 ? 560 : district.y === 300 ? 480 : 380;
    const left = district.x + 330, right = district.main + 180;
    const leftW = Math.min(620, district.main - left - 60), rightW = Math.min(620, district.far - right - 60);
    buildings.push(
      { x:left, y:upper, w:leftW, h:500, sign:district.signs[0], neon:district.neon, roof:district.roof },
      { x:right, y:upper, w:rightW, h:500, sign:district.signs[1], neon:district.neon, roof:district.roof },
      { x:left, y:lower, w:leftW, h:lowerH, sign:district.lowerSigns?.[0]||'APARTMENTS', neon:'#9aa0a8', roof:district.roof },
      { x:right, y:lower, w:rightW, h:lowerH, sign:district.lowerSigns?.[1]||'NIGHT SERVICES', neon:'#bba77c', roof:district.roof }
    );
  }

  // Separate street-front properties with driveable service alleys.
  const blocks = buildings.splice(0);
  let streetscapeIndex=0;
  let parkStyleIndex=0;
  blocks.forEach((block, blockIndex) => {
    const gap = 76;
    const bw = (block.w - gap) / 2, bh = (block.h - gap) / 2;
    const civicType=civicTypeForSign(block.sign);
    if(civicType){
      const insetX=block.w*.03,insetY=block.h*.03;
      const floors=civicType==='hospital'?5:civicType==='civic'?3:civicType==='airfield'?2:2;
      const archetype=['guardBase','airAmbulanceBase','marineRescueBase'].includes(civicType)?'civic':civicType;
      buildings.push(
        {...block,x:block.x+insetX,y:block.y+insetY,w:block.w*.62,h:block.h*.66,floors,archetype,civicType,cornerRadius:14,serviceParcel:{x:block.x,y:block.y,w:block.w,h:block.h}},
        {...block,x:block.x+block.w*.68,y:block.y+block.h*.08,w:block.w*.24,h:block.h*.27,floors:1,archetype:'warehouse',sign:'SERVICE BAY',neon:'#b88b53'},
        {...block,x:block.x+block.w*.68,y:block.y+block.h*.41,w:block.w*.24,h:block.h*.27,floors:1,archetype:'warehouse',sign:'STORES & GARAGE',neon:'#8b7c62'},
        {...block,x:block.x+block.w*.1,y:block.y+block.h*.75,w:block.w*.5,h:block.h*.15,floors:1,archetype:'pavilion',sign:'VISITOR ANNEX',neon:'#9aa0a8'}
      );
      return;
    }
    const parcelIndex=streetscapeIndex++;
    if (parcelIndex % 4 === 2) {
      // Asymmetric perimeter blocks leave a usable, open-ended inner court.
      // Every wing is also a collision body; the courtyard is genuinely empty.
      const wing=block.w*.22, depth=block.h*.21;
      buildings.push(
        {...block,w:block.w*.61,h:depth,floors:4,archetype:'tenement'},
        {...block,x:block.x+block.w*.73,w:block.w*.27,h:depth,floors:2,archetype:'shop',sign:'CORNER CAFE'},
        {...block,y:block.y+depth+30,w:wing,h:block.h-depth-30,floors:3,archetype:'townhouse',sign:'COURT RESIDENCES'},
        {...block,x:block.x+block.w-wing,y:block.y+depth+52,w:wing,h:block.h-depth-110,floors:3,archetype:'deco',sign:'STUDIOS'}
      );
      parkZones.push({x:block.x+wing+24,y:block.y+depth+34,w:block.w-wing*2-48,h:block.h-depth-64,type:parkStyleIndex++%8,courtyard:true});
      return;
    }
    if (parcelIndex % 5 === 0 || parcelIndex % 9 === 4) {
      // Give every few districts breathing room: four low perimeter buildings
      // frame a real civic park instead of another full roof-to-roof block.
      const edgeH=Math.max(82,block.h*.22), edgeW=Math.max(92,block.w*.25);
      buildings.push(
        {...block,x:block.x,y:block.y,w:block.w*.42,h:edgeH,floors:2,archetype:'pavilion',sign:block.sign},
        {...block,x:block.x+block.w*.58,y:block.y,w:block.w*.42,h:edgeH,floors:2,archetype:'shop',sign:'CAFE'},
        {...block,x:block.x,y:block.y+block.h-edgeH,w:block.w*.34,h:edgeH,floors:1,archetype:'pavilion',sign:'PARK HOUSE'},
        {...block,x:block.x+block.w-edgeW,y:block.y+block.h-edgeH,w:edgeW,h:edgeH,floors:1,archetype:'shop',sign:'NEWS & FLOWERS'}
      );
      parkZones.push({x:block.x+28,y:block.y+edgeH+24,w:block.w-56,h:block.h-edgeH*2-48,type:parkStyleIndex++%8});
      trees.push({x:block.x+block.w*.5,y:block.y-28,size:23});
      return;
    }
    const district=districtAt(block.x+block.w/2,block.y+block.h/2);
    const districtTypes=districtProfiles[district?.id]?.types||['tenement','shop','warehouse','deco','townhouse','office'];
    const secondarySigns=['APARTMENTS','REPAIR SHOP','GROCERY','WAREHOUSE','LAUNDROMAT','DINER','PAWN & LOAN','OLD BOOKS'];
    const floorRanges={tenement:[4,6],shop:[2,3],warehouse:[1,2],deco:[3,5],townhouse:[2,4],office:[5,7]};
    for (let row = 0; row < 2; row++) for (let col = 0; col < 2; col++) {
      const archetype=districtTypes[(blockIndex+row*2+col)%districtTypes.length];
      const range=floorRanges[archetype], floors=range[0]+((blockIndex+row+col)%(range[1]-range[0]+1));
      const inset=archetype==='townhouse'?14:archetype==='warehouse'?5:archetype==='office'?9:0;
      buildings.push({ ...block, x: block.x + col * (bw + gap)+inset, y: block.y + row * (bh + gap)+(archetype==='shop'?12:0), w: bw-inset*1.35, h: bh-(archetype==='warehouse'?8:archetype==='shop'?18:0),
        floors,archetype,cornerRadius:archetype==='warehouse'?5:archetype==='deco'?11:archetype==='townhouse'?7:18,
        sign: row === 0 && col === 0 ? block.sign.replace(/[^\x20-\x7E]/g, '').trim() : secondarySigns[(blockIndex*3 + row*2 + col) % secondarySigns.length],
        neon: ['#e09a3e', '#bba77c', '#9aa0a8', '#d4523a','#5f9ea0','#c06b47'][(blockIndex+row+col) % 6] });
    }
    trees.push({ x: block.x + bw + gap / 2, y: block.y - 28, size: 23 });
  });

  // Vary actual footprints inside existing parcels. Collision bodies shrink
  // with the facades, leaving genuine forecourts and accessible side alleys.
  buildings.forEach((b,i)=>{
    const district=districtAt(b.x+b.w/2,b.y+b.h/2);
    b.districtId=district?.id;
    if(!b.civicType)b.roof=districtProfiles[district?.id]?.roof||b.roof;
    if(b.archetype==='pavilion')return;
    const sx=[.82,1,.91,.74,1,.88][i%6],sy=[1,.84,.93,1,.79][i%5];
    const dw=b.w*(1-sx),dh=b.h*(1-sy);b.x+=dw*.5;b.y+=dh*.5;b.w-=dw;b.h-=dh;
    if(b.archetype==='townhouse')b.floors=2+i%2;
    if(b.archetype==='office')b.floors=4+i%4;
    if(b.archetype==='warehouse')b.floors=1+i%2;
    b.neon=['#d39b4e','#bd754d','#b6a880','#80988d'][i%4];
    b.cornerRadius=b.archetype==='deco'?26:b.archetype==='shop'?18:6;
  });
  buildStuntZones();

  // Park furniture is real world geometry, not paint on the ground. The same
  // deterministic layouts drive rendering, pedestrian navigation and vehicle
  // contacts so visible trunks, water and street furniture cannot be crossed.
  parkZones.forEach((park,i)=>{
    park.trees=[];park.benches=[];park.feature={x:park.x+park.w*.53,y:park.y+park.h*.51,type:park.type};
    for(let t=0;t<16;t++){
      const edge=t%4,ratio=(Math.floor(t/4)+1)/5;
      const x=edge===0?park.x+park.w*ratio:edge===1?park.x+park.w-18:edge===2?park.x+park.w*(1-ratio):park.x+18;
      const y=edge===0?park.y+18:edge===1?park.y+park.h*ratio:edge===2?park.y+park.h-18:park.y+park.h*(1-ratio);
      const tree={x,y,size:15+(t+i)%5,park:true};park.trees.push(tree);trees.push(tree);
    }
    for(let n=0;n<3;n++){
      const bench={x:park.x+park.w*(.25+n*.25),y:park.y+park.h*.78,width:42,height:10,type:'bench'};
      park.benches.push(bench);parkObstacles.push(bench);
    }
    const f=park.feature;
    if(park.type===0)parkObstacles.push({x:f.x,y:f.y,width:88,height:58,type:'fountain'});
    if(park.type===1)parkObstacles.push({x:f.x,y:f.y,width:park.w*.42,height:park.h*.48,type:'pond'});
    if(park.type===3)for(let s=0;s<4;s++)parkObstacles.push({x:f.x-48+s*40,y:f.y-6,width:31,height:28,type:'stall'});
    if(park.type===4){
      parkObstacles.push({x:f.x-28,y:f.y+10,width:48,height:24,type:'playground'},
        {x:f.x+40,y:f.y-8,width:24,height:38,type:'swings'});
    }
    if(park.type===5)for(let bed=0;bed<4;bed++)parkObstacles.push({x:f.x-52+(bed%2)*68,y:f.y-20+Math.floor(bed/2)*42,width:48,height:24,type:'gardenbed'});
    if(park.type===6)parkObstacles.push({x:f.x-44,y:f.y+10,width:44,height:25,type:'skateramp'},
      {x:f.x+38,y:f.y-14,width:36,height:22,type:'skateramp'});
    if(park.type===7)parkObstacles.push({x:f.x-34,y:f.y+14,width:18,height:42,type:'agility'},
      {x:f.x+26,y:f.y-14,width:46,height:18,type:'agility'});
  });

  // Physical street furniture: these coordinates are shared by rendering,
  // walking and vehicle contacts, so a visible shelter or phone box is solid.
  const shelters=[[820,1088],[1740,1284],[3320,1088],[4260,1284],[5650,1088],[6600,1284],[820,4088],[3400,4284],[5720,4088],[8050,1088],[8750,4284]];
  shelters.forEach(([x,y],i)=>streetProps.push({x,y,width:60,height:25,type:'shelter',variant:i%2}));
  const kiosks=[[1060,1790],[2200,620],[3670,1790],[6060,1790],[9000,1790],[880,4790],[4400,4790],[5900,7790]];
  kiosks.forEach(([x,y],i)=>streetProps.push({x,y,width:44,height:32,type:'kiosk',variant:i%2}));
  const workZones=[[1890,1085],[4480,4085],[5980,7085],[8300,10085]];
  workZones.forEach(([x,y])=>streetProps.push({x:x+34,y:y-5,width:76,height:30,type:'workzone'}));
  [[735,1260],[1540,1960],[3470,1260],[5580,1960],[7830,1260],[9080,4960],[760,7960],[3300,10940],[8220,10940]].forEach(([x,y],i)=>
    streetProps.push({x,y,width:i%3===0?22:16,height:i%3===0?34:18,type:i%3===0?'phone':'bin',variant:i%2}));
  for(const [x,y,dir] of [[2390,1108,'h'],[2940,1278,'h'],[4740,4108,'h'],[5290,4278,'h'],[6900,7108,'h'],[7440,7278,'h']])
    for(let n=-1;n<=1;n++)streetProps.push({x:x+(dir==='v'?0:n*22),y:y+(dir==='v'?n*22:0),width:9,height:9,type:'bollard'});
  solidProps.push(...parkObstacles,...streetProps);

  // Props
  const hydrants = [{ x: 430, y: 1115 }, { x: 1180, y: 1115 }, { x: 1980, y: 1115 }, { x: 2930, y: 1115 }, { x: 3830, y: 1115 }, { x: 5280, y: 1115 }, { x: 430, y: 4115 }, { x: 1980, y: 4115 }, { x: 3830, y: 4115 }, { x: 5280, y: 4115 }];
  hydrants.forEach(h => breakableProps.push({ x: h.x, y: h.y, type: 'hydrant', intact: true, w: 14, h: 14 }));

  const dumpsters = [{ x: 620, y: 1100 }, { x: 1370, y: 1100 }, { x: 3120, y: 1100 }, { x: 5470, y: 1100 }, { x: 620, y: 4100 }, { x: 3120, y: 4100 }, { x: 5470, y: 4100 }];
  dumpsters.forEach(d => breakableProps.push({ x: d.x, y: d.y, type: 'dumpster', intact: true, w: 26, h: 18 }));

  // District scenery: sodium lamps, parked cars, trees, cranes and billboards.
  for (let x = 520; x <= WORLD_W - 520; x += 320) {
    streetLights.push({ x, y: 1110, tone: '#e09a3e' }, { x, y: 4290, tone: '#e8b84a' }, { x, y: 7110, tone: '#e09a3e' }, { x, y: 10110, tone: '#e8b84a' });
  }
  for (const y of [700, 1000, 1500, 1760, 3600, 3920, 4520, 4820]) {
    trees.push({ x: 5255, y, size: 18 + (y % 3) * 3 }, { x: 6765, y: y + 35, size: 20 + (y % 4) * 2 });
  }
  const parkedPalette = ['#7c2d12', '#1e3a5f', '#4b5563', '#7f1d1d', '#713f12', '#0f766e'];
  for (let i = 0; i < 24; i++) {
    const south = i >= 12;
    const row = i % 12;
    parkedCars.push({
      x: [710, 880, 1450, 1660, 3190, 3410, 4100, 4320, 5540, 5750, 5910, 6050][row], y: south ? 4095 : 1095,
      angle: 0, width: 40, height: 19, color: parkedPalette[i % parkedPalette.length],
      type: ['sedan','coupe','wagon','taxi','van','sedan'][i%6]
    });
  }
  cranes.push(
    { x: 3260, y: 700, reach: 180 }, { x: 4320, y: 760, reach: -170 },
    { x: 3300, y: 4450, reach: 190 }, { x: 4420, y: 4550, reach: -160 },
    { x: 3000, y: 1720, reach: 150 }, { x: 4650, y: 1650, reach: -145 },
    { x: 3260, y: 6660, reach: 205 }, { x: 4380, y: 7460, reach: -180 }
  );
  billboards.push(
    { x: 980, y: 1050, text: 'LOWTOWN FM', color: '#ec4899' },
    { x: 1720, y: 1050, text: 'MIDNIGHT OIL', color: '#f59e0b' },
    { x: 3520, y: 1050, text: 'IRONWORKS', color: '#38bdf8' },
    { x: 5860, y: 1050, text: 'LANTERN BAY', color: '#ef4444' },
    { x: 970, y: 4050, text: 'OLD MILL', color: '#f97316' },
    { x: 3520, y: 4050, text: 'RED HOOK', color: '#dc2626' },
    { x: 5850, y: 4050, text: 'BLACKWOOD', color: '#22c55e' },
    { x: 6400, y: 4850, text: 'CHANNEL 8', color: '#60a5fa' },
    { x: 980, y: 7050, text: 'MARROW POINT', color: '#e8b84a' },
    { x: 3520, y: 7050, text: 'SOUTHPORT', color: '#d4523a' },
    { x: 5850, y: 7050, text: 'VELVET COAST', color: '#e09a3e' }
    ,{ x: 8520, y: 1050, text: 'EASTGATE', color: '#e09a3e' }
    ,{ x: 8520, y: 4050, text: 'CINDER PARK', color: '#d4523a' }
    ,{ x: 8520, y: 7050, text: 'KINGSWAY', color: '#e8b84a' }
    ,{ x: 980, y: 10050, text: 'ALL SAINTS', color: '#9aa0a8' }
    ,{ x: 3520, y: 10050, text: 'ASHCROFT', color: '#d4523a' }
    ,{ x: 5850, y: 10050, text: 'NORTHSTAR', color: '#e09a3e' }
    ,{ x: 8520, y: 10050, text: 'KINGSPORT', color: '#e8b84a' }
  );

  // Diverse Traffic Roster (Sedans, Taxis, Vans)
  const carTypes = [
    { type: 'sedan', color: '#334155', w: 46, h: 22 },
    { type: 'taxi', color: '#eab308', w: 46, h: 22 },
    { type: 'sports', color: '#dc2626', w: 48, h: 23 },
    { type: 'coupe', color: '#2563eb', w: 44, h: 21 },
    { type: 'wagon', color: '#475569', w: 50, h: 23 },
    { type: 'black', color: '#0f172a', w: 46, h: 22 },
    { type: 'van', color: '#7c8287', w: 53, h: 25 },
    { type: 'truck', color: '#786c5d', w: 60, h: 26 }
  ];

  for (let i = 0; i < 12; i++) {
    const isEast = i % 2 === 0;
    const model = carTypes[i % carTypes.length];
    trafficCars.push({
      x: 500 + i * 360,
      y: isEast ? 1165 : 1205,
      angle: isEast ? 0 : Math.PI,
      speed: (isEast ? 1 : -1) * (2.0 + Math.random() * 0.5),
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
    trafficCars.push({
      x: 520 + i * 455,
      y: isEast ? 4165 : 4205,
      angle: isEast ? 0 : Math.PI,
      speed: (isEast ? 1 : -1) * (1.9 + Math.random() * 0.6),
      color: model.color, type: model.type, width: model.w, height: model.h,
      axis: 'x', minX: 450, maxX: 9350
    });
  }
  for (let i = 0; i < 10; i++) {
    const isEast = i % 2 === 0;
    const model = carTypes[(i + 4) % carTypes.length];
    trafficCars.push({
      x: 520 + i * 410, y: isEast ? 7165 : 7205,
      angle: isEast ? 0 : Math.PI,
      speed: (isEast ? 1 : -1) * (1.8 + Math.random() * 0.55),
      color: model.color, type: model.type, width: model.w, height: model.h,
      axis: 'x', minX: 450, maxX: 9350
    });
  }
  [1200, 3850, 6200].forEach((x, lane) => {
    for (let i = 0; i < 4; i++) {
      const isSouth = i % 2 === 0;
      const model = carTypes[(lane * 2 + i) % carTypes.length];
      trafficCars.push({
        x: x + (isSouth ? 32 : 88), y: 700 + i * 1050,
        angle: isSouth ? Math.PI / 2 : -Math.PI / 2,
        speed: (isSouth ? 1 : -1) * (1.6 + Math.random() * 0.5),
        color: model.color, type: model.type, width: model.w, height: model.h,
        axis: 'y', minY: 450, maxY: 5250
      });
    }
  });
  for (let i = 0; i < 12; i++) {
    const isEast = i % 2 === 0;
    const model = carTypes[(i + 1) % carTypes.length];
    trafficCars.push({
      x: 520 + i * 515, y: isEast ? 10165 : 10205,
      angle: isEast ? 0 : Math.PI,
      speed: (isEast ? 1 : -1) * (1.8 + Math.random() * 0.5),
      color: model.color, type: model.type, width: model.w, height: model.h,
      axis: 'x', minX: 450, maxX: 9350
    });
  }
  for (let i = 0; i < 6; i++) {
    const isSouth = i % 2 === 0;
    const model = carTypes[(i + 3) % carTypes.length];
    trafficCars.push({
      x: 8500 + (isSouth ? 32 : 88), y: 650 + i * 1320,
      angle: isSouth ? Math.PI / 2 : -Math.PI / 2,
      speed: (isSouth ? 1 : -1) * (1.65 + Math.random() * 0.45),
      color: model.color, type: model.type, width: model.w, height: model.h,
      axis: 'y', minY: 450, maxY: 11100
    });
  }

  // Traffic actors carry an explicit identity so lane followers are not
  // repeatedly pushed sideways by the generic collision solver. Keep the
  // opening junction clear for a fair first frame and deterministic autotest.
  for (let i = trafficCars.length - 1; i >= 0; i--) {
    const car = trafficCars[i];
    car.isTraffic = true; car.trafficId = `traffic-${i}`; car.waitingAtEdge = false;
    const horizontal=car.axis!=='y',cross=horizontal?'y':'x';
    const route=[...roads,...bridges].find(r=>r.dir===(horizontal?'h':'v')&&car.x>=r.x&&car.x<=r.x+r.w&&car.y>=r.y&&car.y<=r.y+r.h);
    if(route){car.laneCenter=horizontal?route.y+route.h/2:route.x+route.w/2;car.turnRadius=32;car[cross]=car.laneCenter-Math.sign(car.speed)*car.turnRadius;}
    if (Math.hypot(car.x - player.x, car.y - player.y) < 230) trafficCars.splice(i, 1);
  }

  // Stylish Pedestrians
  const pedStyles = [
    { shirt: '#825044', pants: '#1e293b', hair: '#78350f', skin: '#fcd34d', accessory:'cap' },
    { shirt: '#4c6373', pants: '#334155', hair: '#1c1917', skin: '#fed7aa', accessory:'backpack' },
    { shirt: '#566952', pants: '#0f172a', hair: '#d97706', skin: '#fcd34d', accessory:'scarf' },
    { shirt: '#9b7948', pants: '#1e293b', hair: '#451a03', skin: '#ffedd5', accessory:'satchel' },
    { shirt: '#73535b', pants: '#475569', hair: '#172554', skin: '#fed7aa', accessory:'hood' },
    { shirt: '#64748b', pants: '#090d16', hair: '#52525b', skin: '#fde047', accessory:'vest' },
    { shirt: '#a15b35', pants: '#28333a', hair: '#201712', skin: '#d8a77f', accessory:'beanie' },
    { shirt: '#426c5d', pants: '#3a302a', hair: '#7b4d2c', skin: '#e9c9a0', accessory:'coat' },
    { shirt: '#4b4d70', pants: '#252633', hair: '#19191d', skin: '#b77e5c', accessory:'shoulderBag' },
    { shirt: '#75624c', pants: '#394044', hair: '#cac2a5', skin: '#edcda8', accessory:'cap' },
    { shirt: '#984f54', pants: '#252d42', hair: '#271c22', skin: '#e4ad88', accessory:'scarf' },
    { shirt: '#576a80', pants: '#31372f', hair: '#38291e', skin: '#9d6849', accessory:'vest' }
  ];

  for (let i = 0; i < 28; i++) {
    const style = pedStyles[i % pedStyles.length];
    pedestrians.push({
      x: 480 + i * 230,
      y: 1120 + (i % 2 === 0 ? -16 : ROAD_W + 16),
      vx: (Math.random() - 0.5) * 0.9,
      vy: 0,
      shirt: style.shirt,
      pants: style.pants,
      hair: style.hair,
      skin: style.skin,
      accessory: style.accessory,
      walkPhase: Math.random() * Math.PI * 2,
      visualScale: .82 + (i % 5) * .035,
      fleeTimer: 0
    });
  }
  for (let i = 0; i < 24; i++) {
    const style = pedStyles[(i + 3) % pedStyles.length];
    pedestrians.push({
      x: 500 + i * 265,
      y: 4120 + (i % 2 === 0 ? -16 : ROAD_W + 16),
      vx: (Math.random() - 0.5) * 0.9, vy: 0,
      minX: 450, maxX: 9350,
      shirt: style.shirt, pants: style.pants, hair: style.hair, skin: style.skin, accessory:style.accessory,
      walkPhase: Math.random() * Math.PI * 2, visualScale: .82 + (i % 4) * .04, fleeTimer: 0
    });
  }
  for (let i = 0; i < 24; i++) {
    const style = pedStyles[(i + 2) % pedStyles.length];
    pedestrians.push({
      x: 500 + i * 265, y: 7120 + (i % 2 === 0 ? -16 : ROAD_W + 16),
      vx: (Math.random() - 0.5) * 0.85, vy: 0, minX: 450, maxX: 9350,
      shirt: style.shirt, pants: style.pants, hair: style.hair, skin: style.skin, accessory:style.accessory,
      walkPhase: Math.random() * Math.PI * 2, visualScale: .82 + (i % 6) * .03, fleeTimer: 0
    });
  }
  for (let i = 0; i < 32; i++) {
    const style = pedStyles[(i + 1) % pedStyles.length];
    pedestrians.push({
      x: 520 + i * 285, y: 10120 + (i % 2 === 0 ? -16 : ROAD_W + 16),
      vx: (Math.random() - 0.5) * 0.85, vy: 0, minX: 450, maxX: 9350,
      shirt: style.shirt, pants: style.pants, hair: style.hair, skin: style.skin,
      walkPhase: Math.random() * Math.PI * 2, visualScale: .82 + (i % 5) * .035, accessory:style.accessory, fleeTimer: 0
    });
  }
  billboards.forEach((b,i)=>b.color=['#d39b4e','#bd754d','#b6a880'][i%3]);
  roadEnds.push(...roadTerminals(roads,bridges,isPositionOnIslandLand));
  for(const island of [...islands,...islets])for(let n=0;n<(island.natural?7:districtProfiles[island.id].trees);n++){
    const x=island.natural?island.x+island.w*(.25+(n%3)*.22):island.x+island.w-150-(n%3)*28;
    const y=island.natural?island.y+island.h*(.25+Math.floor(n/3)*.21):island.y+240+Math.floor(n/3)*180;
    if(!isPositionOnIslandLand(x,y)||buildings.some(b=>x>b.x-35&&x<b.x+b.w+35&&y>b.y-35&&y<b.y+b.h+35))continue;
    if([[0,0],[38,0],[-38,0],[0,38],[0,-38]].some(([dx,dy])=>onRoadSurface(x+dx,y+dy,roads,bridges,scenicRoads,roadEnds)))continue;
    trees.push({x,y,size:17+n%4*3,shore:true});
  }
  buildServiceAccess();
  walkingRoutes=createWalkingRoutes(roads,parkZones,(x,y)=>!isPedestrianSceneryBlocked(x,y)&&
    !onRoadSurface(x,y,roads,bridges,[],roadEnds)&&!parkedCars.some(c=>pedestrianCarBlocked(x,y,c)));
  for(const route of walkingRoutes){const point=route.points[Math.floor(route.points.length/2)];route.districtId=districtAt(point.x,point.y)?.id;}
  for(const p of pedestrians){
    const district=districtAt(p.x,p.y)||islands.reduce((best,i)=>Math.hypot(p.x-i.x-i.w/2,p.y-i.y-i.h/2)<Math.hypot(p.x-best.x-best.w/2,p.y-best.y-best.h/2)?i:best,islands[0]);
    p.districtId=district.id;
  }
  for(const district of islands){
    const count=pedestrians.filter(p=>p.districtId===district.id).length;
    for(let n=count;n<districtProfiles[district.id].population;n++){
      const style=pedStyles[(pedestrians.length+n)%pedStyles.length];
      pedestrians.push({...style,districtId:district.id,x:district.x+district.w/2,y:district.y+1000,
        visualScale:.85+(n%4)*.035,walkPhase:0,fleeTimer:0});
    }
  }
  assignWalkingRoutes(pedestrians,walkingRoutes);
  roadGraph=createRoadGraph(roads,bridges,serviceBases.map(base=>base.origin));
  cityIncidentDirector=createCityIncidentDirector({nodes:roadGraph});
  incidentNoticeId=0;
  const busLines=[
    {id:'north-shore',stops:[[1200,1200],[2500,1200],[3850,1200],[4850,1200],[6200,1200],[7000,1200],[8500,1200],[8500,4200],[7000,4200],[6200,4200],[4850,4200],[3850,4200],[2500,4200],[1200,4200]]},
    {id:'south-link',stops:[[1200,7200],[2500,7200],[3850,7200],[4850,7200],[6200,7200],[7000,7200],[8500,7200],[8500,10200],[7000,10200],[6200,10200],[4850,10200],[3850,10200],[2500,10200],[1200,10200]]}
  ];
  for(const line of busLines){
    const route=planStopRoute(roadGraph,line.stops,{loop:true,id:line.id});
    if(route?.points.length>8){placeTransitStops(route);transitRoutes.push(route);}
  }
  transitRoutes.forEach((route,lineIndex)=>{
    for(let busIndex=0;busIndex<2;busIndex++){
      const points=route.points,total=points.length,origin=Math.floor(total*(busIndex?0.58:0.16));
      let start=-1;
      for(let offset=0;offset<total;offset++){
        const index=(origin+offset)%total,p=points[index];
        if(!trafficCars.some(c=>Math.hypot(c.x-p.x,c.y-p.y)<190)&&
          !parkedCars.some(c=>Math.hypot(c.x-p.x,c.y-p.y)<130)){start=index;break;}
      }
      if(start<0)continue;
      const point=points[start],next=points[(start+1)%total];
      trafficCars.push({x:point.x,y:point.y,angle:Math.atan2(next.y-point.y,next.x-point.x),speed:0,cruiseSpeed:1.12,
        color:lineIndex?'#b28a52':'#5b8f8a',type:'bus',width:82,height:30,mass:8200,axis:'x',isTraffic:true,
        trafficId:`bus-${lineIndex}-${busIndex}`,routeManaged:true,route,routeIndex:(start+1)%total,lastStopIndex:-1,routeWait:0});
    }
  });
  preparePedestrianRoutines();
}

function isPositionOnIslandLand(x, y) {
  for (let isl of allIslands) {
    if (pointInCoast(x, y, isl)) return true;
  }
  return false;
}

function isPositionOnSolidGround(x, y) {
  if(isPositionOnIslandLand(x,y)||allIslands.some(isl=>pointInBeach(x,y,isl,isl.natural?42:BEACH_WIDTH))||
    piers.some(p=>x>=p.x&&x<=p.x+p.w&&y>=p.y&&y<=p.y+p.h))return true;
  for (let br of bridges) {
    if (x >= br.x - 10 && x <= br.x + br.w + 10 && y >= br.y - 12 && y <= br.y + br.h + 12) return true;
  }
  return false;
}

function isPositionOnWaterObstacle(x,y){
  return isPositionOnIslandLand(x,y)||piers.some(p=>x>=p.x&&x<=p.x+p.w&&y>=p.y&&y<=p.y+p.h);
}

function surfaceAt(x,y){
  return classifySurface(x,y,{roads,bridges,scenicRoads,piers,parks:parkZones,
    landAt:isPositionOnIslandLand,beachAt:(px,py)=>allIslands.some(isl=>pointInBeach(px,py,isl,isl.natural?42:BEACH_WIDTH))});
}

function drawTransitStops(){
  const placed=new Set();
  for(const {x,y} of transitStopSigns()){
    const key=`${Math.round(x)}:${Math.round(y)}`;
    if(placed.has(key)||Math.abs(x-player.x)>2200||Math.abs(y-player.y)>2200)continue;
    placed.add(key);
    ctx.strokeStyle='#343a39';ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(x,y+15);ctx.lineTo(x,y-12);ctx.stroke();
    ctx.fillStyle='#d5a54e';ctx.fillRect(x-7,y-14,14,12);ctx.strokeStyle='#20201b';ctx.lineWidth=1;ctx.strokeRect(x-7,y-14,14,12);
    ctx.fillStyle='#171a1b';ctx.font='bold 7px monospace';ctx.textAlign='center';ctx.fillText('BUS',x,y-6);
    ctx.fillStyle='rgba(22,27,27,.7)';ctx.fillRect(x-12,y+5,24,3);
  }
}

function placeTransitStops(route){
  const original=route.points,points=[],stopIndices=[],inserts=new Map();
  const junctions=buildRoadPaintGeometry().junctions.filter(j=>j.horizontalRoads.some(r=>!r.serviceAccess)&&j.verticalRoads.some(r=>!r.serviceAccess));
  for(const requested of route.stopIndices){
    // Graph edges can be split into short pieces by driveways. Walk the full
    // outgoing path before choosing a stop, rather than dropping those stops.
    const offsets=Array.from({length:11},(_,i)=>160+i*32);
    for(const offset of [...offsets,...offsets.map(n=>-n)]){
      const backwards=offset<0;
      let remaining=Math.abs(offset),segment=backwards?(requested-1+original.length)%original.length:requested,point;
      for(let step=0;step<original.length;step++){
        const a=original[segment],b=original[(segment+1)%original.length],length=Math.hypot(b.x-a.x,b.y-a.y);
        if(length&&remaining<=length){
          const ratio=backwards?1-remaining/length:remaining/length;
          point={x:a.x+(b.x-a.x)*ratio,y:a.y+(b.y-a.y)*ratio,
            angle:Math.atan2(b.y-a.y,b.x-a.x),ratio};break;
        }
        remaining-=length;segment=(segment+(backwards?-1:1)+original.length)%original.length;
      }
      if(!point||point.ratio<.001||point.ratio>.999||!policeFootprintOnRoad({...point,width:82,height:30})||
        junctions.some(j=>point.x>j.x-60&&point.x<j.x+j.w+60&&point.y>j.y-60&&point.y<j.y+j.h+60))continue;
      if(![-1,1].some(side=>{
        const x=point.x-Math.sin(point.angle)*72*side,y=point.y+Math.cos(point.angle)*72*side;
        return !isPedestrianSceneryBlocked(x,y)&&!onRoadSurface(x,y,roads,bridges,scenicRoads,roadEnds);
      }))continue;
      const entries=inserts.get(segment)||[];
      if(!entries.some(p=>Math.hypot(p.x-point.x,p.y-point.y)<70))entries.push(point);
      inserts.set(segment,entries);break;
    }
  }
  for(let i=0;i<original.length;i++){
    points.push(original[i]);
    for(const point of (inserts.get(i)||[]).sort((a,b)=>a.ratio-b.ratio)){
      points.push({x:point.x,y:point.y});stopIndices.push(points.length-1);
    }
  }
  route.points=points;route.stopIndices=stopIndices;route.stopPoints=stopIndices.map(i=>points[i]);route.stopCount=stopIndices.length;
}

function transitStopSigns(){
  return transitRoutes.flatMap(route=>route.stopIndices.flatMap((index,stopOrder)=>{
    const point=route.points[index],next=route.points[(index+1)%route.points.length];
    const dx=next.x-point.x,dy=next.y-point.y,length=Math.hypot(dx,dy)||1;
    for(const side of [stopOrder%2?-1:1,stopOrder%2?1:-1]){
      const x=point.x-dy/length*72*side,y=point.y+dx/length*72*side;
      if(!isPedestrianSceneryBlocked(x,y)&&!onRoadSurface(x,y,roads,bridges,scenicRoads,roadEnds))return [{x,y,line:route.id}];
    }
    return [];
  }));
}

function pedestrianCarBlocked(x,y,c){
  const dx=x-c.x,dy=y-c.y,cs=Math.cos(c.angle||0),sn=Math.sin(c.angle||0);
  return Math.abs(dx*cs+dy*sn)<(c.width||48)/2+5&&Math.abs(-dx*sn+dy*cs)<(c.height||24)/2+5;
}

function isPedestrianSceneryBlocked(x,y){
  if(!isPositionOnSolidGround(x,y))return true;
  if(buildings.some(b=>x>b.x-7&&x<b.x+b.w+7&&y>b.y-7&&y<b.y+b.h+7))return true;
  if(solidProps.some(o=>Math.abs(x-o.x)<o.width*.5+5&&Math.abs(y-o.y)<o.height*.5+5))return true;
  if(trees.some(t=>Math.hypot(x-t.x,y-t.y)<11))return true;
  return false;
}

function isPedestrianBlocked(x,y){
  if(isPedestrianSceneryBlocked(x,y))return true;
  return parkedCars.some(c=>pedestrianCarBlocked(x,y,c)) ||
    (roam?.fleet||[]).some(c=>c.kind!=='water'&&pedestrianCarBlocked(x,y,c)) ||
    trafficCars.some(c=>pedestrianCarBlocked(x,y,c)) || policeCars.some(c=>pedestrianCarBlocked(x,y,c)) ||
    incidentPoliceCars.some(c=>pedestrianCarBlocked(x,y,c)) || incidentResponseVehicles.some(c=>pedestrianCarBlocked(x,y,c)) ||
    (roam?.mode!=='foot'&&!(roam?.altitude>12)&&pedestrianCarBlocked(x,y,player));
}

function movePedestrian(p,dx,dy){
  if(Math.hypot(dx,dy)<.001)return false;
  const attempts=[[dx,dy],[dx,0],[0,dy],[-dy*.75,dx*.75],[dy*.75,-dx*.75]];
  for(const [mx,my] of attempts){
    const distance=Math.hypot(mx,my);
    if(distance<.001)continue;
    const steps=Math.ceil(distance/2);
    let clear=true;
    for(let i=1;i<=steps;i++){
      const x=p.x+mx*i/steps,y=p.y+my*i/steps;
      if(isPedestrianBlocked(x,y)||(p.route&&onRoadSurface(x,y,roads,bridges,[],roadEnds))){clear=false;break;}
    }
    if(!clear)continue;
    p.x+=mx;p.y+=my;
    p.heading=Math.atan2(my,mx);
    p.walkPhase=(p.walkPhase||0)+distance*.23;
    p.movedDistance=(p.movedDistance||0)+distance;
    return true;
  }
  return false;
}

function preparePedestrianRoutines(){
  const stops=transitStopSigns();
  pedestrians.forEach((person,index)=>{
    if(!person.route)return;
    person.purpose=['strolling','commuting','errands','workBreak'][index%4];
    person.walkSpeed=.38+index%7*.035;person.routineCooldown=3+index%9;
    person.dailyStops=[.24,.72].map((ratio,stopIndex)=>{
      const point=person.route.points[Math.min(person.route.points.length-1,Math.floor(person.route.points.length*ratio))];
      const nearby=buildings.filter(b=>Math.hypot(b.x+b.w/2-point.x,b.y+b.h-point.y)<300);
      let activity=person.route.kind==='park'?(index%8===0?'reading':'resting'):'looking';
      if(person.route.kind!=='park'){
        if(nearby.some(b=>/cafe|diner|coffee/i.test(b.sign||'')))activity='coffee';
        else if(nearby.some(b=>/shop|market|store|news|bakery/i.test(b.sign||'')))activity='shopping';
        if(stopIndex===1&&stops.some(stop=>Math.hypot(stop.x-point.x,stop.y-point.y)<55))activity='checkingTimetable';
      }
      return {...point,activity};
    });
  });
}

function updatePedestrians(dt){
  const frame=Math.min(dt,.05)*60;
  const cars=[...trafficCars,...policeCars,...incidentPoliceCars,...incidentResponseVehicles,...(roam?.mode!=='foot'&&!(roam?.altitude>12)?[player]:[])];
  pedestrians.forEach((p,index)=>{
    if(p.homeY===undefined){p.homeY=p.y;p.homeX=p.x;p.pause=index%7*.18;p.trip=0;}
    p.movedDistance=0;
    p.pause=Math.max(0,p.pause-dt);
    const panicking=p.reaction==='fleeing'||p.fleeTimer>0||p.eventFleeTimer>0;
    p.routineCooldown=Math.max(0,(p.routineCooldown||0)-dt);
    p.socialCooldown=Math.max(0,(p.socialCooldown??(8+index%17*2))-dt);
    if(panicking){p.activity=null;p.activityRemaining=0;p.conversationPartner=null;}
    else if((p.activityRemaining||0)>0){
      p.activityRemaining=Math.max(0,p.activityRemaining-dt);p.pause=Math.max(p.pause,p.activityRemaining);
      if(p.conversationPartner){
        const other=p.conversationPartner;
        if(other.reaction==='fleeing'||Math.hypot(other.x-p.x,other.y-p.y)>46){p.activityRemaining=0;p.pause=0;p.conversationPartner=null;}
        else p.heading=Math.atan2(other.y-p.y,other.x-p.x);
      }
      if(!p.activityRemaining){p.activity=null;p.conversationPartner=null;}
    }
    if(!panicking&&!p.pause&&!p.activityRemaining&&!p.routineCooldown&&p.dailyStops){
      const stop=p.dailyStops.find(s=>Math.hypot(s.x-p.x,s.y-p.y)<10);
      if(stop){p.activity=stop.activity;p.activityRemaining=1.7+(index%4)*.2;p.pause=p.activityRemaining;p.routineCooldown=22+index%11;}
    }
    if(!panicking&&!p.pause&&!p.activityRemaining&&p.socialCooldown===0){
      const other=pedestrians.find(o=>o!==p&&o.districtId===p.districtId&&o.reaction==='calm'&&
        !o.pause&&!o.activityRemaining&&o.socialCooldown<12&&Math.hypot(o.x-p.x,o.y-p.y)>18&&Math.hypot(o.x-p.x,o.y-p.y)<42);
      p.socialCooldown=24+index%13;
      if(other)for(const person of [p,other]){
        person.activity='talking';person.activityRemaining=2.2;person.pause=2.2;person.socialCooldown=35;
        person.conversationPartner=person===p?other:p;
      }
    }
    if(p.reaction==='calm'&&!p.pause&&!p.activityRemaining){
      p.activityTimer=(p.activityTimer??(5+index%11))-dt;
      if(p.activityTimer<=0){p.pause=1.4+(index%4)*.35;p.activity=index%3===0?'checkingPhone':p.route?.kind==='park'?'resting':'looking';p.activityTimer=9+index%13;}
      else p.activity=null;
    }else if(p.reaction!=='calm')p.activity=null;
    // React to the approach of traffic, rather than shoving a person on contact.
    const threat=cars.find(c=>Math.abs(c.speed||0)>1.5&&Math.hypot(c.x-p.x,c.y-p.y)<90&&
      Math.abs(-(p.x-c.x)*Math.sin(c.angle)+(p.y-c.y)*Math.cos(c.angle))<(c.height||24)/2+15&&
      ((p.x-c.x)*Math.cos(c.angle)+(p.y-c.y)*Math.sin(c.angle))*(c.isTraffic?Math.abs(c.speed||0):(c.speed||0))>0);
    if(threat){
      const distance=Math.hypot(p.x-threat.x,p.y-threat.y)||1;
      p.fleeX=(p.x-threat.x)/distance;p.fleeY=(p.y-threat.y)/distance;
    }
    if(threat){p.reaction='fleeing';p.activity=null;p.activityRemaining=0;p.conversationPartner=null;}
    p.fleeTimer=threat ? .8 : Math.max(0,(p.fleeTimer||0)-dt);
    let dx=0,dy=0;
    if(p.fleeTimer>0||(p.eventFleeTimer||0)>0){
      p.reaction='fleeing';
      const eventPanic=(p.eventFleeTimer||0)>0&&!threat;
      const fleeX=eventPanic?(p.eventFleeX||0):(p.fleeX||0);
      const fleeY=eventPanic?(p.eventFleeY||0):(p.fleeY||0);
      const pace=eventPanic?1.9:1.3;
      dx=fleeX*pace*frame;dy=fleeY*pace*frame;
    }else if(!p.pause){
      if(p.wasFleeing&&p.route){
        p.routeIndex=p.route.points.reduce((best,point,i)=>Math.hypot(point.x-p.x,point.y-p.y)<
          Math.hypot(p.route.points[best].x-p.x,p.route.points[best].y-p.y)?i:best,0);
        p.goal=p.route.points[p.routeIndex];
      }
      if(!p.goal||Math.hypot(p.goal.x-p.x,p.goal.y-p.y)<9){
        if(p.route){p.goal=nextWalkingGoal(p);}
        else {
        p.trip++;
        const direction=p.trip%2?1:-1;
        const gx=Math.max(p.minX??450,Math.min(p.maxX??9350,p.homeX+direction*(45+index%5*19)));
        const gy=p.homeY+(p.trip%3-1)*12;
        p.goal={x:gx,y:gy};
        p.pause=.5+(index%4)*.3;
        }
      }else{
        const distance=Math.hypot(p.goal.x-p.x,p.goal.y-p.y);
        const curiosity=p.reaction==='curious'?.48:1;
        const speed=(p.walkSpeed??(.42+index%5*.045))*frame*curiosity;
        dx=(p.goal.x-p.x)/distance*speed;dy=(p.goal.y-p.y)/distance*speed;
        const neighbor=pedestrians.find(o=>o!==p&&Math.hypot(o.x-p.x,o.y-p.y)<15);
        if(neighbor){const d=Math.hypot(p.x-neighbor.x,p.y-neighbor.y)||1;dx+=(p.x-neighbor.x)/d*.3*frame;dy+=(p.y-neighbor.y)/d*.3*frame;}
      }
    }
    const goalDistance=p.goal?Math.hypot(p.goal.x-p.x,p.goal.y-p.y):Infinity;
    if((dx||dy)&&!movePedestrian(p,dx,dy)){
      p.pause=.2;p.blockedTimer=(p.blockedTimer||0)+.2;
    }else if(p.movedDistance>0){
      const closer=p.goal&&Math.hypot(p.goal.x-p.x,p.goal.y-p.y)<goalDistance-.01;
      p.blockedTimer=p.route&&!closer&&!p.fleeTimer&&!p.eventFleeTimer?(p.blockedTimer||0)+dt:0;
    }
    if(p.route&&p.blockedTimer>1){
      // A sideways shuffle is not progress toward the destination.
      p.routeDirection*=-1;p.goal=nextWalkingGoal(p);p.blockedTimer=0;p.pause=.2;
    }
    if(p.fleeTimer>0||p.eventFleeTimer>0)p.wasFleeing=true;
    else if(!p.pause)p.wasFleeing=false;
    if(p.reaction==='curious'&&p.lookAt)p.heading=Math.atan2(p.lookAt.y-p.y,p.lookAt.x-p.x);
    p.gait=Math.min(1,p.movedDistance/Math.max(.01,frame*.42));
    if(p.gait===0)p.walkPhase=0;
    if(roam?.mode!=='foot'&&!(roam?.altitude>12)&&Math.abs(player.speed)>2&&pedestrianCarBlocked(p.x,p.y,player)&&!p.hitCooldown){
      if(state.wanted<3)raiseWantedFromCrime(3,1.25);
      showToast('🚨 НАЕЗД НА ПЕШЕХОДА!');p.hitCooldown=2;
    }
    p.hitCooldown=Math.max(0,(p.hitCooldown||0)-dt);
  });
}

function buildServiceAccess(){
  for(const building of buildings){
    const kind=/police\s+(precinct|station)/i.test(building.sign||'')?'police':building.civicType;
    if(!['police','hospital','firestation','guardBase'].includes(kind)||!building.serviceParcel)continue;
    const parcel=building.serviceParcel;
    let choice;
    for(const ratio of [.84,.88,.80]){
      const origin={x:parcel.x+parcel.w*.82,y:parcel.y+parcel.h*ratio};
      const candidates=roads.filter(r=>!r.serviceAccess&&!r.bridgeApproach&&r.dir==='v'&&origin.y>=r.y+48&&origin.y<=r.y+r.h-48)
        .map(r=>({x:r.x+r.w/2,y:origin.y})).filter(p=>p.x>origin.x&&p.x-origin.x<650)
        .sort((a,b)=>a.x-b.x);
      for(const entry of candidates){
        const driveway={x:origin.x-48,y:origin.y-48,w:entry.x-origin.x+96,h:96,dir:'h',serviceAccess:true,name:building.sign};
        let clear=true;
        for(let x=driveway.x;x<=driveway.x+driveway.w&&clear;x+=8)for(const y of [driveway.y,origin.y,driveway.y+96]){
          if(isPedestrianSceneryBlocked(x,y)){clear=false;break;}
        }
        if(!clear||parkedCars.some(c=>c.x>=driveway.x-35&&c.x<=driveway.x+driveway.w+35&&Math.abs(c.y-origin.y)<65))continue;
        choice={building,kind,origin,entry,driveway};break;
      }
      if(choice)break;
    }
    if(choice){serviceBases.push(choice);roads.push(choice.driveway);}
  }
}

function advanceServiceRoute(unit,dt){
  const frame=Math.min(Math.max(Number(dt)||0,0),.05)*60;
  if(!frame||!unit.route?.length)return;
  const passing=unit.emergencyManeuver;
  if(passing?.points.length&&passing.lastBlockerPosition){
    const along=(passing.blocker.x-passing.lastBlockerPosition.x)*Math.cos(passing.angle)+
      (passing.blocker.y-passing.lastBlockerPosition.y)*Math.sin(passing.angle);
    // Keep the merge point beyond a moving car instead of returning to its lane
    // using the position at which the initial maneuver was planned.
    const shift=Math.max(0,Math.min(along,passing.remainingAdvance));
    if(shift>0&&emergencyPassingActors(unit).includes(passing.blocker)){
      for(const point of passing.points.slice(Math.max(0,passing.points.length-2))){
        point.x+=Math.cos(passing.angle)*shift;point.y+=Math.sin(passing.angle)*shift;
      }
      passing.remainingAdvance-=shift;
    }
    passing.lastBlockerPosition={x:passing.blocker.x,y:passing.blocker.y};
  }
  const path=unit.emergencyManeuver?.points||unit.route;
  const maneuver=!!unit.emergencyManeuver;
  while(path.length>(maneuver?0:1)&&Math.hypot(path[0].x-unit.x,path[0].y-unit.y)<(maneuver?4:12)){
    if(path.shift().reverse)unit.speed=0;
  }
  if(maneuver&&!path.length){unit.emergencyManeuver=null;unit.emergencyBlocked=false;unit.emergencyPassCheck=0;return;}
  const target=path[0],distance=Math.hypot(target.x-unit.x,target.y-unit.y);
  const wanted=Math.atan2(target.y-unit.y,target.x-unit.x)+(target.reverse?Math.PI:0);
  const diff=Math.atan2(Math.sin(wanted-unit.angle),Math.cos(wanted-unit.angle));
  const old={x:unit.x,y:unit.y,angle:unit.angle};
  unit.angle+=Math.sign(diff)*Math.min(Math.abs(diff),.105*frame);
  const desired=unit.emergencyBlocked||Math.abs(diff)>.35?0:
    (target.reverse?-Math.min(2,unit.maxSpeed):unit.maxSpeed)*Math.min(1,distance/50);
  unit.speed+=(desired-unit.speed)*(1-Math.pow(1-(unit.model==='fireEngine'?.075:.12),frame));
  const step=Math.min(distance,Math.abs(unit.speed)*frame)*Math.sign(unit.speed);
  unit.x+=Math.cos(unit.angle)*step;unit.y+=Math.sin(unit.angle)*step;
  if(!serviceFootprintSupported(unit)||(unit.priorityPassing!==false&&!emergencyPassingPoseClear(unit,unit))){
    unit.x=old.x;unit.y=old.y;unit.speed=0;
    if(!serviceFootprintSupported(unit)||(unit.priorityPassing!==false&&!emergencyPassingPoseClear(unit,unit)))unit.angle=old.angle;
    if(maneuver){
      unit.emergencyStalled=(unit.emergencyStalled||0)+dt;
      if(unit.emergencyStalled>1&&policeFootprintOnRoad(unit)){unit.emergencyManeuver=null;unit.emergencyPassCheck=0;unit.emergencyStalled=0;}
    }
  }else{
    unit.emergencyStalled=0;
  }
}

function emergencyPassingActors(unit){
  const groundFleet=(roam?.fleet||[]).filter(actor=>actor.kind!=='water');
  const playerIsAirborne=(roam?.altitude||0)>12;
  const actors=[...trafficCars,...parkedCars,...policeCars,...incidentPoliceCars,
    ...incidentResponseVehicles,...groundFleet,...(!playerIsAirborne&&roam?.mode!=='foot'&&!unit.role?[player]:[])];
  return [...new Set(actors)].filter(actor=>actor&&actor!==unit);
}

function emergencyPassingGroundClear(pose){
  const cs=Math.cos(pose.angle||0),sn=Math.sin(pose.angle||0),hl=(pose.width||48)/2,hw=(pose.height||24)/2;
  if(!policeFootprintOnRoad(pose)&&![[0,0],[hl,hw],[hl,-hw],[-hl,hw],[-hl,-hw]].every(([x,y])=>
    isPositionOnSolidGround(pose.x+x*cs-y*sn,pose.y+x*sn+y*cs)))return false;
  const body=chassis(pose);
  const radius=Math.hypot(hl,hw);
  const near=(x,y,w,h)=>Math.abs(pose.x-x)<=w/2+radius&&Math.abs(pose.y-y)<=h/2+radius;
  const overlaps=rect=>{
    const width=rect.w||rect.width||12,height=rect.h||rect.height||12,x=rect.x+width/2,y=rect.y+height/2;
    return near(x,y,width,height)&&contact(body,chassis({x,y,width,height,angle:rect.angle||0}));
  };
  if(buildings.some(building=>overlaps(building)))return false;
  if(trees.some(tree=>near(tree.x,tree.y,20,20)&&contact(body,chassis({x:tree.x,y:tree.y,width:20,height:20}))))return false;
  if(solidProps.some(prop=>{
    const width=prop.width||12,height=prop.height||12,bounds=Math.hypot(width,height);
    return near(prop.x,prop.y,bounds,bounds)&&contact(body,chassis({x:prop.x,y:prop.y,width,height,angle:prop.angle||0}));
  }))return false;
  if(bridgeRails.some(rail=>overlaps(rail)))return false;
  return true;
}

function serviceFootprintSupported(unit){
  return policeFootprintOnRoad(unit)||(!!unit.emergencyManeuver&&emergencyPassingGroundClear(unit));
}

function emergencyPassingPoseClear(pose,unit=pose){
  if(!emergencyPassingGroundClear(pose))return false;
  const body=chassis(pose);
  const halfLength=(pose.width||48)/2,halfWidth=(pose.height||24)/2;
  const near=(x,y,width,height)=>Math.abs(pose.x-x)<=halfLength+width/2+12&&
    Math.abs(pose.y-y)<=halfWidth+height/2+12;
  for(const person of pedestrians){
    if(near(person.x,person.y,18,18)&&contact(body,chassis({x:person.x,y:person.y,width:18,height:18,angle:person.angle||0})))return false;
  }
  if(roam?.mode==='foot'&&near(player.x,player.y,18,18)&&
    contact(body,chassis({x:player.x,y:player.y,width:18,height:18,angle:player.angle||0})))return false;
  const actorClear=actor=>{
    if(!actor||actor===unit)return true;
    const width=(actor.width||48)+8,height=(actor.height||24)+8;
    return !near(actor.x,actor.y,width,height)||!contact(body,chassis({...actor,width,height}));
  };
  for(const list of [trafficCars,parkedCars,policeCars,incidentPoliceCars,incidentResponseVehicles]){
    for(const actor of list)if(!actorClear(actor))return false;
  }
  for(const actor of roam?.fleet||[]){
    if(actor.kind!=='air'&&actor.kind!=='water'&&!actorClear(actor))return false;
  }
  const playerIsAirborne=(roam?.altitude||0)>12;
  if(!playerIsAirborne&&roam?.mode!=='foot'&&!unit.role&&!actorClear(player))return false;
  return true;
}

function tryPlanEmergencyPassing(unit,dt){
  if(!['enroute','returning'].includes(unit.status)||unit.priorityPassing===false){
    unit.emergencyBlocked=false;
    return;
  }
  if(unit.emergencyManeuver?.points?.length)return;
  unit.emergencyPassCheck=Math.max(0,(unit.emergencyPassCheck||0)-dt);
  if(unit.emergencyPassCheck>0)return;
  unit.emergencyPassCheck=.25;
  const next=unit.route?.[0];
  if(next&&Math.abs(Math.atan2(Math.sin(Math.atan2(next.y-unit.y,next.x-unit.x)-unit.angle),
    Math.cos(Math.atan2(next.y-unit.y,next.x-unit.x)-unit.angle)))>.32){
    unit.emergencyBlocked=false;
    return;
  }
  const plan=planEmergencyPassingManeuver(unit,emergencyPassingActors(unit),{
    canOccupy:pose=>emergencyPassingPoseClear(Math.hypot(pose.x-unit.x,pose.y-unit.y)<10?pose:
      {...pose,width:(pose.width||48)+10,height:(pose.height||24)+10},unit),
    lookAhead:Math.min(260,next?Math.hypot(next.x-unit.x,next.y-unit.y)-10:260),
    maxForward:next?Math.hypot(next.x-unit.x,next.y-unit.y)-15:Infinity
  });
  unit.emergencyBlocked=!!plan&&!plan.points.length;
  if(!plan?.points.length)return;
  unit.emergencyManeuver=plan;
  unit.emergencyPasses=(unit.emergencyPasses||0)+1;
  unit.emergencyBlocked=false;
}

function dispatchIncidentPolice(incident){
  if(!incident||incident.policeDispatched||!roadGraph.length)return false;
  const target=nearestResponseRoadNode(incident);
  const candidates=serviceBases.filter(base=>base.kind==='police').map(base=>({base,node:base.origin,distance:Math.hypot(base.origin.x-target.x,base.origin.y-target.y)}))
    .sort((a,b)=>a.distance-b.distance);
  if(!candidates.length)return false;
  const supportedCandidates=candidates.flatMap(({node,base})=>{
    const route=roadPath(roadGraph,node,target);
    if(route.length<2)return [];
    const angle=Math.atan2(route[1].y-route[0].y,route[1].x-route[0].x),cs=Math.cos(angle),sn=Math.sin(angle);
    const supported=[[24,12],[24,-12],[-24,12],[-24,-12]].every(([x,y])=>
      onRoadSurface(node.x+x*cs-y*sn,node.y+x*sn+y*cs,roads,bridges,scenicRoads,roadEnds));
    return supported?[{node,route,base}]:[];
  });
  if(!supportedCandidates.length)return false;
  const {node:start,route,base}=supportedCandidates[0];
  incidentPoliceCars.push({
    x:start.x,y:start.y,angle:Math.atan2(route[1].y-route[0].y,route[1].x-route[0].x),
    speed:0,maxSpeed:5.6,width:48,height:24,model:'police',route:route.slice(1),routeTimer:1,responseTarget:{x:target.x,y:target.y},
    baseTarget:{...base.origin},responseBase:base.building.sign,status:'enroute',
    responseIncidentId:incident.id,strobePhase:0,arrived:false,arrivalTimer:0
  });
  incident.policeDispatched=true;
  incident.timer=Math.max(incident.timer,responseRouteLength(route)/(5.6*60)*1.65+12);
  return true;
}

function updateIncidentPolice(dt){
  const frame=Math.min(Math.max(dt,0),.05)*60;
  for(let i=incidentPoliceCars.length-1;i>=0;i--){
    const unit=incidentPoliceCars[i];
    unit.strobePhase=(unit.strobePhase||0)+dt*12;
    if(unit.arrived){
      unit.arrivalTimer-=dt;
      if(unit.arrivalTimer<=0){unit.arrived=false;beginIncidentResponseReturn(unit);}
      continue;
    }
    const responseDistance=Math.hypot(unit.responseTarget.x-unit.x,unit.responseTarget.y-unit.y);
    if(responseDistance<18&&!unit.emergencyManeuver&&!unit.emergencyBlocked){
      if(unit.status==='returning'){unit.returnedToBase=true;incidentPoliceCars.splice(i,1);continue;}
      unit.emergencyManeuver=null;unit.emergencyBlocked=false;
      unit.arrived=true;unit.status='onscene';unit.arrivalTimer=8;unit.speed=0;continue;
    }
    if(!unit.route?.length)unit.route=roadPath(roadGraph,unit,unit.responseTarget);
    tryPlanEmergencyPassing(unit,dt);
    advanceServiceRoute(unit,dt);
  }
}

function nearestRoadNode(point){
  return roadGraph.reduce((best,node)=>Math.hypot(node.x-point.x,node.y-point.y)<Math.hypot(best.x-point.x,best.y-point.y)?node:best,roadGraph[0]);
}

function nearestResponseRoadNode(point){
  // End nodes can support a point while leaving the nose of a truck over water.
  const supported=roadGraph.filter(node=>[0,Math.PI/2].every(angle=>
    policeFootprintOnRoad({...node,width:72,height:34,angle})));
  return supported.reduce((best,node)=>Math.hypot(node.x-point.x,node.y-point.y)<Math.hypot(best.x-point.x,best.y-point.y)?node:best,
    supported[0]||nearestRoadNode(point));
}

function responseRouteLength(route){
  let length=0;
  for(let i=1;i<route.length;i++)length+=Math.hypot(route[i].x-route[i-1].x,route[i].y-route[i-1].y);
  return length;
}

function dispatchIncidentResponse(incident){
  if(!incident||incident.responseDispatched||incident.responseDispatchAttempted||!roadGraph.length)return 0;
  const services=incident.kind==='fire'?['fireEngine','ambulance']:
    ['crash','fight','killing'].includes(incident.kind)?['ambulance']:[];
  incident.responseDispatchAttempted=true;
  if(!services.length)return 0;
  const target=nearestResponseRoadNode(incident);
  const dispatchedServices=[];
  for(const serviceType of services){
    const civicType=serviceType==='fireEngine'?'firestation':'hospital';
    const bases=serviceBases.filter(base=>base.kind===civicType)
      .map(base=>({...base.origin,building:base.building}))
      .sort((a,b)=>Math.hypot(a.x-incident.x,a.y-incident.y)-Math.hypot(b.x-incident.x,b.y-incident.y));
    const candidates=[];
    for(const base of bases.slice(0,5)){
      const start=nearestRoadNode(base);
      const route=roadPath(roadGraph,start,target);
      if(route.length<2||!route.every(node=>onRoadSurface(node.x,node.y,roads,bridges,scenicRoads,roadEnds)))continue;
      candidates.push({base,start,route,distance:responseRouteLength(route)});
    }
    candidates.sort((a,b)=>a.distance-b.distance);
    const choice=candidates[0];
    if(!choice)continue;
    const fireEngine=serviceType==='fireEngine';
    const next=choice.route[1];
    incidentResponseVehicles.push({
      x:choice.start.x,y:choice.start.y,angle:Math.atan2(next.y-choice.start.y,next.x-choice.start.x),
      speed:0,maxSpeed:fireEngine?4.35:5.9,width:fireEngine?72:54,height:fireEngine?34:27,
      mass:fireEngine?8400:3300,model:serviceType,color:fireEngine?'#bd3e30':'#dedbd1',
      route:choice.route.slice(1),routeTimer:0,responseTarget:{x:target.x,y:target.y},
      baseTarget:{x:choice.start.x,y:choice.start.y},responseBase:choice.base.building.sign,responseIncidentId:incident.id,
      status:'enroute',sceneTimer:fireEngine?4.8:4.1,strobePhase:Math.random()*Math.PI*2
    });
    dispatchedServices.push(serviceType);
    // A scene must remain present long enough for responders to reach it.
    const arrivalSeconds=choice.distance/((fireEngine?4.35:5.9)*60)*1.65+14;
    incident.timer=Math.max(incident.timer,arrivalSeconds);
  }
  if(dispatchedServices.length){incident.responseDispatched=true;incident.respondingServices=dispatchedServices;}
  return dispatchedServices.length;
}

function applyMedicalResponse(incident,provider='ambulance'){
  if(!incident)return;
  incident.medicalTreated=true;
  incident.medicalOutcome='checked';
  incident.medicalProvider??=provider;
  for(const actor of incident.actors||[]){
    if(actor.stance==='down'||['victim','injured','evacuee','defender'].includes(actor.role)){
      actor.medicalTreated=true;
      if(actor.stance==='down')actor.stance='assisted';
      actor.reaction='calm';
    }
  }
}

function airMedicalBases(){
  return buildings.filter(b=>b.civicType==='airAmbulanceBase').map(building=>({
    building,x:building.x+building.w/2,y:building.y+building.h/2,
    altitude:(building.floors??2)*24+12
  }));
}

function dispatchAirMedicalResponse(incident){
  if(!incident||incident.airMedicalDispatched||incident.medicalTreated||
    !incident.actors?.some(actor=>actor.stance==='down'))return false;
  const ambulance=incidentResponseVehicles.find(unit=>unit.responseIncidentId===incident.id&&unit.model==='ambulance');
  // Reserve the aircraft for injuries with a long or unavailable road response.
  const roadDistance=ambulance?responseRouteLength([{x:ambulance.x,y:ambulance.y},...ambulance.route]):Infinity;
  if(roadDistance<=2600)return false;
  const bases=airMedicalBases().filter(base=>!airMedicalVehicles.some(unit=>unit.responseBase===base.building.sign));
  bases.sort((a,b)=>Math.hypot(a.x-incident.x,a.y-incident.y)-Math.hypot(b.x-incident.x,b.y-incident.y));
  const base=bases[0];
  if(!base)return false;
  const cruiseAltitude=Math.max(220,...buildings.map(b=>(b.floors??5)*24+72));
  const hoverAltitude=Math.max(50,...buildings.filter(b=>Math.abs(b.x+b.w/2-incident.x)<b.w/2+90&&
    Math.abs(b.y+b.h/2-incident.y)<b.h/2+90).map(b=>(b.floors??5)*24+50));
  const flightSeconds=(cruiseAltitude-base.altitude)/70+Math.hypot(base.x-incident.x,base.y-incident.y)/480+
    (cruiseAltitude-hoverAltitude)/50+6;
  if(ambulance&&flightSeconds+5>=roadDistance/(ambulance.maxSpeed*60)+4.1)return false;
  airMedicalVehicles.push({x:base.x,y:base.y,angle:0,speed:0,width:64,height:26,
    type:'helicopter',kind:'air',color:'#e5e4d9',medical:true,altitude:base.altitude,
    cruiseAltitude,hoverAltitude,baseTarget:{x:base.x,y:base.y,altitude:base.altitude},
    responseTarget:{x:incident.x,y:incident.y},responseBase:base.building.sign,
    responseIncidentId:incident.id,status:'takingOff',sceneTimer:5});
  incident.airMedicalDispatched=true;incident.airMedicalResponse='enroute';
  incident.timer=Math.max(incident.timer,flightSeconds+15);
  return true;
}

function updateAirMedicalResponse(dt){
  const step=Math.min(.05,Math.max(0,Number(dt)||0));
  if(!step)return;
  const active=cityIncidentDirector?.current();
  for(let i=airMedicalVehicles.length-1;i>=0;i--){
    const unit=airMedicalVehicles[i];
    const incident=active?.id===unit.responseIncidentId?active:null;
    if(['takingOff','enroute','descending','onscene'].includes(unit.status)&&(!incident||incident.medicalTreated)){
      unit.status='climbingReturn';unit.speed=0;
      if(incident)incident.airMedicalResponse='returning';
    }
    if(unit.status==='takingOff'||unit.status==='climbingReturn'){
      unit.altitude=Math.min(unit.cruiseAltitude,unit.altitude+70*step);
      if(unit.altitude===unit.cruiseAltitude)unit.status=unit.status==='takingOff'?'enroute':'returning';
      continue;
    }
    if(unit.status==='descending'||unit.status==='landing'){
      const targetAltitude=unit.status==='landing'?unit.baseTarget.altitude:unit.hoverAltitude;
      unit.altitude=Math.max(targetAltitude,unit.altitude-50*step);
      if(unit.altitude===targetAltitude){
        if(unit.status==='landing'){unit.returnedToBase=true;airMedicalVehicles.splice(i,1);}
        else{unit.status='onscene';incident.airMedicalResponse='onScene';}
      }
      continue;
    }
    if(unit.status==='onscene'){
      unit.sceneTimer-=step;
      if(unit.sceneTimer<=0){
        applyMedicalResponse(incident,'helicopter');incident.medicalResponse='treated';incident.airMedicalResponse='treated';
        unit.status='climbingReturn';unit.speed=0;
      }
      continue;
    }
    const target=unit.status==='returning'?unit.baseTarget:unit.responseTarget;
    const dx=target.x-unit.x,dy=target.y-unit.y,distance=Math.hypot(dx,dy);
    const desired=Math.atan2(dy,dx),turn=Math.atan2(Math.sin(desired-unit.angle),Math.cos(desired-unit.angle));
    unit.angle+=Math.sign(turn)*Math.min(Math.abs(turn),1.5*step);
    unit.speed=Math.min(8,unit.speed+6*step,distance/60);
    const travel=Math.min(distance,unit.speed*60*step);
    if(distance>0){unit.x+=dx/distance*travel;unit.y+=dy/distance*travel;}
    if(distance-travel<1){
      unit.x=target.x;unit.y=target.y;unit.speed=0;
      unit.status=unit.status==='returning'?'landing':'descending';
    }
  }
}

function beginIncidentResponseReturn(unit){
  unit.status='returning';
  unit.emergencyManeuver=null;unit.emergencyBlocked=false;
  unit.responseTarget={...unit.baseTarget};
  unit.route=roadPath(roadGraph,unit,unit.responseTarget).slice(1);
  unit.routeTimer=0;
  if(!unit.route.length){unit.returnedToBase=true;unit.removeAfterScene=true;}
}

function updateIncidentResponse(dt){
  const frame=Math.min(Math.max(dt,0),.05)*60;
  const active=cityIncidentDirector?.current();
  for(let i=incidentResponseVehicles.length-1;i>=0;i--){
    const unit=incidentResponseVehicles[i];
    unit.strobePhase=(unit.strobePhase||0)+dt*14;
    const incident=active?.id===unit.responseIncidentId?active:null;
    if(unit.status==='onscene'){
      unit.sceneTimer-=dt;
      if(unit.sceneTimer<=0){
        if(unit.model==='fireEngine'&&incident){incident.fireSuppressed=true;incident.fireResponse='contained';}
        if(unit.model==='ambulance'&&incident){applyMedicalResponse(incident);incident.medicalResponse='treated';}
        beginIncidentResponseReturn(unit);
      }
      continue;
    }
    if(unit.removeAfterScene){incidentResponseVehicles.splice(i,1);continue;}
    if(!unit.route?.length)unit.route=roadPath(roadGraph,unit,unit.responseTarget).slice(1);
    if(!unit.route.length){incidentResponseVehicles.splice(i,1);continue;}
    const responseDistance=Math.hypot(unit.responseTarget.x-unit.x,unit.responseTarget.y-unit.y);
    if(responseDistance<18&&!unit.emergencyManeuver&&!unit.emergencyBlocked){
      if(unit.status==='returning'){unit.returnedToBase=true;incidentResponseVehicles.splice(i,1);continue;}
      unit.emergencyManeuver=null;unit.emergencyBlocked=false;
      unit.status='onscene';unit.sceneTimer=unit.model==='fireEngine'?4.8:4.1;unit.speed=0;
      if(incident&&unit.model==='fireEngine')incident.fireResponse='onScene';
      if(incident&&unit.model==='ambulance')incident.medicalResponse='onScene';
      continue;
    }
    tryPlanEmergencyPassing(unit,dt);
    advanceServiceRoute(unit,dt);
  }
}

function nearestSafeSpawn(x,y){
  return safeSpawnPoints.reduce((best,sp)=>Math.hypot(sp.x-x,sp.y-y)<Math.hypot(best.x-x,best.y-y)?sp:best,safeSpawnPoints[0]);
}

function respawnPlayer(reason='авария'){
  const detained=reason==='задержание';
  const spawn=nearestSafeSpawn(player.x,player.y);
  roam?.resetToSedan(spawn.x,spawn.y,0);
  if(!roam)Object.assign(player,{x:spawn.x,y:spawn.y,angle:0,speed:0,vx:0,vy:0});
  player.hp=player.maxHp||100;
  state.isDrowning=false;state.drownProgress=0;state.deathFlash=detained?0:1;state.invulnTimer=180;state.detainProgress=0;
  state.wanted=0;state.wantedCooldown=0;state.evading=false;policeCars.length=0;state.tacticalCallDispatched=false;state.guardCallDispatched=false;state.cash=Math.max(0,state.cash-100);
  showToast(detained?'🚨 ВЫ ЗАДЕРЖАНЫ · ШТРАФ (-$100)':`☠️ ВЫ ПОГИБЛИ: ${reason.toUpperCase()} · ВОЗРОЖДЕНИЕ (-$100)`);
}

function updatePhysics(dt) {
  state.deathFlash=Math.max(0,state.deathFlash-dt*1.15);
  if (state.isMapOpen || state.isGarageOpen) {
    player.speed *= 0.88;
    return;
  }

  if (state.invulnTimer > 0) state.invulnTimer--;

  const specialMovement = roam?.step(state.keys, dt);
  if (!specialMovement) {

  const onGround = isPositionOnSolidGround(player.x, player.y);

  if (!onGround && !state.isDrowning) {
    state.isDrowning = true;
    state.drownProgress = 0;
    sound.playSplash();
    for (let i = 0; i < 16; i++) {
      waterSplashes.push({
        x: player.x, y: player.y,
        vx: (Math.random() - 0.5) * 4, vy: (Math.random() - 0.5) * 4,
        size: 6 + Math.random() * 8, alpha: 0.8
      });
    }
  }

  if (state.isDrowning) {
    state.drownProgress += dt * 1.5;
    player.speed *= 0.8;
    player.vx *= 0.8;
    player.vy *= 0.8;

    if (state.drownProgress >= 1.0) {
      const nearest = nearestSafeSpawn(player.x,player.y);
      player.x = nearest.x;
      player.y = nearest.y;
      player.speed = 0;
      player.vx = 0;
      player.vy = 0;
      player.hp = Math.max(0, player.hp - 25);
      state.isDrowning = false;
      state.drownProgress = 0;
      state.invulnTimer = 120;
      showToast('⚠️ МАШИНА УТОНУЛА! ЭВАКУАЦИЯ (-$50)');
      state.cash = Math.max(0, state.cash - 50);
      if(player.hp<=0)respawnPlayer('утопление');
      return;
    }
  }

  const surface=surfaceAt(player.x,player.y),surfaceResponse=surfaceMovement(surface,roam?.profile);
  player.surface=surface;
  let maxSpeed = (roam?.profile?.max || 8.8)*surfaceResponse.maxSpeed;
  let accel = (roam?.profile?.accel || 0.17)*surfaceResponse.acceleration;

  if (CARPARTS.find(p => p.id === 'turbo')?.found) maxSpeed *= 1.2;
  if (CARPARTS.find(p => p.id === 'cams')?.found) accel += 0.04;

  const isBoosting = state.keys.nitro && state.nitroAmount > 5;
  if (isBoosting) {
    maxSpeed *= 1.35;
    accel *= 1.8;
    state.nitroAmount = Math.max(0, state.nitroAmount - 0.7);
  } else if (state.nitroAmount < 100) {
    state.nitroAmount = Math.min(100, state.nitroAmount + 0.2);
  }
  const nitroBarEl = document.getElementById('nitroBar');
  if (nitroBarEl) nitroBarEl.style.width = Math.round(state.nitroAmount) + '%';

  if (state.keys.up) {
    player.speed = Math.min(maxSpeed, player.speed + accel);
  } else if (state.keys.down) {
    // Brake to a clean stop before engaging reverse. This removes the
    // sideways lurch caused by flipping direction with lateral inertia.
    if (player.speed > 0.18) player.speed = Math.max(0, player.speed - accel * 2.55);
    else player.speed = Math.max(-maxSpeed * 0.38, player.speed - accel * 0.82);
  } else {
    player.speed *= surfaceResponse.coast;
    if (Math.abs(player.speed) < 0.025) player.speed = 0;
  }

  let lateralGrip = surfaceResponse.slipRetention;
  if (state.keys.handbrake) {
    player.speed *= 0.96;
    lateralGrip = Math.min(0.82,surfaceResponse.slipRetention*1.8);
  }

  if (Math.abs(player.speed) > 2) {
    skidmarks.push({ x: player.x, y: player.y, angle: player.angle, alpha: 0.5 });
    if (skidmarks.length > 200) skidmarks.shift();
  }

  if (Math.abs(player.speed) > 0.12) {
    const dir = player.speed >= 0 ? 1 : -1;
    const steeringAuthority = Math.min(1, 0.28 + Math.abs(player.speed) / 3.2)*surfaceResponse.steering;
    const turnSpeed = (state.keys.handbrake ? 0.063 : (roam?.profile?.steer||0.044)) * steeringAuthority * Math.min(1,Math.abs(player.speed)/2.2);
    if (state.keys.left) player.angle -= turnSpeed * dir;
    if (state.keys.right) player.angle += turnSpeed * dir;
  }

  Object.assign(player, velocityForHeading(player, lateralGrip));

  player.x += player.vx;
  player.y += player.vy;
  updateStuntVehicle(player,dt);

  // Full oriented body, not just the vehicle centre, meets solid geometry.
  const impactSpeed = Math.abs(player.speed);
  if (stuntHeightFor(player)<16&&resolveScenery(player, buildings, trees, solidProps) && impactSpeed > 3 && state.invulnTimer === 0) {
    player.hp = Math.max(0, player.hp - 5);
    state.invulnTimer = 24;
    sound.playImpact();
  }
  /* Legacy point contacts superseded by chassis contacts.
  buildings.forEach(b => {
    const pad = 16;
    if (player.x > b.x - pad && player.x < b.x + b.w + pad &&
        player.y > b.y - pad && player.y < b.y + b.h + pad) {
      const cx = b.x + b.w / 2;
      const cy = b.y + b.h / 2;
      const ox = (b.w / 2 + pad) - Math.abs(player.x - cx);
      const oy = (b.h / 2 + pad) - Math.abs(player.y - cy);
      if (ox < oy) {
        player.x = player.x > cx ? b.x + b.w + pad : b.x - pad;
        player.vx = 0;
      } else {
        player.y = player.y > cy ? b.y + b.h + pad : b.y - pad;
        player.vy = 0;
      }
      if (state.invulnTimer === 0 && Math.abs(player.speed) > 3) {
        player.hp = Math.max(0, player.hp - 5);
        sound.playImpact();
        player.speed *= -0.85;
      }
    }
  });

  */
  // Collision: Bridge rails
  bridgeRails.forEach(br => {
    if(stuntHeightFor(player)>16)return;
    const pad = 12;
    if (player.x > br.x - pad && player.x < br.x + br.w + pad &&
        player.y > br.y - pad && player.y < br.y + br.h + pad) {
      if (br.axis === 'x') {
        const cx = br.x + br.w / 2;
        player.x = player.x > cx ? br.x + br.w + pad : br.x - pad;
        player.vx = 0;
      } else {
        const cy = br.y + br.h / 2;
        player.y = player.y > cy ? br.y + br.h + pad : br.y - pad;
        player.vy = 0;
      }
      player.speed *= 0.9;
    }
  });

  // Props break
  breakableProps.forEach(prop => {
    if (prop.intact && Math.hypot(prop.x - player.x, prop.y - player.y) < 28) {
      prop.intact = false;
      sound.playPropBreak();
      if (prop.type === 'hydrant') {
        showToast('💦 ГИДРАНТ РАЗБИТ!');
        for (let i = 0; i < 20; i++) {
          waterSplashes.push({
            x: prop.x, y: prop.y,
            vx: (Math.random() - 0.5) * 3, vy: -Math.random() * 5,
            size: 5 + Math.random() * 6, alpha: 0.9
          });
        }
      } else {
        showToast('🗑️ МУСОРНЫЙ БАК СБИТ!');
      }
      player.speed *= 0.88;
    }
  });

  // Tuning Parts Pickup
  CARPARTS.forEach(part => {
    if (!part.found && Math.hypot(part.x - player.x, part.y - player.y) < 45) {
      part.found = true;
      showToast(`⭐ НАЙДЕНА ДЕТАЛЬ: ${part.name} (${part.bonus})!`);
      updateGaragePartsUI();
      autoSaveProgress();
    }
  });

  }
  // Traffic update
  trafficCars.forEach(c => {
    if (c.cruiseSpeed === undefined) c.cruiseSpeed = c.speed;
    const forwardGap = Math.max(72, (c.width || 46) + 34);
    const cs=Math.cos(c.angle),sn=Math.sin(c.angle);
    const ahead=(other,gap,margin)=>{
      const dx=other.x-c.x,dy=other.y-c.y,along=dx*cs+dy*sn;
      return along>0&&along<gap&&Math.abs(-dx*sn+dy*cs)<margin;
    };
    const occupied = [...(roam?.mode!=='foot'&&(roam?.altitude||0)<12?[player]:[]), ...trafficCars, ...parkedCars,
      ...policeCars,...incidentPoliceCars,...incidentResponseVehicles,...(roam?.fleet||[]).filter(v=>v.kind!=='water')]
      .some(other=>other!==c&&ahead(other,forwardGap,((c.height||24)+(other.height||24))/2+12))||
      [...pedestrians,...(roam?.mode==='foot'?[player]:[])].some(person=>ahead(person,70,(c.height||24)/2+7));
    const approachingRed=trafficMustStopAtSignal(c);
    c.collisionHold=Math.max(0,(c.collisionHold||0)-dt);
    const emergencyYield=[...policeCars,...incidentPoliceCars,...incidentResponseVehicles]
      .some(unit=>unit.status==='enroute'&&Math.hypot(unit.x-c.x,unit.y-c.y)<200&&
        Math.abs((c.x-unit.x)*-Math.sin(unit.angle)+(c.y-unit.y)*Math.cos(unit.angle))<60);
    const obstacle = occupied || approachingRed || emergencyYield || c.collisionHold>0;
    const signalSpeed=approachingRed?Math.max(0,c.signalGap-3)/12:Infinity;
    const allowedSpeed=occupied||emergencyYield||c.collisionHold>0?0:
      Math.sign(c.cruiseSpeed)*Math.min(Math.abs(c.cruiseSpeed),signalSpeed);
    if(c.routeManaged){
      const pose={x:c.x,y:c.y,angle:c.angle};
      advanceRouteActor(c,c.route,dt,{speed:allowedSpeed,dwell:2.1,stopRadius:12});
      if(!policeFootprintOnRoad(c)){Object.assign(c,pose);c.speed=0;}
      return;
    }
    c.speed += (allowedSpeed - c.speed) * Math.min(1, dt * (obstacle ? 9 : 3.5));
    const frame = Math.min(dt, .05) * 60;
    advanceTrafficCar(c,frame,trafficCars);
    const playerWasDriving=Math.abs(player.speed)>.75;
    if (!roam?.special && stuntHeightFor(player)<16 && resolveContact(player, c)) {
      c.collisionHold=Math.max(c.collisionHold,.5);
      // A passing driver hitting a stationary player must not accuse the player.
      if (playerWasDriving && state.invulnTimer === 0) {
        player.hp = Math.max(0, player.hp - 8);
        state.invulnTimer = 24;
        sound.playImpact();
        if (state.wanted === 0) setWanted(1);
      }
    }
  });

  const incident=cityIncidentDirector?.update(dt,{player,people:pedestrians})||null;
  updateCrowdReactions(pedestrians,incident,dt);
  if(incident&&incidentNoticeId!==incident.id&&Math.hypot(player.x-incident.x,player.y-incident.y)<1100){
    incidentNoticeId=incident.id;
    showToast(`⚠️ ${incident.title}: прохожие реагируют на происшествие`);
  }
  if(incident?.reported){
    const dispatched=dispatchIncidentPolice(incident);
    if(dispatched&&!incident.reportNoticeShown&&Math.hypot(player.x-incident.x,player.y-incident.y)<1400){
      incident.reportNoticeShown=true;
      showToast('📞 Свидетель сообщил о происшествии · патруль направлен');
    }
    const services=dispatchIncidentResponse(incident);
    if(services&&!incident.serviceNoticeShown&&Math.hypot(player.x-incident.x,player.y-incident.y)<1400){
      incident.serviceNoticeShown=true;
      const names=incident.respondingServices.map(type=>type==='fireEngine'?'пожарная бригада':'скорая помощь').join(' и ');
      showToast(`🚒 Вызваны: ${names}`);
    }
  }
  updateIncidentPolice(dt);
  updateIncidentResponse(dt);
  if(incident?.reported&&dispatchAirMedicalResponse(incident)&&Math.hypot(player.x-incident.x,player.y-incident.y)<1400)
    showToast('🚁 Санитарный вертолёт направлен к пострадавшему');
  updateAirMedicalResponse(dt);
  updatePedestrians(dt);

  updatePoliceAI(dt);
  const stuntVehicles=[...trafficCars,...policeCars,...incidentPoliceCars,...incidentResponseVehicles];
  stuntVehicles.forEach(vehicle=>updateStuntVehicle(vehicle,dt));
  const vehicles = [...(!roam?.special&&stuntHeightFor(player)<16 ? [player] : []), ...trafficCars, ...policeCars, ...incidentPoliceCars,...incidentResponseVehicles];
  const responsePoses=new Map([...policeCars,...incidentPoliceCars,...incidentResponseVehicles].filter(serviceFootprintSupported)
    .map(unit=>[unit,{x:unit.x,y:unit.y,angle:unit.angle}]));
  // Repeated projection handles simultaneous wall/car contacts at intersections.
  for (let pass = 0; pass < 3; pass++) {
    for (let i = 0; i < vehicles.length; i++) {
      for (let j = i + 1; j < vehicles.length; j++) {
        if(stuntHeightFor(vehicles[i])>16||stuntHeightFor(vehicles[j])>16)continue;
      if (vehicles[i].isTraffic && vehicles[j].isTraffic) {
          if(pass===0)resolveTrafficPair(vehicles[i],vehicles[j]);
          continue;
        }
        resolveContact(vehicles[i], vehicles[j]);
      }
      for (const parked of parkedCars) resolveContact(vehicles[i], parked, true);
      for (const vehicle of roam?.fleet || []) if (vehicle.kind !== 'water') resolveContact(vehicles[i],vehicle,true);
      if(stuntHeightFor(vehicles[i])<16)resolveScenery(vehicles[i], buildings, trees, solidProps);
    }
  }
  for(const [unit,pose] of responsePoses)if(!serviceFootprintSupported(unit)){Object.assign(unit,pose);unit.speed=0;}
  roam?.contacts();

  if(player.hp<=0)respawnPlayer('тяжёлая авария');

  const speedKmh = Math.abs(player.speed) * 12;
  if (!roam?.special) player.gear = player.speed < -0.1 ? 'R' : speedKmh < 30 ? 'D1' : speedKmh < 60 ? 'D2' : speedKmh < 95 ? 'D3' : speedKmh < 130 ? 'D4' : 'D5';
  player.rpm = Math.min(1.0, (speedKmh % 35) / 35 + 0.2);
  sound.update(player.rpm, player.speed);

  const distEl = document.getElementById('hudDistrict');
  if (distEl) {
    const district = islands.find(isl => player.x >= isl.x && player.x <= isl.x + isl.w && player.y >= isl.y && player.y <= isl.y + isl.h);
    distEl.innerText = (district?.name || 'LOWTOWN CAUSEWAY').toUpperCase();
  }
}

function setWanted(lvl) {
  state.wanted = Math.min(5, Math.max(0, lvl));
  state.evading = false;
  state.evadeTimer = 5.0;
  if (state.wanted > 0) showToast(`🚨 УРОВЕНЬ РОЗЫСКА: ★ x ${state.wanted}!`);
}

function wantedResponseProfile(level) {
  const wanted=Math.max(0,Math.min(5,Math.floor(Number(level)||0)));
  return {
    wanted,
    patrolCount:wanted?Math.min(4,wanted+1):0,
    tacticalCount:wanted>=4?1:0,
    guardCount:wanted>=5?1:0
  };
}

function raiseWantedFromCrime(maxLevel=5,cooldown=2.5) {
  if(state.wanted>=maxLevel||state.wantedCooldown>0)return false;
  setWanted(Math.min(maxLevel,state.wanted+1));
  state.wantedCooldown=cooldown;
  return true;
}

function stableVisualHash(a, b, c = 0) {
  const value = Math.sin(a * 12.9898 + b * 78.233 + c * 37.719) * 43758.5453;
  return value - Math.floor(value);
}

function drawWetRoadSurface(r, index) {
  if(r.x>player.x+1500||r.y>player.y+1500||r.x+r.w<player.x-1500||r.y+r.h<player.y-1500)return;
  ctx.save();
  ctx.beginPath(); ctx.rect(r.x, r.y, r.w, r.h); ctx.clip();
  const across = r.dir === 'h' ? r.h : r.w;
  const length = r.dir === 'h' ? r.w : r.h;
  // Reflections and wear sit on the shared asphalt material. A separate
  // directional gradient for each road produces rectangular seams at turns.
  ctx.globalCompositeOperation = 'screen';
  for (let i = 0; i < Math.min(9, Math.floor(length / 180) + 2); i++) {
    const along = (stableVisualHash(index, i, 2) * .86 + .07) * length;
    const lane = (stableVisualHash(index, i, 5) * .72 + .14) * across;
    const warm = i % 4 === 3;
    const color = warm ? '211,55,25' : '231,161,58';
    const px = r.dir === 'h' ? r.x + along : r.x + lane;
    const py = r.dir === 'h' ? r.y + lane : r.y + along;
    const g = ctx.createRadialGradient(px, py, 1, px, py, 25 + i % 3 * 8);
    g.addColorStop(0, `rgba(${color},.18)`); g.addColorStop(1, `rgba(${color},0)`);
    ctx.fillStyle = g; ctx.beginPath();
    ctx.ellipse(px, py, r.dir === 'h' ? 55 : 10, r.dir === 'h' ? 10 : 55, 0, 0, Math.PI * 2); ctx.fill();
  }
  ctx.globalCompositeOperation = 'source-over';
  for(let n=0;n<Math.min(450,length*.3);n++){
    const u=stableVisualHash(index,n,19),v=stableVisualHash(index,n,23);
    const px=r.x+u*r.w,py=r.y+v*r.h;
    ctx.fillStyle=n%4===0?'rgba(161,155,133,.14)':'rgba(3,7,9,.25)';
    ctx.fillRect(px,py,1+u*5,.7+v*2);
    if(n%29===0){ctx.strokeStyle='rgba(6,9,11,.5)';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(px,py);ctx.lineTo(px+12,py+4);ctx.lineTo(px+20,py-3);ctx.stroke();}
  }
  ctx.strokeStyle = 'rgba(198,205,201,.08)'; ctx.lineWidth = 1;
  for (let i = 0; i < 5; i++) {
    const along = stableVisualHash(index, i, 9) * length;
    ctx.beginPath();
    if (r.dir === 'h') { ctx.moveTo(r.x + along, r.y + across * .2); ctx.lineTo(r.x + along + 34, r.y + across * .42); ctx.lineTo(r.x + along + 12, r.y + across * .72); }
    else { ctx.moveTo(r.x + across * .2, r.y + along); ctx.lineTo(r.x + across * .42, r.y + along + 34); ctx.lineTo(r.x + across * .72, r.y + along + 12); }
    ctx.stroke();
  }
  ctx.restore();
}

function drawNoirPostFx(w, h) {
  ctx.save();
  const vignette = ctx.createRadialGradient(w*.5,h*.48,Math.min(w,h)*.18,w*.5,h*.48,Math.max(w,h)*.72);
  vignette.addColorStop(0,'rgba(0,0,0,0)'); vignette.addColorStop(.72,'rgba(0,0,0,.08)'); vignette.addColorStop(1,'rgba(0,0,0,.55)');
  ctx.fillStyle=vignette;ctx.fillRect(0,0,w,h);
  ctx.fillStyle='rgba(255,218,150,.018)';
  for(let y=0;y<h;y+=4)ctx.fillRect(0,y,w,1);
  ctx.restore();
}

function drawBuilding(b,index) { drawArchitecture(ctx,b,index,performance.now()/1000); }
function drawCityScenery() {
  // Parking bays and stationary cars make blocks feel inhabited.
  parkedCars.forEach((car, index) => {
    ctx.save(); ctx.translate(car.x, car.y); ctx.rotate(car.angle);
    ctx.strokeStyle = 'rgba(210, 215, 220, 0.22)'; ctx.lineWidth = 2;
    ctx.strokeRect(-34, -18, 68, 36);
    drawDetailedCar(ctx, 0, 0, 0, car.color, 40, 19, false, car.type);
    if (index % 4 === 0) { ctx.fillStyle = 'rgba(0,0,0,.38)'; ctx.fillRect(-46, 23, 92, 7); }
    ctx.restore();
  });

  cranes.forEach((crane, index) => {
    const boomY = crane.y - 150;
    ctx.strokeStyle = index % 2 ? '#a86528' : '#c48632'; ctx.lineWidth = 11;
    ctx.beginPath(); ctx.moveTo(crane.x, crane.y); ctx.lineTo(crane.x, boomY); ctx.lineTo(crane.x + crane.reach, boomY); ctx.stroke();
    ctx.strokeStyle = '#6c401f'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(crane.x, boomY); ctx.lineTo(crane.x + crane.reach * .75, crane.y - 35); ctx.stroke();
    const hookX = crane.x + crane.reach * .82+Math.sin(performance.now()/5200+index)*5;
    const cable=88+Math.sin(performance.now()/8200+index*2)*22;
    ctx.beginPath(); ctx.moveTo(hookX, boomY); ctx.lineTo(hookX, boomY + cable); ctx.stroke();
    ctx.fillStyle = '#111820'; ctx.fillRect(hookX - 9, boomY + cable-3, 18, 12);
  });
}

function drawBillboard(board){
    ctx.save();ctx.translate(board.x,board.y);ctx.transform(1/Math.sqrt(3),-1/Math.sqrt(3),1,1,0,0);
    ctx.strokeStyle='#3a423f';ctx.lineWidth=4;ctx.beginPath();ctx.moveTo(-36,0);ctx.lineTo(-36,-56);ctx.moveTo(36,0);ctx.lineTo(36,-56);ctx.stroke();
    ctx.fillStyle='#131918';ctx.fillRect(-65,-83,130,36);ctx.strokeStyle=board.color;ctx.lineWidth=2;ctx.strokeRect(-65,-83,130,36);
    ctx.fillStyle=board.color;ctx.font='900 12px monospace';ctx.textAlign='center';ctx.fillText(board.text,0,-60,120);ctx.restore();
  }

function drawStreetLamp(lamp,index){
    const glow = ctx.createRadialGradient(lamp.x, lamp.y, 2, lamp.x, lamp.y, 62);
    glow.addColorStop(0, 'rgba(232,184,74,.28)'); glow.addColorStop(1, 'rgba(232,184,74,0)');
    ctx.fillStyle = glow; ctx.beginPath(); ctx.arc(lamp.x, lamp.y, 62, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#4b5563'; ctx.lineWidth = 4;
    ctx.beginPath();ctx.moveTo(lamp.x,lamp.y);ctx.lineTo(lamp.x-48,lamp.y-48);ctx.lineTo(lamp.x-48+(index%2?-8:8),lamp.y-48+(index%2?8:-8));ctx.stroke();
    ctx.fillStyle = lamp.tone; ctx.shadowColor = lamp.tone; ctx.shadowBlur = 13;
    ctx.beginPath(); ctx.arc(lamp.x-48+(index%2?-8:8),lamp.y-48+(index%2?8:-8),4, 0, Math.PI * 2); ctx.fill(); ctx.shadowBlur = 0;
  }

function drawDistrictGroundDetails() {
  drawScenicRoads(ctx);
  for(const zone of stuntZones){
    ctx.save();ctx.translate(zone.x,zone.y);if(zone.axis==='v')ctx.rotate(Math.PI/2);
    const half=Math.min(46,zone.length/2),width=zone.roadWidth*.38;
    if(zone.type==='ramp'){
      ctx.fillStyle='rgba(0,0,0,.42)';ctx.beginPath();ctx.moveTo(-half+4,-width+6);ctx.lineTo(half+7,-width+6);ctx.lineTo(half+7,width+6);ctx.lineTo(-half+4,width+6);ctx.closePath();ctx.fill();
      ctx.fillStyle='#343633';ctx.beginPath();ctx.moveTo(-half,-width);ctx.lineTo(half,-width);ctx.lineTo(half-17,width);ctx.lineTo(-half+13,width);ctx.closePath();ctx.fill();
      ctx.fillStyle=zone.launchColor;ctx.beginPath();ctx.moveTo(-half,-width);ctx.lineTo(half,-width);ctx.lineTo(half-17,-width+7);ctx.lineTo(-half+13,-width+7);ctx.closePath();ctx.fill();
      ctx.strokeStyle='#d7c18a';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(-half+13,width-2);ctx.lineTo(half-17,-width+7);ctx.stroke();
      for(let mark=-20;mark<half-8;mark+=22){ctx.strokeStyle='#c58a42';ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(mark,-width+11);ctx.lineTo(mark+9,-width+11);ctx.stroke();}
    }else{
      ctx.fillStyle='rgba(0,0,0,.34)';ctx.fillRect(-half+3,-width+5,half*2-6,width*2);
      ctx.fillStyle='#b9ad82';ctx.fillRect(-half,-width,half*2,width*2);
      ctx.fillStyle='#d7cda7';ctx.fillRect(-half+4,-width+3,half*2-8,width*2-6);
      ctx.strokeStyle='rgba(63,64,56,.62)';ctx.lineWidth=2;
      for(let stripe=-half+13;stripe<half-3;stripe+=18){ctx.beginPath();ctx.moveTo(stripe,-width+4);ctx.lineTo(stripe,width-4);ctx.stroke();}
    }
    ctx.restore();
  }
  // Parks, plazas, service yards and wet reflections break up the block grid
  // without changing the city's collision geometry.
  const rounded=(x,y,w,h,r)=>{ctx.beginPath();ctx.moveTo(x+r,y);ctx.lineTo(x+w-r,y);ctx.quadraticCurveTo(x+w,y,x+w,y+r);ctx.lineTo(x+w,y+h-r);ctx.quadraticCurveTo(x+w,y+h,x+w-r,y+h);ctx.lineTo(x+r,y+h);ctx.quadraticCurveTo(x,y+h,x,y+h-r);ctx.lineTo(x,y+r);ctx.quadraticCurveTo(x,y,x+r,y);ctx.closePath();};
  for (const [i, park] of parkZones.entries()) {
    rounded(park.x,park.y,park.w,park.h,28);ctx.fillStyle=park.courtyard?'#44443e':i%2?'#1b3024':'#203529';ctx.fill();ctx.strokeStyle='#615d50';ctx.lineWidth=5;ctx.stroke();
    if(park.courtyard){
      ctx.save();ctx.clip();ctx.strokeStyle='rgba(180,172,149,.14)';ctx.lineWidth=1;
      for(let y=park.y;y<park.y+park.h;y+=18){ctx.beginPath();ctx.moveTo(park.x,y);ctx.lineTo(park.x+park.w,y);ctx.stroke();}
      for(let x=park.x;x<park.x+park.w;x+=26){ctx.beginPath();ctx.moveTo(x,park.y);ctx.lineTo(x,park.y+park.h);ctx.stroke();}
      ctx.restore();
    }
    // Curved pale paths replace the rigid cross used in the first version.
    ctx.strokeStyle='rgba(190,178,145,.42)';ctx.lineWidth=15;ctx.lineCap='round';
    ctx.beginPath();ctx.moveTo(park.x+18,park.y+park.h*.68);ctx.quadraticCurveTo(park.x+park.w*.42,park.y+park.h*.2,park.x+park.w-18,park.y+park.h*.42);ctx.stroke();
    ctx.beginPath();ctx.moveTo(park.x+park.w*.46,park.y+15);ctx.quadraticCurveTo(park.x+park.w*.64,park.y+park.h*.55,park.x+park.w*.54,park.y+park.h-15);ctx.stroke();
    const cx=park.x+park.w*.53,cy=park.y+park.h*.51;
    if(park.type===0){
      ctx.fillStyle='rgba(0,0,0,.4)';ctx.beginPath();ctx.ellipse(cx+8,cy+10,49,29,0,0,Math.PI*2);ctx.fill();
      ctx.fillStyle='#4c5552';ctx.beginPath();ctx.ellipse(cx,cy+7,43,28,0,0,Math.PI*2);ctx.fill();
      ctx.fillStyle='#8c9188';ctx.beginPath();ctx.ellipse(cx,cy,43,28,0,0,Math.PI*2);ctx.fill();ctx.strokeStyle='#a7a99f';ctx.lineWidth=5;ctx.stroke();
      const glow=ctx.createRadialGradient(cx,cy,2,cx,cy,38);glow.addColorStop(0,'rgba(134,197,204,.65)');glow.addColorStop(1,'rgba(55,116,125,.12)');ctx.fillStyle=glow;ctx.beginPath();ctx.ellipse(cx,cy,31,19,0,0,Math.PI*2);ctx.fill();
      for(let ripple=0;ripple<3;ripple++){
        const radius=5+(performance.now()/160+ripple*10)%26;
        ctx.strokeStyle=`rgba(183,219,214,${.25*(1-radius/32)})`;ctx.lineWidth=1;
        ctx.beginPath();ctx.ellipse(cx,cy,radius,radius*.58,0,0,Math.PI*2);ctx.stroke();
      }
      ctx.fillStyle='#7c837c';ctx.fillRect(cx-6,cy-30,12,30);ctx.beginPath();ctx.ellipse(cx,cy-30,9,5,0,0,Math.PI*2);ctx.fill();ctx.strokeStyle='rgba(173,224,228,.65)';ctx.lineWidth=2;for(let n=-1;n<=1;n++){ctx.beginPath();ctx.moveTo(cx+n*4,cy-29);ctx.quadraticCurveTo(cx+n*13,cy-42,cx+n*19,cy-4);ctx.stroke();}
    }else if(park.type===1){
      ctx.fillStyle='#565b53';ctx.beginPath();ctx.ellipse(cx,cy+5,park.w*.22,park.h*.25,-.25,0,Math.PI*2);ctx.fill();ctx.fillStyle='#102d34';ctx.beginPath();ctx.ellipse(cx,cy,park.w*.2,park.h*.23,-.25,0,Math.PI*2);ctx.fill();ctx.strokeStyle='rgba(109,162,157,.55)';ctx.lineWidth=4;ctx.stroke();
      for(let l=0;l<5;l++){ctx.strokeStyle='rgba(151,196,187,.18)';ctx.lineWidth=2;ctx.beginPath();ctx.arc(cx-18+l*9,cy,12,0,Math.PI);ctx.stroke();}
      ctx.strokeStyle='#718052';ctx.lineWidth=3;for(let r=0;r<8;r++){const a=r*.78;ctx.beginPath();ctx.moveTo(cx+Math.cos(a)*park.w*.19,cy+Math.sin(a)*park.h*.21);ctx.lineTo(cx+Math.cos(a)*park.w*.21,cy-12+Math.sin(a)*park.h*.22);ctx.stroke();}
    }else if(park.type===2){
      ctx.fillStyle='#3b3a31';ctx.fillRect(cx-48,cy-29,96,58);ctx.strokeStyle='rgba(225,207,158,.48)';ctx.lineWidth=3;ctx.strokeRect(cx-48,cy-29,96,58);ctx.beginPath();ctx.moveTo(cx,cy-29);ctx.lineTo(cx,cy+29);ctx.stroke();
      ctx.beginPath();ctx.arc(cx-31,cy,10,0,Math.PI*2);ctx.arc(cx+31,cy,10,0,Math.PI*2);ctx.stroke();
    }else if(park.type===3){
      for(let s=0;s<4;s++){const sx=cx-62+s*40;ctx.fillStyle='rgba(0,0,0,.35)';ctx.fillRect(sx+6,cy-10,31,25);ctx.fillStyle=['#9a5733','#365f69','#84642e','#6c3d34'][s];ctx.fillRect(sx,cy-18,28,23);ctx.fillStyle='#201d1a';ctx.fillRect(sx+5,cy-13,18,14);ctx.fillStyle='#d3c29a';ctx.beginPath();ctx.moveTo(sx-4,cy-22);ctx.lineTo(sx+32,cy-22);ctx.lineTo(sx+27,cy-31);ctx.lineTo(sx+1,cy-31);ctx.closePath();ctx.fill();ctx.strokeStyle='#5b4932';ctx.stroke();}
    }else if(park.type===4){
      ctx.fillStyle='#633e38';ctx.beginPath();ctx.ellipse(cx,cy,park.w*.22,park.h*.2,0,0,Math.PI*2);ctx.fill();
      ctx.strokeStyle='#e1b44e';ctx.lineWidth=5;ctx.beginPath();ctx.moveTo(cx-28,cy+12);ctx.lineTo(cx-16,cy-20);ctx.lineTo(cx+18,cy-20);ctx.lineTo(cx+34,cy+12);ctx.stroke();
      ctx.strokeStyle='#607b85';ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(cx+38,cy-26);ctx.lineTo(cx+54,cy+16);ctx.stroke();
      ctx.fillStyle='#cf8450';ctx.beginPath();ctx.moveTo(cx+38,cy-26);ctx.lineTo(cx+55,cy-26);ctx.lineTo(cx+66,cy+15);ctx.lineTo(cx+50,cy+15);ctx.closePath();ctx.fill();
      ctx.strokeStyle='#323c3b';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(cx-43,cy-22);ctx.lineTo(cx-43,cy+7);ctx.moveTo(cx-55,cy-22);ctx.lineTo(cx-31,cy-22);ctx.moveTo(cx-55,cy+7);ctx.lineTo(cx-31,cy+7);ctx.stroke();
    }else if(park.type===5){
      ctx.fillStyle='#31402b';ctx.fillRect(cx-70,cy-43,140,86);
      for(let row=0;row<2;row++)for(let col=0;col<2;col++){
        const gx=cx-52+col*62,gy=cy-26+row*43;ctx.fillStyle='#665543';ctx.fillRect(gx,gy,45,26);ctx.fillStyle=['#617744','#71814a','#897246','#476745'][(row*2+col)%4];ctx.fillRect(gx+3,gy+3,39,20);
        for(let leaf=0;leaf<4;leaf++){ctx.fillStyle=leaf%2?'#9b9b55':'#6e8751';ctx.beginPath();ctx.arc(gx+7+leaf*9,gy+9+(leaf%2)*6,3,0,Math.PI*2);ctx.fill();}
      }
      ctx.strokeStyle='#9c9a7b';ctx.lineWidth=4;ctx.strokeRect(cx-75,cy-48,150,96);
    }else if(park.type===6){
      ctx.fillStyle='#6a6b60';ctx.beginPath();ctx.ellipse(cx,cy,park.w*.23,park.h*.22,-.08,0,Math.PI*2);ctx.fill();
      ctx.fillStyle='#222c2c';ctx.beginPath();ctx.ellipse(cx,cy,park.w*.17,park.h*.16,-.08,0,Math.PI*2);ctx.fill();
      ctx.strokeStyle='#b49767';ctx.lineWidth=5;ctx.beginPath();ctx.ellipse(cx,cy,park.w*.22,park.h*.21,-.08,0,Math.PI*2);ctx.stroke();
      ctx.strokeStyle='rgba(219,211,183,.48)';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(cx-park.w*.15,cy);ctx.quadraticCurveTo(cx,cy-park.h*.18,cx+park.w*.15,cy);ctx.stroke();
    }else{
      ctx.fillStyle='#3d4837';ctx.beginPath();ctx.ellipse(cx,cy,park.w*.22,park.h*.2,0,0,Math.PI*2);ctx.fill();
      ctx.strokeStyle='#c3aa72';ctx.lineWidth=5;ctx.strokeRect(cx-60,cy-28,120,56);
      for(let hoop=0;hoop<3;hoop++){const hx=cx-35+hoop*35;ctx.strokeStyle='#d6a760';ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(hx,cy-28);ctx.lineTo(hx,cy-12);ctx.arc(hx+8,cy-12,8,Math.PI,Math.PI*2);ctx.moveTo(hx+16,cy-12);ctx.lineTo(hx+16,cy+12);ctx.stroke();}
      ctx.fillStyle='#7b6d48';ctx.fillRect(cx-36,cy+39,72,8);ctx.fillRect(cx-25,cy+31,7,8);ctx.fillRect(cx+18,cy+31,7,8);
    }
    // Tree belts, benches, bins and warm footlights make the park inhabited.

    park.benches.forEach(bench=>{ctx.fillStyle='rgba(0,0,0,.4)';ctx.fillRect(bench.x-15,bench.y+8,42,7);ctx.fillStyle='#30251c';ctx.fillRect(bench.x-17,bench.y+4,38,7);ctx.fillStyle='#8b6842';ctx.fillRect(bench.x-19,bench.y,38,6);ctx.fillStyle='#54402b';ctx.fillRect(bench.x-17,bench.y-8,38,6);ctx.fillRect(bench.x-15,bench.y+6,4,9);ctx.fillRect(bench.x+15,bench.y+6,4,9);});
    for(let l=0;l<4;l++){const lx=park.x+park.w*(.18+l*.22),ly=park.y+park.h*.18;const g=ctx.createRadialGradient(lx,ly,1,lx,ly,24);g.addColorStop(0,'rgba(232,184,74,.35)');g.addColorStop(1,'rgba(232,184,74,0)');ctx.fillStyle=g;ctx.beginPath();ctx.arc(lx,ly,24,0,Math.PI*2);ctx.fill();ctx.fillStyle='#d8aa52';ctx.beginPath();ctx.arc(lx,ly,3,0,Math.PI*2);ctx.fill();}
  }

  const yards = [
    { x: 3150, y: 650, w: 620, h: 395 }, { x: 4050, y: 650, w: 470, h: 395 },
    { x: 3150, y: 3550, w: 620, h: 460 }, { x: 4050, y: 3550, w: 470, h: 460 },
    { x: 3150, y: 6550, w: 620, h: 455 }, { x: 4050, y: 6550, w: 470, h: 455 },
    { x: 3150, y: 7350, w: 620, h: 500 }, { x: 4050, y: 7350, w: 470, h: 500 }
  ];
  for (const [n, yard] of yards.entries()) {
    ctx.fillStyle = n % 2 ? '#292b2a' : '#2d2d29'; ctx.fillRect(yard.x, yard.y, yard.w, yard.h);
    ctx.strokeStyle = 'rgba(188,154,91,.25)'; ctx.lineWidth = 3; ctx.setLineDash([18, 13]); ctx.strokeRect(yard.x + 14, yard.y + 14, yard.w - 28, yard.h - 28); ctx.setLineDash([]);
    for (let c = 0; c < 4; c++) {
      const cx = yard.x + 55 + c * Math.min(125, (yard.w - 110) / 3), cy = yard.y + 55 + ((c + n) % 2) * 72;
      ctx.fillStyle = ['#70442d','#355261','#6b6d62','#7a542c'][(c+n)%4]; ctx.fillRect(cx, cy, 62, 30);
      ctx.strokeStyle = '#171a1b'; ctx.lineWidth = 2; ctx.strokeRect(cx, cy, 62, 30);
    }
  }

  ctx.save(); ctx.globalCompositeOperation = 'screen';
  for (let i = 0; i < 34; i++) {
    const x = 520 + ((i * 733) % 6250), y = [1170,4170,7170][i % 3];
    const g = ctx.createLinearGradient(x - 45, y, x + 45, y);
    g.addColorStop(0, 'rgba(224,154,62,0)'); g.addColorStop(.5, 'rgba(224,154,62,.10)'); g.addColorStop(1, 'rgba(224,154,62,0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(x, y, 58, 9 + (i % 3) * 3, 0, 0, Math.PI * 2); ctx.fill();
  }
  ctx.restore();
}

function drawScenicRoads(target,scale=1,offsetX=0,offsetY=0,map=false){
  target.save();target.lineJoin='round';target.lineCap='round';
  for(const road of scenicRoads){
    const path=()=>{target.beginPath();road.points.forEach(([x,y],i)=>i?target.lineTo(x*scale+offsetX,y*scale+offsetY):target.moveTo(x*scale+offsetX,y*scale+offsetY));};
    if(!map){path();target.strokeStyle='#666356';target.lineWidth=(road.width+18)*scale;target.stroke();path();target.strokeStyle='#373c39';target.lineWidth=(road.width+12)*scale;target.stroke();}
    path();target.strokeStyle=map?'#646a68':'#171d20';target.lineWidth=road.width*scale;target.stroke();
    if(!map){path();target.strokeStyle='rgba(211,179,111,.48)';target.lineWidth=1.5*scale;target.setLineDash([13*scale,19*scale]);target.stroke();target.setLineDash([]);}
  }
  target.restore();
}

function drawShoreLife() {
  // Broken tidal lines and distinct marsh / rock clusters follow each actual
  // shoreline curve instead of repeating a few points from the district box.
  for(const detail of shorelineDetails){
    if(Math.abs(detail.x-player.x)>3900||Math.abs(detail.y-player.y)>3900)continue;
    const tx=Math.cos(detail.tangent),ty=Math.sin(detail.tangent),nx=-ty,ny=tx;
    const waveOffset=detail.type==='tideline'?-18:-(12+detail.seed*8);
    ctx.strokeStyle=detail.natural?'rgba(151,190,169,.20)':'rgba(137,179,174,.15)';
    ctx.lineWidth=detail.natural?2:1.5;ctx.lineCap='round';ctx.beginPath();
    ctx.moveTo(detail.x+nx*waveOffset-tx*12,detail.y+ny*waveOffset-ty*12);
    ctx.quadraticCurveTo(detail.x+nx*(waveOffset-3)+tx*2,detail.y+ny*(waveOffset-3)+ty*2,
      detail.x+nx*(waveOffset+2)+tx*17,detail.y+ny*(waveOffset+2)+ty*17);ctx.stroke();
    if(detail.type==='reeds'){
      ctx.fillStyle='rgba(7,12,12,.45)';ctx.beginPath();ctx.ellipse(detail.x+5,detail.y+7,17,10,detail.tangent,0,Math.PI*2);ctx.fill();
      for(let blade=0;blade<6;blade++){
        const side=(blade-2.5)*3.1,bend=((blade%3)-1)*5,height=15+detail.seed*15+(blade%2)*4;
        const bx=detail.x+tx*side,by=detail.y+ty*side;
        ctx.strokeStyle=blade%3===0?'#9b9466':blade%2?'#66704b':'#798055';ctx.lineWidth=1.7;
        ctx.beginPath();ctx.moveTo(bx,by);ctx.quadraticCurveTo(bx+nx*bend,by+ny*bend,bx+nx*bend+tx*3,by+ny*bend- height);ctx.stroke();
      }
    }else if(detail.type==='brush'){
      ctx.fillStyle='rgba(0,0,0,.3)';ctx.beginPath();ctx.ellipse(detail.x+3,detail.y+7,19,10,detail.tangent,0,Math.PI*2);ctx.fill();
      for(let tuft=0;tuft<4;tuft++){
        const side=(tuft-1.5)*7,px=detail.x+tx*side,py=detail.y+ty*side,r=5+detail.seed*3;
        ctx.fillStyle=['#3d4b39','#536047','#46523d','#625c43'][tuft];ctx.beginPath();ctx.ellipse(px,py,r,r*.68,detail.tangent+tuft*.3,0,Math.PI*2);ctx.fill();
        ctx.fillStyle='rgba(158,153,111,.28)';ctx.beginPath();ctx.arc(px-2,py-2,2,0,Math.PI*2);ctx.fill();
      }
    }else if(detail.type==='timber'){
      ctx.save();ctx.translate(detail.x,detail.y);ctx.rotate(detail.tangent+.18);
      ctx.fillStyle='rgba(0,0,0,.35)';ctx.fillRect(-18,2,38,9);
      ctx.fillStyle='#4c4130';ctx.fillRect(-20,-4,39,8);
      ctx.fillStyle='#826744';ctx.fillRect(-17,-5,31,4);
      ctx.fillStyle='#302d26';ctx.beginPath();ctx.arc(18,0,4,0,Math.PI*2);ctx.fill();ctx.restore();
    }else{
      const along=13+detail.seed*10,across=7+detail.seed*5;
      ctx.fillStyle='rgba(4,8,9,.42)';ctx.beginPath();ctx.ellipse(detail.x+5,detail.y+6,along,across,detail.tangent,0,Math.PI*2);ctx.fill();
      ctx.fillStyle=detail.natural?'#51544a':'#55554d';ctx.beginPath();
      ctx.moveTo(detail.x-tx*along,detail.y-ty*along);
      ctx.lineTo(detail.x-tx*along*.48+nx*across,detail.y-ty*along*.48+ny*across);
      ctx.lineTo(detail.x+tx*along*.55+nx*across*.8,detail.y+ty*along*.55+ny*across*.8);
      ctx.lineTo(detail.x+tx*along,detail.y+ty*along);
      ctx.lineTo(detail.x+tx*along*.45-nx*across*.8,detail.y+ty*along*.45-ny*across*.8);
      ctx.lineTo(detail.x-tx*along*.55-nx*across*.65,detail.y-ty*along*.55-ny*across*.65);ctx.closePath();ctx.fill();
      ctx.strokeStyle='rgba(199,190,157,.28)';ctx.lineWidth=1.3;ctx.beginPath();ctx.moveTo(detail.x-tx*along*.45,detail.y-ty*along*.45);ctx.lineTo(detail.x+tx*along*.3+nx*across*.5,detail.y+ty*along*.3+ny*across*.5);ctx.stroke();
      if(detail.seed>.68){ctx.fillStyle='#292c27';ctx.beginPath();ctx.ellipse(detail.x+nx*14,detail.y+ny*14,5,3,detail.tangent,0,Math.PI*2);ctx.fill();}
    }
  }
  for(const [x,y] of [[2500,1770],[2500,2100],[4850,1770],[4850,2100]]){
    ctx.fillStyle='#5f4730';ctx.fillRect(x-5,y-5,10,22);ctx.fillStyle='#d7b56d';ctx.beginPath();ctx.arc(x,y-6,6,0,Math.PI*2);ctx.fill();
  }
  // Navigation buoys and moored dinghies make channels read as usable water.
  const buoys=[[2670,850],[2670,1500],[5020,900],[5020,1600],[7170,900],[7170,3900],[2670,6900],[5020,7600],[7170,9900],[9700,10400]];
  buoys.forEach(([x,y],i)=>{const g=ctx.createRadialGradient(x,y,2,x,y,28);g.addColorStop(0,i%2?'rgba(226,72,45,.45)':'rgba(232,184,74,.4)');g.addColorStop(1,'rgba(0,0,0,0)');ctx.fillStyle=g;ctx.beginPath();ctx.arc(x,y,28,0,Math.PI*2);ctx.fill();ctx.fillStyle=i%2?'#d4523a':'#e8b84a';ctx.beginPath();ctx.arc(x,y,7,0,Math.PI*2);ctx.fill();ctx.fillStyle='#dad4c3';ctx.fillRect(x-2,y-14,4,9);});
  const dinghies=[[2600,1920],[4950,2250],[7050,4700],[2750,7750],[7200,10400]];
  dinghies.forEach(([x,y],i)=>{ctx.save();ctx.translate(x,y);ctx.rotate(i%2?.25:-.18);ctx.fillStyle='#27383d';ctx.beginPath();ctx.moveTo(25,0);ctx.lineTo(5,-10);ctx.lineTo(-24,-7);ctx.lineTo(-24,7);ctx.lineTo(5,10);ctx.closePath();ctx.fill();ctx.strokeStyle='#8e8877';ctx.lineWidth=2;ctx.stroke();ctx.fillStyle='#171d1f';ctx.fillRect(-10,-5,18,10);ctx.restore();});
}

function wantedPoliceBase(role) {
  const match=role==='nationalGuard'?/national\s+guard|armory/i:/police\s+precinct|police\s+station/i;
  return buildings.find(building=>match.test(building.sign||''))||null;
}

function spawnWantedPoliceUnit(role) {
  if(!roadGraph.length)return false;
  const definitions={
    patrol:{model:'police',width:48,height:24,maxSpeed:4.3,turnRate:.085,acceleration:.08},
    tactical:{model:'armoredPolice',width:62,height:32,maxSpeed:3.75,turnRate:.068,acceleration:.065},
    nationalGuard:{model:'nationalGuard',width:72,height:38,maxSpeed:3.25,turnRate:.055,acceleration:.05}
  };
  const definition=definitions[role];
  if(!definition)return false;
  let start,route,responseBase='';
  const candidateUnit=(node,path)=>{
    const next=path[1]||path[0];
    return {...definition,role,x:node.x,y:node.y,angle:Math.atan2(next.y-node.y,next.x-node.x)};
  };
  if(role==='patrol'){
    for(let attempt=0;attempt<24;attempt++){
      const angle=Math.random()*Math.PI*2,distance=600+Math.random()*200;
      const target={x:player.x+Math.cos(angle)*distance,y:player.y+Math.sin(angle)*distance};
      const node=nearestRoadNode(target);
      if(!node||!isPositionOnSolidGround(node.x,node.y)||!onRoadSurface(node.x,node.y,roads,bridges,scenicRoads,roadEnds)||
        isPedestrianBlocked(node.x,node.y)||Math.hypot(node.x-player.x,node.y-player.y)<=250)continue;
      const path=roadPath(roadGraph,node,player);
      if(!path.length||!policeFootprintOnRoad(candidateUnit(node,path)))continue;
      start=node;route=path;break;
    }
  }else{
    const base=wantedPoliceBase(role);
    if(!base)return false;
    responseBase=base.sign;
    const basePoint={x:base.x+base.w*.5,y:base.y+base.h*.5};
    const candidates=roadGraph.map(node=>({node,distance:Math.hypot(node.x-basePoint.x,node.y-basePoint.y)}))
      .filter(entry=>entry.distance<520).sort((a,b)=>a.distance-b.distance);
    for(const {node} of candidates){
      const path=roadPath(roadGraph,node,player);
      if(!path.length||!policeFootprintOnRoad(candidateUnit(node,path)))continue;
      start=node;route=path;break;
    }
    if(!start)return false;
  }
  if(!start||!route?.length)return false;
  const next=route[1]||route[0];
  const unit={
    ...definition,role,responseBase,x:start.x,y:start.y,
    angle:Math.atan2(next.y-start.y,next.x-start.x),speed:0,route,routeTimer:0,
    contactCooldown:0,strobePhase:Math.random()*Math.PI*2
  };
  if(!policeFootprintOnRoad(unit))return false;
  policeCars.push(unit);
  if(role==='tactical'&&!state.tacticalCallDispatched){
    state.tacticalCallDispatched=true;
    showToast('🚔 SWAT НАПРАВЛЕНА ОТ ГОРОДСКОГО УЧАСТКА');
  }
  if(role==='nationalGuard'&&!state.guardCallDispatched){
    state.guardCallDispatched=true;
    showToast('⚠️ НАЦИОНАЛЬНАЯ ГВАРДИЯ ВЫЕХАЛА ИЗ АРСЕНАЛА');
  }
  return true;
}

function reconcilePoliceRoster(profile) {
  const desired=[['patrol',profile.patrolCount],['tactical',profile.tacticalCount],['nationalGuard',profile.guardCount]];
  for(const [role,count] of desired){
    let units=policeCars.filter(unit=>(unit.role||'patrol')===role).length;
    for(let i=policeCars.length-1;i>=0&&units>count;i--){
      if((policeCars[i].role||'patrol')===role){policeCars.splice(i,1);units--;}
    }
    for(let attempt=0;units<count&&attempt<count*2;attempt++){
      if(spawnWantedPoliceUnit(role))units++;
      else if(role!=='patrol')break;
    }
  }
}

function policeFootprintOnRoad(unit) {
  const halfLength=(unit.width||48)*.5,halfWidth=(unit.height||24)*.5;
  const cs=Math.cos(unit.angle),sn=Math.sin(unit.angle);
  return onRoadSurface(unit.x,unit.y,roads,bridges,scenicRoads,roadEnds)&&
    [[halfLength,halfWidth],[halfLength,-halfWidth],[-halfLength,halfWidth],[-halfLength,-halfWidth]].every(([x,y])=>
    onRoadSurface(unit.x+x*cs-y*sn,unit.y+x*sn+y*cs,roads,bridges,scenicRoads,roadEnds));
}

function updatePoliceAI(dt) {
  const frame=Math.min(Math.max(Number(dt)||0,0),.05)*60;
  if(!frame)return;
  state.wantedCooldown=Math.max(0,(state.wantedCooldown||0)-Math.max(0,dt));
  const evadeCard = document.getElementById('evadeStatusCard');
  const wantedPill = document.getElementById('wantedBadge');

  if (state.wanted === 0) {
    policeCars.length = 0;
    state.detainProgress=0;
    state.tacticalCallDispatched=false;state.guardCallDispatched=false;
    if (evadeCard) evadeCard.style.display = 'none';
    if (wantedPill) { wantedPill.classList.remove('active', 'evading'); }
    return;
  }

  const response=wantedResponseProfile(state.wanted);
  reconcilePoliceRoster(response);
  let anyCopSees = false;
  let canDetain=false;
  for (let i = policeCars.length - 1; i >= 0; i--) {
    const cop = policeCars[i];
    cop.strobePhase += .3*frame;
    cop.contactCooldown=Math.max(0,(cop.contactCooldown||0)-Math.max(0,dt));
    if (!isPositionOnSolidGround(cop.x, cop.y)) {
      policeCars.splice(i, 1);
      continue;
    }
    const initialDistance = Math.hypot(player.x - cop.x, player.y - cop.y);
    if (initialDistance < 450) {
      anyCopSees = true;
      if(cop.role&&cop.role!=='patrol')cop.hasMadeContact=true;
    }

    cop.routeTimer=(cop.routeTimer||0)-dt;
    if(cop.routeTimer<=0||!cop.route?.length){cop.route=roadPath(roadGraph,cop,player);cop.routeTimer=2;}
    while(cop.route.length>1&&Math.hypot(cop.route[0].x-cop.x,cop.route[0].y-cop.y)<(cop.width||48)*.58)cop.route.shift();
    const standoff=((cop.width||48)+(roam?.mode==='foot'?16:player.width||48))/2+26;
    const targetMoving=roam?.mode==='foot'?(player.gait||0)>.1:Math.abs(player.speed||0)>1;
    const atLastNode=cop.route.length===1&&Math.hypot(cop.route[0].x-cop.x,cop.route[0].y-cop.y)<22;
    const holding=!targetMoving&&(initialDistance<standoff||atLastNode);
    if(holding){
      cop.status='containing';cop.speed=0;cop.emergencyManeuver=null;cop.emergencyBlocked=false;
      if(initialDistance<standoff&&(roam?.altitude||0)<12&&state.invulnTimer===0)canDetain=true;
    }else{
    cop.status='enroute';
    tryPlanEmergencyPassing(cop,dt);
    if(cop.emergencyManeuver){
      advanceServiceRoute(cop,dt);
    }else{
    const target=cop.route[0]||cop;
    const targetAng=Math.atan2(target.y-cop.y,target.x-cop.x);
    let diff = targetAng - cop.angle;
    while (diff < -Math.PI) diff += Math.PI * 2;
    while (diff > Math.PI) diff -= Math.PI * 2;
    const oldAngle=cop.angle;
    const maxSpeed=cop.maxSpeed||4.3;
    cop.angle += Math.sign(diff)*Math.min(Math.abs(diff),(cop.turnRate||.085)*frame*Math.min(1,Math.max(.18,Math.abs(cop.speed)/maxSpeed)));
    const arrivalSpeed=cop.route.length===1?Math.min(1,Math.hypot(target.x-cop.x,target.y-cop.y)/60):1;
    const desired=(Math.abs(diff)>.45?maxSpeed*.4:maxSpeed)*arrivalSpeed;
    cop.speed+=(desired-cop.speed)*(1-Math.pow(1-(cop.acceleration||.08),frame));
    const ox=cop.x,oy=cop.y;
    cop.x+=Math.cos(cop.angle)*cop.speed*frame;cop.y+=Math.sin(cop.angle)*cop.speed*frame;
    if(!policeFootprintOnRoad(cop)){cop.x=ox;cop.y=oy;cop.speed=0;cop.routeTimer=0;if(!policeFootprintOnRoad(cop))cop.angle=oldAngle;}
    if(cop.emergencyBlocked||!emergencyPassingPoseClear(cop,cop)){
      cop.x=ox;cop.y=oy;cop.angle=oldAngle;cop.speed=0;
    }
    }
    }

    const distance=Math.hypot(player.x-cop.x,player.y-cop.y);
    if(distance<450){
      anyCopSees=true;
      if(cop.role&&cop.role!=='patrol')cop.hasMadeContact=true;
    }
    const contactRadius=34+(cop.width||48)*.04;
    if(distance<contactRadius){
      const impactSpeed=player.speed||0;
      const velocityX=Math.cos(player.angle||0)*impactSpeed,velocityY=Math.sin(player.angle||0)*impactSpeed;
      const toward=(velocityX*(cop.x-player.x)+velocityY*(cop.y-player.y))/Math.max(1,Math.hypot(velocityX,velocityY)*distance);
      if(Math.abs(impactSpeed)>3.2&&toward>.62)raiseWantedFromCrime(5,6);
      player.speed*=.75;
      if(cop.contactCooldown<=0&&state.invulnTimer===0){
        player.hp=Math.max(0,player.hp-8);cop.contactCooldown=.65;sound.playImpact();
      }
    }
  }

  state.detainProgress=canDetain?(state.detainProgress||0)+dt:Math.max(0,(state.detainProgress||0)-dt*2);
  if(canDetain&&state.detainProgress<=dt)showToast('🚨 Полиция блокирует машину · уезжайте, чтобы избежать задержания');
  if(state.detainProgress>=3){respawnPlayer('задержание');return;}

  const backupStillResponding=state.wanted>=4&&policeCars.some(unit=>unit.role&&unit.role!=='patrol'&&!unit.hasMadeContact);
  if (anyCopSees || backupStillResponding) {
    state.evading = false;
    state.evadeTimer = 5.0;
    if (evadeCard) evadeCard.style.display = 'none';
    if (wantedPill) {
      wantedPill.classList.remove('evading');
      wantedPill.classList.add('active');
    }
  } else {
    state.evading = true;
    state.evadeTimer -= dt;
    if (evadeCard) {
      evadeCard.style.display = 'flex';
      const cd = document.getElementById('evadeCountdown');
      if (cd) cd.innerText = Math.max(0, state.evadeTimer).toFixed(1);
    }
    if (wantedPill) wantedPill.classList.add('evading');

    if (state.evadeTimer <= 0) {
      state.wanted = 0;
      state.wantedCooldown=0;
      state.evading = false;
      policeCars.length = 0;
      state.tacticalCallDispatched=false;state.guardCallDispatched=false;
      if (evadeCard) evadeCard.style.display = 'none';
      if (wantedPill) wantedPill.classList.remove('active', 'evading');
      showToast('🛡️ ПОГОНЯ ОКОНЧЕНА! РОЗЫСК СНЯТ');
    }
  }
}

function renderWorld() {
  const w = window.innerWidth;
  const h = window.innerHeight;
  if (canvas.width !== w || canvas.height !== h) {
    canvas.width = w;
    canvas.height = h;
  }

  ctx.fillStyle = PALETTE.waterDark;
  ctx.fillRect(0, 0, w, h);

  ctx.save();
  const leadX = Math.cos(player.angle) * player.speed * 6;
  const leadY = Math.sin(player.angle) * player.speed * 6;
  const flightAltitude=roam?.profile?.kind==='air'?roam.altitude:0;
  // Follow the aircraft itself, not its ground shadow, so the airframe stays
  // inside the viewport while the island below remains visible as an overview.
  const center = projectIso(player.x + leadX-flightAltitude, player.y + leadY-flightAltitude);
  ctx.translate(w / 2, h / 2);
  const baseZoom = w > 900 ? 1.32 : 1.0;
  const cameraZoom = baseZoom*(1-.5*Math.min(1,flightAltitude/220));
  ctx.scale(cameraZoom, cameraZoom);
  ctx.translate(-center.x, -center.y);
  ctx.transform(Math.sqrt(3) / 2, 0.5, -Math.sqrt(3) / 2, 0.5, 0, 0);

  // Layered harbour water: depth colour, broad current bands, small wavelets
  // and broken light reflections continue beyond the playable archipelago.
  const waterRange=Math.max(4300,Math.ceil(Math.max(w,h)/cameraZoom*2)), now=performance.now();
  const sea=ctx.createLinearGradient(player.x-waterRange,player.y-waterRange,player.x+waterRange,player.y+waterRange);
  sea.addColorStop(0,'#07151d');sea.addColorStop(.42,'#0b222b');sea.addColorStop(.72,'#0b2a31');sea.addColorStop(1,'#061820');
  ctx.fillStyle=sea;ctx.fillRect(player.x-waterRange,player.y-waterRange,waterRange*2,waterRange*2);
  ctx.lineWidth=1;
  const oceanViewRadius=Math.max(2200,Math.ceil(Math.max(w,h)/cameraZoom*1.3));
  for(const chunk of visibleOceanChunks(player.x,player.y,oceanViewRadius)){
    for(const [i,wave] of chunk.waves.entries()){
      const phase=now*.00065+wave.phase;
      const px=chunk.x+wave.x+Math.sin(phase)*4,py=chunk.y+wave.y;
      ctx.strokeStyle=wave.bright?'rgba(142,184,176,.18)':'rgba(64,116,128,.15)';
      ctx.beginPath();ctx.moveTo(px,py);ctx.quadraticCurveTo(px+wave.length*.45,py-2-Math.sin(phase)*2,px+wave.length,py+1);ctx.stroke();
      if(i%4===0){ctx.strokeStyle='rgba(181,198,182,.09)';ctx.beginPath();ctx.moveTo(px+4,py+5);ctx.lineTo(px+wave.length*.7,py+6);ctx.stroke();}
    }
    if(chunk.glint){
      const px=chunk.x+360+(chunk.seed%410),py=chunk.y+260+((chunk.seed>>>9)%520);
      ctx.fillStyle='rgba(172,204,197,.2)';ctx.beginPath();ctx.ellipse(px,py,11,2.4,.08,0,Math.PI*2);ctx.fill();
    }
  }
  // 1. A broad, layered shore blends deep water into shallows and sand.
  // The same coastline remains the land/navmesh boundary, so roads and bridges
  // keep their authored connections while the beach is walkable ground.
  allIslands.forEach(isl => {
    const coastalScale=isl.natural ? 0.48 : 1;
    coastPath(ctx, isl);ctx.strokeStyle='rgba(9,31,38,.94)';ctx.lineWidth=420*coastalScale;ctx.stroke();
    ctx.strokeStyle='rgba(20,56,61,.96)';ctx.lineWidth=330*coastalScale;ctx.stroke();
    ctx.strokeStyle='rgba(64,104,96,.98)';ctx.lineWidth=255*coastalScale;ctx.stroke();
    ctx.strokeStyle='rgba(174,151,103,.98)';ctx.lineWidth=188*coastalScale;ctx.stroke();
    ctx.fillStyle = districtProfiles[isl.id]?.land||'#202721';ctx.fill();
    ctx.strokeStyle = '#686556';ctx.lineWidth = 7;ctx.stroke();
    ctx.setLineDash([38*coastalScale,29*coastalScale]);
    ctx.strokeStyle='rgba(213,222,197,.68)';ctx.lineWidth=3.5*coastalScale;ctx.stroke();ctx.setLineDash([]);
  });
  for(const detail of beachDetails){
    if(Math.abs(detail.x-player.x)>3200||Math.abs(detail.y-player.y)>3200)continue;
    if(!pointInBeach(detail.x,detail.y,detail.island,detail.natural?42:BEACH_WIDTH))continue;
    const radius=1.2+detail.seed*2.2;
    ctx.fillStyle=detail.seed>.5?'rgba(231,213,164,.32)':'rgba(73,68,51,.24)';
    ctx.beginPath();ctx.ellipse(detail.x,detail.y,radius*1.8,radius*.62,detail.seed*Math.PI,0,Math.PI*2);ctx.fill();
    if(detail.seed>.86){
      ctx.strokeStyle='rgba(91,79,53,.35)';ctx.lineWidth=1.1;
      ctx.beginPath();ctx.moveTo(detail.x-4,detail.y+3);ctx.lineTo(detail.x+4,detail.y-2);ctx.stroke();
    }
  }
  // Harbour piers, landing pads and a small airstrip occupy open waterfront land.
  for (const x of [2470,4820]) {
    ctx.fillStyle='#686357';ctx.fillRect(x,1760,45,400);
    ctx.strokeStyle='#b8a77e';ctx.lineWidth=2;
    for(let y=1760;y<2160;y+=20){ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x+45,y);ctx.stroke();}
  }
  for (const x of [2470,4820]) {
    ctx.fillStyle='#686357';ctx.fillRect(x,7480,45,430);
    ctx.strokeStyle='#b8a77e';ctx.lineWidth=2;
    for(let y=7480;y<7910;y+=20){ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x+45,y);ctx.stroke();}
  }
  for(const runway of PLANE_RUNWAYS){
    ctx.fillStyle='#373b3b';ctx.fillRect(runway.x,runway.y,runway.w,runway.h);
    ctx.strokeStyle='#c8c5ae';ctx.lineWidth=3;ctx.setLineDash([30,25]);ctx.beginPath();ctx.moveTo(runway.x+20,runway.y+runway.h/2);ctx.lineTo(runway.x+runway.w-20,runway.y+runway.h/2);ctx.stroke();ctx.setLineDash([]);
  }
  for(const [x,y] of [[1040,2070],[6550,2070],[6500,8080],[8188.4,7629.2]]){ctx.strokeStyle='#d3c58e';ctx.lineWidth=4;ctx.beginPath();ctx.arc(x,y,55,0,Math.PI*2);ctx.stroke();ctx.fillStyle='#d3c58e';ctx.font='bold 42px sans-serif';ctx.textAlign='center';ctx.fillText('H',x,y+15);}

  // Watercraft are below bridge decks in the scene graph. They remain visible
  // in open water and are naturally occluded while passing underneath.
  for(const vehicle of roam?.fleet||[])if(vehicle.kind==='water')drawTransport(ctx,vehicle,performance.now()/1000);
  if(roam?.profile?.kind==='water')drawTransport(ctx,{...roam.profile,type:roam.mode,x:player.x,y:player.y,angle:player.angle},performance.now()/1000);

  // 2. Bridges with Steel Rails
  bridges.forEach(br => {
    ctx.fillStyle = PALETTE.bridgeAsphalt;
    ctx.fillRect(br.x, br.y, br.w, br.h);
    ctx.fillStyle = '#334155';
    if (br.dir === 'v') {
      ctx.fillRect(br.x - 8, br.y, 8, br.h);
      ctx.fillRect(br.x + br.w, br.y, 8, br.h);
    } else {
      ctx.fillRect(br.x, br.y - 8, br.w, 8);
      ctx.fillRect(br.x, br.y + br.h, br.w, 8);
    }
    ctx.strokeStyle = PALETTE.roadMarkingYellow;
    ctx.lineWidth = 2.5;
    ctx.setLineDash([16, 20]);
    ctx.beginPath();
    if (br.dir === 'v') {
      ctx.moveTo(br.x + br.w / 2, br.y);
      ctx.lineTo(br.x + br.w / 2, br.y + br.h);
    } else {
      ctx.moveTo(br.x, br.y + br.h / 2);
      ctx.lineTo(br.x + br.w, br.y + br.h / 2);
    }
    ctx.stroke();
    ctx.setLineDash([]);
  });

  // Paint the entire sidewalk union before asphalt. Individual road rectangles
  // must never put a kerb or an opaque repair patch across another street.
  const roadPaint=roadPaintGeometry||(roadPaintGeometry=buildRoadPaintGeometry());
  ctx.fillStyle=PALETTE.sidewalk;ctx.beginPath();
  roads.forEach(r=>ctx.rect(r.x-36,r.y-36,r.w+72,r.h+72));ctx.fill();
  // Walkers use the strip 22 units beyond the kerb; pavement must cover it.
  ctx.strokeStyle='rgba(181,177,155,.12)';ctx.lineWidth=1;ctx.beginPath();
  for(const r of roads){
    if(r.bridgeApproach||r.serviceAccess)continue;
    if(r.dir==='h')for(let x=r.x+28;x<r.x+r.w;x+=56){
      ctx.moveTo(x,r.y-34);ctx.lineTo(x,r.y-2);ctx.moveTo(x,r.y+r.h+2);ctx.lineTo(x,r.y+r.h+34);
    }else for(let y=r.y+28;y<r.y+r.h;y+=56){
      ctx.moveTo(r.x-34,y);ctx.lineTo(r.x-2,y);ctx.moveTo(r.x+r.w+2,y);ctx.lineTo(r.x+r.w+34,y);
    }
  }ctx.stroke();
  ctx.fillStyle=PALETTE.asphalt;ctx.beginPath();
  roads.forEach(r=>ctx.rect(r.x,r.y,r.w,r.h));ctx.fill();
  for(const j of roadPaint.junctions)drawRoundedJunction(ctx,{y:j.y,h:j.h},{x:j.x,w:j.w},PALETTE.asphalt,j.approaches);
  roads.forEach(drawWetRoadSurface);
  ctx.strokeStyle=PALETTE.curb;ctx.lineWidth=2;ctx.beginPath();
  for(const edge of roadPaint.curbs){ctx.moveTo(edge.x1,edge.y1);ctx.lineTo(edge.x2,edge.y2);}ctx.stroke();
  ctx.strokeStyle=PALETTE.roadMarkingYellow;ctx.lineWidth=2.5;ctx.setLineDash([16,20]);
  for(const lane of roadPaint.lanes){ctx.lineDashOffset=-lane.phase;ctx.beginPath();ctx.moveTo(lane.x1,lane.y1);ctx.lineTo(lane.x2,lane.y2);ctx.stroke();}
  ctx.setLineDash([]);ctx.lineDashOffset=0;
  drawRoadTerminals(ctx,roadEnds);drawTransitStops();
  ctx.fillStyle='rgba(220,216,197,.48)';
  for(const j of roadPaint.junctions)junctionCrosswalkStripes({y:j.y,h:j.h},{x:j.x,w:j.w},j.approaches).forEach(s=>ctx.fillRect(s.x,s.y,s.w,s.h));
  for(const j of roadPaint.signals){
    ctx.fillRect(j.x-39,j.y+7,3,j.h/2-14);ctx.fillRect(j.x+j.w+36,j.y+j.h/2+7,3,j.h/2-14);
    ctx.fillRect(j.x+j.w/2+7,j.y+j.h+36,j.w/2-14,3);ctx.fillRect(j.x+7,j.y-39,j.w/2-14,3);
  }

  // 4. District texture and lived-in ground detail.
  drawDistrictGroundDetails();

  ctx.strokeStyle='#777362';ctx.lineWidth=14;ctx.lineCap='round';ctx.lineJoin='round';
  walkingRoutes.filter(r=>r.kind==='park').forEach(r=>{ctx.beginPath();r.points.forEach((p,i)=>i?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y));if(r.loop)ctx.closePath();ctx.stroke();});

  // 5. Tire Skidmarks
  skidmarks.forEach(sm => {
    ctx.save();
    ctx.translate(sm.x, sm.y);
    ctx.rotate(sm.angle);
    ctx.fillStyle = `rgba(5, 7, 10, ${sm.alpha * 1.2})`;
    ctx.fillRect(-14, -8, 10, 4);
    ctx.fillRect(-14, 6, 10, 4);
    ctx.restore();
  });

  // 5. Breakable Hydrants & Dumpsters
  breakableProps.forEach(prop => {
    if (prop.intact) {
      if (prop.type === 'hydrant') {
        ctx.fillStyle = '#dc2626';
        ctx.beginPath();
        ctx.arc(prop.x, prop.y, 7, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#fca5a5';
        ctx.fillRect(prop.x - 3, prop.y - 3, 6, 6);
      } else {
        ctx.fillStyle = '#1e3a29';
        ctx.fillRect(prop.x - prop.w / 2, prop.y - prop.h / 2, prop.w, prop.h);
        ctx.strokeStyle = '#0f2419';
        ctx.lineWidth = 1.5;
        ctx.strokeRect(prop.x - prop.w / 2, prop.y - prop.h / 2, prop.w, prop.h);
      }
    }
  });

  // 6. Tuning Parts Glow
  const pulse = Math.sin(performance.now() * 0.005) * 5;
  CARPARTS.forEach(p => {
    if (!p.found) {
      const g = ctx.createRadialGradient(p.x, p.y, 2, p.x, p.y, 28 + pulse);
      g.addColorStop(0, 'rgba(245, 158, 11, 0.45)');
      g.addColorStop(1, 'rgba(245, 158, 11, 0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(p.x, p.y, 28 + pulse, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#f59e0b';
      ctx.fillRect(p.x - 10, p.y - 10, 20, 20);
      ctx.fillStyle = '#fff';
      ctx.font = '900 11px Inter, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('⭐', p.x, p.y + 4);
    }
  });

  // 7. Volumetric district scenery and detailed buildings.
  drawShoreLife();
  drawCityScenery();

  // Ground depth determines whether a pedestrian passes in front of or behind
  // nearby traffic. The person is drawn upright inside the world transform.
  drawStreetActors(w,h,center,cameraZoom);

  // Water Splashes
  waterSplashes.forEach((sp, idx) => {
    ctx.fillStyle = `rgba(180, 210, 240, ${sp.alpha})`;
    ctx.beginPath();ctx.arc(sp.x, sp.y, sp.size, 0, Math.PI * 2);ctx.fill();
    sp.x += sp.vx;sp.y += sp.vy;sp.alpha -= 0.02;
    if (sp.alpha <= 0) waterSplashes.splice(idx, 1);
  });

  ctx.restore();

  drawNoirPostFx(w,h);

  if(state.deathFlash>0){
    ctx.save();ctx.fillStyle=`rgba(90,0,0,${state.deathFlash*.58})`;ctx.fillRect(0,0,w,h);
    ctx.fillStyle=`rgba(245,224,205,${Math.min(1,state.deathFlash*1.8)})`;ctx.font='900 34px Inter, sans-serif';ctx.textAlign='center';ctx.fillText('ВОЗРОЖДЕНИЕ',w*.5,h*.5);ctx.restore();
  }

  // Radar & HUD
  renderRadar();
  const speedEl = document.getElementById('hudSpeed');
  if (speedEl) speedEl.innerText = roam?.mode === 'foot' ? 'ПЕШКОМ' : Math.round(Math.abs(player.speed) * 12);
  const enterEl=document.getElementById('btnRoamEnter');if(enterEl)enterEl.textContent=roam?.mode==='foot'?'Сесть · E':'Выйти · E';
  const flyEl=document.getElementById('btnRoamFly');if(flyEl)flyEl.style.display=roam?.profile?.kind==='air'?'':'none';
  const gearEl = document.getElementById('hudGear');
  if (gearEl) gearEl.innerText = player.gear;
  const rpmEl = document.getElementById('hudRpm');
  if (rpmEl) rpmEl.style.width = Math.round(player.rpm * 100) + '%';
  const cashEl = document.getElementById('hudCash');
  if (cashEl) cashEl.innerText = state.cash;
  const hpBarEl = document.getElementById('hudHpBar');
  if (hpBarEl) hpBarEl.style.width = Math.max(0, player.hp) + '%';
  const hpValEl = document.getElementById('hudHpVal');
  if (hpValEl) hpValEl.innerText = Math.round(player.hp) + '%';

  for (let i = 1; i <= 5; i++) {
    const star = document.getElementById(`star${i}`);
    if (star) {
      if (i <= state.wanted) {
        if (state.evading) {
          star.classList.remove('lit');
          star.classList.add('evade-lit');
        } else {
          star.classList.remove('evade-lit');
          star.classList.add('lit');
        }
      } else {
        star.classList.remove('lit', 'evade-lit');
      }
    }
  }
}

function drawScreenPedestrian(ped,sx,sy,index,zoom=1){
  // Identity size stays fixed. Only the camera scales the complete figure.
  const size=(ped.player?1.12:(ped.visualScale??.9))*zoom;
  const heading=ped.heading??(ped.vx<0?Math.PI:0);
  const direction=projectIso(Math.cos(heading),Math.sin(heading));
  const norm=Math.hypot(direction.x,direction.y);
  const fx=direction.x/norm,fy=direction.y/norm;
  const back=fy<-.2,profile=Math.abs(fx);
  const swing=Math.sin(ped.walkPhase||0)*(ped.gait||0);
  const shoulder=3.8-profile*.9,hip=2.1-profile*.5;
  const shirt=ped.shirt||'#62503f',pants=ped.pants||'#22262a',skin=ped.skin||'#c99f77';
  const accessory=ped.accessory||'';
  ctx.save();ctx.translate(sx,sy);ctx.scale(size,size);
  ctx.fillStyle='rgba(0,0,0,.45)';ctx.beginPath();ctx.ellipse(2,1,6,2.7,-.15,0,Math.PI*2);ctx.fill();
  if(ped.stance==='down'){
    ctx.save();ctx.rotate(-.16);ctx.fillStyle=pants;ctx.fillRect(-7,-4,10,3.5);
    ctx.fillStyle=shirt;ctx.fillRect(-1,-5.3,7,4.6);ctx.fillStyle=skin;
    ctx.beginPath();ctx.ellipse(7,-3.2,2.3,2.1,0,0,Math.PI*2);ctx.fill();ctx.restore();ctx.restore();return;
  }
  const limb=(points,color,width)=>{ctx.strokeStyle=color;ctx.lineWidth=width;ctx.lineCap='round';ctx.lineJoin='round';ctx.beginPath();points.forEach(([x,y],i)=>i?ctx.lineTo(x,y):ctx.moveTo(x,y));ctx.stroke();};
  for(const side of [-1,1]){
    const stride=swing*side*3.5,footX=side*hip+fx*stride,footY=fy*stride*.5;
    limb([[side*hip,-11],[side*hip+fx*stride*.45,-5.5],[footX,footY-Math.max(0,stride)*.15]],pants,2.7);
    limb([[footX,footY],[footX+fx*1.7,footY+fy*.7]],'#101315',2.3);
  }
  if(accessory==='backpack'||accessory==='shoulderBag'){
    ctx.fillStyle=accessory==='backpack'?'#514638':'#604535';ctx.fillRect(-shoulder-3,-19,4,8);
    ctx.fillStyle='rgba(206,180,125,.65)';ctx.fillRect(-shoulder-2,-18,1,5);
  }
  const arm=side=>{
    if((ped.activity==='coffee'||ped.activity==='reading')&&side===(fx>0?1:-1)){
      limb([[side*shoulder,-21],[side*(shoulder+1),-17],[side*2,-19]],shirt,2.3);
      ctx.fillStyle=skin;ctx.fillRect(side*2-1,-20,2,2);
      ctx.fillStyle=ped.activity==='coffee'?'#e2d3b3':'#8b9f91';
      ctx.fillRect(side*2-1.5,-22,ped.activity==='coffee'?3:5,3.5);return;
    }
    if(ped.activity==='talking'&&side===(fx>0?1:-1)){
      const gesture=Math.sin(performance.now()/350+index)*1.2;
      limb([[side*shoulder,-21],[side*(shoulder+2),-18],[side*(shoulder+4),-21+gesture]],shirt,2.3);
      ctx.fillStyle=skin;ctx.fillRect(side*(shoulder+4)-1,-22+gesture,2,2);return;
    }
    if((ped.activity==='checkingPhone'||ped.activity==='checkingTimetable')&&side===(fx>0?1:-1)){
      limb([[side*shoulder,-21],[side*(shoulder+1),-16],[side*2,-20]],shirt,2.3);
      ctx.fillStyle=skin;ctx.fillRect(side*2-1,-21,2,2);ctx.fillStyle='#161b1d';ctx.fillRect(side*2-1,-23,2.4,3);return;
    }
    if(ped.stance==='handsUp'||ped.stance==='fighting'){
      const raised=ped.stance==='handsUp'||side===(fx>0?1:-1);
      const elbowY=raised?-27:-24,handY=raised?-31:-23;
      limb([[side*shoulder,-21],[side*(shoulder+1.2),elbowY],[side*(shoulder+2),handY]],shirt,2.3);
      ctx.fillStyle=skin;ctx.beginPath();ctx.arc(side*(shoulder+2),handY,1.35,0,Math.PI*2);ctx.fill();return;
    }
    const stride=-swing*side*2.8;
    limb([[side*shoulder,-21],[side*(shoulder+1)+fx*stride*.45,-16],[side*(shoulder+.8)+fx*stride,-11+fy*stride*.4]],shirt,2.3);
    ctx.fillStyle=skin;ctx.beginPath();ctx.ellipse(side*(shoulder+.8)+fx*stride,-10.5+fy*stride*.4,1.1,1.5,0,0,Math.PI*2);ctx.fill();
  };
  arm(fx>0?-1:1);
  const coat=ctx.createLinearGradient(-shoulder,-22,shoulder,-12);
  coat.addColorStop(0,shirt);coat.addColorStop(.55,shirt);coat.addColorStop(1,'#23272a');ctx.fillStyle=coat;
  ctx.beginPath();ctx.moveTo(-shoulder,-21);ctx.quadraticCurveTo(0,-23,shoulder,-21);ctx.lineTo(3,-10);ctx.lineTo(-3,-10);ctx.closePath();ctx.fill();
  if(!back){
    limb([[fx,-21],[fx*.6,-11]],'rgba(12,15,18,.65)',.8);
    limb([[-2,-21],[0,-18],[2,-21]],'#b5a58a',.8);
    ctx.fillStyle='#a69778';for(const y of [-16,-13])ctx.fillRect(fx+.6,y,.7,.7);
  }else limb([[-2.7,-19],[2.7,-19]],'rgba(12,15,18,.35)',.7);
  if(accessory==='satchel'||accessory==='shoulderBag'){
    limb([[-shoulder,-21],[0,-17],[shoulder,-11]],'#70523a',.9);
    ctx.fillStyle='#4b382c';ctx.fillRect(shoulder-1,-15,3.4,4.2);
  }
  arm(fx>0?1:-1);
  if(ped.activity==='shopping'){
    ctx.fillStyle='#bc9770';ctx.fillRect(shoulder+1,-12,4.5,6);
    ctx.strokeStyle='#6e5940';ctx.lineWidth=.7;ctx.strokeRect(shoulder+2,-14,2.5,3);
  }
  ctx.fillStyle=skin;ctx.fillRect(-1.2,-25,2.4,3.5);
  const head=ctx.createLinearGradient(-2.8,-29,3,-24);head.addColorStop(0,skin);head.addColorStop(1,'#80674e');
  ctx.fillStyle=back?(ped.hair||'#211915'):head;ctx.beginPath();ctx.ellipse(0,-26.5,2.8-profile*.35,3.7,0,0,Math.PI*2);ctx.fill();
  ctx.fillStyle=ped.hair||'#211915';ctx.beginPath();ctx.ellipse(-fx*.45,-28.3,2.8,2,0,Math.PI,Math.PI*2);ctx.fill();
  if(!back){ctx.fillStyle=skin;ctx.fillRect(fx*2.2,-26.5,1,1.5);ctx.fillStyle='#30271e';ctx.fillRect(fx*1.3,-27,.7,.7);}
  if(accessory==='cap'||accessory==='beanie'){
    ctx.fillStyle=accessory==='cap'?'#354044':'#734b3c';ctx.beginPath();ctx.ellipse(0,-29.2,3.1,1.8,0,Math.PI,Math.PI*2);ctx.fill();
    ctx.fillRect(fx>0?-1.7:-2.8,-29.4,4.8,1.2);
  }else if(accessory==='hood'){
    ctx.strokeStyle='#5d5143';ctx.lineWidth=1.8;ctx.beginPath();ctx.arc(0,-27,3.6,Math.PI,Math.PI*2);ctx.stroke();
  }else if(accessory==='scarf'){
    ctx.fillStyle='#b16448';ctx.fillRect(-2.5,-23,5,2.3);ctx.fillRect(fx>0?1:-2,-22,1.5,5);
  }else if(accessory==='vest'){
    ctx.strokeStyle='#e1b447';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(-2.2,-20);ctx.lineTo(2.2,-12);ctx.moveTo(2.2,-20);ctx.lineTo(-2.2,-12);ctx.stroke();
  }
  if(index%6===0){ctx.fillStyle='#25282b';ctx.fillRect(-3.1,-30,6.2,1.8);ctx.fillRect(-2.3,-31.7,4.6,2);}
  if(index%5===0){limb([[shoulder,-20],[shoulder+1,-12]],'#201c19',.8);ctx.fillStyle='#513d2e';ctx.fillRect(shoulder,-13,3,5);ctx.strokeStyle='#907453';ctx.lineWidth=.5;ctx.strokeRect(shoulder,-13,3,5);}
  if(ped.player){ctx.strokeStyle='#e8b84a';ctx.lineWidth=1;ctx.beginPath();ctx.ellipse(0,2,8,4,0,0,Math.PI*2);ctx.stroke();}
  if(ped.medicalTreated){
    ctx.fillStyle='#cbe5e7';ctx.fillRect(-2,-38,4,10);ctx.fillRect(-5,-35,10,4);
    ctx.strokeStyle='#17252b';ctx.lineWidth=.7;ctx.strokeRect(-5,-38,10,10);
  }
  if(ped.reaction==='fleeing'||ped.reaction==='curious'){
    ctx.fillStyle=ped.reaction==='fleeing'?'#ef6655':'#f0c46c';
    ctx.font='bold 8px monospace';ctx.textAlign='center';
    ctx.fillText(ped.reaction==='fleeing'?'!':'?',0,-35);
  }
  ctx.restore();
}

function drawCityIncidentMarker(incident){
  const pulse=1+Math.sin(performance.now()/180)*.13;
  ctx.save();ctx.translate(incident.x,incident.y);
  ctx.transform(1/Math.sqrt(3),-1/Math.sqrt(3),1,1,0,0);
  if(incident.kind==='fire'&&!incident.fireSuppressed){
    ctx.fillStyle='rgba(239,92,40,.2)';ctx.beginPath();ctx.ellipse(0,-17,33,24,0,0,Math.PI*2);ctx.fill();
    for(let i=0;i<5;i++){
      const drift=Math.sin(performance.now()/210+i*1.7)*5,rise=(performance.now()/70+i*13)%32;
      ctx.fillStyle=i%2?'rgba(226,76,37,.82)':'rgba(245,174,62,.76)';
      ctx.beginPath();ctx.ellipse((i-2)*9+drift,-18-rise,5+(i%2)*2,9+(i%3),drift*.025,0,Math.PI*2);ctx.fill();
    }
    ctx.fillStyle='rgba(31,35,34,.3)';
    for(let i=0;i<4;i++){const drift=Math.sin(performance.now()/480+i)*8;const rise=(performance.now()/160+i*16)%50;ctx.beginPath();ctx.arc(-12+i*8+drift,-34-rise,5+i*1.2,0,Math.PI*2);ctx.fill();}
  }else if(incident.kind==='fire'&&incident.fireSuppressed){
    ctx.fillStyle='rgba(172,190,183,.16)';ctx.beginPath();ctx.ellipse(0,-14,26,15,0,0,Math.PI*2);ctx.fill();
    for(let i=0;i<4;i++){
      const drift=Math.sin(performance.now()/380+i*1.4)*5,rise=(performance.now()/145+i*11)%27;
      ctx.fillStyle='rgba(194,205,196,.38)';ctx.beginPath();ctx.arc((i-1.5)*8+drift,-18-rise,4+i%2*2,0,Math.PI*2);ctx.fill();
    }
  }
  ctx.globalAlpha=.78;ctx.fillStyle='rgba(10,13,15,.82)';ctx.strokeStyle='#e8b84a';ctx.lineWidth=2;
  ctx.beginPath();ctx.arc(0,-8,13*pulse,0,Math.PI*2);ctx.fill();ctx.stroke();
  ctx.fillStyle='#f4ede0';ctx.font='bold 12px monospace';ctx.textAlign='center';ctx.textBaseline='middle';
  ctx.fillText(incident.mark,0,-8);
  ctx.fillStyle='#f0c46c';ctx.font='bold 8px monospace';ctx.fillText(incident.title,0,-27);
  ctx.restore();
}

function streetActorDepth(actor){
  let depth=actor.x+actor.y;
  for(const b of buildings){
    const right=b.x+b.w,front=b.y+b.h;
    // A person beside either visible wall is in front of that wall, even
    // before reaching the building's nearest corner. Rear walls still occlude
    // naturally through painter order; never discard the entire sprite.
    const alongRight=actor.x>=right-1&&actor.x<=right+60&&actor.y>=b.y&&actor.y<=front+30;
    const alongFront=actor.y>=front-1&&actor.y<=front+60&&actor.x>=b.x&&actor.x<=right+30;
    if(alongRight||alongFront)depth=Math.max(depth,right+front+1);
  }
  return depth;
}

function drawStreetActors(w,h,center,zoom){
  const actors=[];
  // Small shoreline flocks stay above the scenery and never enter collision lists.
  for(const [index,island] of islands.entries()){
    const phase=performance.now()/18000+index*.8;
    const x=island.x+island.w*.12+Math.cos(phase)*190,y=island.y+island.h*.3+Math.sin(phase)*130;
    if(Math.abs(x-player.x)>1800||Math.abs(y-player.y)>1800)continue;
    actors.push({depth:Infinity,draw:()=>{
      for(let bird=0;bird<3;bird++){
        const wing=3+Math.sin(performance.now()/160+bird*1.6)*2;
        ctx.strokeStyle='rgba(202,208,188,.65)';ctx.lineWidth=1.2;ctx.beginPath();
        ctx.moveTo(x+bird*17-6-85,y+bird*9-wing-85);ctx.lineTo(x+bird*17-85,y+bird*9-85);
        ctx.lineTo(x+bird*17+6-85,y+bird*9-wing-85);ctx.stroke();
      }
    }});
  }
  for(const j of (roadPaintGeometry||(roadPaintGeometry=buildRoadPaintGeometry())).signals){
    for(const [x,y,axis] of [[j.x-42,j.y-16,'x'],[j.x+j.w+42,j.y+j.h+16,'x'],
      [j.x-16,j.y-42,'y'],[j.x+j.w+16,j.y+j.h+42,'y']]){
      if(Math.abs(x-player.x)<1700&&Math.abs(y-player.y)<1700)actors.push({depth:x+y,draw:()=>drawStreetSignal(x,y,axis)});
    }
  }
  buildings.forEach((b,index)=>{
    if(Math.abs(b.x+b.w/2-player.x)>1800||Math.abs(b.y+b.h/2-player.y)>1800)return;
    actors.push({depth:b.x+b.y+b.w+b.h,draw:()=>drawBuilding(b,index)});
  });
  trees.forEach((tree,index)=>{
    if(Math.abs(tree.x-player.x)>1500||Math.abs(tree.y-player.y)>1500)return;
    actors.push({depth:tree.x+tree.y,draw:()=>drawStreetTree(ctx,tree,index)});
  });
  streetProps.forEach(p=>actors.push({depth:p.x+p.y+p.height/2,draw:()=>drawStreetFurniture(ctx,p)}));
  billboards.forEach(board=>actors.push({depth:board.x+board.y,draw:()=>drawBillboard(board)}));
  streetLights.forEach((lamp,index)=>actors.push({depth:lamp.x+lamp.y,draw:()=>drawStreetLamp(lamp,index)}));
  const activeIncident=cityIncidentDirector?.current();
  if(activeIncident&&Math.abs(activeIncident.x-player.x)<1500&&Math.abs(activeIncident.y-player.y)<1500){
    actors.push({depth:activeIncident.x+activeIncident.y+2,draw:()=>drawCityIncidentMarker(activeIncident)});
  }
  const addVehicle=(vehicle,draw)=>actors.push({depth:streetActorDepth(vehicle),draw});
  trafficCars.forEach(c=>addVehicle(c,()=>drawDetailedCar(ctx,c.x,c.y,c.angle,c.color,c.width||46,c.height||22,false,c.type,stuntHeightFor(c))));
  policeCars.forEach(c=>addVehicle(c,()=>drawDetailedCar(ctx,c.x,c.y,c.angle,'#0f172a',c.width||48,c.height||24,true,c.model||'police',stuntHeightFor(c))));
  incidentPoliceCars.forEach(c=>addVehicle(c,()=>drawDetailedCar(ctx,c.x,c.y,c.angle,'#0f172a',48,24,true,'police',stuntHeightFor(c))));
  incidentResponseVehicles.forEach(c=>addVehicle(c,()=>drawDetailedCar(ctx,c.x,c.y,c.angle,c.color,c.width,c.height,false,c.model,stuntHeightFor(c))));
  airMedicalVehicles.forEach(unit=>actors.push({depth:Infinity,draw:()=>{
    if(unit.status==='onscene'){
      ctx.strokeStyle='rgba(220,226,213,.7)';ctx.lineWidth=1.5;ctx.beginPath();
      ctx.moveTo(unit.x-unit.altitude,unit.y-unit.altitude);ctx.lineTo(unit.x,unit.y);ctx.stroke();
    }
    drawTransport(ctx,unit,performance.now()/1000,unit.altitude);
  }}));
  for(const wreck of activeIncident?.wrecks||[])addVehicle(wreck,()=>drawDetailedCar(ctx,wreck.x,wreck.y,wreck.angle,wreck.color,wreck.width,wreck.height,false,wreck.type));
  for(const vehicle of roam?.fleet||[])if(vehicle.kind!=='water')
    addVehicle(vehicle,()=>drawTransport(ctx,vehicle,performance.now()/1000,stuntHeightFor(vehicle)));

  const people=[...pedestrians,...(activeIncident?.actors||[])];
  if(roam?.mode==='foot')people.push({x:player.x,y:player.y,heading:player.angle,gait:player.gait||0,walkPhase:player.walkPhase||0,shirt:'#735235',pants:'#22272b',skin:'#d5b594',hair:'#1a1512',player:true});
  people.forEach((ped,index)=>{
    const ground=projectIso(ped.x,ped.y);
    const sx=w/2+(ground.x-center.x)*zoom,sy=h/2+(ground.y-center.y)*zoom;
    if(sx<-40||sx>w+40||sy<-60||sy>h+30)return;
    actors.push({depth:streetActorDepth(ped),draw:()=>{
      ctx.save();ctx.translate(ped.x,ped.y);
      // Undo the isometric basis. The outer camera zoom still applies.
      ctx.transform(1/Math.sqrt(3),-1/Math.sqrt(3),1,1,0,0);
      drawScreenPedestrian(ped,0,0,index);
      ctx.restore();
    }});
  });

  if(roam?.special){
    if(roam.mode!=='foot'&&roam.profile.kind!=='water')
      actors.push({depth:roam.altitude>12?Infinity:player.x+player.y,draw:()=>drawTransport(ctx,{...roam.profile,type:roam.mode,x:player.x,y:player.y,angle:player.angle,speed:player.speed,occupied:true},performance.now()/1000,roam.altitude+stuntHeightFor(player))});
  }else{
    if(!state.isDrowning){
      ctx.save();ctx.translate(player.x,player.y);ctx.rotate(player.angle);ctx.translate(88,0);ctx.scale(1,.34);
      const light=ctx.createRadialGradient(0,0,2,0,0,110);
      light.addColorStop(0,'rgba(255,245,210,.28)');light.addColorStop(.55,'rgba(255,230,160,.12)');light.addColorStop(1,'rgba(255,230,160,0)');
      ctx.fillStyle=light;ctx.fillRect(-110,-110,220,220);ctx.restore();
    }
    addVehicle(player,()=>{
      ctx.save();ctx.globalAlpha=state.isDrowning?Math.max(.2,1-state.drownProgress):1;
      if(roam&&roam.mode!=='sedan')drawTransport(ctx,{...roam.profile,type:roam.mode,x:player.x,y:player.y,angle:player.angle,speed:player.speed,color:player.bodyColor,occupied:true},performance.now()/1000,stuntHeightFor(player));
      else drawDetailedCar(ctx,player.x,player.y,player.angle,player.bodyColor,player.width,player.height,false,'taxi',stuntHeightFor(player));ctx.restore();
    });
  }
  actors.sort((a,b)=>a.depth-b.depth).forEach(actor=>actor.draw());
}

function drawDetailedCar(ctx, x, y, ang, color, w, h, isPolice = false, model = 'sedan', lift = 0) {
  if(!isPolice&&model==='truck'){
    drawTransport(ctx,{type:'truck',kind:'land',x,y,angle:ang,color,width:w,height:h},performance.now()/1000,lift);
    return;
  }
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(ang);
  const serviceType=model==='fireEngine'||model==='ambulance'?model:null;
  const tacticalPolice=isPolice&&model==='armoredPolice',nationalGuard=isPolice&&model==='nationalGuard';
  const kind=nationalGuard?'truck':tacticalPolice?'van':isPolice?'police':serviceType==='fireEngine'?'truck':serviceType==='ambulance'?'van':model;
  const elevation=(kind==='bus'?9:kind==='van'?8.5:kind==='truck'?7.5:kind==='coupe'||kind==='sports'?5.2:6.5), cs=Math.cos(ang), sn=Math.sin(ang);
  // Inverse-rotated world vertical; after the camera transform this stays an
  // upright screen-space extrusion at every vehicle heading.
  const zx=-elevation*(cs+sn), zy=elevation*(sn-cs);
  const paint=nationalGuard?'#70765a':tacticalPolice?'#50595d':isPolice?'#dedfda':color;
  const bodies={
    coupe:[[-w*.5,-h*.34],[-w*.34,-h*.48],[w*.38,-h*.46],[w*.5,-h*.25],[w*.5,h*.25],[w*.38,h*.46],[-w*.34,h*.48],[-w*.5,h*.34]],
    sports:[[-w*.5,-h*.31],[-w*.31,-h*.47],[w*.4,-h*.43],[w*.5,-h*.22],[w*.5,h*.22],[w*.4,h*.43],[-w*.31,h*.47],[-w*.5,h*.31]],
    wagon:[[-w*.5,-h*.43],[w*.36,-h*.5],[w*.5,-h*.3],[w*.5,h*.3],[w*.36,h*.5],[-w*.5,h*.43]],
    bus:[[-w*.5,-h*.48],[w*.38,-h*.48],[w*.5,-h*.34],[w*.5,h*.34],[w*.38,h*.48],[-w*.5,h*.48]],
    van:[[-w*.5,-h*.46],[w*.34,-h*.48],[w*.5,-h*.31],[w*.5,h*.31],[w*.34,h*.48],[-w*.5,h*.46]],
    truck:[[-w*.5,-h*.48],[w*.36,-h*.48],[w*.5,-h*.31],[w*.5,h*.31],[w*.36,h*.48],[-w*.5,h*.48]]
  };
  const body=bodies[kind]||[[-w*.5+h*.12,-h*.48], [w*.35,-h*.5], [w*.5,-h*.3], [w*.5,h*.3], [w*.35,h*.5], [-w*.5+h*.12,h*.48], [-w*.5,h*.28], [-w*.5,-h*.28]];
  const poly=(points,fill,stroke,width=1)=>{ctx.beginPath();points.forEach(([px,py],i)=>i?ctx.lineTo(px,py):ctx.moveTo(px,py));ctx.closePath();ctx.fillStyle=fill;ctx.fill();if(stroke){ctx.strokeStyle=stroke;ctx.lineWidth=width;ctx.stroke();}};
  const raised=(points,mult=1)=>points.map(([px,py])=>[px+zx*mult,py+zy*mult]);
  const volume=(points,low,high,topFill,faceFill='#17252d')=>{
    const lower=raised(points,low),upper=raised(points,high);
    for(let i=0;i<points.length;i++)poly([lower[i],lower[(i+1)%points.length],upper[(i+1)%points.length],upper[i]],i%2?faceFill:'#0f1a20','#080d10',.75);
    poly(upper,topFill,'#090d10',1);return{lower,upper};
  };

  ctx.save();ctx.globalCompositeOperation='screen';
  const tailGlow=ctx.createLinearGradient(-w*.95,0,-w*.36,0);tailGlow.addColorStop(0,'rgba(204,24,16,0)');tailGlow.addColorStop(.72,'rgba(232,33,18,.1)');tailGlow.addColorStop(1,'rgba(255,47,22,.28)');
  ctx.fillStyle=tailGlow;ctx.beginPath();ctx.ellipse(-w*.54,0,w*.52,h*.3,0,0,Math.PI*2);ctx.fill();ctx.restore();
  ctx.fillStyle='rgba(0,0,0,.62)';ctx.beginPath();ctx.ellipse(2,5,w*.6,h*.65,0,0,Math.PI*2);ctx.fill();

  ctx.restore();
  ctx.save();ctx.translate(x-lift,y-lift);ctx.rotate(ang);

  // Four readable wheels remain planted on the road while the body rises.
  for(const wx of [-w*.29,w*.27])for(const wy of [-h*.49,h*.49]){
    ctx.fillStyle='#050607';ctx.beginPath();ctx.ellipse(wx,wy,6.5,4.2,0,0,Math.PI*2);ctx.fill();
    ctx.fillStyle='#596066';ctx.beginPath();ctx.ellipse(wx,wy,3.25,2.15,0,0,Math.PI*2);ctx.fill();
    ctx.fillStyle='#171b1e';ctx.beginPath();ctx.ellipse(wx,wy,1.25,.9,0,0,Math.PI*2);ctx.fill();
  }
  // Lower body faces provide real height from all eight driving directions.
  for(let i=0;i<body.length;i++){
    const a=body[i],b=body[(i+1)%body.length];
    const side=nationalGuard?(i%2?'#444b39':'#545a43'):tacticalPolice?(i%2?'#333b40':'#41494d'):isPolice?(i===0||i===4?'#1e4778':'#8f9697'):(i<4?'rgba(20,24,27,.94)':'rgba(8,11,13,.9)');
    poly([a,b,[b[0]+zx,b[1]+zy],[a[0]+zx,a[1]+zy]],side,'#090b0d',.8);
  }
  const top=raised(body);
  poly(top,paint,'#080a0c',1.25);

  // Bonnet, trunk, shoulder creases and bumpers make heading unmistakable.
  ctx.strokeStyle='rgba(255,238,202,.28)';ctx.lineWidth=1;
  ctx.beginPath();ctx.moveTo(w*.19+zx,-h*.41+zy);ctx.lineTo(w*.43+zx,-h*.24+zy);ctx.lineTo(w*.43+zx,h*.24+zy);ctx.lineTo(w*.19+zx,h*.41+zy);ctx.stroke();
  ctx.strokeStyle='rgba(0,0,0,.45)';ctx.beginPath();ctx.moveTo(-w*.3+zx,-h*.38+zy);ctx.lineTo(-w*.3+zx,h*.38+zy);ctx.stroke();
  ctx.strokeStyle='rgba(255,255,255,.24)';ctx.beginPath();ctx.moveTo(-w*.42+zx,-h*.43+zy);ctx.lineTo(w*.34+zx,-h*.45+zy);ctx.stroke();

  // Police livery follows both flanks instead of floating above the vehicle.
  if(nationalGuard){
    poly(raised([[-w*.43,-h*.45],[w*.37,-h*.45],[w*.43,-h*.31],[-w*.43,-h*.31]]),'#b39a4d','#4c452e',.7);
    poly(raised([[-w*.43,h*.31],[w*.43,h*.31],[w*.37,h*.45],[-w*.43,h*.45]]),'#b39a4d','#4c452e',.7);
  }else if(tacticalPolice){
    poly(raised([[-w*.43,-h*.45],[w*.37,-h*.45],[w*.43,-h*.31],[-w*.43,-h*.31]]),'#263744','#111b21',.8);
    poly(raised([[-w*.43,h*.31],[w*.43,h*.31],[w*.37,h*.45],[-w*.43,h*.45]]),'#263744','#111b21',.8);
  }else if(isPolice){
    poly(raised([[-w*.43,-h*.47],[w*.34,-h*.48],[w*.4,-h*.35],[-w*.43,-h*.35]]),'#28558a','#153151',.7);
    poly(raised([[-w*.43,h*.35],[w*.4,h*.35],[w*.34,h*.48],[-w*.43,h*.47]]),'#28558a','#153151',.7);
  }else if(serviceType){
    const stripe=serviceType==='fireEngine'?'#f0cb65':'#c74739';
    poly(raised([[-w*.43,-h*.45],[w*.37,-h*.45],[w*.43,-h*.32],[-w*.43,-h*.32]]),stripe,'#3b2822',.6);
    poly(raised([[-w*.43,h*.32],[w*.43,h*.32],[w*.37,h*.45],[-w*.43,h*.45]]),stripe,'#3b2822',.6);
    if(serviceType==='fireEngine'){
      ctx.strokeStyle='#ddd5bf';ctx.lineWidth=2;
      ctx.beginPath();ctx.moveTo(-w*.42+zx*2.1,-h*.18+zy*2.1);ctx.lineTo(-w*.08+zx*2.1,-h*.18+zy*2.1);ctx.moveTo(-w*.42+zx*2.1,h*.18+zy*2.1);ctx.lineTo(-w*.08+zx*2.1,h*.18+zy*2.1);ctx.stroke();
    }else{
      const cx=-w*.08+zx*2.2,cy=zy*2.2;ctx.fillStyle='#bd4338';ctx.fillRect(cx-1.5,cy-5,3,10);ctx.fillRect(cx-5,cy-1.5,10,3);
    }
  }

  // Each class owns a distinct roofline instead of sharing one sedan shape.
  const cabins={
    coupe:[[-w*.29,-h*.31],[w*.03,-h*.31],[w*.18,-h*.16],[w*.18,h*.16],[w*.03,h*.31],[-w*.29,h*.31],[-w*.36,h*.17],[-w*.36,-h*.17]],
    sports:[[-w*.31,-h*.29],[-w*.02,-h*.29],[w*.15,-h*.14],[w*.15,h*.14],[-w*.02,h*.29],[-w*.31,h*.29],[-w*.38,h*.15],[-w*.38,-h*.15]],
    wagon:[[-w*.34,-h*.36],[w*.14,-h*.35],[w*.26,-h*.19],[w*.26,h*.19],[w*.14,h*.35],[-w*.34,h*.36],[-w*.4,h*.21],[-w*.4,-h*.21]],
    bus:[[-w*.44,-h*.39],[w*.32,-h*.39],[w*.42,-h*.23],[w*.42,h*.23],[w*.32,h*.39],[-w*.44,h*.39]],
    van:[[-w*.4,-h*.38],[w*.18,-h*.37],[w*.34,-h*.22],[w*.34,h*.22],[w*.18,h*.37],[-w*.4,h*.38]],
    truck:[[w*.03,-h*.36],[w*.27,-h*.35],[w*.39,-h*.2],[w*.39,h*.2],[w*.27,h*.35],[w*.03,h*.36],[-w*.02,h*.2],[-w*.02,-h*.2]]
  };
  const cabinBase=cabins[kind]||[[-w*.2,-h*.36],[w*.14,-h*.35],[w*.27,-h*.19],[w*.27,h*.19],[w*.14,h*.35],[-w*.2,h*.36],[-w*.29,h*.2],[-w*.29,-h*.2]];
  const cabinHeight=kind==='bus'?2.5:kind==='van'?2.35:kind==='truck'?2.1:kind==='coupe'||kind==='sports'?1.55:1.82;
  const cabinLow=raised(cabinBase,1.08), cabinTop=raised(cabinBase,cabinHeight);
  for(let i=0;i<cabinBase.length;i++){
    const a=cabinLow[i],b=cabinLow[(i+1)%cabinLow.length],c=cabinTop[(i+1)%cabinTop.length],d=cabinTop[i];
    const glass=i===1||i===2?'#263943':i===5||i===6?'#101b22':'#1a2b34';
    poly([a,b,c,d],glass,'#080d10',.8);
  }
  poly(cabinTop,nationalGuard?'#73795e':tacticalPolice?'#747e82':isPolice?'#f0f0eb':kind==='van'?'#899094':'rgba(70,79,84,.94)','#090d10',1);

  if(tacticalPolice){
    const armorRoof=[[-w*.3,-h*.22],[w*.15,-h*.22],[w*.28,-h*.08],[w*.28,h*.08],[w*.15,h*.22],[-w*.3,h*.22],[-w*.36,h*.08],[-w*.36,-h*.08]];
    poly(raised(armorRoof,2.05),'#30393d','#11171a',1);
    ctx.strokeStyle='rgba(185,198,197,.52)';ctx.lineWidth=1.1;
    for(const side of [-1,1]){ctx.beginPath();ctx.moveTo(-w*.22+zx*2.05,side*h*.2+zy*2.05);ctx.lineTo(w*.12+zx*2.05,side*h*.2+zy*2.05);ctx.stroke();}
    ctx.fillStyle='#d8d8cf';ctx.font='bold 5px monospace';ctx.textAlign='center';ctx.fillText('SWAT',zx*2.06,zy*2.06+2);
  }

  // Truck cargo and sport bonnet make the classes readable at a glance.
  if(kind==='bus'){
    for(const side of [-1,1])for(let window=0;window<5;window++){
      const px=-w*.34+window*w*.14,py=side*h*.34;
      const glass=[[px,py],[px+w*.09,py],[px+w*.09,py+side*h*.055],[px,py+side*h*.055]];
      poly(raised(glass,2.35),'#29444b','#111b20',.7);
    }
    ctx.strokeStyle='#1c2325';ctx.lineWidth=2;
    for(const side of [-1,1]){ctx.beginPath();ctx.moveTo(-w*.07+zx*1.1,side*h*.48+zy*1.1);ctx.lineTo(-w*.07+zx*1.1,side*h*.37+zy*1.1);ctx.stroke();}
    poly(raised([[w*.39,-h*.17],[w*.49,-h*.15],[w*.49,h*.15],[w*.39,h*.17]],1.25),'#c7b270','#16191a',.8);
  }else if(kind==='truck'&&nationalGuard){
    const hull=[[-w*.43,-h*.39],[w*.25,-h*.39],[w*.45,-h*.2],[w*.45,h*.2],[w*.25,h*.39],[-w*.43,h*.39]];
    volume(hull,1.04,1.92,'#646b50','#444a39');
    const hatch=[[-w*.12,-h*.2],[w*.12,-h*.2],[w*.2,0],[w*.12,h*.2],[-w*.12,h*.2],[-w*.2,0]];
    volume(hatch,1.94,2.3,'#4d5441','#363c30');
    ctx.strokeStyle='#c1a44e';ctx.lineWidth=1.2;ctx.beginPath();ctx.moveTo(-w*.08+zx*2.31,zy*2.31);ctx.lineTo(w*.22+zx*2.31,zy*2.31);ctx.stroke();
    ctx.fillStyle='#ddd0a1';ctx.font='bold 5px monospace';ctx.textAlign='center';ctx.fillText('N.G.',-w*.29+zx*1.95,zy*1.95+2);
  }else if(kind==='truck'){
    const cargo=[[-w*.46,-h*.4],[-w*.08,-h*.4],[-w*.08,h*.4],[-w*.46,h*.4]];
    const box=volume(cargo,1.05,2.45,'#6f6558','#514940');
    ctx.strokeStyle='rgba(218,206,181,.25)';ctx.beginPath();ctx.moveTo(box.upper[0][0]+3,box.upper[0][1]+3);ctx.lineTo(box.upper[1][0]-3,box.upper[1][1]+3);ctx.stroke();
  }else if(kind==='coupe'||kind==='sports'){
    ctx.strokeStyle=kind==='sports'?'rgba(238,203,72,.8)':'rgba(235,235,225,.28)';ctx.lineWidth=1.4;ctx.beginPath();ctx.moveTo(-w*.42+zx,zy);ctx.lineTo(w*.43+zx,zy);ctx.stroke();
  }

  // Window divisions and doors stay attached to the body during rotation.
  ctx.strokeStyle=isPolice?'rgba(28,50,70,.8)':'rgba(8,12,15,.82)';ctx.lineWidth=1;
  for(const px of [-w*.08,w*.11]){ctx.beginPath();ctx.moveTo(px+zx*1.12,-h*.34+zy*1.12);ctx.lineTo(px+zx*1.76,-h*.32+zy*1.76);ctx.stroke();ctx.beginPath();ctx.moveTo(px+zx*1.12,h*.34+zy*1.12);ctx.lineTo(px+zx*1.76,h*.32+zy*1.76);ctx.stroke();}
  ctx.beginPath();ctx.moveTo(-w*.06+zx,-h*.47+zy);ctx.lineTo(-w*.06+zx,-h*.36+zy);ctx.moveTo(-w*.06+zx,h*.36+zy);ctx.lineTo(-w*.06+zx,h*.47+zy);ctx.stroke();
  ctx.beginPath();ctx.moveTo(w*.13+zx,-h*.47+zy);ctx.lineTo(w*.13+zx,-h*.36+zy);ctx.moveTo(w*.13+zx,h*.36+zy);ctx.lineTo(w*.13+zx,h*.47+zy);ctx.stroke();

  // Mirrors, chrome door handles, grille and licence plates.
  ctx.fillStyle='#0b0e10';ctx.fillRect(w*.06+zx*1.3,-h*.48+zy*1.3,5,2.5);ctx.fillRect(w*.06+zx*1.3,h*.455+zy*1.3,5,2.5);
  ctx.fillStyle='rgba(220,224,220,.7)';ctx.fillRect(-w*.03+zx,-h*.43+zy,5,1.2);ctx.fillRect(-w*.03+zx,h*.42+zy,5,1.2);
  poly(raised([[w*.43,-h*.2],[w*.5,-h*.18],[w*.5,h*.18],[w*.43,h*.2]]),'#111519','#73787a',.7);
  ctx.strokeStyle='#8e9495';ctx.lineWidth=.7;for(let g=-1;g<=1;g++){ctx.beginPath();ctx.moveTo(w*.465+zx,-h*.13+g*h*.1+zy);ctx.lineTo(w*.49+zx,-h*.1+g*h*.1+zy);ctx.stroke();}
  ctx.fillStyle='#d8d4c6';ctx.fillRect(w*.485+zx,-3+zy,2.8,6);
  ctx.fillStyle='#d8d4c6';ctx.fillRect(-w*.505+zx,-4+zy,2.8,8);

  // Paired headlamps and tail lamps are visible from oblique angles.
  ctx.fillStyle='#fff2b0';ctx.shadowColor='#ffe18a';ctx.shadowBlur=5;
  ctx.fillRect(w*.455+zx,-h*.33+zy,4,5);ctx.fillRect(w*.455+zx,h*.22+zy,4,5);ctx.shadowBlur=0;
  ctx.fillStyle='#d52f29';ctx.fillRect(-w*.48+zx,-h*.3+zy,4.2,5);ctx.fillRect(-w*.48+zx,h*.19+zy,4.2,5);

  // The light bar is a roof-mounted volume, with a base and alternating glow.
  if(isPolice){
    const barX=zx*2.02,barY=zy*2.02,flash=Math.sin(performance.now()*.012)>0;
    poly([[-7+barX,-4+barY],[7+barX,-4+barY],[7+barX,4+barY],[-7+barX,4+barY]],'#22282c','#080a0b',.8);
    ctx.save();ctx.shadowBlur=8;ctx.shadowColor=flash?'#ef4444':'#3b82f6';
    poly([[-6.4+barX,-3.3+barY],[-.4+barX,-3.3+barY],[-.4+barX,3.3+barY],[-6.4+barX,3.3+barY]],flash?'#f04a43':'#8a1f2b');
    poly([[.4+barX,-3.3+barY],[6.4+barX,-3.3+barY],[6.4+barX,3.3+barY],[.4+barX,3.3+barY]],flash?'#193d8b':'#4386f0');ctx.restore();
  }else if(serviceType){
    const barX=zx*2.02,barY=zy*2.02,flash=Math.sin(performance.now()*.017+(serviceType==='ambulance'?Math.PI:0))>0;
    poly([[-8+barX,-4+barY],[8+barX,-4+barY],[8+barX,4+barY],[-8+barX,4+barY]],'#24292b','#080a0b',.8);
    ctx.save();ctx.shadowBlur=9;ctx.shadowColor=serviceType==='fireEngine'?(flash?'#f04438':'#ffd24f'):(flash?'#43a5fa':'#f24943');
    if(serviceType==='fireEngine'){
      poly([[-7+barX,-3+barY],[-1+barX,-3+barY],[-1+barX,3+barY],[-7+barX,3+barY]],flash?'#ffcf4a':'#e34a37');
      poly([[1+barX,-3+barY],[7+barX,-3+barY],[7+barX,3+barY],[1+barX,3+barY]],flash?'#e34a37':'#ffcf4a');
    }else{
      poly([[-7+barX,-3+barY],[-1+barX,-3+barY],[-1+barX,3+barY],[-7+barX,3+barY]],flash?'#4296ef':'#d33a35');
      poly([[1+barX,-3+barY],[7+barX,-3+barY],[7+barX,3+barY],[1+barX,3+barY]],flash?'#d33a35':'#4296ef');
    }
    ctx.restore();
  }else if(kind==='taxi'){
    const signX=zx*2.03,signY=zy*2.03;
    poly([[-5+signX,-3+signY],[6+signX,-3+signY],[6+signX,3+signY],[-5+signX,3+signY]],'#d7a52f','#17191a',.8);
    ctx.fillStyle='#17191a';ctx.fillRect(-2+signX,-2+signY,5,1);
  }
  ctx.restore();
}

function renderRadar() {
  const rw = radarCanvas.width;
  const rh = radarCanvas.height;
  radarCtx.clearRect(0, 0, rw, rh);
  const radarRange = 900;
  const scale = rw / (radarRange * 2);

  radarCtx.save();
  radarCtx.translate(rw / 2, rh / 2);

  [...islands,...islets].forEach(isl => {
    radarCtx.fillStyle = 'rgba(255, 255, 255, 0.08)';
    coastPath(radarCtx,isl,scale,-player.x*scale,-player.y*scale);radarCtx.fill();
  });

  bridges.forEach(br => {
    radarCtx.fillStyle = 'rgba(56, 189, 248, 0.4)';
    radarCtx.fillRect((br.x - player.x) * scale, (br.y - player.y) * scale, br.w * scale, br.h * scale);
  });

  radarCtx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
  drawScenicRoads(radarCtx,scale,-player.x*scale,-player.y*scale,true);
  radarCtx.lineWidth = 6 * scale;
  roads.forEach(r => {
    radarCtx.strokeRect((r.x - player.x) * scale, (r.y - player.y) * scale, r.w * scale, r.h * scale);
  });

  CARPARTS.forEach(p => {
    if (!p.found) {
      radarCtx.fillStyle = '#e59d35';
      radarCtx.beginPath();
      radarCtx.arc((p.x - player.x) * scale, (p.y - player.y) * scale, 3.5, 0, Math.PI * 2);
      radarCtx.fill();
    }
  });

  for (const vehicle of roam?.fleet || []) {
    radarCtx.fillStyle=vehicle.kind==='water'?'#61b9ce':vehicle.kind==='air'?'#ddd7be':'#bd9954';
    radarCtx.fillRect((vehicle.x-player.x)*scale-2,(vehicle.y-player.y)*scale-2,4,4);
  }
  radarCtx.rotate(player.angle + Math.PI / 2);
  radarCtx.fillStyle = '#e59d35';
  radarCtx.beginPath();
  radarCtx.moveTo(0, -6);
  radarCtx.lineTo(4, 5);
  radarCtx.lineTo(0, 3);
  radarCtx.lineTo(-4, 5);
  radarCtx.closePath();
  radarCtx.fill();

  radarCtx.restore();
}

function renderFullMap() {
  const mw = fullMapCanvas.width;
  const mh = fullMapCanvas.height;
  fullMapCtx.clearRect(0, 0, mw, mh);
  const scale = Math.min(mw / WORLD_W, mh / WORLD_H);
  const mapX = (mw - WORLD_W * scale) / 2;
  const mapY = (mh - WORLD_H * scale) / 2;

  fullMapCtx.fillStyle = '#06090e';
  fullMapCtx.fillRect(0, 0, mw, mh);

  [...islands,...islets].forEach(isl => {
    fullMapCtx.fillStyle = districtProfiles[isl.id]?.land||'#1e2430';
    coastPath(fullMapCtx,isl,scale,mapX,mapY);fullMapCtx.fill();
    fullMapCtx.strokeStyle = '#334155';
    fullMapCtx.stroke();
  });

  bridges.forEach(br => {
    fullMapCtx.fillStyle = '#38bdf8';
    fullMapCtx.fillRect(mapX + br.x * scale, mapY + br.y * scale, br.w * scale, br.h * scale);
  });

  fullMapCtx.fillStyle = 'rgba(235, 240, 250, 0.5)';
  drawScenicRoads(fullMapCtx,scale,mapX,mapY,true);
  roads.forEach(r => {
    fullMapCtx.fillRect(mapX + r.x * scale, mapY + r.y * scale, r.w * scale, r.h * scale);
  });

  fullMapCtx.textAlign='center';fullMapCtx.font='bold 9px sans-serif';
  for(const island of islands){
    const x=mapX+(island.x+island.w/2)*scale,y=mapY+(island.y+island.h*.93)*scale;
    fullMapCtx.fillStyle='rgba(6,9,14,.82)';fullMapCtx.fillRect(x-66,y-10,132,15);
    fullMapCtx.fillStyle='#d3c6a7';fullMapCtx.fillText(island.name.toUpperCase(),x,y);
  }
  for(const base of serviceBases){
    const x=mapX+base.origin.x*scale,y=mapY+base.origin.y*scale;
    fullMapCtx.fillStyle=base.kind==='hospital'?'#d7ded2':base.kind==='firestation'?'#ce6950':base.kind==='police'?'#88aabb':'#a2aa7b';
    fullMapCtx.fillRect(x-3,y-3,6,6);fullMapCtx.strokeStyle='#11171b';fullMapCtx.lineWidth=1;fullMapCtx.strokeRect(x-3,y-3,6,6);
  }
  for(const base of airMedicalBases()){
    const x=mapX+base.x*scale,y=mapY+base.y*scale;
    fullMapCtx.fillStyle='#e5e4d9';fullMapCtx.fillText('H+',x,y);
  }
  for(const unit of airMedicalVehicles){
    const x=mapX+unit.x*scale,y=mapY+unit.y*scale;
    fullMapCtx.fillStyle='#e5e4d9';fullMapCtx.beginPath();fullMapCtx.arc(x,y,3,0,Math.PI*2);fullMapCtx.fill();
  }

  CARPARTS.forEach(p => {
    if (!p.found) {
      fullMapCtx.fillStyle = '#e59d35';
      fullMapCtx.beginPath();
      fullMapCtx.arc(mapX + p.x * scale, mapY + p.y * scale, 4, 0, Math.PI * 2);
      fullMapCtx.fill();
    }
  });

  for (const vehicle of roam?.fleet || []) {
    fullMapCtx.fillStyle=vehicle.kind==='water'?'#61b9ce':vehicle.kind==='air'?'#ddd7be':'#bd9954';
    const x=mapX+vehicle.x*scale,y=mapY+vehicle.y*scale;
    fullMapCtx.strokeStyle='#080b0e';fullMapCtx.lineWidth=1.25;fullMapCtx.beginPath();
    if(vehicle.kind==='air'){
      fullMapCtx.moveTo(x,y-4.5);fullMapCtx.lineTo(x+4,y+3.5);fullMapCtx.lineTo(x-4,y+3.5);fullMapCtx.closePath();
    }else if(vehicle.kind==='water'){
      fullMapCtx.moveTo(x,y-4);fullMapCtx.lineTo(x+4,y);fullMapCtx.lineTo(x,y+4);fullMapCtx.lineTo(x-4,y);fullMapCtx.closePath();
    }else fullMapCtx.arc(x,y,3.2,0,Math.PI*2);
    fullMapCtx.fill();fullMapCtx.stroke();
  }
  for(const runway of PLANE_RUNWAYS){
    const x=mapX+runway.x*scale,y=mapY+runway.y*scale;
    const w=runway.w*scale,h=Math.max(4,runway.h*scale);
    fullMapCtx.fillStyle='#414443';fullMapCtx.fillRect(x,y,w,h);
    fullMapCtx.strokeStyle='#e0d0a0';fullMapCtx.lineWidth=1.2;fullMapCtx.strokeRect(x,y,w,h);
    fullMapCtx.strokeStyle='#f2ead0';fullMapCtx.lineWidth=1;fullMapCtx.setLineDash([3,2]);
    fullMapCtx.beginPath();fullMapCtx.moveTo(x+2,y+h/2);fullMapCtx.lineTo(x+w-2,y+h/2);fullMapCtx.stroke();fullMapCtx.setLineDash([]);
    const labelY=y-7;
    fullMapCtx.fillStyle='rgba(7,10,13,.94)';fullMapCtx.fillRect(x+w/2-10,labelY-5.5,20,11);
    fullMapCtx.strokeStyle='#e0d0a0';fullMapCtx.lineWidth=1;fullMapCtx.strokeRect(x+w/2-10,labelY-5.5,20,11);
    fullMapCtx.fillStyle='#f2dfaa';fullMapCtx.font='bold 7px monospace';fullMapCtx.textAlign='center';fullMapCtx.textBaseline='middle';fullMapCtx.fillText('ВПП',x+w/2,labelY);
  }
  fullMapCtx.fillStyle = '#f4f1e9';fullMapCtx.strokeStyle='#182329';fullMapCtx.lineWidth=2;
  fullMapCtx.beginPath();
  const playerX=mapX+player.x*scale,playerY=mapY+player.y*scale;
  fullMapCtx.arc(playerX,playerY,4,0,Math.PI*2);fullMapCtx.fill();fullMapCtx.stroke();
  fullMapCtx.strokeStyle='#68d7f2';fullMapCtx.lineWidth=1.5;fullMapCtx.beginPath();
  fullMapCtx.moveTo(playerX,playerY);fullMapCtx.lineTo(playerX+Math.cos(player.angle)*8,playerY+Math.sin(player.angle)*8);fullMapCtx.stroke();
}

function autoSaveProgress() {
  if (driveLab?.running) return;
  const saveData = {
    cash: state.cash,
    x: player.x,
    y: player.y,
    parts: CARPARTS.map(p => ({ id: p.id, found: p.found }))
  };
  try { localStorage.setItem('lowtown_integrity_save', JSON.stringify(saveData)); } catch { /* Storage may be disabled. */ }
}

function loadProgress() {
  try {
    const saved = localStorage.getItem('lowtown_integrity_save');
    if (saved) {
      const data = JSON.parse(saved);
      state.cash = data.cash || 750;
      player.x = Number.isFinite(data.x) && data.x > 0 && data.x < WORLD_W ? data.x : 1200;
      player.y = Number.isFinite(data.y) && data.y > 0 && data.y < WORLD_H ? data.y : 1200;
      if (data.parts) {
        data.parts.forEach(sp => {
          const p = CARPARTS.find(item => item.id === sp.id);
          if (p) p.found = sp.found;
        });
      }
    }
  } catch (e) {}
  updateGaragePartsUI();
}

function updateGaragePartsUI() {
  const container = document.getElementById('partsContainer');
  if (!container) return;
  container.innerHTML = '';
  let foundCount = 0;
  CARPARTS.forEach(p => {
    if (p.found) foundCount++;
    const card = document.createElement('div');
    card.className = 'part-card' + (p.found ? ' found' : '');
    card.innerHTML = `
      <div class="part-title">${p.found ? p.name : '???'}</div>
      <div class="part-bonus">${p.found ? p.bonus : 'Не найдено'}</div>
    `;
    container.appendChild(card);
  });
  const cnt = document.getElementById('partsFoundCount');
  if (cnt) cnt.innerText = foundCount;
}

function showToast(msg) {
  const existing = document.getElementById('toastMsg');
  if (existing) existing.remove();
  const toast = document.createElement('div');
  toast.id = 'toastMsg';
  toast.className = 'toast-alert';
  toast.innerHTML = `<span>💬</span><span>${msg}</span>`;
  const container = document.getElementById('bannerContainer');
  if (container) {
    container.appendChild(toast);
    setTimeout(() => toast.remove(), 2800);
  }
}

let accumulator = 0;
let driveLab;
function gameLoop(now) {
  const dt = Math.max(0, Math.min(0.1, (now - state.lastFrameTime) / 1000));
  state.lastFrameTime = now;
  accumulator += dt;
  try {
    while (accumulator >= 1 / 60) {
      driveLab?.beforeStep();
      updatePhysics(1 / 60);
      driveLab?.afterStep();
      accumulator -= 1 / 60;
    }
    renderWorld();
    driveLab?.afterFrame();
    window.__lowtownLastFrame = performance.now();
  } catch (error) {
    window.__lowtownFail?.(error.message);
    driveLab?.fail(error.message);
    return;
  }
  requestAnimationFrame(gameLoop);
}

function setupInputListeners() {
  window.addEventListener('keydown', e => {
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) e.preventDefault();
    if (driveLab?.running) return;
    sound.init();
    if (e.code === 'KeyE' && !e.repeat) roam?.interact();
    if (e.code === 'KeyQ' && !e.repeat) roam?.toggleFlight();
    if (e.code === 'KeyW' || e.code === 'ArrowUp') state.keys.up = true;
    if (e.code === 'KeyS' || e.code === 'ArrowDown') state.keys.down = true;
    if (e.code === 'KeyA' || e.code === 'ArrowLeft') state.keys.left = true;
    if (e.code === 'KeyD' || e.code === 'ArrowRight') state.keys.right = true;
    if (e.code === 'Space') state.keys.handbrake = true;
    if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') state.keys.nitro = true;
    if (e.code === 'KeyM') toggleMap();
    if (e.code === 'KeyG') toggleGarage();
    if (e.code === 'KeyR') {
      const st = sound.nextStation();
      showToast(st);
    }
  });

  window.addEventListener('keyup', e => {
    if (e.code === 'KeyW' || e.code === 'ArrowUp') state.keys.up = false;
    if (e.code === 'KeyS' || e.code === 'ArrowDown') state.keys.down = false;
    if (e.code === 'KeyA' || e.code === 'ArrowLeft') state.keys.left = false;
    if (e.code === 'KeyD' || e.code === 'ArrowRight') state.keys.right = false;
    if (e.code === 'Space') state.keys.handbrake = false;
    if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') state.keys.nitro = false;
  });

  function bindDriveButton(elementId, keyName) {
    const btn = document.getElementById(elementId);
    if (!btn) return;
    const onPress = e => {
      if (e.cancelable) e.preventDefault();
      sound.init();
      state.keys[keyName] = true;
      btn.classList.add('active');
      if (navigator.vibrate) navigator.vibrate(10);
    };
    const onRelease = e => {
      if (e.cancelable) e.preventDefault();
      state.keys[keyName] = false;
      btn.classList.remove('active');
    };
    btn.addEventListener('touchstart', onPress, { passive: false });
    btn.addEventListener('touchend', onRelease, { passive: false });
    btn.addEventListener('touchcancel', onRelease, { passive: false });
    btn.addEventListener('pointerdown', e => { if (e.pointerType === 'mouse') onPress(e); });
    btn.addEventListener('pointerup', e => { if (e.pointerType === 'mouse') onRelease(e); });
    btn.addEventListener('pointerleave', e => { if (e.pointerType === 'mouse') onRelease(e); });
  }

  bindDriveButton('btnGas', 'up');
  bindDriveButton('btnBrake', 'down');
  bindDriveButton('btnLeft', 'left');
  bindDriveButton('btnRight', 'right');
  bindDriveButton('btnHandbrake', 'handbrake');
  bindDriveButton('btnNitro', 'nitro');
  const clearInput = () => {
    Object.keys(state.keys).forEach(k => state.keys[k] = false);
    document.querySelectorAll('.btn-drive').forEach(b => b.classList.remove('active'));
    accumulator = 0;
    state.lastFrameTime = performance.now();
  };
  window.addEventListener('blur', clearInput);
  document.addEventListener('visibilitychange', clearInput);

  window.addEventListener('mouseup', () => {
    state.keys.up = false;
    state.keys.down = false;
    state.keys.left = false;
    state.keys.right = false;
    state.keys.handbrake = false;
    state.keys.nitro = false;
    document.querySelectorAll('.btn-drive').forEach(b => b.classList.remove('active'));
  });

  document.getElementById('btnOpenMap')?.addEventListener('click', toggleMap);
  document.getElementById('radarContainer')?.addEventListener('click', toggleMap);
  document.getElementById('btnCloseMap')?.addEventListener('click', toggleMap);
  document.getElementById('btnOpenGarage')?.addEventListener('click', toggleGarage);
  document.getElementById('btnCloseGarage')?.addEventListener('click', toggleGarage);
  document.getElementById('btnRadio')?.addEventListener('click', () => {
    sound.init();
    const st = sound.nextStation();
    showToast(st);
  });

  document.getElementById('btnRepairCar')?.addEventListener('click', () => {
    if (state.cash >= 80) {
      state.cash -= 80;
      player.hp = 100;
      state.wanted = 0;
      state.wantedCooldown=0;
      state.evading = false;
      policeCars.length = 0;
      state.tacticalCallDispatched=false;state.guardCallDispatched=false;
      showToast('🔧 МАШИНА ПОЛНОСТЬЮ ВОССТАНОВЛЕНА!');
      autoSaveProgress();
    } else {
      showToast('❌ НЕ ХВАТАЕТ ДЕНЕГ ($80)!');
    }
  });
}

function toggleMap() {
  const modal = document.getElementById('mapModal');
  if (!modal) return;
  state.isMapOpen = modal.style.display !== 'flex';
  modal.style.display = state.isMapOpen ? 'flex' : 'none';
  if (state.isMapOpen) renderFullMap();
}

function toggleGarage() {
  const modal = document.getElementById('garageModal');
  if (!modal) return;
  state.isGarageOpen = modal.style.display !== 'flex';
  modal.style.display = state.isGarageOpen ? 'flex' : 'none';
}

function boot() {
  initTopology();
  roam = createFreeRoam(player, parkedCars, buildings, trees, isPositionOnSolidGround, showToast, solidProps, isPositionOnWaterObstacle,
    ()=>[...trafficCars,...policeCars,...incidentPoliceCars,...incidentResponseVehicles]);
  const roamControls = document.createElement('div');
  roamControls.className = 'roam-controls';
  const enterButton = document.createElement('button');enterButton.id='btnRoamEnter';enterButton.textContent = 'Выйти / сесть · E';enterButton.addEventListener('click',()=>roam.interact());
  const flyButton = document.createElement('button');flyButton.id='btnRoamFly';flyButton.textContent = 'Взлёт / снижение · Q';flyButton.addEventListener('click',()=>roam.toggleFlight());
  roamControls.append(enterButton,flyButton);document.body.appendChild(roamControls);
  loadProgress();
  setupInputListeners();
  driveLab = createDriveLab({ player, state, canvas, roads, buildings, trafficCars, policeCars, routeInput, roam });
  // Deterministic survey positions are available only on a local QA preview.
  // The published game never exposes this control surface.
  if(['127.0.0.1','localhost'].includes(window.location?.hostname)&&window.location.search.includes('cityQA=1')){
    window.__lowtownCityQA={
      districts:()=>islands.map(i=>({id:i.id,name:i.name,x:i.x,y:i.y,w:i.w,h:i.h})),
      viewStreet(x,y){
        if(!isPositionOnSolidGround(x,y)||isPedestrianSceneryBlocked(x,y))throw new Error('Street view requires clear ground');
        roam.resetToSedan(x,y,0);Object.keys(state.keys).forEach(key=>state.keys[key]=false);
        state.wanted=0;state.invulnTimer=9999;renderWorld();return {x,y};
      },
      startMedicalIncident(){
        const incident=cityIncidentDirector.start('crash',safeSpawnPoints[13],{duration:600});
        incident.reported=true;
        return {id:incident.id,x:incident.x,y:incident.y};
      },
      viewDistrict(id){
        const island=islands.find(i=>i.id===id);
        if(!island||roam.profile.kind!=='air'||roam.altitude<180)throw new Error('Survey requires an airborne aircraft');
        Object.assign(player,{x:island.x+island.w/2,y:island.y+island.h/2,speed:0,vx:0,vy:0});
        Object.keys(state.keys).forEach(key=>state.keys[key]=false);
        state.wanted=0;renderWorld();return {id,altitude:roam.altitude,mode:roam.mode};
      },
      snapshot:()=>({
        signals:(roadPaintGeometry||(roadPaintGeometry=buildRoadPaintGeometry())).signals.map(j=>({x:j.x,y:j.y,w:j.w,h:j.h})),
        signalPhase:{x:streetSignal('x'),y:streetSignal('y')},busStops:transitStopSigns(),
        residents:pedestrians.map(p=>({x:p.x,y:p.y,heading:p.heading,activity:p.activity||'walking',
          district:p.districtId,purpose:p.purpose,gait:p.gait,blockedTimer:p.blockedTimer||0})),
        incident:cityIncidentDirector.current()?{id:cityIncidentDirector.current().id,
          medicalTreated:!!cityIncidentDirector.current().medicalTreated,
          medicalProvider:cityIncidentDirector.current().medicalProvider,
          airMedicalResponse:cityIncidentDirector.current().airMedicalResponse}:null,
        districts:islands.map(i=>({id:i.id,people:pedestrians.filter(p=>p.districtId===i.id).length,
          buildings:buildings.filter(b=>b.districtId===i.id).length,profile:districtProfiles[i.id]})),
        serviceBases:serviceBases.map(b=>({sign:b.building.sign,kind:b.kind,origin:b.origin,entry:b.entry})),
        airMedicalBases:airMedicalBases().map(b=>({sign:b.building.sign,x:b.x,y:b.y,altitude:b.altitude})),
        airMedicalVehicles:airMedicalVehicles.map(u=>({x:u.x,y:u.y,altitude:u.altitude,status:u.status,
          responseIncidentId:u.responseIncidentId,responseBase:u.responseBase})),
        people:pedestrians.length,traffic:trafficCars.length,
        badPeople:pedestrians.filter(p=>isPedestrianSceneryBlocked(p.x,p.y)).length,
        trafficOffRoad:trafficCars.filter(c=>!onRoadSurface(c.x,c.y,roads,bridges,scenicRoads,roadEnds)).length
      })
    };
  }
  state.lastFrameTime = performance.now();
  requestAnimationFrame(gameLoop);
}
if (document.readyState === 'loading') window.addEventListener('DOMContentLoaded', boot, { once: true });
else boot();
