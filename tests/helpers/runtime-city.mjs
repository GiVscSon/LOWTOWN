import { VEHICLE_ASSETS } from '../../src/assets/vehicle_icons.js';
import * as authoredWorld from '../../src/world/archipelago.js';
import { PLANE_RUNWAYS as LEGACY_RUNWAYS } from '../../src/simulation/free_roam.js';
import vm from 'node:vm';
import * as street from '../../src/world/street_network.js';
import * as core from '../../src/simulation/vehicle_dynamics.js';
import * as contacts from '../../src/simulation/solid_contacts.js';
import * as emergencyPassing from '../../src/simulation/emergency_passing.js';
import * as coast from '../../src/world/coastline.js';
import * as roaming from '../../src/simulation/free_roam.js';
import * as traffic from '../../src/simulation/traffic_turns.js';
import * as ocean from '../../src/world/ocean_chunks.js';
import * as surfaces from '../../src/simulation/surfaces.js';
import * as incidents from '../../src/simulation/incidents.js';
import * as organic from '../../src/world/organic_streets.js';
import * as corridors from '../../src/world/street_corridors.js';
import * as walking from '../../src/world/walk_surface.js';
import {attachRuntime} from './runtime-vm.mjs';

export function runtimeCity(seed = 19,{legacyStreets=false}={}) {
  let clock = 0, randomState = seed;
  const math = Object.create(Math);
  math.random = () => ((randomState = (Math.imul(randomState, 1664525) + 1013904223) >>> 0) / 4294967296);
  const noop = () => {};
  const element = () => ({ style: {}, classList: { add: noop, remove: noop }, append: noop,
    appendChild: noop, remove: noop, addEventListener: noop, getContext: () => ({}) });
  const context = vm.createContext({ ...authoredWorld,LEGACY_RUNWAYS,VEHICLE_ASSETS, Math: math, console, performance: { now: () => clock },
    document: { readyState: 'loading', getElementById: element, createElement: element,
      querySelectorAll: () => [], addEventListener: noop }, window: { addEventListener: noop },
    localStorage: { getItem: () => null, setItem: noop }, setTimeout: noop, setInterval: noop,
    requestAnimationFrame: noop, ...street, ...core, ...contacts, ...emergencyPassing, ...coast, ...roaming,
    ...traffic, ...ocean, ...surfaces, ...incidents, ...organic, ...corridors, ...walking });
  const runtime=attachRuntime(context,{legacyStreets});
  vm.runInContext('initTopology();', context);
  return {runtime,run: code => vm.runInContext(code, context),tick: dt => {clock += dt * 1000;}};
}
