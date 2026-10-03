// Original continuous-heading, model-space vehicle meshes. Height is projected
// vertically in world space, so windows and equipment stay attached in turns.
const GLASS='#263b46',TRIM='#232b30',CHROME='#abb6b4';
const cache=new Map();
// The canvas camera looks along the isometric diagonal.  Keep this test in
// one place so the body, glass overlays and service equipment agree about
// which surface is facing the player while a vehicle rotates.
function projectedNormal(normal,angle=0){
  const cs=Math.cos(angle),sn=Math.sin(angle),[nx,ny,nz]=normal;
  return [nx*cs-ny*sn,nx*sn+ny*cs,nz];
}
function projectedVisibility(normal,angle=0){
  const [rx,ry,nz]=projectedNormal(normal,angle);
  return rx+ry+nz;
}
const normal=points=>{
  const a=points[0],b=points[1],c=points[2],u=b.map((n,i)=>n-a[i]),v=c.map((n,i)=>n-a[i]);
  return [u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0]];
};
function shade(color,amount){
  const match=/^#([\da-f]{6})$/i.exec(color);if(!match)return color;
  const n=parseInt(match[1],16);
  return `rgb(${[n>>16,(n>>8)&255,n&255].map(v=>Math.round(Math.min(255,v*amount+(amount>1?12:0)))).join(',')})`;
}
export function createVehicleMesh(type='sedan',length=48,breadth=24,color='#e09a3e',police=false){
  const faces=[],w=length,h=breadth;
  const tactical=type==='armoredPolice',guard=type==='nationalGuard',fire=type==='fireEngine',ems=type==='ambulance';
  const service=police||tactical||guard||fire||ems||type==='police';
  const tall=['van','bus','truck','armoredPolice','nationalGuard','fireEngine','ambulance'].includes(type);
  const paint=guard?'#798365':tactical?'#60717a':fire?'#c34d3c':ems?'#e5e1cf':police||type==='police'?'#e5e5d9':type==='taxi'?'#e5b344':color;
  const face=(points,fill,trim=true)=>faces.push({points,normal:normal(points),fill,trim});
  const prism=(bottom,top,z0,z1,fill,sideFill=fill)=>{
    for(let i=0;i<bottom.length;i++){const j=(i+1)%bottom.length;face([[...bottom[i],z0],[...bottom[j],z0],[...top[j],z1],[...top[i],z1]],sideFill);}
    face(top.map(p=>[...p,z1]),fill);
  };
  const rect=(x,y,l,b)=>[[x,y],[x+l,y],[x+l,y+b],[x,y+b]];
  const box=(x,y,l,b,z0,z1,fill)=>{const shape=rect(x,y,l,b);prism(shape,shape,z0,z1,fill);};
  const sidePanel=(x,l,z0,z1,fill)=>{
    for(const side of [-1,1]){
      const pts=[[x,side*h*.472,z0],[x+l,side*h*.472,z0],[x+l,side*h*.472,z1],[x,side*h*.472,z1]];
      if(side>0)pts.reverse();face(pts,fill,false);
    }
  };
  if(type==='bike'){
    box(-w*.29,-h*.17,w*.58,h*.34,3,8,TRIM);
    const shape=[[-w*.16,-h*.28],[w*.28,-h*.23],[w*.4,0],[w*.28,h*.23],[-w*.16,h*.28]];
    prism(shape,shape,6,11,paint);
    box(-w*.32,-h*.23,w*.25,h*.46,8,10,'#393a37');
    box(w*.24,-h*.48,2,h*.96,10,11,CHROME);
    // A seated rider: jacket, arms and helmet, separate from the tank.
    box(-w*.12,-h*.25,w*.17,h*.5,10,18,'#73745e');
    box(-w*.08,-h*.19,w*.15,h*.38,18,21,'#e0d2b5');
    box(0,-h*.35,w*.24,2,13,14,'#73745e');box(0,h*.18,w*.24,2,13,14,'#73745e');
  }else{
    const shape=[[-w*.5,-h*.33],[-w*.44,-h*.47],[w*.36,-h*.47],[w*.5,-h*.31],[w*.5,h*.31],[w*.36,h*.47],[-w*.44,h*.47],[-w*.5,h*.33]];
    const bodyZ=type==='sports'||type==='coupe'?6:8;
    const shoulder=shape.map(([x,y])=>[x*.985,y*.96]);
    prism(shape,shoulder,3,bodyZ,paint);
    box(-w*.51,-h*.31,2,h*.62,3.5,5.3,CHROME);box(w*.48,-h*.3,2,h*.6,3.5,5.3,CHROME);
    sidePanel(-w*.35,w*.7,4,5.5,service?(fire||ems?'#ead6a0':guard?'#596247':'#354753'):TRIM);
    let back=-w*.24,front=w*.19,roofBack=-w*.17,roofFront=w*.07,roofZ=14;
    if(type==='coupe'||type==='sports'){back=-w*.18;front=w*.17;roofBack=-w*.07;roofFront=w*.03;roofZ=type==='sports'?10.5:12;}
    if(type==='wagon'){back=-w*.4;roofBack=-w*.34;}
    if(tall){back=-w*.43;front=w*.35;roofBack=-w*.41;roofFront=w*.25;roofZ=type==='bus'?23:20;}
    if(type==='truck'||guard||fire){back=w*.07;roofBack=w*.09;roofZ=20;}
    const bottom=rect(back,-h*.43,front-back,h*.86),top=rect(roofBack,-h*.34,roofFront-roofBack,h*.68);
    prism(bottom,top,bodyZ,roofZ,paint,GLASS);
    if(!tall){
      // Dark seals frame the sloped glass, with narrow reflected sky streaks
      // and a rear demister. Every piece belongs to the same continuous mesh.
      const glassPatch=(end,u0,u1,v0,v1,fill)=>{
        const baseX=end?front:back,roofX=end?roofFront:roofBack,epsilon=end?.035:-.035;
        const p=(u,v)=>[baseX+(roofX-baseX)*v+epsilon,(u-.5)*h*(.86-.18*v),bodyZ+(roofZ-bodyZ)*v+.025];
        const pts=[p(u0,v0),p(u1,v0),p(u1,v1),p(u0,v1)];if(!end)pts.reverse();face(pts,fill,false);
      };
      for(const end of [false,true]){
        glassPatch(end,0,1,.01,.06,TRIM);glassPatch(end,0,1,.94,.99,TRIM);
        glassPatch(end,.015,.045,.06,.94,TRIM);glassPatch(end,.955,.985,.06,.94,TRIM);
        glassPatch(end,.08,.46,.12,.18,'#17252c');
        glassPatch(end,.53,.87,.16,.19,'#81918f');
        if(!end)for(let row=0;row<5;row++)glassPatch(false,.07,.93,.28+row*.11,.289+row*.11,'#55625e');
      }
      // A restrained dark sunroof and its seal are especially visible in the
      // close camera, instead of an unbroken flat roof slab.
      if(type==='coupe'||type==='sports'||type==='sedan'){
        const roofLength=roofFront-roofBack;
        box(roofBack+roofLength*.2,-h*.21,roofLength*.55,h*.42,roofZ+.025,roofZ+.1,TRIM);
        box(roofBack+roofLength*.23,-h*.185,roofLength*.49,h*.37,roofZ+.1,roofZ+.14,'#34474c');
      }
      sidePanel(-w*.34,w*.69,bodyZ-.7,bodyZ-.45,shade(paint,1.22));
      // Door seams, handles, fuel flap and a lower sill highlight.
      const doors=type==='coupe'||type==='sports'?[back,front]:[back,(back+front)/2,front];
      for(const side of [-1,1]){
        const y=side*h*.474;
        const panel=(x,z,l,height,fill)=>{const pts=[[x,y,z],[x+l,y,z],[x+l,y,z+height],[x,y,z+height]];if(side>0)pts.reverse();face(pts,fill,false);};
        for(const x of doors){panel(x,4.9,.16,bodyZ-5,TRIM);panel(x-2.5,bodyZ-1.6,1.8,.5,CHROME);}
        panel(-w*.41,bodyZ-2.1,w*.065,1.3,shade(paint,.7));
        panel(-w*.36,3.5,w*.7,.32,'#79807b');
      }
      box(-w*.506,-h*.14,.45,h*.28,3.7,5.4,'#c3c4ad');
      box(-w*.513,-h*.1,.16,h*.2,4,5,'#3a4549');
      box(w*.498,-h*.35,.5,h*.7,3,3.6,TRIM);
      for(const side of [-1,1]){
        box(-w*.505,side<0?-h*.38:h*.26,.7,h*.12,5.4,6.4,'#d89232');
        box(w*.487,side<0?-h*.36:h*.26,.7,h*.1,4.5,5.3,'#dca450');
        // Twin small exhaust tips and a front fog lamp bezel.
        if(side<0)box(-w*.535,-h*.27,1.9,1,2.7,3.6,CHROME);
        box(w*.495,side<0?-h*.28:h*.2,.5,h*.08,3.7,4.4,'#b9bbab');
      }
    }
    // Narrow pillars follow the tapered window planes rather than floating on top.
    for(const side of [-1,1]){
      const pts=[[back,side*h*.431,bodyZ],[back+2,side*h*.431,bodyZ],[roofBack+2,side*h*.341,roofZ],[roofBack,side*h*.341,roofZ]];
      if(side>0)pts.reverse();face(pts,paint,false);
      const mid=(back+front)/2,roofMid=(roofBack+roofFront)/2;
      const pillar=[[mid-1,side*h*.431,bodyZ],[mid+1,side*h*.431,bodyZ],[roofMid+1,side*h*.341,roofZ],[roofMid-1,side*h*.341,roofZ]];
      if(side>0)pillar.reverse();face(pillar,paint,false);
      box(front-3,side>0?h*.46:-h*.54,3,h*.08,bodyZ,bodyZ+2,paint);
    }
    // Hood and boot have restrained seams and raised central highlights.
    const patrol=(police||type==='police')&&!tactical&&!guard;
    box(front+1,-h*.29,Math.max(1,w*.45-front),h*.58,bodyZ+.02,bodyZ+.12,patrol?'#3e5364':shade(paint,1.08));
    if(!tall)box(-w*.41,-h*.27,Math.max(1,back+w*.4),h*.54,bodyZ+.02,bodyZ+.12,patrol?'#3e5364':shade(paint,1.05));
    if(['van','ambulance','bus','armoredPolice'].includes(type))for(const side of [-1,1]){
      const panel=(a,b,v0,v1,fill)=>{
        const point=(u,v)=>[back+(front-back)*u+(roofBack-back+(roofFront-roofBack-front+back)*u)*v,side*h*(.431-.09*v),bodyZ+(roofZ-bodyZ)*v];
        const pts=[point(a,v0),point(b,v0),point(b,v1),point(a,v1)];if(side>0)pts.reverse();face(pts,fill,false);
      };
      // Cargo bodies are opaque. Bus window bays have separate pillars and sills.
      if(type!=='bus')panel(.02,.55,.02,.98,paint);
      else{panel(0,1,0,.24,paint);for(let i=1;i<7;i++)panel(i/7-.012,i/7+.012,.24,.98,paint);}
    }
    if(type==='taxi')for(const side of [-1,1])for(let i=0;i<10;i++){
      const x=-w*.33+i*w*.062,pts=[[x,side*h*.473,5.7],[x+w*.03,side*h*.473,5.7],[x+w*.03,side*h*.473,7],[x,side*h*.473,7]];
      if(side>0)pts.reverse();face(pts,i%2?TRIM:'#eee0ad',false);
    }
    if(type==='truck'||guard){
      box(-w*.44,-h*.43,w*.47,h*.86,8,18,guard?'#5f7152':'#988f76');
      for(let i=0;i<5;i++)box(-w*.42+i*w*.085,-h*.435,1,h*.87,18,18.3,guard?'#899175':'#b4aa8e');
    }
    if(fire){
      box(-w*.45,-h*.44,w*.48,h*.88,8,18,paint);
      for(const side of [-1,1])for(let i=0;i<3;i++){
        const x=-w*.42+i*w*.14,pts=[[x,side*h*.445,9],[x+w*.12,side*h*.445,9],[x+w*.12,side*h*.445,16],[x,side*h*.445,16]];
        if(side>0)pts.reverse();face(pts,'#aab5b4');
      }
      for(const side of [-1,1])box(-w*.42,side*h*.14,w*.44,1.4,18,19.2,CHROME);
      for(let i=0;i<7;i++)box(-w*.4+i*w*.058,-h*.14,1,h*.28,18,19,CHROME);
    }
    if(ems){
      for(const side of [-1,1]){
        const x=-w*.25,y=side*h*.385,z=15,pts=[[x-3,y,z-1],[x-1,y,z-1],[x-1,y,z-3],[x+1,y,z-3],[x+1,y,z-1],[x+3,y,z-1],[x+3,y,z+1],[x+1,y,z+1],[x+1,y,z+3],[x-1,y,z+3],[x-1,y,z+1],[x-3,y,z+1]];
        if(side>0)pts.reverse();face(pts,'#db5f47',false);
      }
    }
    if(type==='bus'){
      // Roof air unit and a route box give buses a distinct long silhouette.
      box(-w*.22,-h*.22,w*.28,h*.44,roofZ,roofZ+2,'#c5c7b8');
      box(w*.24,-h*.28,3,h*.56,roofZ-3,roofZ,'#d9ba74');
    }
    if(type==='taxi')box(-3,-3,9,6,roofZ,roofZ+2,'#f2d383');
    if(type==='sports'){
      box(-w*.4,-h*.3,1.5,h*.6,bodyZ,bodyZ+2,TRIM);
      box(-w*.44,-h*.36,w*.12,h*.72,bodyZ+2,bodyZ+3,paint);
    }
    if(service){
      const x=(roofBack+roofFront)/2-2;
      box(x,-h*.28,4,h*.56,roofZ,roofZ+1.4,TRIM);
      box(x,-h*.27,4,h*.23,roofZ+1.4,roofZ+3,'sirenRed');
      box(x,h*.04,4,h*.23,roofZ+1.4,roofZ+3,fire?'sirenAmber':'sirenBlue');
    }
    // Lamps live on the bumper faces. No oversized floating headlight tiles.
    for(const side of [-1,1]){
      box(w*.485,side<0?-h*.3:h*.16,1,h*.14,5,7,'#fff0b7');
      box(-w*.505,side<0?-h*.3:h*.16,1,h*.14,5,7,'tail');
    }
    box(w*.496,-h*.13,.5,h*.26,4,6,TRIM);
  }
  // Faceted cylindrical tyres: their end caps and tread cull like the body.
  const radius=type==='bike'?4.2:tall?5:4,axles=type==='bike'?[-w*.34,w*.34]:[-w*.3,w*.29];
  for(const x of axles)for(const side of type==='bike'?[0]:[-1,1]){
    const y=side*h*.46,half=type==='bike'?h*.17:2.1,rings=[];
    for(const cy of [y-half,y+half])rings.push(Array.from({length:12},(_,i)=>[x+Math.cos(i*Math.PI/6)*radius,cy,radius+Math.sin(i*Math.PI/6)*radius]));
    for(let i=0;i<12;i++)face([rings[0][i],rings[1][i],rings[1][(i+1)%12],rings[0][(i+1)%12]],'#1d2428',false);
    face(rings[0],TRIM);face([...rings[1]].reverse(),TRIM);
    for(const cy of [y-half-.02,y+half+.02]){
      const hub=Array.from({length:12},(_,i)=>[x+Math.cos(i*Math.PI/6)*radius*.7,cy,radius+Math.sin(i*Math.PI/6)*radius*.7]);
      if(cy>y)hub.reverse();face(hub,CHROME,false);
      const outer=cy+(cy>y?.02:-.02),recess=Array.from({length:12},(_,i)=>[x+Math.cos(i*Math.PI/6)*radius*.58,outer,radius+Math.sin(i*Math.PI/6)*radius*.58]);
      if(cy>y)recess.reverse();face(recess,'#333b3e',false);
      for(let spoke=0;spoke<5;spoke++){
        const angle=spoke*Math.PI*2/5,point=(r,a)=>[x+Math.cos(a)*radius*r,outer+(cy>y?.02:-.02),radius+Math.sin(a)*radius*r];
        const pts=[point(.17,angle-.32),point(.62,angle-.12),point(.62,angle+.12),point(.17,angle+.32)];
        if(cy>y)pts.reverse();face(pts,'#b9c2bf',false);
      }
    }
  }
  return {type,length,breadth,faces,windshield:faces.find(f=>f.fill===GLASS&&f.normal[0]>0&&Math.abs(f.normal[1])<.01)};
}
export function projectedVehicleFaces(mesh,angle=0,lift=0,time=0,vehicle={}){
  const cs=Math.cos(angle),sn=Math.sin(angle),flash=Math.sin(time*12)>0;
  return mesh.faces.flatMap((face,order)=>{
    const [rx,ry,nz]=projectedNormal(face.normal,angle);
    if(rx+ry+nz<=.000001)return [];
    const norm=Math.hypot(rx,ry,nz),light=.74+.25*Math.max(0,(-rx*.3-ry*.4+nz*.86)/norm);
    let fill=face.fill;
    if(fill==='tail')fill=vehicle.braking||vehicle.brake?'#ff7860':'#ba4a3b';
    if(fill.startsWith('siren'))fill=fill==='sirenRed'?(flash?'#ff785d':'#a23734'):fill==='sirenBlue'?(flash?'#38567b':'#6cbafa'):(flash?'#9a6c2a':'#ffd582');
    const world=face.points.map(([x,y,z])=>[x*cs-y*sn,y*cs+x*sn,z]);
    return [{points:world.map(([x,y,z])=>[x-z-lift,y-z-lift]),fill:shade(fill,light),trim:face.trim,depth:world.reduce((sum,[x,y,z])=>sum+x+y+z,0)/world.length,order}];
  }).sort((a,b)=>{
    const delta=a.depth-b.depth;
    // At diagonal headings several equipment faces share a depth.  A stable
    // tie-break prevents one-frame painter-order flicker as floating point
    // rounding changes sign around a 45° turn.
    return Math.abs(delta)>1e-7?delta:a.order-b.order;
  });
}
export function drawStreetVehicle(ctx,car,time=0,lift=0){
  const type=car.type||car.model||'sedan',w=car.width||48,h=car.height||24,color=car.color||'#e09a3e';
  const key=`${type}:${w}:${h}:${color}:${!!car.isPolice}`;
  if(!cache.has(key))cache.set(key,createVehicleMesh(type,w,h,color,car.isPolice));
  const mesh=cache.get(key),faces=projectedVehicleFaces(mesh,car.angle||0,lift,time,car);
  ctx.save();ctx.translate(car.x,car.y);
  ctx.fillStyle='rgba(0,0,0,.32)';ctx.beginPath();ctx.ellipse(3,4,w*.54,h*.5,car.angle||0,0,Math.PI*2);ctx.fill();
  ctx.lineWidth=.55;ctx.lineJoin='round';ctx.strokeStyle='#263139';
  for(const face of faces){
    ctx.beginPath();face.points.forEach(([x,y],i)=>i?ctx.lineTo(x,y):ctx.moveTo(x,y));ctx.closePath();ctx.fillStyle=face.fill;ctx.fill();if(face.trim)ctx.stroke();
  }
  const glassNormal=mesh.windshield?.normal;
  const glassVisible=glassNormal&&projectedVisibility(glassNormal,car.angle||0)>.000001;
  if(glassVisible&&(car.rain>.15||(car.hp??100)<65)){
    const glass=mesh.windshield.points,cs=Math.cos(car.angle||0),sn=Math.sin(car.angle||0);
    const point=(u,v)=>{
      const a=glass[0].map((n,i)=>n+(glass[1][i]-n)*u),b=glass[3].map((n,i)=>n+(glass[2][i]-n)*u);
      const [x,y,z]=a.map((n,i)=>n+(b[i]-n)*v);
      return [x*cs-y*sn-z-lift-.06,y*cs+x*sn-z-lift-.06];
    };
    const line=(a,b)=>{ctx.beginPath();ctx.moveTo(...point(...a));ctx.lineTo(...point(...b));ctx.stroke();};
    ctx.lineWidth=.8;
    if(car.rain>.15){ctx.strokeStyle='#b8c2c0';const sweep=.3+.24*Math.sin(time*7);for(const u of [.22,.68])line([u,.08],[Math.max(.06,Math.min(.94,u+sweep-.3)),.76]);}
    if((car.hp??100)<65){ctx.strokeStyle='rgba(221,230,218,.6)';line([.45,.25],[.58,.7]);line([.58,.7],[.8,.83]);line([.58,.7],[.4,.8]);}
  }
  ctx.restore();
}
