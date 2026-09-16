import { CITY_ROADS, CITY_DISTRICTS, CITY_DESTINATIONS, roadPoint, buildCityGraph } from './city_semantics.js';
import { buildJunctionGraph } from './city_graph_junctions.js';
import { visualHalfWidth } from './road_geometry.js';

const CITY_GRAPH = buildCityGraph();
if (typeof globalThis !== 'undefined') globalThis.__LOWTOWN_CITY_GRAPH = CITY_GRAPH;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
function hash(x, y, n = 0) { const v = Math.sin(x * 12.9898 + y * 78.233 + n * 37.719) * 43758.5453; return v - Math.floor(v); }
const BRIDGE_ROADS = new Set(['NORTH_BRIDGE_ROAD', 'HARBOR_LINK']);

function blockPavement(ctx, iso) {
  const xs = [-1960, -760, -120, 640, 1020, 1500, 2100];
  const ys = [-1160, -600, -360, 80, 600, 1240];
  ctx.save();
  for (let i = 0; i < xs.length - 1; i++) {
    for (let j = 0; j < ys.length - 1; j++) {
      const x0 = xs[i] + 12, y0 = ys[j] + 12, x1 = xs[i + 1] - 12, y1 = ys[j + 1] - 12;
      if (x1 - x0 < 48 || y1 - y0 < 48) continue;
      const p = [iso(x0, y0), iso(x1, y0), iso(x1, y1), iso(x0, y1)];
      ctx.fillStyle = '#14161a';
      ctx.beginPath(); p.forEach((q, n) => n ? ctx.lineTo(q.x, q.y) : ctx.moveTo(q.x, q.y)); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = 'rgba(0,0,0,.4)'; ctx.lineWidth = 1; ctx.stroke();
    }
  }
  ctx.restore();
}

function buildingDetails(ctx, iso, b, t) {
  const [x, y, w, h] = b;
  const seed = hash(x, y, w + h);
  const z = 0;
  const height = clamp(48 + Math.max(w, h) * 0.16, 54, 98);
  const base = [iso(x, y, z), iso(x + w, y, z), iso(x + w, y + h, z), iso(x, y + h, z)];
  const roof = base.map(p => ({ x: p.x, y: p.y - height }));

  ctx.save();
  ctx.lineJoin = 'round';

  // 1. South-East Wall (Facing Camera Right): base[1]->base[2]->roof[2]->roof[1]
  ctx.fillStyle = seed > 0.5 ? '#1a1d20' : '#16181b';
  ctx.beginPath();
  ctx.moveTo(base[1].x, base[1].y);
  ctx.lineTo(base[2].x, base[2].y);
  ctx.lineTo(roof[2].x, roof[2].y);
  ctx.lineTo(roof[1].x, roof[1].y);
  ctx.closePath();
  ctx.fill();

  // 2. South-West Wall (Facing Camera Left): base[3]->base[2]->roof[2]->roof[3]
  ctx.fillStyle = seed > 0.5 ? '#232629' : '#1e2124';
  ctx.beginPath();
  ctx.moveTo(base[3].x, base[3].y);
  ctx.lineTo(base[2].x, base[2].y);
  ctx.lineTo(roof[2].x, roof[2].y);
  ctx.lineTo(roof[3].x, roof[3].y);
  ctx.closePath();
  ctx.fill();

  // Wall Edges
  ctx.strokeStyle = 'rgba(5,7,9,0.85)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(base[2].x, base[2].y); ctx.lineTo(roof[2].x, roof[2].y);
  ctx.moveTo(base[1].x, base[1].y); ctx.lineTo(roof[1].x, roof[1].y);
  ctx.moveTo(base[3].x, base[3].y); ctx.lineTo(roof[3].x, roof[3].y);
  ctx.stroke();

  // 3. Roof on top of walls
  ctx.fillStyle = seed > 0.78 ? '#35383c' : '#2b2e32';
  ctx.beginPath();
  roof.forEach((p, i) => i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y));
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = 'rgba(224,154,62,0.18)';
  ctx.stroke();

  // Roof machinery / AC units
  if (w > 100 && h > 85) {
    const rx = roof[0].x * 0.4 + roof[2].x * 0.6;
    const ry = roof[0].y * 0.4 + roof[2].y * 0.6;
    ctx.fillStyle = '#181a1d';
    ctx.fillRect(rx - 8, ry - 5, 16, 9);
    ctx.strokeStyle = 'rgba(154,160,168,0.3)';
    ctx.strokeRect(rx - 8, ry - 5, 16, 9);
  }

  // Neon sign atop roof
  if (seed > 0.72 && w > 90) {
    const sx = (roof[3].x + roof[2].x) * 0.5;
    const sy = (roof[3].y + roof[2].y) * 0.5 - 6;
    ctx.fillStyle = '#0b0d10';
    ctx.fillRect(sx - 18, sy - 8, 36, 12);
    ctx.strokeStyle = 'rgba(224,154,62,0.5)';
    ctx.strokeRect(sx - 18, sy - 8, 36, 12);
    ctx.fillStyle = 'rgba(224,154,62,0.85)';
    ctx.font = 'bold 6px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(seed > 0.86 ? 'MOTEL' : 'LOWTOWN', sx, sy);
  }

  ctx.restore();
  void t;
}

