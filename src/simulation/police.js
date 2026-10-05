import {pursuitTarget,tryPit,updatePursuitAir,pursuitAirSees,setRoadblock} from './pursuit_tactics.js';
// One shared runtime context owns state; this system has no hidden globals.
export function installSimulationPolice(ctx){
const {onRoadSurface,roadPath}=ctx.dependencies;
ctx.wantedPoliceBase = function wantedPoliceBase(role) {
  const match = role === 'nationalGuard' ? /national\s+guard|armory/i : /police\s+precinct|police\s+station/i;
  return ctx.buildings.find(building => match.test(building.sign || '')) || null;
};
ctx.spawnWantedPoliceUnit = function spawnWantedPoliceUnit(role) {
  if (!ctx.roadGraph.length) return false;
  const definitions = {
    patrol: {
      model: 'police',
      width: 48,
      height: 24,
      maxSpeed: 4.3,
      turnRate: .085,
      acceleration: .08
    },
    tactical: {
      model: 'armoredPolice',
      width: 62,
      height: 32,
      maxSpeed: 3.75,
      turnRate: .068,
      acceleration: .065
    },
    nationalGuard: {
      model: 'nationalGuard',
      width: 72,
      height: 38,
      maxSpeed: 3.25,
      turnRate: .055,
      acceleration: .05
    }
  };
  const definition = definitions[role];
  if (!definition) return false;
  let start,
    route,
    responseBase = '';
  const candidateUnit = (node, path) => {
    const next = path[1] || path[0];
    return {
      ...definition,
      role,
      x: node.x,
      y: node.y,
      angle: ctx.env.Math.atan2(next.y - node.y, next.x - node.x)
    };
  };
  if (role === 'patrol') {
    for (let attempt = 0; attempt < 24; attempt++) {
      const angle = ctx.env.Math.random() * ctx.env.Math.PI * 2,
        distance = 600 + ctx.env.Math.random() * 200;
      const target = {
        x: ctx.player.x + ctx.env.Math.cos(angle) * distance,
        y: ctx.player.y + ctx.env.Math.sin(angle) * distance
      };
      const node = ctx.nearestRoadNode(target);
      if (!node || !ctx.isPositionOnSolidGround(node.x, node.y) || !onRoadSurface(node.x, node.y, ctx.roads, ctx.bridges, ctx.scenicRoads, ctx.roadEnds) || ctx.isPedestrianBlocked(node.x, node.y) || ctx.env.Math.hypot(node.x - ctx.player.x, node.y - ctx.player.y) <= 250) continue;
      const path = roadPath(ctx.roadGraph, node, ctx.player);
      if (!path.length || !ctx.policeFootprintOnRoad(candidateUnit(node, path))) continue;
      start = node;
      route = path;
      break;
    }
  } else {
    const base = ctx.wantedPoliceBase(role);
    if (!base) return false;
    responseBase = base.sign;
    const basePoint = {
      x: base.x + base.w * .5,
      y: base.y + base.h * .5
    };
    const candidates = ctx.roadGraph.map(node => ({
      node,
      distance: ctx.env.Math.hypot(node.x - basePoint.x, node.y - basePoint.y)
    })).filter(entry => entry.distance < 520).sort((a, b) => a.distance - b.distance);
    for (const {
      node
    } of candidates) {
      const path = roadPath(ctx.roadGraph, node, ctx.player);
      if (!path.length || !ctx.policeFootprintOnRoad(candidateUnit(node, path))) continue;
      start = node;
      route = path;
      break;
    }
    if (!start) return false;
  }
  if (!start || !route?.length) return false;
  const next = route[1] || route[0];
  const unit = {
    ...definition,
    role,
    responseBase,
    x: start.x,
    y: start.y,
    angle: ctx.env.Math.atan2(next.y - start.y, next.x - start.x),
    speed: 0,
    route,
    routeTimer: 0,
    contactCooldown: 0,
    strobePhase: ctx.env.Math.random() * ctx.env.Math.PI * 2
  };
  if (!ctx.policeFootprintOnRoad(unit)) return false;
  ctx.policeCars.push(unit);
  if (role === 'tactical' && !ctx.state.tacticalCallDispatched) {
    ctx.state.tacticalCallDispatched = true;
    ctx.showToast('🚔 SWAT НАПРАВЛЕНА ОТ ГОРОДСКОГО УЧАСТКА');
  }
  if (role === 'nationalGuard' && !ctx.state.guardCallDispatched) {
    ctx.state.guardCallDispatched = true;
    ctx.showToast('⚠️ НАЦИОНАЛЬНАЯ ГВАРДИЯ ВЫЕХАЛА ИЗ АРСЕНАЛА');
  }
  return true;
};
ctx.returnWantedPoliceToBase = function returnWantedPoliceToBase(unit) {
  setRoadblock(ctx,unit,false);
  if (!ctx.policeFootprintOnRoad(unit)) return;
  const kinds = unit.role === 'nationalGuard' ? ['guardBase'] : ['police'];
  const bases = ctx.serviceBases.filter(base => kinds.includes(base.kind)).sort((a, b) => ctx.env.Math.hypot(a.origin.x - unit.x, a.origin.y - unit.y) - ctx.env.Math.hypot(b.origin.x - unit.x, b.origin.y - unit.y));
  const base = bases.find(base => !unit.responseBase || base.building.sign === unit.responseBase) || bases[0];
  if (!base) return;
  unit.baseTarget = {
    ...base.origin
  };
  unit.responseBase = base.building.sign;
  unit.responseIncidentId = null;
  unit.arrived = false;
  ctx.beginIncidentResponseReturn(unit);
  if (!unit.removeAfterScene) ctx.incidentPoliceCars.push(unit);
};
ctx.releaseWantedPolice = function releaseWantedPolice() {
  for (const unit of ctx.policeCars) ctx.returnWantedPoliceToBase(unit);
  ctx.policeCars.length = 0;
  ctx.pursuitAirUnit=null;ctx.state.pursuitLastKnown=null;
};
ctx.reconcilePoliceRoster = function reconcilePoliceRoster(profile) {
  const desired = [['patrol', profile.patrolCount], ['tactical', profile.tacticalCount], ['nationalGuard', profile.guardCount]];
  for (const [role, count] of desired) {
    let units = ctx.policeCars.filter(unit => (unit.role || 'patrol') === role).length;
    for (let i = ctx.policeCars.length - 1; i >= 0 && units > count; i--) {
      if ((ctx.policeCars[i].role || 'patrol') === role) {
        ctx.returnWantedPoliceToBase(ctx.policeCars[i]);
        ctx.policeCars.splice(i, 1);
        units--;
      }
    }
    for (let attempt = 0; units < count && attempt < count * 2; attempt++) {
      if (ctx.spawnWantedPoliceUnit(role)) units++;else if (role !== 'patrol') break;
    }
  }
};
ctx.policeFootprintOnRoad = function policeFootprintOnRoad(unit) {
  const halfLength = (unit.width || 48) * .5,
    halfWidth = (unit.height || 24) * .5;
  const cs = ctx.env.Math.cos(unit.angle),
    sn = ctx.env.Math.sin(unit.angle);
  return onRoadSurface(unit.x, unit.y, ctx.roads, ctx.bridges, ctx.scenicRoads, ctx.roadEnds) && [[halfLength, halfWidth], [halfLength, -halfWidth], [-halfLength, halfWidth], [-halfLength, -halfWidth]].every(([x, y]) => onRoadSurface(unit.x + x * cs - y * sn, unit.y + x * sn + y * cs, ctx.roads, ctx.bridges, ctx.scenicRoads, ctx.roadEnds));
};
ctx.updatePoliceAI = function updatePoliceAI(dt) {
  const frame = ctx.env.Math.min(ctx.env.Math.max(Number(dt) || 0, 0), .05) * 60;
  if (!frame) return;
  ctx.state.wantedCooldown = ctx.env.Math.max(0, (ctx.state.wantedCooldown || 0) - ctx.env.Math.max(0, dt));
  const evadeCard = ctx.env.document.getElementById('evadeStatusCard');
  const wantedPill = ctx.env.document.getElementById('wantedBadge');
  if (ctx.state.wanted === 0) {
    ctx.releaseWantedPolice();
    ctx.state.detainProgress = 0;
    ctx.state.tacticalCallDispatched = false;
    ctx.state.guardCallDispatched = false;
    if (evadeCard) evadeCard.style.display = 'none';
    if (wantedPill) {
      wantedPill.classList.remove('active', 'evading');
    }
    return;
  }
  updatePursuitAir(ctx,dt);
  const response = ctx.wantedResponseProfile(ctx.state.wanted);
  ctx.reconcilePoliceRoster(response);
  let anyCopSees = false;
  let canDetain = false;
  for (let i = ctx.policeCars.length - 1; i >= 0; i--) {
    const cop = ctx.policeCars[i];
    cop.strobePhase += .3 * frame;
    cop.contactCooldown = ctx.env.Math.max(0, (cop.contactCooldown || 0) - ctx.env.Math.max(0, dt));
    if (!ctx.isPositionOnSolidGround(cop.x, cop.y)) {
      ctx.policeCars.splice(i, 1);
      continue;
    }
    const initialDistance = ctx.env.Math.hypot(ctx.player.x - cop.x, ctx.player.y - cop.y);
    if (initialDistance < 450) {
      anyCopSees = true;
      if (cop.role && cop.role !== 'patrol') cop.hasMadeContact = true;
    }
    cop.routeTimer = (cop.routeTimer || 0) - dt;
    if (cop.routeTimer <= 0 && !cop.emergencyManeuver || !cop.route?.length) {
      const objective=pursuitTarget(ctx,cop,i);
      cop.route = roadPath(ctx.roadGraph, cop, objective, {
        fromSegment: true
      });
      cop.routeTimer = 2;
    }
    while (cop.route.length > 1 && ctx.env.Math.hypot(cop.route[0].x - cop.x, cop.route[0].y - cop.y) < (cop.width || 48) * .58) cop.route.shift();
    const standoff = ((cop.width || 48) + (ctx.roam?.mode === 'foot' ? 16 : ctx.player.width || 48)) / 2 + 26;
    const targetMoving = ctx.roam?.mode === 'foot' ? (ctx.player.gait || 0) > .1 : ctx.env.Math.abs(ctx.player.speed || 0) > 1;
    const atLastNode = cop.route.length === 1 && ctx.env.Math.hypot(cop.route[0].x - cop.x, cop.route[0].y - cop.y) < 22;
    const holding = (cop.tactic==='roadblock'&&atLastNode) || !targetMoving && (initialDistance < standoff || atLastNode);
    if (holding) {
      cop.status = cop.tactic==='roadblock'?'roadblock':'containing';
      cop.speed = 0;
      cop.emergencyManeuver = null;
      cop.emergencyBlocked = false;
      setRoadblock(ctx,cop,cop.tactic==='roadblock');
      if (initialDistance < standoff && (ctx.roam?.altitude || 0) < 12 && ctx.state.invulnTimer === 0) canDetain = true;
    } else {
      setRoadblock(ctx,cop,false);
      cop.status = 'enroute';
      ctx.tryPlanEmergencyPassing(cop, dt);
      if (cop.emergencyManeuver) {
        ctx.advanceServiceRoute(cop, dt);
      } else {
        const target = cop.route[0] || cop;
        const targetAng = ctx.env.Math.atan2(target.y - cop.y, target.x - cop.x);
        let diff = targetAng - cop.angle;
        while (diff < -ctx.env.Math.PI) diff += ctx.env.Math.PI * 2;
        while (diff > ctx.env.Math.PI) diff -= ctx.env.Math.PI * 2;
        const oldAngle = cop.angle;
        const maxSpeed = cop.maxSpeed || 4.3;
        cop.angle += ctx.env.Math.sign(diff) * ctx.env.Math.min(ctx.env.Math.abs(diff), (cop.turnRate || .085) * frame * ctx.env.Math.min(1, ctx.env.Math.max(.18, ctx.env.Math.abs(cop.speed) / maxSpeed)));
        const arrivalSpeed = cop.route.length === 1 ? ctx.env.Math.min(1, ctx.env.Math.hypot(target.x - cop.x, target.y - cop.y) / 60) : 1;
        const desired = (ctx.env.Math.abs(diff) > .45 ? maxSpeed * .4 : maxSpeed) * arrivalSpeed;
        cop.speed += (desired - cop.speed) * (1 - ctx.env.Math.pow(1 - (cop.acceleration || .08), frame));
        const ox = cop.x,
          oy = cop.y;
        cop.x += ctx.env.Math.cos(cop.angle) * cop.speed * frame;
        cop.y += ctx.env.Math.sin(cop.angle) * cop.speed * frame;
        if (!ctx.policeFootprintOnRoad(cop)) {
          cop.x = ox;
          cop.y = oy;
          cop.speed = 0;
          cop.routeTimer = 0;
          if (!ctx.policeFootprintOnRoad(cop)) cop.angle = oldAngle;
        }
        if (cop.emergencyBlocked || !ctx.emergencyPassingPoseClear(cop, cop)) {
          cop.x = ox;
          cop.y = oy;
          cop.angle = oldAngle;
          cop.speed = 0;
        }
      }
    }
    tryPit(ctx,cop,dt);
    const distance = ctx.env.Math.hypot(ctx.player.x - cop.x, ctx.player.y - cop.y);
    if (distance < 450) {
      anyCopSees = true;
      if (cop.role && cop.role !== 'patrol') cop.hasMadeContact = true;
    }
    const contactRadius = 34 + (cop.width || 48) * .04;
    if (distance < contactRadius) {
      const impactSpeed = ctx.player.speed || 0;
      const velocityX = ctx.env.Math.cos(ctx.player.angle || 0) * impactSpeed,
        velocityY = ctx.env.Math.sin(ctx.player.angle || 0) * impactSpeed;
      const toward = (velocityX * (cop.x - ctx.player.x) + velocityY * (cop.y - ctx.player.y)) / ctx.env.Math.max(1, ctx.env.Math.hypot(velocityX, velocityY) * distance);
      if (ctx.env.Math.abs(impactSpeed) > 3.2 && toward > .62) ctx.raiseWantedFromCrime(5, 6);
      ctx.player.speed *= .75;
      if (cop.contactCooldown <= 0 && ctx.state.invulnTimer === 0) {
        ctx.player.hp = ctx.env.Math.max(0, ctx.player.hp - 8);
        cop.contactCooldown = .65;
        ctx.sound.playImpact();
      }
    }
  }
  ctx.state.detainProgress = canDetain ? (ctx.state.detainProgress || 0) + dt : ctx.env.Math.max(0, (ctx.state.detainProgress || 0) - dt * 2);
  if (canDetain && ctx.state.detainProgress <= dt) ctx.showToast('🚨 Полиция блокирует машину · уезжайте, чтобы избежать задержания');
  if (ctx.state.detainProgress >= 3) {
    ctx.respawnPlayer('задержание');
    return;
  }
  if(pursuitAirSees(ctx))anyCopSees=true;
  if(anyCopSees)ctx.state.pursuitLastKnown={x:ctx.player.x,y:ctx.player.y};
  const backupStillResponding = ctx.state.wanted >= 4 && ctx.policeCars.some(unit => unit.role && unit.role !== 'patrol' && !unit.hasMadeContact);
  if (anyCopSees || backupStillResponding) {
    ctx.state.evading = false;
    ctx.state.evadeTimer = 5.0;
    if (evadeCard) evadeCard.style.display = 'none';
    if (wantedPill) {
      wantedPill.classList.remove('evading');
      wantedPill.classList.add('active');
    }
  } else {
    ctx.state.evading = true;
    ctx.state.evadeTimer -= dt;
    if (evadeCard) {
      evadeCard.style.display = 'flex';
      const cd = ctx.env.document.getElementById('evadeCountdown');
      if (cd) cd.innerText = ctx.env.Math.max(0, ctx.state.evadeTimer).toFixed(1);
    }
    if (wantedPill) wantedPill.classList.add('evading');
    if (ctx.state.evadeTimer <= 0) {
      ctx.state.wanted = 0;
      ctx.state.wantedCooldown = 0;
      ctx.state.evading = false;
      ctx.releaseWantedPolice();
      ctx.state.tacticalCallDispatched = false;
      ctx.state.guardCallDispatched = false;
      if (evadeCard) evadeCard.style.display = 'none';
      if (wantedPill) wantedPill.classList.remove('active', 'evading');
      ctx.showToast('🛡️ ПОГОНЯ ОКОНЧЕНА! РОЗЫСК СНЯТ');
    }
  }
};
}
