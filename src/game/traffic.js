import { VEHICLE_ASSETS } from './assets.js';
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const angleDelta=(target,current)=>{let d=target-current;while(d>Math.PI)d-=Math.PI*2;while(d<-Math.PI)d+=Math.PI*2;return d;};
export function createTrafficSystem({nodes,blocked,seed=1337}){
 let state=seed>>>0;const cars=[],images={};Object.entries(VEHICLE_ASSETS).forEach(([k,src])=>{const i=new Image();i.src=src;images[k]=i});
 const params=new URLSearchParams(location.search);let scenario=null;try{const raw=params.get('scenario');if(raw)scenario=JSON.parse(raw)}catch{}
 const density=Number.isFinite(Number(scenario?.trafficDensity))?clamp(Number(scenario.trafficDensity),0,1):null;
 const leadSpeed=Number.isFinite(Number(scenario?.leadSpeed))?Math.max(25,Number(scenario.leadSpeed)):null;
 const activeNodes=(globalThis.__LOWTOWN_CITY_GRAPH?.length?globalThis.__LOWTOWN_CITY_GRAPH:nodes);
 const rand=()=>{state=(state*1664525+1013904223)>>>0;return state/4294967296};
 const dist=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
 const pickFree=(origin,minDist=150)=>{let best=null,bd=Infinity;for(const n of activeNodes){if(origin&&dist(n,origin)<minDist)continue;if(blocked(n.x,n.y))continue;if(cars.some(c=>dist(c,n)<55))continue;const d=origin?dist(n,origin):0;if(!best||d<bd){best=n;bd=d;}}return best||activeNodes.find(n=>!blocked(n.x,n.y)&&!cars.some(c=>dist(c,n)<55))||null;};
 function chooseNext(current,previous){const choices=(current?.links||[]).filter(n=>!previous||n.id!==previous.id);if(!choices.length)return current?.links?.[0]||null;if(!previous)return choices[0];const incoming=Math.atan2(current.y-previous.y,current.x-previous.x);let best=choices[0],score=-Infinity;for(const n of choices){const out=Math.atan2(n.y-current.y,n.x-current.x),turn=Math.abs(angleDelta(out,incoming)),straight=1-turn/Math.PI,roadBonus=n.roadId===current.roadId?.35:0,scoreNow=straight*2+roadBonus+rand()*.08;if(scoreNow>score){score=scoreNow;best=n;}}return best;}
 const buildRoute=start=>{const route=[start];let prev=null,current=start;for(let i=0;i<24;i++){const next=chooseNext(current,prev);if(!next||route.some(n=>n.id===next.id))break;route.push(next);prev=current;current=next;}return route;};
 const lane=(n,next,l)=>{if(!next)return{x:n.x,y:n.y};const dx=next.x-n.x,dy=next.y-n.y,len=Math.hypot(dx,dy)||1;return{x:n.x-dy/len*l,y:n.y+dx/len*l};};
 const types=[['sedan',95,145],['coupe',110,165],['taxi',105,150],['police',120,175],['van',80,120],['truck',65,105]];
 const count=density===null?9:Math.max(5,Math.min(24,Math.round(5+density*19)));
 for(let i=0;i<count;i++){const n=pickFree(null,0)||activeNodes[(i*7+((rand()*activeNodes.length)|0))%activeNodes.length],t=types[(rand()*types.length)|0],nx=n?.links?.[0],v=leadSpeed===null?t[1]+rand()*(t[2]-t[1]):Math.max(25,leadSpeed*(.9+rand()*.2));cars.push({x:n.x,y:n.y,a:nx?Math.atan2(nx.y-n.y,nx.x-n.x):0,v,targetSpeed:v,route:buildRoute(n),index:1,lane:(rand()<.5?-1:1)*17,type:t[0],stuck:0,brake:0,siren:0,roadId:n.roadId||null,hitAt:0,hold:0,recovery:0,yield:0});}
 globalThis.__LOWTOWN_TRAFFIC_CARS=cars;let collisions=[];
 function update(dt,player,event=null){collisions=[];const now=performance.now();
  for(const c of cars){
   let n=c.route[c.index],next=c.route[c.index+1];
   if(!n||dist(c,n)<20){const previous=c.route[Math.max(0,c.index-1)];if(n)c.index++;if(!c.route[c.index]){const start=pickFree(c,100)||c.route.at(-1);c.route=buildRoute(start);c.index=1;}n=c.route[c.index];next=c.route[c.index+1];if(n)c.a=Math.atan2(n.y-c.y,n.x-c.x);}
   if(!n)continue;
   c.roadId=n.roadId||c.roadId;
   const target=lane(n,next,c.lane),desired=Math.atan2(target.y-c.y,target.x-c.x),d=angleDelta(desired,c.a),maxTurn=1.25*dt*clamp(c.v/70,.3,1);c.a+=clamp(d,-maxTurn,maxTurn);
   let want=c.targetSpeed*(1-clamp(Math.abs(d)/1.8,0,.65)),lead=Infinity;
   for(const o of cars){if(o===c)continue;const dx=o.x-c.x,dy=o.y-c.y,front=dx*Math.cos(c.a)+dy*Math.sin(c.a),side=Math.abs(-dx*Math.sin(c.a)+dy*Math.cos(c.a));if(front>0&&front<120&&side<38)lead=Math.min(lead,front);}
   if(player){const dx=player.x-c.x,dy=player.y-c.y,front=dx*Math.cos(c.a)+dy*Math.sin(c.a),side=Math.abs(-dx*Math.sin(c.a)+dy*Math.cos(c.a));if(front>0&&front<105&&side<38)lead=Math.min(lead,front);}
   if(lead<70)want=Math.min(want,Math.max(0,(lead-20)*2.2));
   if(c.yield>0){c.yield=Math.max(0,c.yield-dt);want=Math.min(want,8);}
   c.v+=(want-c.v)*Math.min(1,dt*(want<c.v?9:2.2));
   const nx=c.x+Math.cos(c.a)*c.v*dt,ny=c.y+Math.sin(c.a)*c.v*dt;
   if(!blocked(nx,ny)){c.x=nx;c.y=ny;c.stuck=Math.max(0,c.stuck-dt*.8);}else{c.v*=.35;c.stuck+=dt;}
   if(c.type==='police'&&player&&dist(c,player)<420){c.siren=1;const chase=angleDelta(Math.atan2(player.y-c.y,player.x-c.x),c.a);c.a+=clamp(chase,-.65*dt,.65*dt);}else c.siren=0;
   if(c.stuck>1.0){c.v=0;c.brake=1;c.recovery++;c.stuck=0;const reverse=c.route[Math.max(0,c.index-1)];if(reverse&&!blocked(reverse.x,reverse.y)){c.a=Math.atan2(reverse.y-c.y,reverse.x-c.x);c.route=buildRoute(reverse);c.index=1;}else{const free=pickFree(c,120);if(free){c.route=buildRoute(free);c.index=1;c.a=Math.atan2(free.y-c.y,free.x-c.x);}}}
  }
  for(let i=0;i<cars.length;i++)for(let j=i+1;j<cars.length;j++){const a=cars[i],b=cars[j],dx=b.x-a.x,dy=b.y-a.y,d=Math.hypot(dx,dy);if(d<46){const nx=dx/(d||1),ny=dy/(d||1),avx=a.v*Math.cos(a.a),avy=a.v*Math.sin(a.a),bvx=b.v*Math.cos(b.a),bvy=b.v*Math.sin(b.a),closing=(avx-bvx)*nx+(avy-bvy)*ny;if(closing>0){if(a.v>=b.v){a.yield=Math.max(a.yield,.55);a.v*=.55;}else{b.yield=Math.max(b.yield,.55);b.v*=.55;}}const push=Math.min(5,46-d);a.x-=nx*push*.5;a.y-=ny*push*.5;b.x+=nx*push*.5;b.y+=ny*push*.5;if(now-(a.hitAt||0)>700){collisions.push({type:'npc-npc',a,b,relative:closing});a.hitAt=now;b.hitAt=now;}}}
  if(player){for(const c of cars){const dx=c.x-player.x,dy=c.y-player.y,d=Math.hypot(dx,dy);if(d>0&&d<40){const nx=dx/d,ny=dy/d,corr=40-d,closing=(c.v*Math.cos(c.a)-Number(player.vx||0))*nx+(c.v*Math.sin(c.a)-Number(player.vy||0))*ny;c.x+=nx*corr;c.y+=ny*corr;if(closing>0){c.v*=.55;player.vx=(Number(player.vx)||0)+nx*closing*.18;player.vy=(Number(player.vy)||0)+ny*closing*.18;}c.yield=Math.max(c.yield,.35);if(now-(c.hitAt||0)>700){collisions.push({type:'player-npc',car:c,relative:closing});c.hitAt=now;}}}}
 }
 function consumeCollisions(){const out=collisions;collisions=[];return out;}
 function draw(ctx,iso){const ordered=[...cars].sort((a,b)=>(a.x+a.y)-(b.x+b.y));for(const c of ordered){const center=iso(c.x,c.y),front=iso(c.x+Math.cos(c.a)*20,c.y+Math.sin(c.a)*20),screenAngle=Math.atan2(front.y-center.y,front.x-center.x),image=images[c.type]||images.sedan;ctx.save();ctx.translate(center.x,center.y);ctx.rotate(screenAngle);ctx.globalAlpha=.98;if(c.type==='taxi')ctx.filter='grayscale(.72) brightness(.82)';if(image?.complete&&image.naturalWidth)ctx.drawImage(image,-30,-15,60,30);else{ctx.fillStyle='#454a50';ctx.fillRect(-22,-10,44,20);}ctx.restore();if(c.type==='police'&&c.siren){ctx.fillStyle=Math.sin(performance.now()/90)>0?'#d4523a':'#e8b84a';ctx.fillRect(center.x-4,center.y-18,8,3);}}}
 return{cars,update,draw,consumeCollisions,ai:null,scenario};
}