function strokeRoad(ctx, iso, road, width, color) {
  ctx.beginPath(); road.points.forEach(([x, y], i) => { const p = iso(x, y); i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y); });
  ctx.strokeStyle = color; ctx.lineWidth = width; ctx.stroke();
}

function roadGeometry(ctx, iso) {
  const roads = [...CITY_ROADS].sort((a, b) => (BRIDGE_ROADS.has(a.id) ? 1 : 0) - (BRIDGE_ROADS.has(b.id) ? 1 : 0));
  for (const road of roads) {
    const width = visualHalfWidth(road) * 2;
    ctx.save(); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    strokeRoad(ctx, iso, road, width + 14, 'rgba(3,5,7,.9)');
    strokeRoad(ctx, iso, road, width, road.class === 'ARTERIAL' ? '#36393d' : '#292c30');
    strokeRoad(ctx, iso, road, width * .38, 'rgba(94,99,103,.16)');
    ctx.setLineDash(road.oneWay ? [22, 13] : [15, 20]);
    strokeRoad(ctx, iso, road, 2, 'rgba(224,154,62,.38)');
    ctx.setLineDash([]);
    ctx.restore();
  }
}

function junctionPlates(ctx, iso) {
  const { junctions } = buildJunctionGraph();
  ctx.save();
  for (const junction of junctions) {
    const p = iso(junction.x, junction.y);
    ctx.fillStyle = '#2f3236';
    ctx.beginPath(); ctx.ellipse(p.x, p.y, 28, 16, 0, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = 'rgba(224,154,62,.3)'; ctx.lineWidth = 1.5; ctx.stroke();
  }
  ctx.restore();
}

function crosswalks(ctx, iso) {
  const { junctions } = buildJunctionGraph();
  const keys = new Set(junctions.map(j => `${j.x}:${j.y}`));
  ctx.save(); ctx.strokeStyle = 'rgba(210,207,197,.34)'; ctx.lineWidth = 2;
  for (const road of CITY_ROADS) {
    for (const [x, y] of road.points) {
      if (!keys.has(`${x}:${y}`)) continue;
      const p = iso(x, y);
      for (let s = -2; s <= 2; s++) { ctx.beginPath(); ctx.moveTo(p.x + s * 5 - 8, p.y - 5); ctx.lineTo(p.x + s * 5 + 8, p.y + 5); ctx.stroke(); }
    }
  }
  ctx.restore();
}

function streetAtmosphere(ctx, iso, lamps, t) {
  const seen = new Set();
  ctx.save();
  for (let i = 0; i < lamps.length; i++) {
    const [x, y] = lamps[i];
    const key = `${Math.round(x / 80)}:${Math.round(y / 80)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const p = iso(x, y), pulse = 0.92 + 0.08 * Math.sin(t * 2.4 + i * 0.73), r = clamp(24 * pulse, 16, 28);
    const g = ctx.createRadialGradient(p.x, p.y - 34, 1, p.x, p.y - 34, r);
    g.addColorStop(0, 'rgba(255,219,145,.28)');
    g.addColorStop(0.35, 'rgba(224,154,62,.12)');
    g.addColorStop(1, 'rgba(224,154,62,0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(p.x, p.y - 34, r, 0, Math.PI * 2); ctx.fill();
  }
  ctx.restore();
}

function roadLabels(ctx, iso) {
  ctx.save(); ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  for (const road of CITY_ROADS) { const mid = Math.floor((road.points.length - 1) / 2), p = roadPoint(road.id, mid, road.lanes * 18 + 18); if (!p) continue; const q = iso(p.x, p.y); ctx.translate(q.x, q.y - 8); ctx.rotate(-p.heading * .55); ctx.font = road.class === 'ARTERIAL' ? 'bold 8px monospace' : '7px monospace'; ctx.fillStyle = 'rgba(224,154,62,.72)'; ctx.shadowColor = 'rgba(0,0,0,.9)'; ctx.shadowBlur = 3; ctx.fillText(road.name.toUpperCase(), 0, 0); ctx.setTransform(1, 0, 0, 1, 0, 0); }
  ctx.restore();
}

function districtLabels(ctx, iso) {
  ctx.save(); ctx.textAlign = 'center';
  for (const district of CITY_DISTRICTS) { const p = iso(district.center.x, district.center.y); ctx.fillStyle = 'rgba(7,9,11,.68)'; ctx.fillRect(p.x - 54, p.y - 11, 108, 20); ctx.strokeStyle = 'rgba(224,154,62,.26)'; ctx.strokeRect(p.x - 54, p.y - 11, 108, 20); ctx.fillStyle = 'rgba(154,160,168,.78)'; ctx.font = 'bold 7px monospace'; ctx.fillText(district.name.toUpperCase(), p.x, p.y + 2); }
  ctx.restore();
}

function destinationSigns(ctx, iso) {
  for (const d of CITY_DESTINATIONS) { const p = roadPoint(d.roadId, d.index, (CITY_ROADS.find(r => r.id === d.roadId)?.lanes || 2) * 14 + 30); if (!p) continue; const q = iso(p.x, p.y); ctx.fillStyle = 'rgba(7,9,11,.86)'; ctx.fillRect(q.x - 31, q.y - 29, 62, 12); ctx.strokeStyle = 'rgba(224,154,62,.22)'; ctx.strokeRect(q.x - 31, q.y - 29, 62, 12); ctx.fillStyle = 'rgba(190,194,196,.78)'; ctx.font = '6px monospace'; ctx.textAlign = 'center'; ctx.fillText(d.name.toUpperCase(), q.x, q.y - 20); }
}

export function createCityVisuals() {
  return {
    version: 'CITY_NETWORK_8', draw(ctx, iso, buildings, lamps, t) {
      blockPavement(ctx, iso);
      roadGeometry(ctx, iso);
      junctionPlates(ctx, iso);
      const sortedBuildings = [...buildings].sort((a, b) => (a[1] + a[3]) - (b[1] + b[3]));
      for (const b of sortedBuildings) buildingDetails(ctx, iso, b, t);
      crosswalks(ctx, iso);
      streetAtmosphere(ctx, iso, lamps, t);
      roadLabels(ctx, iso);
      districtLabels(ctx, iso);
      destinationSigns(ctx, iso);
    }
  };
}
