import {addLoft,addBox,faceNormal} from './vehicle_shapes.js';
const GLASS='#263b46',TRIM='#232b30',CHROME='#abb6b4';
const cache=new Map();
function projectedNormal(normal,angle=0){const cs=Math.cos(angle),sn=Math.sin(angle),[nx,ny,nz]=normal;return [nx*cs-ny*sn,nx*sn+ny*cs,nz];}
function projectedVisibility(normal,angle=0){const [rx,ry,nz]=projectedNormal(normal,angle);return rx+ry+nz;}
function shade(color,amount){const match=/^#([\da-f]{6})$/i.exec(color);if(!match)return color;const n=parseInt(match[1],16);return `rgb(${[n>>16,(n>>8)&255,n&255].map(v=>Math.round(Math.min(255,v*amount+(amount>1?12:0)))).join(',')})`;}
export function createVehicleMesh(type='sedan',length=48,breadth=24,color='#e09a3e',police=false){
  const faces=[],w=length,h=breadth,scale=h/24;
  const tactical=type==='armoredPolice',guard=type==='nationalGuard',fire=type==='fireEngine',ems=type==='ambulance';
  const patrol=(police||type==='police')&&!tactical&&!guard,service=patrol||tactical||guard||fire||ems;
  const tall=['van','bus','truck','armoredPolice','nationalGuard','fireEngine','ambulance'].includes(type);
  const sport=type==='sports',coupe=type==='coupe';
  const paint=guard?'#788361':tactical?'#5e7179':fire?'#b63d32':ems?'#e9e5d7':patrol?'#e4e6df':type==='taxi'?'#e9b72e':color;
  const face=(points,fill,surface='paint')=>{const n=faceNormal(points);if(Math.hypot(...n)>1e-8)faces.push({points,normal:n,fill,surface,trim:false});};
  const box=(x,y,l,b,z0,z1,fill,surface='paint')=>addBox(faces,x,y,l,b,z0,z1,fill,surface);
  const radius=(type==='bike'?4.2:tall?4.6:4)*scale,axles=type==='bike'?[-w*.34,w*.34]:guard?[-w*.32,-w*.14,w*.30]:[-w*.29,w*.29];
  const bodyZ=(sport?8.5:coupe?9:9.5)*scale+(tall?1*scale:0);
  let windshield;
  if(type==='bike'){
    const tank=[[-.22,.2,7],[-.14,.3,10],[.08,.29,11],[.25,.13,8]].map(([x,b,z])=>Array.from({length:8},(_,i)=>{const a=i*Math.PI/4;return [x*w,Math.cos(a)*h*b,z+Math.sin(a)*h*.17];}));
    addLoft(faces,tank,paint);box(-w*.32,-h*.2,w*.27,h*.4,8,10,TRIM,'rubber');
    box(-w*.25,-.7,w*.53,1.4,3,5,CHROME,'chrome');box(w*.22,-h*.46,1,h*.92,11,12,CHROME,'chrome');
    box(-w*.09,-h*.21,w*.19,h*.42,10,17,'#666854');
    const helmet=[[-w*.11,1.6,18],[-w*.05,2.5,20],[w*.015,1.8,21]].map(([x,r,z])=>Array.from({length:8},(_,i)=>[x,Math.cos(i*Math.PI/4)*r,z+Math.sin(i*Math.PI/4)*r]));addLoft(faces,helmet,'#d0c6b0');
    for(const side of [-1,1])box(0,side*h*.21,w*.22,1.5,13,14,'#666854');
  }else{
    // Real wheel openings are cut into the lower silhouette, with a rounded
    // shoulder and tapered nose/boot. All models retain their collision size.
    const archRadius=radius*1.1,stations=new Set([-.5*w,-.475*w,-.43*w,-.12*w,.12*w,.43*w,.475*w,.5*w]);
    for(const axle of axles)for(const t of [-1,-.7,0,.7,1])stations.add(axle+archRadius*t);
    const ringAt=x=>{
      const end=Math.max(0,(Math.abs(x)/w-.43)/.07),width=h*(.49-.095*end),top=bodyZ-(x>0?1.2:.65)*scale*end;
      let low=3*scale;for(const axle of axles){const dx=x-axle;if(Math.abs(dx)<archRadius)low=Math.max(low,radius+Math.sqrt(archRadius**2-dx**2));}
      const shoulder=Math.max(low+.22*scale,top-.9*scale);
      return [[x,-width*.67,2.8*scale],[x,-width,low],[x,-width,shoulder],[x,-width*.83,top],[x,width*.83,top],[x,width,shoulder],[x,width,low],[x,width*.67,2.8*scale]];
    };
    addLoft(faces,[...stations].sort((a,b)=>a-b).map(ringAt),paint);
    let back=-w*.29,front=w*.2,roofBack=-w*.18,roofFront=w*.055,roofZ=15*scale;
    if(coupe||sport){back=-w*.32;front=w*.19;roofBack=-w*.18;roofFront=w*.05;roofZ=(sport?12.7:13.8)*scale;}
    if(type==='wagon'){back=-w*.43;roofBack=-w*.37;roofZ=15.8*scale;}
    if(tall){back=-w*.45;front=w*.36;roofBack=-w*.415;roofFront=w*.27;roofZ=(type==='bus'?21:19)*scale;}
    if(type==='truck'||guard||fire){back=w*.055;roofBack=w*.075;roofFront=w*.27;roofZ=18.5*scale;}
    const cabinStations=[[back,bodyZ+.18*scale,.415],[roofBack,roofZ-.35*scale,.34],[(roofBack+roofFront)/2,roofZ,.335],[roofFront,roofZ-.35*scale,.34],[front,bodyZ+.18*scale,.415]];
    const cabinRing=([x,z,width])=>[[x,-h*.423,bodyZ],[x,-h*width,z-.55*scale],[x,-h*(width-.035),z],[x,h*(width-.035),z],[x,h*width,z-.55*scale],[x,h*.423,bodyZ]];
    const rings=cabinStations.map(cabinRing);
    addLoft(faces,rings,paint,{caps:false,fill:(station,band)=>{
      const glass=(band===0||band===4)||(band>=1&&band<=3&&(station===0||station===3));
      const opaque=tall&&type!=='bus'&&station<2;
      return {fill:glass&&!opaque?GLASS:paint,surface:glass&&!opaque?'glass':'paint'};
    }});
    // Glass seals and door pillars lie on the sloping cabin sides.
    const interpolate=(x)=>{let i=0;while(i<3&&x>cabinStations[i+1][0])i++;const a=cabinStations[i],b=cabinStations[i+1],t=Math.max(0,Math.min(1,(x-a[0])/(b[0]-a[0])));return [a[1]+(b[1]-a[1])*t,a[2]+(b[2]-a[2])*t];};
    const sidePatch=(x0,x1,v0,v1,fill,surface='paint')=>{for(const side of [-1,1]){const point=(x,v)=>{const [roof,breadth]=interpolate(x);return [x,side*(h*(.423+(breadth-.423)*v)+.045*scale),bodyZ+(roof-.55*scale-bodyZ)*v];};const pts=[point(x0,v0),point(x1,v0),point(x1,v1),point(x0,v1)];if(side>0)pts.reverse();face(pts,fill,surface);}};
    sidePatch(back+.25*scale,front-.25*scale,0,.08,TRIM,'rubber');sidePatch(roofBack,roofFront,.94,1,paint);
    const pillars=coupe||sport?[back+.5*scale,front-1*scale]:type==='bus'?Array.from({length:7},(_,i)=>back+(front-back)*(i+1)/8):[back+1*scale,(roofBack+roofFront)/2,front-1*scale];
    for(const x of pillars)sidePatch(x-.5*scale,x+.5*scale,.07,.97,paint);
    const glassPoints=[rings[3][1],rings[3][4],rings[4][5],rings[4][0]];
    windshield={points:glassPoints,normal:[1,0,1]};
    for(const station of [0,3]){
      const left=station===3?rings[3][1]:rings[1][1],right=station===3?rings[3][4]:rings[1][4],baseLeft=station===3?rings[4][0]:rings[0][0],baseRight=station===3?rings[4][5]:rings[0][5];
      const point=(u,v)=>left.map((n,i)=>n+(right[i]-n)*u+((baseLeft[i]+(baseRight[i]-baseLeft[i])*u)-(n+(right[i]-n)*u))*v+(i===2?.06*scale:0));
      const patch=(u0,u1,v0,v1,fill)=>{const pts=[point(u0,v0),point(u1,v0),point(u1,v1),point(u0,v1)];if(station===0)pts.reverse();face(pts,fill,'rubber');};
      patch(0,.025,0,1,TRIM);patch(.975,1,0,1,TRIM);patch(0,1,0,.045,TRIM);patch(0,1,.955,1,TRIM);
      if(station===3){patch(.10,.45,.81,.825,TRIM);patch(.55,.90,.81,.825,TRIM);}else for(let line=0;line<4;line++)patch(.06,.94,.25+line*.14,.259+line*.14,'#677775');
    }

    // Fine belt lines, panel seams, handles and mirrors replace thick slabs.
    const sidePanel=(x,l,z0,z1,fill,surface='paint')=>{
      const breaks=[x,...[...stations].filter(t=>t>x&&t<x+l).sort((a,b)=>a-b),x+l];
      const low=t=>{let bottom=z0;for(const axle of axles){const dx=t-axle;if(Math.abs(dx)<archRadius)bottom=Math.max(bottom,radius+Math.sqrt(archRadius**2-dx**2)+.05*scale);}return Math.min(z1,bottom);};
      for(const side of [-1,1])for(let i=0;i<breaks.length-1;i++){const a=breaks[i],b=breaks[i+1];if(low(a)>=z1&&low(b)>=z1)continue;const points=[[a,side*h*.491,low(a)],[b,side*h*.491,low(b)],[b,side*h*.491,z1],[a,side*h*.491,z1]];if(side>0)points.reverse();face(points,fill,surface);}
    };
    sidePanel(-w*.405,w*.81,bodyZ-1.9*scale,bodyZ-1.15*scale,patrol?'#254e87':TRIM,patrol?'paint':'rubber');
    if(patrol)sidePanel(-w*.405,w*.81,bodyZ-3.5*scale,bodyZ-1.15*scale,'#254e87');
    for(const x of (coupe||sport?[back+.02*w,front]:[back+.02*w,(back+front)/2,front])){sidePanel(x,.11*scale,4.2*scale,bodyZ-1.9*scale,TRIM);sidePanel(x-2.4*scale,2*scale,bodyZ-.9*scale,bodyZ-.5*scale,CHROME,'chrome');}
    for(const side of [-1,1])box(front-2*scale,side>0?h*.45:-h*.54,2.5*scale,h*.09,bodyZ+.4*scale,bodyZ+1.4*scale,paint);
    // Slim rounded bumpers follow the tapered ends of the shell.
    for(const end of [-1,1]){
      const bumper=[end*w*.492,end*w*.515].map(x=>{const z=4.1*scale;return [[x,-h*.32,z-.6*scale],[x,-h*.375,z],[x,-h*.32,z+.65*scale],[x,h*.32,z+.65*scale],[x,h*.375,z],[x,h*.32,z-.6*scale]];});
      if(end<0)bumper.reverse();addLoft(faces,bumper,CHROME,{surface:'chrome'});
      const x=end*w*.501,plate=[[x,-h*.115,3.3*scale],[x,h*.115,3.3*scale],[x,h*.115,4.5*scale],[x,-h*.115,4.5*scale]];if(end<0)plate.reverse();face(plate,'#b8bcb2');
      for(const side of [-1,1]){const y0=side<0?-h*.335:h*.16,points=[[x,y0,5.4*scale],[x,y0+h*.175,5.4*scale],[x,y0+h*.175,7.3*scale],[x,y0,7.3*scale]];if(end<0)points.reverse();face(points,end>0?'#fff0b7':'tail','lamp');}
      if(end>0){face([[x,-h*.14,5*scale],[x,h*.14,5*scale],[x,h*.14,7.4*scale],[x,-h*.14,7.4*scale]],TRIM,'rubber');for(let i=0;i<3;i++)face([[x+.04,-h*.13,(5.4+i*.55)*scale],[x+.04,h*.13,(5.4+i*.55)*scale],[x+.04,h*.13,(5.55+i*.55)*scale],[x+.04,-h*.13,(5.55+i*.55)*scale]],CHROME,'chrome');}
    }
    // Hood shut lines and a narrow sky reflection stay flush to the sheet metal.
    for(const side of [-1,1])face([[front+scale,side*h*.285,bodyZ+.035*scale],[w*.425,side*h*.285,bodyZ+.035*scale],[w*.425,side*h*.292,bodyZ+.035*scale],[front+scale,side*h*.292,bodyZ+.035*scale]],TRIM);
    if(type==='taxi'){for(let i=0;i<18;i++)sidePanel(-w*.38+i*w*.043,w*.0215,bodyZ-2.3*scale,bodyZ-1.3*scale,i%2?TRIM:'#e9dfac');box(-2.5*scale,-2.5*scale,6*scale,5*scale,roofZ,roofZ+1.6*scale,'#edca56');face([[-2.51*scale,-2.5*scale,roofZ+.3*scale],[-2.51*scale,2.5*scale,roofZ+.3*scale],[-2.51*scale,2.5*scale,roofZ+1.3*scale],[-2.51*scale,-2.5*scale,roofZ+1.3*scale]],TRIM);}
    if(type==='truck'||guard||fire){box(-w*.44,-h*.425,w*.47,h*.85,bodyZ,(type==='truck'?24:17.5)*scale,guard?'#5f7152':fire?paint:'#b5b4a7');for(const side of [-1,1]){for(let i=0;i<4;i++)box(-w*.415+i*w*.11,side*h*.428,fire?w*.09:.65*scale,.25*scale,11*scale,(type==='truck'?23:16)*scale,fire?'#aab5b4':guard?'#839074':'#a2a294');}}
    if(ems){box(-w*.44,-h*.435,w*.48,h*.87,bodyZ,25*scale,paint);for(const side of [-1,1])box(-w*.43,side*h*.437,w*.46,.12*scale,13*scale,14.5*scale,'#bc493b');}
    if(ems)for(const side of [-1,1]){const x=-w*.22,y=side*h*.439,z=20*scale;const pts=[[-3,-1],[-1,-1],[-1,-3],[1,-3],[1,-1],[3,-1],[3,1],[1,1],[1,3],[-1,3],[-1,1],[-3,1]].map(([a,b])=>[x+a*scale,y,z+b*scale]);if(side>0)pts.reverse();face(pts,'#db5f47');}
    if(tactical)box(-w*.17,-h*.20,w*.19,h*.4,roofZ,roofZ+.8*scale,TRIM);
    if(fire){for(const side of [-1,1])box(-w*.42,side*h*.16,w*.43,.8*scale,18*scale,19*scale,CHROME,'chrome');for(let i=0;i<7;i++)box(-w*.40+i*w*.057,-h*.16,.8*scale,h*.32,18*scale,18.6*scale,CHROME,'chrome');}
    if(type==='wagon'){for(const side of [-1,1])box(roofBack,-side*h*.23,roofFront-roofBack,.65*scale,roofZ+.15*scale,roofZ+.65*scale,TRIM);for(const x of [roofBack+w*.06,roofFront-w*.04])box(x,-h*.23,.55*scale,h*.46,roofZ+.15*scale,roofZ+.65*scale,CHROME,'chrome');}
    if(type==='bus')box(-w*.2,-h*.2,w*.28,h*.4,roofZ,roofZ+1.5*scale,'#b8b9a9');
    if(sport)box(-w*.43,-h*.34,w*.08,h*.68,bodyZ+1.3*scale,bodyZ+1.9*scale,paint);
    if(service){const x=(roofBack+roofFront)/2-1.7*scale;box(x,-h*.28,3.4*scale,h*.56,roofZ,roofZ+.65*scale,TRIM);box(x,-h*.27,3.4*scale,h*.23,roofZ+.65*scale,roofZ+2*scale,'sirenRed','lamp');box(x,h*.04,3.4*scale,h*.23,roofZ+.65*scale,roofZ+2*scale,fire?'sirenAmber':'sirenBlue','lamp');}
    if(patrol){for(const side of [-1,1])box(w*.512,side*h*.12,1*scale,1*scale,3.6*scale,8*scale,TRIM);box(w*.514,-h*.12,1*scale,h*.28,7*scale,7.8*scale,TRIM);}
  }
  // Rounded tyre shoulders and circular alloy rims. Only the visible outer
  // wheel face needs spokes; the inner cap remains a simple dark disc.
  for(const x of axles)for(const side of type==='bike'?[0]:[-1,1]){
    const y=side*h*.456,half=(type==='bike'?h*.16:1.65*scale),segments=16;
    const rings=[[-half,.9],[-half*.65,1],[half*.65,1],[half,.9]].map(([offset,r])=>Array.from({length:segments},(_,i)=>{const a=i*Math.PI*2/segments;return [x+Math.cos(a)*radius*r,y+offset,radius+Math.sin(a)*radius*r];}));
    // Loft helper runs along x; tyre winding is explicitly outward here.
    addLoft(faces,rings,'#1d2428',{surface:'rubber'});
    const outer=side>=0?y+half+.025*scale:y-half-.025*scale;
    let discLayer=0;const disc=(r,fill)=>{const cy=outer+(side>=0?1:-1)*discLayer++*.025*scale;const points=Array.from({length:segments},(_,i)=>{const a=i*Math.PI*2/segments;return [x+Math.cos(a)*radius*r,cy,radius+Math.sin(a)*radius*r];});if(side>=0)points.reverse();face(points,fill,fill===CHROME?'chrome':'rubber');};
    disc(.72,CHROME);disc(.6,'#333b3e');
    for(let spoke=0;spoke<5;spoke++){const angle=spoke*Math.PI*2/5,p=(r,a)=>[x+Math.cos(a)*radius*r,outer+(side>=0?.04:-.04)*scale,radius+Math.sin(a)*radius*r];const points=[p(.16,angle-.38),p(.66,angle-.10),p(.66,angle+.10),p(.16,angle+.38)];if(side>=0)points.reverse();face(points,CHROME,'chrome');}
    disc(.18,CHROME);
  }
  return {type,length,breadth,faces,windshield};
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
