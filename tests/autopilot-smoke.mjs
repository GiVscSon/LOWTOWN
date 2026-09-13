import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';

const ARTIFACT_DIR = 'ai-run-artifacts';
const RUN_MS = 18000;
const SAMPLE_MS = 100;

await mkdir(ARTIFACT_DIR, { recursive: true });
const server = spawn('npx', ['vite', '--host', '127.0.0.1', '--port', '4173'], { stdio: 'inherit', shell: true });
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });

async function waitForServer() {
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

function snapshot() {
  return page.evaluate(() => {
    const test = window.__LOWTOWN_TEST;
    const ai = window.__LOWTOWN_AI;
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
        trafficHits: s.trafficHits, stuck: s.stuck, trafficCars: s.trafficCars, pedestrians: s.pedestrians
      },
      ai: {
        enabled: a.enabled, mode: a.mode, tactical: a.tactical, node: a.node,
        routeLength: Array.isArray(a.route) ? a.route.length : 0,
        replans: a.replans, recoveries: a.recoveries, safeStarts: a.safeStarts,
        crossTrack: a.crossTrack, curvature: a.curvature, headingError: a.headingError,
        targetSpeed: a.targetSpeed, decisions: a.decisions,
        overtakes: a.overtakes || 0, nearMisses: a.nearMisses || 0,
        collisionsAvoided: a.collisionsAvoided || 0, control: a.control || null,
        prediction: { safe: p.safe, x: p.x, y: p.y, ttc: p.ttc, risk: p.risk },
        horizons: a.horizons || [],
        sensor: { front: sensor.front, frontLeft: sensor.frontLeft, frontRight: sensor.frontRight, left: sensor.left, right: sensor.right },
        nearest: dynamic.nearest && dynamic.nearest.o ? { x: dynamic.nearest.o.x, y: dynamic.nearest.o.y, v: dynamic.nearest.o.v } : null
      }
    };
  });
}

const telemetry = [];
let finalState = null;
let failure = null;
let sampleTimer = null;

try {
  await waitForServer();
  await page.waitForFunction(() => Boolean(window.__LOWTOWN_TEST && window.__LOWTOWN_AI));

  const started = Date.now();
  sampleTimer = setInterval(async () => {
    try {
      const s = await snapshot();
      if (s) telemetry.push(s);
    } catch {}
  }, SAMPLE_MS);

  while (Date.now() - started < RUN_MS) await new Promise(r => setTimeout(r, 250));
  finalState = await snapshot();
  if (!finalState) throw new Error('LOWTOWN state unavailable after run.');

  console.log('LOWTOWN AI DRIVER REPORT:', JSON.stringify(finalState));
  const s = finalState.game;
  const a = finalState.ai;
  const maxTelemetrySpeed = telemetry.reduce((m, x) => Math.max(m, x.game.speed || 0), 0);
  const maxDistance = telemetry.reduce((m, x) => Math.max(m, x.game.distance || 0), 0);
  const maxExplore = telemetry.reduce((m, x) => Math.max(m, Math.hypot(x.game.x || 0, x.game.y || 0)), 0);
  const maxCrossTrack = telemetry.reduce((m, x) => Math.max(m, Math.abs(x.ai.crossTrack || 0)), 0);
  const maxRisk = telemetry.reduce((m, x) => Math.max(m, x.ai.prediction?.risk || 0), 0);
  const maxTtcRisk = telemetry.filter(x => Number.isFinite(x.ai.prediction?.ttc)).reduce((m, x) => Math.min(m, x.ai.prediction.ttc), Infinity);
  const modes = [...new Set(telemetry.map(x => x.ai.mode).filter(Boolean))];

  if (!a.enabled) throw new Error('Predictive AI driver did not activate.');
  if (a.safeStarts < 1) throw new Error('AI has no safe start.');
  if (a.routeLength === 0) throw new Error('Predictive AI has no route.');
  if (a.decisions < 50) throw new Error(`AI made too few decisions: ${a.decisions}`);
  if (maxTelemetrySpeed <= 80) throw new Error(`Autopilot failed to build speed: max ${maxTelemetrySpeed.toFixed(0)}.`);
  if (maxDistance < 700) throw new Error(`Autopilot travelled too little: ${maxDistance.toFixed(0)}.`);
  if (maxExplore < 300) throw new Error('Autopilot did not explore the world.');
  if (s.trafficCars < 18) throw new Error('Traffic system failed to spawn enough cars.');
  if (s.pedestrians < 20) throw new Error('Pedestrian system failed to spawn enough people.');
  if (s.collisions > 10) throw new Error(`Too many building collisions: ${s.collisions}`);
  if (s.stuck > 2) throw new Error(`Autopilot got stuck ${s.stuck} times.`);
  if (a.recoveries > 4) throw new Error(`Predictive AI recovered too often: ${a.recoveries}`);
  if (maxCrossTrack > 130) throw new Error(`AI left the road corridor: ${maxCrossTrack.toFixed(0)}.`);
  if (!a.control || typeof a.control.steer !== 'number') throw new Error('AI control telemetry missing.');

  const report = {
    status: 'PASS', runMs: RUN_MS, samples: telemetry.length,
    maxSpeed: maxTelemetrySpeed, distance: maxDistance, explorationRadius: maxExplore,
    maxCrossTrack, maxRisk, minimumTtc: Number.isFinite(maxTtcRisk) ? maxTtcRisk : null,
    buildingCollisions: s.collisions, trafficHits: s.trafficHits, stuck: s.stuck,
    replans: a.replans, recoveries: a.recoveries, safeStarts: a.safeStarts,
    decisions: a.decisions, overtakes: a.overtakes || 0, nearMisses: a.nearMisses || 0,
    collisionsAvoided: a.collisionsAvoided || 0, modes
  };
  await writeFile(`${ARTIFACT_DIR}/report.json`, JSON.stringify(report, null, 2));
  console.log('LOWTOWN AI DRIVER SMOKE TEST: PASS');
} catch (error) {
  failure = { message: error.message, stack: error.stack };
  console.error('LOWTOWN AI DRIVER SMOKE TEST: FAIL', error.stack || error);
  throw error;
} finally {
  if (sampleTimer) clearInterval(sampleTimer);
  try {
    await writeFile(`${ARTIFACT_DIR}/telemetry.json`, JSON.stringify({ runMs: RUN_MS, sampleMs: SAMPLE_MS, samples: telemetry, final: finalState, failure }, null, 2));
    if (failure) await writeFile(`${ARTIFACT_DIR}/report.json`, JSON.stringify({ status: 'FAIL', failure, samples: telemetry.length, final: finalState }, null, 2));
  } catch (error) {
    console.error('Could not write AI artifacts:', error);
  }
  await browser.close();
  server.kill('SIGTERM');
}
