import {worldPoint} from '../src/world/archipelago.js';
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { setTimeout as delay } from 'node:timers/promises';
import { chromium } from 'playwright';

const root = new URL('../', import.meta.url).pathname;
const artifactDir = process.env.LOWTOWN_AERIAL_ARTIFACT_DIR || `${root}artifacts/aerial-city`;
const url = 'http://127.0.0.1:4174/?cityQA=1';
const server = spawn(process.execPath, ['node_modules/vite/bin/vite.js', 'preview', '--host', '127.0.0.1', '--port', '4174', '--strictPort'], {
  cwd: root,
  stdio: 'ignore'
});
let browser;
let page;
const errors = [];
const shots = [];

mkdirSync(artifactDir, { recursive: true });

async function waitForPreview() {
  for (let attempt = 0; attempt < 80; attempt += 1) {
    try {
      const response = await fetch(url);
      if (response.ok) return;
    } catch {}
    await delay(250);
  }
  throw new Error('LOWTOWN preview server did not become ready');
}

async function screenshot(name) {
  await page.waitForTimeout(180);
  const canvas = await page.evaluate(() => {
    const renderer=window.__lowtownRenderer;
    const element=document.getElementById(renderer==='three'?'threeCanvas':'gameCanvas');
    return {
      renderer,
      width:element?.width||0,
      height:element?.height||0,
      visible:!!element&&getComputedStyle(element).display!=='none',
      frames:window.__lowtownThreeStats?.frames||0,
      camera:window.__lowtownThreeStats?.camera||null
    };
  });
  assert(canvas.visible, `active renderer canvas is hidden: ${JSON.stringify(canvas)}`);
  const viewport=page.viewportSize();
  assert(canvas.width >= Math.min(640,viewport.width*.5) && canvas.height >= Math.min(360,viewport.height*.5), `adaptive game canvas size is too small: ${JSON.stringify(canvas)}`);
  if(canvas.renderer==='three')assert(canvas.frames>=2,`Three.js renderer is not advancing: ${JSON.stringify(canvas)}`);
  const path = `${artifactDir}/${name}.png`;
  await page.screenshot({ path });
  shots.push({ name, path, canvas });
}

async function hold(...keys) {
  for (const key of keys) await page.keyboard.down(key);
}

async function release(...keys) {
  for (const key of keys) await page.keyboard.up(key);
}

async function flyStraight(name, milliseconds) {
  await hold('w');
  const midpoint = Math.floor(milliseconds / 2);
  await page.waitForTimeout(midpoint);
  await screenshot(`${name}-mid`);
  await page.waitForTimeout(milliseconds - midpoint);
  await release('w');
  await screenshot(name);
}

async function turnRight() {
  await hold('d');
  await page.waitForTimeout(1400);
  await release('d');
}

