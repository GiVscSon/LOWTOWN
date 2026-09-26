import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import fs from 'node:fs';

const PORT='4174';
const server=spawn('npx',['vite','--host','127.0.0.1','--port',PORT],{stdio:'inherit',shell:true});
const browser=await chromium.launch({headless:true});
fs.mkdirSync('test-results',{recursive:true});

const cases=[
  {name:'mobile',viewport:{width:390,height:844},deviceScaleFactor:2,isMobile:true,hasTouch:true},
  {name:'tablet',viewport:{width:800,height:1100},deviceScaleFactor:2,isMobile:true,hasTouch:true},
  {name:'desktop',viewport:{width:1280,height:800},deviceScaleFactor:1,isMobile:false,hasTouch:false}
];

async function open(page){
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
  for(const cfg of cases){
    const context=await browser.newContext({
      viewport:cfg.viewport,
      deviceScaleFactor:cfg.deviceScaleFactor,
      isMobile:cfg.isMobile,
      hasTouch:cfg.hasTouch
    });
    const page=await context.newPage();
    await open(page);

    await page.waitForFunction(
      ()=>Number.isFinite(window.__lowtownLastFrame) && performance.now()-window.__lowtownLastFrame<1200,
      null,
      {timeout:8000}
    );
    await page.waitForTimeout(1200);

    const metrics=await page.evaluate(()=>{
      const canvas=document.getElementById('gameCanvas');
      if(!canvas)throw new Error('gameCanvas missing');
      const ctx=canvas.getContext('2d',{willReadFrequently:true});
      const rect=canvas.getBoundingClientRect();
      const dpr=Math.max(1,canvas.width/Math.max(1,rect.width));
      const data=ctx.getImageData(0,0,canvas.width,canvas.height).data;

      let sampled=0,water=0,bright=0;
      const bins=new Map();
      const stride=Math.max(1,Math.round(8*dpr));
      for(let y=0;y<canvas.height;y+=stride){
        for(let x=0;x<canvas.width;x+=stride){
          const i=(y*canvas.width+x)*4;
          const r=data[i],g=data[i+1],b=data[i+2],a=data[i+3];
          if(a<16)continue;
          sampled++;
          if(Math.abs(r-6)<=16&&Math.abs(g-20)<=18&&Math.abs(b-27)<=20)water++;
          if(r+g+b>150)bright++;
          const key=`${r>>5}:${g>>5}:${b>>5}`;
          bins.set(key,(bins.get(key)||0)+1);
        }
      }
      const dominant=Math.max(0,...bins.values())/Math.max(1,sampled);

      const cx=Math.round(canvas.width/2),cy=Math.round(canvas.height/2);
      const half=Math.max(24,Math.round(38*dpr));
      const sx=Math.max(0,cx-half),sy=Math.max(0,cy-half);
      const sw=Math.min(canvas.width-sx,half*2),sh=Math.min(canvas.height-sy,half*2);
      const center=ctx.getImageData(sx,sy,sw,sh).data;
      let gold=0,centerOpaque=0;
      for(let i=0;i<center.length;i+=4){
        const r=center[i],g=center[i+1],b=center[i+2],a=center[i+3];
        if(a<16)continue;
        centerOpaque++;
        if(r>=150&&g>=85&&g<=210&&b<=125&&r>=g+18)gold++;
      }

      const errorText=String(window.__lowtownLastError||'');
      const failText=(document.getElementById('fatalError')?.textContent||document.getElementById('labError')?.textContent||'').trim();

      return {
        canvasWidth:canvas.width,canvasHeight:canvas.height,
        cssWidth:rect.width,cssHeight:rect.height,dpr,
        sampled,waterRatio:water/Math.max(1,sampled),
        brightRatio:bright/Math.max(1,sampled),
        uniqueBins:bins.size,dominantRatio:dominant,
        centerGoldRatio:gold/Math.max(1,centerOpaque),centerGoldPixels:gold,
        errorText,failText
      };
    });

    await page.screenshot({path:`test-results/visual-${cfg.name}.png`,fullPage:true});

    assert.equal(metrics.errorText,'',`${cfg.name}: runtime error: ${metrics.errorText}`);
    assert.ok(metrics.cssWidth>=cfg.viewport.width*.95,`${cfg.name}: canvas width too small: ${metrics.cssWidth}`);
    assert.ok(metrics.cssHeight>=cfg.viewport.height*.75,`${cfg.name}: canvas height too small: ${metrics.cssHeight}`);
    assert.ok(metrics.waterRatio<0.55,`${cfg.name}: water/background dominates frame: ${(metrics.waterRatio*100).toFixed(1)}%`);
    assert.ok(metrics.dominantRatio<0.82,`${cfg.name}: one flat color dominates frame: ${(metrics.dominantRatio*100).toFixed(1)}%`);
    assert.ok(metrics.uniqueBins>=8,`${cfg.name}: scene has too little color/geometry diversity: ${metrics.uniqueBins} bins`);
    assert.ok(metrics.brightRatio>0.006,`${cfg.name}: scene is nearly black: ${(metrics.brightRatio*100).toFixed(2)}% bright samples`);
    assert.ok(metrics.centerGoldPixels>20&&metrics.centerGoldRatio>0.002,
      `${cfg.name}: player car is not visually present near viewport center (gold=${metrics.centerGoldPixels}, ratio=${metrics.centerGoldRatio})`);

    console.log('LOWTOWN VISUAL FRAME',cfg.name,JSON.stringify(metrics));
    await context.close();
  }
  console.log('LOWTOWN VISUAL REGRESSION GATE: PASS');
} catch(e){
  console.error('LOWTOWN VISUAL REGRESSION GATE: FAIL',e.stack||e);
  throw e;
} finally {
  await browser.close();
  server.kill('SIGTERM');
}
