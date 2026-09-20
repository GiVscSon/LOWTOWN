// World-space extrusion: equal negative X/Y offsets are vertical in isometry.
export function drawArchitecture(ctx,b,index) {
  const floors=2+index%5, z= floors*22, r=16;
  const base=[[b.x+r,b.y],[b.x+b.w-r,b.y],[b.x+b.w,b.y+r],[b.x+b.w,b.y+b.h-r],[b.x+b.w-r,b.y+b.h],[b.x+r,b.y+b.h],[b.x,b.y+b.h-r],[b.x,b.y+r]];
  const polygon=(points,color)=>{ctx.beginPath();points.forEach(([x,y],i)=>i?ctx.lineTo(x,y):ctx.moveTo(x,y));ctx.closePath();ctx.fillStyle=color;ctx.fill();};
  ctx.save();ctx.lineJoin='round';
  polygon(base.map(([x,y])=>[x+z*.45,y+z*.25]),'rgba(0,0,0,.3)');
  // East and south faces, including the bevel between them.
  for(let side=2;side<=5;side++){
    const a=base[side],c=base[(side+1)%base.length];
    polygon([a,c,[c[0]-z,c[1]-z],[a[0]-z,a[1]-z]],['#46372e','#574337','#654b39','#52463d'][side-2]);
    const length=Math.hypot(c[0]-a[0],c[1]-a[1]);
    const cell=(u,v,du,dv,color)=>{
      const p=(t,h)=>[a[0]+(c[0]-a[0])*t-h,a[1]+(c[1]-a[1])*t-h];
      polygon([p(u,v),p(u+du,v),p(u+du,v+dv),p(u,v+dv)],color);
    };
    for(let h=8;h<z;h+=8)cell(0,h,1,.7,'rgba(12,10,9,.25)');
    for(let floor=0;floor<floors;floor++)for(let n=12;n<length-20;n+=32){
      const lit=(n+floor*13+index*7)%11>3;
      cell(n/length,7+floor*22,15/length,12,'#10171a');
      cell((n+2)/length,9+floor*22,11/length,8,lit?'#d3a451':'#27363b');
      cell((n+7)/length,9+floor*22,1/length,8,'#453322');
    }
    if(length>100){cell(.42,0,.13,19,'#0b1114');cell(.38,21,.23,5,b.neon||'#b48a49');}
  }
  polygon(base.map(([x,y])=>[x-z,y-z]),b.roof||'#292d30');
  ctx.strokeStyle='#77766b';ctx.lineWidth=3;ctx.stroke();
  ctx.save();ctx.translate(-z,-z);
  ctx.strokeStyle='rgba(147,149,138,.18)';ctx.lineWidth=1;
  for(let y=b.y+22;y<b.y+b.h-12;y+=26){ctx.beginPath();ctx.moveTo(b.x+12,y);ctx.lineTo(b.x+b.w-12,y);ctx.stroke();}
  ctx.fillStyle='#11191c';ctx.fillRect(b.x+24,b.y+30,55,33);
  ctx.fillStyle='#4b5557';ctx.fillRect(b.x+19,b.y+25,55,28);
  ctx.strokeStyle='#263235';for(let n=0;n<6;n++){ctx.beginPath();ctx.moveTo(b.x+24+n*8,b.y+28);ctx.lineTo(b.x+24+n*8,b.y+48);ctx.stroke();}
  ctx.restore();
  // Sign on the wall plane rather than printed flat across the roof.
  ctx.save();ctx.translate(b.x+b.w*.23-28,b.y+b.h-28);ctx.transform(1,0,1,1,0,0);
  ctx.fillStyle='#171a19';ctx.fillRect(0,0,b.w*.55,17);ctx.fillStyle=b.neon||'#e09a3e';ctx.font='bold 11px monospace';ctx.textAlign='center';
  ctx.fillText(b.sign,b.w*.275,12,b.w*.5);ctx.restore();ctx.restore();
}

export function drawRoundedJunction(ctx,h,v,asphalt){
  const radius=28;
  for(const [x,y,sx,sy] of [[v.x,h.y,-1,-1],[v.x+v.w,h.y,1,-1],[v.x+v.w,h.y+h.h,1,1],[v.x,h.y+h.h,-1,1]]){
    ctx.save();ctx.translate(x,y);ctx.scale(sx,sy);
    ctx.beginPath();ctx.moveTo(-2,-2);ctx.lineTo(radius,-2);ctx.lineTo(radius,0);ctx.quadraticCurveTo(0,0,0,radius);ctx.lineTo(-2,radius);ctx.closePath();ctx.fillStyle=asphalt;ctx.fill();
    ctx.beginPath();ctx.moveTo(radius,0);ctx.quadraticCurveTo(0,0,0,radius);ctx.strokeStyle='#77776b';ctx.lineWidth=3;ctx.stroke();ctx.restore();
  }
}
