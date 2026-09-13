export function createAIManeuverPlanner({ clearDistance = 90 } = {}) {
  const state = { phase: 'IDLE', target: null, startedAt: 0, passes: 0, aborts: 0, completed: 0 };
  const dist=(a,b)=>Math.hypot((a.x||0)-(b.x||0),(a.y||0)-(b.y||0));
  function start(now, side) { state.phase='PREPARE'; state.target=side<0?'LEFT':'RIGHT'; state.startedAt=now; return state.phase; }
  function update({ now=0, lead=null, speed=0, sideFree=false, lateralClear=false, passed=false, clear=false, risk=0 }={}) {
    if (state.phase==='IDLE') return state.phase;
    if (risk>1.2 || !sideFree) { state.phase='ABORT'; state.aborts++; return state.phase; }
    if (state.phase==='PREPARE') state.phase='MOVE_OUT';
    else if (state.phase==='MOVE_OUT' && lateralClear && speed>80) state.phase='PASS';
    else if (state.phase==='PASS' && passed) state.phase='CLEAR';
    else if (state.phase==='CLEAR' && clear) { state.phase='RETURN'; }
    else if (state.phase==='RETURN' && clear) { state.phase='DONE'; state.completed++; state.passes++; }
    return state.phase;
  }
  function reset(){state.phase='IDLE';state.target=null;state.startedAt=0;}
  function status(){return {...state};}
  return {state,start,update,reset,status};
}

export function choosePassingSide({ left=999, right=999, trafficSide=0, curve=0 }={}) {
  if (curve>.55) return 0;
  if (left<70 && right<70) return 0;
  if (trafficSide<0 && right>left) return 1;
  if (trafficSide>0 && left>right) return -1;
  return left>=right ? -1 : 1;
}
