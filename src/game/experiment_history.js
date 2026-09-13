export function createExperimentHistory({ limit = 100 } = {}) {
  const runs = [];

  function record(run = {}) {
    const entry = {
      id: run.id ?? runs.length + 1,
      timestamp: run.timestamp ?? new Date().toISOString(),
      metrics: { ...(run.metrics || {}) },
      findings: [...(run.findings || [])],
      recommendation: run.recommendation || null,
      codeVersion: run.codeVersion || null
    };
    runs.push(entry);
    while (runs.length > limit) runs.shift();
    return entry;
  }

  function previous() {
    return runs[runs.length - 1] || null;
  }

  function compare(current, prior = previous()) {
    if (!current || !prior) return { available: false, delta: {} };
    const delta = {};
    const keys = new Set([...Object.keys(prior.metrics || {}), ...Object.keys(current.metrics || {})]);
    for (const k of keys) {
      const a = Number(prior.metrics?.[k]);
      const b = Number(current.metrics?.[k]);
      if (Number.isFinite(a) && Number.isFinite(b)) delta[k] = b - a;
    }
    return { available: true, from: prior.id, to: current.id, delta };
  }

  function latest(count = 10) { return runs.slice(-count); }
  function clear() { runs.length = 0; }

  return { record, previous, compare, latest, clear, runs };
}
