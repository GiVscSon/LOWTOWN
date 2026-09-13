export function createTrafficSystem({ nodes, blocked, seed = 1337 }) {
  let state = seed >>> 0;
  const cars = [];
  const rand = () => { state = (state * 1664525 + 1013904223) >>> 0; return state / 4294967296; };
  const shuffled = [...nodes].sort(() => rand() - 0.5);
  const pick = () => shuffled[(rand() * shuffled.length) | 0];
  const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
  const makeRoute = (start) => {
    const route = [start];
    let cur = start;
    for (let i = 0; i < 10; i++) {
      const choices = nodes.filter(n => dist(n, cur) <= 160.1 && n !== cur);
      if (!choices.length) break;
      cur = choices[(rand() * choices.length) | 0];
      route.push(cur);
    }
    return route;
  };
  for (let i = 0; i < Math.min(14, shuffled.length); i++) {
    const n = shuffled[i];
    cars.push({ x: n.x, y: n.y, a: rand() * Math.PI * 2, v: 70 + rand() * 90, route: makeRoute(n), index: 0, lane: (rand() - .5) * 34, tone: rand() });
  }
  function update(dt, player) {
    for (const car of cars) {
      let target = car.route[car.index];
      if (!target || dist(car, target) < 18) {
        car.route = makeRoute({ x: Math.round(car.x / 160) * 160, y: Math.round(car.y / 160) * 160 });
        car.index = 0;
        target = car.route[0];
      }
      if (!target) continue;
      const desired = Math.atan2(target.y - car.y, target.x - car.x);
      let d = desired - car.a;
      while (d > Math.PI) d -= Math.PI * 2;
      while (d < -Math.PI) d += Math.PI * 2;
      const steer = Math.max(-1, Math.min(1, d * 2.4));
      car.a += steer * 1.7 * dt * Math.min(1, car.v / 50);
      let desiredSpeed = car.v;
      if (Math.abs(d) > .65) desiredSpeed *= .92;
      for (const other of cars) {
        if (other === car) continue;
        const dd = Math.hypot(other.x - car.x, other.y - car.y);
        if (dd < 72) desiredSpeed = Math.min(desiredSpeed, Math.max(0, dd * 1.7));
      }
      if (player) {
        const dd = Math.hypot(player.x - car.x, player.y - car.y);
        if (dd < 58) desiredSpeed = Math.min(desiredSpeed, Math.max(20, dd * 1.3));
      }
      car.v += (desiredSpeed - car.v) * Math.min(1, dt * 2.2);
      const nx = car.x + Math.cos(car.a) * car.v * dt;
      const ny = car.y + Math.sin(car.a) * car.v * dt;
      if (!blocked(nx, ny)) { car.x = nx; car.y = ny; }
      else { car.v *= .25; car.a += (rand() - .5) * 1.4; }
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
      ctx.fillStyle = '#d4523a'; ctx.fillRect(13, -6, 4, 4); ctx.fillRect(13, 2, 4, 4);
      ctx.restore();
    }
  }
  return { cars, update, draw };
}
