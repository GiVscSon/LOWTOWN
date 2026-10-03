// One shared runtime context owns state; this system has no hidden globals.
export function installSimulationContacts(ctx){
const {VEHICLES,chassis,solveVehicleMotion}=ctx.dependencies;
ctx.cityCollisionBodies = function cityCollisionBodies() {
  const incident = ctx.cityIncidentDirector?.current();
  return [...new Set([ctx.player, ...ctx.trafficCars, ...ctx.parkedCars, ...ctx.policeCars, ...ctx.incidentPoliceCars, ...ctx.incidentResponseVehicles, ...(ctx.roam?.fleet || []), ...ctx.pedestrians, ...(incident?.actors || []), ...(incident?.wrecks || []), ...ctx.breakableProps.filter(p => p.type === 'dumpster')])];
};
ctx.resolveCityMotion = function resolveCityMotion(starts, dt) {
  const incident = ctx.cityIncidentDirector?.current();
  const people = new Set([...ctx.pedestrians, ...(incident?.actors || []), ...(ctx.roam?.mode === 'foot' ? [ctx.player] : [])]);
  const passive = new Set([...ctx.parkedCars, ...(ctx.roam?.fleet || []), ...(incident?.wrecks || []), ...ctx.breakableProps.filter(p => p.type === 'dumpster')]);
  const airborne = ctx.roam?.mode !== 'foot' && (ctx.roam?.altitude > 12 || ctx.stuntHeightFor(ctx.player) >= 16);
  const bodies = ctx.cityCollisionBodies().filter(body => body !== ctx.player || !airborne);
  for (const body of bodies) if (!people.has(body)) body.mass ||= body.type === 'dumpster' ? 130 : VEHICLES[body.type]?.mass || (/fire|truck|bus/i.test(body.model || '') ? 5200 : body.model === 'ambulance' ? 2400 : 1500);
  const water = body => body === ctx.player ? ctx.roam?.profile?.kind === 'water' : body.kind === 'water';
  const services = new Set([...ctx.policeCars, ...ctx.incidentPoliceCars, ...ctx.incidentResponseVehicles]);
  const dent = (body, nx, ny) => {
    if (!bodies.includes(body) || people.has(body) || body.type === 'dumpster') return;
    const cs = ctx.env.Math.cos(body.angle || 0),
      sn = ctx.env.Math.sin(body.angle || 0),
      forward = nx * cs + ny * sn,
      side = -nx * sn + ny * cs;
    const panel = ctx.env.Math.abs(forward) > ctx.env.Math.abs(side) ? forward > 0 ? 'front' : 'rear' : side > 0 ? 'right' : 'left';
    body.damage ||= {};
    body.damage[panel] = ctx.env.Math.min(1, (body.damage[panel] || 0) + .35);
  };
  const impact = (a, b, speed, normal) => {
    const person = people.has(a) ? a : people.has(b) ? b : null,
      vehicle = person === a ? b : a;
    if (person) {
      // A walking person's velocity must never turn scenery or a stationary
      // car into a striking vehicle. Use the vehicle's motion into the person.
      if (normal.fixed || people.has(vehicle) || vehicle.type === 'dumpster' || !bodies.includes(vehicle)) return;
      const motion = person === a ? normal.velocityB : normal.velocityA,
        sign = person === a ? 1 : -1;
      const approach = sign * (motion.x * normal.x + motion.y * normal.y);
      speed = ctx.env.Math.min(speed, approach);
      if (speed < .6 || person.hitCooldown > 0) return;
      person.hitCooldown = 2;
      person.stance = 'down';
      person.knockdownTimer = ctx.env.Math.min(5, 1.2 + speed * .4);
      person.hp = ctx.env.Math.max(0, (person.hp ?? 100) - ctx.env.Math.min(80, ctx.env.Math.round(speed * 10)));
      person.activity = 'recovering';
      person.activityRemaining = 0;
      person.conversationPartner = null;
      if (vehicle === ctx.player && ctx.roam?.mode !== 'foot') {
        ctx.raiseWantedFromCrime(3, 1.25);
        ctx.showToast('🚨 Наезд на пешехода · человек сбит с ног');
      }
      if (person === ctx.player) {
        ctx.state.invulnTimer = 24;
        ctx.sound.playImpact();
        ctx.showToast('⚠️ Вас сбила машина');
      } else person.reaction = 'fleeing';
      vehicle.collisionHold = ctx.env.Math.max(vehicle.collisionHold || 0, .7);
      return;
    }
    for (const prop of [a, b]) if (prop.type === 'hydrant' && prop.intact && speed > 1.25) {
      prop.intact = false;
      ctx.sound.playPropBreak();
      ctx.showToast('💦 ГИДРАНТ РАЗБИТ!');
      for (let i = 0; i < 20; i++) ctx.waterSplashes.push({
        x: prop.x,
        y: prop.y,
        vx: (ctx.env.Math.random() - .5) * 3,
        vy: -ctx.env.Math.random() * 5,
        size: 5 + ctx.env.Math.random() * 6,
        alpha: .9
      });
    }
    for (const body of [a, b]) if (ctx.trafficCars.includes(body) || services.has(body)) body.collisionHold = ctx.env.Math.max(body.collisionHold || 0, .45);
    if (speed > 1.5) {
      dent(a, -normal.x, -normal.y);
      if (!normal.fixed) dent(b, normal.x, normal.y);
      for (const body of [a, b]) if (body !== ctx.player && bodies.includes(body) && body.type !== 'dumpster') body.hp = ctx.env.Math.max(0, (body.hp ?? 100) - ctx.env.Math.min(18, ctx.env.Math.round(speed * 1.5)));
    }
    if ((a === ctx.player || b === ctx.player) && speed > 1.5 && ctx.state.invulnTimer === 0) {
      ctx.player.hp = ctx.env.Math.max(0, ctx.player.hp - ctx.env.Math.min(18, ctx.env.Math.max(2, ctx.env.Math.round(speed * 1.5))));
      ctx.state.invulnTimer = 24;
      ctx.sound.playImpact();
      const other = a === ctx.player ? b : a;
      if ((ctx.trafficCars.includes(other) || services.has(other)) && ctx.env.Math.abs(ctx.player.speed) > .75 && ctx.state.wanted === 0) ctx.setWanted(1);
    }
  };
  ctx.pedestrianSceneryIndex = ctx.getCityScenery().pedestrians;
  solveVehicleMotion(bodies.filter(b => !water(b)), starts, dt, {
    buildings: ctx.buildings,
    trees: ctx.trees,
    sceneryIndex: ctx.getCityScenery().contacts,
    people,
    passive,
    player: ctx.player,
    onImpact: impact,
    isEnabled: body => body.type !== 'hydrant' || body.intact,
    canOccupy: (body, pose, person) => {
      if (person) return !ctx.isPedestrianSceneryBlocked(pose.x, pose.y);
      if (services.has(body) && ctx.serviceFootprintSupported(body)) return ctx.serviceFootprintSupported(pose);
      return ctx.isPositionOnSolidGround(pose.x, pose.y);
    }
  });
  const vessels = bodies.filter(water);
  for (const unit of services) if (['enroute', 'returning'].includes(unit.status)) ctx.recoverServiceRoad(unit);
  if (vessels.length) solveVehicleMotion(vessels, starts, dt, {
    passive,
    player: ctx.player,
    onImpact: impact,
    canOccupy: (body, pose) => {
      const c = chassis(pose),
        cs = ctx.env.Math.cos(c.angle),
        sn = ctx.env.Math.sin(c.angle);
      return [[0, 0], [-1, -1], [-1, 1], [1, -1], [1, 1]].every(([x, y]) => !ctx.isPositionOnWaterObstacle(c.x + x * cs * c.length / 2 - y * sn * c.breadth / 2, c.y + x * sn * c.length / 2 + y * cs * c.breadth / 2));
    }
  });
};
}
