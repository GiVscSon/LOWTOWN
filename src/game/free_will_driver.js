export function createFreeWillDriver({nodes=[],blocked=()=>false}={}) {
  const state={
    enabled:true, intent:'EXPLORE', goal:null, decisions:0, replans:0,
    novelty:0, confidence:0, reason:'BOOT', history:[], visited:new Map()
  };
  const dist=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
  const safe=n=>n&&!blocked(n.x,n.y)&&Array.isArray(n.links)&&n.links.length>0;
  const key=n=>`${Math.round(n.x/160)}:${Math.round(n.y/160)}`;

  function observe(car){
    const n=nodes.reduce((best,v)=>!best||dist(car,v)<best.d?{n:v,d:dist(car,v)}:best,null)?.n;
    if(!n)return;
    const k=key(n); state.visited.set(k,(state.visited.get(k)||0)+1);
  }

  function choose(car, context={}){
    const pool=nodes.filter(safe);
    if(!pool.length){state.goal=null;state.reason='NO_SAFE_OPTIONS';return null;}
    const recent=new Set(state.history.slice(-8).map(h=>h.id));
    const traffic=context.traffic||{};
    const candidates=[];
    for(const n of pool){
      const d=dist(car,n), visits=state.visited.get(key(n))||0;
      const novelty=recent.has(n.id)?0:1;
      const junction=n.links.length>2?1:0;
      const deadEnd=n.links.length===1?1:0;
      const congestion=Number(traffic[key(n)]||0);
      const directionPenalty=context.lastGoalId===n.id?0.8:0;
      let score=novelty*620 - visits*110 + junction*170 - deadEnd*420;
      score += Math.min(d,1800)*0.12 - congestion*260 - directionPenalty*300;
      if(context.preferNewIsland&&context.islandOf)score+=context.islandOf(n)!==context.islandOf(car)?280:0;
      candidates.push({n,score});
    }
    candidates.sort((a,b)=>b.score-a.score);
    const top=candidates.slice(0,Math.min(5,candidates.length));
    const pick=top[(state.decisions*7 + Math.floor(state.decisions/3))%top.length].n;
    state.goal=pick;
    state.decisions++;
    state.replans++;
    state.novelty=recent.has(pick.id)?0:1;
    state.confidence=Math.max(0,Math.min(1,(top[0].score-top[Math.min(1,top.length-1)].score+500)/1000));
    state.intent=context.intent||['EXPLORE','CRUISE','ESCAPE_TRAFFIC','SEEK_NOVELTY'][state.decisions%4];
    state.reason='SELF_CHOICE';
    state.history.push({id:pick.id,x:pick.x,y:pick.y,intent:state.intent,at:Date.now()});
    if(state.history.length>40)state.history.shift();
    return pick;
  }

  function update(car,context={}){
    observe(car);
    if(state.goal&&dist(car,state.goal)<75)state.goal=null;
    if(!state.goal || context.forceDecision) choose(car,context);
    return state.goal;
  }

  function status(){return {...state,goal:state.goal?{id:state.goal.id,x:state.goal.x,y:state.goal.y}:null,visited:state.visited.size,history:state.history.length};}
  return {state,observe,choose,update,status};
}