try {
  await waitForPreview();
  browser = await chromium.launch({ headless: true });
  page = await browser.newPage({ viewport: { width: 1600, height: 1000 }, deviceScaleFactor: 1 });
  page.on('pageerror', error => errors.push(`pageerror: ${error.message}`));
  page.on('console', message => {
    if (message.type() === 'error') errors.push(`console: ${message.text()}`);
  });
  await page.addInitScript(savedSpawn => {
    // Spawn just north of the airport helicopter so the first safe exit leaves
    // it closer than the sedan we just exited.
    localStorage.setItem('lowtown_integrity_save', JSON.stringify({cash:750,worldVersion:3,streetLayout:'organic-v1',...savedSpawn}));
  },worldPoint({x:1040,y:2010}));
  const response = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 15000 });
  assert(response?.ok(), `LOWTOWN preview returned HTTP ${response?.status()}`);
  await page.waitForFunction(() =>
    window.__lowtownRenderer==='three' &&
    window.__lowtownThreeStats?.frames>=3 &&
    Number.isFinite(window.__lowtownLastFrame) &&
    performance.now()-window.__lowtownLastFrame<1500,
    null,{timeout:15000}
  );
  await page.locator('#threeCanvas').waitFor({ state: 'visible', timeout: 15000 });
  await page.locator('#hudDistrict').waitFor({ state: 'visible', timeout: 10000 });
  const groundCamera = await page.evaluate(() => window.__lowtownThreeStats?.camera);
  assert(groundCamera&&Number.isFinite(groundCamera.y),'Three.js ground camera metrics are unavailable');

  await page.locator('#btnOpenMap').click();
  await page.locator('#mapModal').waitFor({ state: 'visible', timeout: 5000 });
  const mapCanvas = page.locator('#fullMapCanvas');
  await mapCanvas.waitFor({ state: 'visible', timeout: 5000 });
  const mapSize = await mapCanvas.evaluate(element => ({ width: element.width, height: element.height }));
  assert(mapSize.width >= 800 && mapSize.height >= 600, `full-city map is not a readable overview: ${JSON.stringify(mapSize)}`);
  const mapPath = `${artifactDir}/full-city-map.png`;
  await page.screenshot({ path: mapPath });
  shots.push({ name: 'full-city-map', path: mapPath, mapCanvas: mapSize });
  await page.locator('#btnCloseMap').click();
  await page.locator('#mapModal').waitFor({ state: 'hidden', timeout: 5000 });

  await page.locator('#threeCanvas').click({ position: { x: 500, y: 450 } });
  await page.keyboard.press('e');
  await page.waitForFunction(() => document.querySelector('#toastMsg')?.textContent?.includes('Пешком'), null, { timeout: 5000 });
  await page.keyboard.press('e');
  await page.waitForTimeout(150);
  const boardingToast = await page.locator('#toastMsg').textContent().catch(() => '');
  assert(boardingToast.includes('Вертолёт'), `could not board the nearby helicopter: ${boardingToast || 'no boarding message'}`);
  await page.waitForFunction(() => /\d+ м/.test(document.querySelector('#hudGear')?.textContent || ''), null, { timeout: 5000 });
  await page.keyboard.press('q');
  await hold('w');
  await page.waitForFunction(()=>Number.parseInt(document.querySelector('#hudGear')?.textContent||'',10)>=205,null,{timeout:20000});
  await page.waitForTimeout(300);
  await release('w');
  const airHeight = await page.locator('#hudGear').textContent();
  assert(Number.parseInt(airHeight, 10) >= 180, `helicopter did not reach useful aerial height: ${airHeight}`);
  const aerialCamera = await page.evaluate(() => window.__lowtownThreeStats?.camera);
  assert(aerialCamera&&aerialCamera.y>groundCamera.y+140,
    `helicopter altitude did not lift the Three.js camera enough: ${JSON.stringify(groundCamera)} -> ${JSON.stringify(aerialCamera)}`);
  assert(aerialCamera.distance>groundCamera.distance+120,
    `helicopter altitude did not widen the Three.js chase view enough: ${JSON.stringify(groundCamera)} -> ${JSON.stringify(aerialCamera)}`);
  await screenshot('aerial-takeoff');

  await flyStraight('aerial-east', 16000);
  await turnRight();
  await flyStraight('aerial-southeast', 19000);
  await turnRight();
  await flyStraight('aerial-southwest', 18000);
  await turnRight();
  await flyStraight('aerial-northwest', 18000);

  // The flight above verifies real controls. Stable survey positions then make
  // every district visible and comparable, rather than inferring whole-city
  // coverage from four timed legs which can end over open water.
  await page.setViewportSize({width:2800,height:1800});
  const districts=await page.evaluate(()=>window.__lowtownCityQA.districts());
  assert.equal(districts.length,16);
  const survey=[];
  for(const district of districts){
    const position=await page.evaluate(id=>window.__lowtownCityQA.viewDistrict(id),district.id);
    assert.equal(position.mode,'helicopter');assert(position.altitude>=180);
    await screenshot(`district-${district.id}`);
    survey.push(position);
  }
  const citySnapshot=await page.evaluate(()=>window.__lowtownCityQA.snapshot());
  assert(citySnapshot.districts.every(d=>d.people>=8),'every district needs residents');
  assert.equal(citySnapshot.badPeople,0,'residents entered scenery during the browser sweep');
  assert.equal(citySnapshot.trafficOffRoad,0,'traffic left roads during the browser sweep');
  assert.equal(citySnapshot.serviceBases.length,10,'all ground response bases need road access');
  await page.setViewportSize({width:900,height:600});
  await screenshot('aerial-mobile');
  await page.locator('#btnOpenMap').click();
  await page.locator('#mapModal').waitFor({state:'visible'});
  await page.screenshot({path:`${artifactDir}/map-mobile.png`});
  const mapBounds=await page.locator('#mapModal .modal-card').boundingBox();
  assert(mapBounds&&mapBounds.x>=0&&mapBounds.y>=0&&mapBounds.x+mapBounds.width<=902&&mapBounds.y+mapBounds.height<=602,'mobile map overflows the viewport');
  await page.locator('#btnCloseMap').click();

  assert.equal(errors.length, 0, `browser reported errors during the aerial sweep:\n${errors.join('\n')}`);
  writeFileSync(`${artifactDir}/report.json`, JSON.stringify({
    url,
    vehicle: 'helicopter',
    flightAltitude: airHeight.trim(),
    camera: { ground: groundCamera, aerial: aerialCamera },
    screenshots: shots,
    survey,
    citySnapshot,
    browserErrors: errors
  }, null, 2));
  console.log(`AERIAL CITY VISUAL SMOKE: PASS full map plus ${shots.length} helicopter views; altitude=${airHeight.trim()}`);
} catch (error) {
  if (page) {
    try { await page.screenshot({ path: `${artifactDir}/failure.png` }); } catch {}
  }
  throw error;
} finally {
  await browser?.close();
  server.kill('SIGTERM');
}
