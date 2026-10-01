import assert from 'node:assert/strict';
import { runtimeCity } from './helpers/runtime-city.mjs';

const city=runtimeCity();
const run=city.run;
const plain=code=>JSON.parse(run(`JSON.stringify(${code})`));
run(`roads.length=0;bridges.length=0;
roads.push({x:0,y:100,w:400,h:100,dir:'h'},{x:150,y:0,w:100,h:400,dir:'v'});
this.paint=buildRoadPaintGeometry();`);
assert.equal(plain('paint.junctions').length,1);
assert.deepEqual(plain('paint.junctions[0].approaches'),{north:true,south:true,west:true,east:true});
const insideCore=(x,y)=>x>150&&x<250&&y>100&&y<200;
for(const line of plain('[...paint.curbs,...paint.lanes]')){
  for(let i=1;i<20;i++)assert(!insideCore(line.x1+(line.x2-line.x1)*i/20,line.y1+(line.y2-line.y1)*i/20),'internal curb or lane crosses junction');
}
for(const s of plain('junctionCrosswalkStripes({y:100,h:100},{x:150,w:100})')){
  assert(s.x+s.w<=150||s.x>=250||s.y+s.h<=100||s.y>=200,'crosswalk must stay outside turning area');
}
run(`roads[1].y=200;roads[1].h=200;this.paint=buildRoadPaintGeometry();`);
assert.deepEqual(plain('paint.junctions[0].approaches'),{north:false,south:true,west:true,east:true},'touching T junction needs only three approaches');
assert(!plain('junctionCrosswalkStripes({y:100,h:100},{x:150,w:100},paint.junctions[0].approaches)').some(s=>s.approach==='north'));
run(`roads.push({...roads[0]});this.paint=buildRoadPaintGeometry();`);
assert.equal(plain('paint.junctions').length,1,'overlapping road definitions must not double paint junctions');
run(`buildings.length=0;buildings.push({x:100,y:100,w:200,h:200});`);
assert(run('streetActorDepth({x:310,y:130})')>600,'actor beside right wall must draw in front');
assert(run('streetActorDepth({x:130,y:310})')>600,'actor beside front wall must draw in front');
assert.equal(run('streetActorDepth({x:130,y:90})'),220,'rear actor must remain behind building');

run(`initTopology();reconcilePoliceRoster=()=>{};trafficCars.length=0;parkedCars.length=0;
state.wanted=1;state.invulnTimer=999;state.detainProgress=0;
Object.assign(player,{x:1460,y:1200,width:48,speed:0});
policeCars.length=0;
policeCars.push({x:1400,y:1200,width:48,height:24,angle:1.4,speed:0,maxSpeed:3,route:[{x:1460,y:1200}],routeTimer:999,strobePhase:0});`);
for(let i=0;i<180;i++)run('updatePoliceAI(1/60)');
assert.deepEqual(plain('({x:policeCars[0].x,y:policeCars[0].y,angle:policeCars[0].angle,status:policeCars[0].status})'),{x:1400,y:1200,angle:1.4,status:'containing'},'stationary suspect must not induce circling');
run('player.x=1800;player.speed=2;policeCars[0].routeTimer=0;updatePoliceAI(1/60);');
assert.equal(run('policeCars[0].status'),'enroute','moving suspect must resume pursuit');
run(`Object.assign(player,{x:1460,y:1200,speed:0});Object.assign(policeCars[0],{x:1265,y:1200,angle:0,speed:0,route:[{x:1265,y:1200}],routeTimer:999});`);
for(let i=0;i<180;i++)run('updatePoliceAI(1/60)');
assert.equal(run('policeCars[0].angle'),0,'final road node must not cause endless orbit');
assert.equal(run('policeCars[0].speed'),0);
run(`state.invulnTimer=0;state.cash=750;state.detainProgress=0;
policeCars.length=0;
for(const y of [1190,1210])policeCars.push({x:1400,y,width:48,height:24,angle:0,speed:0,route:[{x:1460,y:1200}],routeTimer:999,strobePhase:0});`);
for(let i=0;i<120;i++)run('updatePoliceAI(1/60)');
assert.equal(run('state.wanted'),1,'multiple officers must not multiply detention speed');
assert(Math.abs(run('state.detainProgress')-2)<1e-8);
for(let i=0;i<61;i++)run('updatePoliceAI(1/60)');
assert.equal(run('state.wanted'),0,'stationary blocked suspect must be detained');
assert.equal(run('state.cash'),650);
assert.equal(run('state.deathFlash'),0,'detention must not display a death');
assert.equal(run('state.detainProgress'),0);

// The normal physics loop must update police after changing movement mode.
// Previously the special-mode guard froze pursuit on foot, water and in air.
for(const mode of ['foot','tug','helicopter']){
  const c=runtimeCity(37);
  c.run(`trafficCars.length=0;parkedCars.length=0;pedestrians.length=0;
    Object.assign(player,{x:1460,y:1200,speed:0});
    roam=createFreeRoam(player,parkedCars,buildings,trees,isPositionOnSolidGround,()=>{},solidProps,isPositionOnWaterObstacle,()=>policeCars);
    roam.interact();`);
  if(mode==='foot')c.run('Object.assign(player,{x:1460,y:1200});');
  else c.run(`const selected=roam.fleet.find(v=>v.type==='${mode}');Object.assign(player,{x:selected.x+20,y:selected.y});roam.interact();`);
  assert.equal(c.run('roam.mode'),mode);
  if(mode==='helicopter')c.run('roam.toggleFlight();for(let i=0;i<220;i++)updatePhysics(1/60);');
  c.run(`state.wanted=1;state.invulnTimer=0;state.cash=750;state.detainProgress=0;reconcilePoliceRoster=()=>{};
    const node=roadGraph.filter(n=>policeFootprintOnRoad({x:n.x,y:n.y,angle:0,width:48,height:24})).reduce((best,n)=>Math.hypot(n.x-player.x,n.y-player.y)<Math.hypot(best.x-player.x,best.y-player.y)?n:best);
    policeCars.push({role:'patrol',x:${mode==='foot'?'1410':'node.x'},y:${mode==='foot'?'1200':'node.y'},angle:0,width:48,height:24,speed:0,strobePhase:0,routeTimer:0});`);
  for(let i=0;i<120;i++){c.tick(1/60);c.run('updatePhysics(1/60)');}
  assert(c.run('policeCars[0].strobePhase')>30,`${mode}: police froze outside sedan mode`);
  assert(c.run('policeCars.every(policeFootprintOnRoad)'),`${mode}: police left road`);
  if(mode==='foot'){
    assert(Math.abs(c.run('state.detainProgress')-2)<1e-8,'normal foot physics must advance detention');
    for(let i=0;i<61;i++){c.tick(1/60);c.run('updatePhysics(1/60)');}
    assert.equal(c.run('state.wanted'),0);
    assert.equal(c.run('state.cash'),650);
    assert.equal(c.run('roam.mode'),'foot');
    assert(c.run("state.custodyStation&& !onRoadSurface(player.x,player.y,roads,bridges,scenicRoads,roadEnds)"),'detained pedestrian must be released at the station entrance');
  }else if(mode==='helicopter')assert.equal(c.run('state.detainProgress'),0,'aircraft at height must not be arrested from ground projection');
}
console.log('PASS: shared intersection paint, T approaches, wall depth, police containment, timed detention and pursuit on foot/water/air');
