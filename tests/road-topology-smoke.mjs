import assert from 'node:assert/strict';
import { WORLD } from '../src/game/world.js';
import { ISLANDS, BRIDGES, isLand } from '../src/game/islands.js';

const GRID=160, LIMIT=2720, r=18;
const blocked=(x,y)=>!isLand(x,y)||WORLD.buildings.some(([bx,by,bw,bh])=>x>bx-r&&x<bx+bw+r&&y>by-r&&y<by+bh+r);
const corridor=(a,b)=>{for(let i=1;i<=16;i++){const t=i/16;if(blocked(a.x+(b.x-a.x)*t,a.y+(b.y-a.y)*t))return false;}return true;};
const nodes=[],map=new Map();
for(let x=-LIMIT;x<=LIMIT;x+=GRID)for(let y=-LIMIT;y<=LIMIT;y+=GRID)if(!blocked(x,y)){const n={x,y,id:nodes.length,links:[]};nodes.push(n);map.set(`${x},${y}`,n);}
for(const n of nodes)for(const [dx,dy] of [[GRID,0],[-GRID,0],[0,GRID],[0,-GRID]]){const m=map.get(`${n.x+dx},${n.y+dy}`);if(m&&corridor(n,m))n.links.push(m);}
function nearest(p){return nodes.reduce((best,n)=>!best||Math.hypot(n.x-p.x,n.y-p.y)<Math.hypot(best.x-p.x,best.y-p.y)?n:best,null);}
function reachable(a,b){const start=nearest(a),goal=nearest(b),seen=new Set([start.id]),q=[start];while(q.length){const n=q.shift();if(n.id===goal.id)return true;for(const v of n.links)if(!seen.has(v.id)){seen.add(v.id);q.push(v);}}return false;}
for(const island of ISLANDS){const sample=nearest(island.center);assert.ok(sample,`${island.id} has no road node`);assert.ok(sample.links.length>0,`${island.id} road sample is isolated`);}
for(const b of BRIDGES){assert.equal(blocked(b.a.x,b.a.y),false,`${b.id} start is not drivable`);assert.equal(blocked(b.b.x,b.b.y),false,`${b.id} end is not drivable`);assert.ok(corridor(b.a,b.b),`${b.id} corridor is blocked`);assert.ok(reachable(b.a,b.b),`${b.id} is not connected to road graph`);}
assert.ok(reachable({x:-320,y:-20},{x:1200,y:-420}),'LOWTOWN to mission road path is missing');
assert.ok(reachable({x:-320,y:800},{x:0,y:1360}),'LOWTOWN to NORTH RIDGE road path is missing');
console.log(`ROAD_TOPOLOGY_OK nodes=${nodes.length} islands=${ISLANDS.length} bridges=${BRIDGES.length}`);
