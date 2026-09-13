import { createFreeWillDriver } from './free_will_driver.js';

const enabled = new URLSearchParams(location.search).has('autonomy') || new URLSearchParams(location.search).has('autotest');

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

async function boot() {
  if (!enabled) return;
  while (!window.__LOWTOWN_AI || !window.__LOWTOWN_TEST) await sleep(50);

  const ai = window.__LOWTOWN_AI;
  const lab = {
    enabled: true,
    startedAt: performance.now(),
    decisions: 0,
    forcedReplans: 0,
    intent: 'EXPLORE',
    reason: 'BOOT',
    lastGoal: null,
    memory: new Map(),
    failures: [],
    history: []
  };

  const nodes = [];
  const seen = new Set();
  const remember = n => {
    if (!n || !Number.isFinite(n.x) || !Number.isFinite(n.y)) return;
    const id = `${Math.round(n.x/160)}:${Math.round(n.y/160)}`;
    if (seen.has(id)) return;
    seen.add(id);
    nodes.push({ ...n, id });
  };

  const freeWill = createFreeWillDriver({
    nodes,
    blocked: () => false
  });

  const intents = ['EXPLORE','CRUISE','SEEK_NOVELTY','ESCAPE_TRAFFIC','INVESTIGATE'];
  let lastDecision = performance.now();
  let lastSnapshot = null;

  while (lab.enabled) {
    await sleep(120);
    const state = window.__LOWTOWN_TEST.state();
    for (const n of ai.route || []) remember(n);
    if (ai.goal) remember(ai.goal);

    const now = performance.now();
    const trafficRisk = Number(state.risk || 0);
    const ttc = Number(state.ttc);
    const stuck = Number(state.stuck || 0);
    const needDecision = now - lastDecision > 2200 || trafficRisk > 1.15 || (Number.isFinite(ttc) && ttc < 1.1) || stuck > 1.4 || !ai.goal;
    if (!needDecision || nodes.length < 3) continue;

    const intent = trafficRisk > 1.15 || (Number.isFinite(ttc) && ttc < 1.1)
      ? 'ESCAPE_TRAFFIC'
      : intents[lab.decisions % intents.length];

    const goal = freeWill.choose({x: state.x, y: state.y}, {
      intent,
      lastGoalId: lab.lastGoal
    });
    if (!goal) continue;

    const previous = ai.goal?.id;
    ai.goal = goal;
    ai.route = [];
    ai.routeTimer = 999;
    lab.decisions++;
    lab.forcedReplans++;
    lab.intent = intent;
    lab.reason = trafficRisk > 1.15 ? 'RISK_REPLAN' : 'SELF_CHOICE';
    lab.lastGoal = goal.id;
    lab.history.push({
      t: Math.round((now-lab.startedAt)/1000),
      intent,
      from: previous,
      to: goal.id,
      risk: Number.isFinite(trafficRisk) ? +trafficRisk.toFixed(2) : 0,
      ttc: Number.isFinite(ttc) ? +ttc.toFixed(2) : Infinity
    });
    if (lab.history.length > 100) lab.history.shift();
    lastDecision = now;

    const snapshot = `${Math.round(state.x)}:${Math.round(state.y)}:${state.collisions}:${state.trafficHits}`;
    if (lastSnapshot && snapshot === lastSnapshot) {
      lab.failures.push({ t: Math.round((now-lab.startedAt)/1000), type: 'NO_STATE_CHANGE', intent });
      if (lab.failures.length > 40) lab.failures.shift();
    }
    lastSnapshot = snapshot;
  }

  window.__LOWTOWN_AUTONOMY_LAB = lab;
}

boot();

window.__LOWTOWN_AUTONOMY_LAB_STATUS = () => {
  const lab = window.__LOWTOWN_AUTONOMY_LAB;
  return lab ? {
    enabled: lab.enabled,
    decisions: lab.decisions,
    replans: lab.forcedReplans,
    intent: lab.intent,
    reason: lab.reason,
    memory: lab.memory.size,
    history: lab.history.length,
    failures: lab.failures.length
  } : { enabled: false, decisions: 0, replans: 0, intent: 'OFF', reason: 'WAITING' };
};
