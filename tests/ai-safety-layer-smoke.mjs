import { createAISafetyLayer, evaluateTrajectoryAgainstTraffic, shouldReplan } from '../src/game/ai_safety_layer.js';

const layer = createAISafetyLayer();

const clean = layer.sanitizeControl({ throttle: 1, brake: 0, steer: 0.1 }, 120);
if (clean.throttle !== 1 || clean.brake !== 0) throw new Error('clean control rejected');

const conflicting = layer.sanitizeControl({ throttle: 1, brake: 0.8, steer: 0 }, 180);
if (conflicting.throttle !== 0 || layer.state.invalidControls < 1) throw new Error('conflicting control was not sanitized');

if (!layer.edgeEvent('nearMiss', true, 0)) throw new Error('first near miss event missing');
if (layer.edgeEvent('nearMiss', true, 0.1)) throw new Error('near miss cooldown failed');
if (!layer.edgeEvent('nearMiss', true, 0.5)) throw new Error('near miss cooldown did not expire');

const trajectory = Array.from({ length: 13 }, (_, i) => ({ x: i * 20, y: 0 }));
const traffic = [{ x: 120, y: 0, a: 0, v: 0 }];
const risk = evaluateTrajectoryAgainstTraffic(trajectory, traffic);
if (risk.safe || !risk.conflict || risk.minDistance >= 38) throw new Error('trajectory traffic conflict was missed');

const clear = evaluateTrajectoryAgainstTraffic(trajectory, [{ x: 0, y: 400, a: 0, v: 0 }]);
if (!clear.safe) throw new Error('clear trajectory reported as conflict');

const hazard = shouldReplan({ routeLength: 10, node: 3, routeTimer: 1, predictionRisk: 1.4 });
if (!hazard.replan || hazard.reason !== 'DYNAMIC_HAZARD') throw new Error('dynamic hazard replan failed');

const healthy = shouldReplan({ routeLength: 10, node: 3, routeTimer: 1, predictionRisk: 0.1, crossTrack: 20 });
if (healthy.replan) throw new Error('healthy route was incorrectly replanned');

console.log('AI safety layer smoke: PASS');
