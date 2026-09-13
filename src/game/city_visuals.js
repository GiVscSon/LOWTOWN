const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));

function hash(x,y,n=0){
  const v=Math.sin(x*12.9898+y*78.233+n*37.719)*43758.5453;
  return v-Math.floor(v);
}

function diamond(ctx,p,size){
  ctx.beginPath();
  ctx.moveTo(p.x,p.y-size*.45);
  ctx.lineTo(p.x+size,p.y);
  ctx.lineTo(p.x,p.y+size*.45);
  ctx.lineTo(p.x-size,p.y);
  ctx.closePath();
}

function buildingDetails(ctx,iso,b,t){
  const [x,y,w,h]=b;
  const center=iso(x+w*.5,y+h*.5);
  const facade=iso(x+w,y+h);
  const depth=Math.max(42,Math.min(96,h*.42));
  const seed=hash(x,y,w+h);
  
  // Rooftop machinery and vents. Purely decorative, no collision geometry.
  if(w>95&&h>95){
    const p=iso(x+w*.72,y+h*.24);
    ctx.save();
    ctx.translate(p.x,p.y-58);
    ctx.fillStyle='rgba(10,12,14,.82)';
    ctx.fillRect(-8,-5,16,10);
    ctx.strokeStyle='rgba(154,160,168,.42)';
    ctx.lineWidth=1;
    ctx.strokeRect(-8,-5,16,10);
    ctx.beginPath();ctx.moveTo(-4,-5);ctx.lineTo(-4,-14);ctx.moveTo(4,-5);ctx.lineTo(4,-14);ctx.stroke();
    ctx.restore();
  }

  // Fire-escape rhythm on selected older buildings.
  if(seed>.55&&w>120){
    const levels=Math.max(1,Math.floor(h/105));
    ctx.strokeStyle='rgba(154,160,168,.25)';
    ctx.lineWidth=1;
    for(let i=1;i<=levels;i++){
      const yy=y+h-i*(h/(levels+1));
      const p1=iso(x+w*.08,yy),p2=iso(x+w*.42,yy);
      ctx.beginPath();ctx.moveTo(p1.x,p1.y-24);ctx.lineTo(p2.x,p2.y-24);ctx.stroke();
      for(let k=0;k<3;k++){
        const q=iso(x+w*(.1+k*.11),yy);
        ctx.beginPath();ctx.moveTo(q.x,q.y-24);ctx.lineTo(q.x,q.y-8);ctx.stroke();
      }
    }
  }

  // A restrained sign on a few city blocks.
  if(seed>.82&&w>110){
    const p=iso(x+w*.56,y+h*.04);
    ctx.save();
    ctx.translate(p.x,p.y-34);
    ctx.fillStyle='rgba(12,13,16,.92)';
    ctx.fillRect(-20,-7,40,14);
    ctx.strokeStyle='rgba(224,154,62,.55)';
    ctx.strokeRect(-20,-7,40,14);
    ctx.fillStyle='rgba(224,154,62,.75)';
    ctx.font='bold 6px monospace';
    ctx.textAlign='center';
    ctx.fillText('LOW',0,2);
    ctx.restore();
  }

  // Subtle facade grime and service marks.
  if(w>80){
    ctx.strokeStyle='rgba(0,0,0,.20)';
    ctx.lineWidth=2;
    const p=iso(x+w*.14,y+h*.72),q=iso(x+w*.14,y+h*.91);
    ctx.beginPath();ctx.moveTo(p.x,p.y-28);ctx.lineTo(q.x,q.y-28);ctx.stroke();
  }

  // Tiny sodium reflection beneath the facade, clipped by visual scale only.
  if(seed<.32){
    const r=clamp(w*.055,4,11);
    const p=iso(x+w*.5,y+h+4);
    ctx.fillStyle='rgba(224,154,62,.08)';
    diamond(ctx,p,r);ctx.fill();
  }

  void center; void facade; void depth; void t;
}

function streetAtmosphere(ctx,iso,lamps,t){
  for(let i=0;i<lamps.length;i++){
    const [x,y]=lamps[i];
    const p=iso(x,y);
    const pulse=.92+.08*Math.sin(t*2.4+i*.73);
    const r=clamp(18*pulse,12,22);
    const g=ctx.createRadialGradient(p.x,p.y-39,1,p.x,p.y-39,r);
    g.addColorStop(0,'rgba(255,211,130,.20)');
    g.addColorStop(.32,'rgba(224,154,62,.09)');
    g.addColorStop(1,'rgba(224,154,62,0)');
    ctx.fillStyle=g;
    ctx.beginPath();ctx.arc(p.x,p.y-39,r,0,Math.PI*2);ctx.fill();
  }
}

function wetStreetSheen(ctx,iso,buildings,t){
  // Decorative glints only. No world-space objects are added.
  for(let i=0;i<buildings.length;i++){
    const [x,y,w,h]=buildings[i];
    if((i%3)!==0)continue;
    const p=iso(x+w*.5,y+h+12);
    const len=clamp(w*.22,18,54);
    const shimmer=.45+.25*Math.sin(t*1.7+i*1.91);
    ctx.strokeStyle=`rgba(224,154,62,${.045*shimmer})`;
    ctx.lineWidth=1;
    ctx.beginPath();ctx.moveTo(p.x-len,p.y);ctx.lineTo(p.x+len,p.y);ctx.stroke();
  }
}

export function createCityVisuals(){
  return {
    version:'CITY_POLISH_1',
    draw(ctx,iso,buildings,lamps,t){
      // Layer order intentionally sits above static architecture only.
      for(const b of buildings)buildingDetails(ctx,iso,b,t);
      wetStreetSheen(ctx,iso,buildings,t);
      streetAtmosphere(ctx,iso,lamps,t);
    }
  };
}
