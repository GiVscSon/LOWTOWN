import { chromium } from 'playwright';

const URL = process.env.LOWTOWN_PAGES_URL || 'http://127.0.0.1:4173/LOWTOWN/';
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
const errors = [];

page.on('pageerror', error => errors.push(`pageerror: ${error.message}`));
page.on('console', message => {
  if (message.type() === 'error') errors.push(`console: ${message.text()}`);
});

let response = null;
for (let attempt = 1; attempt <= 30; attempt += 1) {
  try {
    response = await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 15000 });
    if (response?.ok()) break;
  } catch {}
  await new Promise(resolve => setTimeout(resolve, 2000));
}

if (!response?.ok()) {
  await browser.close();
  throw new Error(`LOWTOWN Pages is not reachable: ${response?.status() ?? 'no response'}`);
}

await page.waitForTimeout(2000);
const title = await page.title();
const appCount = await page.locator('#app').count();

if (title !== 'LOWTOWN // NIGHT SHIFT') {
  await browser.close();
  throw new Error(`Unexpected LOWTOWN title: ${JSON.stringify(title)}`);
}
if (appCount !== 1) {
  await browser.close();
  throw new Error(`LOWTOWN root #app missing or duplicated: ${appCount}`);
}
if (errors.length) {
  await browser.close();
  throw new Error(`LOWTOWN browser errors:\n${errors.join('\n')}`);
}

console.log(`LOWTOWN PAGES SMOKE: PASS ${URL} HTTP ${response.status()} TITLE OK APP OK JS OK`);
await browser.close();
