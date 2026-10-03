import { chromium } from 'playwright';

const URL = process.env.LOWTOWN_PAGES_URL || 'http://127.0.0.1:4173/';
const EXPECTED_TITLE = 'LOWTOWN — приватный тест-драйв';
const errors = [];
const browser = await chromium.launch({ headless: true });

try {
  const page = await browser.newPage({ viewport: { width: 1365, height: 768 } });
  await page.addInitScript(() => {
    window.__lowtownMapLabels = [];
    const originalFillText = CanvasRenderingContext2D.prototype.fillText;
    CanvasRenderingContext2D.prototype.fillText = function (text, ...args) {
      if (this.canvas?.id === 'fullMapCanvas') window.__lowtownMapLabels.push(String(text));
      return originalFillText.call(this, text, ...args);
    };
  });
  page.on('pageerror', error => errors.push(`pageerror: ${error.message}`));
  page.on('console', message => {
    if (message.type() === 'error') errors.push(`console: ${message.text()}`);
  });

  let response;
  let lastError;
  for (let attempt = 1; attempt <= 15; attempt += 1) {
    try {
      // Three.js compiles its first WebGL programs before DOMContentLoaded.
      // Software WebGL on CI can take longer than the old Canvas boot budget.
      response = await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 15000 });
      if (response?.ok()) break;
    } catch (error) {
      lastError = error;
    }
    await page.waitForTimeout(500);
  }
  if (!response?.ok()) {
    const reason = response?.status() ?? lastError?.message ?? 'no response';
    throw new Error(`LOWTOWN Pages could not be opened at ${URL}: ${reason}`);
  }

  const title = await page.title();
  if (title !== EXPECTED_TITLE) {
    throw new Error(`Unexpected LOWTOWN title: ${JSON.stringify(title)}`);
  }

  await page.waitForFunction(() =>
    ['three','canvas'].includes(window.__lowtownRenderer) &&
    Number.isFinite(window.__lowtownLastFrame) &&
    performance.now() - window.__lowtownLastFrame < 1500,
    null,{timeout:15000}
  );
  const runtime = await page.evaluate(() => {
    const renderer=window.__lowtownRenderer;
    const element=document.getElementById(renderer==='three'?'threeCanvas':'gameCanvas');
    return {
      renderer,
      width:element?.width||0,
      height:element?.height||0,
      visible:!!element&&getComputedStyle(element).display!=='none',
      frames:window.__lowtownThreeStats?.frames||0
    };
  });
  if (!runtime.visible || runtime.width < 320 || runtime.height < 240) {
    throw new Error(`LOWTOWN active ${runtime.renderer} canvas was not initialized: ${runtime.width}x${runtime.height}`);
  }
  if (runtime.renderer==='three' && runtime.frames < 2) {
    throw new Error(`LOWTOWN Three.js renderer did not produce enough frames: ${runtime.frames}`);
  }

  const district = await page.locator('#hudDistrict').innerText();
  if (!district.trim()) throw new Error('LOWTOWN district HUD did not initialize');

  await page.locator('#btnOpenMap').click();
  await page.locator('#mapModal').waitFor({ state: 'visible', timeout: 5000 });
  const mapCanvas = page.locator('#fullMapCanvas');
  await mapCanvas.waitFor({ state: 'visible', timeout: 5000 });
  const mapSize = await mapCanvas.evaluate(element => ({ width: element.width, height: element.height }));
  if (mapSize.width < 320 || mapSize.height < 240) throw new Error(`LOWTOWN map canvas was not initialized: ${mapSize.width}x${mapSize.height}`);
  const mapLabels = await page.evaluate(() => window.__lowtownMapLabels || []);
  if (!mapLabels.includes('ВПП')) throw new Error('LOWTOWN map canvas did not draw runway labels');
  await page.locator('#btnCloseMap').click();
  await page.locator('#mapModal').waitFor({ state: 'hidden', timeout: 5000 });

  if (errors.length) throw new Error(`LOWTOWN browser errors:\n${errors.join('\n')}`);
  console.log(`LOWTOWN PAGES SMOKE: PASS ${URL} HTTP ${response.status()} RENDERER ${runtime.renderer.toUpperCase()} MAP OK JS OK`);
} finally {
  await browser.close();
}
