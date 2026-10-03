// One shared runtime context owns state; this system has no hidden globals.
export function installRuntimeLoop(ctx){
ctx.gameLoop = function gameLoop(now) {
  if (ctx.qaManualSceneClock !== null) {
    ctx.env.window.__lowtownLastFrame = ctx.env.performance.now();
    ctx.env.requestAnimationFrame(ctx.gameLoop);
    return;
  }
  const framePerfStart = ctx.perfEnabled ? ctx.env.performance.now() : 0;
  const dt = ctx.env.Math.max(0, ctx.env.Math.min(0.1, (now - ctx.state.lastFrameTime) / 1000));
  ctx.state.lastFrameTime = now;
  if (ctx.isGamePaused()) ctx.accumulator = 0;else ctx.accumulator += dt;
  const frameLimit = ctx.isGamePaused() || ctx.env.document.hidden ? 15 : ctx.threeRenderer?.graphics?.fps ?? 60;
  const interval = frameLimit ? 1000 / frameLimit : 0;
  if (now - ctx.lastGameRenderTime < interval - .5) {
    ctx.env.requestAnimationFrame(ctx.gameLoop);
    return;
  }
  ctx.lastGameRenderTime = interval && Number.isFinite(ctx.lastGameRenderTime) ? now - (now - ctx.lastGameRenderTime) % interval : now;
  try {
    const logicPerfStart = ctx.perfEnabled ? ctx.env.performance.now() : 0;
    while (ctx.accumulator >= 1 / 60) {
      ctx.driveLab?.beforeStep();
      ctx.updatePhysics(1 / 60);
      ctx.driveLab?.afterStep();
      ctx.accumulator -= 1 / 60;
    }
    const logicPerfEnd = ctx.perfEnabled ? ctx.env.performance.now() : 0;
    const renderPerfStart = ctx.perfEnabled ? ctx.env.performance.now() : 0;
    ctx.renderWorld();
    const renderPerfEnd = ctx.perfEnabled ? ctx.env.performance.now() : 0;
    ctx.driveLab?.afterFrame();
    ctx.env.window.__lowtownLastFrame = ctx.env.performance.now();
    if (ctx.perfEnabled) {
      ctx.pushPerfSample(ctx.perfSamples.logic, logicPerfEnd - logicPerfStart);
      ctx.pushPerfSample(ctx.perfSamples.render, renderPerfEnd - renderPerfStart);
      ctx.pushPerfSample(ctx.perfSamples.frame, ctx.env.performance.now() - framePerfStart);
    }
  } catch (error) {
    ctx.env.window.__lowtownFail?.(error.message);
    ctx.driveLab?.fail(error.message);
    return;
  }
  ctx.env.requestAnimationFrame(ctx.gameLoop);
};
}
