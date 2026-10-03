function num(v, fallback = 0) { const n = Number(v); return Number.isFinite(n) ? n : fallback; }
function clamp(v, a = 0, b = 1) { return Math.max(a, Math.min(b, v)); }
function sev(score) { return score >= .8 ? 'HIGH' : score >= .5 ? 'MEDIUM' : 'LOW'; }
function finding(code, score, message, evidence = {}) { return { analyst: '', code, severity: sev(score), score: +score.toFixed(3), message, evidence }; }
function summary(name, confidence, findings, strengths = []) { return { name, confidence: +clamp(confidence).toFixed(3), findings, strengths }; }

export function createSafetyAnalyst() {
  return { name: 'SAFETY_AI', analyze(report) {
    const s = report.summary || {}, f = [];
    const contact = num(s.collisions) + num(s.trafficHits);
    const risk = report.recent?.reduce((m, x) => Math.max(m, num(x.ai?.prediction?.risk)), 0) || 0;
    if (contact) f.push(finding('CONTACT_RISK', clamp(.45 + contact * .15), `Physical contact count is ${contact}. Safety margin is insufficient.`, { collisions: s.collisions, trafficHits: s.trafficHits }));
    if (risk > .8) f.push(finding('PREDICTION_RISK', risk, `Prediction risk reached ${risk.toFixed(2)}.`, { maxRisk: risk }));
    if (num(s.hardBrakes) > 5) f.push(finding('BRAKING_MARGIN', clamp(.35 + s.hardBrakes / 20), 'Repeated hard braking suggests the safety envelope is too narrow.', { hardBrakes: s.hardBrakes }));
    if (!f.length) return summary(this.name, .92, [], ['No recorded physical contacts.', 'No major safety alarm detected.']);
    f.forEach(x => x.analyst = this.name); return summary(this.name, .9, f);
  }};
}

export function createDrivingQualityAnalyst() {
  return { name: 'DRIVING_AI', analyze(report) {
    const s = report.summary || {}, f = [];
    if (num(s.steeringSpikes) > 8) f.push(finding('STEERING_OSCILLATION', clamp(.4 + s.steeringSpikes / 25), `${s.steeringSpikes} steering spikes indicate unstable control.`));
    if (num(s.hardBrakes) > 6) f.push(finding('HARSH_BRAKING', clamp(.4 + s.hardBrakes / 25), `${s.hardBrakes} hard braking actions detected.`));
    const duration = Math.max(.1, num(report.elapsed));
    const rate = num(s.decisions) / duration;
    if (rate < 2) f.push(finding('LOW_DECISION_RATE', clamp(.65 - rate / 4), `Decision rate is ${rate.toFixed(1)} Hz.`, { rate }));
    f.forEach(x => x.analyst = this.name); return summary(this.name, f.length ? .86 : .94, f, f.length ? [] : ['Control remained stable during the run.']);
  }};
}

export function createNavigationAnalyst() {
  return { name: 'NAVIGATION_AI', analyze(report) {
    const s = report.summary || {}, recent = report.recent || [], f = [];
    const recoveries = num(s.recoveries), replans = num(s.replans), distance = num(s.distance);
    if (recoveries > 2) f.push(finding('RECOVERY_LOAD', clamp(.45 + recoveries / 8), `${recoveries} recoveries indicate weak route continuity.`));
    if (distance > 700 && replans === 0) f.push(finding('LOW_ROUTE_ADAPTATION', .35, 'Long run completed without replanning. Route diversity should be checked.'));
    const cells = new Set(recent.map(x => `${Math.round(num(x.game?.x) / 160)},${Math.round(num(x.game?.y) / 160)}`));
    if (distance > 700 && cells.size < 5) f.push(finding('LOW_EXPLORATION', .72, `Only ${cells.size} spatial cells appear in retained telemetry.`, { cells: cells.size }));
    f.forEach(x => x.analyst = this.name); return summary(this.name, f.length ? .82 : .9, f);
  }};
}

export function createBehaviorAnalyst() {
  return { name: 'BEHAVIOR_AI', analyze(report) {
    const s = report.summary || {}, f = [];
    const overtakes = num(s.overtakes), near = num(s.nearMisses);
    if (overtakes && near > overtakes * 3) f.push(finding('OVERTAKE_RISK', .76, 'Overtaking is producing an unusually high near-miss load.', { overtakes, nearMisses: near }));
    if (num(s.recoveries) > 3) f.push(finding('BEHAVIOR_INSTABILITY', .68, 'Frequent recoveries suggest unstable tactical behavior.'));
    if (!f.length && overtakes) f.push(finding('TACTICAL_STRENGTH', .12, `${overtakes} tactical overtake(s) were completed without a major behavioral alarm.`));
    f.forEach(x => x.analyst = this.name); return summary(this.name, f.length ? .84 : .9, f, overtakes ? [`${overtakes} tactical overtaking decision(s) observed.`] : []);
  }};
}

export function createBlackBoxAnalysisAI() {
  const analysts = [createSafetyAnalyst(), createDrivingQualityAnalyst(), createNavigationAnalyst(), createBehaviorAnalyst()];
  return { analysts, analyze(report) {
    const outputs = analysts.map(a => a.analyze(report));
    const findings = outputs.flatMap(x => x.findings).sort((a, b) => b.score - a.score);
    const strengths = outputs.flatMap(x => x.strengths);
    const byCode = new Map();
    for (const f of findings) { const old = byCode.get(f.code); if (!old || f.score > old.score) byCode.set(f.code, f); }
    const consensus = [...byCode.values()].slice(0, 12);
    const risk = consensus.length ? Math.max(...consensus.map(x => x.score)) : 0;
    return { version: 1, ensemble: 'LOWTOWN_ANALYSIS_AI', risk: +risk.toFixed(3), confidence: +outputs.reduce((a, x) => a + x.confidence, 0) / outputs.length, analysts: outputs, consensus, strengths: [...new Set(strengths)].slice(0, 12), recommendation: consensus[0]?.message || 'No dominant weakness detected. Run a longer exploration test.' };
  }};
}
