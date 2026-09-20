import { drawArchitecture, drawRoundedJunction } from './game/architecture.js';
import { velocityForHeading, projectIso, routeInput } from './game/test_drive_core.js';
import { createDriveLab } from './game/test_drive_lab.js';
import { resolveContact, resolveScenery } from './game/solid_contacts.js';
import { coastPath, pointInCoast } from './game/coastline.js';
import { createFreeRoam, drawTransport } from './game/free_roam.js';
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
    if (blockIndex % 7 === 0 || blockIndex % 11 === 5) {
      // Give every few districts breathing room: four low perimeter buildings
      // frame a real civic park instead of another full roof-to-roof block.
      const edgeH=Math.max(82,block.h*.22), edgeW=Math.max(92,block.w*.25);
      buildings.push(
        {...block,x:block.x,y:block.y,w:block.w*.42,h:edgeH,floors:2,sign:block.sign},
        {...block,x:block.x+block.w*.58,y:block.y,w:block.w*.42,h:edgeH,floors:2,sign:'CAFE'},
        {...block,x:block.x,y:block.y+block.h-edgeH,w:block.w*.34,h:edgeH,floors:1,sign:'PARK HOUSE'},
        {...block,x:block.x+block.w-edgeW,y:block.y+block.h-edgeH,w:edgeW,h:edgeH,floors:1,sign:'NEWS & FLOWERS'}
      );
      parkZones.push({x:block.x+28,y:block.y+edgeH+24,w:block.w-56,h:block.h-edgeH*2-48,type:blockIndex%4});
      trees.push({x:block.x+block.w*.5,y:block.y-28,size:23});
      return;
    }
    for (let row = 0; row < 2; row++) for (let col = 0; col < 2; col++) {
      buildings.push({ ...block, x: block.x + col * (bw + gap), y: block.y + row * (bh + gap), w: bw, h: bh,
        sign: row === 0 && col === 0 ? block.sign.replace(/[^\x20-\x7E]/g, '').trim() : ['APARTMENTS', 'REPAIR SHOP', 'GROCERY', 'WAREHOUSE'][(blockIndex + row + col) % 4],
        neon: ['#e09a3e', '#bba77c', '#9aa0a8', '#d4523a'][blockIndex % 4] });
    }
    trees.push({ x: block.x + bw + gap / 2, y: block.y - 28, size: 23 });
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
      walkPhase: Math.random() * Math.PI * 2, fleeTimer: 0
    });
  }
  for (let i = 0; i < 24; i++) {
    const style = pedStyles[(i + 2) % pedStyles.length];
    pedestrians.push({
      x: 500 + i * 265, y: 7120 + (i % 2 === 0 ? -16 : ROAD_W + 16),
      vx: (Math.random() - 0.5) * 0.85, vy: 0, minX: 450, maxX: 6850,
      shirt: style.shirt, pants: style.pants, hair: style.hair, skin: style.skin,
      walkPhase: Math.random() * Math.PI * 2, fleeTimer: 0
    });
  }
  for (let i = 0; i < 32; i++) {
    const style = pedStyles[(i + 1) % pedStyles.length];
    pedestrians.push({
      x: 520 + i * 285, y: 10120 + (i % 2 === 0 ? -16 : ROAD_W + 16),
      vx: (Math.random() - 0.5) * 0.85, vy: 0, minX: 450, maxX: 9350,
      shirt: style.shirt, pants: style.pants, hair: style.hair, skin: style.skin,
      walkPhase: Math.random() * Math.PI * 2, fleeTimer: 0
    });
  }
}

function isPositionOnSolidGround(x, y) {
  for (let isl of islands) {
    if (pointInCoast(x, y, isl)) return true;
  }
  for (let br of bridges) {
    if (x >= br.x - 10 && x <= br.x + br.w + 10 && y >= br.y - 12 && y <= br.y + br.h + 12) return true;
  }
  return false;
}

