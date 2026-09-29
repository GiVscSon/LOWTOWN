import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { setTimeout as delay } from 'node:timers/promises';
import { chromium } from 'playwright';

const root = new URL('../', import.meta.url).pathname;
const artifactDir = process.env.LOWTOWN_AERIAL_ARTIFACT_DIR || `${root}artifacts/aerial-city`;
const url = 'http://127.0.0.1:4174/';
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
  await page.waitForTimeout(150);
  const canvas = await page.locator('#gameCanvas').evaluate(element => {
    const ctx = element.getContext('2d');
    if (!ctx) return { width: element.width, height: element.height, colors: 0, painted: 0 };
    const { width, height } = element;
    const data = ctx.getImageData(0, 0, width, height).data;
    const colorSet = new Set();
    let painted = 0;
    const stepX = Math.max(1, Math.floor(width / 36));
    const stepY = Math.max(1, Math.floor(height / 24));
    for (let y = Math.floor(stepY / 2); y < height; y += stepY) {
      for (let x = Math.floor(stepX / 2); x < width; x += stepX) {
        const i = (y * width + x) * 4;
        if (data[i + 3] > 0) {
          painted += 1;
          colorSet.add(`${data[i]},${data[i + 1]},${data[i + 2]}`);
        }
      }
    }
    return { width, height, colors: colorSet.size, painted };
  });
  assert(canvas.width >= 640 && canvas.height >= 360, `game canvas size is too small: ${JSON.stringify(canvas)}`);
  assert(canvas.colors >= 28 && canvas.painted >= 150, `game canvas looks blank or incomplete: ${JSON.stringify(canvas)}`);
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
  await page.waitForTimeout(milliseconds);
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
  await page.addInitScript(() => {
    localStorage.setItem('lowtown_integrity_save', JSON.stringify({ cash: 750, x: 1040, y: 2070 }));
    window.__lowtownCameraZooms = [];
    let capturedFrameScale = false;
    const originalScale = CanvasRenderingContext2D.prototype.scale;
    const originalRequestAnimationFrame = window.requestAnimationFrame.bind(window);
    window.requestAnimationFrame = callback => originalRequestAnimationFrame(time => {
      capturedFrameScale = false;
      callback(time);
    });
    CanvasRenderingContext2D.prototype.scale = function (x, y) {
      if (this.canvas?.id === 'gameCanvas' && !capturedFrameScale) {
        capturedFrameScale = true;
        window.__lowtownCameraZooms.push({ x, y });
      }
      return originalScale.call(this, x, y);
    };
  });
  const response = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 15000 });
  assert(response?.ok(), `LOWTOWN preview returned HTTP ${response?.status()}`);
  await page.locator('#gameCanvas').waitFor({ state: 'visible', timeout: 15000 });
  await page.locator('#hudDistrict').waitFor({ state: 'visible', timeout: 10000 });
  await page.waitForFunction(() => Number.isFinite(window.__lowtownLastFrame), null, { timeout: 10000 });
  await page.waitForFunction(() => window.__lowtownCameraZooms?.length >= 3, null, { timeout: 10000 });
  const groundZoom = await page.evaluate(() => window.__lowtownCameraZooms.at(-1)?.x);

  await page.locator('#btnOpenMap').click();
  await page.locator('#mapModal').waitFor({ state: 'visible', timeout: 5000 });
  const mapCanvas = page.locator('#fullMapCanvas');
  await mapCanvas.waitFor({ state: 'visible', timeout: 5000 });
  const mapSize = await mapCanvas.evaluate(element => ({ width: element.width, height: element.height }));
  assert(mapSize.width >= 320 && mapSize.height >= 240, `full-city map is not initialized: ${JSON.stringify(mapSize)}`);
  const mapPath = `${artifactDir}/full-city-map.png`;
  await page.screenshot({ path: mapPath });
  shots.push({ name: 'full-city-map', path: mapPath, mapCanvas: mapSize });
  await page.locator('#btnCloseMap').click();
  await page.locator('#mapModal').waitFor({ state: 'hidden', timeout: 5000 });

  await page.locator('#gameCanvas').click({ position: { x: 500, y: 450 } });
  await page.keyboard.press('e');
  await page.waitForFunction(() => document.querySelector('#toastMsg')?.textContent?.includes('Пешком'), null, { timeout: 5000 });
  await page.keyboard.press('e');
  await page.waitForFunction(() => document.querySelector('#toastMsg')?.textContent?.includes('Вертолёт'), null, { timeout: 5000 });
  await page.waitForFunction(() => /\d+ м/.test(document.querySelector('#hudGear')?.textContent || ''), null, { timeout: 5000 });
  await page.keyboard.press('q');
  await hold('w');
  await page.waitForTimeout(3600);
  await release('w');
  const airHeight = await page.locator('#hudGear').textContent();
  assert(Number.parseInt(airHeight, 10) >= 180, `helicopter did not reach useful aerial height: ${airHeight}`);
  const aerialZoom = await page.evaluate(() => window.__lowtownCameraZooms.at(-1)?.x);
  assert(aerialZoom < groundZoom * .94, `helicopter altitude did not zoom the city camera out: ${groundZoom} -> ${aerialZoom}`);
  await screenshot('aerial-takeoff');

  await flyStraight('aerial-east', 16000);
  await turnRight();
  await flyStraight('aerial-southeast', 19000);
  await turnRight();
  await flyStraight('aerial-southwest', 18000);
  await turnRight();
  await flyStraight('aerial-northwest', 18000);

  assert.equal(errors.length, 0, `browser reported errors during the aerial sweep:\n${errors.join('\n')}`);
  writeFileSync(`${artifactDir}/report.json`, JSON.stringify({
    url,
    vehicle: 'helicopter',
    flightAltitude: airHeight.trim(),
    cameraZoom: { ground: groundZoom, aerial: aerialZoom },
    screenshots: shots,
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
