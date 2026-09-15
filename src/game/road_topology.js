export const ROAD_LEVELS = Object.freeze({ LOWER: 0, STREET: 1, UPPER: 2 });
export const ROAD_LEVEL_Z = Object.freeze({ 0: 0, 1: 34, 2: 68 });
export const ROAD_LEVEL_NAMES = Object.freeze({ 0: 'LOWER', 1: 'STREET', 2: 'UPPER' });

const DIRS = [[1,0],[-1,0],[0,1],[0,-1]];
const key = (x,y,l) => `${x}:${y}:${l}`;
const clamp = (v,a,b) => Math.max(a,Math.min(b,v));

function addNode(map,nodes,x,y,level){
  const k=key(x,y,level); if(map.has(k)) return map.get(k);
  const n={x,y,level,z:ROAD_LEVEL_Z[level]||0,id:`road:${x}:${y}:L${level}`,links:[]};
  map.set(k,n); nodes.push(n); return n;
}

function segmentClear(a,b,isLand,blocked,level){
  for(let i=1;i<=20;i++){
    const t=i/20, x=a.x+(b.x-a.x)*t, y=a.y+(b.y-a.y)*t;
    if(typeof isLand==='function' && !isLand(x,y)) return false;
    if(level===ROAD_LEVELS.STREET && typeof blocked==='function' && blocked(x,y,level)) return false;
  }
  return true;
}

export function buildLayeredRoadTopology({isLand=()=>true,blocked=()=>false,limit=2720,grid=160}={}){
  const nodes=[],map=new Map();
  // Three independent decks share XY coordinates but never share collision space.
  for(const level of [ROAD_LEVELS.LOWER,ROAD_LEVELS.STREET,ROAD_LEVELS.UPPER]){
    for(let x=-limit;x<=limit;x+=grid) for(let y=-limit;y<=limit;y+=grid){
      if(segmentClear({x,y},{x,y},isLand,blocked,level)) addNode(map,nodes,x,y,level);
    }
  }
  for(const n of nodes){
    for(const [sx,sy] of DIRS){
      const m=map.get(key(n.x+sx*grid,n.y+sy*grid,n.level));
      if(m && segmentClear(n,m,isLand,blocked,n.level)) n.links.push(m);
    }
  }
  // Explicit ramps are the only places where a vehicle changes level.
  const rampPoints=[[-320,0],[640,160],[960,-320],[-960,480],[320,800]];
  for(const [x,y] of rampPoints){
    const lo=map.get(key(x,y,0)), mid=map.get(key(x,y,1)), hi=map.get(key(x,y,2));
    if(lo&&mid){lo.links.push(mid);mid.links.push(lo);}
    if(mid&&hi){mid.links.push(hi);hi.links.push(mid);}
  }
  globalThis.__LOWTOWN_LAYERED_ROAD_GRAPH=nodes;
  // Legacy traffic/city actors stay on the street deck until they gain level awareness.
  globalThis.__LOWTOWN_CITY_GRAPH=nodes.filter(n=>n.level===ROAD_LEVELS.STREET);
  return nodes;
}

export function layeredRoadSegments(nodes=[]){
  const seen=new Set(), out=[];
  for(const a of nodes) for(const b of a.links){
    const k=a.id<b.id?`${a.id}|${b.id}`:`${b.id}|${a.id}`;
    if(seen.has(k)) continue; seen.add(k); out.push([a,b]);
  }
  return out;
}

export function nearestLayeredRoadPoint(x,y,nodes=[],level=ROAD_LEVELS.STREET){
  let best=null;
  for(const [a,b] of layeredRoadSegments(nodes)){
    if(a.level!==level || b.level!==level) continue;
    const dx=b.x-a.x,dy=b.y-a.y,len2=dx*dx+dy*dy||1;
    const t=clamp(((x-a.x)*dx+(y-a.y)*dy)/len2,0,1);
    const px=a.x+dx*t,py=a.y+dy*t,d=Math.hypot(x-px,y-py);
    if(!best||d<best.distance) best={x:px,y:py,distance:d,heading:Math.atan2(dy,dx),level,t,a,b};
  }
  return best;
}

export function nearestAnyRoadPoint(x,y,nodes=[]){
  let best=null;
  for(const level of [0,1,2]){
    const hit=nearestLayeredRoadPoint(x,y,nodes,level);
    if(hit && (!best||hit.distance<best.distance)) best=hit;
  }
  return best;
}

export function roadLevelAt(x,y,nodes=[],fallback=ROAD_LEVELS.STREET){
  return nearestAnyRoadPoint(x,y,nodes)?.level ?? fallback;
}

export function canOccupyRoadLevel(x,y,level,nodes=[],halfWidth=46){
  const hit=nearestLayeredRoadPoint(x,y,nodes,level);
  return !!hit && hit.distance<=halfWidth;
}

export function levelTransitionAt(x,y,nodes=[],radius=62){
  for(const n of nodes){
    const link=n.links.find(m=>m.level!==n.level);
    if(link && Math.hypot(x-n.x,y-n.y)<=radius) return {from:n.level,to:link.level,x:n.x,y:n.y};
  }
  return null;
}
