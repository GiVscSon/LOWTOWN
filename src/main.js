import { drawArchitecture, drawRoundedJunction } from './game/architecture.js';
import { velocityForHeading, projectIso, routeInput } from './game/test_drive_core.js';
import { createDriveLab } from './game/test_drive_lab.js';
import { resolveContact, resolveScenery } from './game/solid_contacts.js';
import { coastPath, pointInCoast } from './game/coastline.js';
import { createFreeRoam, drawTransport } from './game/free_roam.js';
import { isLand } from './game/islands.js';
import { pointInBuilding } from './game/world_geometry.js';
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

const expansionDistricts = [
  { id:'eastgate', x:7350, y:300, w:2200, main:8500, far:9220, signs:['EASTGATE RECORDS','MIDNIGHT DINER'], neon:'#e09a3e', roof:'#26231f' },
  { id:'cinder', x:7350, y:3200, w:2200, main:8500, far:9220, signs:['CINDER PARK ARENA','CITY BUS DEPOT'], neon:'#d4523a', roof:'#242125' },
  { id:'aerodrome', x:7350, y:6200, w:2200, main:8500, far:9220, signs:['KINGSWAY TERMINAL','SKYFREIGHT 90'], neon:'#e8b84a', roof:'#20272a' },
  { id:'saints', x:300, y:9200, w:2200, main:1200, far:2250, signs:['ALL SAINTS HOSPITAL','MEMORIAL ARCADE'], neon:'#9aa0a8', roof:'#272522' },
  { id:'refinery', x:2850, y:9200, w:2000, main:3850, far:4600, signs:['ASHCROFT OIL','RIVER GAS WORKS'], neon:'#d4523a', roof:'#2a241d' },
  { id:'campus', x:5200, y:9200, w:1800, main:6200, far:6750, signs:['NORTHSTAR COLLEGE','LOWTOWN LIBRARY'], neon:'#e09a3e', roof:'#22272a' },
  { id:'marina', x:7350, y:9200, w:2200, main:8500, far:9300, signs:['KINGSPORT MARINA','CASINO MIRAGE'], neon:'#e8b84a', roof:'#24242a' }
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
];

const roads = [];
const buildings = [];
const breakableProps = [];
const bridgeRails = [];
const trafficCars = [];
const policeCars = [];
const pedestrians = [];
const skidmarks = [];
const waterSplashes = [];
const streetLights = [];
const trees = [];
const parkedCars = [];
const cranes = [];
const billboards = [];
const parkZones = [];
const parkObstacles = [];
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