function updatePhysics(dt) {
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
      let nearest = safeSpawnPoints[0];
      let minDist = Infinity;
      safeSpawnPoints.forEach(sp => {
        const d = Math.hypot(sp.x - player.x, sp.y - player.y);
        if (d < minDist) { minDist = d; nearest = sp; }
      });
      player.x = nearest.x;
      player.y = nearest.y;
      player.speed = 0;
      player.vx = 0;
      player.vy = 0;
      player.hp = Math.max(20, player.hp - 20);
      state.isDrowning = false;
      state.drownProgress = 0;
      state.invulnTimer = 120;
      showToast('⚠️ МАШИНА УТОНУЛА! ЭВАКУАЦИЯ (-$50)');
      state.cash = Math.max(0, state.cash - 50);
      return;
    }
  }

  let maxSpeed = roam?.profile?.max || 8.8;
  let accel = 0.17;

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
    player.speed *= 0.965;
    if (Math.abs(player.speed) < 0.025) player.speed = 0;
  }

  let lateralGrip = 0.18;
  if (state.keys.handbrake) {
    player.speed *= 0.96;
    lateralGrip = 0.76;
  }

  if (Math.abs(player.speed) > 2) {
    skidmarks.push({ x: player.x, y: player.y, angle: player.angle, alpha: 0.5 });
    if (skidmarks.length > 200) skidmarks.shift();
  }

  if (Math.abs(player.speed) > 0.12) {
    const dir = player.speed >= 0 ? 1 : -1;
    const steeringAuthority = Math.min(1, 0.28 + Math.abs(player.speed) / 3.2);
    const turnSpeed = (state.keys.handbrake ? 0.063 : 0.044) * steeringAuthority;
    if (state.keys.left) player.angle -= turnSpeed * dir;
    if (state.keys.right) player.angle += turnSpeed * dir;
  }

  Object.assign(player, velocityForHeading(player, lateralGrip));

  player.x += player.vx;
  player.y += player.vy;

  // Full oriented body, not just the vehicle centre, meets solid geometry.
  const impactSpeed = Math.abs(player.speed);
  if (resolveScenery(player, buildings, trees) && impactSpeed > 3 && state.invulnTimer === 0) {
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
    const axis = c.axis === 'y' ? 'y' : 'x';
    const cross = axis === 'x' ? 'y' : 'x';
    const direction = Math.sign(c.cruiseSpeed);
    const forwardGap = Math.max(72, (c.width || 46) + 34);
    const occupied = [player, ...trafficCars, ...parkedCars].some(other => other !== c &&
      Math.abs(other[cross] - c[cross]) < 22 && (other[axis] - c[axis]) * direction > 0 && (other[axis] - c[axis]) * direction < forwardGap);
    // Alternating six-second phases give the visible junctions coherent flow.
    const phase = Math.floor(performance.now() / 6000) % 2;
    const redForAxis = (axis === 'x' ? 0 : 1) !== phase;
    const approachingRed = redForAxis && roads.some(r => {
      if(r.dir === (axis === 'x' ? 'h' : 'v'))return false;
      const junction=axis === 'x' ? r.x+r.w/2 : r.y+r.h/2;
      const ahead=(junction-c[axis])*direction;
      return ahead>32&&ahead<118&&c[cross]>=(axis==='x'?r.y:r.x)-15&&c[cross]<=(axis==='x'?r.y+r.h:r.x+r.w)+15;
    });
    const obstacle = occupied || approachingRed;
    c.speed += ((obstacle ? 0 : c.cruiseSpeed) - c.speed) * Math.min(1, dt * (obstacle ? 9 : 3.5));
    const frame = Math.min(dt, .05) * 60;
    if (c.axis === 'y') {
      c.y += c.speed * frame;
      const wrapped = c.speed > 0 && c.y > c.maxY ? c.minY : c.speed < 0 && c.y < c.minY ? c.maxY : null;
      if (wrapped !== null && !trafficCars.some(o=>o!==c&&Math.abs(o.x-c.x)<24&&Math.abs(o.y-wrapped)<110)) c.y=wrapped;
    } else {
      c.x += c.speed * frame;
      const wrapped = c.speed > 0 && c.x > c.maxX ? c.minX : c.speed < 0 && c.x < c.minX ? c.maxX : null;
      if (wrapped !== null && !trafficCars.some(o=>o!==c&&Math.abs(o.y-c.y)<24&&Math.abs(o.x-wrapped)<110)) c.x=wrapped;
    }
    if (!roam?.special && resolveContact(player, c)) {
      if (state.invulnTimer === 0) {
        player.hp = Math.max(0, player.hp - 8);
        state.invulnTimer = 24;
        sound.playImpact();
        if (state.wanted === 0) setWanted(1);
      }
    }
  });

  // Pedestrians AI & Flee
  pedestrians.forEach((p, pedIndex) => {
    if (p.homeY === undefined) { p.homeY=p.y; p.pause=stableVisualHash(p.x,p.y,3)*1.5; }
    const frame=Math.min(dt,.05)*60;
    const d = Math.hypot(p.x - player.x, p.y - player.y);
    p.fleeTimer=Math.max(0,p.fleeTimer-dt);
    if (d < 135 && Math.abs(player.speed) > 2.5) p.fleeTimer=1.3;

    if (p.fleeTimer>0) {
      const len=d||1;
      p.x+=(p.x-player.x)/len*1.35*frame;
      p.y+=(p.y-player.y)/len*1.35*frame;
      p.walkPhase+=.18*frame;
    } else {
      p.pause-=dt;
      if(p.pause<=-2.2){p.pause=1.1+stableVisualHash(pedIndex,Math.floor(performance.now()/1000),4)*1.8;p.vx*=-1;}
      const moving=p.pause<=0;
      p.x+=(moving?p.vx:0)*frame;
      p.y+=(p.homeY-p.y)*Math.min(.12,dt*3);
      if(moving)p.walkPhase+=.09*frame;
    }
    if (p.x < (p.minX ?? 450) || p.x > (p.maxX ?? 6850)) {p.vx*=-1;p.x=Math.max(p.minX??450,Math.min(p.maxX??6850,p.x));}
    // Small personal-space steering prevents pedestrians from forming one dot.
    const neighbor=pedestrians.find((o,j)=>j!==pedIndex&&Math.abs(o.x-p.x)<12&&Math.abs(o.y-p.y)<10);
    if(neighbor)p.y+=(pedIndex%2?1:-1)*.18*frame;

    if (d < 22) {
      p.y += (p.y > player.y ? 20 : -20);
      if (state.invulnTimer === 0 && Math.abs(player.speed) > 2) {
        if (state.wanted < 3) setWanted(state.wanted + 1);
        showToast('🚨 НАЕЗД НА ПЕШЕХОДА!');
      }
    }
  });

  if (!roam?.special) updatePoliceAI(dt);
  const vehicles = [...(!roam?.special ? [player] : []), ...trafficCars, ...policeCars];
  // Repeated projection handles simultaneous wall/car contacts at intersections.
  for (let pass = 0; pass < 3; pass++) {
    for (let i = 0; i < vehicles.length; i++) {
      for (let j = i + 1; j < vehicles.length; j++) {
        if (vehicles[i].isTraffic && vehicles[j].isTraffic) continue;
        resolveContact(vehicles[i], vehicles[j]);
      }
      for (const parked of parkedCars) resolveContact(vehicles[i], parked, true);
      for (const vehicle of roam?.fleet || []) if (vehicle.kind !== 'water') resolveContact(vehicles[i],vehicle,true);
      resolveScenery(vehicles[i], buildings, trees);
    }
  }
  roam?.contacts();

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

function stableVisualHash(a, b, c = 0) {
  const value = Math.sin(a * 12.9898 + b * 78.233 + c * 37.719) * 43758.5453;
  return value - Math.floor(value);
}

