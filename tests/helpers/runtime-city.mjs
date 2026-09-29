import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import * as street from '../../src/game/street_network.js';
import * as core from '../../src/game/test_drive_core.js';
import * as contacts from '../../src/game/solid_contacts.js';
import * as coast from '../../src/game/coastline.js';
import * as roaming from '../../src/game/free_roam.js';
import * as traffic from '../../src/game/traffic_turns.js';
import * as ocean from '../../src/game/ocean_chunks.js';
import * as surfaces from '../../src/game/surface_physics.js';
import * as incidents from '../../src/game/city_incidents.js';

export function runtimeCity(seed = 19) {
  let clock = 0, randomState = seed;
  const math = Object.create(Math);
  math.random = () => ((randomState = (Math.imul(randomState, 1664525) + 1013904223) >>> 0) / 4294967296);
  const noop = () => {};
  const element = () => ({ style: {}, classList: { add: noop, remove: noop }, append: noop,
    appendChild: noop, remove: noop, addEventListener: noop, getContext: () => ({}) });
  const context = vm.createContext({ Math: math, console, performance: { now: () => clock },
    document: { readyState: 'loading', getElementById: element, createElement: element,
      querySelectorAll: () => [], addEventListener: noop }, window: { addEventListener: noop },
    localStorage: { getItem: () => null, setItem: noop }, setTimeout: noop, setInterval: noop,
    requestAnimationFrame: noop, ...street, ...core, ...contacts, ...coast, ...roaming,
    ...traffic, ...ocean, ...surfaces, ...incidents });
  const source = readFileSync(new URL('../../src/main.js', import.meta.url), 'utf8').replace(/^import .*;\n/gm, '');
  vm.runInContext(`${source}\ninitTopology();`, context);
  return { run: code => vm.runInContext(code, context), tick: dt => { clock += dt * 1000; } };
}
