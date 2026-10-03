import { buildRoadNetwork } from './road_authority.js';

export function createAutopilotBot({ speed = 65 } = {}) {
  const nodes = buildRoadNetwork();
  const state = {
    enabled: false,
    currentNode: 0,
    targetSpeed: speed,
    control: { throttle: 0, steer: 0, brake: 0, handbrake: false },
    stuckFrames: 0,
    diagnostics: {
      roadsVisited: new Set(),
      collisionsDetected: 0,
      nearMisses: 0
    }
  };

  function toggle() {
    state.enabled = !state.enabled;
    if (!state.enabled) {
      state.control = { throttle: 0, steer: 0, brake: 0, handbrake: false };
    }
    return state.enabled;
  }

  function step(car, dt = 1 / 60) {
    if (!state.enabled || !car) return null;

    if (!nodes.length) {
      state.control.throttle = 0.5;
      return state.control;
    }

    const target = nodes[state.currentNode];
    const dx = target.x - car.x;
    const dy = target.y - car.y;
    const dist = Math.hypot(dx, dy);

    if (dist < 45) {
      if (target.links && target.links.length) {
        const next = target.links[Math.floor(Math.random() * target.links.length)];
        const idx = nodes.findIndex(n => n.id === next.id);
        state.currentNode = idx !== -1 ? idx : (state.currentNode + 1) % nodes.length;
      } else {
        state.currentNode = (state.currentNode + 1) % nodes.length;
      }
      if (target.roadId) state.diagnostics.roadsVisited.add(target.roadId);
    }

    const targetHeading = Math.atan2(dy, dx);
    let headingDiff = targetHeading - car.a;
    while (headingDiff > Math.PI) headingDiff -= Math.PI * 2;
    while (headingDiff < -Math.PI) headingDiff += Math.PI * 2;

    state.control.steer = Math.max(-1, Math.min(1, headingDiff * 2.2));

    const curSpeed = Math.hypot(car.vx || 0, car.vy || 0);
    if (Math.abs(headingDiff) > 1.2) {
      state.control.throttle = 0.3;
      state.control.brake = curSpeed > 25 ? 0.4 : 0;
    } else {
      state.control.throttle = curSpeed < state.targetSpeed ? 0.85 : 0.2;
      state.control.brake = curSpeed > state.targetSpeed + 10 ? 0.5 : 0;
    }

    if (curSpeed < 3 && state.control.throttle > 0.5) {
      state.stuckFrames++;
      if (state.stuckFrames > 90) {
        state.control.steer = -state.control.steer || 0.8;
        state.control.throttle = -0.6;
        state.control.brake = 0;
        if (state.stuckFrames > 140) state.stuckFrames = 0;
      }
    } else {
      state.stuckFrames = 0;
    }

    return state.control;
  }

  return {
    state,
    toggle,
    step,
    update: step
  };
}
