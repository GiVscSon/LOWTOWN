import assert from 'node:assert/strict';
import { circleContact, resolveWallContact, collisionTelemetry } from '../src/game/collision_physics.js';

const wall={x:0,y:0,vx:-20,vy:4,mass:1500};
const wallHit=resolveWallContact(wall,1,0);
assert(wallHit.hit,'wall contact must register');
assert(wall.vx>0,'wall response must reverse normal velocity');
assert(Math.abs(wall.vy)<4,'wall friction must reduce tangential velocity');
assert(wallHit.damage>0,'wall impact must produce damage impulse');

const a={x:0,y:0,vx:10,vy:0,mass:1200,radius:10};
const b={x:18,y:0,vx:-5,vy:0,mass:1600,radius:10};
const beforeMomentum=a.mass*a.vx+b.mass*b.vx;
const hit=circleContact(a,b,{restitution:.15,friction:.5});
assert(hit.hit,'vehicle contact must register');
assert(a.vx<10&&b.vx>-5,'vehicle collision must change both velocities');
assert(hit.impulse>0,'vehicle collision must produce impulse');
assert(hit.damage>0,'vehicle collision must produce damage');
const afterMomentum=a.mass*a.vx+b.mass*b.vx;
assert(Math.abs(afterMomentum-beforeMomentum)<1e-6,'collision must conserve linear momentum');
const telemetry=collisionTelemetry(hit);
assert(telemetry.hit&&Number.isFinite(telemetry.impulse),'collision telemetry must be finite');

const pedestrian={x:30,y:0,vx:0,vy:0,mass:80,radius:7};
const car={x:45,y:0,vx:-12,vy:0,mass:1500,radius:10};
const pedHit=circleContact(pedestrian,car,{restitution:.08,friction:.2,damageScale:.003});
assert(pedHit.hit,'car-pedestrian contact must register');
assert(Math.abs(pedestrian.vx)>0,'pedestrian must receive collision impulse');
console.log('PASS COLLISION PHYSICS',JSON.stringify({wall:wallHit,vehicle:hit,pedestrian:pedHit}));
