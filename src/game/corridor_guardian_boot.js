import { createCorridorGuardian } from './corridor_guardian.js';

const params=new URLSearchParams(location.search);
if(params.has('autonomy')||params.has('autotest')){
  const wait=ms=>new Promise(r=>setTimeout(r,ms));
  (async()=>{
    while(!window.__LOWTOWN_AI)await wait(25);
    const ai=window.__LOWTOWN_AI;
    if(ai.__corridorGuardian)return;
    const guardian=createCorridorGuardian();
    const update=ai.update.bind(ai);
    ai.update=(car,dt)=>{
      const control=update(car,dt);
      if(!control)return control;
      const out=guardian.apply(control,ai.state||ai);
      const s=ai.state||ai;
      s.corridorGuardian={mode:guardian.state.mode,active:guardian.state.active,events:guardian.state.events,recoveries:guardian.state.recoveries,maxCrossTrack:guardian.state.maxCrossTrack};
      return out;
    };
    ai.__corridorGuardian=guardian;
  })();
}
