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
      response = await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 3000 });
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

  const canvas = page.locator('#gameCanvas');
  await canvas.waitFor({ state: 'visible', timeout: 10000 });
  const canvasSize = await canvas.evaluate(element => ({ width: element.width, height: element.height }));
  if (canvasSize.width < 320 || canvasSize.height < 240) {
    throw new Error(`LOWTOWN canvas was not initialized: ${canvasSize.width}x${canvasSize.height}`);
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
  console.log(`LOWTOWN PAGES SMOKE: PASS ${URL} HTTP ${response.status()} CANVAS OK MAP OK JS OK`);
} finally {
  await browser.close();
}
