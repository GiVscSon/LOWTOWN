import assert from 'node:assert/strict';
import { createPlayerCharacter, PLAYER_MODES } from '../src/game/character_physics.js';

const car = { x: 100, y: 100, a: 0 };
const player = createPlayerCharacter({ x: 100, y: 100, heading: 0 });

assert.equal(player.state.mode, PLAYER_MODES.DRIVING, 'player starts in driving mode');

// Test exit vehicle
player.toggleVehicle(car);
assert.equal(player.state.mode, PLAYER_MODES.ON_FOOT, 'player must switch to on-foot mode');
assert.ok(Math.hypot(player.state.x - car.x, player.state.y - car.y) > 10, 'character must spawn near car door');

// Test on-foot movement
const startX = player.state.x;
player.step(1 / 60, { right: true });
assert.ok(player.state.x > startX, 'character must move right on input');

// Test enter vehicle back
player.state.cooldown = 0;
player.toggleVehicle(car);
assert.equal(player.state.mode, PLAYER_MODES.DRIVING, 'player must return to driving mode when near car');
console.log('character-physics smoke OK');
