import { createAIWorldModel } from './ai_world_model.js';

const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));

export function createAutonomyStack({ worldModel=createAIWorldModel() }={}) {
  const state={
    decisions:0, interventions:0, safeDecisions:0, rejected:0,
    last:null, history:[], mode:'BOOT'
  };

  function observe(snapshot={}) {
    const x=Number(snapshot.x), y=Number(snapshot.y);
    if(Number.isFinite(x)&&Number.isFinite(y)) {
      worldModel.observe({x,y,speed:Number(snapshot.speed)||0,risk:Number(snapshot.risk)||0});
    }
    return worldModel.status();
  }

  function evaluate({ candidates=[], risk=0, ttc=Infinity, stuck=0 }={}) {
    const list=(candidates||[]).map((c,i)=>{
      const safe=c.safe!==false && Number(c.collisionT||Infinity)>0.65;
      const trafficPenalty=Number.isFinite(c.ttc)?Math.max(0,2.5-c.ttc)*80:0;
      const riskPenalty=Math.max(0,Number(risk)||0)*35;
      const stuckPenalty=Math.max(0,Number(stuck)||0)*8;
      const score=Number(c.score||0)-trafficPenalty-riskPenalty-stuckPenalty+(safe?120: -5000);
      return {...c,index:i,safe,stackScore:score};
    }).sort((a,b)=>b.stackScore-a.stackScore);
    const best=list[0]||null;
    const rejected=list.filter(c=>!c.safe).length;
    state.rejected+=rejected;
    state.decisions++;
    state.safeDecisions+=best?.safe?1:0;
    state.mode=best?.safe?'TRAJECTORY_SELECT':'NO_SAFE_TRAJECTORY';
    state.last=best?{
      action:best.overtake?'OVERTAKE':best.brake>0.2?'BRAKE':Math.abs(best.steer)>0.55?'STEER':'CRUISE',
      steer:Number(best.steer||0), throttle:Number(best.throttle||0), brake:Number(best.brake||0),
      safe:best.safe, score:Math.round(best.stackScore), ttc:Number.isFinite(best.ttc)?+best.ttc.toFixed(2):Infinity,
      reason:best.overtake?'lead_vehicle_and_clear_side':best.brake>0.2?'closing_risk':Math.abs(best.steer)>0.55?'path_correction':'best_predicted_trajectory',
      confidence:best?clamp((best.stackScore-(list[1]?.stackScore??best.stackScore)+100)/300,0,1):0
    }:null;
    if(state.last){
      state.history.push({t:Date.now(),...state.last,candidates:list.length});
      if(state.history.length>120)state.history.shift();
    }
    return {best, candidates:list, decision:state.last};
  }

  function status(){return {...state,history:state.history.length,world:worldModel.status()};}
  return {state,observe,evaluate,status};
}
