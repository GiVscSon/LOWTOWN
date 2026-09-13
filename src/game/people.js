import { PED_ASSETS } from './assets.js';
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const wrapAngle=a=>{while(a>Math.PI)a-=Math.PI*2;while(a<-Math.PI)a+=Math.PI*2;return a;};
export function createPeopleSystem({nodes,blocked,seed=4242}){
 let state=seed>>>0;const people=[],rand=()=>{state=(state*1664525+1013904223)>>>0;return state/4294967296};
 const activeNodes=nodes||[],pick=()=>activeNodes.length?activeNodes[(rand()*activeNodes.length)|0]:{x:0,y:0,links:[]};
 const sprite=k=>{const i=new Image();i.src=PED_ASSETS[k];return i};const sprites={civilian:sprite('civilian'),runner:sprite('runner')};
 const sidewalkPoint=n=>{const next=n?.links?.[0];if(!next)return{x:n.x,y:n.y};const dx=next.x-n.x,dy=next.y-n.y,len=Math.hypot(dx,dy)||1,side=rand()<.5?-1:1;return{x:n.x-dy/len*58*side,y:n.y+dx/len*58*side};};
 const chooseTarget=p=>{const n=pick(),target=sidewalkPoint(n);p.target=target;p.timer=2+rand()*5;p.state=rand()<.12?'idle':'walk';p.waypoint=0;};
 for(let i=0;i<Math.min(40,activeNodes.length);i++){const n=pick(),q=sidewalkPoint(n);people.push({x:q.x,y:q.y,a:0,v:18+rand()*10,state:'walk',timer:rand()*3,tone:rand(),target:sidewalkPoint(pick()),route:[],waypoint:0,panic:0,stuck:0});}
 function update(dt,player,danger=0){const h=Math.min(Math.max(Number(dt)||0,0),.05);for(const p of people){p.timer-=h;const pd=player?Math.hypot(player.x-p.x,player.y-p.y):Infinity;if(danger>0&&pd<240)p.panic=Math.min(1,p.panic+h*2);else p.panic=Math.max(0,p.panic-h*.8);if(p.timer<=0||Math.hypot(p.target.x-p.x,p.target.y-p.y)<18)chooseTarget(p);if(p.state==='idle'&&p.panic<.2)continue;let desired=Math.atan2(p.target.y-p.y,p.target.x-p.x);if(p.panic>.2&&pd<240)desired=Math.atan2(p.y-player.y,p.x-player.x);const d=wrapAngle(desired-p.a),turn=1-Math.exp(-10*h);p.a=wrapAngle(p.a+d*turn);const targetSpeed=p.v*(p.panic>.2?1.6:1),nx=p.x+Math.cos(p.a)*targetSpeed*h,ny=p.y+Math.sin(p.a)*targetSpeed*h;if(!blocked(nx,ny)){p.x=nx;p.y=ny;p.stuck=0;}else{p.stuck+=h;p.a=wrapAngle(p.a+(rand()<.5?-1:1)*1.1*h);if(p.stuck>.45){chooseTarget(p);p.stuck=0;}}}}
 function draw(ctx,iso,player){for(const p of people){const q=iso(p.x,p.y),f=iso(p.x+Math.cos(p.a)*8,p.y+Math.sin(p.a)*8),ang=Math.atan2(f.y-q.y,f.x-q.x),image=sprites[p.panic>.2?'runner':'civilian'];ctx.save();ctx.translate(q.x,q.y);ctx.rotate(ang);if(image.complete&&image.naturalWidth)ctx.drawImage(image,-12,-16,24,18);else{ctx.fillStyle='#596068';ctx.beginPath();ctx.arc(0,-8,4,0,Math.PI*2);ctx.fill();ctx.fillRect(-3,-4,6,11);}ctx.restore();}}
 return{people,update,draw};
}
