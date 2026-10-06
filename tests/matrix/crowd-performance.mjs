import assert from 'node:assert/strict';
import {coastPoints,pointInCoast} from '../../src/world/coastline.js';
import {corridorRoad,corridorSegments,corridorContains,projectStreet,onStreetCollection} from '../../src/world/street_corridors.js';
import {createNeighbourhood} from '../../src/simulation/neighbourhood.js';
import {captureMotion,solveVehicleMotion,createSceneryIndex,contact,chassis} from '../../src/simulation/solid_contacts.js';
import {createAdaptiveResolution,DEFAULT_GRAPHICS,loadGraphics} from '../../src/render/three/graphics_settings.js';
import {installRuntimeLoop} from '../../src/runtime/loop.js';
let seed=731;const random=()=>((seed=(Math.imul(seed,1664525)+1013904223)>>>0)/4294967296);
const exhaustive=(x,y,points)=>{let inside=false;for(let i=0,j=points.length-1;i<points.length;j=i++){const [ax,ay]=points[i],[bx,by]=points[j];if((ay>y)!==(by>y)&&x<(bx-ax)*(y-ay)/(by-ay)+ax)inside=!inside;}return inside;};
let coastQueries=0;
for(const island of [{id:'core',x:-2200,y:-500,w:2400,h:2800},{id:'natural',natural:true,x:0,y:0,w:500,h:600},{id:'concave',x:-800,y:-900,w:900,h:1200,coast:[[0,0],[1,0],[1,1],[.5,.3],[0,1]]}]){
 const points=coastPoints(island);
 for(let i=0;i<10000;i++){const x=island.x-200+random()*(island.w+400),y=island.y-200+random()*(island.h+400);assert.equal(pointInCoast(x,y,island),exhaustive(x,y,points));coastQueries++;}
 for(const [x,y] of points)for(const d of [-1e-8,0,1e-8]){assert.equal(pointInCoast(x+d,y+d,island),exhaustive(x+d,y+d,points));coastQueries++;}
}
const roads=[corridorRoad([[-300,-400],[-30,90],[900,340]],83)];
for(let i=0;i<5000;i++){const x=random()*1600-500,y=random()*1100-500,pad=i%4-2;const expected=corridorSegments(roads[0]).some(s=>projectStreet(x,y,s).distance<=s.width/2+pad);assert.equal(onStreetCollection(x,y,roads,pad),expected);if(x>=roads[0].x-pad&&x<=roads[0].x+roads[0].w+pad&&y>=roads[0].y-pad&&y<=roads[0].y+roads[0].h+pad)assert.equal(corridorContains(x,y,roads[0],pad),expected);}
const items=Array.from({length:1500},(_,id)=>({id,x:random()*10000-5000,y:random()*10000-5000})),index=createNeighbourhood(items);
// People move sequentially after the index is built; query margin includes them.
for(const item of items){item.x+=random()*10-5;item.y+=random()*10-5;}
for(let i=0;i<500;i++){const x=random()*10000-5000,y=random()*10000-5000,predicate=p=>Math.abs(p.x-x)<42&&Math.abs(p.y-y)<42;assert.equal(index.find(x,y,58,predicate),items.find(predicate));assert.equal(index.some(x,y,58,predicate),items.some(predicate));}
const body=x=>({x,y:0,angle:0,width:48,height:24,mass:1500,vx:0,vy:0,speed:0});
for(const hz of [30,60,120])for(const reverse of [false,true]){
 const car=body(-100),parked=body(0),bodies=reverse?[parked,car]:[car,parked],sceneryIndex=createSceneryIndex(),options={player:car,passive:new Set([parked]),sceneryIndex};
 for(let i=0;i<2;i++)solveVehicleMotion(bodies,captureMotion(bodies),1/hz,options);
 assert.equal(solveVehicleMotion(bodies,captureMotion(bodies),1/hz,options).sleepingBodies,1);
 car.vx=car.speed=6;let impacts=0;options.onImpact=(a,b,speed,normal)=>{impacts++;assert(!normal.fixed);};
 for(let i=0;i<hz;i++){const starts=captureMotion(bodies);car.x+=car.vx*60/hz;solveVehicleMotion(bodies,starts,1/hz,options);assert(!contact(chassis(car),chassis(parked)));}
 assert(impacts>0&&parked.x>30&&parked.vx>0,'sleeping parked car failed to wake and coast');
}
const sleepers=Array.from({length:500},(_,i)=>body(i*80)),scenery=createSceneryIndex();let queries=0;const query=scenery.query;scenery.query=(...a)=>{queries++;return query(...a);};
const passive=new Set(sleepers);solveVehicleMotion(sleepers,captureMotion(sleepers),1/60,{passive,sceneryIndex:scenery});queries=0;
const sleeping=solveVehicleMotion(sleepers,captureMotion(sleepers),1/60,{passive,sceneryIndex:scenery});assert.equal(sleeping.sleepingBodies,500);assert.equal(queries,0,'sleeping objects still query scenery');
const wall=createSceneryIndex([],[],[{x:0,y:0,width:10,height:80}]);solveVehicleMotion([sleepers[0]],captureMotion([sleepers[0]]),1/60,{passive,sceneryIndex:wall});assert(!contact(chassis(sleepers[0]),{x:0,y:0,angle:0,length:10,breadth:80}),'a scenery change must wake and separate a stationary body');
let now=1000,steps=0,rendered=0;const scheduled=[];
const ctx={env:{performance:{now:()=>now},document:{hidden:false},window:{},setTimeout:fn=>{scheduled.push(fn);return scheduled.length;},requestAnimationFrame:()=>0},state:{lastFrameTime:0},isGamePaused:()=>false,qaManualSceneClock:null,lastSimulationTime:0,lastGameRenderTime:-Infinity,accumulator:0,perfEnabled:false,updatePhysics(dt){assert.equal(dt,1/60);steps++;now+=3;},renderWorld(){rendered++;}};
installRuntimeLoop(ctx);ctx.advanceSimulation(now);assert(steps<=3,'slow frame produced a long physics task');assert(ctx.accumulator<=.25);assert.equal(scheduled.length,1,'backlog must continue in a separate task');ctx.gameLoop(now);assert.equal(rendered,1,'rendering cannot be starved by catch-up');
const before=steps;scheduled.shift()();assert(steps>before&&steps-before<=3);assert.equal(scheduled.length,1,'catch-up timers multiplied');
const adaptive=createAdaptiveResolution(),graphics={...DEFAULT_GRAPHICS,resolution:1.5};for(let i=0;i<80;i++)adaptive.sample(60,graphics);assert.equal(adaptive.ratio(graphics),.75);for(let i=0;i<8;i++)adaptive.sample(16,graphics);assert.equal(adaptive.ratio(graphics),.75,'brief improvement caused resolution flicker');for(let i=0;i<800;i++)adaptive.sample(16,graphics);assert.equal(adaptive.ratio(graphics),1.5);assert.equal(adaptive.ratio({...graphics,adaptive:false,resolution:2}),2);assert.equal(createAdaptiveResolution(true).ratio(graphics),.75);
const storage={getItem:()=>JSON.stringify({preset:'high',resolution:2,lighting:'detailed',fps:30})};assert.equal(loadGraphics(storage).resolution,2);assert(loadGraphics(storage).adaptive,'old settings should acquire automatic adaptation without losing choices');
console.log('CROWD_PERFORMANCE_MATRIX_OK',JSON.stringify({coastQueries,roadQueries:5000,neighborQueries:500,sleepingBodies:500,wakeRates:[30,60,120],inputBudget:true,adaptive:true}));
