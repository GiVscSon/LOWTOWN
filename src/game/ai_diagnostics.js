export function createAIDiagnostics({ historyLimit = 240 } = {}) {
  const state = {
    samples: 0,
    violations: 0,
    warnings: 0,
    history: [],
    counts: Object.create(null),
    last: null
  };

  function add(code, severity, detail) {
    state.counts[code] = (state.counts[code] || 0) + 1;
    state[severity === 'error' ? 'violations' : 'warnings']++;
    const item = { code, severity, detail, at: Date.now() };
    state.last = item;
    state.history.push(item);
    if (state.history.length > historyLimit) state.history.shift();
  }

  function inspect({ car = {}, control = {}, prediction = {}, route = [], node = 0, targetSpeed = 0, decisions = 0, dt = 0.016 } = {}) {
    state.samples++;
    const speed = Math.hypot(Number(car.vx) || 0, Number(car.vy) || 0);
    const throttle = Number(control.throttle) || 0;
    const brake = Number(control.brake) || 0;
    const steer = Number(control.steer) || 0;
    const risk = Number(prediction.risk) || 0;
    const ttc = Number.isFinite(prediction.ttc) ? prediction.ttc : Infinity;

    if (![throttle, brake, steer, targetSpeed, risk].every(Number.isFinite)) add('NONFINITE_CONTROL', 'error', 'control contains non-finite values');
    if (throttle > 0.85 && brake > 0.25 && speed > 45) add('BRAKE_THROTTLE_CONFLICT', 'warning', 'strong throttle and brake overlap');
    if (Math.abs(steer) > 1.001) add('STEER_RANGE', 'error', 'steering exceeded normalized range');
    if (route.length === 1 && node === 0) add('SINGLE_NODE_ROUTE', 'warning', 'route cannot produce meaningful travel');
    if (risk > 1.25 && ttc > 1.5) add('RISK_TTC_DISAGREEMENT', 'warning', 'risk is high while TTC is unexpectedly long');
    if (speed < 15 && throttle > 0.9 && Math.abs(steer) < 0.15) add('LOW_SPEED_NO_PROGRESS', 'warning', 'AI is commanding acceleration without meaningful motion');
    if (decisions > 0 && dt <= 0) add('INVALID_DT', 'error', 'non-positive simulation timestep');

    return state.last;
  }

  function report() {
    return {
      samples: state.samples,
      violations: state.violations,
      warnings: state.warnings,
      counts: { ...state.counts },
      recent: state.history.slice(-20)
    };
  }

  return { state, inspect, report };
}
