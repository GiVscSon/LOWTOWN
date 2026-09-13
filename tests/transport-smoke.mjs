import assert from 'node:assert/strict';
import { createTransportSystem, FERRY_ROUTES, AIR_ROUTES } from '../src/game/transport.js';
import { ISLANDS, isLand } from '../src/game/islands.js';

const water=(a,b)=>[...Array(19)].every((_,i)=>{const t=(i+1)/20;return !isLand(a.x+(b.x-a.x)*t,a.y+(b.y-a.y)*t);});
for(const r of FERRY_ROUTES){assert.ok(isLand(r.a.x,r.a.y),`${r.id}: ferry origin is not on land`);assert.ok(isLand(r.b.x,r.b.y),`${r.id}: ferry destination is not on land`);assert.ok(water(r.a,r.b),`${r.id}: ferry path is not water-only`);}
for(const r of AIR_ROUTES){assert.ok(ISLANDS.some(i=>i.id===r.from),`${r.id}: unknown origin island`);assert.ok(ISLANDS.some(i=>i.id===r.to),`${r.id}: unknown destination island`);}
const t=createTransportSystem();
for(let i=0;i<240;i++)t.update(0.25);
assert.ok(t.boats.every(b=>Number.isFinite(b.x)&&Number.isFinite(b.y)),'boat simulation produced invalid position');
assert.ok(t.planes.every(p=>Number.isFinite(p.x)&&Number.isFinite(p.y)),'plane simulation produced invalid position');
assert.ok(t.state.boatTrips>=1,'boat did not complete a crossing');
assert.ok(t.state.flightTrips>=1,'plane did not complete a flight');
console.log(`TRANSPORT_OK ferries=${FERRY_ROUTES.length} airRoutes=${AIR_ROUTES.length} boatTrips=${t.state.boatTrips} flightTrips=${t.state.flightTrips}`);
