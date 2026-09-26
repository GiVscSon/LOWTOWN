import { isLand } from './islands.js';
import { pointInBuilding } from './vehicle_collision.js';


const finite = (v, fallback = 0) => Number.isFinite(Number(v)) ? Number(v) : fallback;

export function createCharacterState({ x = 0, y = 0, a = 0, walkSpeed = 34, acceleration = 120, turnRate = 9, radius = 10 } = {}) {
  return {
    x: finite(x), y: finite(y), a: finite(a),
    vx: 0, vy: 0,
    speed: Math.max(0, finite(walkSpeed, 34)),
    walkSpeed: Math.max(0, finite(walkSpeed, 34)),
    acceleration: Math.max(0, finite(acceleration, 120)),
    turnRate: Math.max(0, finite(turnRate, 9)),
    radius: Math.max(1, finite(radius, 10)),
    distance: 0,
    animTime: 0
  };
}

export function stepCharacterPhysics(character, dt = 1 / 60, input = {}, blocked = () => false) {
  const h = Math.max(0.001, Math.min(finite(dt, 1 / 60), 0.1));
  const ix = finite(input.x, 0), iy = finite(input.y, 0);
  const len = Math.hypot(ix, iy);
  if (len <= 1e-6) {
    character.vx = 0; character.vy = 0; character.speed = 0;
    return character;
  }
  const nx = ix / len, ny = iy / len;
  const speed = Math.max(0, finite(character.walkSpeed, finite(character.speed, 34)));
  const dx = nx * speed * h, dy = ny * speed * h;
  const nextX = finite(character.x) + dx, nextY = finite(character.y) + dy;
  if (!blocked(nextX, nextY, character)) {
    character.x = nextX; character.y = nextY;
    character.distance = Math.max(0, finite(character.distance)) + Math.hypot(dx, dy);
  }
  character.vx = nx * speed; character.vy = ny * speed;
  character.speed = speed; character.a = Math.atan2(ny, nx);
  character.animTime = finite(character.animTime) + h * Math.max(1, speed / 10);
  return character;
}

export const PLAYER_MODES = Object.freeze({
  DRIVING: 'DRIVING',
  ON_FOOT: 'ON_FOOT'
});

export function createPlayerCharacter({ x = 0, y = 0, heading = 0 } = {}) {
  const state = {
    mode: PLAYER_MODES.DRIVING,
    x,
    y,
    a: heading,
    vx: 0,
    vy: 0,
    speed: 0,
    walkSpeed: 45,
    runSpeed: 85,
    animTime: 0,
    currentVehicle: null,
    cooldown: 0
  };

  function toggleVehicle(playerCar, nearbyVehicles = []) {
    if (state.cooldown > 0) return state.mode;
    state.cooldown = 0.3; // Prevent rapid toggle

    if (state.mode === PLAYER_MODES.DRIVING) {
      // Exit vehicle: spawn at driver side door
      const sideX = -Math.sin(playerCar.a) * 22;
      const sideY = Math.cos(playerCar.a) * 22;
      state.x = playerCar.x + sideX;
      state.y = playerCar.y + sideY;
      state.a = playerCar.a;
      state.vx = 0;
      state.vy = 0;
      state.mode = PLAYER_MODES.ON_FOOT;
      state.currentVehicle = playerCar;
    } else {
      // Enter nearest vehicle if close enough (radius <= 40)
      let target = null;
      let minD = 45;

      const candidates = [state.currentVehicle || playerCar, ...nearbyVehicles].filter(Boolean);
      for (const v of candidates) {
        const d = Math.hypot(v.x - state.x, v.y - state.y);
        if (d < minD) {
          minD = d;
          target = v;
        }
      }

      if (target) {
        state.mode = PLAYER_MODES.DRIVING;
        state.currentVehicle = target;
      }
    }
    return state.mode;
  }

  function step(dt = 1 / 60, input = {}) {
    const safeDt = Math.max(0.001, Math.min(dt, 0.1));
    if (state.cooldown > 0) state.cooldown -= safeDt;

    if (state.mode === PLAYER_MODES.ON_FOOT) {
      let moveX = 0;
      let moveY = 0;

      if (input.up || input.forward) moveY -= 1;
      if (input.down || input.back) moveY += 1;
      if (input.left) moveX -= 1;
      if (input.right) moveX += 1;

      const len = Math.hypot(moveX, moveY);
      if (len > 0) {
        const speed = input.run ? state.runSpeed : state.walkSpeed;
        const nx = moveX / len;
        const ny = moveY / len;
        const nextX = state.x + nx * speed * safeDt;
        const nextY = state.y + ny * speed * safeDt;

        if (isLand(nextX, nextY) && !pointInBuilding(nextX, nextY, 6)) {
          state.x = nextX;
          state.y = nextY;
        }
        state.a = Math.atan2(ny, nx);
        state.animTime += safeDt * (speed / 10);
        state.speed = speed;
      } else {
        state.speed = 0;
      }
    }
  }

  return {
    state,
    toggleVehicle,
    step,
    update: step
  };
}
