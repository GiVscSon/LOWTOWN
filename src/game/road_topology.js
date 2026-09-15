import { buildCityGraph } from './city_semantics.js';

export const ROAD_LEVELS = Object.freeze({ LOWER: 0, STREET: 1, UPPER: 2 });
export const ROAD_LEVEL_Z = Object.freeze({ 0: 0, 1: 34, 2: 68 });
export const ROAD_LEVEL_NAMES = Object.freeze({ 0: 'LOWER', 1: 'STREET', 2: 'UPPER' });

const clamp = (v,a,b) => Math.max(a,Math.min(b,v));

export function buildLayeredRoadTopology(){
  // The city semantic graph is now the single source of truth for drivable streets.
  // The old procedural grid could create roads that disagreed with the visible city.
  const source=buildCityGraph();
  const byId=new Map();
  const nodes=source.map(n=>{
    const out={...n,level:ROAD_LEVELS.STREET,z:ROAD_LEVEL_Z[ROAD_LEVELS.STREET]};
    byId.set(out.id,out);
    return out;
  });
  for(const sourceNode of source){
    const node=byId.get(sourceNode.id);
    node.links=(sourceNode.links||[]).map(link=>byId.get(link.id)).filter(Boolean);
  }
  globalThis.__LOWTOWN_LAYERED_ROAD_GRAPH=nodes;
  globalThis.__LOWTOWN_CITY_GRAPH=nodes;
  return nodes;
}

export function layeredRoadSegments(nodes=[]){
  const seen=new Set(),out=[];
  for(const a of nodes) for(const b of a.links){
    const k=a.id<b.id?`${a.id}|${b.id}`:`${b.id}|${a.id}`;
    if(seen.has(k))continue;
    seen.add(k);out.push([a,b]);
  }
  return out;
}

export function nearestLayeredRoadPoint(x,y,nodes=[],level=ROAD_LEVELS.STREET){
  let best=null;
  for(const [a,b] of layeredRoadSegments(nodes)){
    if(a.level!==level||b.level!==level)continue;
    const dx=b.x-a.x,dy=b.y-a.y,len2=dx*dx+dy*dy||1;
    const t=clamp(((x-a.x)*dx+(y-a.y)*dy)/len2,0,1);
    const px=a.x+dx*t,py=a.y+dy*t,d=Math.hypot(x-px,y-py);
    if(!best||d<best.distance)best={x:px,y:py,distance:d,heading:Math.atan2(dy,dx),level,t,a,b};
  }
  return best;
}

export function nearestAnyRoadPoint(x,y,nodes=[]){
  return nearestLayeredRoadPoint(x,y,nodes,ROAD_LEVELS.STREET);
}

export function roadLevelAt(x,y,nodes=[],fallback=ROAD_LEVELS.STREET){
  return nearestAnyRoadPoint(x,y,nodes)?.level??fallback;
}

export function canOccupyRoadLevel(x,y,level,nodes=[],halfWidth=46){
  const hit=nearestLayeredRoadPoint(x,y,nodes,level);
  return !!hit&&hit.distance<=halfWidth;
}

export function levelTransitionAt(){
  return null;
}
