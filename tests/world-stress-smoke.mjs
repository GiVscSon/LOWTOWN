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
const link = (a, b) => {
  if (!a || !b || a === b) return;
  const aa = adj.get(key(a.x, a.y)), bb = adj.get(key(b.x, b.y));
  if (aa && !aa.includes(b)) aa.push(b);
  if (bb && !bb.includes(a)) bb.push(a);
};
for (const n of nodes) for (const [dx, dy] of [[GRID,0],[-GRID,0],[0,GRID],[0,-GRID]]) {
  const m = byKey.get(key(n.x + dx, n.y + dy));
  if (m && corridor(n, m)) link(n, m);
}
for (const bridge of BRIDGES) {
  const a = byKey.get(key(bridge.a.x, bridge.a.y));
  const b = byKey.get(key(bridge.b.x, bridge.b.y));
  if (a && b && corridor(bridge.a, bridge.b)) link(a, b);
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
function islandNodes(island) {
  return nodes.filter(n => {
    const dx=(n.x-island.center.x)/island.rx;
    const dy=(n.y-island.center.y)/island.ry;
    return dx*dx+dy*dy <= 1;
  });
}

assert.equal(ISLANDS.length, 3);
for (const island of ISLANDS) {
  const local = islandNodes(island);
  assert.ok(local.length >= 10, `island ${island.id} has too few road nodes`);
  const anchor = nearest(island.center);
  assert.ok(anchor && reachable(anchor, anchor), `island ${island.id} has no road access`);
  for (let i=0;i<Math.min(25,local.length);i+=3) {
    assert.ok(reachable(anchor, local[i]), `island ${island.id} road component is disconnected`);
  }
}
for (const bridge of BRIDGES) {
  assert.equal(isLand(bridge.a.x, bridge.a.y), true, `${bridge.id} start not land`);
  assert.equal(isLand(bridge.b.x, bridge.b.y), true, `${bridge.id} end not land`);
  assert.ok(corridor(bridge.a, bridge.b), `${bridge.id} corridor blocked`);
  assert.ok(reachable(bridge.a, bridge.b), `${bridge.id} endpoints not connected by road graph`);
}

let tested = 0;
const failures = [];
for (const island of ISLANDS) {
  const local = islandNodes(island);
  const stride = Math.max(1, Math.floor(local.length / 25));
  const samples = local.filter((_,i) => i % stride === 0).slice(0,25);
  for (const a of samples) for (const b of samples) {
    tested++;
    if (!reachable(a,b)) failures.push({island:island.id,a,b});
  }
}
assert.equal(failures.length, 0, `road route failures: ${failures.length}/${tested}`);
console.log('WORLD_STRESS_OK', JSON.stringify({nodes:nodes.length, roadRoutePairs:tested, islands:ISLANDS.map(i=>i.id), bridges:BRIDGES.map(b=>b.id)}));
