import { createTransportController } from './game/transport_controller.js';

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

const WORLD_W = 7400;
const WORLD_H = 3400;
const ROAD_W = 130;

const PALETTE = {
  waterDark: '#060a12',
  waterShore: '#0c121e',
  asphalt: '#171b22',
  asphaltWet: '#1c212a',
  roadMarkingYellow: '#d4a34b',
  roadMarkingWhite: 'rgba(240, 244, 255, 0.75)',
  sidewalk: '#151922',
  curb: '#252b38',
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
  x: 1200, y: 1200,
  vx: 0, vy: 0,
  angle: 0, speed: 0,
  rpm: 0, gear: 'D1',
  hp: 100, maxHp: 100,
  width: 48, height: 24,
  bodyColor: '#e59d35'
};

// Unified runtime: keep the richer Three Islands world, but drive the player
// through the tested modular transport physics used by LOWTOWN's AI/tests.
const playerTransport = createTransportController('sedan', {
  x: player.x, y: player.y, a: player.angle, vx: 0, vy: 0
});

const islands = [
  { id: 'core', name: 'Lowtown Downtown', x: 300, y: 300, w: 2200, h: 2200 },
  { id: 'docks', name: 'Ironworks Docks', x: 2850, y: 300, w: 2000, h: 2200 },
  { id: 'lantern', name: 'Lantern Bay Heights', x: 5200, y: 300, w: 1800, h: 2200 }
];

