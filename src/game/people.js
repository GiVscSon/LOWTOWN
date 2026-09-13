import { PED_ASSETS } from './assets.js';
import { sidewalkPoint, pedestrianRoute } from './city_semantics.js';

export function createPeopleSystem({ nodes, blocked, seed = 4242, city = false }) {
  let state = seed >>> 0;
  const people = [];
  const activeNodes=(globalThis.__LOWTOWN_CITY_GRAPH?.length?globalThis.__LOWTOWN_CITY_GRAPH:nodes);
  const useSemantic=city||activeNodes.some(n=>n?.roadId);
  const rand = () => { state = (state * 1664525 + 1013904223) >>> 0; return state / 4294967296; };
  const pick = () => activeNodes[(rand() * activeNodes.length) | 0];
  const sprite = key => { const i = new Image(); i.src = PED_ASSETS[key]; return i; };
  const sprites = { civilian: sprite('civilian'), runner: sprite('runner') };
  const makeTarget = n => useSemantic && n?.roadId ? sidewalkPoint(n.roadId, n.index, rand() < .5 ? -1 : 1) : n;
  const makeRoute = (p, target) => useSemantic && target?.x != null ? pedestrianRoute({x:p.x,y:p.y},{x:target.x,y:target.y}) : [target];
  for (let i = 0; i < Math.min(48, activeNodes.length); i++) {
    const n = pick(), target = makeTarget(pick());
    people.push({ x:n.x+(rand()-.5)*28, y:n.y+(rand()-.5)*28, a:rand()*Math.PI*2, v:22+rand()*20, state:'walk', timer:rand()*4, tone:rand(), target, route:makeRoute({x:n.x,y:n.y},target), waypoint:0, panic:0 });
  }
  function chooseTarget(p){const target=makeTarget(pick());p.target=target;p.route=makeRoute(p,target);p.waypoint=0;p.timer=2+rand()*5;p.state=rand()<.18?'idle':'walk';}
  function update(dt, player, danger = 0) {
    for (const p of people) {
      p.timer -= dt; const pd = player ? Math.hypot(player.x-p.x,player.y-p.y) : Infinity;
      if (danger > 0 && pd < 260) p.panic=Math.min(1,p.panic+dt*2.5); else p.panic=Math.max(0,p.panic-dt*.8);
      if (p.timer<=0 || Math.hypot(p.target.x-p.x,p.target.y-p.y)<24 || (p.route.length && p.waypoint>=p.route.length)) chooseTarget(p);
      if(p.state==='idle'&&p.panic<.2)continue;
      let goal=p.route[p.waypoint]||p.target;
      if(goal&&Math.hypot(goal.x-p.x,goal.y-p.y)<20){p.waypoint++;goal=p.route[p.waypoint]||p.target;}
      let desired=goal?Math.atan2(goal.y-p.y,goal.x-p.x):p.a;
      if(p.panic>.2&&pd<260)desired=Math.atan2(p.y-player.y,p.x-player.x);
      let d=desired-p.a; while(d>Math.PI)d-=Math.PI*2; while(d<-Math.PI)d+=Math.PI*2; p.a+=Math.max(-1,Math.min(1,d*3))*dt*3;
      const v=p.v*(p.panic>.2?2.1:1),nx=p.x+Math.cos(p.a)*v*dt,ny=p.y+Math.sin(p.a)*v*dt;
      if(!blocked(nx,ny)){p.x=nx;p.y=ny}else{p.a+=(rand()-.5)*2;p.timer=0;}
    }
  }
  function draw(ctx, iso, player) { for(const p of people){const q=iso(p.x,p.y),near=player&&Math.hypot(player.x-p.x,player.y-p.y)<260,image=sprites[p.panic>.2?'runner':'civilian'];ctx.save();ctx.translate(q.x,q.y);ctx.rotate(-p.a);if(image.complete)ctx.drawImage(image,-12,-16,24,18);else{ctx.fillStyle='#596068';ctx.fillRect(-3,-7,6,11);}if(p.panic>.2&&near){ctx.fillStyle='#e8b84a';ctx.font='9px monospace';ctx.textAlign='center';ctx.fillText('RUN!',0,-20)}ctx.restore();} }
  return { people, update, draw };
}
