import assert from 'node:assert/strict';
import { runtimeCity } from './helpers/runtime-city.mjs';

for (const seed of [19, 37, 20260930]) {
  const city = runtimeCity(seed);
  const result = JSON.parse(city.run(`{
    const incident=cityIncidentDirector.start('crash',safeSpawnPoints[13],{duration:600});
    dispatchIncidentResponse(incident);
    const dispatched=dispatchAirMedicalResponse(incident);
    const duplicate=dispatchAirMedicalResponse(incident);
    const unit=airMedicalVehicles[0],phases=new Set();
    const initial={x:unit.x,y:unit.y,altitude:unit.altitude};
    let maxStep=0,unsafeFlight=0,groundMoved=false;
    for(let tick=0;tick<18000&&airMedicalVehicles.length;tick++){
      const before={x:unit.x,y:unit.y,altitude:unit.altitude};
      phases.add(unit.status);updateAirMedicalResponse(1/60);
      const distance=Math.hypot(unit.x-before.x,unit.y-before.y);
      maxStep=Math.max(maxStep,distance);
      if(distance>1.01&&unit.altitude<unit.cruiseAltitude)unsafeFlight++;
      if(tick===0)groundMoved=unit.x!==before.x||unit.y!==before.y;
    }
    JSON.stringify({dispatched,duplicate,phases:[...phases],initial,
      base:unit.baseTarget,final:{x:unit.x,y:unit.y,altitude:unit.altitude},
      treated:incident.medicalTreated,provider:incident.medicalProvider,patient:incident.actors.find(a=>a.role==='injured'),
      returned:unit.returnedToBase,remaining:airMedicalVehicles.length,maxStep,unsafeFlight,groundMoved});
  }`));
  assert(result.dispatched && !result.duplicate, 'dispatch must be idempotent');
  assert(!result.groundMoved, 'aircraft must climb before leaving its rooftop pad');
  assert.equal(result.unsafeFlight, 0, 'horizontal flight must clear every roof');
  assert(result.maxStep <= 8.01, 'flight must move continuously');
  assert(result.treated && result.patient.medicalTreated);
  assert.equal(result.provider, 'helicopter');
  assert.equal(result.patient.stance, 'assisted');
  assert(result.returned && result.remaining === 0, 'aircraft must finish the return and landing');
  assert.deepEqual(result.final, result.base);
  for (const phase of ['takingOff','enroute','descending','onscene','climbingReturn','returning','landing'])
    assert(result.phases.includes(phase), `missing flight phase ${phase}`);

  const edgeCases = JSON.parse(city.run(`{
    incidentResponseVehicles.length=0;
    const calm=cityIncidentDirector.start('carTheft',safeSpawnPoints[0]);
    const nonMedical=dispatchAirMedicalResponse(calm);
    const local=cityIncidentDirector.start('crash',safeSpawnPoints[17]);
    dispatchIncidentResponse(local);const nearby=dispatchAirMedicalResponse(local);
    incidentResponseVehicles.length=0;
    const roadFasterScene=cityIncidentDirector.start('crash',safeSpawnPoints[0]);
    dispatchIncidentResponse(roadFasterScene);const roadFaster=dispatchAirMedicalResponse(roadFasterScene);
    incidentResponseVehicles.length=0;
    const first=cityIncidentDirector.start('crash',safeSpawnPoints[0]);dispatchAirMedicalResponse(first);
    const unit=airMedicalVehicles[0];
    for(let i=0;i<240;i++)updateAirMedicalResponse(1/60);
    const replacement=cityIncidentDirector.start('crash',safeSpawnPoints[14]);
    const busy=dispatchAirMedicalResponse(replacement);
    for(let i=0;i<12000&&airMedicalVehicles.length;i++)updateAirMedicalResponse(1/60);
    const cancelledReturned=unit.returnedToBase;
    const unrelatedUntreated=!replacement.medicalTreated;
    const redispatched=dispatchAirMedicalResponse(replacement);
    cityIncidentDirector.finish();
    for(let i=0;i<12000&&airMedicalVehicles.length;i++)updateAirMedicalResponse(1/60);
    const vanishedClean=airMedicalVehicles.length===0;
    const removed=buildings.filter(b=>b.civicType==='airAmbulanceBase');
    for(const b of removed)buildings.splice(buildings.indexOf(b),1);
    const noBase=dispatchAirMedicalResponse(cityIncidentDirector.start('crash',safeSpawnPoints[0]));
    JSON.stringify({nonMedical,nearby,roadFaster,busy,cancelledReturned,unrelatedUntreated,redispatched,vanishedClean,noBase});
  }`));
  assert(!edgeCases.nonMedical && !edgeCases.nearby && !edgeCases.roadFaster && !edgeCases.busy && !edgeCases.noBase);
  assert(edgeCases.cancelledReturned && edgeCases.unrelatedUntreated && edgeCases.redispatched && edgeCases.vanishedClean);
}

// Verify dispatch and flight through the same physics loop used by the game.
const live = runtimeCity(19);
live.run(`trafficCars.length=0;parkedCars.length=0;pedestrians.length=0;
  const incident=cityIncidentDirector.start('crash',safeSpawnPoints[13],{duration:600});incident.reported=true;
  Object.assign(player,{...safeSpawnPoints[0],speed:0});state.invulnTimer=999999;`);
live.run('updatePhysics(1/60)');
assert.equal(live.run('airMedicalVehicles.length'), 1);
live.run('for(let i=0;i<300;i++)updatePhysics(1/60)');
assert(live.run('airMedicalVehicles[0].altitude>airMedicalVehicles[0].baseTarget.altitude'));
console.log('AIR MEDICAL PASS: 3 seeds, complete rescue/return cycles, roof clearance, duplicate/busy/missing bases, nearby road response, scene cancellation and live physics dispatch');
