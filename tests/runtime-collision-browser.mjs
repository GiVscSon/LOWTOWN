import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';

const PORT='4175';
const server=spawn('npx',['vite','--host','127.0.0.1','--port',PORT],{stdio:'inherit',shell:true});
const browser=await chromium.launch({headless:true});
const page=await browser.newPage({viewport:{width:1280,height:800}});

async function open(){
  for(let i=0;i<60;i++){
    try{
      await page.goto(`http://127.0.0.1:${PORT}/`,{waitUntil:'domcontentloaded',timeout:1000});
      return;
    }catch(e){
      if(i===59)throw e;
      await new Promise(r=>setTimeout(r,250));
    }
  }
}

try{
  await open();
  await page.waitForFunction(()=>Boolean(
    window.__LOWTOWN_PLAYER &&
    window.__LOWTOWN_TRAFFIC?.cars?.length &&
    window.__LOWTOWN_COLLISIONS
  ),null,{timeout:8000});

  const setup=await page.evaluate(()=>{
    const p=window.__LOWTOWN_PLAYER;
    const car=window.__LOWTOWN_TRAFFIC.cars.find(c=>c?.currentSegment);
    if(!car)throw new Error('no runtime traffic car available');

    const fx=Math.cos(car.angle),fy=Math.sin(car.angle);
    p.hp=100;
    p._trafficImpactCooldown=0;
    p.x=car.x+fx*23;
    p.y=car.y+fy*23;
    p.angle=car.angle+Math.PI;
    p.vx=-fx*125;
    p.vy=-fy*125;
    p.speed=125;

    const stats=window.__LOWTOWN_COLLISIONS;
    stats.playerHits=0;
    stats.trafficContacts=0;
    stats.totalDamage=0;
    stats.maxImpulse=0;

    return {
      carId:car.trafficId,
      carSpeed:car.speed,
      playerHp:p.hp,
      distance:Math.hypot(p.x-car.x,p.y-car.y)
    };
  });

  await page.waitForFunction(()=>window.__LOWTOWN_COLLISIONS.playerHits>=1,null,{timeout:3000});
  await page.waitForTimeout(120);

  const after=await page.evaluate(carId=>{
    const p=window.__LOWTOWN_PLAYER;
    const car=window.__LOWTOWN_TRAFFIC.cars.find(c=>c.trafficId===carId);
    const stats=window.__LOWTOWN_COLLISIONS;
    return {
      hp:p.hp,
      playerSpeed:Math.hypot(p.vx||0,p.vy||0),
      carSpeed:car?.speed,
      carCruise:car?.cruiseSpeed,
      carHold:car?.collisionHold||0,
      distance:car?Math.hypot(p.x-car.x,p.y-car.y):Infinity,
      playerHits:stats.playerHits,
      totalDamage:stats.totalDamage,
      maxImpulse:stats.maxImpulse,
      runtimeError:String(window.__lowtownLastError||'')
    };
  },setup.carId);

  assert.equal(after.runtimeError,'',`runtime error during collision test: ${after.runtimeError}`);
  assert.ok(after.playerHits>=1,`expected a player collision, got ${after.playerHits}`);
  assert.ok(after.hp<setup.playerHp,`HP did not decrease: before=${setup.playerHp}, after=${after.hp}`);
  assert.ok(after.totalDamage>0,`collision damage telemetry missing: ${after.totalDamage}`);
  assert.ok(after.maxImpulse>1200,`collision impulse too small: ${after.maxImpulse}`);
  assert.ok(Number.isFinite(after.carSpeed)&&after.carSpeed<setup.carSpeed,
    `NPC did not react to impact: before=${setup.carSpeed}, after=${after.carSpeed}`);
  assert.ok(after.distance>8,`vehicles remained deeply stacked after response: distance=${after.distance}`);

  console.log('LOWTOWN RUNTIME COLLISION BROWSER: PASS',JSON.stringify({setup,after}));
}catch(e){
  console.error('LOWTOWN RUNTIME COLLISION BROWSER: FAIL',e.stack||e);
  throw e;
}finally{
  await browser.close();
  server.kill('SIGTERM');
}
