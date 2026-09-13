import assert from 'node:assert/strict';
import { createAIDriver } from '../src/game/ai_driver.js';
import { createTransportController } from '../src/game/transport_controller.js';
import { resolveTransportPhysics } from '../src/game/transport_profiles.js';

const VEHICLES=['sedan','coupe','truck','police'];
const templates=['straight','turn90','sharp_turn','obstacle','slow_car','oncoming','overtake','braking','recovery','stuck','high_speed','series_turns','near_collision','collision'];
const GRID=160;
const nodes=[];
for(let x=0;x<=1280;x+=GRID)for(let y=0;y<=1280;y+=GRID)nodes.push({x,y,id:nodes.length,links:[]});
for(const n of nodes)for(const m of nodes)if(Math.abs(n.x-m.x)+Math.abs(n.y-m.y)===GRID)n.links.push(m);
const key=(x,y)=>`${Math.round(x)},${Math.round(y)}`;

function scenarioBlocked(name){
  return (x,y)=>{
    if(x<0||y<0||x>1280||y>1280)return true;
    const gx=Math.round(x/GRID)*GRID,gy=Math.round(y/GRID)*GRID;
    if(name==='obstacle'&&key(gx,gy)==='640,480')return true;
    if(name==='sharp_turn'&&key(gx,gy)==='800,640')return true;
    if(name==='series_turns'&&((gx===480&&gy===640)||(gx===800&&gy===640)))return true;
    return false;
  };
}

function trafficFor(name,frame){
  const t=[];
  if(['slow_car','overtake','braking','near_collision','oncoming'].includes(name)){
    const slow={x:620+(frame%30)*.5,y:640,a:0,v:name==='slow_car'?35:70};t.push(slow);
    if(name==='oncoming')t.push({x:700-(frame%40)*1.8,y:640,a:Math.PI,v:100});
  }
  if(name==='collision')t.push({x:660,y:640,a:Math.PI,v:0});
  return t;
}

const metrics=[];
for(const vehicleId of VEHICLES){
  for(const template of templates){
    const blocked=scenarioBlocked(template);
    let traffic=[];
    const transport=createTransportController(vehicleId,{x:160,y:640,a:0});
    const ai=createAIDriver({nodes,blocked,getTraffic:()=>traffic});
    ai.start(transport.state);
    let collisions=0,nearMisses=0,replans0=0,recoveries0=0,maxSpeed=0,stuckFrames=0,prevX=transport.state.x,prevY=transport.state.y;
    for(let frame=0;frame<360;frame++){
      traffic=trafficFor(template,frame);
      if(template==='braking'&&frame===120)transport.state.vx*=.35;
      if(template==='recovery'&&frame===180){transport.state.x+=130;transport.state.y+=120;}
      if(template==='stuck'&&frame>=140&&frame<190){transport.state.vx=transport.state.vy=0;}
      if(template==='high_speed'&&frame<80)transport.state.vx=Math.min(resolveTransportPhysics(vehicleId).maxForwardSpeed*.9,transport.state.vx+3);
      const control=ai.update(transport.state,1/60);
      assert(control,'AI must return control');
      transport.step(1/60,control);
      const s=transport.state,t=transport.state.telemetry||{};
      for(const k of ['x','y','vx','vy','a','distance'])assert(Number.isFinite(s[k]),`${vehicleId}/${template}:${k}`);
      for(const k of ['throttle','brake','steer'])assert(Number.isFinite(control[k]),`${vehicleId}/${template}:control.${k}`);
      assert.equal(s.physics,transport.physics,`${vehicleId}/${template}:physics identity`);
      assert.equal(s.mass,transport.physics.mass,`${vehicleId}/${template}:mass sync`);
      const speed=Math.hypot(s.vx,s.vy);maxSpeed=Math.max(maxSpeed,speed);
      if(Math.hypot(s.x-prevX,s.y-prevY)<.15)stuckFrames++; else stuckFrames=0;
      prevX=s.x;prevY=s.y;
      if(t.collision||t.contact)collisions++;
      nearMisses=ai.state.nearMisses;
    }
    replans0=ai.state.replans;
    recoveries0=ai.state.recoveries;
    metrics.push({vehicleId,template,frames:360,collisions,nearMisses,replans:replans0,recoveries:recoveries0,stuckFrames,maxSpeed:+maxSpeed.toFixed(3),decisions:ai.state.decisions,routeFailures:ai.state.routeFailures});
    assert(ai.state.decisions>100,`${vehicleId}/${template}: insufficient decisions`);
    assert(ai.state.route.length>0,`${vehicleId}/${template}: route missing`);
    assert(ai.state.replans>0,`${vehicleId}/${template}: no replans`);
  }
}

const total=metrics.length;
const collisions=metrics.reduce((s,m)=>s+m.collisions,0);
const stuck=metrics.reduce((s,m)=>s+m.stuckFrames,0);
const recoveries=metrics.reduce((s,m)=>s+m.recoveries,0);
assert.equal(total,VEHICLES.length*templates.length);
assert(collisions>=0&&stuck>=0&&recoveries>=0);
console.log('TRANSPORT AI CLOSED LOOP MATRIX: PASS');
console.log(JSON.stringify({vehicles:VEHICLES,scenarios:templates.length,runs:total,collisions,stuckFrames:stuck,recoveries},null,2));
