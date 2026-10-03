import assert from 'node:assert/strict';
import {installRuntimeLoop} from '../../src/runtime/loop.js';
// Four seconds of game time with one presented frame per second. Physics
// must still advance 240 fixed steps, independent of selected render FPS.
for(const fps of [30,60,0])for(const timerHz of [60,10,2,1]){
  let now=0,callback,steps=0,renders=0;
  const ctx={env:{performance:{now:()=>now},document:{hidden:false},window:{},setInterval(fn){callback=fn;return 1;},requestAnimationFrame:()=>0},state:{isMenuOpen:false,lastFrameTime:0},isGamePaused:()=>ctx.state.isMenuOpen,qaManualSceneClock:null,accumulator:0,lastGameRenderTime:-Infinity,threeRenderer:{graphics:{fps}},perfEnabled:false,updatePhysics(dt){assert.equal(dt,1/60);steps++;},renderWorld(){renders++;}};
  installRuntimeLoop(ctx);ctx.startSimulationLoop();ctx.startSimulationLoop();
  for(let tick=1;tick<=4*timerHz;tick++){now=tick*1000/timerHz;callback();if(tick%timerHz===0)ctx.gameLoop(now);}
  assert.equal(steps,240,`${fps}: rendering throttled the simulation`);assert.equal(renders,4);
  ctx.state.isMenuOpen=true;for(let tick=0;tick<60;tick++){now+=1000/60;callback();}assert.equal(steps,240,'pause advanced the simulation');
  ctx.state.isMenuOpen=false;now+=1000/60;callback();assert.equal(steps,241,'resume produced a catch-up burst');
  ctx.env.document.hidden=true;now+=1000;callback();assert.equal(steps,241,'hidden tab advanced the city');
  ctx.env.document.hidden=false;ctx.qaManualSceneClock=now;now+=1000/60;callback();assert.equal(steps,241,'automatic clock leaked into a manual QA scene');
}
console.log('SIMULATION_CLOCK_MATRIX_OK: fixed 60 Hz at 1 rendered FPS and 1–60 timer Hz, pause, resume, background and manual QA clock');
