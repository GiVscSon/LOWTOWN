// Simulation owns a fixed clock. A slow GPU or a render FPS cap must not
// slow traffic, controls, weather or aircraft climbing.
export function installRuntimeLoop(ctx){
  function fail(error){
    ctx.simulationFailed=true;
    ctx.env.window.__lowtownFail?.(error.message);
    ctx.driveLab?.fail(error.message);
  }
  ctx.advanceSimulation=function advanceSimulation(now){
    if(ctx.qaManualSceneClock!==null||ctx.simulationFailed)return;
    // Retain delayed ticks instead of making the world run in slow motion.
    // Bound a suspended process to five seconds and work to one second per
    // callback; any remaining backlog continues on the next timer tick.
    const dt=Math.max(0,Math.min(5,(now-ctx.lastSimulationTime)/1000));
    ctx.lastSimulationTime=now;
    if(ctx.isGamePaused()||ctx.env.document.hidden){ctx.accumulator=0;return;}
    ctx.accumulator=Math.min(5,ctx.accumulator+dt);
    const start=ctx.perfEnabled?ctx.env.performance.now():0;
    try{
      let steps=0;
      while(ctx.accumulator+1e-9>=1/60&&steps++<60){
        ctx.driveLab?.beforeStep();ctx.updatePhysics(1/60);ctx.driveLab?.afterStep();
        ctx.accumulator=Math.max(0,ctx.accumulator-1/60);
      }
      if(ctx.perfEnabled)ctx.pushPerfSample(ctx.perfSamples.logic,ctx.env.performance.now()-start);
    }catch(error){fail(error);}
  };
  ctx.startSimulationLoop=function startSimulationLoop(){
    if(ctx.simulationTimer!==undefined)return;
    ctx.lastSimulationTime=ctx.env.performance.now();
    ctx.simulationTimer=ctx.env.setInterval(()=>ctx.advanceSimulation(ctx.env.performance.now()),1000/60);
  };
  ctx.gameLoop=function gameLoop(now){
    if(ctx.simulationFailed)return;
    ctx.state.lastFrameTime=now;
    ctx.env.window.__lowtownRenderPaused=ctx.isGamePaused()||ctx.qaManualSceneClock!==null;
    if(ctx.qaManualSceneClock!==null){
      ctx.env.window.__lowtownLastFrame=ctx.env.performance.now();
      ctx.env.requestAnimationFrame(ctx.gameLoop);return;
    }
    // Menus keep the last world frame. Camera/graphics settings explicitly
    // redraw their changes; a stationary scene does not need continuous GPU
    // work behind a dialog or in a hidden tab.
    if(ctx.isGamePaused()||ctx.env.document.hidden){
      ctx.env.window.__lowtownLastFrame=ctx.env.performance.now();
      ctx.env.requestAnimationFrame(ctx.gameLoop);return;
    }
    const frameLimit=ctx.threeRenderer?.graphics?.fps??60;
    const interval=frameLimit?1000/frameLimit:0;
    if(now-ctx.lastGameRenderTime<interval-.5){ctx.env.requestAnimationFrame(ctx.gameLoop);return;}
    ctx.lastGameRenderTime=interval&&Number.isFinite(ctx.lastGameRenderTime)?now-(now-ctx.lastGameRenderTime)%interval:now;
    const start=ctx.perfEnabled?ctx.env.performance.now():0;
    try{
      ctx.renderWorld();ctx.driveLab?.afterFrame();
      ctx.env.window.__lowtownFrameReady?.();
      ctx.env.window.__lowtownLastFrame=ctx.env.performance.now();
      if(ctx.perfEnabled){
        const cost=ctx.env.performance.now()-start;
        ctx.pushPerfSample(ctx.perfSamples.render,cost);ctx.pushPerfSample(ctx.perfSamples.frame,cost);
      }
    }catch(error){fail(error);return;}
    ctx.env.requestAnimationFrame(ctx.gameLoop);
  };
}
