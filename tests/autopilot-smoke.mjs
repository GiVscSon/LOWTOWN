import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import { createBlackBox } from '../src/game/black_box.js';

const ARTIFACT_DIR = 'ai-run-artifacts';
const RUN_MS = 18000;
const SAMPLE_MS = 100;

await mkdir(ARTIFACT_DIR, { recursive: true });
const server = spawn('npx', ['vite', '--host', '127.0.0.1', '--port', '4173'], { stdio: 'inherit', shell: true });
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
const blackBox = createBlackBox({ capacity: 900, eventCapacity: 80 });
blackBox.start();

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
    const a = ai && typeof ai.state === 'object' ? ai.state : ai;
    const p = a.prediction || {};
    const sensor = a.sensor || {};
    const dynamic = a.dynamic || {};
    return {
      t: performance.now(),
      game: {
        x: s.x, y: s.y,
        speed: Number.isFinite(s.speed) ? s.speed : 0,
        maxSpeed: Number.isFinite(s.maxSpeed) ? s.maxSpeed : 0,
        distance: Number.isFinite(s.distance) ? s.distance : 0,
        collisions: s.collisions || 0,
        trafficHits: s.trafficHits || 0,
        stuck: s.stuck || 0,
        trafficCars: s.trafficCars || 0,
        pedestrians: s.pedestrians || 0
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
let previousSample = null;

function enrichSpeed(sample, previous) {
  const own = Number(sample.game.speed);
  const hasOwnSpeed = Number.isFinite(own) && own > 0;
  if (hasOwnSpeed || !previous) return sample;
  const dt = Math.max(0.001, (sample.t - previous.t) / 1000);
  const dx = Number(sample.game.x) - Number(previous.game.x);
  const dy = Number(sample.game.y) - Number(previous.game.y);
  const derived = Math.hypot(dx, dy) / dt;
  return { ...sample, game: { ...sample.game, speed: Number.isFinite(derived) ? derived : 0, speedSource: 'position-delta' } };
}

try {
  await waitForServer();
  await page.waitForFunction(() => Boolean(window.__LOWTOWN_TEST && window.__LOWTOWN_AI));

  const started = Date.now();
  sampleTimer = setInterval(async () => {
    try {
      const raw = await snapshot();
      if (!raw) return;
      const s = enrichSpeed(raw, previousSample);
      telemetry.push(s);
      const dt = previousSample ? Math.max(0, (s.t - previousSample.t) / 1000) : SAMPLE_MS / 1000;
      blackBox.sample(s, dt);
      previousSample = s;
    } catch {}
  }, SAMPLE_MS);

  while (Date.now() - started < RUN_MS) await new Promise(r => setTimeout(r, 250));
  finalState = await snapshot();
  if (!finalState) throw new Error('LOWTOWN state unavailable after run.');
  finalState = enrichSpeed(finalState, previousSample);
  if (previousSample && (!telemetry.length || telemetry[telemetry.length - 1].t < finalState.t)) {
    const dt = Math.max(0, (finalState.t - previousSample.t) / 1000);
    blackBox.sample(finalState, dt);
    telemetry.push(finalState);
  }

  const blackBoxReport = blackBox.report({ runMs: RUN_MS });
  console.log('LOWTOWN BLACK BOX SUMMARY:', JSON.stringify({ summary: blackBoxReport.summary, findings: blackBoxReport.findings }));
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
  const uniqueNodes = new Set(telemetry.map(x => x.ai.node).filter(n => Number.isFinite(n)));
  const uniquePositions = new Set(telemetry.map(x => `${Math.round(x.game.x / 80)},${Math.round(x.game.y / 80)}`));

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
    uniqueNodes: uniqueNodes.size, uniquePositionCells: uniquePositions.size,
    maxCrossTrack, maxRisk, minimumTtc: Number.isFinite(maxTtcRisk) ? maxTtcRisk : null,
    buildingCollisions: s.collisions, trafficHits: s.trafficHits, stuck: s.stuck,
    replans: a.replans, recoveries: a.recoveries, safeStarts: a.safeStarts,
    decisions: a.decisions, overtakes: a.overtakes || 0, nearMisses: a.nearMisses || 0,
    collisionsAvoided: a.collisionsAvoided || 0, modes,
    blackBox: blackBoxReport
  };
  await writeFile(`${ARTIFACT_DIR}/report.json`, JSON.stringify(report, null, 2));
  await writeFile(`${ARTIFACT_DIR}/black-box.json`, JSON.stringify(blackBoxReport, null, 2));
  console.log('LOWTOWN AI DRIVER SMOKE TEST: PASS');
} catch (error) {
  failure = { message: error.message, stack: error.stack };
  const blackBoxReport = blackBox.report({ runMs: RUN_MS, failure });
  console.error('LOWTOWN AI DRIVER SMOKE TEST: FAIL', error.stack || error);
  try { await writeFile(`${ARTIFACT_DIR}/black-box.json`, JSON.stringify(blackBoxReport, null, 2)); } catch {}
  throw error;
} finally {
  if (sampleTimer) clearInterval(sampleTimer);
  try {
    const blackBoxReport = blackBox.report({ runMs: RUN_MS, failure });
    await writeFile(`${ARTIFACT_DIR}/telemetry.json`, JSON.stringify({ runMs: RUN_MS, sampleMs: SAMPLE_MS, samples: telemetry, final: finalState, failure }, null, 2));
    await writeFile(`${ARTIFACT_DIR}/black-box.json`, JSON.stringify(blackBoxReport, null, 2));
    if (failure) await writeFile(`${ARTIFACT_DIR}/report.json`, JSON.stringify({ status: 'FAIL', failure, samples: telemetry.length, final: finalState, blackBox: blackBoxReport }, null, 2));
  } catch (error) {
    console.error('Could not write AI artifacts:', error);
  }
  await browser.close();
  server.kill('SIGTERM');
}
