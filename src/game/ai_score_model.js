export function createAIScoreModel() {
  const weights = { progress: 1, safety: 1.25, comfort: .55, exploration: .8, traffic: 1.15, lane: .9 };
  const state = { updates: 0, reward: 0 };
  const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
  function evaluate(m={}) {
    const progress=m.progress||0, speed=m.speed||0, collisions=m.collisions||0;
    const traffic=m.trafficHits||0, near=m.nearMisses||0, risk=m.risk||0;
    const explore=m.exploration||0, lane=Math.abs(m.crossTrack||0)/100;
    return progress*weights.progress + Math.min(1,speed/320)*.5*weights.progress + explore*.25*weights.exploration
      - collisions*2.5*weights.safety - traffic*3*weights.traffic - near*.4*weights.traffic
      - risk*1.4*weights.safety - lane*weights.lane;
  }
  function adapt(m={}) {
    state.reward=evaluate(m); state.updates++;
    const adjust=(key,error)=>{ weights[key]=clamp(weights[key]+.06*(error>.35?1:error<.08?-1:0),.25,3); };
    adjust('safety',(m.collisions||0)+(m.risk||0));
    adjust('traffic',(m.trafficHits||0)+(m.nearMisses||0)*.25);
    adjust('lane',Math.abs(m.crossTrack||0)/100);
    adjust('comfort',(m.steeringSpikes||0)+(m.hardBrakes||0)*.5);
    adjust('exploration',Math.max(0,1-(m.exploration||0)));
    adjust('progress',Math.max(0,1-(m.progress||0)/Math.max(1,m.targetProgress||1)));
    return status();
  }
  function status(){return {weights:{...weights},...state};}
  return {evaluate,adapt,status};
}
