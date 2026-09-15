const TAU=Math.PI*2;
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));

function headingSector(a){
  let n=(Number(a)||0)%TAU;
  if(n<0)n+=TAU;
  return Math.round(n/(TAU/8))&7;
}

function drawCar(ctx,x,y,heading,type='sedan',scale=1){
  const s=clamp(scale,.65,1.4);
  const sector=headingSector(heading);
  const flip=(sector>=3&&sector<=5)?-1:1;
  const side=(sector===2||sector===3||sector===4||sector===5)?-1:1;
  const length=48*s,width=25*s;
  ctx.save();
  ctx.translate(x,y);
  ctx.globalAlpha=.98;
  ctx.fillStyle='rgba(0,0,0,.48)';
  ctx.beginPath();ctx.ellipse(0,10*s,31*s,7*s,0,0,TAU);ctx.fill();
  ctx.scale(flip,1);
  let body='#555b60';
  if(type==='taxi')body='#e8b84a';
  if(type==='police')body='#d4d4cf';
  if(type==='van')body='#70767b';
  if(type==='truck')body='#666c70';
  if(type==='coupe')body='#464c51';
  ctx.fillStyle='#111417';ctx.fillRect(-length/2,-width/2,length,width);
  ctx.fillStyle=body;ctx.fillRect(-length/2+3*s,-width/2+2*s,length-6*s,width-4*s);
  ctx.fillStyle='#151a1e';
  ctx.beginPath();ctx.moveTo(-15*s,-8*s);ctx.lineTo(9*s,-8*s);ctx.lineTo(17*s,-2*s);ctx.lineTo(10*s,5*s);ctx.lineTo(-15*s,5*s);ctx.closePath();ctx.fill();
  ctx.fillStyle='#626b72';ctx.globalAlpha=.78;ctx.fillRect(-10*s,-6*s,18*s,5*s);ctx.fillRect(-7*s,0,17*s,4*s);ctx.globalAlpha=.98;
  ctx.fillStyle='#0b0d10';ctx.fillRect(-17*s,-width/2-1*s,8*s,4*s);ctx.fillRect(9*s,-width/2-1*s,8*s,4*s);ctx.fillRect(-17*s,width/2-3*s,8*s,4*s);ctx.fillRect(9*s,width/2-3*s,8*s,4*s);
  ctx.fillStyle='#d4523a';ctx.fillRect(-length/2+3*s,-width/2+4*s,5*s,4*s);ctx.fillRect(-length/2+3*s,width/2-8*s,5*s,4*s);
  ctx.fillStyle='#fff1b0';ctx.fillRect(length/2-8*s,-width/2+4*s,5*s,4*s);ctx.fillRect(length/2-8*s,width/2-8*s,5*s,4*s);
  if(type==='taxi'){ctx.fillStyle='#171a1e';ctx.fillRect(-5*s,-3*s,11*s,5*s);}
  if(type==='police'){ctx.fillStyle=sector%2?'#d4523a':'#e8b84a';ctx.fillRect(-4*s,-width/2-5*s,8*s,3*s);}
  if(type==='truck'){ctx.fillStyle='#24282b';ctx.fillRect(-length/2+5*s,-width/2+4*s,13*s,width-8*s);}
  ctx.restore();
}

export function drawPlayerCar(ctx,x,y,heading,scale=1){drawCar(ctx,x,y,heading,'sedan',scale);}
export function drawTrafficCar(ctx,x,y,heading,type='sedan',scale=1){drawCar(ctx,x,y,heading,type,scale);}

export function drawPedestrian(ctx,x,y,heading=0,kind='civilian',scale=1){
  const s=clamp(scale,.7,1.5),sector=headingSector(heading),leg=sector%2?2:-2;
  ctx.save();ctx.translate(x,y);
  ctx.fillStyle='rgba(0,0,0,.42)';ctx.beginPath();ctx.ellipse(0,9*s,9*s,3*s,0,0,TAU);ctx.fill();
  ctx.fillStyle='#b98f72';ctx.beginPath();ctx.arc(0,-10*s,5*s,0,TAU);ctx.fill();
  ctx.fillStyle=kind==='runner'?'#d4523a':'#596068';ctx.fillRect(-6*s,-5*s,12*s,15*s);
  ctx.strokeStyle='#202327';ctx.lineWidth=3*s;ctx.lineCap='round';
  ctx.beginPath();ctx.moveTo(-3*s,10*s);ctx.lineTo((-5+leg)*s,19*s);ctx.moveTo(3*s,10*s);ctx.lineTo((5-leg)*s,19*s);ctx.stroke();
  ctx.restore();
}
