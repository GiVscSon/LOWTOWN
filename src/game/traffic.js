export function createTrafficSystem({ nodes, blocked, seed = 1337 }) {
  let state = seed >>> 0;
  const cars = [];
  const rand = () => { state = (state * 1664525 + 1013904223) >>> 0; return state / 4294967296; };
  const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
  const pickNode = () => nodes[(rand() * nodes.length) | 0];
  const routeFrom = start => {
    const route = [start];
    let cur = start;
    const seen = new Set([cur.id]);
    for (let i = 0; i < 14; i++) {
      const choices = cur.links.filter(n => !seen.has(n.id));
      if (!choices.length) break;
      cur = choices[(rand() * choices.length) | 0];
      route.push(cur); seen.add(cur.id);
    }
    return route;
  };
  const lanePoint = (node, next, lane) => {
    if (!next) return { x: node.x, y: node.y };
    const dx = next.x - node.x, dy = next.y - node.y, len = Math.hypot(dx, dy) || 1;
    return { x: node.x - dy / len * lane, y: node.y + dx / len * lane };
  };
  const occupied = (n, player) => cars.some(c => dist(c, n) < 110) || (player && dist(player, n) < 180);
  for (let i = 0; i < Math.min(14, nodes.length); i++) {
    let n = pickNode(), tries = 0;
    while (occupied(n) && tries++ < 30) n = pickNode();
    const next = n.links[0];
    cars.push({ x: n.x, y: n.y, a: next ? Math.atan2(next.y - n.y, next.x - n.x) : rand() * Math.PI * 2, v: 75 + rand() * 65, targetSpeed: 110 + rand() * 70, route: routeFrom(n), index: 1, lane: (rand() < .5 ? -1 : 1) * 22, tone: rand(), stuck: 0, brake: 0 });
  }
  function update(dt, player) {
    for (const car of cars) {
      let node = car.route[car.index], next = car.route[car.index + 1];
      if (!node || dist(car, node) < 22) {
        if (node) car.index++;
        if (!car.route[car.index]) {
          const start = car.route.at(-1) || pickNode();
          car.route = routeFrom(start); car.index = 1;
        }
        node = car.route[car.index]; next = car.route[car.index + 1];
      }
      if (!node) continue;
      const aim = lanePoint(node, next || node, car.lane);
      const desired = Math.atan2(aim.y - car.y, aim.x - car.x);
      let d = desired - car.a;
      while (d > Math.PI) d -= Math.PI * 2;
      while (d < -Math.PI) d += Math.PI * 2;
      const steer = Math.max(-1, Math.min(1, d * 2.7));
      car.a += steer * 1.9 * dt * Math.min(1, car.v / 45);
      let desiredSpeed = car.targetSpeed * (1 - Math.min(.7, Math.abs(d) * .5));
      if (Math.abs(d) > .9) desiredSpeed *= .62;
      let lead = Infinity;
      for (const other of cars) {
        if (other === car) continue;
        const dx = other.x - car.x, dy = other.y - car.y;
        const ahead = dx * Math.cos(car.a) + dy * Math.sin(car.a);
        const side = Math.abs(-dx * Math.sin(car.a) + dy * Math.cos(car.a));
        if (ahead > 0 && ahead < 105 && side < 30) lead = Math.min(lead, ahead);
      }
      if (player) {
        const dx = player.x - car.x, dy = player.y - car.y;
        const ahead = dx * Math.cos(car.a) + dy * Math.sin(car.a);
        const side = Math.abs(-dx * Math.sin(car.a) + dy * Math.cos(car.a));
        if (ahead > 0 && ahead < 90 && side < 34) lead = Math.min(lead, ahead);
      }
      if (lead < 80) desiredSpeed = Math.min(desiredSpeed, Math.max(0, (lead - 18) * 2.4));
      car.brake += (desiredSpeed < car.v ? 1 : -2) * dt;
      car.brake = Math.max(0, Math.min(1, car.brake));
      car.v += (desiredSpeed - car.v) * Math.min(1, dt * (desiredSpeed < car.v ? 4.5 : 1.7));
      const nx = car.x + Math.cos(car.a) * car.v * dt, ny = car.y + Math.sin(car.a) * car.v * dt;
      if (!blocked(nx, ny)) { car.x = nx; car.y = ny; car.stuck = 0; }
      else { car.v *= .35; car.a += (rand() - .5) * .8; car.stuck += dt; }
      if (car.stuck > 1.5) {
        const n = pickNode(); car.x = n.x; car.y = n.y; car.route = routeFrom(n); car.index = 1; car.stuck = 0;
      }
    }
  }
  function draw(ctx, iso) {
    for (const car of cars) {
      const p = iso(car.x, car.y);
      ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(-car.a - .15);
      ctx.fillStyle = 'rgba(0,0,0,.55)'; ctx.fillRect(-20, -11, 40, 22);
      ctx.fillStyle = car.tone < .28 ? '#b7b9bd' : car.tone < .52 ? '#6d7379' : car.tone < .76 ? '#3d4146' : '#d4523a';
      ctx.fillRect(-17, -8, 34, 16);
      ctx.fillStyle = '#17191c'; ctx.fillRect(-8, -6, 15, 12);
      ctx.fillStyle = car.brake > .35 ? '#f06a4d' : '#d4523a'; ctx.fillRect(13, -6, 4, 4); ctx.fillRect(13, 2, 4, 4);
      ctx.restore();
    }
  }
  return { cars, update, draw };
}
