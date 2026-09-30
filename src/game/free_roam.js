import { resolveScenery, resolveContact, contact, chassis } from './solid_contacts.js';
export const VEHICLES = {
  sedan: { name:'Седан', kind:'land', width:48,height:24,max:8.8,mass:1500,offroad:.78,color:'#e09a3e' },
  van: { name:'Фургон',kind:'land',width:64,height:28,max:6,accel:.12,steer:.034,mass:2200,offroad:.96,color:'#9aa0a8' },
  truck: { name:'Грузовик',kind:'land',width:84,height:32,max:5,accel:.075,steer:.024,mass:5200,offroad:1.28,color:'#807657' },
  bike: { name:'Мотоцикл',kind:'land',width:30,height:12,max:11,accel:.22,steer:.052,mass:190,offroad:.9,color:'#d4523a' },
  speedboat: { name:'Катер',kind:'water',width:66,height:26,max:8,mass:1800,color:'#d7d2bd' },
  tug: { name:'Буксир',kind:'water',width:90,height:38,max:4,mass:12000,color:'#c18a42' },
  helicopter: { name:'Вертолёт',kind:'air',width:64,height:26,max:8,mass:1900,color:'#7d8868' },
  plane: { name:'Самолёт',kind:'air',width:86,height:80,max:13,mass:900,color:'#c5c8c5' }
};
export const PLANE_RUNWAYS = [
  { x: 1400, y: 2140, w: 650, h: 100 },
  { x: 1400, y: 8040, w: 650, h: 100 }
  ,{ x: 7600, y: 8040, w: 1400, h: 100 }
];
export function isPlaneRunway(x,y,margin=0){
  return PLANE_RUNWAYS.some(r=>x>=r.x-margin&&x<=r.x+r.w+margin&&y>=r.y-margin&&y<=r.y+r.h+margin);
}
export function createFreeRoam(player, parked, buildings, trees, solid, notify=()=>{}, obstacles=[], waterBlocked=solid, dynamicActors=()=>[]) {
  const fleet=[
    // Keep the test-drive spawn and first junction clear. Land vehicles wait in
    // marked kerb bays instead of blocking the player on the first frame.
    ['van',1760,1092],['truck',2240,1092],['bike',1510,1092],
    ['helicopter',1040,2070],['plane',1660,2190],
    ['speedboat',2558,1800],['tug',2558,2090],
    ['speedboat',4908,1750],['tug',4908,2050],['helicopter',6550,2070],
    ['van',3510,4288],['truck',4430,4288],['bike',5750,4095],
    ['van',1080,7088],['truck',3460,7288],['bike',5740,7095],
    ['speedboat',2558,7680],['tug',4908,7740],['helicopter',6500,8080],
    ['speedboat',7080,4700],['tug',7080,7500],['speedboat',9720,8700],['tug',7100,10550]
    ,['helicopter',8188.4,7629.2],['plane',8020,8090]
  ].map(([type,x,y])=>({type,x,y,angle:VEHICLES[type].kind==='water'?Math.PI/2:0,...VEHICLES[type],speed:0}));
  const vesselBlocked=(vehicle,x,y)=>{
    const body=chassis({...vehicle,x,y}),cs=Math.cos(body.angle),sn=Math.sin(body.angle);
    const fx=cs*body.length/2,fy=sn*body.length/2,rx=-sn*body.breadth/2,ry=cs*body.breadth/2;
    return [[0,0],[fx+rx,fy+ry],[fx-rx,fy-ry],[-fx+rx,-fy+ry],[-fx-rx,-fy-ry]]
      .some(([dx,dy])=>waterBlocked(x+dx,y+dy));
  };
  for(const vessel of fleet.filter(v=>v.kind==='water')){
    if(!vesselBlocked(vessel,vessel.x,vessel.y))continue;
    const origin={x:vessel.x,y:vessel.y};let placed=false;
    for(let radius=16;radius<=224&&!placed;radius+=16){
      for(let step=0;step<32;step++){
        const angle=step*Math.PI/16,x=origin.x+Math.cos(angle)*radius,y=origin.y+Math.sin(angle)*radius;
        if(vesselBlocked(vessel,x,y))continue;
        if(fleet.some(other=>other!==vessel&&other.kind==='water'&&contact(chassis({...vessel,x,y}),chassis(other))))continue;
        vessel.x=x;vessel.y=y;placed=true;break;
      }
    }
  }
  let mode='sedan', altitude=0;
  const bodyClear=(x,y)=>!buildings.some(b=>x>b.x-5&&x<b.x+b.w+5&&y>b.y-5&&y<b.y+b.h+5)&&
    !trees.some(t=>Math.hypot(x-t.x,y-t.y)<11)&&!obstacles.some(o=>Math.abs(x-o.x)<(o.width||12)*.5+5&&Math.abs(y-o.y)<(o.height||12)*.5+5);
  const doorwayClear=(from,to,ignoreWater=false)=>{
    const distance=Math.hypot(to.x-from.x,to.y-from.y),steps=Math.ceil(distance/4);
    for(let i=1;i<=steps;i++){const x=from.x+(to.x-from.x)*i/steps,y=from.y+(to.y-from.y)*i/steps;
      if(!bodyClear(x,y)||(!ignoreWater&&!solid(x,y)))return false;
    }return true;
  };
  const footClear=(x,y)=>solid(x,y)&&!buildings.some(b=>x>b.x-5&&x<b.x+b.w+5&&y>b.y-5&&y<b.y+b.h+5)&&
    !trees.some(t=>Math.hypot(x-t.x,y-t.y)<11)&&
    !obstacles.some(o=>Math.abs(x-o.x)<(o.width||12)*.5+5&&Math.abs(y-o.y)<(o.height||12)*.5+5)&&
    ![...fleet,...parked,...dynamicActors()].some(c=>contact({x,y,angle:0,length:9,breadth:9},chassis(c)));
  const vehicleClear=(x,y)=>solid(x,y)&&!buildings.some(b=>x>b.x-12&&x<b.x+b.w+12&&y>b.y-12&&y<b.y+b.h+12)&&
    !obstacles.some(o=>Math.abs(x-o.x)<(o.width||12)*.5+12&&Math.abs(y-o.y)<(o.height||12)*.5+12)&&
    ![...fleet,...parked,...dynamicActors()].some(c=>contact({x,y,angle:0,length:16,breadth:16},chassis(c)));
  function interact() {
    if(mode!=='foot') {
      if(Math.abs(player.speed)>.5||altitude>1) return notify('Остановитесь и приземлитесь перед выходом');
      let exit;
      for(const radius of [38,60,85,110]) for(let i=0;i<16&&!exit;i++) {
        const a=player.angle+Math.PI/2+i*Math.PI/8,x=player.x+Math.cos(a)*radius,y=player.y+Math.sin(a)*radius;
        if(footClear(x,y)&&doorwayClear(player,{x,y},VEHICLES[mode]?.kind==='water')) exit={x,y};
      }
      if(!exit)return notify('Нет безопасного выхода: подъедьте к берегу или свободному месту');
      fleet.push({...VEHICLES[mode],type:mode,x:player.x,y:player.y,angle:player.angle,color:player.bodyColor||VEHICLES[mode].color,hp:player.hp,speed:0});
      Object.assign(player,exit,{entityType:'pedestrian',width:9,height:9,speed:0,vx:0,vy:0,walkPhase:0,gait:0}); mode='foot'; notify('Пешком · E — сесть в ближайший транспорт'); return;
    }
    const candidates=[...fleet,...parked].filter(c=>Math.hypot(c.x-player.x,c.y-player.y)<115&&doorwayClear(player,c,c.kind==='water')).sort((a,b)=>Math.hypot(a.x-player.x,a.y-player.y)-Math.hypot(b.x-player.x,b.y-player.y));
    const car=candidates[0]; if(!car)return notify('Подойдите к припаркованному транспорту');
    mode=car.type in VEHICLES?car.type:'sedan'; const profile=VEHICLES[mode];
    Object.assign(player,{entityType:'vehicle',x:car.x,y:car.y,angle:car.angle,width:profile.width,height:profile.height,mass:profile.mass||1500,bodyColor:car.color||profile.color,hp:car.hp??player.hp??100,speed:0,vx:0,vy:0});
    const list=fleet.includes(car)?fleet:parked; list.splice(list.indexOf(car),1);
    notify(profile.name+(profile.kind==='air'?' · кнопка «Высота» / Q — взлёт и посадка':''));
  }
  let fly=false, landingWarned=false;
  const landingClear=()=>{
    const halfX=player.width/2+8,halfY=player.height/2+8;
    for(const [dx,dy] of [[0,0],[halfX,halfY],[halfX,-halfY],[-halfX,halfY],[-halfX,-halfY]]) {
      const x=player.x+dx*Math.cos(player.angle)-dy*Math.sin(player.angle),y=player.y+dx*Math.sin(player.angle)+dy*Math.cos(player.angle);
      if(!vehicleClear(x,y))return false;
    }
    return true;
  };
  function toggleFlight(){
    if(VEHICLES[mode]?.kind!=='air')return;
    if(mode==='plane'&&altitude<2&&(!isPlaneRunway(player.x,player.y,12)||Math.abs(player.speed)<4.5)){
      notify('Самолёту нужен разбег по полосе: разгонитесь и нажмите Q');return;
    }
    fly=altitude<2?true:!fly;landingWarned=false;
    notify(fly?(mode==='plane'?'Взлёт · удерживайте скорость, A/D — курс':'Взлёт · Q — перейти к снижению'):(mode==='plane'?'Снижение · самолёт садится на полосу':'Снижение · выберите свободную площадку'));
  }
  function resetToSedan(x=player.x,y=player.y,angle=0){
    mode='sedan';altitude=0;fly=false;landingWarned=false;
    const profile=VEHICLES.sedan;
    Object.assign(player,{entityType:'vehicle',x,y,angle,width:profile.width,height:profile.height,mass:profile.mass||1500,bodyColor:profile.color,speed:0,vx:0,vy:0,rpm:0,gear:'D1'});
  }
  function step(keys,dt) {
    const profile=VEHICLES[mode]; if(profile?.kind==='land') return false;
    const frame=Math.min(dt,.05)*60;
    if(mode==='foot') {
      const sx=Number(!!keys.right)-Number(!!keys.left),sy=Number(!!keys.down)-Number(!!keys.up),len=Math.hypot(sx,sy)||1;
      // Invert the camera basis: up on keyboard/touch moves up on the screen.
      const dx=sx/Math.sqrt(3)+sy,dy=-sx/Math.sqrt(3)+sy;
      const oldX=player.x,oldY=player.y;
      const x=player.x+dx/len*2.4*frame,y=player.y+dy/len*2.4*frame;
      // Axis-separated sweep lets a person slide along walls and through narrow alleys.
      if(footClear(x,player.y))player.x=x;
      if(footClear(player.x,y))player.y=y;
      const moved=Math.hypot(player.x-oldX,player.y-oldY);
      player.gait=moved>.001?1:0;
      player.walkPhase=moved>.001?(player.walkPhase||0)+moved*.23:0;
      if(moved>.001)player.angle=Math.atan2(player.y-oldY,player.x-oldX);
      player.speed=0;player.rpm=0;player.gear='ПЕШКОМ'; return true;
    }
    if(profile.kind==='air') {
      if(fly){
        const climbFactor=mode==='plane'?Math.max(0,Math.min(1,(Math.abs(player.speed)-4.5)/5)):1;
        altitude=Math.min(220,altitude+(mode==='plane'?.72*climbFactor:1.15)*frame);landingWarned=false;
      }
      else if(altitude>0){
        const next=Math.max(0,altitude-.82*frame);
        const roofClearance=buildings.reduce((height,b)=>contact(chassis(player),{x:b.x+b.w/2,y:b.y+b.h/2,angle:0,length:b.w,breadth:b.h})?Math.max(height,(b.floors??5)*24+12):height,0);
        const runwayClear=mode!=='plane'||isPlaneRunway(player.x,player.y,8);
        const minimum=Math.max(roofClearance,landingClear()&&runwayClear?0:mode==='plane'?18:8);
        if(next<minimum){
          // Hold the current altitude. Snapping up to a roof height looked like
          // a teleport, while braking here trapped pilots away from the runway.
          altitude=Math.max(altitude,next);
          if(!landingWarned){notify(mode==='plane'&&!runwayClear?'Посадка только на свободной полосе · держите высоту и возвращайтесь':'Посадка невозможна: вода, крыша или препятствие');landingWarned=true;}
        }else{altitude=next;if(altitude===0)landingWarned=false;}
      }
    }
    const max=profile.kind==='air'&&mode!=='plane'&&altitude<10?1.7:profile.max;
    const reverseLimit=mode==='plane'?0:max*.3;
    player.speed=Math.max(-reverseLimit,Math.min(max,player.speed+((keys.up ? .10 : 0)-(keys.down ? .14 : 0))*frame));
    player.speed*=Math.pow(keys.handbrake ? .9 : .99,frame);
    const steer=Number(!!keys.right)-Number(!!keys.left);
    const turnRate=mode==='plane'?.009*Math.min(1,Math.abs(player.speed)/profile.max):mode==='helicopter'?.019:.032;
    player.angle+=steer*turnRate*frame*(profile.kind==='water'?Math.min(1,Math.abs(player.speed)/2)*Math.sign(player.speed):1);
    const ox=player.x,oy=player.y;
    player.x+=Math.cos(player.angle)*player.speed*frame;player.y+=Math.sin(player.angle)*player.speed*frame;
    player.vx=player.x-ox;player.vy=player.y-oy;
    const body=chassis(player),fx=Math.cos(player.angle)*body.length/2,fy=Math.sin(player.angle)*body.length/2,rx=-Math.sin(player.angle)*body.breadth/2,ry=Math.cos(player.angle)*body.breadth/2;
    if(profile.kind==='water'&&[[0,0],[fx+rx,fy+ry],[fx-rx,fy-ry],[-fx+rx,-fy+ry],[-fx-rx,-fy-ry]].some(([x,y])=>waterBlocked(player.x+x,player.y+y))){player.x=ox;player.y=oy;player.speed*=-.2;}
    if(profile.kind==='air'){
      const hitsRoof=buildings.some(b=>altitude<(b.floors??5)*24+12&&contact(chassis(player),{x:b.x+b.w/2,y:b.y+b.h/2,angle:0,length:b.w,breadth:b.h}));
      if(hitsRoof){player.x=ox;player.y=oy;player.speed=0;}
      if(altitude<12){if(!solid(player.x,player.y)){player.x=ox;player.y=oy;player.speed=0;}resolveScenery(player,buildings,trees,obstacles);}
    }
    // Vehicle positions are world-space coordinates, not a finite map tile.
    // Ocean rendering streams around the player, so boats and aircraft can
    // travel past every edge of the authored city without hitting an invisible wall.
    player.rpm=Math.abs(player.speed)/max;player.gear=profile.kind==='air'?`${Math.round(altitude)} м`:'ВОДА';return true;
  }
  function contacts(){if(mode==='foot'||altitude>12)return;for(const car of fleet)if(VEHICLES[car.type].kind===VEHICLES[mode].kind)resolveContact(player,car,true);}
  return {fleet,interact,toggleFlight,resetToSedan,step,contacts,get mode(){return mode;},get altitude(){return altitude;},get special(){return mode==='foot'||VEHICLES[mode].kind!=='land';},get profile(){return VEHICLES[mode];}};
}

