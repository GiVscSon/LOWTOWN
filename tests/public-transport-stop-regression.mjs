import assert from 'node:assert/strict';
import {runtimeCity} from './helpers/runtime-city.mjs';
const city=runtimeCity(73);
const report=JSON.parse(city.run(`JSON.stringify((()=>{
  const signs=transitStopSigns(),buses=trafficCars.filter(c=>c.type==='bus'&&c.routeManaged);
  const overlap=(a,b)=>Math.abs(a.x-b.x)<(a.width||a.w||0)/2+(b.width||b.w||0)/2+8&&Math.abs(a.y-b.y)<(a.height||a.h||0)/2+(b.height||b.h||0)/2+8;
  const shelters=streetProps.filter(p=>p.type==='shelter');
  const blockers=signs.flatMap(stop=>streetProps.filter(p=>p.type!=='shelter'&&overlap({x:stop.x,y:stop.y,width:34,height:28},p)).map(p=>({stop,prop:p.type})));
  const detached=shelters.filter(s=>!s.busStop||Math.hypot(s.x-s.busStop.x,s.y-s.busStop.y)>140).map(s=>({x:s.x,y:s.y,busStop:s.busStop}));
  const signKeys=new Set(signs.map(s=>s.x.toFixed(1)+':'+s.y.toFixed(1)));
  const routeAudit=transitRoutes.map(route=>({id:route.id,stops:route.stopIndices.length,points:route.points.length,roadBound:route.points.every(p=>onRoadSurface(p.x,p.y,roads,bridges,scenicRoads,roadEnds)),signs:signs.filter(s=>s.routeId===route.id).length}));
  const visited=[];
  for(const bus of buses){
    const route=bus.route,index=route.stopIndices[0],before=route.points[(index-1+route.points.length)%route.points.length];
    Object.assign(bus,{x:before.x,y:before.y,routeIndex:(index+route.points.length-1)%route.points.length,routeWait:0,lastStopIndex:-1});
    for(let i=0;i<220;i++){advanceRouteActor(bus,route,1,{speed:2,dwell:3,stopRadius:12});if(bus.lastStopIndex>=0)visited.push({id:bus.trafficId,stop:bus.lastStopIndex,wait:bus.routeWait});}
  }
  return {routes:routeAudit,buses:buses.length,signs:signKeys.size,shelters:shelters.length,blockers,detached,visited:visited.length,waits:visited.filter(v=>v.wait>0).length};
})())`));
assert.equal(report.routes.length,2,JSON.stringify(report));
assert(report.routes.every(r=>r.stops>=10&&r.signs>=10&&r.roadBound),JSON.stringify(report));
assert(report.buses>=4,JSON.stringify(report));
assert(report.signs>=20&&report.signs<=28,JSON.stringify(report));
assert.equal(report.blockers.length,0,JSON.stringify(report));
assert.equal(report.detached.length,0,JSON.stringify(report));
assert(report.visited>0&&report.waits>0,JSON.stringify(report));
console.log('PASS public transport stop placement, shelters, bus routes and dwell behavior',report);
