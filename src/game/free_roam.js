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
export function createFreeRoam(player, parked, buildings, trees, solid, notify=()=>{}) {
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
    ![...fleet,...parked].some(c=>contact({x,y,angle:0,length:9,breadth:9},chassis(c)));
  const vehicleClear=(x,y)=>solid(x,y)&&!buildings.some(b=>x>b.x-12&&x<b.x+b.w+12&&y>b.y-12&&y<b.y+b.h+12)&&
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
    if(profile.kind==='air'&&altitude<12){if(!solid(player.x,player.y)){player.x=ox;player.y=oy;player.speed=0;}resolveScenery(player,buildings,trees);}
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
    ctx.save();ctx.rotate(car.angle);ctx.strokeStyle='rgba(191,221,223,.24)';ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(-car.width*.35,-car.height*.45);ctx.quadraticCurveTo(-car.width*.85,-car.height*.8,-car.width*1.25,-car.height*.55);ctx.moveTo(-car.width*.35,car.height*.45);ctx.quadraticCurveTo(-car.width*.85,car.height*.8,-car.width*1.25,car.height*.55);ctx.stroke();ctx.restore();
  }
  ctx.fillStyle='rgba(0,0,0,.4)';ctx.beginPath();ctx.ellipse(10,10,car.width*.6,car.height*.55,car.angle,0,Math.PI*2);ctx.fill();
  // Equal world offsets project into a vertical screen displacement.
  ctx.translate(-altitude,-altitude);ctx.rotate(car.angle);ctx.fillStyle=car.color||'#b9b5a7';ctx.strokeStyle='#15191b';ctx.lineWidth=2;
  const cs=Math.cos(car.angle),sn=Math.sin(car.angle),z=car.kind==='water'?6:4,zx=-z*(cs+sn),zy=z*(sn-cs);
  const poly=(points,fill,stroke=false)=>{ctx.beginPath();points.forEach(([x,y],i)=>i?ctx.lineTo(x,y):ctx.moveTo(x,y));ctx.closePath();ctx.fillStyle=fill;ctx.fill();if(stroke)ctx.stroke();};
  if(car.kind==='water') {
    const hull=[[car.width/2,0],[car.width*.2,-car.height/2],[-car.width/2,-car.height*.4],[-car.width/2,car.height*.4],[car.width*.2,car.height/2]];
    for(let i=0;i<hull.length;i++){const a=hull[i],b=hull[(i+1)%hull.length];if(i>0)poly([a,b,[b[0]+zx,b[1]+zy],[a[0]+zx,a[1]+zy]],'rgba(39,48,49,.92)');}
    poly(hull.map(([x,y])=>[x+zx,y+zy]),car.color||'#b9b5a7',true);
    poly([[-15+zx,-car.height*.28+zy],[12+zx,-car.height*.25+zy],[18+zx,car.height*.24+zy],[-15+zx,car.height*.28+zy]],'#263f48',true);
    ctx.fillStyle='#d8cda9';ctx.fillRect(-4+zx*1.6,-car.height*.19+zy*1.6,18,car.height*.38);
    ctx.fillStyle='#16272d';ctx.fillRect(2+zx*1.75,-car.height*.14+zy*1.75,10,car.height*.28);
  }
  else if(car.kind==='air') {
    if(car.type==='plane'){ctx.fillRect(-8,-40,18,80);ctx.fillRect(-35,-22,9,44);}
    ctx.beginPath();ctx.ellipse(0,0,car.width/2,12,0,0,Math.PI*2);ctx.fill();ctx.stroke();ctx.fillStyle='#243d48';ctx.fillRect(8,-8,15,16);
    if(car.type==='helicopter'){ctx.rotate(time*(altitude>0?22:1));ctx.fillStyle='rgba(175,181,177,.7)';ctx.fillRect(-55,-3,110,6);ctx.fillRect(-3,-55,6,110);}
  } else {
    poly([[-car.width/2,-car.height/2],[car.width/2,-car.height/2],[car.width/2,car.height/2],[-car.width/2,car.height/2]],'rgba(20,22,23,.9)');
    poly([[-car.width/2+zx,-car.height/2+zy],[car.width/2+zx,-car.height/2+zy],[car.width/2+zx,car.height/2+zy],[-car.width/2+zx,car.height/2+zy]],car.color||'#b9b5a7',true);
    ctx.fillStyle='#263d46';ctx.fillRect(5+zx*1.5,-car.height/2+4+zy*1.5,14,car.height-8);
  }
  ctx.restore();
}
