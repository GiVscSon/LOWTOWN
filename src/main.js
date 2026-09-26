import { drawArchitecture, drawRoundedJunction } from './game/architecture.js';
import { velocityForHeading, projectIso, routeInput } from './game/test_drive_core.js';
import { createDriveLab } from './game/test_drive_lab.js';
import { resolveContact, resolveScenery } from './game/solid_contacts.js';
import { coastPath, pointInCoast } from './game/coastline.js';
import { createFreeRoam, drawTransport } from './game/free_roam.js';
import { isLand } from './game/islands.js';
import { pointInBuilding } from './game/world_geometry.js';
import { CITY_ROADS, roadById } from './game/city_semantics.js';
import { collisionHalfWidth, roadSegments } from './game/road_geometry.js';
import { buildRoadNetwork, roadSegments as authorityRoadSegments } from './game/road_authority.js';
import { WORLD } from './game/world.js';
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
      speed: (Math.random() < 0.5 ? 1 : -1) * (1.5 + Math.random() * 0.6),
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

// ===== GAME LOOP =====
// Only run in browser environment (not in Node.js test VMs)
if (typeof window !== 'undefined' && window.document) {
  // Initialize canvas & contexts
  canvas = document.getElementById('gameCanvas');
  ctx = canvas.getContext('2d');
  radarCanvas = document.getElementById('radarCanvas');
  radarCtx = radarCanvas.getContext('2d');
  fullMapCanvas = document.getElementById('fullMapCanvas');
  fullMapCtx = fullMapCanvas.getContext('2d');

  // Build authoritative road graph from CITY_ROADS (single source of truth)
  const roadNodes = buildRoadNetwork();
  authoritySegments = authorityRoadSegments(roadNodes);

  // Initialize traffic on authoritative segments
  initTrafficCars();

  // Find valid spawn point on CITY_ROADS (Lowtown Boulevard, near start)
  const spawnRoad = roadById('LOWTOWN_BOULEVARD');
  const spawnPoint = spawnRoad ? { x: spawnRoad.points[4][0], y: spawnRoad.points[4][1], heading: 0 } : { x: -120, y: -360, heading: 0 };
  player.x = spawnPoint.x;
  player.y = spawnPoint.y;
  player.angle = spawnPoint.heading;
  player.vx = 0;
  player.vy = 0;

  roam = createFreeRoam(player, parkedCars, WORLD.buildings, trees,
    (x, y) => isLand(x, y) && !pointInBuilding(x, y),
    () => {},
    parkObstacles);

  const driveLab = createDriveLab({ player, state, canvas, buildings: WORLD.buildings, trafficCars, policeCars, routeInput, roam });

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

    // Collision with buildings (uses authoritative geometry)
    resolveScenery(player, WORLD.buildings);

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

    // Camera follow player
    const camX = player.x - canvas.width / 2;
    const camY = player.y - canvas.height / 2;

    // Render
    ctx.fillStyle = '#06090e';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.save();
    ctx.translate(-camX, -camY);

    // Draw roads from AUTHORITATIVE CITY_ROADS geometry
    for (const road of CITY_ROADS) {
      const halfWidth = collisionHalfWidth(road);
      const segments = roadSegments(road);
      ctx.fillStyle = PALETTE.asphalt;
      for (const seg of segments) {
        const dx = seg.b.x - seg.a.x;
        const dy = seg.b.y - seg.a.y;
        const len = Math.hypot(dx, dy);
        if (len === 0) continue;
        const nx = -dy / len * halfWidth;
        const ny = dx / len * halfWidth;

        ctx.beginPath();
        ctx.moveTo(seg.a.x + nx, seg.a.y + ny);
        ctx.lineTo(seg.b.x + nx, seg.b.y + ny);
        ctx.lineTo(seg.b.x - nx, seg.b.y - ny);
        ctx.lineTo(seg.a.x - nx, seg.a.y - ny);
        ctx.closePath();
        ctx.fill();
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

    // Draw buildings
    drawArchitecture(ctx, WORLD.buildings);

    // Draw traffic cars
    for (const car of trafficCars) {
      ctx.save();
      ctx.translate(car.x, car.y);
      ctx.rotate(car.angle);
      ctx.fillStyle = car.color;
      ctx.fillRect(-car.w / 2, -car.h / 2, car.w, car.h);
      // Windows
      ctx.fillStyle = 'rgba(255,255,255,0.3)';
      ctx.fillRect(-car.w / 2 + 4, -car.h / 2 + 3, car.w - 8, car.h - 6);
      ctx.restore();
    }

    // Draw player car
    ctx.save();
    ctx.translate(player.x, player.y);
    ctx.rotate(player.angle);
    ctx.fillStyle = '#e8b84a';
    ctx.fillRect(-23, -11, 46, 22);
    // Windshield
    ctx.fillStyle = 'rgba(30, 40, 60, 0.7)';
    ctx.fillRect(-20, -9, 40, 18);
    ctx.restore();

    // Draw radar
    drawRadar();

    // Draw HUD
    drawHUD();

    ctx.restore();

    requestAnimationFrame(gameLoop);
  }

  requestAnimationFrame(gameLoop);
}