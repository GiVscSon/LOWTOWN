// Equal negative X/Y offsets become height after the isometric camera transform.
export function drawArchitecture(ctx, b, index) {
  const floors = b.floors ?? (2 + index % 5), z = floors * 24, r = Math.min(b.w/5,b.h/5,b.cornerRadius ?? (16 + index % 3 * 3));
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
  const typePalette={warehouse:4,office:3,deco:5,townhouse:0,shop:2,pavilion:4,tenement:1,
    hospital:3,firestation:2,airfield:3,civic:5,depot:4};
  const walls=palettes[typePalette[type]??index%palettes.length];

  // Street-facing walls, including the chamfered corners.
  for(let side=2;side<=5;side++){
    const a=base[side], c=base[(side+1)%base.length], length=Math.hypot(c[0]-a[0],c[1]-a[1]);
    const p=(t,h)=>[a[0]+(c[0]-a[0])*t-h,a[1]+(c[1]-a[1])*t-h];
    const cell=(u,v,du,dv,color)=>polygon([p(u,v),p(u+du,v),p(u+du,v+dv),p(u,v+dv)],color);
    polygon([a,c,[c[0]-z,c[1]-z],[a[0]-z,a[1]-z]],walls[side-2]);

    ctx.strokeStyle='rgba(13,9,8,.28)'; ctx.lineWidth=1;
    for(let h=7;h<z;h+=7){ctx.beginPath();ctx.moveTo(...p(0,h));ctx.lineTo(...p(1,h));ctx.stroke();}
    if(type!=='office'&&type!=='warehouse'){
      // Staggered mortar joints and small weathered bricks add readable material.
      ctx.strokeStyle='rgba(12,10,8,.22)';ctx.lineWidth=.7;
      for(let row=0;row<z/7;row++)for(let n=8+(row%2)*9;n<length;n+=18){
        ctx.beginPath();ctx.moveTo(...p(n/length,row*7));ctx.lineTo(...p(n/length,Math.min(z,row*7+7)));ctx.stroke();
        if((n+row*13+index)%7===0)cell((n-7)/length,row*7+1,6/length,4,'rgba(187,144,93,.07)');
      }
    }
    for(let floor=1;floor<floors;floor++)cell(0,floor*24-2,1,2.5,'rgba(12,9,8,.35)');

    for(let floor=0;floor<floors;floor++)for(let n=11;n<length-18;n+=28){
      const lit=(n+floor*17+index*11)%13>4;
      cell(n/length,6+floor*24,15/length,13,'#090d10');
      cell((n+2)/length,8+floor*24,11/length,9,lit?(floor===0?'#ffd073':'#b98242'):'#172329');
      cell((n+7)/length,8+floor*24,1/length,9,'rgba(24,16,12,.72)');
      cell((n-1)/length,5+floor*24,17/length,1.3,'rgba(161,141,109,.35)');
      if(lit&&floor===0)cell((n-2)/length,0,19/length,2,'rgba(230,164,73,.24)');
    }

    if(type==='warehouse'&&length>90){
      for(let n=16;n<length-32;n+=58){cell(n/length,2,35/length,21,'#12191b');cell((n+3)/length,5,29/length,16,'#394246');}
      ctx.strokeStyle='rgba(205,194,166,.22)';for(let n=8;n<length;n+=12){ctx.beginPath();ctx.moveTo(...p(n/length,0));ctx.lineTo(...p(n/length,z));ctx.stroke();}
    }
    if(type==='firestation'&&side===2&&length>90){
      cell(.29,1,.43,29,'#5f2926');cell(.32,4,.37,23,'#323b3b');
      ctx.strokeStyle='rgba(215,203,171,.48)';ctx.lineWidth=1.4;
      for(let door=0;door<4;door++){
        const q=p(.33+door*.095,5);ctx.beginPath();ctx.moveTo(q[0],q[1]);
        const e=p(.33+door*.095,25);ctx.lineTo(e[0],e[1]);ctx.stroke();
      }
      cell(.46,29,.12,3,'#dc9a4a');
    }
    if(type==='hospital'&&side===2&&length>90){
      cell(.13,28,.23,3,'#e6ddd0');cell(.21,23,.07,13,'#e6ddd0');
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
  const roofColors={warehouse:'#273033',office:'#17252d',deco:'#2c2630',townhouse:'#302a25',shop:'#252a27',pavilion:'#28332f',tenement:'#292728',
    hospital:'#26343a',firestation:'#402b28',airfield:'#28363a',civic:'#332f38',depot:'#303333'};
  polygon(base.map(([x,y])=>[x-z,y-z]),roofColors[type]||(index%2?'#242526':'#2c2926'));
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
  if(type==='hospital'||type==='firestation'||type==='airfield'||type==='depot'||type==='civic'){
    const cx=b.x+b.w*.52,cy=b.y+b.h*.48;
    ctx.strokeStyle='rgba(220,210,187,.6)';ctx.lineWidth=2;ctx.strokeRect(cx-24,cy-17,48,34);
    if(type==='hospital'){
      ctx.fillStyle='#ddd8ca';ctx.fillRect(cx-17,cy-12,34,24);ctx.fillStyle='#b44739';ctx.fillRect(cx-3,cy-9,6,18);ctx.fillRect(cx-9,cy-3,18,6);
    }else if(type==='firestation'){
      ctx.fillStyle='#69332c';ctx.fillRect(cx-18,cy-11,36,22);ctx.fillStyle='#c48632';ctx.fillRect(cx-13,cy-8,26,2);ctx.fillRect(cx-13,cy-3,26,2);ctx.fillRect(cx-13,cy+2,26,2);
    }else if(type==='airfield'){
      ctx.strokeStyle='#ddd9ca';ctx.lineWidth=4;ctx.beginPath();ctx.moveTo(cx-18,cy);ctx.lineTo(cx+18,cy);ctx.stroke();ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(cx,cy-12);ctx.lineTo(cx,cy+12);ctx.stroke();
    }else if(type==='depot'){
      ctx.fillStyle='#b69054';for(let bay=0;bay<3;bay++)ctx.fillRect(cx-16+bay*11,cy-8,7,16);
    }else if(b.civicType==='airAmbulanceBase'){
      ctx.fillStyle='#26343a';ctx.fillRect(cx-18,cy-11,36,22);ctx.strokeStyle='#d5ddd0';ctx.lineWidth=2;
      ctx.beginPath();ctx.moveTo(cx-13,cy);ctx.lineTo(cx+13,cy);ctx.moveTo(cx,cy-8);ctx.lineTo(cx,cy+8);ctx.stroke();
      ctx.fillStyle='#d5ddd0';ctx.font='bold 7px monospace';ctx.textAlign='center';ctx.fillText('H',cx,cy+3);
    }else if(b.civicType==='marineRescueBase'){
      ctx.strokeStyle='#ddd9ca';ctx.lineWidth=4;ctx.beginPath();ctx.arc(cx,cy,12,0,Math.PI*2);ctx.stroke();
      ctx.strokeStyle='#bd4b3d';ctx.lineWidth=5;ctx.beginPath();ctx.moveTo(cx-10,cy-6);ctx.lineTo(cx+10,cy+6);ctx.moveTo(cx-10,cy+6);ctx.lineTo(cx+10,cy-6);ctx.stroke();
      ctx.fillStyle='#d5ddd0';ctx.font='bold 6px monospace';ctx.textAlign='center';ctx.fillText('SAR',cx,cy+20);
    }else if(b.civicType==='guardBase'){
      ctx.fillStyle='#62694f';ctx.beginPath();ctx.moveTo(cx-17,cy-12);ctx.lineTo(cx+17,cy-12);ctx.lineTo(cx+14,cy+6);ctx.lineTo(cx,cy+15);ctx.lineTo(cx-14,cy+6);ctx.closePath();ctx.fill();
      ctx.strokeStyle='#c1a44e';ctx.lineWidth=2;ctx.stroke();
      ctx.fillStyle='#dfd4ad';ctx.font='bold 9px monospace';ctx.textAlign='center';ctx.fillText('NG',cx,cy+3);
    }else{
      ctx.fillStyle='#b9ad8b';ctx.fillRect(cx-15,cy-8,30,16);ctx.fillStyle='#625962';ctx.fillRect(cx-4,cy-8,8,16);ctx.fillRect(cx-15,cy-2,30,4);
    }
  }
  // Distinct roof masses, not the same flat slab on every property.
  if(type==='townhouse'||type==='pavilion'){
    const ridge=type==='townhouse'?24:17;
    polygon([[b.x+8,b.y+8],[b.x+b.w/2-ridge,b.y+8-ridge],[b.x+b.w/2-ridge,b.y+b.h-8-ridge],[b.x+8,b.y+b.h-8]],'#654536');
    polygon([[b.x+b.w/2-ridge,b.y+8-ridge],[b.x+b.w-8,b.y+8],[b.x+b.w-8,b.y+b.h-8],[b.x+b.w/2-ridge,b.y+b.h-8-ridge]],'#362f2c');
    ctx.strokeStyle='#987659';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(b.x+b.w/2-ridge,b.y+8-ridge);ctx.lineTo(b.x+b.w/2-ridge,b.y+b.h-8-ridge);ctx.stroke();
  }
  if(type==='office'||type==='deco'){
    const inset=Math.min(b.w,b.h)*.23,lift=type==='deco'?30:19;
    const x=b.x+inset,y=b.y+inset,w=b.w-inset*2,h=b.h-inset*2;
    polygon([[x+w,y],[x+w,y+h],[x,y+h],[x-lift,y+h-lift],[x+w-lift,y+h-lift],[x+w-lift,y-lift]],'#38423e');
    polygon([[x-lift,y-lift],[x+w-lift,y-lift],[x+w-lift,y+h-lift],[x-lift,y+h-lift]],type==='deco'?'#797260':'#33474d');
    ctx.strokeStyle='#b29c6b';ctx.lineWidth=2;ctx.stroke();
  }
  ctx.restore();

  ctx.save();ctx.translate(b.x+b.w*.23-28,b.y+b.h-28);ctx.transform(1,0,1,1,0,0);ctx.fillStyle='rgba(8,9,9,.94)';ctx.fillRect(0,0,b.w*.55,18);
  ctx.fillStyle=b.neon||'#e09a3e';ctx.shadowColor=ctx.fillStyle;ctx.shadowBlur=6;ctx.font='900 11px monospace';ctx.textAlign='center';ctx.fillText(b.sign,b.w*.275,13,b.w*.5);ctx.shadowBlur=0;ctx.restore();
  ctx.restore();
}

export function drawStreetTree(ctx,t,index=0){
  const radius=t.size||20,height=radius*1.6;
  ctx.fillStyle='rgba(0,0,0,.38)';ctx.beginPath();ctx.ellipse(t.x+13,t.y+10,radius*1.1,radius*.75,0,0,Math.PI*2);ctx.fill();
  ctx.strokeStyle='#3b3023';ctx.lineWidth=6;ctx.beginPath();ctx.moveTo(t.x,t.y);ctx.lineTo(t.x-height,t.y-height);ctx.stroke();
  ctx.strokeStyle='#68503a';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(t.x-1,t.y-2);ctx.lineTo(t.x-height+1,t.y-height);ctx.stroke();
  for(let i=0;i<15;i++){
    const a=i*2.4+index*.6,r=Math.sqrt((i+.5)/15)*radius*.65;
    const x=t.x-height+Math.cos(a)*r,y=t.y-height+Math.sin(a)*r;
    const shade=['#1b3025','#263c2a','#314530','#3c5135'][i%4];
    ctx.fillStyle=shade;ctx.beginPath();ctx.arc(x,y,radius*(.35+(i%3)*.07),0,Math.PI*2);ctx.fill();
    ctx.fillStyle='rgba(145,151,89,.09)';ctx.beginPath();ctx.arc(x-3,y-3,radius*.22,0,Math.PI*2);ctx.fill();
  }
}

export function drawStreetFurniture(ctx,p){
  const poly=(points,color)=>{ctx.beginPath();points.forEach(([x,y],i)=>i?ctx.lineTo(x,y):ctx.moveTo(x,y));ctx.closePath();ctx.fillStyle=color;ctx.fill();};
  const box=(x,y,w,h,z,color)=>{
    const a=[x-w/2,y-h/2],b=[x+w/2,y-h/2],c=[x+w/2,y+h/2],d=[x-w/2,y+h/2],up=q=>[q[0]-z,q[1]-z];
    poly([b,c,up(c),up(b)],'#252e2d');poly([c,d,up(d),up(c)],color);poly([up(a),up(b),up(c),up(d)],'#74766b');
  };
  const {x,y}=p;
  if(p.type==='shelter'){
    for(const dx of [-27,27])for(const dy of [-10,10])box(x+dx,y+dy,3,3,32,'#687574');
    poly([[x-30,y+12],[x+30,y+12],[x,y-18],[x-60,y-18]],'rgba(92,126,129,.4)');
    box(x-32,y-32,66,30,4,'#3a4545');box(x,y+6,45,8,7,'#76573c');
  }else if(p.type==='kiosk'){
    box(x,y,42,30,26,'#614734');box(x-27,y-27,49,36,3,'#938673');
    poly([[x-14,y+15],[x+12,y+15],[x-4,y-1],[x-30,y-1]],'#caac70');
  }else if(p.type==='phone'){
    box(x,y,20,24,38,'#752f28');
    poly([[x-7,y+13],[x+7,y+13],[x-23,y-17],[x-37,y-17]],'rgba(164,185,174,.55)');
    box(x-39,y-39,24,28,2,'#af6d50');
  }else if(p.type==='bin'){
    box(x,y,15,16,14,'#344b3c');box(x-14,y-14,18,19,2,'#657266');
  }else if(p.type==='bollard'){
    box(x,y,7,7,12,'#42463d');box(x-10,y-10,8,8,3,'#c9a552');
  }else if(p.type==='workzone'){
    box(x,y,73,8,12,'#bd7936');
    for(let n=-28;n<30;n+=18)box(x+n,y,8,9,12,'#292c28');
  }
}

export function drawRoundedJunction(ctx,h,v,asphalt){
  const radius=34;
  for(const [x,y,sx,sy] of [[v.x,h.y,-1,-1],[v.x+v.w,h.y,1,-1],[v.x+v.w,h.y+h.h,1,1],[v.x,h.y+h.h,-1,1]]){
    ctx.save();ctx.translate(x,y);ctx.scale(sx,sy);ctx.beginPath();ctx.moveTo(-2,-2);ctx.lineTo(radius,-2);ctx.lineTo(radius,0);ctx.quadraticCurveTo(0,0,0,radius);ctx.lineTo(-2,radius);ctx.closePath();ctx.fillStyle=asphalt;ctx.fill();
    ctx.beginPath();ctx.moveTo(radius,0);ctx.quadraticCurveTo(0,0,0,radius);ctx.strokeStyle='#5d5b54';ctx.lineWidth=3;ctx.stroke();ctx.restore();
  }
}
