import { chromium } from 'playwright';
import { spawn } from 'node:child_process';

const server = spawn('npx', ['vite', '--host', '127.0.0.1', '--port', '4173'], { stdio: 'inherit', shell: true });
const browser = await chromium.launch({ headless: true });

async function waitForServer(page) {
  for (let i = 0; i < 60; i++) {
    try { await page.goto('http://127.0.0.1:4173/?autotest', { waitUntil: 'domcontentloaded', timeout: 1000 }); return; }
    catch (error) { if (i === 59) throw error; await new Promise(r => setTimeout(r, 250)); }
  }
}

try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  await waitForServer(page);
  await page.waitForFunction(() => Boolean(window.__LOWTOWN_TEST && window.__LOWTOWN_AI));
  await page.waitForTimeout(18000);

  const state = await page.evaluate(() => ({ game: window.__LOWTOWN_TEST.state(), ai: {
    enabled: window.__LOWTOWN_AI.enabled,
    mode: window.__LOWTOWN_AI.mode,
    replans: window.__LOWTOWN_AI.replans,
    recoveries: window.__LOWTOWN_AI.recoveries,
    safeStarts: window.__LOWTOWN_AI.safeStarts,
    routeLength: window.__LOWTOWN_AI.route.length,
    crossTrack: window.__LOWTOWN_AI.crossTrack,
    curvature: window.__LOWTOWN_AI.curvature,
    ttc: window.__LOWTOWN_AI.prediction.ttc,
    predictionSafe: window.__LOWTOWN_AI.prediction.safe,
    front: window.__LOWTOWN_AI.sensor.front,
    frontLeft: window.__LOWTOWN_AI.sensor.frontLeft,
    frontRight: window.__LOWTOWN_AI.sensor.frontRight,
    decisions: window.__LOWTOWN_AI.decisions,
    candidates: window.__LOWTOWN_AI.candidates
  }}));
  console.log('LOWTOWN AI DRIVER REPORT:', JSON.stringify(state));

  const s = state.game, a = state.ai;
  if (!a.enabled) throw new Error('Predictive AI driver did not activate.');
  if (a.safeStarts < 1) throw new Error('AI has no safe start.');
  if (a.routeLength === 0) throw new Error('Predictive AI has no route.');
  if (a.replans < 1) throw new Error('Predictive AI never replanned.');
  if (a.decisions < 50) throw new Error(`AI made too few decisions: ${a.decisions}`);
  if (s.maxSpeed <= 80) throw new Error(`Autopilot failed to build speed: max ${s.maxSpeed.toFixed(0)}.`);
  if (s.distance < 700) throw new Error(`Autopilot travelled too little: ${s.distance.toFixed(0)}.`);
  if (Math.hypot(s.x, s.y) < 300) throw new Error('Autopilot did not explore the world.');
  if (s.trafficCars < 18) throw new Error('Traffic system failed to spawn enough cars.');
  if (s.pedestrians < 20) throw new Error('Pedestrian system failed to spawn enough people.');
  if (s.collisions > 10) throw new Error(`Too many building collisions: ${s.collisions}`);
  if (s.stuck > 2) throw new Error(`Legacy autopilot got stuck ${s.stuck} times.`);
  if (a.recoveries > 4) throw new Error(`Predictive AI recovered too often: ${a.recoveries}`);
  if (Math.abs(a.crossTrack) > 130) throw new Error(`AI left the road corridor: ${a.crossTrack.toFixed(0)}.`);
  if (!Array.isArray(a.candidates) || a.candidates.length === 0) throw new Error('AI produced no trajectory candidates.');

  console.log('LOWTOWN AI DRIVER SMOKE TEST: PASS');
} finally {
  await browser.close();
  server.kill('SIGTERM');
}
