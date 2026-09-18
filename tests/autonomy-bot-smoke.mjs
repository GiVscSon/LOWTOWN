import assert from 'node:assert/strict';
import { createAutopilotBot } from '../src/game/autonomy_bot.js';

const bot = createAutopilotBot();
assert.equal(bot.state.enabled, false, 'autopilot should start disabled');

const enabled = bot.toggle();
assert.equal(enabled, true, 'toggle should enable autopilot');

const car = { x: -120, y: 0, a: 0, vx: 0, vy: 0 };
const control = bot.step(car, 1 / 60);

assert.ok(control !== null, 'active bot must output control');
assert.ok(control.throttle > 0, 'bot must accelerate to start movement');
console.log('autonomy-bot smoke OK');
