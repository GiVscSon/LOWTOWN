import { resolveScenery, resolveContact, contact, chassis } from './solid_contacts.js';
export const VEHICLES = {
  sedan: { name:'Седан', kind:'land', width:48,height:24,max:8.8,color:'#e09a3e' },
  van: { name:'Фургон',kind:'land',width:64,height:28,max:6,color:'#9aa0a8' },
  truck: { name:'Грузовик',kind:'land',width:84,height:32,max:5,color:'#807657' },
  bike: { name:'Мотоцикл',kind:'land',width:30,height:12,max:11,color:'#d4523a' },
  speedboat: { name:'Катер',kind:'water',width:66,height:26,max:8,color:'#d7d2bd' },
  tug: { name:'Буксир',kind:'water',width:90,height:38,max:4,color:'#c18a42' },
  helicopter: { name:'Вертолёт',kind:'air',width:64,height:26,max:8,color:'#7d8868' },
  plane: { name:'Самолёт',kind:'air',width:86,height:80,max:13,color:'#c5c8c5' }
};
export function createFreeRoam(player, parked, buildings, trees, solid, notify=()=>{}, obstacles=[]) {
  const fleet=[
    // Keep the test-drive spawn and first junction clear. Land vehicles wait in
    // marked kerb bays instead of blocking the player on the first frame.
    ['van',1760,1092],['truck',2240,1092],['bike',1510,1092],
    ['helicopter',1040,2070],['plane',1660,2190],
    ['speedboat',2558,1800],['tug',2558,2090],
    ['speedboat',4908,1750],['tug',4908,2050],['helicopter',6550,2070],
    ['van',3410,4210],['truck',4340,4210],['bike',5750,4095],
    ['van',1080,7210],['truck',3460,7210],['bike',5740,7095],
    ['speedboat',2558,7680],['tug',4908,7740],['helicopter',6500,8080],
    ['speedboat',7080,4700],['tug',7080,7500],['speedboat',9720,8700],['tug',7100,10550]
  ].map(([type,x,y])=>({type,x,y,angle:VEHICLES[type].kind==='water'?Math.PI/2:0,...VEHICLES[type],speed:0}));
  let mode='sedan', altitude=0;
  const footClear=(x,y)=>solid(x,y)&&!buildings.some(b=>x>b.x-5&&x<b.x+b.w+5&&y>b.y-5&&y<b.y+b.h+5)&&
    !obstacles.some(o=>Math.abs(x-o.x)<(o.width||12)*.5+5&&Math.abs(y-o.y)<(o.height||12)*.5+5)&&
    ![...fleet,...parked].some(c=>contact({x,y,angle:0,length:9,breadth:9},chassis(c)));
  const vehicleClear=(x,y)=>solid(x,y)&&!buildings.some(b=>x>b.x-12&&x<b.x+b.w+12&&y>b.y-12&&y<b.y+b.h+12)&&
    !obstacles.some(o=>Math.abs(x-o.x)<(o.width||12)*.5+12&&Math.abs(y-o.y)<(o.height||12)*.5+12)&&
    ![...fleet,...parked].some(c=>contact({x,y,angle:0,length:16,breadth:16},chassis(c)));
  function interact() {
    if(mode!=='foot') {
      if(Math.abs(player.speed)>.5||altitude>1) return notify('Остановитесь и приземлитесь перед выходом');
      let exit;
      for(const radius of [38,60,85,110]) for(let i=0;i<16&&!exit;i++) {
        const a=player.angle+Math.PI/2+i*Math.PI/8,x=player.x+Math.cos(a)*radius,y=player.y+Math.sin(a)*radius;
        if(footClear(x,y)) exit={x,y};
      }
      if(!exit)return notify('Нет безопасного выхода: подъедьте к берегу или свободному месту');
      fleet.push({...VEHICLES[mode],type:mode,x:player.x,y:player.y,angle:player.angle,speed:0});
      Object.assign(player,exit,{entityType:'pedestrian',width:9,height:9,speed:0,vx:0,vy:0}); mode='foot'; notify('Пешком · E — сесть в ближайший транспорт'); return;
    }
    const candidates=[...fleet,...parked].filter(c=>Math.hypot(c.x-player.x,c.y-player.y)<115).sort((a,b)=>Math.hypot(a.x-player.x,a.y-player.y)-Math.hypot(b.x-player.x,b.y-player.y));
    const car=candidates[0]; if(!car)return notify('Подойдите к припаркованному транспорту');
    mode=car.type in VEHICLES?car.type:'sedan'; const profile=VEHICLES[mode];
    Object.assign(player,{entityType:'vehicle',x:car.x,y:car.y,angle:car.angle,width:profile.width,height:profile.height,bodyColor:car.color||profile.color,speed:0,vx:0,vy:0});
    const list=fleet.includes(car)?fleet:parked; list.splice(list.indexOf(car),1);
    notify(profile.name+(profile.kind==='air'?' · кнопка «Высота» / Q — взлёт и посадка':''));
  }
  let fly=false;
  const landingClear=()=>{
    const halfX=player.width/2+8,halfY=player.height/2+8;
    for(const [dx,dy] of [[0,0],[halfX,halfY],[halfX,-halfY],[-halfX,halfY],[-halfX,-halfY]]) {
      const x=player.x+dx*Math.cos(player.angle)-dy*Math.sin(player.angle),y=player.y+dx*Math.sin(player.angle)+dy*Math.cos(player.angle);
      if(!vehicleClear(x,y))return false;
    }
    return true;
  };
  function toggleFlight(){if(VEHICLES[mode]?.kind==='air'){fly=!fly;notify(fly?'Набор высоты':'Снижение: найдите свободную площадку');}}
  function step(keys,dt) {
    const profile=VEHICLES[mode]; if(profile?.kind==='land') return false;
    const frame=Math.min(dt,.05)*60;
    if(mode==='foot') {
      const dx=Number(!!keys.right)-Number(!!keys.left),dy=Number(!!keys.down)-Number(!!keys.up),len=Math.hypot(dx,dy)||1;
      const x=player.x+dx/len*2.4*frame,y=player.y+dy/len*2.4*frame;
      // Axis-separated sweep lets a person slide along walls and through narrow alleys.
      if(footClear(x,player.y))player.x=x;
      if(footClear(player.x,y))player.y=y;
      if(dx||dy)player.angle=Math.atan2(dy,dx);
      player.speed=0;player.rpm=0;player.gear='ПЕШКОМ'; return true;
    }
    if(profile.kind==='air') {
      if(!fly&&altitude<=5&&!landingClear()){altitude=6;notify('Посадка невозможна: вода или препятствие');fly=true;}
      altitude=Math.max(0,Math.min(130,altitude+(fly?1.3:-1)*frame));
    }
    const max=profile.kind==='air'&&altitude<12?2:profile.max;
    player.speed=Math.max(-max*.3,Math.min(max,player.speed+((keys.up ? .10 : 0)-(keys.down ? .14 : 0))*frame));
    player.speed*=Math.pow(keys.handbrake ? .9 : .99,frame);
    player.angle+=(Number(!!keys.right)-Number(!!keys.left))*.032*frame*(profile.kind==='water'?Math.min(1,Math.abs(player.speed)/2):1);
    const ox=player.x,oy=player.y;
    player.x+=Math.cos(player.angle)*player.speed*frame;player.y+=Math.sin(player.angle)*player.speed*frame;
    const body=chassis(player),fx=Math.cos(player.angle)*body.length/2,fy=Math.sin(player.angle)*body.length/2,rx=-Math.sin(player.angle)*body.breadth/2,ry=Math.cos(player.angle)*body.breadth/2;
    if(profile.kind==='water'&&[[0,0],[fx+rx,fy+ry],[fx-rx,fy-ry],[-fx+rx,-fy+ry],[-fx-rx,-fy-ry]].some(([x,y])=>solid(player.x+x,player.y+y))){player.x=ox;player.y=oy;player.speed*=-.2;}
    if(profile.kind==='air'&&altitude<12){if(!solid(player.x,player.y)){player.x=ox;player.y=oy;player.speed=0;}resolveScenery(player,buildings,trees,obstacles);}
    // The expanded city is 10.1 x 11.7k; the previous legacy clamp stopped
    // boats and aircraft at the old map edge and made the world feel cut off.
    player.x=Math.max(-900,Math.min(11000,player.x));player.y=Math.max(-900,Math.min(12600,player.y));
    player.rpm=Math.abs(player.speed)/max;player.gear=profile.kind==='air'?`${Math.round(altitude)} м`:'ВОДА';return true;
  }
  function contacts(){if(mode==='foot'||altitude>12)return;for(const car of fleet)if(VEHICLES[car.type].kind===VEHICLES[mode].kind)resolveContact(player,car,true);}
  return {fleet,interact,toggleFlight,step,contacts,get mode(){return mode;},get altitude(){return altitude;},get special(){return mode==='foot'||VEHICLES[mode].kind!=='land';},get profile(){return VEHICLES[mode];}};
}

