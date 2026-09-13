export function createCityDirector({nodes=[],blocked=()=>false,brain=null}={}) {
  const state={enabled:true,phase:'EXPLORE',districts:new Map(),targets:[],target:null,history:[],completed:0,stagnation:0,lastCell:null,lastTarget:null,reason:'BOOT'};
  const dist=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
  const cell=(x,y)=>`${Math.floor(x/480)}:${Math.floor(y/480)}`;
  const safe=n=>n&&!blocked(n.x,n.y)&&n.links?.length;
  const candidates=()=>nodes.filter(safe);
  function mark(car){const k=cell(car.x,car.y);state.districts.set(k,(state.districts.get(k)||0)+1);if(k===state.lastCell)state.stagnation++;else state.stagnation=0;state.lastCell=k;return k;}
  function score(n,car){const k=cell(n.x,n.y),visits=state.districts.get(k)||0,d=dist(car,n);const novelty=visits===0?1200:Math.max(0,700-visits*180);const spread=Math.min(d,1800)*.25;const dead=n.links.length===1?-900:0;return novelty+spread+dead;}
  function choose(car,force=false){const pool=candidates();if(!pool.length)return null;const options=pool.filter(n=>force||n.id!==state.lastTarget);let best=options[0]||pool[0],bs=-Infinity;for(const n of options){const s=score(n,car);if(s>bs){bs=s;best=n;}}state.target=best;state.lastTarget=best.id;state.reason=force?'FORCED_NEW_AREA':'DISTRICT_EXPANSION';state.targets.push({id:best.id,x:best.x,y:best.y,reason:state.reason,at:Date.now()});if(state.targets.length>30)state.targets.shift();return best;}
  function reached(car){if(!state.target)return false;if(dist(car,state.target)<70){state.completed++;state.reason='TARGET_REACHED';state.target=null;return true;}return false;}
  function update(car){const k=mark(car);if(reached(car)||!state.target||state.stagnation>45){if(state.stagnation>45){state.reason='STAGNATION';if(brain?.recover){brain.recover(car);state.stagnation=0;}}return choose(car,true);}if(state.target&&cell(state.target.x,state.target.y)===k&&state.stagnation>18)return choose(car,true);return state.target;}
  function status(){return {enabled:state.enabled,phase:state.phase,districts:state.districts.size,completed:state.completed,target:state.target,stagnation:state.stagnation,reason:state.reason,targets:state.targets.length};}
  return {state,mark,choose,reached,update,status};
}
