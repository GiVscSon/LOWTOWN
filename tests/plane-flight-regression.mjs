import assert from 'node:assert/strict';
import { createFreeRoam, isPlaneRunway } from '../src/game/free_roam.js';

const notices=[];
const player={x:0,y:0,angle:0,speed:0,width:48,height:24,hp:100};
const roam=createFreeRoam(player,[],[],[],()=>true,message=>notices.push(message));
const plane=roam.fleet.find(v=>v.type==='plane');
roam.interact();assert.equal(roam.mode,'foot');
player.x=plane.x+20;player.y=plane.y;
roam.interact();assert.equal(roam.mode,'plane');assert.equal(isPlaneRunway(player.x,player.y),true);

// Fixed-wing aircraft must not rise vertically from a road or an arbitrary field.
player.x=5000;player.y=5000;
for(let i=0;i<70;i++)roam.step({up:true},1/60);
roam.toggleFlight();assert.equal(roam.altitude,0);
assert.match(notices.at(-1),/разбег по полосе/);

// On the marked runway, acceleration and forward speed support a gradual climb.
player.x=1660;player.y=2190;player.angle=0;player.speed=0;
for(let i=0;i<70;i++)roam.step({up:true},1/60);
assert.ok(player.speed>=4.5);
roam.toggleFlight();
for(let i=0;i<150;i++)roam.step({up:true},1/60);
assert.ok(roam.altitude>50&&roam.altitude<120,`climb should be gradual and speed-supported; altitude=${roam.altitude}`);
assert.ok(player.speed>7,'aircraft should keep useful forward speed during climb');

// Fixed-wing steering should be progressive rather than helicopter-fast.
const heading=player.angle;
for(let i=0;i<60;i++)roam.step({up:true,right:true},1/60);
const turn=player.angle-heading;
assert.ok(turn>.2&&turn<.75,`plane turn rate is implausible: ${turn}`);
assert.ok(player.speed<=13.001,'plane exceeded its speed limit');

// A plane may land on an unobstructed runway, but must hold above ground elsewhere.
player.x=5000;player.y=5000;player.speed=0;
roam.toggleFlight();
for(let i=0;i<240;i++)roam.step({},1/60);
assert.ok(roam.altitude>=17.9,'plane descended below its off-runway hold height');
for(let i=0;i<70;i++)roam.step({up:true},1/60);
assert.ok(player.speed>5,'pilot must retain enough thrust to reach the runway after an aborted landing');
player.x=1660;player.y=2190;
for(let i=0;i<240;i++)roam.step({down:true},1/60);
assert.equal(roam.altitude,0,'plane should complete a clear runway landing');

console.log('PLANE_FLIGHT_OK runway gate, gradual climb, progressive steering, speed cap, off-runway hold and runway landing');
