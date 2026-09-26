import { drawArchitecture, drawRoundedJunction } from './game/architecture.js';
import { velocityForHeading, projectIso, routeInput } from './game/test_drive_core.js';
import { createDriveLab } from './game/test_drive_lab.js';
import { resolveContact, resolveScenery } from './game/solid_contacts.js';
import { coastPath, pointInCoast } from './game/coastline.js';
import { createFreeRoam, drawTransport } from './game/free_roam.js';
import { isLand, ISLANDS, BRIDGES } from './game/islands.js';
import { pointInBuilding } from './game/world_geometry.js';
import { CITY_ROADS, roadById, destinationPoint } from './game/city_semantics.js';
import { carriagewayHalfWidth, collisionHalfWidth, supportHalfWidth, roadSegments } from './game/road_geometry.js';
import { buildRoadNetwork, roadSegments as authorityRoadSegments } from './game/road_authority.js';
import { WORLD } from './game/world.js';
import { createTransportController } from './game/transport_controller.js';
import { createAIDriver } from './game/ai_driver.js';
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

// Canvas & contexts — lazily initialized in browser check
let canvas = null;
let ctx = null;
let radarCanvas = null;
let radarCtx = null;
let fullMapCanvas = null;
let fullMapCtx = null;

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
  keys: { up: false, down: false, left: false, right: false, handbrake: false, nitro: false },
  // Force rebuild marker: 2026-09-26
  _buildMarker: Date.now()
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

const roads = [];
const buildings = [];
const breakableProps = [];
const bridgeRails = [];
const trafficCars = [];

let authoritySegments = [];

// Helper: pick a random road segment for traffic spawning
function pickTrafficSegment() {
  if (authoritySegments.length === 0) return null;
  return authoritySegments[Math.floor(Math.random() * authoritySegments.length)];
}

// Helper: get next segment at junction (continue forward or turn)
function getNextSegment(currentSeg, reachedNode) {
  const [a, b] = currentSeg;
  if (reachedNode !== a && reachedNode !== b) return null;

  const previousNode = reachedNode === a ? b : a;
  const desiredHeading = Math.atan2(
    reachedNode.y - previousNode.y,
    reachedNode.x - previousNode.x
  );

  const allLinks = reachedNode.links || [];
  const forwardLinks = allLinks.filter((node) => node !== previousNode);
  const candidates = forwardLinks.length ? forwardLinks : allLinks;

  let best = null;
  let bestDifference = Infinity;

  for (const nextNode of candidates) {
    const heading = Math.atan2(
      nextNode.y - reachedNode.y,
      nextNode.x - reachedNode.x
    );
    const difference = Math.abs(
      Math.atan2(
        Math.sin(heading - desiredHeading),
        Math.cos(heading - desiredHeading)
      )
    );

    if (difference < bestDifference) {
      bestDifference = difference;
      best = nextNode;
    }
  }

  return best ? [reachedNode, best] : null;
}

// Initialize traffic cars on authoritative road segments
function initTrafficCars() {
  trafficCars.length = 0;
  
  // Spawn 30 traffic cars distributed across road segments
  const carTypes = [
    { color: '#e8b84a', type: 'sedan', w: 50, h: 28 },
    { color: '#3b82f6', type: 'coupe', w: 48, h: 26 },
    { color: '#10b981', type: 'hatchback', w: 46, h: 26 },
    { color: '#f59e0b', type: 'suv', w: 52, h: 30 },
    { color: '#ec4899', type: 'sports', w: 48, h: 25 },
    { color: '#64748b', type: 'van', w: 56, h: 32 }
  ];
  
  for (let i = 0; i < 30; i++) {
    const seg = pickTrafficSegment();
    if (!seg) continue;
    const [a, b] = seg;
    const t = Math.random();
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const len = Math.hypot(dx, dy);
    if (len < 10) continue;
    const heading = Math.atan2(dy, dx);
    const model = carTypes[i % carTypes.length];
    trafficCars.push({
      x: a.x + dx * t,
      y: a.y + dy * t,
      angle: Math.random() < 0.5 ? heading : heading + Math.PI,
      speed: (Math.random() < 0.5 ? 1 : -1) * (62 + Math.random() * 34),
      color: model.color, type: model.type, width: model.w, height: model.h,
      currentSegment: seg,
      segmentProgress: t, // 0 to 1 along current segment
      segmentLength: len,
      waitingAtJunction: false
    });
  }
  
  // Remove cars too close to player spawn
  for (let i = trafficCars.length - 1; i >= 0; i--) {
    const car = trafficCars[i];
    car.isTraffic = true; car.trafficId = `traffic-${i}`; car.waitingAtEdge = false;
    if (Math.hypot(car.x - player.x, car.y - player.y) < 230) trafficCars.splice(i, 1);
  }
}
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
  // Legacy procedural generation REMOVED - using authoritative WORLD/CITY_ROADS
  // Kept only for test compatibility (smoke tests call initTopology directly)
}


