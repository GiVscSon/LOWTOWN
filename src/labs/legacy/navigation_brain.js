export function createNavigationBrain({nodes=[],blocked=()=>false}={}) {
  const state={enabled:true,cells:new Map(),recent:[],loops:0,deadEnds:0,recoveries:0,destination:null,lastReason:'INIT'};
  const key=(x,y)=>`${Math.floor(x/160)}:${Math.floor(y/160)}`;
  const dist=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
  const safe=n=>n&& !blocked(n.x,n.y) && Array.isArray(n.links) && n.links.length>0;
  function observe(x,y){const k=key(x,y);state.cells.set(k,(state.cells.get(k)||0)+1);state.recent.push(k);if(state.recent.length>24)state.recent.shift();if(state.recent.length>=12){const tail=state.recent.slice(-12),unique=new Set(tail).size;if(unique<=3){state.loops++;state.lastReason='LOOP';return true;}}return false;}
  function choose(start,goal=null){const pool=nodes.filter(safe);if(!pool.length){state.destination=null;state.lastReason='NO_SAFE_DESTINATION';return null;}const recent=new Set(state.recent.slice(-10));let best=null,score=-Infinity;for(const n of pool){if(goal&&n.id===goal.id)continue;const k=key(n.x,n.y),visits=state.cells.get(k)||0,far=dist(start,n),novelty=recent.has(k)?0:1,edge=n.links.length===1?-500:0,s=Math.min(far,1400)*.45-visits*170+novelty*520+edge;if(s>score){score=s;best=n;}}if(!best)best=pool.find(n=>!goal||n.id!==goal.id)||pool[0];state.destination=best;state.lastReason='EXPLORE';return best;}
  function recover(car){const pool=nodes.filter(safe);if(!pool.length)return false;let best=null,bd=Infinity;for(const n of pool){const d=dist(car,n);if(d<bd){bd=d;best=n;}}if(!best)return false;car.x=best.x;car.y=best.y;const next=best.links?.[0];if(next)car.a=Math.atan2(next.y-best.y,next.x-best.x);car.vx=0;car.vy=0;state.recoveries++;state.deadEnds++;state.lastReason='DEAD_END_RECOVERY';state.recent=[];return true;}
  function status(){const d=state.destination;return {enabled:state.enabled,cells:state.cells.size,loops:state.loops,deadEnds:state.deadEnds,recoveries:state.recoveries,destination:d?{id:d.id,x:d.x,y:d.y,links:d.links?.length||0}:null,lastReason:state.lastReason};}
  return {state,observe,choose,recover,status};
}