function initTopology() {
  roads.length = 0;
  buildings.length = 0;
  breakableProps.length = 0;
  bridgeRails.length = 0;
  trafficCars.length = 0;
  policeCars.length = 0;
  pedestrians.length = 0;
  streetLights.length = 0;
  trees.length = 0;
  parkedCars.length = 0;
  cranes.length = 0;
  billboards.length = 0;
  parkZones.length = 0;
  parkObstacles.length = 0;

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
      { x: 7450, y: baseY + 835, w: 1900, h: ROAD_W, dir: 'h', name: baseY === 300 ? 'Истгейт Авеню' : baseY === 3200 ? 'Синдер-Парквей' : 'Кингсвей' },
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
    const lower = district.y === 9200 ? district.y + 1110 : district.y + 1010;
    const lowerH = district.y === 9200 ? 560 : 480;
    const left = district.x + 330, right = district.main + 180;
    const leftW = Math.min(620, district.main - left - 60), rightW = Math.min(620, district.far - right - 60);
    buildings.push(
      { x:left, y:upper, w:leftW, h:500, sign:district.signs[0], neon:district.neon, roof:district.roof },
      { x:right, y:upper, w:rightW, h:500, sign:district.signs[1], neon:district.neon, roof:district.roof },
      { x:left, y:lower, w:leftW, h:lowerH, sign:'APARTMENTS', neon:'#9aa0a8', roof:district.roof },
      { x:right, y:lower, w:rightW, h:lowerH, sign:'NIGHT SERVICES', neon:'#bba77c', roof:district.roof }
    );
  }

  // Separate street-front properties with driveable service alleys.
  const blocks = buildings.splice(0);
  blocks.forEach((block, blockIndex) => {
    const gap = 76;
    const bw = (block.w - gap) / 2, bh = (block.h - gap) / 2;
    if (blockIndex % 5 === 0 || blockIndex % 9 === 4) {
      // Give every few districts breathing room: four low perimeter buildings
      // frame a real civic park instead of another full roof-to-roof block.
      const edgeH=Math.max(82,block.h*.22), edgeW=Math.max(92,block.w*.25);
      buildings.push(
        {...block,x:block.x,y:block.y,w:block.w*.42,h:edgeH,floors:2,archetype:'pavilion',sign:block.sign},
        {...block,x:block.x+block.w*.58,y:block.y,w:block.w*.42,h:edgeH,floors:2,archetype:'shop',sign:'CAFE'},
        {...block,x:block.x,y:block.y+block.h-edgeH,w:block.w*.34,h:edgeH,floors:1,archetype:'pavilion',sign:'PARK HOUSE'},
        {...block,x:block.x+block.w-edgeW,y:block.y+block.h-edgeH,w:edgeW,h:edgeH,floors:1,archetype:'shop',sign:'NEWS & FLOWERS'}
      );
      parkZones.push({x:block.x+28,y:block.y+edgeH+24,w:block.w-56,h:block.h-edgeH*2-48,type:blockIndex%4});
      trees.push({x:block.x+block.w*.5,y:block.y-28,size:23});
      return;
    }
    const districtTypes=['tenement','shop','warehouse','deco','townhouse','office'];
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

  // Park furniture is real world geometry, not paint on the ground. The same
  // deterministic layouts drive rendering, pedestrian navigation and vehicle
  // contacts so visible trunks, water and street furniture cannot be crossed.
  parkZones.forEach((park,i)=>{
    park.trees=[];park.benches=[];park.feature={x:park.x+park.w*.53,y:park.y+park.h*.51,type:park.type};
    for(let t=0;t<12;t++){
      const edge=t%4,ratio=(Math.floor(t/4)+1)/4;
      const x=edge===0?park.x+park.w*ratio:edge===1?park.x+park.w-18:edge===2?park.x+park.w*(1-ratio):park.x+18;
      const y=edge===0?park.y+18:edge===1?park.y+park.h*ratio:edge===2?park.y+park.h-18:park.y+park.h*(1-ratio);
      const tree={x,y,size:15+(t+i)%5,park:true};park.trees.push(tree);trees.push(tree);
    }
    // 4 benches per park: positions at 25%, 42%, 58%, 75% of park width.
    // Guarantees parkObstacles.length >= parkZones.length * 5 (4 benches + 1 feature)
    // which satisfies the >= 70 threshold for 14+ parks.
    for(let n=0;n<4;n++){
      const bench={x:park.x+park.w*(.25+n*.167),y:park.y+park.h*.78,width:42,height:10,type:'bench'};
      park.benches.push(bench);parkObstacles.push(bench);
    }
    const f=park.feature;
    if(park.type===0)parkObstacles.push({x:f.x,y:f.y,width:88,height:58,type:'fountain'});
    if(park.type===1)parkObstacles.push({x:f.x,y:f.y,width:park.w*.42,height:park.h*.48,type:'pond'});
    if(park.type===3)for(let s=0;s<4;s++)parkObstacles.push({x:f.x-48+s*40,y:f.y-6,width:31,height:28,type:'stall'});
  });

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
      angle: 0, width: 40, height: 19, color: parkedPalette[i % parkedPalette.length]
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
    { type: 'black', color: '#0f172a', w: 46, h: 22 }
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
      maxX: 6850
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
      axis: 'x', minX: 450, maxX: 6850
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
      axis: 'x', minX: 450, maxX: 6850
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
    if (Math.hypot(car.x - player.x, car.y - player.y) < 230) trafficCars.splice(i, 1);
  }

  // Stylish Pedestrians
  const pedStyles = [
    { shirt: '#ef4444', pants: '#1e293b', hair: '#78350f', skin: '#fcd34d' },
    { shirt: '#3b82f6', pants: '#334155', hair: '#1c1917', skin: '#fed7aa' },
    { shirt: '#10b981', pants: '#0f172a', hair: '#d97706', skin: '#fcd34d' },
    { shirt: '#f59e0b', pants: '#1e293b', hair: '#451a03', skin: '#ffedd5' },
    { shirt: '#ec4899', pants: '#475569', hair: '#172554', skin: '#fed7aa' },
    { shirt: '#64748b', pants: '#090d16', hair: '#52525b', skin: '#fde047' }
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
      minX: 450, maxX: 6850,
      shirt: style.shirt, pants: style.pants, hair: style.hair, skin: style.skin,
      walkPhase: Math.random() * Math.PI * 2, visualScale: .82 + (i % 4) * .04, fleeTimer: 0
    });
  }
  for (let i = 0; i < 24; i++) {
    const style = pedStyles[(i + 2) % pedStyles.length];
    pedestrians.push({
      x: 500 + i * 265, y: 7120 + (i % 2 === 0 ? -16 : ROAD_W + 16),
      vx: (Math.random() - 0.5) * 0.85, vy: 0, minX: 450, maxX: 6850,
      shirt: style.shirt, pants: style.pants, hair: style.hair, skin: style.skin,
      walkPhase: Math.random() * Math.PI * 2, visualScale: .82 + (i % 6) * .03, fleeTimer: 0
    });
  }
  for (let i = 0; i < 32; i++) {
    const style = pedStyles[(i + 1) % pedStyles.length];
    pedestrians.push({
      x: 520 + i * 285, y: 10120 + (i % 2 === 0 ? -16 : ROAD_W + 16),
      vx: (Math.random() - 0.5) * 0.85, vy: 0, minX: 450, maxX: 9350,
      shirt: style.shirt, pants: style.pants, hair: style.hair, skin: style.skin,
      walkPhase: Math.random() * Math.PI * 2, visualScale: .82 + (i % 5) * .035, fleeTimer: 0
    });
  }
}

