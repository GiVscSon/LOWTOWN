export function createWorldDirector({nodes=[],blocked=()=>false,cityDirector=null,navigationBrain=null}={}) {
  const state={enabled:true,mode:'EXPLORE',goal:null,history:[],completed:0,started:0,reason:'BOOT'};
  const dist=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
  const safe=n=>n&&!blocked(n.x,n.y)&&Array.isArray(n.links)&&n.links.length>0;
  function choose(car,mode='EXPLORE'){
    const pool=nodes.filter(safe); if(!pool.length)return null;
    let best=null,score=-Infinity;
    for(const n of pool){let s=Math.min(dist(car,n),1800)*.2;
      if(mode==='EXPLORE')s+=n.links.length>1?500:0;
      if(mode==='TRAVEL')s+=Math.min(dist(car,n),2200)*.45;
      if(mode==='EVENT')s+=n.links.length>2?260:0;
      if(mode==='MISSION')s+=n.links.length>2?180:0;
      if(n.links.length===1)s-=350;
      if(n.id===state.goal?.id)s-=900;
      if(s>score){score=s;best=n;}
    }
    state.mode=mode; state.goal=best; state.started++;
    state.reason=mode; state.history.push({mode,id:best.id,x:best.x,y:best.y,at:Date.now()});
    if(state.history.length>40)state.history.shift(); return best;
  }
  function complete(reason='GOAL_REACHED'){state.completed++;state.reason=reason;state.goal=null;}
  function update(car,context={}){
    if(state.goal&&dist(car,state.goal)<75)complete();
    if(!state.goal){
      const modes=['EXPLORE','TRAVEL','MISSION','EVENT'];
      let mode=modes[state.started%modes.length];
      let goal=null;
      if(mode==='EXPLORE'&&cityDirector)goal=cityDirector.choose(car,true);
      if(mode==='TRAVEL'&&navigationBrain)goal=navigationBrain.choose(car);
      state.goal=goal||choose(car,mode);
    }
    return state.goal;
  }
  function status(){return {enabled:state.enabled,mode:state.mode,goal:state.goal,started:state.started,completed:state.completed,reason:state.reason,history:state.history.length};}
  return {state,choose,complete,update,status};
}
