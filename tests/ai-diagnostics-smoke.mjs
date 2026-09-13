import { createAIDiagnostics } from '../src/game/ai_diagnostics.js';

const d = createAIDiagnostics();
d.inspect({
  car: { vx: 120, vy: 0 },
  control: { throttle: 1, brake: 0.7, steer: 0 },
  prediction: { risk: 0.2, ttc: Infinity },
  route: [{ id: 1 }],
  node: 0,
  targetSpeed: 400,
  decisions: 1,
  dt: 0.016
});

const r = d.report();
if (!r.warnings || !r.counts.BRAKE_THROTTLE_CONFLICT) throw new Error('control invariant was not detected');
if (!r.counts.SINGLE_NODE_ROUTE) throw new Error('single node route was not detected');
if (!r.counts || Object.keys(r.counts).length < 2) throw new Error('diagnostic report incomplete');

console.log('AI diagnostics smoke: PASS');