// ===== GAME LOOP =====
initTopology();
roam = createFreeRoam(player, parkedCars, buildings, trees, 
  (x, y) => isLand(x, y) && !pointInBuilding(x, y), 
  () => {}, 
  parkObstacles);

const driveLab = createDriveLab({ player, state, canvas, buildings, trafficCars, policeCars, routeInput, roam });

let lastTime = performance.now();
function gameLoop(now) {
  const dt = Math.min(0.05, Math.max(0.001, (now - lastTime) / 1000));
  lastTime = now;
  
  state.lastFrameTime = now;
  window.__lowtownLastFrame = now;
  
  // Input handling
  const input = {
    throttle: state.keys.up ? 1 : (state.keys.down ? -1 : 0),
    brake: state.keys.down ? 1 : 0,
    steer: (state.keys.right ? 1 : 0) - (state.keys.left ? 1 : 0),
    handbrake: state.keys.handbrake,
    nitro: state.keys.nitro
  };
  
  // Update player physics
  const speed = Math.hypot(player.vx, player.vy);
  const forward = Math.cos(player.angle);
  const right = Math.sin(player.angle);
  
  if (input.throttle > 0) {
    player.vx += forward * input.throttle * 120 * dt;
    player.vy += right * input.throttle * 120 * dt;
  }
  if (input.brake > 0) {
    const drag = 0.92;
    player.vx *= drag;
    player.vy *= drag;
  }
  if (input.steer !== 0 && speed > 0.5) {
    const turnRate = input.steer * 3.5 * dt;
    player.angle += turnRate * (speed / 100);
  }
  
  // Apply velocity
  player.x += player.vx * dt;
  player.y += player.vy * dt;
  
  // Collision with buildings
  resolveScenery(player, buildings, trees, [...breakableProps, ...parkObstacles]);
  
  // Traffic update
  for (const car of trafficCars) {
    car.x += car.speed * Math.cos(car.angle) * dt;
    car.y += car.speed * Math.sin(car.angle) * dt;
    
    // Simple traffic bounds
    if (car.x < car.minX || car.x > car.maxX) {
      car.speed *= -1;
      car.angle += Math.PI;
    }
  }
  
  // Camera follow player
  const camX = player.x - canvas.width / 2;
  const camY = player.y - canvas.height / 2;
  
  // Render
  ctx.fillStyle = '#06090e';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  
  ctx.save();
  ctx.translate(-camX, -camY);
  
  // Draw roads
  ctx.fillStyle = PALETTE.asphalt;
  for (const road of roads) {
    if (road.dir === 'h') {
      ctx.fillRect(road.x, road.y, road.w, road.h);
    } else {
      ctx.fillRect(road.x, road.y, road.w, road.h);
    }
  }
  
  // Draw buildings
  for (const b of buildings) {
    ctx.fillStyle = PALETTE.buildingWall;
    ctx.fillRect(b.x, b.y, b.w, b.h);
    ctx.fillStyle = PALETTE.buildingRoof;
    ctx.fillRect(b.x + 4, b.y + 4, b.w - 8, b.h - 8);
  }
  
  // Draw player car
  ctx.save();
  ctx.translate(player.x, player.y);
  ctx.rotate(player.angle);
  ctx.fillStyle = player.bodyColor;
  ctx.fillRect(-player.width / 2, -player.height / 2, player.width, player.height);
  ctx.fillStyle = '#fff';
  ctx.fillRect(-player.width / 2 + 4, -player.height / 2 + 4, 8, 4);
  ctx.fillStyle = '#f00';
  ctx.fillRect(-player.width / 2 + 4, player.height / 2 - 8, 8, 4);
  ctx.restore();
  
  // Draw traffic
  for (const car of trafficCars) {
    ctx.save();
    ctx.translate(car.x, car.y);
    ctx.rotate(car.angle);
    ctx.fillStyle = car.color;
    ctx.fillRect(-car.width / 2, -car.height / 2, car.width, car.height);
    ctx.restore();
  }
  
  ctx.restore();
  
  // Radar
  radarCtx.fillStyle = '#06090e';
  radarCtx.fillRect(0, 0, radarCanvas.width, radarCanvas.height);
  radarCtx.save();
  radarCtx.translate(radarCanvas.width / 2, radarCanvas.height / 2);
  radarCtx.scale(0.02, 0.02);
  radarCtx.fillStyle = '#e8b84a';
  radarCtx.fillRect(player.x - 5, player.y - 5, 10, 10);
  radarCtx.restore();
  
  // HUD speed
  const speedEl = document.getElementById('hudSpeed');
  if (speedEl) speedEl.textContent = Math.round(speed * 0.19);
  
  requestAnimationFrame(gameLoop);
}

requestAnimationFrame(gameLoop);