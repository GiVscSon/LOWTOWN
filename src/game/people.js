export function createPeopleSystem({ nodes, blocked, seed = 4242 }) {
  let state = seed >>> 0;
  const people = [];
  const rand = () => { state = (state * 1664525 + 1013904223) >>> 0; return state / 4294967296; };
  const pick = () => nodes[(rand() * nodes.length) | 0];
  for (let i = 0; i < Math.min(28, nodes.length); i++) {
    const n = pick();
    people.push({ x: n.x + (rand() - .5) * 70, y: n.y + (rand() - .5) * 70, a: rand() * Math.PI * 2, v: 22 + rand() * 20, state: 'walk', timer: rand() * 4, tone: rand(), target: pick(), panic: 0 });
  }
  function update(dt, player, danger = 0) {
    for (const p of people) {
      p.timer -= dt;
      const pd = player ? Math.hypot(player.x - p.x, player.y - p.y) : Infinity;
      if (danger > 0 && pd < 260) p.panic = Math.min(1, p.panic + dt * 2.5);
      else p.panic = Math.max(0, p.panic - dt * .8);
      if (p.timer <= 0 || Math.hypot(p.target.x - p.x, p.target.y - p.y) < 24) {
        p.target = pick(); p.timer = 2 + rand() * 5;
        p.state = rand() < .18 ? 'idle' : 'walk';
      }
      if (p.state === 'idle' && p.panic < .2) continue;
      const dx = p.target.x - p.x, dy = p.target.y - p.y;
      let desired = Math.atan2(dy, dx);
      if (p.panic > .2 && pd < 260) desired = Math.atan2(p.y - player.y, p.x - player.x);
      let d = desired - p.a;
      while (d > Math.PI) d -= Math.PI * 2;
      while (d < -Math.PI) d += Math.PI * 2;
      p.a += Math.max(-1, Math.min(1, d * 3)) * dt * 3;
      const v = p.v * (p.panic > .2 ? 2.1 : 1);
      const nx = p.x + Math.cos(p.a) * v * dt, ny = p.y + Math.sin(p.a) * v * dt;
      if (!blocked(nx, ny)) { p.x = nx; p.y = ny; }
      else { p.a += (rand() - .5) * 2; p.timer = 0; }
    }
  }
  function draw(ctx, iso, player) {
    for (const p of people) {
      const q = iso(p.x, p.y), near = player && Math.hypot(player.x - p.x, player.y - p.y) < 240;
      ctx.save(); ctx.translate(q.x, q.y); ctx.rotate(-p.a);
      ctx.fillStyle = 'rgba(0,0,0,.42)'; ctx.beginPath(); ctx.ellipse(0, 5, 6, 3, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = p.tone < .34 ? '#b7b9bd' : p.tone < .67 ? '#596068' : '#8b4f3f'; ctx.fillRect(-3, -7, 6, 11);
      ctx.fillStyle = near ? '#d9b08c' : '#8e7564'; ctx.beginPath(); ctx.arc(0, -10, 3, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = p.panic > .2 ? '#e8b84a' : '#24272b'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(-2, 4); ctx.lineTo(-3, 9); ctx.moveTo(2, 4); ctx.lineTo(3, 9); ctx.stroke();
      ctx.restore();
    }
  }
  return { people, update, draw };
}