function drawWetRoadSurface(r, index) {
  ctx.save();
  ctx.beginPath(); ctx.rect(r.x, r.y, r.w, r.h); ctx.clip();
  const across = r.dir === 'h' ? r.h : r.w;
  const length = r.dir === 'h' ? r.w : r.h;
  const x2 = r.dir === 'h' ? r.x : r.x + r.w;
  const y2 = r.dir === 'h' ? r.y + r.h : r.y;
  const wet = ctx.createLinearGradient(r.x, r.y, x2, y2);
  wet.addColorStop(0, 'rgba(255,255,255,.015)'); wet.addColorStop(.48, 'rgba(117,126,128,.13)'); wet.addColorStop(.54, 'rgba(0,0,0,.12)'); wet.addColorStop(1, 'rgba(255,255,255,.025)');
  ctx.fillStyle = wet; ctx.fillRect(r.x, r.y, r.w, r.h);

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

function drawBuilding(b,index) { drawArchitecture(ctx,b,index); }
function drawCityScenery() {
  // Parking bays and stationary cars make blocks feel inhabited.
  parkedCars.forEach((car, index) => {
    ctx.save(); ctx.translate(car.x, car.y); ctx.rotate(car.angle);
    ctx.strokeStyle = 'rgba(210, 215, 220, 0.22)'; ctx.lineWidth = 2;
    ctx.strokeRect(-34, -18, 68, 36);
    drawDetailedCar(ctx, 0, 0, 0, car.color, 40, 19, false);
    if (index % 4 === 0) { ctx.fillStyle = 'rgba(0,0,0,.38)'; ctx.fillRect(-46, 23, 92, 7); }
    ctx.restore();
  });

  trees.forEach((tree, index) => {
    ctx.fillStyle = 'rgba(0,0,0,.45)';
    ctx.beginPath(); ctx.ellipse(tree.x + 8, tree.y + 8, tree.size, tree.size * .65, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#412d20'; ctx.fillRect(tree.x - 3, tree.y - 2, 6, 18);
    ctx.fillStyle = index % 3 === 0 ? '#183f30' : '#1d4b36';
    ctx.beginPath(); ctx.arc(tree.x, tree.y - 8, tree.size, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#2f6a46';
    ctx.beginPath(); ctx.arc(tree.x - tree.size * .3, tree.y - tree.size * .45, tree.size * .55, 0, Math.PI * 2); ctx.fill();
    for (let leaf = 0; leaf < 9; leaf++) {
      const angle = leaf * 2.4, radius = tree.size * .58;
      ctx.fillStyle = ['#31553b', '#426548', '#274833'][leaf % 3];
      ctx.beginPath(); ctx.arc(tree.x + Math.cos(angle) * radius, tree.y - 8 + Math.sin(angle) * radius, tree.size * .32, 0, Math.PI * 2); ctx.fill();
    }
  });

  cranes.forEach((crane, index) => {
    const boomY = crane.y - 150;
    ctx.strokeStyle = index % 2 ? '#a86528' : '#c48632'; ctx.lineWidth = 11;
    ctx.beginPath(); ctx.moveTo(crane.x, crane.y); ctx.lineTo(crane.x, boomY); ctx.lineTo(crane.x + crane.reach, boomY); ctx.stroke();
    ctx.strokeStyle = '#6c401f'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(crane.x, boomY); ctx.lineTo(crane.x + crane.reach * .75, crane.y - 35); ctx.stroke();
    const hookX = crane.x + crane.reach * .82;
    ctx.beginPath(); ctx.moveTo(hookX, boomY); ctx.lineTo(hookX, boomY + 95); ctx.stroke();
    ctx.fillStyle = '#111820'; ctx.fillRect(hookX - 9, boomY + 92, 18, 12);
  });

  billboards.forEach(board => {
    ctx.fillStyle = '#070a0f'; ctx.fillRect(board.x - 72, board.y - 30, 144, 52);
    ctx.strokeStyle = board.color; ctx.lineWidth = 3; ctx.shadowColor = board.color; ctx.shadowBlur = 14;
    ctx.strokeRect(board.x - 72, board.y - 30, 144, 52);
    ctx.fillStyle = board.color; ctx.font = '900 13px Inter, sans-serif'; ctx.textAlign = 'center';
    ctx.fillText(board.text, board.x, board.y + 2); ctx.shadowBlur = 0;
    ctx.fillStyle = '#303846'; ctx.fillRect(board.x - 4, board.y + 22, 8, 38);
  });

  streetLights.forEach((lamp, index) => {
    const glow = ctx.createRadialGradient(lamp.x, lamp.y, 2, lamp.x, lamp.y, 62);
    glow.addColorStop(0, 'rgba(232,184,74,.28)'); glow.addColorStop(1, 'rgba(232,184,74,0)');
    ctx.fillStyle = glow; ctx.beginPath(); ctx.arc(lamp.x, lamp.y, 62, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#4b5563'; ctx.lineWidth = 4;
    ctx.beginPath(); ctx.moveTo(lamp.x, lamp.y + 8); ctx.lineTo(lamp.x, lamp.y - 34); ctx.lineTo(lamp.x + (index % 2 ? -11 : 11), lamp.y - 34); ctx.stroke();
    ctx.fillStyle = lamp.tone; ctx.shadowColor = lamp.tone; ctx.shadowBlur = 13;
    ctx.beginPath(); ctx.arc(lamp.x + (index % 2 ? -11 : 11), lamp.y - 32, 5, 0, Math.PI * 2); ctx.fill(); ctx.shadowBlur = 0;
  });

  // Street furniture gives the eye smaller landmarks between large facades.
  const shelters=[[820,1088],[1740,1284],[3320,1088],[4260,1284],[5650,1088],[6600,1284],[820,4088],[3400,4284],[5720,4088],[8050,1088],[8750,4284]];
  shelters.forEach(([x,y],i)=>{
    ctx.fillStyle='rgba(35,50,54,.8)';ctx.fillRect(x-30,y-14,60,24);ctx.strokeStyle='#778183';ctx.lineWidth=2;ctx.strokeRect(x-30,y-14,60,24);
    ctx.fillStyle='rgba(102,146,151,.28)';ctx.fillRect(x-24,y-10,42,16);ctx.fillStyle='#6b4c30';ctx.fillRect(x-20,y+7,38,5);
    ctx.fillStyle=i%2?'#d4523a':'#e8b84a';ctx.fillRect(x+25,y-28,5,18);ctx.fillRect(x+18,y-31,19,6);
  });
  const kiosks=[[1060,1790],[2200,620],[3670,1790],[6060,1790],[9000,1790],[880,4790],[4400,4790],[5900,7790]];
  kiosks.forEach(([x,y],i)=>{ctx.fillStyle=i%2?'#32434a':'#52372b';ctx.fillRect(x-18,y-14,36,28);ctx.fillStyle='#d8c18a';ctx.fillRect(x-22,y-18,44,6);ctx.fillStyle='#111719';ctx.fillRect(x-11,y-8,22,12);});
  const workZones=[[1890,1085],[4480,4085],[5980,7085],[8300,10085]];
  workZones.forEach(([x,y])=>{for(let n=0;n<4;n++){ctx.fillStyle=n%2?'#151719':'#d77d27';ctx.fillRect(x+n*18,y,16,8);}ctx.fillStyle='#df8a2d';ctx.beginPath();ctx.moveTo(x+8,y);ctx.lineTo(x+14,y-20);ctx.lineTo(x+20,y);ctx.fill();});
}

function drawDistrictGroundDetails() {
  // Parks, plazas, service yards and wet reflections break up the block grid
  // without changing the city's collision geometry.
  const rounded=(x,y,w,h,r)=>{ctx.beginPath();ctx.moveTo(x+r,y);ctx.lineTo(x+w-r,y);ctx.quadraticCurveTo(x+w,y,x+w,y+r);ctx.lineTo(x+w,y+h-r);ctx.quadraticCurveTo(x+w,y+h,x+w-r,y+h);ctx.lineTo(x+r,y+h);ctx.quadraticCurveTo(x,y+h,x,y+h-r);ctx.lineTo(x,y+r);ctx.quadraticCurveTo(x,y,x+r,y);ctx.closePath();};
  const parkTree=(x,y,size,seed)=>{
    ctx.fillStyle='rgba(0,0,0,.38)';ctx.beginPath();ctx.ellipse(x+8,y+7,size*1.15,size*.62,0,0,Math.PI*2);ctx.fill();
    ctx.fillStyle='#4a3020';ctx.fillRect(x-2,y-2,4,13);ctx.fillStyle=['#173c2b','#204c32','#2a5637'][seed%3];
    for(let n=0;n<6;n++){const a=n*2.2+seed;ctx.beginPath();ctx.arc(x+Math.cos(a)*size*.42,y-7+Math.sin(a)*size*.34,size*.55,0,Math.PI*2);ctx.fill();}
    ctx.fillStyle='rgba(107,137,80,.35)';ctx.beginPath();ctx.arc(x-size*.25,y-size*.65,size*.3,0,Math.PI*2);ctx.fill();
  };
  for (const [i, park] of parkZones.entries()) {
    rounded(park.x,park.y,park.w,park.h,28);ctx.fillStyle=i%2?'#1b3024':'#203529';ctx.fill();ctx.strokeStyle='#615d50';ctx.lineWidth=5;ctx.stroke();
    // Curved pale paths replace the rigid cross used in the first version.
    ctx.strokeStyle='rgba(190,178,145,.42)';ctx.lineWidth=15;ctx.lineCap='round';
    ctx.beginPath();ctx.moveTo(park.x+18,park.y+park.h*.68);ctx.quadraticCurveTo(park.x+park.w*.42,park.y+park.h*.2,park.x+park.w-18,park.y+park.h*.42);ctx.stroke();
    ctx.beginPath();ctx.moveTo(park.x+park.w*.46,park.y+15);ctx.quadraticCurveTo(park.x+park.w*.64,park.y+park.h*.55,park.x+park.w*.54,park.y+park.h-15);ctx.stroke();
    const cx=park.x+park.w*.53,cy=park.y+park.h*.51;
    if(park.type===0){
      ctx.fillStyle='#253b3c';ctx.beginPath();ctx.ellipse(cx,cy,43,28,0,0,Math.PI*2);ctx.fill();ctx.strokeStyle='#879087';ctx.lineWidth=5;ctx.stroke();
      const glow=ctx.createRadialGradient(cx,cy,2,cx,cy,38);glow.addColorStop(0,'rgba(134,197,204,.65)');glow.addColorStop(1,'rgba(55,116,125,.12)');ctx.fillStyle=glow;ctx.beginPath();ctx.ellipse(cx,cy,31,19,0,0,Math.PI*2);ctx.fill();
    }else if(park.type===1){
      ctx.fillStyle='#102d34';ctx.beginPath();ctx.ellipse(cx,cy,park.w*.2,park.h*.23,-.25,0,Math.PI*2);ctx.fill();ctx.strokeStyle='rgba(109,162,157,.55)';ctx.lineWidth=4;ctx.stroke();
      for(let l=0;l<5;l++){ctx.strokeStyle='rgba(151,196,187,.18)';ctx.lineWidth=2;ctx.beginPath();ctx.arc(cx-18+l*9,cy,12,0,Math.PI);ctx.stroke();}
    }else if(park.type===2){
      ctx.fillStyle='#3b3a31';ctx.fillRect(cx-48,cy-29,96,58);ctx.strokeStyle='rgba(225,207,158,.48)';ctx.lineWidth=3;ctx.strokeRect(cx-48,cy-29,96,58);ctx.beginPath();ctx.moveTo(cx,cy-29);ctx.lineTo(cx,cy+29);ctx.stroke();
      ctx.beginPath();ctx.arc(cx-31,cy,10,0,Math.PI*2);ctx.arc(cx+31,cy,10,0,Math.PI*2);ctx.stroke();
    }else{
      for(let s=0;s<4;s++){const sx=cx-62+s*40;ctx.fillStyle=['#9a5733','#365f69','#84642e','#6c3d34'][s];ctx.fillRect(sx,cy-18,28,23);ctx.fillStyle='#d3c29a';ctx.fillRect(sx-3,cy-22,34,5);}
    }
    // Tree belts, benches, bins and warm footlights make the park inhabited.
    for(let t=0;t<12;t++){const edge=t%4,ratio=(Math.floor(t/4)+1)/4;const tx=edge===0?park.x+park.w*ratio:edge===1?park.x+park.w-18:edge===2?park.x+park.w*(1-ratio):park.x+18;const ty=edge===0?park.y+18:edge===1?park.y+park.h*ratio:edge===2?park.y+park.h-18:park.y+park.h*(1-ratio);parkTree(tx,ty,15+(t+i)%5,t+i);}
    for(let b=0;b<3;b++){const bx=park.x+park.w*(.25+b*.25),by=park.y+park.h*.78;ctx.fillStyle='#171a19';ctx.fillRect(bx-17,by+4,38,6);ctx.fillStyle='#76583a';ctx.fillRect(bx-19,by,38,5);}
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

function drawShoreLife() {
  // Beaches, rocks and mooring posts broaden the world outside the street grid.
  for(const island of islands){
    const samples=[[.14,.04],[.38,.01],[.72,.03],[.96,.27],[.98,.7],[.74,.97],[.34,.99],[.04,.72],[.02,.32]];
    samples.forEach(([u,v],i)=>{
      const x=island.x+island.w*u,y=island.y+island.h*v;
      ctx.fillStyle=i%3===0?'#77705c':'#3b4240';ctx.beginPath();ctx.ellipse(x,y,13+i%4*3,8+i%3*2,i*.7,0,Math.PI*2);ctx.fill();
      if(i%3===1){ctx.fillStyle='#202522';ctx.beginPath();ctx.arc(x+8,y-9,10,0,Math.PI*2);ctx.fill();}
    });
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

function updatePoliceAI(dt) {
  const evadeCard = document.getElementById('evadeStatusCard');
  const wantedPill = document.getElementById('wantedBadge');

  if (state.wanted === 0) {
    policeCars.length = 0;
    if (evadeCard) evadeCard.style.display = 'none';
    if (wantedPill) { wantedPill.classList.remove('active', 'evading'); }
    return;
  }

  const targetCops = Math.min(4, state.wanted + 1);
  while (policeCars.length < targetCops) {
    const ang = Math.random() * Math.PI * 2;
    const dist = 600 + Math.random() * 200;
    const sx = player.x + Math.cos(ang) * dist;
    const sy = player.y + Math.sin(ang) * dist;
    if (isPositionOnSolidGround(sx, sy)) {
      policeCars.push({
        x: sx, y: sy, angle: 0, speed: 0, maxSpeed: 7.2, strobePhase: 0
      });
    }
  }

  let anyCopSees = false;
  for (let i = policeCars.length - 1; i >= 0; i--) {
    const cop = policeCars[i];
    cop.strobePhase += 0.3;
    if (!isPositionOnSolidGround(cop.x, cop.y)) {
      policeCars.splice(i, 1);
      continue;
    }
    const dist = Math.hypot(player.x - cop.x, player.y - cop.y);
    if (dist < 450) anyCopSees = true;

    const targetAng = Math.atan2(player.y - cop.y, player.x - cop.x);
    let diff = targetAng - cop.angle;
    while (diff < -Math.PI) diff += Math.PI * 2;
    while (diff > Math.PI) diff -= Math.PI * 2;
    cop.angle += Math.sign(diff) * Math.min(Math.abs(diff), 0.04);
    cop.speed = Math.min(cop.maxSpeed, cop.speed + 0.12);
    cop.x += Math.cos(cop.angle) * cop.speed;
    cop.y += Math.sin(cop.angle) * cop.speed;

    if (dist < 34) {
      player.speed *= 0.75;
      if (state.invulnTimer === 0) {
        player.hp = Math.max(0, player.hp - 8);
        sound.playImpact();
      }
    }
  }

  if (anyCopSees) {
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
      state.evading = false;
      policeCars.length = 0;
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
  const center = projectIso(player.x + leadX, player.y + leadY);
  ctx.translate(w / 2, h / 2);
  const cameraZoom = w > 900 ? 1.04 : .82;
  ctx.scale(cameraZoom, cameraZoom);
  ctx.translate(-center.x, -center.y);
  ctx.transform(Math.sqrt(3) / 2, 0.5, -Math.sqrt(3) / 2, 0.5, 0, 0);

  // Layered harbour water: depth colour, broad current bands, small wavelets
  // and broken light reflections continue beyond the playable archipelago.
  const waterRange=4300, now=performance.now();
  const sea=ctx.createLinearGradient(player.x-waterRange,player.y-waterRange,player.x+waterRange,player.y+waterRange);
  sea.addColorStop(0,'#07151d');sea.addColorStop(.42,'#0b222b');sea.addColorStop(.72,'#0b2a31');sea.addColorStop(1,'#061820');
  ctx.fillStyle=sea;ctx.fillRect(player.x-waterRange,player.y-waterRange,waterRange*2,waterRange*2);
  ctx.save();ctx.globalCompositeOperation='screen';
  for(let band=-6;band<=6;band++){
    const by=player.y+band*310+Math.sin(now*.00018+band)*35;
    const g=ctx.createLinearGradient(player.x-1800,by,player.x+1800,by+70);g.addColorStop(0,'rgba(81,141,151,0)');g.addColorStop(.35,'rgba(81,141,151,.045)');g.addColorStop(.62,'rgba(157,185,174,.08)');g.addColorStop(1,'rgba(81,141,151,0)');
    ctx.fillStyle=g;ctx.beginPath();ctx.ellipse(player.x,by,2100,38,0,0,Math.PI*2);ctx.fill();
  }
  ctx.restore();
  ctx.strokeStyle = 'rgba(137,190,191,.25)'; ctx.lineWidth = 2;
  const waterStartX=Math.floor((player.x-2500)/180)*180, waterStartY=Math.floor((player.y-2500)/170)*170;
  for (let x = waterStartX; x < player.x+2500; x += 180) for (let y = waterStartY; y < player.y+2500; y += 170) {
    if (isPositionOnSolidGround(x,y)) continue;
    const drift = Math.sin(now*.0007+x+y*.2)*14;
    ctx.beginPath();ctx.moveTo(x-34+drift,y);ctx.quadraticCurveTo(x+8+drift,y-7,x+58+drift,y+5);ctx.stroke();
    if((Math.floor(x/180)+Math.floor(y/170))%5===0){ctx.strokeStyle='rgba(214,188,120,.16)';ctx.beginPath();ctx.moveTo(x+10,y+20);ctx.lineTo(x+76,y+27);ctx.stroke();ctx.strokeStyle='rgba(137,190,191,.25)';}
  }
  // 1. Island Bases with Dark Shoreline
  islands.forEach(isl => {
    coastPath(ctx, isl);ctx.strokeStyle='rgba(34,91,94,.68)';ctx.lineWidth=55;ctx.stroke();
    ctx.strokeStyle='#647365';ctx.lineWidth=20;ctx.stroke();
    ctx.fillStyle = '#202721';ctx.fill();
    ctx.strokeStyle = '#686556';ctx.lineWidth = 7;ctx.stroke();
  });
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
  ctx.fillStyle='#373b3b';ctx.fillRect(1400,2140,650,100);
  ctx.strokeStyle='#c8c5ae';ctx.lineWidth=3;ctx.setLineDash([30,25]);ctx.beginPath();ctx.moveTo(1420,2190);ctx.lineTo(2030,2190);ctx.stroke();ctx.setLineDash([]);
  ctx.fillStyle='#373b3b';ctx.fillRect(1400,8040,650,100);
  ctx.strokeStyle='#c8c5ae';ctx.lineWidth=3;ctx.setLineDash([30,25]);ctx.beginPath();ctx.moveTo(1420,8090);ctx.lineTo(2030,8090);ctx.stroke();ctx.setLineDash([]);
  for(const [x,y] of [[1040,2070],[6550,2070],[6550,8070]]){ctx.strokeStyle='#d3c58e';ctx.lineWidth=4;ctx.beginPath();ctx.arc(x,y,55,0,Math.PI*2);ctx.stroke();ctx.fillStyle='#d3c58e';ctx.font='bold 42px sans-serif';ctx.textAlign='center';ctx.fillText('H',x,y+15);}

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

  // 3. Wet Asphalt Roads with Sidewalks & Crosswalks
  roads.forEach((r, roadIndex) => {
    // Sidewalk border
    ctx.fillStyle = PALETTE.sidewalk;
    ctx.fillRect(r.x - 12, r.y - 12, r.w + 24, r.h + 24);
    ctx.strokeStyle = PALETTE.curb;
    ctx.lineWidth = 2;
    ctx.strokeRect(r.x - 12, r.y - 12, r.w + 24, r.h + 24);

    // Asphalt
    ctx.fillStyle = PALETTE.asphalt;
    ctx.fillRect(r.x, r.y, r.w, r.h);
    drawWetRoadSurface(r, roadIndex);

    // Markings
    ctx.strokeStyle = PALETTE.roadMarkingWhite;
    ctx.lineWidth = 1;
    ctx.strokeRect(r.x, r.y, r.w, r.h);

    ctx.strokeStyle = PALETTE.roadMarkingYellow;
    ctx.lineWidth = 2.5;
    ctx.setLineDash([16, 20]);
    ctx.beginPath();
    if (r.dir === 'h') {
      ctx.moveTo(r.x, r.y + r.h / 2);
      ctx.lineTo(r.x + r.w, r.y + r.h / 2);
    } else {
      ctx.moveTo(r.x + r.w / 2, r.y);
      ctx.lineTo(r.x + r.w / 2, r.y + r.h);
    }
    ctx.stroke();
    ctx.setLineDash([]);
  });

  // Continuous intersections: no kerbs or lane stripes across crossing roads.
  for (const horizontal of roads.filter(r => r.dir === 'h')) {
    for (const vertical of roads.filter(r => r.dir === 'v')) {
      if (vertical.x < horizontal.x || vertical.x + vertical.w > horizontal.x + horizontal.w || horizontal.y < vertical.y || horizontal.y + horizontal.h > vertical.y + vertical.h) continue;
      ctx.fillStyle = PALETTE.asphalt;
      ctx.fillRect(vertical.x - 2, horizontal.y - 2, vertical.w + 4, horizontal.h + 4);
      drawRoundedJunction(ctx,horizontal,vertical,PALETTE.asphalt);
      ctx.fillStyle = 'rgba(220,216,197,.48)';
      for (let stripe = 8; stripe < vertical.w - 8; stripe += 15) {
        ctx.fillRect(vertical.x + stripe, horizontal.y + 8, 7, 20);
        ctx.fillRect(vertical.x + stripe, horizontal.y + horizontal.h - 28, 7, 20);
      }
    }
  }

  // 4. District texture and lived-in ground detail.
  drawDistrictGroundDetails();

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
  buildings
    .map((building,index)=>({building,index}))
    .filter(({building:b})=>Math.abs((b.x+b.w*.5)-player.x)<2300&&Math.abs((b.y+b.h*.5)-player.y)<2300)
    .sort((a,b)=>(a.building.x+a.building.y+a.building.w+a.building.h)-(b.building.x+b.building.y+b.building.w+b.building.h))
    .forEach(({building,index})=>drawBuilding(building,index));

  // 8. Pedestrians are composited upright after the isometric world pass.

  // 9. Traffic Vehicles (Chassis, Cabin, Glass & Lights)
  trafficCars.forEach(c => drawDetailedCar(ctx, c.x, c.y, c.angle, c.color, c.width || 46, c.height || 22, false));

  // 10. Police Squad Cars
  policeCars.forEach(cop => {
    drawDetailedCar(ctx, cop.x, cop.y, cop.angle, '#0f172a', 48, 24, true);
    const strobe = Math.sin(cop.strobePhase) > 0;
    ctx.save();
    ctx.translate(cop.x, cop.y);
    ctx.rotate(cop.angle);
    ctx.fillStyle = strobe ? '#ef4444' : '#3b82f6';
    ctx.shadowColor = strobe ? '#ef4444' : '#3b82f6';
    ctx.shadowBlur = 15;
    ctx.fillRect(-4, -7, 8, 14);
    ctx.restore();
  });

  // 11. Water Splashes
  waterSplashes.forEach((sp, idx) => {
    ctx.fillStyle = `rgba(180, 210, 240, ${sp.alpha})`;
    ctx.beginPath();
    ctx.arc(sp.x, sp.y, sp.size, 0, Math.PI * 2);
    ctx.fill();
    sp.x += sp.vx;
    sp.y += sp.vy;
    sp.alpha -= 0.02;
    if (sp.alpha <= 0) waterSplashes.splice(idx, 1);
  });

  for (const vehicle of roam?.fleet || []) drawTransport(ctx,vehicle,performance.now()/1000);
  if (roam?.special) {
    if (roam.mode === 'foot') {
      // Screen-space pedestrian is drawn after restoring the camera.
    } else drawTransport(ctx,{...roam.profile,type:roam.mode,x:player.x,y:player.y,angle:player.angle},performance.now()/1000,roam.altitude);
  } else {
    // 12. Player vehicle uses the same volumetric model as traffic.
    if(!state.isDrowning){
      ctx.save();ctx.translate(player.x,player.y);ctx.rotate(player.angle);
      const headGrad=ctx.createRadialGradient(24,0,10,120,0,140);headGrad.addColorStop(0,'rgba(255,245,210,.4)');headGrad.addColorStop(.5,'rgba(255,230,160,.16)');headGrad.addColorStop(1,'rgba(255,230,160,0)');
      ctx.fillStyle=headGrad;ctx.beginPath();ctx.moveTo(24,-9);ctx.lineTo(140,-48);ctx.lineTo(140,48);ctx.lineTo(24,9);ctx.closePath();ctx.fill();ctx.restore();
    }
    ctx.save();ctx.globalAlpha=state.isDrowning?Math.max(.2,1-state.drownProgress):1;
    drawDetailedCar(ctx,player.x,player.y,player.angle,player.bodyColor,player.width,player.height,false);ctx.restore();
  }

  ctx.restore();

  drawScreenPedestrians(w,h,center,cameraZoom);

  drawNoirPostFx(w,h);

  // Radar & HUD
  renderRadar();
  const speedEl = document.getElementById('hudSpeed');
  if (speedEl) speedEl.innerText = roam?.mode === 'foot' ? 'ПЕШКОМ' : Math.round(Math.abs(player.speed) * 12);
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

function drawScreenPedestrian(ped,sx,sy,index){
  const scale=ped.player?1.2:.86+stableVisualHash(ped.x,ped.y,index)*.17;
  const step=Math.sin(ped.walkPhase||0)*2.3*scale, bodyH=15*scale, shoulder=4.4*scale;
  ctx.save();ctx.translate(Math.round(sx),Math.round(sy));
  ctx.fillStyle='rgba(0,0,0,.5)';ctx.beginPath();ctx.ellipse(3*scale,2,7*scale,3.2*scale,-.08,0,Math.PI*2);ctx.fill();
  ctx.strokeStyle=ped.pants||'#22262a';ctx.lineWidth=3.2*scale;ctx.lineCap='round';ctx.beginPath();ctx.moveTo(-2,-9*scale);ctx.lineTo(-3+step,0);ctx.moveTo(2,-9*scale);ctx.lineTo(3-step,0);ctx.stroke();
  // Jacket front plus a darker side face reads as a small upright volume.
  ctx.fillStyle='rgba(12,13,14,.68)';ctx.beginPath();ctx.moveTo(-shoulder+2,-bodyH+2);ctx.lineTo(shoulder+2,-bodyH+2);ctx.lineTo(3.4*scale+2,-7*scale+2);ctx.lineTo(-3.4*scale+2,-7*scale+2);ctx.closePath();ctx.fill();
  const coat=ctx.createLinearGradient(-shoulder,-bodyH,shoulder,-7*scale);coat.addColorStop(0,ped.shirt||'#62503f');coat.addColorStop(1,'rgba(31,32,31,.95)');ctx.fillStyle=coat;
  ctx.beginPath();ctx.moveTo(-shoulder,-bodyH);ctx.quadraticCurveTo(0,-bodyH-2*scale,shoulder,-bodyH);ctx.lineTo(3.4*scale,-7*scale);ctx.lineTo(-3.4*scale,-7*scale);ctx.closePath();ctx.fill();
  ctx.strokeStyle=ped.shirt||'#62503f';ctx.lineWidth=2.4*scale;ctx.beginPath();ctx.moveTo(-shoulder,-bodyH+2);ctx.lineTo(-6*scale,-8*scale+step*.45);ctx.moveTo(shoulder,-bodyH+2);ctx.lineTo(6*scale,-8*scale-step*.45);ctx.stroke();
  const headY=-bodyH-5.2*scale, head=ctx.createRadialGradient(-1*scale,headY-1*scale,1,0,headY,4.5*scale);head.addColorStop(0,'#ffe0b7');head.addColorStop(1,ped.skin||'#c99f77');ctx.fillStyle=head;ctx.beginPath();ctx.arc(0,headY,4.4*scale,0,Math.PI*2);ctx.fill();
  ctx.fillStyle=ped.hair||'#211915';ctx.beginPath();ctx.arc(-.5*scale,headY-1.5*scale,4.2*scale,Math.PI,Math.PI*2);ctx.fill();
  if(index%6===0){ctx.fillStyle='#17191b';ctx.fillRect(-5*scale,headY-4*scale,10*scale,2*scale);ctx.fillRect(-3.2*scale,headY-6*scale,6.4*scale,3*scale);}
  if(index%5===0){ctx.fillStyle='#5d3e2c';ctx.fillRect(5*scale,-13*scale,4*scale,7*scale);}
  if(ped.player){ctx.strokeStyle='#e8b84a';ctx.lineWidth=2;ctx.beginPath();ctx.ellipse(0,2,9*scale,5*scale,0,0,Math.PI*2);ctx.stroke();}
  ctx.restore();
}

function drawScreenPedestrians(w,h,center,zoom){
  const actors=pedestrians.slice();
  if(roam?.mode==='foot')actors.push({x:player.x,y:player.y,walkPhase:performance.now()*.012,shirt:'#735235',pants:'#22272b',skin:'#d5b594',hair:'#1a1512',player:true});
  actors.map((ped,index)=>{const p=projectIso(ped.x,ped.y);return{ped,index,sx:w/2+(p.x-center.x)*zoom,sy:h/2+(p.y-center.y)*zoom};})
    .filter(a=>a.sx>-40&&a.sx<w+40&&a.sy>-60&&a.sy<h+30).sort((a,b)=>a.sy-b.sy)
    .forEach(a=>drawScreenPedestrian(a.ped,a.sx,a.sy,a.index));
}

function drawDetailedCar(ctx, x, y, ang, color, w, h, isPolice = false) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(ang);
  const elevation=5.5, cs=Math.cos(ang), sn=Math.sin(ang);
  // Inverse-rotated world vertical; after the camera transform this stays an
  // upright screen-space extrusion at every vehicle heading.
  const zx=-elevation*(cs+sn), zy=elevation*(sn-cs);
  const body=[[-w*.5+h*.12,-h*.5], [w*.38,-h*.5], [w*.5,-h*.28], [w*.5,h*.28], [w*.38,h*.5], [-w*.5+h*.12,h*.5], [-w*.5,h*.25], [-w*.5,-h*.25]];
  const poly=(points,fill,stroke)=>{ctx.beginPath();points.forEach(([px,py],i)=>i?ctx.lineTo(px,py):ctx.moveTo(px,py));ctx.closePath();ctx.fillStyle=fill;ctx.fill();if(stroke){ctx.strokeStyle=stroke;ctx.stroke();}};

  ctx.save();ctx.globalCompositeOperation='screen';
  const tailGlow=ctx.createLinearGradient(-82,0,-w*.35,0);tailGlow.addColorStop(0,'rgba(204,24,16,0)');tailGlow.addColorStop(.72,'rgba(232,33,18,.1)');tailGlow.addColorStop(1,'rgba(255,47,22,.27)');
  ctx.fillStyle=tailGlow;ctx.beginPath();ctx.ellipse(-45,0,38,7,0,0,Math.PI*2);ctx.fill();ctx.restore();
  ctx.fillStyle='rgba(0,0,0,.58)';ctx.beginPath();ctx.ellipse(4,5,w*.58,h*.58,0,0,Math.PI*2);ctx.fill();

  // Tyres remain on the road while the body is raised above them.
  ctx.fillStyle='#050607';
  for(const wx of [-w*.3,w*.23])for(const wy of [-h*.54,h*.44])ctx.fillRect(wx-5,wy,11,4.5);
  // Dark vertical side faces.
  for(let i=0;i<body.length;i++){
    const a=body[i],b=body[(i+1)%body.length];
    if(i===0||i===1||i===2||i===6)poly([a,b,[b[0]+zx,b[1]+zy],[a[0]+zx,a[1]+zy]],i<2?'rgba(23,25,27,.92)':'rgba(8,10,12,.82)');
  }
  const top=body.map(([px,py])=>[px+zx,py+zy]);
  ctx.lineWidth=1.35;poly(top,color,'#090b0d');
  // Bonnet/trunk highlights make the heading unambiguous.
  ctx.strokeStyle='rgba(255,238,202,.28)';ctx.lineWidth=1;
  ctx.beginPath();ctx.moveTo(w*.22+zx,-h*.42+zy);ctx.lineTo(w*.42+zx,-h*.22+zy);ctx.lineTo(w*.42+zx,h*.22+zy);ctx.lineTo(w*.22+zx,h*.42+zy);ctx.stroke();
  ctx.strokeStyle='rgba(0,0,0,.42)';ctx.beginPath();ctx.moveTo(-w*.32+zx,-h*.4+zy);ctx.lineTo(-w*.32+zx,h*.4+zy);ctx.stroke();

  // Raised glass cabin with distinct front and rear windscreens.
  const rzX=zx*1.72,rzY=zy*1.72;
  const cabin=[[-w*.18,-h*.36],[w*.18,-h*.34],[w*.27,-h*.2],[w*.27,h*.2],[w*.18,h*.34],[-w*.18,h*.36],[-w*.27,h*.2],[-w*.27,-h*.2]].map(([px,py])=>[px+rzX,py+rzY]);
  poly(cabin,'#17262e','#080d10');
  ctx.fillStyle='rgba(100,139,151,.38)';poly([[w*.04+rzX,-h*.27+rzY],[w*.18+rzX,-h*.2+rzY],[w*.18+rzX,h*.2+rzY],[w*.04+rzX,h*.27+rzY]],'rgba(99,137,149,.45)');
  ctx.strokeStyle='rgba(220,232,226,.2)';ctx.beginPath();ctx.moveTo(-w*.08+rzX,-h*.31+rzY);ctx.lineTo(-w*.08+rzX,h*.31+rzY);ctx.stroke();

  ctx.fillStyle='#fff2b0';ctx.shadowColor='#ffe18a';ctx.shadowBlur=5;
  ctx.fillRect(w*.46+zx,-h*.34+zy,3.5,5);ctx.fillRect(w*.46+zx,h*.22+zy,3.5,5);ctx.shadowBlur=0;
  ctx.fillStyle='#ef3629';ctx.fillRect(-w*.5+zx,-h*.31+zy,3.5,5);ctx.fillRect(-w*.5+zx,h*.2+zy,3.5,5);
  if(isPolice){ctx.fillStyle='#e43b35';ctx.fillRect(-2+rzX,-5+rzY,5,5);ctx.fillStyle='#3d7ee8';ctx.fillRect(3+rzX,-5+rzY,5,5);}
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

  islands.forEach(isl => {
    radarCtx.fillStyle = 'rgba(255, 255, 255, 0.08)';
    coastPath(radarCtx,isl,scale,-player.x*scale,-player.y*scale);radarCtx.fill();
  });

  bridges.forEach(br => {
    radarCtx.fillStyle = 'rgba(56, 189, 248, 0.4)';
    radarCtx.fillRect((br.x - player.x) * scale, (br.y - player.y) * scale, br.w * scale, br.h * scale);
  });

  radarCtx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
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

  islands.forEach(isl => {
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
    fullMapCtx.fillRect(x-3,y-3,6,6);fullMapCtx.font='12px sans-serif';fullMapCtx.fillText(vehicle.name,x+6,y-6);
  }
  fullMapCtx.fillStyle = '#fff';
  fullMapCtx.beginPath();
  fullMapCtx.arc(mapX + player.x * scale, mapY + player.y * scale, 5, 0, Math.PI * 2);
  fullMapCtx.fill();
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
      state.evading = false;
      policeCars.length = 0;
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
  roam = createFreeRoam(player, parkedCars, buildings, trees, isPositionOnSolidGround, showToast);
  const roamControls = document.createElement('div');
  roamControls.className = 'roam-controls';
  const enterButton = document.createElement('button');enterButton.textContent = 'Выйти / сесть · E';enterButton.addEventListener('click',()=>roam.interact());
  const flyButton = document.createElement('button');flyButton.textContent = 'Высота · Q';flyButton.addEventListener('click',()=>roam.toggleFlight());
  roamControls.append(enterButton,flyButton);document.body.appendChild(roamControls);
  loadProgress();
  setupInputListeners();
  driveLab = createDriveLab({ player, state, canvas, roads, buildings, trafficCars, policeCars, routeInput, roam });
  state.lastFrameTime = performance.now();
  requestAnimationFrame(gameLoop);
}
if (document.readyState === 'loading') window.addEventListener('DOMContentLoaded', boot, { once: true });
else boot();
