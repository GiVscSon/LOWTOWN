export function createBlackBox({ capacity = 900, eventCapacity = 80 } = {}) {
  const state = {
    active: true, startedAt: 0, elapsed: 0, samples: 0, events: [], ring: [],
    summary: { distance:0,maxSpeed:0,collisions:0,trafficHits:0,nearMisses:0,overtakes:0,recoveries:0,replans:0,safeStarts:0,decisions:0,hardBrakes:0,steeringSpikes:0,controlChanges:0,predictionWarnings:0,corridorRecoveries:0 },
    findings: [], lastControl:null, lastSample:null
  };
  const clone=v=>{if(v===undefined)return null;try{return JSON.parse(JSON.stringify(v));}catch{return null;}};
  const pushRing=s=>{state.ring.push(s);if(state.ring.length>capacity)state.ring.splice(0,state.ring.length-capacity);};
  const event=(type,payload={})=>{const item={t:+state.elapsed.toFixed(3),type,...clone(payload)};item.context=state.ring.slice(Math.max(0,state.ring.length-24));state.events.push(item);if(state.events.length>eventCapacity)state.events.splice(0,state.events.length-eventCapacity);};
  function start(now=0){state.startedAt=now;state.elapsed=0;state.samples=0;state.events.length=0;state.ring.length=0;state.findings.length=0;state.lastControl=null;state.lastSample=null;state.summary={distance:0,maxSpeed:0,collisions:0,trafficHits:0,nearMisses:0,overtakes:0,recoveries:0,replans:0,safeStarts:0,decisions:0,hardBrakes:0,steeringSpikes:0,controlChanges:0,predictionWarnings:0,corridorRecoveries:0};}
  function sample(snapshot,dt=0){
    state.elapsed+=Math.max(0,dt);state.samples++;
    const s=clone(snapshot)||{},g=s.game||{},a=s.ai||{},c=a.control||null,prevSample=state.lastSample,prevControl=state.lastControl;
    s.t=+state.elapsed.toFixed(3);pushRing(s);
    const speed=Number(g.speed)||0;
    state.summary.distance=Math.max(state.summary.distance,Number(g.distance)||0);state.summary.maxSpeed=Math.max(state.summary.maxSpeed,speed);
    state.summary.collisions=Number(g.collisions)||0;state.summary.trafficHits=Number(g.trafficHits)||0;state.summary.nearMisses=Number(a.nearMisses)||0;state.summary.overtakes=Number(a.overtakes)||0;state.summary.recoveries=Number(a.recoveries)||0;state.summary.replans=Number(a.replans)||0;state.summary.safeStarts=Number(a.safeStarts)||0;state.summary.decisions=Number(a.decisions)||0;
    if(c&&prevControl){if(Math.abs((c.brake||0)-(prevControl.brake||0))>.55)state.summary.controlChanges++;if((c.brake||0)>.72&&speed>230)state.summary.hardBrakes++;if(Math.abs((c.steer||0)-(prevControl.steer||0))>.62)state.summary.steeringSpikes++;}
    if(a.prediction&&(a.prediction.risk||0)>.75)state.summary.predictionWarnings++;
    const collisionDelta=(Number(g.collisions)||0)-(Number(prevSample?.game?.collisions)||0);
    const trafficDelta=(Number(g.trafficHits)||0)-(Number(prevSample?.game?.trafficHits)||0);
    if(collisionDelta>0)event('BUILDING_COLLISION',{speed,mode:a.mode,control:c});
    if(trafficDelta>0)event('TRAFFIC_CONTACT',{speed,mode:a.mode,control:c,nearest:a.nearest});
    if(a.prediction?.ttc!=null&&Number.isFinite(a.prediction.ttc)&&a.prediction.ttc<1.2)event('NEAR_MISS',{ttc:a.prediction.ttc,risk:a.prediction.risk,mode:a.mode,control:c});
    if(a.mode==='OVERTAKE'&&prevSample?.ai?.mode!=='OVERTAKE')event('OVERTAKE_START',{speed,targetSpeed:a.targetSpeed,nearest:a.nearest});
    if(a.mode==='RECOVER'&&prevSample?.ai?.mode!=='RECOVER')event('RECOVERY',{x:g.x,y:g.y});
    if(a.mode==='REPLAN'&&prevSample?.ai?.mode!=='REPLAN')event('REPLAN',{node:a.node,routeLength:a.routeLength,risk:a.prediction?.risk});
    const cg=a.corridorGuardian;
    if(cg?.mode==='CORRIDOR_GUARD'&&prevSample?.ai?.corridorGuardian?.mode!=='CORRIDOR_GUARD')event('CORRIDOR_GUARD',{crossTrack:a.crossTrack});
    if(cg?.mode==='CORRIDOR_RECOVERY'&&prevSample?.ai?.corridorGuardian?.mode!=='CORRIDOR_RECOVERY'){state.summary.corridorRecoveries++;event('CORRIDOR_RECOVERY',{crossTrack:a.crossTrack});}
    if(cg?.mode==='LANE_RESTORED'&&prevSample?.ai?.corridorGuardian?.mode!=='LANE_RESTORED')event('LANE_RESTORED',{crossTrack:a.crossTrack});
    state.lastControl=clone(c);state.lastSample=s;
  }
  function analyze(){
    const s=state.summary,e=state.events,findings=[];
    const buildingHits=e.filter(x=>x.type==='BUILDING_COLLISION').length,trafficContacts=e.filter(x=>x.type==='TRAFFIC_CONTACT').length,nearMisses=e.filter(x=>x.type==='NEAR_MISS').length,recoveries=e.filter(x=>x.type==='RECOVERY').length;
    if(buildingHits)findings.push({severity:buildingHits>3?'HIGH':'MEDIUM',code:'WALL_CONTACT',message:`AI touched buildings ${buildingHits} time(s). Inspect preceding trajectory and steering.`});
    if(trafficContacts)findings.push({severity:trafficContacts>2?'HIGH':'MEDIUM',code:'TRAFFIC_CONTACT',message:`Traffic contact occurred ${trafficContacts} time(s). Compare prediction TTC with actual closing.`});
    if(nearMisses&&trafficContacts&&nearMisses<trafficContacts*2)findings.push({severity:'HIGH',code:'LATE_AVOIDANCE',message:'Near-miss margin is too small relative to traffic contacts. Increase anticipation horizon or braking margin.'});
    if(s.corridorRecoveries)findings.push({severity:s.corridorRecoveries>3?'HIGH':'MEDIUM',code:'CORRIDOR_RECOVERY_LOAD',message:`Corridor guardian engaged ${s.corridorRecoveries} time(s). Inspect route curvature and steering authority.`});
    if(s.hardBrakes>6)findings.push({severity:'MEDIUM',code:'HARSH_BRAKING',message:`${s.hardBrakes} high-speed hard braking actions detected.`});
    if(s.steeringSpikes>10)findings.push({severity:'MEDIUM',code:'STEERING_OSCILLATION',message:`${s.steeringSpikes} large steering reversals detected.`});
    if(recoveries>3)findings.push({severity:'HIGH',code:'RECOVERY_LOAD',message:`AI required ${recoveries} recoveries. Route planning or stuck detection needs attention.`});
    if(s.distance>0&&s.decisions>0){const rate=s.decisions/Math.max(.1,state.elapsed);if(rate<2)findings.push({severity:'LOW',code:'LOW_DECISION_RATE',message:`Decision rate is only ${rate.toFixed(1)} Hz.`});}
    if(s.distance>900&&s.collisions===0&&s.trafficHits===0)findings.push({severity:'GOOD',code:'CLEAN_RUN',message:'Long autonomous run completed without physical contact.'});
    if(s.overtakes>0)findings.push({severity:'GOOD',code:'TACTICAL_OVERTAKE',message:`${s.overtakes} tactical overtaking decision(s) were recorded.`});
    state.findings=findings;return findings;
  }
  function report(extra={}){analyze();return clone({version:2,generatedAt:new Date().toISOString(),elapsed:state.elapsed,samples:state.samples,summary:state.summary,findings:state.findings,events:state.events,recent:state.ring.slice(-120),...extra});}
  return {state,start,sample,event,analyze,report};
}
