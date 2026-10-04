import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { runtimeCity } from './helpers/runtime-city.mjs';

const city=runtimeCity(19);
for(let time=0;time<12000;time+=100){
  assert(!city.run(`streetSignal('x',${time})==='green'&&streetSignal('y',${time})==='green'`));
}
assert.equal(city.run("streetSignal('x',5100)"),'amber');
assert.equal(city.run("streetSignal('x',5800)"),'red');
assert.equal(city.run("streetSignal('y',5800)"),'red');
city.run(`roads.length=0;bridges.length=0;roads.push({x:0,y:100,w:400,h:100,dir:'h'},
  {x:150,y:0,w:100,h:400,dir:'v'});this.controlled=buildRoadPaintGeometry();`);
assert.equal(city.run('controlled.signals.length'),1);
city.tick(6);
assert(city.run("trafficMustStopAtSignal({x:345,y:174,angle:Math.PI,width:82,routeManaged:true,cruiseSpeed:1.12},controlled)"),
  'a westbound bus must obey its actual heading rather than its positive cruise speed');
assert(city.run("trafficMustStopAtSignal({x:90,y:125,angle:0,width:46,axis:'x',cruiseSpeed:2},controlled)"));
city.run('roads[1].y=200;roads[1].h=200;this.tee=buildRoadPaintGeometry();');
assert.equal(city.run('tee.signals.length'),0,'a T junction must not cause an invisible red-light stop');
city.run('roads[1].y=0;roads[1].h=400;roads[0].serviceAccess=true;this.driveway=buildRoadPaintGeometry();');
assert.equal(city.run('driveway.signals.length'),0,'service driveways must stay clear of phantom traffic signals');

const social=runtimeCity(37);
const interaction=JSON.parse(social.run(`{
  trafficCars.length=0;parkedCars.length=0;policeCars.length=0;pedestrians.length=0;buildings.length=0;trees.length=0;solidProps.length=0;
  isPositionOnSolidGround=()=>true;getWalkSurface=()=>()=>true;Object.assign(player,{x:10000,y:10000,speed:0});
  const route={districtId:'test',kind:'sidewalk',points:Array.from({length:40},(_,i)=>({x:i*8,y:0}))};
  const a={x:80,y:0,route,routeIndex:10,routeDirection:1,reaction:'calm',socialCooldown:0,pause:0,activityTimer:999},
    b={x:108,y:0,route,routeIndex:14,routeDirection:-1,reaction:'calm',socialCooldown:0,pause:0,activityTimer:999};
  pedestrians.push(a,b);updatePedestrians(1/60);
  const paired=a.activity==='talking'&&b.activity==='talking'&&a.conversationPartner===b&&b.conversationPartner===a;
  for(let i=0;i<150;i++)updatePedestrians(1/60);
  const resumed=!a.activityRemaining&&!b.activityRemaining&&Math.hypot(a.x-80,a.y)>2;
  a.reaction='fleeing';a.eventFleeTimer=1;a.activity='talking';a.activityRemaining=2;a.conversationPartner=b;
  updatePedestrians(1/60);const panicInterrupted=!a.activity&&!a.conversationPartner;
  pedestrians.length=0;
  const walker={x:80,y:0,route,routeIndex:12,routeDirection:1,goal:{x:104,y:0},reaction:'calm',pause:0,activityTimer:999};
  pedestrians.push(walker);solidProps.push({x:98,y:0,width:12,height:300});
  for(let i=0;i<240;i++)updatePedestrians(1/60);
  const backedAway=walker.x<60&&!isPedestrianBlocked(walker.x,walker.y);
  JSON.stringify({paired,resumed,panicInterrupted,backedAway});
}`));
assert(interaction.paired && interaction.resumed && interaction.panicInterrupted && interaction.backedAway,JSON.stringify(interaction));

const world=runtimeCity(20260930);
const report=JSON.parse(world.run(`{
  trafficCars.length=0;parkedCars.length=0;Object.assign(player,{x:10000,y:11000,speed:0});
  const before=pedestrians.map(p=>({x:p.x,y:p.y}));
  const activities={};let unsafe=0,roadWalking=0;
  for(let tick=0;tick<1800;tick++){
    updateCrowdReactions(pedestrians,null,1/60);updatePedestrians(1/60);stepWaterInteraction(1/60);
    for(const p of pedestrians){
      if(p.activity)activities[p.activity]=(activities[p.activity]||0)+1;
      if(isPedestrianSceneryBlocked(p.x,p.y,0,!!p.inWater))unsafe++;
      if(onRoadSurface(p.x,p.y,roads,bridges,[],roadEnds))roadWalking++;
    }
  }
  JSON.stringify({residents:pedestrians.length,routines:pedestrians.filter(p=>p.dailyStops?.length===2).length,
    districts:new Set(pedestrians.map(p=>p.districtId)).size,activities,unsafe,roadWalking,
    progressed:pedestrians.filter((p,i)=>Math.hypot(p.x-before[i].x,p.y-before[i].y)>10).length,
    signals:buildRoadPaintGeometry().signals.length,
    busStopCount:transitRoutes.reduce((n,r)=>n+r.stopIndices.length,0),
    busSigns:transitStopSigns().length,
    unsafeBusSigns:transitStopSigns().filter(p=>isPedestrianSceneryBlocked(p.x,p.y)||onRoadSurface(p.x,p.y,roads,bridges,scenicRoads,roadEnds)).length});
}`));
assert.equal(report.routines,report.residents);
assert.equal(report.districts,16);assert.equal(report.unsafe,0);assert.equal(report.roadWalking,0);
assert(report.progressed>report.residents*.7,JSON.stringify(report));
assert(report.activities.reading>0 && report.activities.shopping>0 && report.activities.coffee>0,JSON.stringify(report));
assert(report.activities.talking>0,'residents should actually meet and talk during normal simulation');
assert(report.busStopCount>=20 && report.busSigns>=20,JSON.stringify(report));
assert.equal(report.unsafeBusSigns,0);
mkdirSync('artifacts/living-world',{recursive:true});
writeFileSync('artifacts/living-world/behavior-report.json',JSON.stringify({interaction,...report},null,2));
console.log('LIVING WORLD BEHAVIOR PASS',JSON.stringify(report));
