const WEIGHTS={WALL_CONTACT:5,TRAFFIC_CONTACT:4,LATE_AVOIDANCE:4,CORRIDOR_RECOVERY_LOAD:3,HARSH_BRAKING:2,STEERING_OSCILLATION:2,RECOVERY_LOAD:3,LOW_DECISION_RATE:1};
export function scoreBlackBox(report={}){
  const s=report.summary||{},f=report.findings||[];
  let penalty=(s.collisions||0)*8+(s.trafficHits||0)*6+(s.recoveries||0)*3+(s.corridorRecoveries||0)*2+(s.hardBrakes||0)*1.5+(s.steeringSpikes||0)*1.2;
  for(const x of f)penalty+=WEIGHTS[x.code]||0;
  const distance=Number(s.distance)||0;
  const safety=Math.max(0,100-penalty);
  const progress=Math.min(100,distance/20);
  return {score:+(safety*.7+progress*.3).toFixed(2),safety:+safety.toFixed(2),progress:+progress.toFixed(2),penalty:+penalty.toFixed(2),priority:priorityFromFindings(f)};
}
export function priorityFromFindings(findings=[]){return findings.map(f=>f.code).filter(Boolean).sort((a,b)=>(WEIGHTS[b]||0)-(WEIGHTS[a]||0));}
export function adaptScenario(scenario={},report={}){
  const result=scoreBlackBox(report),codes=new Set(result.priority),s={...scenario,feedbackVersion:1,sourceScore:result.score};
  if(codes.has('WALL_CONTACT')||codes.has('CORRIDOR_RECOVERY_LOAD'))s.curvature=Math.min(1,Number(s.curvature||0)+.08);
  if(codes.has('TRAFFIC_CONTACT')||codes.has('LATE_AVOIDANCE')){s.trafficDensity=Math.min(1,Number(s.trafficDensity||0)+.08);s.obstacleTime=Math.max(.5,Number(s.obstacleTime||3)-.5);}
  if(codes.has('HARSH_BRAKING'))s.leadSpeed=Math.max(35,Number(s.leadSpeed||120)-15);
  if(codes.has('STEERING_OSCILLATION'))s.curvature=Math.min(1,Number(s.curvature||0)+.04);
  if(codes.has('RECOVERY_LOAD'))s.recovery=true;
  return s;
}
export function runScenarioBatch(scenarios=[],reports=[]){
  const rows=[];let total=0;
  for(let i=0;i<scenarios.length;i++){const report=reports[i]||{};const result=scoreBlackBox(report);const adapted=adaptScenario(scenarios[i],report);rows.push({id:scenarios[i]?.id||`SCENARIO_${i+1}`,score:result.score,safety:result.safety,penalty:result.penalty,priority:result.priority,adapted});total+=result.score;}
  return {count:rows.length,meanScore:rows.length?+(total/rows.length).toFixed(2):0,rows};
}