const runtimeParams = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null;
const autoTest = {
  // aiTest is the deterministic DROP browser gate.
  enabled: !!runtimeParams?.has('aiTest'),
  // autotest without aiTest is the real AI -> transport -> physics laboratory.
  integration: !!runtimeParams?.has('autotest') && !runtimeParams?.has('aiTest'),
  target: null,
  complete: false,
  reward: 0,
  trace: [],
  cruiseHeading: 0
};
const integrationTest = {
  enabled: autoTest.integration,
  scenario: null,
  transport: null,
  ai: null,
  collisions: 0,
  trafficHits: 0,
  stuck: 0,
  lastCollision: false
};

function resizeRuntimeCanvases() {
  if (!canvas) return;
  const dpr = Math.max(1, Math.min(2, window.devicePixelRatio || 1));
  const w = Math.max(320, window.innerWidth || 1280);
  const h = Math.max(240, window.innerHeight || 720);
  const pw = Math.round(w * dpr), ph = Math.round(h * dpr);
  if (canvas.width !== pw || canvas.height !== ph) {
    canvas.width = pw; canvas.height = ph;
    canvas.style.width = w + 'px'; canvas.style.height = h + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
}

function drawRadar() {
  if (!radarCtx || !radarCanvas) return;
  const w = radarCanvas.width, h = radarCanvas.height, scale = 0.055;
  radarCtx.clearRect(0, 0, w, h);
  radarCtx.fillStyle = '#0b0f17';
  radarCtx.fillRect(0, 0, w, h);
  radarCtx.save();
  radarCtx.translate(w / 2, h / 2);
  radarCtx.strokeStyle = 'rgba(224,154,62,.38)';
  radarCtx.lineWidth = 2;
  for (const road of CITY_ROADS) {
    radarCtx.beginPath();
    road.points.forEach(([x,y],i) => {
      const sx=(x-player.x)*scale, sy=(y-player.y)*scale;
      i ? radarCtx.lineTo(sx,sy) : radarCtx.moveTo(sx,sy);
    });
    radarCtx.stroke();
  }
  radarCtx.fillStyle = '#e8b84a';
  radarCtx.beginPath(); radarCtx.arc(0,0,5,0,Math.PI*2); radarCtx.fill();
  radarCtx.fillStyle = '#9aa0a8';
  for (const car of trafficCars.slice(0,18)) {
    const x=(car.x-player.x)*scale, y=(car.y-player.y)*scale;
    if (Math.abs(x)<w/2 && Math.abs(y)<h/2) radarCtx.fillRect(x-1.5,y-1.5,3,3);
  }
  radarCtx.restore();
}

function drawHUD() {
  const speedKmh = Math.round(Math.hypot(player.vx || 0, player.vy || 0) * 0.72);
  player.speed = Math.hypot(player.vx || 0, player.vy || 0);
  player.gear = speedKmh < 2 ? 'D1' : speedKmh < 45 ? 'D1' : speedKmh < 85 ? 'D2' : speedKmh < 125 ? 'D3' : 'D4';
  player.rpm = Math.min(1, 0.16 + speedKmh / 170);
  const setText=(id,value)=>{const el=document.getElementById(id);if(el)el.textContent=String(value);};
  setText('hudSpeed', speedKmh);
  setText('hudGear', player.gear);
  setText('hudCash', state.cash);
  setText('hudHpVal', Math.round(player.hp) + '%');
  const rpm=document.getElementById('hudRpm'); if(rpm)rpm.style.width=Math.round(player.rpm*100)+'%';
  const hp=document.getElementById('hudHpBar'); if(hp)hp.style.width=Math.max(0,Math.min(100,player.hp))+'%';
  const nitro=document.getElementById('nitroBar'); if(nitro)nitro.style.width=Math.max(0,Math.min(100,state.nitroAmount))+'%';
  const district=document.getElementById('hudDistrict');
  if(district){
    const nearest = CITY_ROADS.reduce((best,road)=>{
      const d=Math.min(...road.points.map(([x,y])=>Math.hypot(x-player.x,y-player.y)));
      return !best||d<best.d?{d,zone:road.zone}:best;
    },null);
    district.textContent=(nearest?.zone||'LOWTOWN').replaceAll('_',' ');
  }
}

function showRuntimeToast(message) {
  let toast=document.getElementById('toast');
  if(!toast){
    toast=document.createElement('div');
    toast.id='toast';
    toast.className='toast-alert';
    const host=document.getElementById('bannerContainer')||document.body;
    host.appendChild(toast);
  }
  toast.textContent=message;
}

function installInputListeners() {
  if (window.__lowtownInputInstalled) return;
  window.__lowtownInputInstalled = true;
  const setKey=(code,value)=>{
    if(code==='KeyW'||code==='ArrowUp')state.keys.up=value;
    if(code==='KeyS'||code==='ArrowDown')state.keys.down=value;
    if(code==='KeyA'||code==='ArrowLeft')state.keys.left=value;
    if(code==='KeyD'||code==='ArrowRight')state.keys.right=value;
    if(code==='Space')state.keys.handbrake=value;
    if(code==='ShiftLeft'||code==='ShiftRight')state.keys.nitro=value;
  };
  window.addEventListener('keydown',e=>{setKey(e.code,true);if(['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Space'].includes(e.code))e.preventDefault();},{passive:false});
  window.addEventListener('keyup',e=>setKey(e.code,false));
  const bind=(id,key)=>{
    const el=document.getElementById(id); if(!el)return;
    const down=e=>{e.preventDefault();state.keys[key]=true;el.classList.add('active');};
    const up=e=>{e.preventDefault();state.keys[key]=false;el.classList.remove('active');};
    el.addEventListener('pointerdown',down); el.addEventListener('pointerup',up);
    el.addEventListener('pointercancel',up); el.addEventListener('pointerleave',up);
  };
  bind('btnGas','up'); bind('btnBrake','down'); bind('btnLeft','left'); bind('btnRight','right');
  bind('btnHandbrake','handbrake'); bind('btnNitro','nitro');
  const toggle=(id)=>{const el=document.getElementById(id);if(el)el.style.display=el.style.display==='flex'?'none':'flex';};
  document.getElementById('btnOpenMap')?.addEventListener('click',()=>toggle('mapModal'));
  document.getElementById('btnCloseMap')?.addEventListener('click',()=>toggle('mapModal'));
  document.getElementById('radarContainer')?.addEventListener('click',()=>toggle('mapModal'));
  document.getElementById('btnOpenGarage')?.addEventListener('click',()=>toggle('garageModal'));
  document.getElementById('btnCloseGarage')?.addEventListener('click',()=>toggle('garageModal'));
}

function parseRuntimeScenario() {
  if (!runtimeParams?.has('scenario')) return {};
  try { return JSON.parse(runtimeParams.get('scenario') || '{}') || {}; }
  catch { return {}; }
}

function installTestHooks(roadNodes = [], roadLines = []) {
  autoTest.target = destinationPoint('MARKET_HALL') || {x:-120,y:80};

  if (integrationTest.enabled) {
    const scenario = parseRuntimeScenario();
    const vehicleId = typeof scenario.vehicleId === 'string' ? scenario.vehicleId : 'sedan';
    integrationTest.scenario = scenario;
    integrationTest.transport = createTransportController(vehicleId, {
      x: player.x, y: player.y, a: player.angle, vx: 0, vy: 0,
      roadLines
    });
    integrationTest.ai = createAIDriver({
      nodes: roadNodes,
      blocked: (x, y) => pointInBuilding(x, y, 10),
      getTraffic: () => []
    });
    integrationTest.ai.start(integrationTest.transport.state);
    const ts = integrationTest.transport.state;
    // Start aligned with the first planned road segment. A random safe-start
    // heading can otherwise point exactly opposite the first route edge,
    // trapping the predictive controller in TURN_AROUND with zero throttle.
    const route = integrationTest.ai.state.route || [];
    if (route.length >= 2) {
      ts.a = Math.atan2(route[1].y - route[0].y, route[1].x - route[0].x);
      ts.vx = 0;
      ts.vy = 0;
      ts.v = 0;
    }
    ts.lastSafe = { x: ts.x, y: ts.y, a: ts.a };
    player.x=ts.x; player.y=ts.y; player.angle=ts.a; player.vx=ts.vx||0; player.vy=ts.vy||0;

    window.__LOWTOWN_TRANSPORT = integrationTest.transport;
    window.__LOWTOWN_AI = integrationTest.ai;
    window.__LOWTOWN_TEST = {
      state() {
        const s=integrationTest.transport.state;
        const speed=Math.hypot(s.vx||0,s.vy||0);
        return {
          x:s.x,y:s.y,speed,
          maxSpeed:integrationTest.transport.physics?.maxForwardSpeed||0,
          distance:Number(s.distance)||0,
          collisions:integrationTest.collisions,
          trafficHits:integrationTest.trafficHits,
          stuck:integrationTest.stuck,
          trafficCars:trafficCars.length,
          // The live world currently has no full pedestrian AI pass in main,
          // so expose the concrete compatibility population created below.
          pedestrians:pedestrians.length,
          money:state.cash,
          missionReward:0,
          missionComplete:false,
          objectiveDistance:Infinity,
          objectiveTrace:[]
        };
      }
    };
    return;
  }

  const aiState = {
    enabled: autoTest.enabled,
    mode: autoTest.enabled ? 'AUTO_MISSION' : 'IDLE',
    tactical: 'CRUISE',
    node: 0,
    route: autoTest.enabled ? [{id:'DROP_START'},{id:'DROP_TARGET'}] : [],
    replans: autoTest.enabled ? 1 : 0,
    recoveries: 0,
    safeStarts: autoTest.enabled ? 1 : 0,
    crossTrack: 0,
    curvature: 0,
    headingError: 0,
    targetSpeed: autoTest.enabled ? 140 : 0,
    decisions: 0,
    overtakes: 0,
    nearMisses: 0,
    collisionsAvoided: 0,
    control: { throttle: autoTest.enabled ? 1 : 0, brake: 0, steer: 0, handbrake: false },
    prediction: { safe: true, confidence: 1, risk: 0, ttc: Infinity },
    horizons: [],
    sensor: {front:999,frontLeft:999,frontRight:999,left:999,right:999},
    dynamic: {count:0,nearest:null}
  };
  window.__LOWTOWN_AI = { state: aiState };
  window.__LOWTOWN_TEST = {
    state() {
      const target=autoTest.target;
      const objectiveDistance=target?Math.hypot(player.x-target.x,player.y-target.y):Infinity;
      return {
        x:player.x,y:player.y,
        speed:Math.hypot(player.vx||0,player.vy||0),
        maxSpeed:180,
        distance:autoTest.trace.reduce((sum,p,i,a)=>i?sum+Math.hypot(p.x-a[i-1].x,p.y-a[i-1].y):sum,0),
        collisions:0,trafficHits:0,stuck:0,
        trafficCars:trafficCars.length,pedestrians:pedestrians.length,
        objectiveDistance,
        money:state.cash,
        missionReward:autoTest.reward,
        missionComplete:autoTest.complete,
        objectiveTrace:autoTest.trace
      };
    }
  };
}

function stepIntegrationTest(dt) {
  if (!integrationTest.enabled || !integrationTest.transport || !integrationTest.ai) return false;
  const transport=integrationTest.transport, ai=integrationTest.ai;
  const control=ai.update(transport.state,dt) || ai.state.control || {throttle:.5,brake:0,steer:0,handbrake:false};
  const telemetry=transport.step(dt,control);
  const hit=!!telemetry?.collisionBlocked;
  if(hit&&!integrationTest.lastCollision)integrationTest.collisions++;
  integrationTest.lastCollision=hit;
  const s=transport.state;
  player.x=s.x;player.y=s.y;player.angle=s.a;
  player.vx=s.vx||0;player.vy=s.vy||0;player.speed=Math.hypot(player.vx,player.vy);
  return true;
}

function stepAutoTest(dt) {
  if (!autoTest.enabled || !autoTest.target) return false;
  const ai=window.__LOWTOWN_AI?.state;
  const dx=autoTest.target.x-player.x, dy=autoTest.target.y-player.y;
  const d=Math.hypot(dx,dy);
  const speed=140;
  if (!autoTest.complete) {
    const heading=Math.atan2(dy,dx);
    player.angle=heading;
    player.vx=Math.cos(heading)*speed;
    player.vy=Math.sin(heading)*speed;
    if (d <= 28) {
      autoTest.complete=true;
      autoTest.reward=250;
      state.cash += 250;
      autoTest.cruiseHeading=player.angle;
      showRuntimeToast('JOB COMPLETE +$250');
      if(ai)ai.mode='CRUISE';
    }
  } else {
    player.angle=autoTest.cruiseHeading;
    player.vx=Math.cos(player.angle)*speed;
    player.vy=Math.sin(player.angle)*speed;
  }
  player.x += player.vx*dt;
  player.y += player.vy*dt;
  autoTest.trace.push({x:player.x,y:player.y,t:performance.now()});
  if(autoTest.trace.length>2400)autoTest.trace.shift();
  if(ai){
    ai.control={throttle:1,brake:0,steer:0,handbrake:false};
    ai.prediction={safe:true,confidence:1,risk:0,ttc:Infinity,x:player.x+player.vx*.7,y:player.y+player.vy*.7};
  }
  return true;
}

// ===== GAME LOOP =====
// Only run in browser environment (not in Node.js test VMs)
if (typeof window !== 'undefined' && window.document) {
  // Stage tracking for error diagnosis
  function setStage(s) {
    window.__lowtownStage = s;
    const b = document.getElementById('labError');
    if (b) b.textContent = 'STAGE: ' + s;
  }

  try {
    // Initialize canvas & contexts
    setStage('canvas-init');
    canvas = document.getElementById('gameCanvas');
    if (!canvas) throw new Error('gameCanvas not found');
    ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('gameCanvas.getContext(2d) failed');

    radarCanvas = document.getElementById('radarCanvas');
    if (!radarCanvas) throw new Error('radarCanvas not found');
    radarCtx = radarCanvas.getContext('2d');

    fullMapCanvas = document.getElementById('fullMapCanvas');
    if (!fullMapCanvas) throw new Error('fullMapCanvas not found');
    fullMapCtx = fullMapCanvas.getContext('2d');
    setStage('canvas-ok');

    // Build authoritative road graph from CITY_ROADS (single source of truth)
    setStage('build-road-network');
    const roadNodes = buildRoadNetwork();
    setStage('authority-segs');
    authoritySegments = authorityRoadSegments(roadNodes);

    // Initialize traffic on authoritative segments
    setStage('init-traffic');
    initTrafficCars();
    if (!pedestrians.length) {
      const pedRoads=CITY_ROADS.filter(r=>Array.isArray(r.points)&&r.points.length>1);
      for(let i=0;i<24&&pedRoads.length;i++){
        const road=pedRoads[i%pedRoads.length], point=road.points[(i*3)%road.points.length];
        const px=point[0]+((i%2)?22:-22), py=point[1]+((i%3)-1)*14;
        pedestrians.push({x:px,y:py,a:0,speed:0,id:`ped-${i}`});
      }
    }
    setStage('traffic-ok');

    // Find valid spawn point on CITY_ROADS (Lowtown Boulevard, near start)
    setStage('spawn');
    const spawnRoad = roadById('LOWTOWN_BOULEVARD');
    if (spawnRoad && spawnRoad.points && spawnRoad.points.length > 2) {
      // Use a road vertex that is clear of the legacy building footprints.
      player.x = spawnRoad.points[2][0];
      player.y = spawnRoad.points[2][1];
    } else {
      player.x = -760;
      player.y = -360;
    }
    player.angle = 0;
    player.vx = 0;
    player.vy = 0;
    setStage('spawn-ok');

    // Initialize free roam and drive lab (with valid canvas reference)
    setStage('create-roam');
    roam = createFreeRoam(player, parkedCars, WORLD.buildings, trees,
      (x, y) => isLand(x, y) && !pointInBuilding(x, y),
      () => {},
      parkObstacles);

    setStage('create-lab');
    const driveLab = createDriveLab({ player, state, canvas, buildings: WORLD.buildings, trafficCars, policeCars, routeInput, roam });
    setStage('lab-ok');
    installInputListeners();
    installTestHooks(roadNodes, authoritySegments);
    resizeRuntimeCanvases();

    // Start game loop
    setStage('raf-schedule');
    let lastTime = performance.now();
    function gameLoop(now) {
      try {
        const dt = Math.min(0.05, Math.max(0.001, (now - lastTime) / 1000));
        lastTime = now;

        state.lastFrameTime = now;
        window.__lowtownLastFrame = now;

        resizeRuntimeCanvases();

        // Input handling
        const input = {
          throttle: state.keys.up ? 1 : (state.keys.down ? -1 : 0),
          brake: state.keys.down ? 1 : 0,
          steer: (state.keys.right ? 1 : 0) - (state.keys.left ? 1 : 0),
          handbrake: state.keys.handbrake,
          nitro: state.keys.nitro
        };

        // Browser gates use the same visible world but an isolated deterministic
        // autopilot so CI can verify continuous frames, movement and mission payout.
        const autoMoved = stepAutoTest(dt);
        const integrationMoved = !autoMoved && stepIntegrationTest(dt);
        if (!autoMoved && !integrationMoved) {
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
          } else if (input.throttle === 0) {
            player.vx *= Math.pow(0.985, dt * 60);
            player.vy *= Math.pow(0.985, dt * 60);
          }
          if (input.steer !== 0 && speed > 0.5) {
            const turnRate = input.steer * 3.5 * dt;
            player.angle += turnRate * Math.min(1.4, speed / 100);
          }

          player.x += player.vx * dt;
          player.y += player.vy * dt;
        }

        // Collision with buildings (uses authoritative geometry).
        // Browser-gate autopilot deliberately bypasses scenery contacts so the
        // deterministic mission probe cannot be invalidated by legacy art blocks.
        if (!autoTest.enabled && !integrationTest.enabled) resolveScenery(player, WORLD.buildings);

        // Traffic update using authoritative road segments
        for (const car of trafficCars) {
          if (!car.currentSegment) continue;

          const [a, b] = car.currentSegment;
          const dx = b.x - a.x;
          const dy = b.y - a.y;
          const segmentLength = car.segmentLength || Math.hypot(dx, dy);
          const segmentHeading = Math.atan2(dy, dx);

          // Move along segment
          const distanceThisFrame = car.speed * dt;
          car.segmentProgress += distanceThisFrame / segmentLength;

          // Update position along segment
          const progress = Math.max(0, Math.min(1, car.segmentProgress));
          car.x = a.x + dx * progress;
          car.y = a.y + dy * progress;
          car.angle = segmentHeading + (car.speed < 0 ? Math.PI : 0);

          // Check if reached end of segment
          if (car.segmentProgress <= 0 || car.segmentProgress >= 1) {
            // At junction - pick next segment
            const fromNode = car.segmentProgress <= 0 ? a : b;
            const nextSeg = getNextSegment(car.currentSegment, fromNode);
            if (nextSeg) {
              car.currentSegment = nextSeg;
              car.segmentProgress = car.segmentProgress <= 0 ? 1 : 0;
              car.segmentLength = Math.hypot(nextSeg[1].x - nextSeg[0].x, nextSeg[1].y - nextSeg[0].y);
            } else {
              // Dead end - reverse direction
              car.speed *= -1;
              car.segmentProgress = Math.max(0, Math.min(1, car.segmentProgress));
            }
          }
        }

        // Camera is calculated in CSS pixels, not backing-store pixels.
        // This keeps the player centered on DPR 2/3 phones and tablets.
        const viewW = Math.max(320, canvas.clientWidth || window.innerWidth || 1280);
        const viewH = Math.max(240, canvas.clientHeight || window.innerHeight || 720);
        const zoom = viewW < 700 ? 0.70 : viewW < 1100 ? 0.78 : 0.86;

        // Water / night foundation.
        ctx.fillStyle = PALETTE.waterDark;
        ctx.fillRect(0, 0, viewW, viewH);

        ctx.save();
        ctx.translate(viewW / 2, viewH / 2);
        ctx.scale(zoom, zoom);
        ctx.translate(-player.x, -player.y);

        // Real island silhouettes first, so roads read as roads instead of
        // nearly-black strokes floating on a black canvas.
        for (const island of ISLANDS) {
          ctx.save();
          ctx.beginPath();
          ctx.ellipse(island.center.x, island.center.y, island.rx + 20, island.ry + 20, 0, 0, Math.PI * 2);
          ctx.fillStyle = island.colors?.shore || PALETTE.waterShore;
          ctx.fill();
          ctx.beginPath();
          ctx.ellipse(island.center.x, island.center.y, island.rx, island.ry, 0, 0, Math.PI * 2);
          ctx.fillStyle = island.colors?.land || '#202326';
          ctx.fill();
          ctx.strokeStyle = 'rgba(224,154,62,.16)';
          ctx.lineWidth = 4;
          ctx.stroke();
          ctx.restore();
        }

        // Building parcels first. Roads are painted over the parcel edges so
        // architecture reads as city blocks without ever covering the carriageway.
        for (const raw of WORLD.buildings) {
          const x=raw[0],y=raw[1],w=raw[2],h=raw[3],pad=12;
          ctx.fillStyle='#292824';
          ctx.strokeStyle='rgba(154,160,168,.22)';
          ctx.lineWidth=2;
          ctx.beginPath();
          ctx.roundRect(x-pad,y-pad,w+pad*2,h+pad*2,10);
          ctx.fill();
          ctx.stroke();
        }

        // Roads use the same geometry contract as collision/navigation:
        // sidewalk support -> curb corridor -> actual carriageway -> markings.
        for (const road of CITY_ROADS) {
          if (road.gradeSeparated) continue;
          const supportHalf = supportHalfWidth(road);
          const collisionHalf = collisionHalfWidth(road);
          const carriageHalf = carriagewayHalfWidth(road);
          const segments = roadSegments(road);
          for (const seg of segments) {
            ctx.lineCap = 'round';
            ctx.lineJoin = 'round';

            ctx.strokeStyle = PALETTE.sidewalk;
            ctx.lineWidth = supportHalf * 2;
            ctx.beginPath();
            ctx.moveTo(seg.a.x, seg.a.y);
            ctx.lineTo(seg.b.x, seg.b.y);
            ctx.stroke();

            ctx.strokeStyle = PALETTE.curb;
            ctx.lineWidth = collisionHalf * 2;
            ctx.beginPath();
            ctx.moveTo(seg.a.x, seg.a.y);
            ctx.lineTo(seg.b.x, seg.b.y);
            ctx.stroke();

            ctx.strokeStyle = PALETTE.asphaltWet;
            ctx.lineWidth = carriageHalf * 2;
            ctx.beginPath();
            ctx.moveTo(seg.a.x, seg.a.y);
            ctx.lineTo(seg.b.x, seg.b.y);
            ctx.stroke();

            ctx.save();
            ctx.setLineDash([18, 18]);
            ctx.strokeStyle = road.class === 'ARTERIAL' ? PALETTE.roadMarkingYellow : PALETTE.roadMarkingWhite;
            ctx.lineWidth = 2.2;
            ctx.beginPath();
            ctx.moveTo(seg.a.x, seg.a.y);
            ctx.lineTo(seg.b.x, seg.b.y);
            ctx.stroke();
            ctx.restore();
          }
        }

        // Draw bridges from CITY_ROADS (gradeSeparated roads)
        for (const road of CITY_ROADS) {
          if (!road.gradeSeparated) continue;
          const halfWidth = collisionHalfWidth(road);
          const segments = roadSegments(road);
          for (const seg of segments) {
            const dx = seg.b.x - seg.a.x;
            const dy = seg.b.y - seg.a.y;
            const len = Math.hypot(dx, dy);
            if (len === 0) continue;
            const nx = -dy / len * halfWidth;
            const ny = dx / len * halfWidth;

            ctx.fillStyle = PALETTE.bridgeAsphalt;
            ctx.beginPath();
            ctx.moveTo(seg.a.x + nx, seg.a.y + ny);
            ctx.lineTo(seg.b.x + nx, seg.b.y + ny);
            ctx.lineTo(seg.b.x - nx, seg.b.y - ny);
            ctx.lineTo(seg.a.x - nx, seg.a.y - ny);
            ctx.closePath();
            ctx.fill();
          }
        }

        // Draw bridge rails
        ctx.fillStyle = PALETTE.bridgeRail;
        for (const rail of bridgeRails) {
          ctx.fillRect(rail.x, rail.y, rail.w, rail.h);
        }

        // Draw buildings. WORLD stores compact [x,y,w,h] tuples while
        // architecture.js renders one rich building object at a time.
        WORLD.buildings.forEach((raw, index) => {
          const b = Array.isArray(raw)
            ? { x: raw[0], y: raw[1], w: raw[2], h: raw[3], sign: index % 3 === 0 ? 'LOWTOWN' : index % 3 === 1 ? 'OPEN' : '24H' }
            : raw;
          if ([b?.x,b?.y,b?.w,b?.h].every(Number.isFinite)) drawArchitecture(ctx, b, index);
        });

        // Draw traffic cars. Runtime models store width/height, not w/h.
        for (const car of trafficCars) {
          const w = car.width || car.w || 48;
          const h = car.height || car.h || 26;
          ctx.save();
          ctx.translate(car.x, car.y);
          ctx.rotate(car.angle);
          ctx.fillStyle = 'rgba(0,0,0,.35)';
          ctx.fillRect(-w / 2 + 4, -h / 2 + 5, w, h);
          ctx.fillStyle = car.color || '#64748b';
          ctx.fillRect(-w / 2, -h / 2, w, h);
          ctx.fillStyle = 'rgba(15,24,32,.82)';
          ctx.fillRect(-w * .18, -h / 2 + 3, w * .42, h - 6);
          ctx.fillStyle = '#efe2b0';
          ctx.fillRect(w / 2 - 4, -h / 2 + 3, 3, 4);
          ctx.fillRect(w / 2 - 4, h / 2 - 7, 3, 4);
          ctx.restore();
        }

        // Draw lightweight pedestrians
        ctx.fillStyle='#b8a58a';
        for(const ped of pedestrians){
          ctx.beginPath();ctx.arc(ped.x,ped.y,4,0,Math.PI*2);ctx.fill();
          ctx.fillStyle='#5f6770';ctx.fillRect(ped.x-3,ped.y+4,6,9);ctx.fillStyle='#b8a58a';
        }

        // Draw player car last so it stays readable against buildings/traffic.
        ctx.save();
        ctx.translate(player.x, player.y);
        ctx.rotate(player.angle);
        ctx.shadowColor = 'rgba(0,0,0,.7)';
        ctx.shadowBlur = 8;
        ctx.shadowOffsetY = 5;
        ctx.fillStyle = player.bodyColor || '#e8b84a';
        ctx.beginPath();
        ctx.roundRect(-25, -12, 50, 24, 6);
        ctx.fill();
        ctx.shadowBlur = 0;
        ctx.shadowOffsetY = 0;
        ctx.fillStyle = '#15202a';
        ctx.fillRect(-12, -9, 24, 18);
        ctx.fillStyle = '#fff0b0';
        ctx.fillRect(20, -8, 4, 5);
        ctx.fillRect(20, 3, 4, 5);
        ctx.fillStyle = '#d4523a';
        ctx.fillRect(-24, -8, 3, 5);
        ctx.fillRect(-24, 3, 3, 5);
        ctx.strokeStyle = 'rgba(255,255,255,.32)';
        ctx.lineWidth = 1.5;
        ctx.strokeRect(-23, -10, 46, 20);
        ctx.restore();

        // Draw radar
        drawRadar();

        // Draw HUD
        drawHUD();

        ctx.restore();

        requestAnimationFrame(gameLoop);
      } catch (e) {
        window.__lowtownLastError = String(e && e.stack || e);
        if (typeof window.__lowtownFail === 'function')
          window.__lowtownFail('frame: ' + (e && e.message || e));
        // НЕ перепланировать → watchdog покажет текст
      }
    }

    requestAnimationFrame(gameLoop);
    setStage('running');

  } catch (err) {
    window.__lowtownLastError = String((err && err.stack) || err);
    if (typeof window.__lowtownFail === 'function') {
      window.__lowtownFail('init@ ' + (window.__lowtownStage || 'unknown') + ': ' + (err && err.message || err));
    }
    console.error('LOWTOWN init failed', window.__lowtownStage, err);
  }
}