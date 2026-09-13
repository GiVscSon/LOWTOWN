import { createFreeWillDriver } from './free_will_driver.js';
import { createAIWorldModel } from './ai_world_model.js';
import { createAutonomyStack } from './autonomy_stack.js';

const params=new URLSearchParams(location.search);
const enabled=params.has('autonomy')||params.has('autotest');
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));

async function boot(){
  if(!enabled)return;
  while(!window.__LOWTOWN_AI||!window.__LOWTOWN_TEST)await sleep(50);

  const ai=window.__LOWTOWN_AI;
  const startTest=window.__LOWTOWN_TEST;
  // The driver has a randomized safety start. For automated experiments, reject
  // starts that are already pressed against an island edge and sample again.
  for(let attempt=0;attempt<8;attempt++){
    const s=startTest.state();
    const sensors=s.sensor||{};
    const edge=Math.min(Number(sensors.front||999),Number(sensors.frontRight||999),Number(sensors.right||999));
    if(edge>115&&Math.abs(Number(s.x||0))<1500&&Number(s.y||0)<1900)break;
    startTest.reset();
    await sleep(80);
  }

  const worldModel=createAIWorldModel();
  const stack=createAutonomyStack({worldModel});
  const lab={enabled:true,startedAt:performance.now(),decisions:0,forcedReplans:0,intent:'EXPLORE',reason:'BOOT',lastGoal:null,memory:new Map(),failures:[],history:[],world:worldModel,status:stack.status()};
  const nodes=[];const seen=new Set();
  const remember=n=>{
    if(!n||!Number.isFinite(n.x)||!Number.isFinite(n.y))return;
    const id=`${Math.round(n.x/160)}:${Math.round(n.y/160)}`;
    if(seen.has(id))return;
    seen.add(id);
    const node={x:n.x,y:n.y,id,links:[n]};
    nodes.push(node);lab.memory.set(id,{x:n.x,y:n.y,visits:0});
  };
  const freeWill=createFreeWillDriver({nodes,blocked:()=>false});
  const intents=['EXPLORE','CRUISE','SEEK_NOVELTY','ESCAPE_TRAFFIC','INVESTIGATE'];
  let lastDecision=performance.now(),lastSnapshot=null;

  while(lab.enabled){
    await sleep(120);
    const state=startTest.state();
    for(const n of ai.route||[])remember(n);
    if(ai.goal)remember(ai.goal);

    stack.observe({x:state.x,y:state.y,speed:state.speed,risk:state.risk});
    const now=performance.now(),risk=Number(state.risk||0),ttc=Number(state.ttc),stuck=Number(state.stuck||0);
    const trajectory=stack.evaluate({candidates:ai.candidates||[],risk,ttc,stuck});

    const routeLength=Array.isArray(ai.route)?ai.route.length:0;
    const routeFinished=routeLength<2||Number(ai.node)>=routeLength-1;
    const emergency=risk>1.15||(Number.isFinite(ttc)&&ttc<1.1)||stuck>1.4||!ai.goal;
    const need=routeFinished||emergency;
    if(!need||nodes.length<3)continue;
    const intent=risk>1.15||(Number.isFinite(ttc)&&ttc<1.1)?'ESCAPE_TRAFFIC':intents[lab.decisions%intents.length];
    const goal=freeWill.choose({x:state.x,y:state.y},{intent,lastGoalId:lab.lastGoal,traffic:{}});
    if(!goal)continue;

    const previous=ai.goal?.id;
    ai.goal=goal;ai.route=[];ai.routeTimer=999;
    lab.decisions++;lab.forcedReplans++;lab.intent=intent;lab.reason=emergency?'EMERGENCY_REPLAN':routeFinished?'ROUTE_COMPLETE_SELF_CHOICE':trajectory.decision?.reason||'SELF_CHOICE';lab.lastGoal=goal.id;
    lab.history.push({
      t:Math.round((now-lab.startedAt)/1000),intent,from:previous,to:goal.id,
      risk:Number.isFinite(risk)?+risk.toFixed(2):0,ttc:Number.isFinite(ttc)?+ttc.toFixed(2):Infinity,
      action:trajectory.decision?.action||'UNKNOWN',confidence:trajectory.decision?.confidence||0
    });
    if(lab.history.length>120)lab.history.shift();
    lastDecision=now;

    const snapshot=`${Math.round(state.x)}:${Math.round(state.y)}:${state.collisions}:${state.trafficHits}`;
    if(lastSnapshot&&snapshot===lastSnapshot){
      lab.failures.push({t:Math.round((now-lab.startedAt)/1000),type:'NO_STATE_CHANGE',intent});
      if(lab.failures.length>40)lab.failures.shift();
    }
    lastSnapshot=snapshot;
    lab.status=stack.status();
  }
  window.__LOWTOWN_AUTONOMY_LAB=lab;
}

boot();
window.__LOWTOWN_AUTONOMY_LAB_STATUS=()=>{
  const lab=window.__LOWTOWN_AUTONOMY_LAB;
  if(!lab)return{enabled:false,decisions:0,replans:0,intent:'OFF',reason:'WAITING'};
  const s=lab.status||{};
  return {
    enabled:lab.enabled,decisions:lab.decisions,replans:lab.forcedReplans,intent:lab.intent,reason:lab.reason,
    memory:lab.memory.size,history:lab.history.length,failures:lab.failures.length,
    trajectoryDecisions:s.decisions||0,safeTrajectoryDecisions:s.safeDecisions||0,rejectedTrajectories:s.rejected||0,
    worldCells:s.world?.cells||0,worldObservations:s.world?.observations||0
  };
};
