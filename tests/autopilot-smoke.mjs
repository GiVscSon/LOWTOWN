import { chromium } from 'playwright';
import { spawn } from 'node:child_process';

const server = spawn('npx', ['vite', '--host', '127.0.0.1', '--port', '4173'], { stdio: 'inherit', shell: true });
const browser = await chromium.launch({ headless: true });

try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  await page.goto('http://127.0.0.1:4173/?autotest', { waitUntil: 'networkidle' });
  await page.waitForFunction(() => Boolean(window.__LOWTOWN_TEST));
  await page.waitForTimeout(18000);

  const state = await page.evaluate(() => window.__LOWTOWN_TEST.state());
  console.log('LOWTOWN AI DRIVER REPORT:', JSON.stringify(state));

  if (state.speed <= 20) throw new Error('Autopilot failed to build speed.');
  if (state.distance < 700) throw new Error(`Autopilot travelled too little: ${state.distance.toFixed(0)}.`);
  if (Math.hypot(state.x, state.y) < 300) throw new Error('Autopilot did not explore the world.');
  if (state.routeLength === 0) throw new Error('Autopilot has no graph route.');
  if (state.trafficCars < 8) throw new Error('Traffic system failed to spawn enough cars.');
  if (state.collisions > 10) throw new Error(`Too many building collisions: ${state.collisions}`);
  if (state.stuck > 2) throw new Error(`Autopilot got stuck ${state.stuck} times.`);

  console.log('LOWTOWN AI DRIVER SMOKE TEST: PASS');
} finally {
  await browser.close();
  server.kill('SIGTERM');
}
