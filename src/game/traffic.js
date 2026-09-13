import { VEHICLE_ASSETS } from './assets.js';
import { createAIDriver } from './ai_driver.js';

const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const angleDelta=(target,current)=>{let d=target-current;while(d>Math.PI)d-=Math.PI*2;while(d<-Math.PI)d+=Math.PI*2;return d;};

export function createTrafficSystem({nodes,blocked,seed=1337}){
 let state=seed>>>0;const cars=[],images={};Object.entries(VEHICLE_ASSETS).forEach(([k,src])=>{const i=new Image();i.src=src;images[k]=i});
 const params=new URLSearchParams(location.search);let scenario=null;try{const raw=params.get('scenario');if(raw)scenario=JSON.parse(raw)}catch{}
 const density=Number.isFinite(Number(scenario?.trafficDensity))?clamp(Number(scenario.trafficDensity),0,1):null;
 const leadSpeed=Number.isFinite(Number(scenario?.leadSpeed))?Math.max(25,Number(scenario.leadSpeed)):null;
 const activeNodes=(globalThis.__LOWTOWN_CITY_GRAPH?.length?globalThis.__LOWTOWN_CITY_GRAPH:nodes);
 const rand=()=>{state=(state*1664525+1013904223)>>>0;return state/4294967296};
 const dist=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y),pick=()=>activeNodes[(rand()*activeNodes.length)|0];
 const routeFrom=s=>{const r=[s];let c=s;const seen=new Set([c.id]);for(let i=0;i<24;i++){const q=c.links.filter(n=>!seen.has(n.id));if(!q.length)break;c=q[(rand()*q.length)|0];r.push(c);seen.add(c.id)}return r;};
 const lane=(n,next,l)=>{if(!next)return{x:n.x,y:n.y};const dx=next.x-n.x,dy=next.y-n.y,len=Math.hypot(dx,dy)||1;return{x:n.x-dy/len*l,y:n.y+dx/len*l}};
 const types=[['sedan',105,165],['coupe',125,195],['taxi',115,175],['police',135,210],['van',85,135],['truck',70,115]];
 const count=density===null?26:Math.max(8,Math.min(50,Math.round(8+density*42)));
 for(let i=0;i<count;i++){
   const n=pick(),t=types[(rand()*types.length)|0],nx=n.links[0],base=t[1],top=t[2],v=leadSpeed===null?base+rand()*(top-base):Math.max(25,leadSpeed*(.78+rand()*.44));
   cars.push({x:n.x,y:n.y,a:nx?Math.atan2(nx.y-n.y,nx.x-n.x):0,v,targetSpeed:v,route:routeFrom(n),index:1,lane:(rand()<.5?-1:1)*22,type:t[0],stuck:0,brake:0,siren:0,roadId:n.roadId||null,hitAt:0});
 }
 const aiMode=new URLSearchParams(location.search).has('autotest');
 const ai=aiMode?createAIDriver({nodes:activeNodes,blocked,getTraffic:()=>cars}):null;
 if(ai)globalThis.__LOWTOWN_AI=ai.state;
 function applyAI(player,control,dt){if(!control)return;const sub=Math.max(1,Math.ceil(dt/(1/120))),h=dt/sub;for(let k=0;k<sub;k++){const fx=Math.cos(player.a),fy=Math.sin(player.a),rx=-fy,ry=fx,fs=player.vx*fx+player.vy*fy,ls=player.vx*rx+player.vy*ry;player.vx+=fx*control.throttle*430*h;player.vy+=fy*control.throttle*430*h;if(control.brake){const amount=Math.min(Math.abs(fs),760*control.brake*h);player.vx-=fx*Math.sign(fs||1)*amount;player.vy-=fy*Math.sign(fs||1)*amount}player.vx-=rx*ls*Math.min(1,10.5*h);player.vy-=ry*ls*Math.min(1,10.5*h);const drag=control.handbrake?.985:.999;player.vx*=Math.pow(drag,h*60);player.vy*=Math.pow(drag,h*60);const forward=player.vx*fx+player.vy*fy;player.a+=control.steer*(control.handbrake?1.65:1.9)*Math.min(1,Math.abs(forward)/55)*h*(forward>=0?1:-1);const nx=player.x+player.vx*h,ny=player.y+player.vy*h;if(!blocked(nx,ny)){player.x=nx;player.y=ny}else{player.vx*=.15;player.vy*=.15}}}
 function update(dt,player,event=null){
   for(const c of cars){
     let n=c.route[c.index],next=c.route[c.index+1];
     if(!n||dist(c,n)<24){if(n)c.index++;if(!c.route[c.index]){const s=c.route.at(-1)||pick();c.route=routeFrom(s);c.index=1}n=c.route[c.index];next=c.route[c.index+1]}
     if(!n)continue;
     c.roadId=n.roadId||c.roadId;
     const target=lane(n,next,c.lane),desired=Math.atan2(target.y-c.y,target.x-c.x),d=angleDelta(desired,c.a);
     const speedFactor=clamp(c.v/70,.2,1),maxTurn=(next?1.35:1.8)*dt*speedFactor;
     c.a+=clamp(d,-maxTurn,maxTurn);
     let want=c.targetSpeed*(1-clamp(Math.abs(d)/1.8,0,.72));
     let lead=Infinity;
     for(const o of cars){if(o===c)continue;const dx=o.x-c.x,dy=o.y-c.y,front=dx*Math.cos(c.a)+dy*Math.sin(c.a),side=Math.abs(-dx*Math.sin(c.a)+dy*Math.cos(c.a));if(front>0&&front<120&&side<32)lead=Math.min(lead,front)}
     if(player){const dx=player.x-c.x,dy=player.y-c.y,front=dx*Math.cos(c.a)+dy*Math.sin(c.a),side=Math.abs(-dx*Math.sin(c.a)+dy*Math.cos(c.a));if(front>0&&front<100&&side<34)lead=Math.min(lead,front)}
     if(lead<82)want=Math.min(want,Math.max(0,(lead-18)*2.2));
     c.v+=(want-c.v)*Math.min(1,dt*(want<c.v?5:1.8));
     const nx=c.x+Math.cos(c.a)*c.v*dt,ny=c.y+Math.sin(c.a)*c.v*dt;
     if(!blocked(nx,ny)){c.x=nx;c.y=ny;c.stuck=0}else{c.v*=.45;c.stuck+=dt}
     if(c.type==='police'&&player&&dist(c,player)<560){c.siren=1;const chase=angleDelta(Math.atan2(player.y-c.y,player.x-c.x),c.a);c.a+=clamp(chase,-1.1*dt,1.1*dt)}else c.siren=0;
     if(c.stuck>1.5){const s=pick(),to=s.links[0];c.x=s.x;c.y=s.y;c.a=to?Math.atan2(to.y-s.y,to.x-s.x):0;c.route=routeFrom(s);c.index=1;c.stuck=0}
   }
   if(ai&&player){if(!ai.state.enabled)ai.start(player);const control=ai.update(player,dt);applyAI(player,control,dt)}
 }
 function draw(ctx,iso){
   for(const c of cars){
     const center=iso(c.x,c.y),front=iso(c.x+Math.cos(c.a)*34,c.y+Math.sin(c.a)*34),back=iso(c.x-Math.cos(c.a)*26,c.y-Math.sin(c.a)*26),sideA=iso(c.x-Math.sin(c.a)*12,c.y+Math.cos(c.a)*12),sideB=iso(c.x+Math.sin(c.a)*12,c.y-Math.cos(c.a)*12);
     ctx.save();ctx.beginPath();ctx.moveTo(front.x,front.y);ctx.lineTo(sideB.x,sideB.y);ctx.lineTo(back.x,back.y);ctx.lineTo(sideA.x,sideA.y);ctx.closePath();ctx.fillStyle=c.type==='police'?'#30353a':c.type==='taxi'?'#e8b84a':c.type==='truck'?'#555b61':'#454a50';ctx.fill();ctx.strokeStyle='#101216';ctx.lineWidth=2;ctx.stroke();
     const windshield=iso(c.x+Math.cos(c.a)*10,c.y+Math.sin(c.a)*10);ctx.fillStyle='#15191d';ctx.beginPath();ctx.ellipse(windshield.x,windshield.y,7,4,Math.atan2(front.y-center.y,front.x-center.x),0,Math.PI*2);ctx.fill();
     if(c.type==='police'&&c.siren){ctx.fillStyle=Math.sin(performance.now()/90)>0?'#d4523a':'#e8b84a';ctx.fillRect(center.x-4,center.y-12,8,3)}ctx.restore();
   }
 }
 return{cars,update,draw,ai,scenario};
}