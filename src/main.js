Warning: truncated output (original token count: 41720)
Total output lines: 3155

import { drawArchitecture, drawRoundedJunction, drawStreetTree, drawStreetFurniture } from './game/architecture.js';
import { velocityForHeading, projectIso, routeInput } from './game/test_drive_core.js';
import { createDriveLab } from './game/test_drive_lab.js';
import { resolveContact, resolveScenery } from './game/solid_contacts.js';
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
  const roadList=roads.filter(r=>!r.bridgeApproach);
  const candidates=[];
  for(const road of roadList){
    const horizontal=road.dir==='h',length=horizontal?road.w:road.h;
    if(length<850)continue;
    const start=horizontal?road.x:road.y,end=start+length,center=horizontal?road.y+road.h/2:road.x+road.w/2;
    const limits=[start+180,end-180];
    const rawBlocked=roadList.filter(other…32720 tokens truncated…w*.22+zx*2.31,zy*2.31);ctx.stroke();
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
    fullMapCtx.fillStyle = '#1e2430';
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
  roam = createFreeRoam(player, parkedCars, buildings, trees, isPositionOnSolidGround, showToast, solidProps, isPositionOnWaterObstacle);
  const roamControls = document.createElement('div');
  roamControls.className = 'roam-controls';
  const enterButton = document.createElement('button');enterButton.id='btnRoamEnter';enterButton.textContent = 'Выйти / сесть · E';enterButton.addEventListener('click',()=>roam.interact());
  const flyButton = document.createElement('button');flyButton.id='btnRoamFly';flyButton.textContent = 'Взлёт / снижение · Q';flyButton.addEventListener('click',()=>roam.toggleFlight());
  roamControls.append(enterButton,flyButton);document.body.appendChild(roamControls);
  loadProgress();
  setupInputListeners();
  driveLab = createDriveLab({ player, state, canvas, roads, buildings, trafficCars, policeCars, routeInput, roam });
  state.lastFrameTime = performance.now();
  requestAnimationFrame(gameLoop);
}
if (document.readyState === 'loading') window.addEventListener('DOMContentLoaded', boot, { once: true });
else boot();
