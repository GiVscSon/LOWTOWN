import assert from 'node:assert/strict';
import { WORLD } from '../src/game/world.js';
import { ISLANDS, BRIDGES, isLand } from '../src/game/islands.js';

const GRID = 160;
const LIMIT = 2720;
const R = 18;
const blocked = (x, y) => !isLand(x, y) || WORLD.buildings.some(([bx, by, bw, bh]) => x > bx - R && x < bx + bw + R && y > by - R && y < by + bh + R);
const corridor = (a, b) => {
  for (let i = 1; i <= 24; i++) {
    const t = i / 24;
    if (blocked(a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t)) return false;
  }
  return true;
};
const key = (x, y) => `${x},${y}`;
const nodes = [];
for (let y = -LIMIT; y <= LIMIT; y += GRID) for (let x = -LIMIT; x <= LIMIT; x += GRID) if (!blocked(x, y)) nodes.push({ x, y });
const byKey = new Map(nodes.map(n => [key(n.x, n.y), n]));
const adj = new Map(nodes.map(n => [key(n.x, n.y), []]));
for (const n of nodes) for (const [dx, dy] of [[GRID,0],[-GRID,0],[0,GRID],[0,-GRID]]) {
  const m = byKey.get(key(n.x + dx, n.y + dy));
  if (m && corridor(n, m)) adj.get(key(n.x, n.y)).push(m);
}
function nearest(p) {
  return nodes.reduce((best, n) => !best || Math.hypot(n.x-p.x,n.y-p.y) < best.d ? { n, d: Math.hypot(n.x-p.x,n.y-p.y) } : best, null)?.n;
}
function reachable(start, goal) {
  const s = nearest(start), g = nearest(goal); if (!s || !g) return false;
  const q=[s], seen=new Set([key(s.x,s.y)]);
  while(q.length){ const n=q.shift(); if(key(n.x,n.y)===key(g.x,g.y)) return true; for(const m of adj.get(key(n.x,n.y))||[]){const k=key(m.x,m.y);if(!seen.has(k)){seen.add(k);q.push(m);}} }
  return false;
}

assert.equal(ISLANDS.length, 3);
for (const island of ISLANDS) assert.ok(reachable(island.center, island.center), `island ${island.id} has no road access`);
for (const bridge of BRIDGES) {
  assert.equal(isLand(bridge.a.x, bridge.a.y), true, `${bridge.id} start not land`);
  assert.equal(isLand(bridge.b.x, bridge.b.y), true, `${bridge.id} end not land`);
  assert.ok(corridor(bridge.a, bridge.b), `${bridge.id} corridor blocked`);
}

let tested = 0, failures = [];
const candidates = [];
for (let i=0;i<ISLANDS.length;i++) for (let j=0;j<ISLANDS.length;j++) for(let a=0;a<5;a++) for(let b=0;b<5;b++) {
  const A=ISLANDS[i], B=ISLANDS[j];
  candidates.push({x:A.center.x + (a-2)*A.rx*0.28, y:A.center.y + (b-2)*A.ry*0.22}, {x:B.center.x + (b-2)*B.rx*0.28, y:B.center.y + (a-2)*B.ry*0.22});
}
for (let i=0;i<candidates.length;i+=2) { tested++; if(!reachable(candidates[i], candidates[i+1])) failures.push([candidates[i],candidates[i+1]]); }
assert.equal(failures.length, 0, `random route failures: ${failures.length}/${tested}`);
console.log('WORLD_STRESS_OK', JSON.stringify({nodes:nodes.length, routePairs:tested, islands:ISLANDS.map(i=>i.id), bridges:BRIDGES.map(b=>b.id)}));