const bridges = [
  { id: 'b1', x: 2500, y: 1135, w: 350, h: ROAD_W, name: 'Мост Железного Порта' },
  { id: 'b2', x: 4850, y: 1135, w: 350, h: ROAD_W, name: 'Мост Фонарного Залива' }
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

const safeSpawnPoints = [
  { x: 1200, y: 1200 },
  { x: 2450, y: 1200 },
  { x: 2950, y: 1200 },
  { x: 3850, y: 1200 },
  { x: 4800, y: 1200 },
  { x: 5300, y: 1200 }
];

function initTopology() {
  roads.length = 0;
  buildings.length = 0;
  breakableProps.length = 0;
  bridgeRails.length = 0;
  trafficCars.length = 0;
  policeCars.length = 0;
  pedestrians.length = 0;

  // Expressway
  roads.push(
    { x: 450, y: 1135, w: 2050, h: ROAD_W, dir: 'h', name: 'Центральный Проспект' },
    { x: 2850, y: 1135, w: 2000, h: ROAD_W, dir: 'h', name: 'Портовая Магистраль' },
    { x: 5200, y: 1135, w: 1650, h: ROAD_W, dir: 'h', name: 'Фонарный Бульвар' }
  );

  // Downtown
  roads.push(
    { x: 450, y: 450, w: 1900, h: ROAD_W, dir: 'h' },
    { x: 450, y: 1850, w: 1900, h: ROAD_W, dir: 'h' },
    { x: 450, y: 450, w: ROAD_W, h: 1530, dir: 'v' },
    { x: 1200, y: 450, w: ROAD_W, h: 1530, dir: 'v' },
    { x: 2000, y: 450, w: ROAD_W, h: 1530, dir: 'v' }
  );

  // Docks
  roads.push(
    { x: 2950, y: 450, w: 1750, h: ROAD_W, dir: 'h' },
    { x: 2950, y: 1850, w: 1750, h: ROAD_W, dir: 'h' },
    { x: 2950, y: 450, w: ROAD_W, h: 1530, dir: 'v' },
    { x: 3850, y: 450, w: ROAD_W, h: 1530, dir: 'v' },
    { x: 4600, y: 450, w: ROAD_W, h: 1530, dir: 'v' }
  );

  // Lantern Bay
  roads.push(
    { x: 5300, y: 450, w: 1550, h: ROAD_W, dir: 'h' },
    { x: 5300, y: 1850, w: 1550, h: ROAD_W, dir: 'h' },
    { x: 5300, y: 450, w: ROAD_W, h: 1530, dir: 'v' },
    { x: 6200, y: 450, w: ROAD_W, h: 1530, dir: 'v' }
  );

  // Bridges
  bridges.forEach(br => {
    bridgeRails.push({ x: br.x, y: br.y - 12, w: br.w, h: 14 });
    bridgeRails.push({ x: br.x, y: br.y + br.h - 2, w: br.w, h: 14 });
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
    { x: 5480, y: 1320, w: 670, h: 480, sign: '🌴 OVERLOOK MOTEL', neon: '#a855f7', roof: '#201d18' }
  );

  // Props
  const hydrants = [{ x: 430, y: 1115 }, { x: 1180, y: 1115 }, { x: 1980, y: 1115 }, { x: 2930, y: 1115 }, { x: 3830, y: 1115 }, { x: 5280, y: 1115 }];
  hydrants.forEach(h => breakableProps.push({ x: h.x, y: h.y, type: 'hydrant', intact: true, w: 14, h: 14 }));

  const dumpsters = [{ x: 620, y: 1100 }, { x: 1370, y: 1100 }, { x: 3120, y: 1100 }, { x: 5470, y: 1100 }];
  dumpsters.forEach(d => breakableProps.push({ x: d.x, y: d.y, type: 'dumpster', intact: true, w: 26, h: 18 }));

  // Diverse Traffic Roster (Sedans, Taxis, Vans)
  const carTypes = [
    { type: 'sedan', color: '#334155', w: 46, h: 22 },
    { type: 'taxi', color: '#eab308', w: 46, h: 22 },
    { type: 'sports', color: '#dc2626', w: 48, h: 23 },
    { type: 'coupe', color: '#2563eb', w: 44, h: 21 },
    { type: 'wagon', color: '#475569', w: 50, h: 23 },
    { type: 'black', color: '#0f172a', w: 46, h: 22 }
  ];

  for (let i = 0; i < 18; i++) {
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
}

function isPositionOnSolidGround(x, y) {
  for (let isl of islands) {
    if (x >= isl.x && x <= isl.x + isl.w && y >= isl.y && y <= isl.y + isl.h) return true;
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

  // Modular player physics. The world/collisions below remain authoritative,
  // while acceleration, steering, grip and handbrake come from transport_controller.
  const transportState = playerTransport.state;
  transportState.x = player.x;
  transportState.y = player.y;
  transportState.a = player.angle;
  transportState.vx = player.vx;
  transportState.vy = player.vy;
  transportState.v = player.speed;

  const isBoosting = state.keys.nitro && state.nitroAmount > 5;
  if (isBoosting) state.nitroAmount = Math.max(0, state.nitroAmount - 28 * dt);
  else if (state.nitroAmount < 100) state.nitroAmount = Math.min(100, state.nitroAmount + 8 * dt);
  const nitroBarEl = document.getElementById('nitroBar');
  if (nitroBarEl) nitroBarEl.style.width = Math.round(state.nitroAmount) + '%';

  const steer = (state.keys.right ? 1 : 0) - (state.keys.left ? 1 : 0);
  const throttle = state.keys.up ? 1 : (state.keys.down ? -0.65 : 0);
  const telemetry = playerTransport.step(dt, {
    throttle,
    brake: 0,
    steer,
    handbrake: state.keys.handbrake
  });

  // N2O stays an arcade layer on top of the shared physical kernel.
  if (isBoosting) {
    const boost = Math.min(1.22, 1 + 1.6 * dt);
    transportState.vx *= boost;
    transportState.vy *= boost;
  }

  player.x = transportState.x;
  player.y = transportState.y;
  player.angle = transportState.a;
  player.vx = transportState.vx;
  player.vy = transportState.vy;
  player.speed = Number.isFinite(transportState.v) ? transportState.v : telemetry.forwardSpeed;

  if (Math.abs(player.speed) > 70 && state.keys.handbrake) {
    skidmarks.push({ x: player.x, y: player.y, angle: player.angle, alpha: 0.5 });
    if (skidmarks.length > 200) skidmarks.shift();
  }

  // Collision: Buildings
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

  // Collision: Bridge rails
  bridgeRails.forEach(br => {
    const pad = 12;
    if (player.x > br.x - pad && player.x < br.x + br.w + pad &&
        player.y > br.y - pad && player.y < br.y + br.h + pad) {
      const cy = br.y + br.h / 2;
      player.y = player.y > cy ? br.y + br.h + pad : br.y - pad;
      player.vy = 0;
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

  // Traffic update
  trafficCars.forEach(c => {
    c.x += c.speed;
    if (c.speed > 0 && c.x > c.maxX) c.x = c.minX;
    if (c.speed < 0 && c.x < c.minX) c.x = c.maxX;
    if (Math.hypot(c.x - player.x, c.y - player.y) < 34) {
      player.speed *= 0.5;
      if (state.invulnTimer === 0) {
        player.hp = Math.max(0, player.hp - 8);
        sound.playImpact();
        if (state.wanted === 0) setWanted(1);
      }
    }
  });

  // Pedestrians AI & Flee
  pedestrians.forEach(p => {
    p.x += p.vx;
    p.walkPhase += 0.08;
    if (p.x < 450 || p.x > 6850) p.vx *= -1;

    const d = Math.hypot(p.x - player.x, p.y - player.y);
    if (d < 120 && Math.abs(player.speed) > 3) {
      p.fleeTimer = 30;
      p.y += (p.y > player.y ? 2.5 : -2.5); // Flee away from road
    }

    if (d < 22) {
      p.y += (p.y > player.y ? 20 : -20);
      if (state.invulnTimer === 0 && Math.abs(player.speed) > 2) {
        if (state.wanted < 3) setWanted(state.wanted + 1);
        showToast('🚨 НАЕЗД НА ПЕШЕХОДА!');
      }
    }
  });

  updatePoliceAI(dt);

  const speedKmh = Math.abs(player.speed) * 12;
  player.gear = player.speed < -0.1 ? 'R' : speedKmh < 30 ? 'D1' : speedKmh < 60 ? 'D2' : speedKmh < 95 ? 'D3' : speedKmh < 130 ? 'D4' : 'D5';
  player.rpm = Math.min(1.0, (speedKmh % 35) / 35 + 0.2);
  sound.update(player.rpm, player.speed);

  const distEl = document.getElementById('hudDistrict');
  if (distEl) {
    if (player.x > 5000) distEl.innerText = 'LANTERN BAY HEIGHTS';
    else if (player.x > 2700) distEl.innerText = 'IRONWORKS DOCKS';
    else distEl.innerText = 'LOWTOWN DOWNTOWN';
  }
}

function setWanted(lvl) {
  state.wanted = Math.min(5, Math.max(0, lvl));
  state.evading = false;
  state.evadeTimer = 5.0;
  if (state.wanted > 0) showToast(`🚨 УРОВЕНЬ РОЗЫСКА: ★ x ${state.wanted}!`);
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
  ctx.translate(w / 2 - player.x - leadX, h / 2 - player.y - leadY);

  // 1. Island Bases with Dark Shoreline
  islands.forEach(isl => {
    ctx.fillStyle = '#0c1017';
    ctx.fillRect(isl.x - 8, isl.y - 8, isl.w + 16, isl.h + 16);
    ctx.fillStyle = '#141822';
    ctx.fillRect(isl.x, isl.y, isl.w, isl.h);
    ctx.strokeStyle = '#252c3b';
    ctx.lineWidth = 4;
    ctx.strokeRect(isl.x, isl.y, isl.w, isl.h);
  });

  // 2. Bridges with Steel Rails
  bridges.forEach(br => {
    ctx.fillStyle = PALETTE.bridgeAsphalt;
    ctx.fillRect(br.x, br.y, br.w, br.h);
    ctx.fillStyle = '#334155';
    ctx.fillRect(br.x, br.y - 8, br.w, 8);
    ctx.fillRect(br.x, br.y + br.h, br.w, 8);
    ctx.strokeStyle = PALETTE.roadMarkingYellow;
    ctx.lineWidth = 2.5;
    ctx.setLineDash([16, 20]);
    ctx.beginPath();
    ctx.moveTo(br.x, br.y + br.h / 2);
    ctx.lineTo(br.x + br.w, br.y + br.h / 2);
    ctx.stroke();
    ctx.setLineDash([]);
  });

  // 3. Wet Asphalt Roads with Sidewalks & Crosswalks
  roads.forEach(r => {
    // Sidewalk border
    ctx.fillStyle = PALETTE.sidewalk;
    ctx.fillRect(r.x - 12, r.y - 12, r.w + 24, r.h + 24);
    ctx.strokeStyle = PALETTE.curb;
    ctx.lineWidth = 2;
    ctx.strokeRect(r.x - 12, r.y - 12, r.w + 24, r.h + 24);

    // Asphalt
    ctx.fillStyle = PALETTE.asphalt;
    ctx.fillRect(r.x, r.y, r.w, r.h);

    // Markings
    ctx.strokeStyle = PALETTE.roadMarkingWhite;
    ctx.lineWidth = 2;
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

  // 4. Tire Skidmarks
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

  // 7. Detailed Buildings & Rooftops
  buildings.forEach(b => {
    // Drop shadow
    ctx.fillStyle = 'rgba(0, 0, 0, 0.65)';
    ctx.fillRect(b.x + 12, b.y + 12, b.w, b.h);

    // Roof
    ctx.fillStyle = b.roof;
    ctx.fillRect(b.x, b.y, b.w, b.h);
    ctx.strokeStyle = '#2b3648';
    ctx.lineWidth = 3;
    ctx.strokeRect(b.x, b.y, b.w, b.h);

    // AC units & Roof vents
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(b.x + 30, b.y + 30, 45, 25);
    ctx.fillRect(b.x + b.w - 80, b.y + 40, 50, 30);

    // Neon Billboard with Glow
    ctx.save();
    ctx.fillStyle = 'rgba(10, 14, 22, 0.95)';
    ctx.fillRect(b.x + 20, b.y + 15, b.w - 40, 28);
    ctx.strokeStyle = b.neon || '#f59e0b';
    ctx.lineWidth = 1.5;
    ctx.shadowColor = b.neon || '#f59e0b';
    ctx.shadowBlur = 12;
    ctx.strokeRect(b.x + 20, b.y + 15, b.w - 40, 28);

    ctx.fillStyle = b.neon || '#f59e0b';
    ctx.font = '800 11px Inter, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(b.sign, b.x + b.w / 2, b.y + 33);
    ctx.restore();
  });

  // 8. Detailed Pedestrians
  pedestrians.forEach(ped => {
    ctx.save();
    ctx.translate(ped.x, ped.y);

    // Shadow
    ctx.fillStyle = 'rgba(0,0,0,0.45)';
    ctx.beginPath();
    ctx.ellipse(0, 4, 6, 3, 0, 0, Math.PI * 2);
    ctx.fill();

    const leg = Math.sin(ped.walkPhase) * 3;

    // Legs
    ctx.fillStyle = ped.pants;
    ctx.fillRect(-3 + leg, 0, 2.5, 6);
    ctx.fillRect(1 - leg, 0, 2.5, 6);

    // Torso / Jacket
    ctx.fillStyle = ped.shirt;
    ctx.fillRect(-4, -7, 8, 7);

    // Arms with swing
    ctx.fillStyle = ped.skin;
    ctx.fillRect(-6 - leg * 0.5, -6, 2, 5);
    ctx.fillRect(4 + leg * 0.5, -6, 2, 5);

    // Head & Hair
    ctx.fillStyle = ped.hair;
    ctx.beginPath();
    ctx.arc(0, -11, 4, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = ped.skin;
    ctx.beginPath();
    ctx.arc(0, -9.5, 2.8, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  });

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

  // 12. Player Vehicle with Volumetric Headlights
  ctx.save();
  ctx.translate(player.x, player.y);
  if (state.isDrowning) {
    const scale = Math.max(0.2, 1 - state.drownProgress * 0.7);
    ctx.scale(scale, scale);
    ctx.globalAlpha = Math.max(0.2, 1 - state.drownProgress);
  }
  ctx.rotate(player.angle);

  // Dynamic Headlights Cone
  if (!state.isDrowning) {
    const headGrad = ctx.createRadialGradient(24, 0, 10, 120, 0, 140);
    headGrad.addColorStop(0, 'rgba(255, 245, 210, 0.45)');
    headGrad.addColorStop(0.5, 'rgba(255, 230, 160, 0.18)');
    headGrad.addColorStop(1, 'rgba(255, 230, 160, 0)');
    ctx.fillStyle = headGrad;
    ctx.beginPath();
    ctx.moveTo(24, -9);
    ctx.lineTo(140, -48);
    ctx.lineTo(140, 48);
    ctx.lineTo(24, 9);
    ctx.closePath();
    ctx.fill();
  }

  // Shadow
  ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
  ctx.beginPath();
  ctx.ellipse(0, 6, player.width * 0.55, player.height * 0.48, 0, 0, Math.PI * 2);
  ctx.fill();

  // Wheels
  ctx.fillStyle = '#0a0d14';
  ctx.fillRect(-18, -player.height / 2 - 2, 10, 4);
  ctx.fillRect(10, -player.height / 2 - 2, 10, 4);
  ctx.fillRect(-18, player.height / 2 - 2, 10, 4);
  ctx.fillRect(10, player.height / 2 - 2, 10, 4);

  // Main Body
  ctx.fillStyle = player.bodyColor;
  ctx.fillRect(-player.width / 2, -player.height / 2, player.width, player.height);
  ctx.strokeStyle = '#111827';
  ctx.lineWidth = 1.5;
  ctx.strokeRect(-player.width / 2, -player.height / 2, player.width, player.height);

  // Roof & Glass Cabin
  ctx.fillStyle = '#0f172a';
  ctx.fillRect(-8, -player.height / 2 + 3, 20, player.height - 6);
  ctx.fillStyle = '#1e293b';
  ctx.fillRect(-4, -player.height / 2 + 5, 14, player.height - 10);

  // Headlights
  ctx.fillStyle = '#fffbeb';
  ctx.fillRect(player.width / 2 - 3, -player.height / 2 + 2, 3, 5);
  ctx.fillRect(player.width / 2 - 3, player.height / 2 - 7, 3, 5);

  // Taillights
  ctx.fillStyle = state.keys.down ? '#ff2222' : '#dc2626';
  ctx.fillRect(-player.width / 2, -player.height / 2 + 2, 3, 5);
  ctx.fillRect(-player.width / 2, player.height / 2 - 7, 3, 5);

  ctx.restore();

  ctx.restore();

  // Radar & HUD
  renderRadar();
  const speedEl = document.getElementById('hudSpeed');
  if (speedEl) speedEl.innerText = Math.round(Math.abs(player.speed) * 12);
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

function drawDetailedCar(ctx, x, y, ang, color, w, h, isPolice = false) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(ang);

  // Shadow
  ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
  ctx.beginPath();
  ctx.ellipse(0, 4, w * 0.55, h * 0.45, 0, 0, Math.PI * 2);
  ctx.fill();

  // Wheels
  ctx.fillStyle = '#090d16';
  ctx.fillRect(-w * 0.38, -h * 0.5 - 2, 8, 3.5);
  ctx.fillRect(w * 0.22, -h * 0.5 - 2, 8, 3.5);
  ctx.fillRect(-w * 0.38, h * 0.5 - 1.5, 8, 3.5);
  ctx.fillRect(w * 0.22, h * 0.5 - 1.5, 8, 3.5);

  // Body
  ctx.fillStyle = color;
  ctx.fillRect(-w / 2, -h / 2, w, h);
  ctx.strokeStyle = '#0f172a';
  ctx.lineWidth = 1.2;
  ctx.strokeRect(-w / 2, -h / 2, w, h);

  // Cabin
  ctx.fillStyle = '#0f172a';
  ctx.fillRect(-w * 0.18, -h * 0.38, w * 0.42, h * 0.76);
  ctx.fillStyle = '#1e293b';
  ctx.fillRect(-w * 0.08, -h * 0.28, w * 0.26, h * 0.56);

  // Headlights
  ctx.fillStyle = '#fef08a';
  ctx.fillRect(w / 2 - 2.5, -h / 2 + 2, 2.5, 4);
  ctx.fillRect(w / 2 - 2.5, h / 2 - 6, 2.5, 4);

  // Taillights
  ctx.fillStyle = '#dc2626';
  ctx.fillRect(-w / 2, -h / 2 + 2, 2.5, 4);
  ctx.fillRect(-w / 2, h / 2 - 6, 2.5, 4);

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
    radarCtx.fillRect((isl.x - player.x) * scale, (isl.y - player.y) * scale, isl.w * scale, isl.h * scale);
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
  const scale = mw / WORLD_W;

  fullMapCtx.fillStyle = '#06090e';
  fullMapCtx.fillRect(0, 0, mw, mh);

  islands.forEach(isl => {
    fullMapCtx.fillStyle = '#1e2430';
    fullMapCtx.fillRect(isl.x * scale, isl.y * scale, isl.w * scale, isl.h * scale);
    fullMapCtx.strokeStyle = '#334155';
    fullMapCtx.strokeRect(isl.x * scale, isl.y * scale, isl.w * scale, isl.h * scale);
  });

  bridges.forEach(br => {
    fullMapCtx.fillStyle = '#38bdf8';
    fullMapCtx.fillRect(br.x * scale, br.y * scale, br.w * scale, br.h * scale);
  });

  fullMapCtx.fillStyle = 'rgba(235, 240, 250, 0.5)';
  roads.forEach(r => {
    fullMapCtx.fillRect(r.x * scale, r.y * scale, r.w * scale, r.h * scale);
  });

  CARPARTS.forEach(p => {
    if (!p.found) {
      fullMapCtx.fillStyle = '#e59d35';
      fullMapCtx.beginPath();
      fullMapCtx.arc(p.x * scale, p.y * scale, 4, 0, Math.PI * 2);
      fullMapCtx.fill();
    }
  });

  fullMapCtx.fillStyle = '#fff';
  fullMapCtx.beginPath();
  fullMapCtx.arc(player.x * scale, player.y * scale, 5, 0, Math.PI * 2);
  fullMapCtx.fill();
}

function autoSaveProgress() {
  const saveData = {
    cash: state.cash,
    x: player.x,
    y: player.y,
    parts: CARPARTS.map(p => ({ id: p.id, found: p.found }))
  };
  localStorage.setItem('lowtown_integrity_save', JSON.stringify(saveData));
}

function loadProgress() {
  try {
    const saved = localStorage.getItem('lowtown_integrity_save');
    if (saved) {
      const data = JSON.parse(saved);
      state.cash = data.cash || 750;
      player.x = data.x || 1200;
      player.y = data.y || 1200;
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

function gameLoop(now) {
  const dt = Math.min(0.05, (now - state.lastFrameTime) / 1000);
  state.lastFrameTime = now;
  updatePhysics(dt);
  renderWorld();
  requestAnimationFrame(gameLoop);
}

function setupInputListeners() {
  window.addEventListener('keydown', e => {
    sound.init();
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

window.addEventListener('DOMContentLoaded', () => {
  initTopology();
  loadProgress();
  setupInputListeners();
  requestAnimationFrame(gameLoop);
});
