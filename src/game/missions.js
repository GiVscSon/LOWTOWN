import { CITY_DESTINATIONS, destinationPoint, vehicleRoute } from './city_semantics.js';

export function createMissionSystem(world) {
  const destination = id => destinationPoint(id) || { x: world.mission.x, y: world.mission.y, radius: world.mission.radius || 70 };
  const templates = [
    { id: 'DROP', title: 'SHAKE THE NIGHT', text: 'Take the package from the apartments to Market Hall.', reward: 250, route: ['LOWTOWN_APARTMENTS', 'MARKET_HALL'] },
    { id: 'RUN', title: 'THROUGH THE BLOCKS', text: 'Hit Garage, City Hall and Old Foundry in one run.', reward: 450, route: ['CENTRAL_GARAGE', 'CITY_HALL', 'OLD_FOUNDRY'] },
    { id: 'GETAWAY', title: 'LOSE THE TAIL', text: 'Run from Dock Works through Freight Depot to the motel.', reward: 700, route: ['DOCK_WORKS', 'FREIGHT_DEPOT', 'NORTH_RIDGE_MOTEL'] }
  ];
  let active = 0, stage = 0, complete = false, started = false, aiRouteKey = null, completedJobs = 0;
  const MISSION_ROUTE_LOCK = 1.2, EMERGENCY_STUCK = 1.5;
  function current() { return templates[active]; }
  function target() { const m = current(); return destination(m.route[stage % m.route.length]); }
  function routePreview() { const m = current(); if (m.route.length < 2) return []; const from = destination(m.route[Math.min(stage,m.route.length-1)]), to = destination(m.route[Math.min(stage+1,m.route.length-1)]); return vehicleRoute(from,to); }
  function syncMissionAI(car,p) { const ai=globalThis.__LOWTOWN_AI; if(!ai?.state?.enabled||!car||!p)return; const key=`${active}:${stage}`; if(key!==aiRouteKey){if(typeof ai.setMissionGoal==='function'){if(!ai.setMissionGoal(p))return;}else{const route=vehicleRoute({x:car.x,y:car.y},p).filter(Boolean);if(!route.length)return;ai.state.goal=route[route.length-1];ai.state.route=route;ai.state.node=0;}ai.state.routeTimer=0;ai.state.routeLockRemaining=MISSION_ROUTE_LOCK;ai.state.routeLocked=true;ai.state.routeLockReason='MISSION';ai.state.mode=ai.state.state='MISSION';ai.state.replans=(ai.state.replans||0)+1;aiRouteKey=key;}else{ai.state.routeTimer=0;ai.state.mode=ai.state.state==='IDLE'?'MISSION':ai.state.state;ai.state.routeLocked=true;ai.state.routeLockReason='MISSION';if(Number.isFinite(ai.state.routeLockRemaining))ai.state.routeLockRemaining=Math.max(0,ai.state.routeLockRemaining-1/60);}}
  function emergencyReplan(car){const ai=globalThis.__LOWTOWN_AI;if(!ai?.state?.enabled||!car||ai.state.mode!=='MISSION'||!(ai.state.stuckTime>EMERGENCY_STUCK)||typeof ai.replan!=='function')return;if(ai.replan(car)){ai.state.stuckTime=0;ai.state.routeTimer=0;ai.state.routeLocked=true;ai.state.routeLockRemaining=MISSION_ROUTE_LOCK;ai.state.routeLockReason='MISSION_EMERGENCY';ai.state.mode=ai.state.state='MISSION';ai.state.recoveries=(ai.state.recoveries||0)+1;}}
  function update(car){if(complete)return false;const p=target();syncMissionAI(car,p);emergencyReplan(car);if(Math.hypot(car.x-p.x,car.y-p.y)<(p.radius||55)){started=true;stage++;aiRouteKey=null;if(stage>=current().route.length){complete=true;completedJobs=Math.max(completedJobs,active+1);const ai=globalThis.__LOWTOWN_AI;if(ai?.clearMissionLock)ai.clearMissionLock();return true;}const ai=globalThis.__LOWTOWN_AI;if(ai?.state?.enabled&&ai?.setMissionGoal)ai.setMissionGoal(target());aiRouteKey=`${active}:${stage}`;}return false;}
  function next(){if(!complete)return false;const ai=globalThis.__LOWTOWN_AI;if(ai?.clearMissionLock)ai.clearMissionLock();active=Math.min(active+1,templates.length-1);stage=0;complete=false;started=false;aiRouteKey=null;return true;}
  function restore(count=0){reset();const n=Math.max(0,Math.min(templates.length,Math.floor(Number(count)||0)));completedJobs=n;if(n===0)return;active=Math.min(n-1,templates.length-1);complete=true;stage=current().route.length;started=true;}
  function reset(){const ai=globalThis.__LOWTOWN_AI;if(ai?.clearMissionLock)ai.clearMissionLock();active=0;stage=0;complete=false;started=false;aiRouteKey=null;completedJobs=0;}
  function state(){const mission=current();return{...mission,stage,totalStages:mission.route.length,started,complete,target:target(),routePreview:routePreview(),destinationCount:CITY_DESTINATIONS.length,jobIndex:active,completedJobs,chainComplete:completedJobs>=templates.length};}
  return {templates,update,next,restore,reset,state};
}
