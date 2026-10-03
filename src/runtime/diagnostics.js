// One shared runtime context owns state; this system has no hidden globals.
export function installRuntimeDiagnostics(ctx){
ctx.pushPerfSample = function pushPerfSample(bucket, value) {
  if (!Number.isFinite(value)) return;
  bucket.push(value);
  if (bucket.length > ctx.PERF_SAMPLE_LIMIT) bucket.shift();
};
ctx.perfStats = function perfStats(values) {
  if (!values.length) return {
    count: 0,
    mean: 0,
    p50: 0,
    p95: 0,
    max: 0
  };
  const sorted = [...values].sort((a, b) => a - b),
    pick = p => sorted[ctx.env.Math.min(sorted.length - 1, ctx.env.Math.floor((sorted.length - 1) * p))];
  return {
    count: values.length,
    mean: values.reduce((sum, value) => sum + value, 0) / values.length,
    p50: pick(.5),
    p95: pick(.95),
    max: sorted.at(-1)
  };
};
ctx.resetPerfSamples = function resetPerfSamples() {
  ctx.perfSamples.logic.length = 0;
  ctx.perfSamples.render.length = 0;
  ctx.perfSamples.frame.length = 0;
};
ctx.perfSummary = function perfSummary() {
  return {
    bridgeCaps: ctx.bridgeEndCap,
    logic: ctx.perfStats(ctx.perfSamples.logic),
    render: ctx.perfStats(ctx.perfSamples.render),
    frame: ctx.perfStats(ctx.perfSamples.frame)
  };
};
}
