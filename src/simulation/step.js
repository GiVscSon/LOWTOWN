import {createNeighbourhood} from './neighbourhood.js';
// One shared runtime context owns state; this system has no hidden globals.
export function installSimulationStep(ctx){
const {advanceRouteActor,advanceTrafficCar,captureMotion,pointInCoast,stepLandVehicle,surfaceMovement,updateCrowdReactions,weatherMovement}=ctx.dependencies;
ctx.stuntHeightFor = // Public streets are level: no automatic launches or stunt obstacles.
function stuntHeightFor() {
  return 0;
};
ctx.updateStuntVehicle = function updateStuntVehicle() {
  return 0;
};
ctx.updatePhysics = function updatePhysics(dt) {
  if (ctx.state.isMenuOpen) return;
  ctx.weather.step(dt);
  ctx.state.deathFlash = ctx.env.Math.max(0, ctx.state.deathFlash - dt * 1.15);
  if (ctx.state.isMapOpen || ctx.state.isGarageOpen) {
    ctx.player.speed *= 0.88;
    return;
  }
  if (ctx.state.invulnTimer > 0) ctx.state.invulnTimer--;
  const inCustody = ctx.state.custodyTimer > 0;
  if (inCustody) {
    ctx.state.custodyTimer = ctx.env.Math.max(0, ctx.state.custodyTimer - dt);
    const overlay = ctx.env.document.getElementById('custodyOverlay');
    if (overlay) {
      overlay.style.opacity = String(ctx.env.Math.min(1, ctx.state.custodyTimer / .4));
      if (!ctx.state.custodyTimer) overlay.style.display = 'none';
    }
    if (!ctx.state.custodyTimer) {
      Object.keys(ctx.state.keys).forEach(key => ctx.state.keys[key] = false);
      ctx.showToast('Освобождены · выходите пешком из участка');
    }
  }
  const motionStarts = captureMotion(ctx.cityCollisionBodies());
  ctx.player.knockdownTimer = ctx.env.Math.max(0, (ctx.player.knockdownTimer || 0) - dt);
  ctx.player.hitCooldown = ctx.env.Math.max(0, (ctx.player.hitCooldown || 0) - dt);
  if (!ctx.player.knockdownTimer && ctx.player.stance === 'down') ctx.player.stance = null;
  const movementKeys = inCustody || ctx.player.knockdownTimer > 0 ? {} : ctx.state.keys;
  ctx.stepCharacterActions(dt, movementKeys);
  const specialMovement = ctx.roam?.step(movementKeys, dt);
  if (!specialMovement) {
    const surface = ctx.surfaceAt(ctx.player.x, ctx.player.y),
      surfaceResponse = weatherMovement(surfaceMovement(surface, ctx.roam?.profile), ctx.weather);
    ctx.player.surface = surface;
    const driveProfile = {
      ...(ctx.roam?.profile || {
        max: 7.2,
        accel: .022,
        width: 48
      })
    };
    if (ctx.CARPARTS.find(p => p.id === 'turbo')?.found) driveProfile.max *= 1.2;
    if (ctx.CARPARTS.find(p => p.id === 'cams')?.found) driveProfile.accel *= 1.1;
    const isBoosting = ctx.state.keys.nitro && ctx.state.nitroAmount > 5;
    if (isBoosting) {
      driveProfile.max *= 1.25;
      driveProfile.accel *= 1.45;
    }
    ctx.state.nitroAmount = ctx.env.Math.max(0, ctx.env.Math.min(100, ctx.state.nitroAmount + (isBoosting ? -.7 : .2) * dt * 60));
    const nitroBarEl = ctx.env.document.getElementById('nitroBar');
    if (nitroBarEl) nitroBarEl.style.width = ctx.env.Math.round(ctx.state.nitroAmount) + '%';
    stepLandVehicle(ctx.player, ctx.player.inWater ? {} : movementKeys, dt, driveProfile, surfaceResponse);
    if (ctx.state.keys.handbrake && ctx.env.Math.abs(ctx.player.speed) > 2) {
      ctx.skidmarks.push({
        x: ctx.player.x,
        y: ctx.player.y,
        angle: ctx.player.angle,
        alpha: .5
      });
      if (ctx.skidmarks.length > 200) ctx.skidmarks.shift();
    }
    ctx.updateStuntVehicle(ctx.player, dt);

    // Tuning Parts Pickup
    ctx.CARPARTS.forEach(part => {
      if (!part.found && ctx.env.Math.hypot(part.x - ctx.player.x, part.y - ctx.player.y) < 45) {
        part.found = true;
        ctx.showToast(`⭐ НАЙДЕНА ДЕТАЛЬ: ${part.name} (${part.bonus})!`);
        ctx.updateGaragePartsUI();
        ctx.autoSaveProgress();
      }
    });
  }
  // One swept neighbourhood index per physics step. Keep the exact following
  // test; expand the neighbourhood for sequential actor movement.
  const trafficOccupants=[...(ctx.roam?.mode !== 'foot' && (ctx.roam?.altitude||0)<12?[ctx.player]:[]),...ctx.trafficCars,...ctx.parkedCars,...ctx.policeCars,...ctx.incidentPoliceCars,...ctx.incidentResponseVehicles,...(ctx.roam?.fleet||[]).filter(v=>v.kind!=='water'),...ctx.breakableProps.filter(p=>p.movable&&p.intact!==false)];
  const footOccupants=[...ctx.pedestrians,...(ctx.roam?.mode==='foot'?[ctx.player]:[])];
  const motionPad=Math.max(32,...trafficOccupants.map(body=>Math.max(body.width||body.w||48,body.height||body.h||24)/2+Math.hypot(body.vx||0,body.vy||0,body.speed||0)*dt*60));
  const trafficNeighbourhood=createNeighbourhood(trafficOccupants),footNeighbourhood=createNeighbourhood(footOccupants);
  // Traffic update
  ctx.trafficCars.forEach(c => {
    if (c.cruiseSpeed === undefined) c.cruiseSpeed = c.speed;
    const emergencyYield = ctx.yieldTrafficToServices(c, dt);
    const forwardGap = ctx.env.Math.max(72, (c.width || 46) + 34);
    const cs = ctx.env.Math.cos(c.angle),
      sn = ctx.env.Math.sin(c.angle);
    const ahead = (other, gap, margin) => {
      const dx = other.x - c.x,
        dy = other.y - c.y,
        along = dx * cs + dy * sn;
      if (ctx.env.Math.abs(dx) > gap + margin || ctx.env.Math.abs(dy) > gap + margin) return false;
      // Opposing lanes need chassis clearance, rather than the much wider
      // following buffer used for a vehicle travelling in the same direction.
      // Otherwise a bus on the centre route and a car in its own lane stop
      // one another despite having a clear physical passing gap.
      const opposing = Number.isFinite(other.angle) && ctx.env.Math.cos(other.angle - c.angle) < -.8;
      return along > 0 && along < gap && ctx.env.Math.abs(-dx * sn + dy * cs) < (opposing ? ctx.env.Math.max(0, margin - 10) : margin);
    };
    const occupied = trafficNeighbourhood.some(c.x,c.y,forwardGap+motionPad+64,other => other !== c && ahead(other, forwardGap, ((c.height || 24) + (other.height || 24)) / 2 + 12)) || footNeighbourhood.some(c.x,c.y,100+motionPad,person => ahead(person, 70, (c.height || 24) / 2 + 7));
    const approachingRed = ctx.trafficMustStopAtSignal(c);
    c.collisionHold = ctx.env.Math.max(0, (c.collisionHold || 0) - dt);
    const obstacle = occupied || approachingRed || emergencyYield || c.collisionHold > 0;
    const signalSpeed = approachingRed ? ctx.env.Math.max(0, c.signalGap - 3) / 12 : Infinity;
    const allowedSpeed = occupied || emergencyYield || c.collisionHold > 0 ? 0 : ctx.env.Math.sign(c.cruiseSpeed) * ctx.env.Math.min(ctx.env.Math.abs(c.cruiseSpeed), signalSpeed);
    if (c.routeManaged) {
      if (emergencyYield) {
        c.speed = 0;
        return;
      }
      const pose = {
        x: c.x,
        y: c.y,
        angle: c.angle,
        routeIndex: c.routeIndex,
        routeWait: c.routeWait,
        lastStopIndex: c.lastStopIndex
      };
      advanceRouteActor(c, c.route, dt, {
        speed: allowedSpeed,
        dwell: 2.1,
        stopRadius: 12
      });
      if (!ctx.policeFootprintOnRoad(c) || ctx.trafficTouchesResponder(c)) {
        Object.assign(c, pose);
        c.speed = 0;
      }
      return;
    }
    c.speed += (allowedSpeed - c.speed) * ctx.env.Math.min(1, dt * (obstacle ? 9 : 3.5));
    const frame = ctx.env.Math.min(dt, .05) * 60;
    const trafficPose = {
      x: c.x,
      y: c.y,
      angle: c.angle,
      turn: c.turn ? {
        ...c.turn
      } : null
    };
    advanceTrafficCar(c, frame, ctx.trafficCars);
    if (ctx.trafficTouchesResponder(c)) {
      Object.assign(c, trafficPose);
      c.speed = 0;
      c.collisionHold = .3;
    }
  });
  const previousIncident = ctx.cityIncidentDirector?.current();
  if (previousIncident) previousIncident.responsePending = [...ctx.incidentPoliceCars, ...ctx.incidentResponseVehicles, ...ctx.airMedicalVehicles].some(unit => unit.responseIncidentId === previousIncident.id && unit.status !== 'returning' && unit.status !== 'landing' && unit.status !== 'climbingReturn');
  const incident = ctx.driveLab?.running ? null : ctx.cityIncidentDirector?.update(dt, {
    player: ctx.player,
    people: ctx.pedestrians
  }) || null;
  updateCrowdReactions(ctx.pedestrians, incident, dt);
  if (incident && ctx.incidentNoticeId !== incident.id && ctx.env.Math.hypot(ctx.player.x - incident.x, ctx.player.y - incident.y) < 1100) {
    ctx.incidentNoticeId = incident.id;
    ctx.showToast(`⚠️ ${incident.title}: прохожие реагируют на происшествие`);
  }
  if (incident?.reported) {
    const dispatched = ctx.dispatchIncidentPolice(incident);
    if (dispatched && !incident.reportNoticeShown && ctx.env.Math.hypot(ctx.player.x - incident.x, ctx.player.y - incident.y) < 1400) {
      incident.reportNoticeShown = true;
      ctx.showToast('📞 Свидетель сообщил о происшествии · патруль направлен');
    }
    const services = ctx.dispatchIncidentResponse(incident);
    if (services && !incident.serviceNoticeShown && ctx.env.Math.hypot(ctx.player.x - incident.x, ctx.player.y - incident.y) < 1400) {
      incident.serviceNoticeShown = true;
      const names = incident.respondingServices.map(type => type === 'fireEngine' ? 'пожарная бригада' : 'скорая помощь').join(' и ');
      ctx.showToast(`🚒 Вызваны: ${names}`);
    }
  }
  ctx.updateIncidentPolice(dt);
  ctx.updateIncidentResponse(dt);
  if (incident?.reported && ctx.dispatchAirMedicalResponse(incident) && ctx.env.Math.hypot(ctx.player.x - incident.x, ctx.player.y - incident.y) < 1400) ctx.showToast('🚁 Санитарный вертолёт направлен к пострадавшему');
  ctx.updateAirMedicalResponse(dt);
  ctx.updatePedestrians(dt);
  ctx.updatePoliceAI(dt);
  const stuntVehicles = [...ctx.trafficCars, ...ctx.policeCars, ...ctx.incidentPoliceCars, ...ctx.incidentResponseVehicles];
  stuntVehicles.forEach(vehicle => ctx.updateStuntVehicle(vehicle, dt));
  ctx.resolveCityMotion(motionStarts, dt);
  ctx.stepWaterInteraction(dt);
  ctx.stepWorldEffects(dt);
  if (ctx.player.hp <= 0) ctx.respawnPlayer(ctx.roam?.mode==='foot'?'потеря сознания':'тяжёлая авария');
  const speedKmh = ctx.env.Math.abs(ctx.player.speed) * 12;
  if (!ctx.roam?.special) ctx.player.gear = ctx.player.speed < -0.1 ? 'R' : speedKmh < 30 ? 'D1' : speedKmh < 60 ? 'D2' : speedKmh < 95 ? 'D3' : speedKmh < 130 ? 'D4' : 'D5';
  ctx.player.rpm = ctx.env.Math.min(1.0, speedKmh % 35 / 35 + 0.2);
  ctx.sound.update(ctx.player.rpm, ctx.player.speed);
  const distEl = ctx.env.document.getElementById('hudDistrict');
  if (distEl) {
    const district = ctx.districtAt(ctx.player.x, ctx.player.y) || ctx.islets.find(i => pointInCoast(ctx.player.x, ctx.player.y, i));
    distEl.innerText = (district?.name || 'LOWTOWN CAUSEWAY').toUpperCase();
  }
};
}
