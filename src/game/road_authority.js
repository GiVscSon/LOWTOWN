export const ROAD_GRID=160;
export const ROAD_LIMIT=2720;
export const ROAD_WIDTH=92;
export const ROAD_HALF_WIDTH=ROAD_WIDTH/2;
export const ROAD_EDGE_TOLERANCE=8;
const DIRECTIONS=[[ROAD_GRID,0],[-ROAD_GRID,0],[0,ROAD_GRID],[0,-ROAD_GRID]];
const distanceToSegment=(x,y,a,b)=>{const dx=b.x-a.x,dy=b.y-a.y,len2=dx*dx+dy*dy||1,t=Math.max(0,Math.min(1,((x-a.x)*dx+(y-a.y)*dy)/len2)),px=a.x+dx*t,py=a.y+dy*t;return{x:px,y:py,t,distance:Math.hypot(x-px,y-py)};};
export function buildRoadNetwork({isLand,blocked,limit=ROAD_LIMIT,grid=ROAD_GRID}={}){const nodes=[],map=new Map(),open=(x,y)=>typeof isLand==='function'&&isLand(x,y)&&!(typeof blocked==='function'&&blocked(x,y));for(let x=-limit;x<=limit;x+=grid)for(let y=-limit;y<=limit;y+=grid){if(!open(x,y))continue;const node={x,y,id:`road:${x}:${y}`,links:[]};nodes.push(node);map.set(`${x},${y}`,node);}const corridor=(a,b)=>{for(let i=1;i<=16;i++){const t=i/16;if(!open(a.x+(b.x-a.x)*t,a.y+(b.y-a.y)*t))return false;}return true;};for(const node of nodes)for(const[dx,dy]of DIRECTIONS){const next=map.get(`${node.x+dx},${node.y+dy}`);if(next&&corridor(node,next))node.links.push(next);}globalThis.__LOWTOWN_CITY_GRAPH=nodes;return nodes;}
export function roadSegments(nodes=[]){const seen=new Set(),segments=[];for(const a of nodes)for(const b of a.links){const key=a.id<b.id?`${a.id}|${b.id}`:`${b.id}|${a.id}`;if(seen.has(key))continue;seen.add(key);segments.push([a,b]);}globalThis.__LOWTOWN_ROAD_LINES=segments;return segments;}
export function nearestRoadPoint(x,y,nodes=[]){let best=null;for(const[a,b]of roadSegments(nodes)){const hit=distanceToSegment(x,y,a,b);if(!best||hit.distance<best.distance)best={x:hit.x,y:hit.y,distance:hit.distance,heading:Math.atan2(b.y-a.y,b.x-a.x),a,b,t:hit.t};}return best;}
export function snapToRoad(point,nodes=[]){const hit=nearestRoadPoint(Number(point?.x)||0,Number(point?.y)||0,nodes);if(!hit)return null;return{x:hit.x,y:hit.y,heading:hit.heading,distance:hit.distance,node:hit.a,segment:[hit.a,hit.b],t:hit.t};}
export function isNearRoad(x,y,nodes=[],radius=ROAD_HALF_WIDTH){const hit=nearestRoadPoint(x,y,nodes);return!!hit&&hit.distance<=radius;}
export function roadDistance(x,y,nodes=[]){const hit=nearestRoadPoint(x,y,nodes);return hit?hit.distance:Infinity;}