export function drawTransport(ctx,car,time=0,altitude=0) {
  ctx.save();ctx.translate(car.x,car.y);
  if(car.kind==='water'){
    ctx.save();ctx.rotate(car.angle);ctx.strokeStyle='rgba(191,221,223,.28)';ctx.lineWidth=3;
    for(const side of [-1,1]){ctx.beginPath();ctx.moveTo(-car.width*.2,side*car.height*.45);ctx.quadraticCurveTo(-car.width*.8,side*car.height*.85,-car.width*1.35,side*car.height*.58);ctx.stroke();}
    ctx.restore();
  }
  const shadowLift=Math.max(0,altitude)*.18;
  ctx.fillStyle=`rgba(0,0,0,${Math.max(.12,.46-altitude/420)})`;ctx.beginPath();ctx.ellipse(10+shadowLift,10+shadowLift,car.width*.62,Math.max(7,car.height*.55),car.angle,0,Math.PI*2);ctx.fill();
  ctx.translate(-altitude,-altitude);ctx.rotate(car.angle);ctx.strokeStyle='#111719';ctx.lineWidth=1.7;
  const cs=Math.cos(car.angle),sn=Math.sin(car.angle),z=car.kind==='water'?7:5,zx=-z*(cs+sn),zy=z*(sn-cs);
  const poly=(points,fill,stroke=false)=>{ctx.beginPath();points.forEach(([x,y],i)=>i?ctx.lineTo(x,y):ctx.moveTo(x,y));ctx.closePath();ctx.fillStyle=fill;ctx.fill();if(stroke)ctx.stroke();};
  const extrude=(shape,top,side='rgba(24,28,29,.94)',lift=1)=>{
    const ox=zx*lift,oy=zy*lift;
    for(let i=0;i<shape.length;i++){const a=shape[i],b=shape[(i+1)%shape.length];poly([a,b,[b[0]+ox,b[1]+oy],[a[0]+ox,a[1]+oy]],side);}
    const raised=shape.map(([x,y])=>[x+ox,y+oy]);poly(raised,top,true);return raised;
  };
  const lights=(frontX,halfH)=>{ctx.fillStyle='#ffe6a0';ctx.shadowColor='#ffd36a';ctx.shadowBlur=5;ctx.fillRect(frontX+zx,-halfH+3+zy,3,5);ctx.fillRect(frontX+zx,halfH-8+zy,3,5);ctx.shadowBlur=0;};

  if(car.kind==='water') {
    const hull=[[car.width/2,0],[car.width*.2,-car.height/2],[-car.width/2,-car.height*.4],[-car.width/2,car.height*.4],[car.width*.2,car.height/2]];
    extrude(hull,car.color||'#b9b5a7','#263236');
    ctx.strokeStyle='rgba(232,235,220,.45)';ctx.beginPath();ctx.moveTo(-car.width*.32+zx,-car.height*.34+zy);ctx.lineTo(car.width*.24+zx,-car.height*.44+zy);ctx.lineTo(car.width*.43+zx,zy);ctx.stroke();
    if(car.type==='tug'){
      extrude([[-18,-12],[12,-12],[17,12],[-18,12]],'#b89152','#3b3c36',1.7);
      ctx.fillStyle='#18313a';ctx.fillRect(-10+zx*1.85,-10+zy*1.85,18,20);ctx.fillStyle='#24201b';ctx.fillRect(-15+zx*2.2,-5+zy*2.2,7,10);ctx.fillStyle='#66533a';ctx.fillRect(-14+zx*2.2,-2+zy*2.2,5,4);
      ctx.strokeStyle='#c4bea8';ctx.lineWidth=1.5;ctx.beginPath();ctx.moveTo(-22+zx,-15+zy);ctx.lineTo(23+zx,-17+zy);ctx.moveTo(-22+zx,15+zy);ctx.lineTo(23+zx,17+zy);ctx.stroke();
    }else{
      extrude([[-15,-car.height*.28],[11,-car.height*.25],[19,car.height*.24],[-15,car.height*.28]],'#263f48','#15262c',1.55);
      poly([[5+zx*1.8,-car.height*.22+zy*1.8],[18+zx*1.8,-car.height*.1+zy*1.8],[18+zx*1.8,car.height*.1+zy*1.8],[5+zx*1.8,car.height*.22+zy*1.8]],'rgba(104,157,169,.72)',true);
    }
  } else if(car.kind==='air') {
    if(car.type==='plane'){
      const plane=[[43,0],[12,-6],[2,-39],[-8,-39],[-7,-7],[-34,-17],[-43,-13],[-22,0],[-43,13],[-34,17],[-7,7],[-8,39],[2,39],[12,6]];
      extrude(plane,car.color||'#c5c8c5','#4b5251',1.15);
      poly([[34+zx*1.25,-3+zy*1.25],[8+zx*1.25,-3+zy*1.25],[8+zx*1.25,3+zy*1.25],[34+zx*1.25,3+zy*1.25]],'#274552',true);
      ctx.fillStyle='#d4523a';ctx.fillRect(-8+zx,-39+zy,7,4);ctx.fillRect(-8+zx,35+zy,7,4);
    }else{
      extrude([[27,0],[12,-13],[-10,-14],[-24,-6],[-46,-4],[-51,0],[-46,4],[-24,6],[-10,14],[12,13]],car.color||'#7d8868','#303833',1.2);
      poly([[21+zx*1.45,-8+zy*1.45],[8+zx*1.45,-10+zy*1.45],[8+zx*1.45,10+zy*1.45],[21+zx*1.45,8+zy*1.45]],'rgba(75,119,132,.8)',true);
      ctx.strokeStyle='#303536';ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(-8+zx,-17+zy);ctx.lineTo(-15+zx,-23+zy);ctx.moveTo(9+zx,17+zy);ctx.lineTo(16+zx,23+zy);ctx.stroke();
      ctx.save();ctx.translate(zx*1.55,zy*1.55);ctx.rotate(time*(altitude>0?22:1));ctx.fillStyle='rgba(190,198,192,.7)';ctx.fillRect(-57,-2.2,114,4.4);ctx.fillRect(-2.2,-57,4.4,114);ctx.fillStyle='#222829';ctx.beginPath();ctx.arc(0,0,5,0,Math.PI*2);ctx.fill();ctx.restore();
    }
  } else if(car.type==='bike'){
    ctx.fillStyle='#080a0b';ctx.beginPath();ctx.ellipse(-10,-5,7,4,0,0,Math.PI*2);ctx.ellipse(10,5,7,4,0,0,Math.PI*2);ctx.fill();
    ctx.strokeStyle=car.color||'#d4523a';ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(-9,-4);ctx.lineTo(0,0);ctx.lineTo(10,4);ctx.moveTo(0,0);ctx.lineTo(4,-5);ctx.stroke();ctx.fillStyle='#20282b';ctx.fillRect(-3,-4,11,8);ctx.fillStyle='#8f8574';ctx.fillRect(-7,-6,10,3);ctx.fillStyle='#ffe2a0';ctx.beginPath();ctx.arc(13+zx,5+zy,2.5,0,Math.PI*2);ctx.fill();
  } else if(car.type==='truck'){
    ctx.fillStyle='#060708';for(const x of [-28,3,28])for(const y of [-car.height*.55,car.height*.45])ctx.fillRect(x-5,y,11,5);
    extrude([[-42,-16],[12,-16],[12,16],[-42,16]],car.color||'#807657','#34332d');
    extrude([[13,-15],[40,-13],[42,13],[13,15]],'#9b8c68','#3b3931',1.3);
    ctx.strokeStyle='rgba(222,211,174,.26)';for(let x=-35;x<8;x+=10){ctx.beginPath();ctx.moveTo(x+zx,-14+zy);ctx.lineTo(x+zx,14+zy);ctx.stroke();}
    poly([[24+zx*1.45,-11+zy*1.45],[37+zx*1.45,-9+zy*1.45],[37+zx*1.45,9+zy*1.45],[24+zx*1.45,11+zy*1.45]],'#263f49',true);lights(39,14);
  } else {
    const w=car.width,h=car.height;
    ctx.fillStyle='#060708';for(const x of [-w*.3,w*.26])for(const y of [-h*.55,h*.44])ctx.fillRect(x-5,y,11,5);
    const body=[[-w*.5+h*.12,-h*.5],[w*.38,-h*.5],[w*.5,-h*.28],[w*.5,h*.28],[w*.38,h*.5],[-w*.5+h*.12,h*.5],[-w*.5,h*.25],[-w*.5,-h*.25]];
    extrude(body,car.color||'#b9b5a7','#202526');
    const cabin=car.type==='van'?[[-w*.22,-h*.38],[w*.28,-h*.35],[w*.34,h*.28],[-w*.22,h*.38]]:[[-w*.18,-h*.34],[w*.2,-h*.32],[w*.27,h*.25],[-w*.18,h*.34]];
    extrude(cabin,'#243c46','#131f24',1.65);
    ctx.strokeStyle='rgba(220,228,217,.23)';ctx.beginPath();ctx.moveTo(5+zx*1.7,-h*.3+zy*1.7);ctx.lineTo(5+zx*1.7,h*.3+zy*1.7);ctx.stroke();
    if(car.type==='van'){ctx.strokeStyle='rgba(20,22,23,.55)';ctx.beginPath();ctx.moveTo(-w*.32+zx,-h*.45+zy);ctx.lineTo(-w*.32+zx,h*.45+zy);ctx.stroke();}
    lights(w*.46,h*.5);
  }
  ctx.restore();
}
