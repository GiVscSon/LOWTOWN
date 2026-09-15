const state = window.__LOWTOWN_DIRECT_INPUT__ || {
  throttle: 0,
  brake: 0,
  steer: 0,
  handbrake: false,
  enabled: false,
};
window.__LOWTOWN_DIRECT_INPUT__ = state;

const install = () => {
  const transport = window.__LOWTOWN_TRANSPORT?.player;
  if (!transport || transport.__directControlBridgeInstalled) return !!transport;

  const originalStep = transport.step.bind(transport);
  transport.step = (dt, input = {}) => {
    const active = state.enabled;
    if (!active) return originalStep(dt, input);
    return originalStep(dt, {
      throttle: Number(state.throttle) || 0,
      brake: Number(state.brake) || 0,
      steer: Number(state.steer) || 0,
      handbrake: !!state.handbrake,
    });
  };
  transport.__directControlBridgeInstalled = true;
  return true;
};

const ready = () => {
  if (install()) return;
  requestAnimationFrame(ready);
};
ready();

window.__LOWTOWN_DIRECT_CONTROL__ = {
  set(input = {}) {
    state.throttle = Number(input.throttle) || 0;
    state.brake = Number(input.brake) || 0;
    state.steer = Number(input.steer) || 0;
    state.handbrake = !!input.handbrake;
    state.enabled = true;
    return { ...state };
  },
  release() {
    state.throttle = 0;
    state.brake = 0;
    state.steer = 0;
    state.handbrake = false;
    state.enabled = false;
    return { ...state };
  },
  state: () => ({ ...state }),
};
