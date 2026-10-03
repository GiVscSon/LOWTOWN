const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
export const GAMEPLAY_PHASES=Object.freeze({FREE_ROAM:'FREE_ROAM',MISSION:'MISSION',HEAT:'HEAT',COMPLETE:'COMPLETE'});
export function createGameplayLoop({missions,events,traffic,people,player}={}){
  if(!missions)throw new Error('Gameplay loop requires missions');
  let money=0,heat=0,phase=GAMEPLAY_PHASES.FREE_ROAM,completed=0,elapsed=0,lastEvent=null;
  function update(dt=1/60){
    const h=clamp(Number(dt)||0,0,.1);elapsed+=h;
    const p=player?.state||player||{x:0,y:0};
    const event=events?.state?.()||null;lastEvent=event;
    if(event?.id==='CHASE'||event?.id==='BLOCK') heat=clamp(heat+h*.9,0,100);
    else if(!event&&heat>0) heat=clamp(heat-h*.35,0,100);
    const completedNow=missions.update?.(p)||false;
    if(completedNow){const reward=Number(missions.state?.().reward)||0;money+=reward;completed+=1;phase=GAMEPLAY_PHASES.COMPLETE;heat=clamp(heat-12,0,100);}
    else if(heat>=35) phase=GAMEPLAY_PHASES.HEAT;
    else if(missions.state?.().started) phase=GAMEPLAY_PHASES.MISSION;
    else phase=GAMEPLAY_PHASES.FREE_ROAM;
    return state();
  }
  function advance(){missions.next?.();phase=GAMEPLAY_PHASES.MISSION;return state();}
  function reset(){money=0;heat=0;phase=GAMEPLAY_PHASES.FREE_ROAM;completed=0;elapsed=0;lastEvent=null;missions.reset?.();return state();}
  function state(){const mission=missions.state?.()||null;return {phase,money,heat,completed,elapsed,lastEvent,mission,trafficCount:traffic?.cars?.length||0,peopleCount:people?.people?.length||0};}
  return {update,advance,reset,state};
}
