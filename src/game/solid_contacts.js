// Oriented chassis contacts shared by moving cars and static city geometry.
export function chassis(car) {
  return { x: car.x, y: car.y, angle: car.angle || 0,
    length: car.width || 48, breadth: car.height || 24 };
}
export function contact(a, b) {
  const axes = [a.angle, a.angle + Math.PI / 2, b.angle, b.angle + Math.PI / 2];
  let depth = Infinity, normal;
  for (const angle of axes) {
    const nx = Math.cos(angle), ny = Math.sin(angle);
    const radius = o => Math.abs(Math.cos(o.angle - angle)) * o.length / 2 + Math.abs(Math.sin(o.angle - angle)) * o.breadth / 2;
    const distance = (a.x - b.x) * nx + (a.y - b.y) * ny;
    const overlap = radius(a) + radius(b) - Math.abs(distance);
    if (overlap <= 0) return null;
    if (overlap < depth) { depth = overlap; normal = { x: nx * (distance < 0 ? -1 : 1), y: ny * (distance < 0 ? -1 : 1) }; }
  }
  return { ...normal, depth };
}
export function resolveContact(a, b, fixed = false) {
  const hit = contact(chassis(a), chassis(b));
  if (!hit) return false;
  const share = fixed ? 1 : 0.5;
  a.x += hit.x * (hit.depth + 0.02) * share;
  a.y += hit.y * (hit.depth + 0.02) * share;
  if (!fixed) { b.x -= hit.x * (hit.depth + 0.02) * share; b.y -= hit.y * (hit.depth + 0.02) * share; }
  for (const car of fixed ? [a] : [a, b]) {
    if (Number.isFinite(car.speed)) car.speed *= 0.35;
    if (Number.isFinite(car.vx)) car.vx *= 0.35;
    if (Number.isFinite(car.vy)) car.vy *= 0.35;
  }
  return true;
}
export function resolveScenery(car, buildings, trees = [], props = []) {
  let hit = false;
  for (const b of buildings) {
    if (Math.abs(car.x - b.x - b.w / 2) > b.w / 2 + 40 || Math.abs(car.y - b.y - b.h / 2) > b.h / 2 + 40) continue;
    hit = resolveContact(car, { x: b.x + b.w / 2, y: b.y + b.h / 2, width: b.w, height: b.h }, true) || hit;
  }
  for (const tree of trees) if (Math.hypot(car.x - tree.x, car.y - tree.y) < 45)
    hit = resolveContact(car, { x: tree.x, y: tree.y, width: 12, height: 12 }, true) || hit;
  for (const prop of props) {
    const width=prop.width||12,height=prop.height||12;
    if(Math.abs(car.x-prop.x)>width*.5+45||Math.abs(car.y-prop.y)>height*.5+45)continue;
    hit=resolveContact(car,{x:prop.x,y:prop.y,width,height,angle:prop.angle||0},true)||hit;
  }
  return hit;
}