export function drawTransport(ctx,car,time=0,altitude=0) {
  ctx.save();ctx.translate(car.x,car.y);
  if(car.kind==='water'&&Math.abs(car.speed||0)>.15){
    ctx.save();ctx.rotate(car.angle);ctx.strokeStyle='rgba(191,221,223,.28)';ctx.lineWidth=3;
    for(const side of [-1,1]){ctx.beginPath();ctx.moveTo(-car.width*.2,side*car.height*.45);ctx.quadraticCurveTo(-car.width*.8,side*car.height*.85,-car.width*1.35,side*car.height*.58);ctx.stroke();}
    ctx.restore();
  }
  const shadowLift=Math.max(0,altitude)*.18;
  ctx.fillStyle=`rgba(0,0,0,${Math.max(.12,.46-altitude/420)})`;ctx.beginPath();ctx.ellipse(10+shadowLift,10+shadowLift,car.width*.62,Math.max(7,car.height*.55),car.angle,0,Math.PI*2);ctx.fill();
  ctx.translate(-altitude,-altitude);ctx.rotate(car.angle);ctx.strokeStyle='#111719';ctx.lineWidth=1.7;
  const cs=Math.cos(car.angle),sn=Math.sin(car.angle),z=car.type==='truck'?16:car.type==='van'?12:car.type==='helicopter'?9:car.kind==='water'?8:5,zx=-z*(cs+sn),zy=z*(sn-cs);
  const poly=(points,fill,stroke=false)=>{ctx.beginPath();points.forEach(([x,y],i)=>i?ctx.lineTo(x,y):ctx.moveTo(x,y));ctx.closePath();ctx.fillStyle=fill;ctx.fill();if(stroke)ctx.stroke();};
  const extrude=(shape,top,side='rgba(24,28,29,.94)',lift=1)=>{
    const ox=zx*lift,oy=zy*lift;
    const orientation=Math.sign(shape.reduce((area,a,i)=>{const b=shape[(i+1)%shape.length];return area+a[0]*b[1]-b[0]*a[1];},0));
    for(let i=0;i<shape.length;i++){
      const a=shape[i],b=shape[(i+1)%shape.length],nx=(b[1]-a[1])*orientation,ny=(a[0]-b[0])*orientation;
      if(nx*(cs+sn)+ny*(cs-sn)<=0)continue;
      poly([a,b,[b[0]+ox,b[1]+oy],[a[0]+ox,a[1]+oy]],side);
    }
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
      ctx.save();ctx.scale(1.12,1.12);
      const plane=[[48,0],[18,-5],[5,-13],[2,-38],[-9,-41],[-9,-13],[-35,-22],[-48,-17],[-28,0],[-48,17],[-35,22],[-9,13],[-9,41],[2,38],[5,13],[18,5]];
      extrude(plane,car.color||'#c5c8c5','#414a4a',2.05);
      const fuselage=[[47,0],[31,-3.8],[5,-5.3],[-24,-4.5],[-39,-2.5],[-44,0],[-39,2.5],[-24,4.5],[5,5.3],[31,3.8]];
      extrude(fuselage,'#e1e1d8','#424a49',3.1);
      poly([[30+zx*1.65,-3+zy*1.65],[18+zx*1.65,-3.6+zy*1.65],[10+zx*1.65,-2.3+zy*1.65],[10+zx*1.65,2.3+zy*1.65],[18+zx*1.65,3.6+zy*1.65],[30+zx*1.65,3+zy*1.65]],'#315360',true);
      ctx.fillStyle='#d4523a';ctx.fillRect(-8+zx,-41+zy,7,4);ctx.fillRect(-8+zx,37+zy,7,4);
      ctx.strokeStyle='rgba(199,205,193,.72)';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(2+zx,-37+zy);ctx.lineTo(2+zx,-18+zy);ctx.moveTo(2+zx,18+zy);ctx.lineTo(2+zx,37+zy);ctx.stroke();
      ctx.strokeStyle='#171e20';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(-8+zx,-33+zy);ctx.lineTo(-8+zx,33+zy);ctx.stroke();
      ctx.fillStyle='#dba752';ctx.fillRect(-37+zx,-1+zy,12,2);
      ctx.save();ctx.translate(48+zx,zy);ctx.rotate(time*(altitude>0?34:7));ctx.strokeStyle='rgba(224,228,219,.82)';ctx.lineWidth=2.6;ctx.beginPath();ctx.moveTo(0,-10);ctx.lineTo(0,10);ctx.stroke();ctx.restore();
      ctx.restore();
    }else{
      extrude([[27,0],[12,-13],[-10,-14],[-24,-6],[-46,-4],[-51,0],[-46,4],[-24,6],[-10,14],[12,13]],car.color||'#7d8868','#303833',1.2);
      poly([[21+zx*1.45,-8+zy*1.45],[8+zx*1.45,-10+zy*1.45],[8+zx*1.45,10+zy*1.45],[21+zx*1.45,8+zy*1.45]],'rgba(75,119,132,.8)',true);
      if(car.medical){
        ctx.fillStyle='#c64b40';ctx.fillRect(-17+zx,-2+zy,14,4);ctx.fillRect(-12+zx,-7+zy,4,14);
        ctx.fillStyle=Math.sin(time*12)>0?'#5ec5ed':'#f17b66';ctx.fillRect(-27+zx,-5+zy,4,4);
      }
      ctx.strokeStyle='#303536';ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(-8+zx,-17+zy);ctx.lineTo(-15+zx,-23+zy);ctx.moveTo(9+zx,17+zy);ctx.lineTo(16+zx,23+zy);ctx.stroke();
      ctx.strokeStyle='#a5a79a';ctx.lineWidth=2.5;for(const side of [-1,1]){ctx.beginPath();ctx.moveTo(-20,side*20);ctx.lineTo(20,side*20);ctx.lineTo(25,side*17);ctx.stroke();}
      ctx.strokeStyle='#151e20';ctx.lineWidth=1.7;ctx.beginPath();ctx.moveTo(14+zx*1.45,-9+zy*1.45);ctx.lineTo(14+zx*1.45,9+zy*1.45);ctx.stroke();
      ctx.strokeStyle='#c7c2a7';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(-44+zx,-8+zy);ctx.lineTo(-44+zx,8+zy);ctx.stroke();
      ctx.save();ctx.translate(zx*1.55,zy*1.55);ctx.rotate(time*(altitude>0?22:1));ctx.fillStyle='rgba(190,198,192,.7)';ctx.fillRect(-57,-2.2,114,4.4);ctx.fillRect(-2.2,-57,4.4,114);ctx.fillStyle='#222829';ctx.beginPath();ctx.arc(0,0,5,0,Math.PI*2);ctx.fill();ctx.restore();
      if(altitude>0){ctx.strokeStyle='rgba(195,205,196,.13)';ctx.lineWidth=5;ctx.beginPath();ctx.arc(zx*1.55,zy*1.55,52,0,Math.PI*2);ctx.stroke();}
    }
  } else if(car.type==='bike'){
    for(const x of [-11,11]){
      const wheel=[[-5+x,-2],[5+x,-2],[5+x,2],[-5+x,2]];extrude(wheel,'#13191b','#050708',.7);
      ctx.strokeStyle='#93988d';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(x-3+zx*.5,zy*.5);ctx.lineTo(x+3+zx*.5,zy*.5);ctx.stroke();
    }
    extrude([[-9,-3],[9,-3],[12,2],[-10,3]],car.color||'#b45035','#343330',1.15);
    extrude([[-9,-3],[1,-3],[2,3],[-9,3]],'#181d1f','#0b1012',1.6);
    ctx.strokeStyle='#9b9e92';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(9+zx,-6+zy);ctx.lineTo(9+zx,6+zy);ctx.stroke();
    if(car.occupied){
      extrude([[-4,-4],[5,-4],[5,4],[-4,4]],'#68523a','#252b2a',2.2);
      ctx.fillStyle='#aaa795';ctx.beginPath();ctx.arc(5+zx*2.8,zy*2.8,4,0,Math.PI*2);ctx.fill();
      ctx.fillStyle='#202f35';ctx.fillRect(7+zx*2.8,-2+zy*2.8,2,4);
    }
    ctx.fillStyle='#ffe2a0';ctx.beginPath();ctx.arc(13+zx,zy,2.5,0,Math.PI*2);ctx.fill();
  } else if(car.type==='truck'){
    const w=car.width,h=car.height;
    ctx.fillStyle='#080b0c';ctx.fillRect(-w*.48,-h*.41,w*.96,h*.82);
    for(const x of [-w*.35,-w*.18,w*.34])for(const y of [-h*.56,h*.40])ctx.fillRect(x-5,y,10,5);
    const cargo={x:-w*.2,draw(){
      extrude([[-w*.49,-h*.49],[w*.12,-h*.49],[w*.12,h*.49],[-w*.49,h*.49]],car.color||'#807657','#48483c',1.3);
      ctx.strokeStyle='rgba(229,218,185,.28)';ctx.lineWidth=1;
      for(let x=-w*.43;x<w*.08;x+=9){ctx.beginPath();ctx.moveTo(x+zx*1.3,-h*.43+zy*1.3);ctx.lineTo(x+zx*1.3,h*.43+zy*1.3);ctx.stroke();}
      ctx.fillStyle='#a24433';ctx.fillRect(-w*.5,-h*.4,2,4);ctx.fillRect(-w*.5,h*.27,2,4);
    }};
    const cab={x:w*.32,draw(){
      const lift=.95,rx=zx*lift,ry=zy*lift;
      extrude([[w*.16,-h*.45],[w*.45,-h*.45],[w*.5,-h*.32],[w*.5,h*.32],[w*.45,h*.45],[w*.16,h*.45]],'#a69772','#4c4b41',lift);
      poly([[w*.38+rx,-h*.38+ry],[w*.47+rx,-h*.27+ry],[w*.47+rx,h*.27+ry],[w*.38+rx,h*.38+ry]],'#29404a',true);
      ctx.fillStyle='#bdad83';ctx.fillRect(w*.19+rx,-h*.35+ry,w*.16,h*.7);
      ctx.fillStyle='#657f83';ctx.fillRect(w*.23+rx,-h*.45+ry,w*.12,2);ctx.fillRect(w*.23+rx,h*.38+ry,w*.12,2);
      ctx.fillStyle='#272e2d';ctx.fillRect(w*.49,-h*.3,3,h*.6);
      ctx.fillStyle='#e8ddb9';ctx.fillRect(w*.49,-h*.35,3,4);ctx.fillRect(w*.49,h*.22,3,4);
      ctx.fillStyle='#444b47';ctx.fillRect(w*.20,-h*.61,6,3);ctx.fillRect(w*.20,h*.52,6,3);
    }};
    [cargo,cab].sort((a,b)=>(a.x-b.x)*(cs+sn)).forEach(part=>part.draw());
  } else {
    const w=car.width,h=car.height;
    ctx.fillStyle='#060708';for(const x of [-w*.3,w*.26])for(const y of [-h*.55,h*.44])ctx.fillRect(x-5,y,11,5);
    const body=[[-w*.5+h*.12,-h*.5],[w*.38,-h*.5],[w*.5,-h*.28],[w*.5,h*.28],[w*.38,h*.5],[-w*.5+h*.12,h*.5],[-w*.5,h*.25],[-w*.5,-h*.25]];
    extrude(body,car.color||'#b9b5a7','#202526');
    const cabin=car.type==='van'?[[w*.12,-h*.38],[w*.34,-h*.35],[w*.38,h*.28],[w*.12,h*.38]]:[[-w*.18,-h*.34],[w*.2,-h*.32],[w*.27,h*.25],[-w*.18,h*.34]];
    extrude(cabin,'#243c46','#131f24',car.type==='van'?1.08:1.65);
    if(car.type==='van'){
      poly([[-w*.44+zx,-h*.4+zy],[w*.08+zx,-h*.4+zy],[w*.08+zx,h*.4+zy],[-w*.44+zx,h*.4+zy]],'#a2a59b',true);
      ctx.strokeStyle='#59605c';ctx.lineWidth=1;for(const x of [-w*.32,-w*.12]){ctx.beginPath();ctx.moveTo(x+zx,-h*.39+zy);ctx.lineTo(x+zx,h*.39+zy);ctx.stroke();}
    }
    ctx.strokeStyle='rgba(220,228,217,.23)';ctx.beginPath();ctx.moveTo(5+zx*1.7,-h*.3+zy*1.7);ctx.lineTo(5+zx*1.7,h*.3+zy*1.7);ctx.stroke();
    if(car.type==='van'){ctx.strokeStyle='rgba(20,22,23,.55)';ctx.beginPath();ctx.moveTo(-w*.32+zx,-h*.45+zy);ctx.lineTo(-w*.32+zx,h*.45+zy);ctx.stroke();}
    lights(w*.46,h*.5);
  }
  ctx.restore();
}
