const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const isoForward=(iso,x,y,a)=>{const c=iso(x,y),f=iso(x+Math.cos(a)*10,y+Math.sin(a)*10);return Math.atan2(f.y-c.y,f.x-c.x);};

export function drawIsometricCar(ctx,iso,state,{body='#e8b84a',accent='#171a1e',scale=1}={}){
  const p=iso(state.x,state.y), angle=isoForward(iso,state.x,state.y,state.a||0), speed=Math.abs(state.v||0);
  ctx.save();ctx.translate(p.x,p.y);ctx.rotate(angle);
  const L=46*scale,W=24*scale,H=9*scale;
  ctx.fillStyle='rgba(0,0,0,.55)';ctx.beginPath();ctx.ellipse(0,H+5,L*.72,W*.28,0,0,Math.PI*2);ctx.fill();
  ctx.fillStyle='#24282c';ctx.beginPath();ctx.moveTo(-L*.58,-W*.48);ctx.lineTo(L*.58,-W*.48);ctx.lineTo(L*.78,W*.28);ctx.lineTo(L*.56,W*.5);ctx.lineTo(-L*.62,W*.5);ctx.lineTo(-L*.8,W*.15);ctx.closePath();ctx.fill();
  ctx.fillStyle=body;ctx.beginPath();ctx.moveTo(-L*.58,-W*.42);ctx.lineTo(L*.52,-W*.42);ctx.lineTo(L*.7,W*.18);ctx.lineTo(L*.48,W*.38);ctx.lineTo(-L*.55,W*.38);ctx.lineTo(-L*.7,W*.08);ctx.closePath();ctx.fill();
  ctx.strokeStyle=accent;ctx.lineWidth=2*scale;ctx.stroke();
  ctx.fillStyle='#1b2228';ctx.beginPath();ctx.moveTo(-L*.3,-W*.28);ctx.lineTo(L*.18,-W*.28);ctx.lineTo(L*.42,W*.12);ctx.lineTo(-L*.36,W*.12);ctx.closePath();ctx.fill();
  ctx.fillStyle='#727b82';ctx.globalAlpha=.7;ctx.beginPath();ctx.moveTo(-L*.22,-W*.23);ctx.lineTo(L*.1,-W*.23);ctx.lineTo(L*.27,W*.05);ctx.lineTo(-L*.28,W*.05);ctx.closePath();ctx.fill();ctx.globalAlpha=1;
  ctx.fillStyle='#d4523a';ctx.fillRect(-L*.58,W*.2,7*scale,3*scale);ctx.fillStyle='#fff1a7';ctx.fillRect(L*.48,W*.16,6*scale,4*scale);
  ctx.fillStyle='#0a0b0d';ctx.fillRect(-L*.52,-W*.58,12*scale,4*scale);ctx.fillRect(L*.28,-W*.58,12*scale,4*scale);
  if(speed>8){ctx.strokeStyle='rgba(224,154,62,.28)';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(-L*.95,0);ctx.lineTo(-L*1.35,0);ctx.stroke();}
  ctx.restore();
}
