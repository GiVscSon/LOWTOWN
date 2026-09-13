import { WORLD } from '../src/game/world.js';
import { ISLANDS, BRIDGES, isLand } from '../src/game/islands.js';

const GRID = 160, LIMIT = 2720, R = 18;
const blocked = (x,y) => !isLand(x,y) || WORLD.buildings.some(([bx,by,bw,bh]) => x > bx-R && x < bx+bw+R && y > by-R && y < by+bh+R);
const key = (x,y) => `${x},${y}`;
const corridor = (a,b) => { for(let i=1;i<=24;i++){ const t=i/24; if(blocked(a.x+(b.x-a.x)*t,a.y+(b.y-a.y)*t)) return false; } return true; };
const nodes=[];
for(let y=-LIMIT;y<=LIMIT;y+=GRID) for(let x=-LIMIT;x<=LIMIT;x+=GRID) if(!blocked(x,y)) nodes.push({x,y});
const map=new Map(nodes.map(n=>[key(n.x,n.y),n]));
const adj=new Map(nodes.map(n=>[key(n.x,n.y),[]]));
for(const n of nodes) for(const [dx,dy] of [[GRID,0],[-GRID,0],[0,GRID],[0,-GRID]]) { const m=map.get(key(n.x+dx,n.y+dy)); if(m&&corridor(n,m)) adj.get(key(n.x,n.y)).push(m); }
const nearest=p=>nodes.reduce((best,n)=>!best||Math.hypot(n.x-p.x,n.y-p.y)<best.d?{n,d:Math.hypot(n.x-p.x,n.y-p.y)}:best,null)?.n;
function component(start){const s=nearest(start);if(!s)return new Set();const q=[s],seen=new Set([key(s.x,s.y)]);while(q.length){const n=q.shift();for(const m of adj.get(key(n.x,n.y))||[]){const k=key(m.x,m.y);if(!seen.has(k)){seen.add(k);q.push(m);}}}return seen;}
function reachable(a,b){const s=nearest(a),g=nearest(b);if(!s||!g)return false;return component(s).has(key(g.x,g.y));}
const samples=[];
for(const island of ISLANDS){const c=component(island.center);samples.push({island:island.id,nodeCount:c.size,centerNode:nearest(island.center)});}
const islandPairs=[];
for(let i=0;i<ISLANDS.length;i++)for(let j=i+1;j<ISLANDS.length;j++) islandPairs.push({a:ISLANDS[i].id,b:ISLANDS[j].id,reachable:reachable(ISLANDS[i].center,ISLANDS[j].center)});
const candidates=[];
for(let i=0;i<ISLANDS.length;i++)for(let j=0;j<ISLANDS.length;j++)for(let a=0;a<5;a++)for(let b=0;b<5;b++){
 const A=ISLANDS[i],B=ISLANDS[j];
 candidates.push({from:A.id,to:B.id,a:{x:A.center.x+(a-2)*A.rx*.28,y:A.center.y+(b-2)*A.ry*.22},b:{x:B.center.x+(b-2)*B.rx*.28,y:B.center.y+(a-2)*B.ry*.22}});
}
const failures=candidates.filter(c=>!reachable(c.a,c.b));
const bridges=BRIDGES.map(b=>({id:b.id,startIsland:ISLANDS.find(i=>isLand(b.a.x,b.a.y))?.id||'WATER',endIsland:ISLANDS.find(i=>isLand(b.b.x,b.b.y))?.id||'WATER',corridor:corridor(b.a,b.b),reachable:reachable(b.a,b.b)}));
const report={nodes:nodes.length,samples,islandPairs,failedRoutes:failures.slice(0,30),failureCount:failures.length,totalRoutes:candidates.length,bridges};
console.log(JSON.stringify(report,null,2));
