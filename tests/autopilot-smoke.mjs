import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';

const ARTIFACT_DIR = 'ai-run-artifacts';
const RUN_MS = 18000;
const SAMPLE_MS = 100;
const SCREENSHOT_MS = 500;

await mkdir(ARTIFACT_DIR, { recursive: true });
const server = spawn('npx', ['vite', '--host', '127.0.0.1', '--port', '4173'], { stdio: 'inherit', shell: true });
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({
  viewport: { width: 1280, height: 800 },
  recordVideo: { dir: ARTIFACT_DIR, size: { width: 1280, height: 800 } }
});

async function waitForServer(page) {
  for (let i = 0; i < 60; i++) {
    try {
      await page.goto('http://127.0.0.1:4173/?autotest', { waitUntil: 'domcontentloaded', timeout: 1000 });
      return;
    } catch (error) {
      if (i === 59) throw error;
      await new Promise(r => setTimeout(r, 250));
    }
  }
}

function snapshot(page) {
  return page.evaluate(() => {
    const test = window.__LOWTOWN_TEST;
    const ai = window.__LOWTOWN_AI;
    const obs = window.__LOWTOWN_OBSERVER;
    if (!test || !ai) return null;
    const s = test.state();
    const a = ai.state || ai;
    const p = a.prediction || {};
    const sensor = a.sensor || {};
    const dynamic = a.dynamic || {};
    return {
      t: performance.now(),
      game: {
        x: s.x, y: s.y, vx: s.vx, vy: s.vy, heading: s.a,
        speed: Math.hypot(s.vx || 0, s.vy || 0),
        maxSpeed: s.maxSpeed, distance: s.distance, collisions: s.collisions,
        stuck: s.stuck, trafficCars: s.trafficCars, pedestrians: s.pedestrians
      },
      ai: {
        enabled: a.enabled, mode: a.mode, node: a.node, routeLength: Array.isArray(a.route) ? a.route.length : 0,
        replans: a.replans, recoveries: a.recoveries, safeStarts: a.safeStarts,
        crossTrack: a.crossTrack, curvature: a.curvature, headingError: a.headingError,
        decisions: a.decisions, overtakes: a.overtakes || 0, nearMisses: a.nearMisses || 0,
        collisionsAvoided: a.collisionsAvoided || 0, control: a.control || null,
        prediction: { safe: p.safe, x: p.x, y: p.y, ttc: p.ttc, risk: p.risk },
        sensor: { front: sensor.front, frontLeft: sensor.frontLeft, frontRight: sensor.frontRight, left: sensor.left, right: sensor.right },
        nearest: dynamic.nearest && dynamic.nearest.o ? { x: dynamic.nearest.o.x, y: dynamic.nearest.o.y } : null
      },
      observer: obs && obs.metrics ? obs.metrics : null
    };
  });
}

const telemetry = [];
const screenshots = [];
let state = null;
let failure = null;
let sampleTimer = null;
let screenshotTimer = null;

try {
  const page = await context.newPage();
  await waitForServer(page);
  await page.waitForFunction(() => Boolean(window.__LOWTOWN_TEST && window.__LOWTOWN_AI));

  const started = Date.now();
  let screenshotIndex = 0;
  sampleTimer = setInterval(async () => {
    try {
      const s = await snapshot(page);
      if (s) telemetry.push(s);
    } catch {}
  }, SAMPLE_MS);
  screenshotTimer = setInterval(async () => {
    try {
      screenshotIndex++;
      const file = `${ARTIFACT_DIR}/frame-${String(screenshotIndex).padStart(4, '0')}.png`;
      await page.screenshot({ path: file });
      screenshots.push(file);
    } catch {}
  }, SCREENSHOT_MS);

  while (Date.now() - started < RUN_MS) await new Promise(r => setTimeout(r, 250));
  state = await snapshot(page);

  if (!state) throw new Error('LOWTOWN state unavailable after run.');
  console.log('LOWTOWN AI DRIVER REPORT:', JSON.stringify(state));

  const s = state.game;
  const a = state.ai;
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
  if (!Array.isArray(a.control ? [a.control] : []) && !Array.isArray(a.candidates)) throw new Error('AI control telemetry missing.');

  console.log('LOWTOWN AI DRIVER SMOKE TEST: PASS');
} catch (error) {
  failure = { message: error.message, stack: error.stack };
  console.error('LOWTOWN AI DRIVER SMOKE TEST: FAIL', error.stack || error);
  throw error;
} finally {
  if (sampleTimer) clearInterval(sampleTimer);
  if (screenshotTimer) clearInterval(screenshotTimer);
  try {
    const finalState = state || await snapshot(context.pages()[0]);
    await writeFile(`${ARTIFACT_DIR}/telemetry.json`, JSON.stringify({
      runMs: RUN_MS,
      sampleMs: SAMPLE_MS,
      screenshotMs: SCREENSHOT_MS,
      samples: telemetry,
      screenshots,
      final: finalState,
      failure
    }, null, 2));
    await writeFile(`${ARTIFACT_DIR}/report.json`, JSON.stringify({
      status: failure ? 'FAIL' : 'PASS',
      failure,
      sampleCount: telemetry.length,
      screenshotCount: screenshots.length,
      final: finalState,
      observer: finalState && finalState.observer
    }, null, 2));
  } catch (error) {
    console.error('Could not write AI artifacts:', error);
  }
  await context.close();
  await browser.close();
  server.kill('SIGTERM');
}
