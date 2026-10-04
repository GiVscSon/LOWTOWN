// A bounded pool is advanced by physics, never by rendering or wall-clock time.
export function createEffectPool(capacity=256,random=Math.random){
  const particles=Array.from({length:capacity},()=>({life:0}));let cursor=0,serial=0;
  function burst(x,y,z,kind='dust',count=8,dx=0,dy=0,baseY=null){
    for(let i=0;i<count;i++){
      const p=particles[cursor++%capacity],angle=random()*Math.PI*2,speed=kind==='water'?25:12+random()*28;
      Object.assign(p,{x,y,z,kind,baseY,life:kind==='ripple'?1.4:kind==='steam'?2.8:.35+random()*.65,age:0,size:kind==='ripple'?5:kind==='chip'?1.3:kind==='steam'?4:2.1,
        vx:Math.cos(angle)*speed+dx,vy:Math.sin(angle)*speed+dy,vz:kind==='steam'?9:12+random()*25,serial:serial++});p.duration=p.life;
      if(kind==='ripple')p.vx=p.vy=p.vz=0;
    }
  }
  return {particles,capacity,burst,step(dt){
    for(const p of particles)if(p.life>0){p.life=Math.max(0,p.life-dt);p.age+=dt;
      if(p.kind==='ripple')continue;
      p.x+=p.vx*dt;p.y+=p.vy*dt;p.z+=p.vz*dt;
      p.vz-=(p.kind==='steam'?0:75)*dt;p.vx*=Math.exp(-2*dt);p.vy*=Math.exp(-2*dt);
      if(p.z<.3){p.z=.3;p.vz=Math.abs(p.vz)*.25;}
    }
  },get active(){return particles.filter(p=>p.life>0).length;}};
}
