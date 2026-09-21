// Equal negative X/Y offsets become height after the isometric camera transform.
export function drawArchitecture(ctx, b, index) {
  const floors = b.floors ?? (2 + index % 5), z = floors * 24, r = b.cornerRadius ?? (16 + index % 3 * 3);
  const type=b.archetype||['tenement','shop','warehouse','deco','townhouse','office'][index%6];
  const base = [[b.x+r,b.y],[b.x+b.w-r,b.y],[b.x+b.w,b.y+r],[b.x+b.w,b.y+b.h-r],[b.x+b.w-r,b.y+b.h],[b.x+r,b.y+b.h],[b.x,b.y+b.h-r],[b.x,b.y+r]];
  const polygon = (points, color) => { ctx.beginPath(); points.forEach(([x,y],i)=>i?ctx.lineTo(x,y):ctx.moveTo(x,y)); ctx.closePath(); ctx.fillStyle=color; ctx.fill(); };
  const palettes = [
    ['#35231d','#492c21','#5b3828','#402d27'],
    ['#29282a','#393234','#4b3b35','#343238'],
    ['#302820','#493729','#60452f','#3e352e'],
    ['#1f2c31','#293b42','#35505a','#26383f'],
    ['#30352f','#41483e','#59604f','#394139'],
    ['#27232c','#38303b','#4c3d49','#332e39']
  ];

  ctx.save(); ctx.lineJoin='round';
  polygon(base.map(([x,y])=>[x+z*.52,y+z*.32]),'rgba(0,0,0,.48)');
  const typePalette={warehouse:4,office:3,deco:5,townhouse:0,shop:2,pavilion:4,tenement:1};
  const walls=palettes[typePalette[type]??index%palettes.length];

  // Street-facing walls, including the chamfered corners.
  for(let side=2;side<=5;side++){
    const a=base[side], c=base[(side+1)%base.length], length=Math.hypot(c[0]-a[0],c[1]-a[1]);
    const p=(t,h)=>[a[0]+(c[0]-a[0])*t-h,a[1]+(c[1]-a[1])*t-h];
    const cell=(u,v,du,dv,color)=>polygon([p(u,v),p(u+du,v),p(u+du,v+dv),p(u,v+dv)],color);
    polygon([a,c,[c[0]-z,c[1]-z],[a[0]-z,a[1]-z]],walls[side-2]);

    ctx.strokeStyle='rgba(13,9,8,.28)'; ctx.lineWidth=1;
    for(let h=7;h<z;h+=7){ctx.beginPath();ctx.moveTo(...p(0,h));ctx.lineTo(...p(1,h));ctx.stroke();}
    for(let floor=1;floor<floors;floor++)cell(0,floor*24-2,1,2.5,'rgba(12,9,8,.35)');

    for(let floor=0;floor<floors;floor++)for(let n=11;n<length-18;n+=28){
      const lit=(n+floor*17+index*11)%13>4;
      cell(n/length,6+floor*24,15/length,13,'#090d10');
      cell((n+2)/length,8+floor*24,11/length,9,lit?(floor===0?'#ffd073':'#b98242'):'#172329');
      cell((n+7)/length,8+floor*24,1/length,9,'rgba(24,16,12,.72)');
    }

    if(type==='warehouse'&&length>90){
      for(let n=16;n<length-32;n+=58){cell(n/length,2,35/length,21,'#12191b');cell((n+3)/length,5,29/length,16,'#394246');}
      ctx.strokeStyle='rgba(205,194,166,.22)';for(let n=8;n<length;n+=12){ctx.beginPath();ctx.moveTo(...p(n/length,0));ctx.lineTo(...p(n/length,z));ctx.stroke();}
    }
    if(type==='townhouse'&&length>75){
      ctx.strokeStyle='rgba(190,179,151,.4)';ctx.lineWidth=2;
      for(let floor=1;floor<floors;floor++){const q=p(.68,floor*24-4);ctx.strokeRect(q[0]-18,q[1]-7,36,10);ctx.beginPath();ctx.moveTo(q[0]-14,q[1]+3);ctx.lineTo(q[0]-8,q[1]+13);ctx.moveTo(q[0]+14,q[1]+3);ctx.lineTo(q[0]+8,q[1]+13);ctx.stroke();}
    }
    if((type==='shop'||type==='pavilion')&&length>70){
      const awning=p(.48,22);ctx.save();ctx.translate(awning[0],awning[1]);ctx.transform(1,0,(c[0]-a[0])===0?0:.28,1,0,0);ctx.fillStyle=b.neon||'#b86f39';ctx.fillRect(-34,-3,68,7);ctx.fillStyle='rgba(240,210,150,.5)';for(let n=-30;n<30;n+=14)ctx.fillRect(n,-3,6,7);ctx.restore();
    }

    if(length>88){
      const glow=b.neon||(index%2?'#e25535':'#e6a53f');
      cell(.16,0,.23,21,'#080d10'); cell(.18,2,.19,16,'rgba(245,174,77,.9)');
      cell(.43,0,.16,20,'#080b0d'); cell(.66,0,.20,21,'#080d10'); cell(.68,2,.16,16,'rgba(255,201,109,.76)');
      cell(.10,21,.82,4,glow);
      const sign=p(.88,30); ctx.save();ctx.translate(sign[0],sign[1]);
      ctx.fillStyle='#08090a';ctx.fillRect(-4,-18,28,18);ctx.strokeStyle=glow;ctx.lineWidth=2;ctx.shadowColor=glow;ctx.shadowBlur=9;ctx.strokeRect(-4,-18,28,18);ctx.shadowBlur=0;
      ctx.fillStyle=glow;ctx.font='900 7px monospace';ctx.textAlign='center';ctx.fillText(index%3===0?'BAR':index%3===1?'OPEN':'24H',10,-6);ctx.restore();
    }
  }

  // Roof, parapet and rooftop clutter finish the silhouette.
  const roofColors={warehouse:'#273033',office:'#17252d',deco:'#2c2630',townhouse:'#302a25',shop:'#252a27',pavilion:'#28332f',tenement:'#292728'};
  polygon(base.map(([x,y])=>[x-z,y-z]),b.roof||roofColors[type]||(index%2?'#242526':'#2c2926'));
  ctx.strokeStyle='#777064';ctx.lineWidth=4;ctx.stroke();
  ctx.save();ctx.translate(-z,-z);ctx.strokeStyle='rgba(170,157,133,.24)';ctx.lineWidth=2;ctx.strokeRect(b.x+10,b.y+10,b.w-20,b.h-20);
  for(let y=b.y+28;y<b.y+b.h-12;y+=28){ctx.beginPath();ctx.moveTo(b.x+13,y);ctx.lineTo(b.x+b.w-13,y);ctx.stroke();}
  if(type==='warehouse'){
    ctx.fillStyle='#111719';for(let n=0;n<4;n++){ctx.beginPath();ctx.moveTo(b.x+18+n*b.w*.23,b.y+b.h-20);ctx.lineTo(b.x+46+n*b.w*.23,b.y+20);ctx.lineTo(b.x+74+n*b.w*.23,b.y+b.h-20);ctx.closePath();ctx.fill();}
    ctx.fillStyle='#6a706b';for(let n=0;n<3;n++)ctx.fillRect(b.x+28+n*54,b.y+28,36,18);
  }else{
    ctx.fillStyle='#111517';ctx.fillRect(b.x+22,b.y+27,58,35);ctx.fillStyle='#555a57';ctx.fillRect(b.x+17,b.y+22,58,29);ctx.strokeStyle='#242a2a';
    for(let n=0;n<7;n++){ctx.beginPath();ctx.moveTo(b.x+22+n*8,b.y+25);ctx.lineTo(b.x+22+n*8,b.y+47);ctx.stroke();}
  }
  if(type==='tenement'||type==='townhouse'){
    ctx.fillStyle='#4f4134';ctx.fillRect(b.x+b.w-58,b.y+28,26,24);ctx.fillStyle='#161919';ctx.beginPath();ctx.ellipse(b.x+b.w-45,b.y+28,15,8,0,0,Math.PI*2);ctx.fill();
    ctx.strokeStyle='#565c58';ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(b.x+b.w-45,b.y+18);ctx.lineTo(b.x+b.w-45,b.y-8);ctx.stroke();
  }
  if(type==='office'||type==='deco'){
    ctx.fillStyle='#1c2428';ctx.fillRect(b.x+b.w*.48,b.y+20,32,20);ctx.strokeStyle=b.neon||'#ad8651';ctx.strokeRect(b.x+b.w*.48,b.y+20,32,20);
    if(type==='deco'){ctx.fillStyle='#3d3a3d';ctx.fillRect(b.x+b.w*.5-8,b.y-8,16,28);ctx.fillStyle=b.neon||'#d58c43';ctx.fillRect(b.x+b.w*.5-2,b.y-16,4,19);}
  }
  ctx.restore();

  ctx.save();ctx.translate(b.x+b.w*.23-28,b.y+b.h-28);ctx.transform(1,0,1,1,0,0);ctx.fillStyle='rgba(8,9,9,.94)';ctx.fillRect(0,0,b.w*.55,18);
  ctx.fillStyle=b.neon||'#e09a3e';ctx.shadowColor=ctx.fillStyle;ctx.shadowBlur=6;ctx.font='900 11px monospace';ctx.textAlign='center';ctx.fillText(b.sign,b.w*.275,13,b.w*.5);ctx.shadowBlur=0;ctx.restore();
  ctx.restore();
}

export function drawRoundedJunction(ctx,h,v,asphalt){
  const radius=34;
  for(const [x,y,sx,sy] of [[v.x,h.y,-1,-1],[v.x+v.w,h.y,1,-1],[v.x+v.w,h.y+h.h,1,1],[v.x,h.y+h.h,-1,1]]){
    ctx.save();ctx.translate(x,y);ctx.scale(sx,sy);ctx.beginPath();ctx.moveTo(-2,-2);ctx.lineTo(radius,-2);ctx.lineTo(radius,0);ctx.quadraticCurveTo(0,0,0,radius);ctx.lineTo(-2,radius);ctx.closePath();ctx.fillStyle=asphalt;ctx.fill();
    ctx.beginPath();ctx.moveTo(radius,0);ctx.quadraticCurveTo(0,0,0,radius);ctx.strokeStyle='#5d5b54';ctx.lineWidth=3;ctx.stroke();ctx.restore();
  }
}
