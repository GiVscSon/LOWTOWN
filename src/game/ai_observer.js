export function createAIObserver({ ai, car, canvas, getTraffic = () => [] }) {
  const state = {
    active: true,
    camera: 'CHASE',
    paused: false,
    step: false,
    elapsed: 0,
    trail: [],
    decisions: [],
    nearMisses: 0,
    minTTC: Infinity,
    lastMode: '',
    lastReason: '',
    frame: 0
  };

  const maxTrail = 180;
  const maxDecisions = 80;
  let lastX = car.x, lastY = car.y;
  let lastDecisionAt = 0;

  function record(dt = 0) {
    state.elapsed += dt;
    state.frame++;
    const a = ai?.state || ai || {};
    const dx = car.x - lastX, dy = car.y - lastY;
    if (dx * dx + dy * dy > 9 || state.trail.length === 0) {
      state.trail.push({ x: car.x, y: car.y, t: state.elapsed });
      if (state.trail.length > maxTrail) state.trail.shift();
      lastX = car.x; lastY = car.y;
    }
    const ttc = Number.isFinite(a.prediction?.ttc) ? a.prediction.ttc : Infinity;
    state.minTTC = Math.min(state.minTTC, ttc);
    const mode = a.mode || a.state || 'IDLE';
    const reason = a.reason || (a.prediction?.safe === false ? 'PREDICTED COLLISION' : mode);
    if (mode !== state.lastMode || reason !== state.lastReason || state.elapsed - lastDecisionAt > 2) {
      state.decisions.push({
        t: Number(state.elapsed.toFixed(1)), mode, reason,
        steer: Number(a.control?.steer || 0).toFixed(2),
        throttle: Number(a.control?.throttle || 0).toFixed(2),
        brake: Number(a.control?.brake || 0).toFixed(2),
        ttc: Number.isFinite(ttc) ? Number(ttc.toFixed(2)) : null,
        risk: Number((a.prediction?.risk || 0).toFixed(2)),
        x: Math.round(car.x), y: Math.round(car.y)
      });
      if (state.decisions.length > maxDecisions) state.decisions.shift();
      state.lastMode = mode; state.lastReason = reason; lastDecisionAt = state.elapsed;
    }
    const nearest = a.dynamic?.nearest;
    if (nearest && nearest.ttc > 0 && nearest.ttc < 1.2) state.nearMisses++;
  }

  function reset() {
    state.trail.length = 0;
    state.decisions.length = 0;
    state.elapsed = 0;
    state.nearMisses = 0;
    state.minTTC = Infinity;
    state.lastMode = '';
    state.lastReason = '';
    lastX = car.x; lastY = car.y;
  }

  function togglePause() { state.paused = !state.paused; return state.paused; }
  function setCamera(mode) {
    if (['CHASE', 'TOP', 'DEBUG'].includes(mode)) state.camera = mode;
    return state.camera;
  }

  function installKeys() {
    addEventListener('keydown', e => {
      if (e.repeat) return;
      const k = e.key.toLowerCase();
      if (k === 'f1') setCamera('CHASE');
      if (k === 'f2') setCamera('TOP');
      if (k === 'f3') setCamera('DEBUG');
      if (k === 'p') togglePause();
      if (k === 'o' && state.paused) state.step = true;
      if (k === 'f8') state.active = !state.active;
    });
  }

  function drawWorldOverlay(ctx, iso) {
    if (!state.active) return;
    const a = ai?.state || ai || {};
    ctx.save();

    if (state.trail.length > 1) {
      ctx.strokeStyle = 'rgba(232,184,74,.55)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      state.trail.forEach((p, i) => { const q = iso(p.x, p.y); if (i) ctx.lineTo(q.x, q.y); else ctx.moveTo(q.x, q.y); });
      ctx.stroke();
    }

    const pred = a.prediction?.points || a.predictedTrajectory || [];
    if (pred.length) {
      ctx.strokeStyle = 'rgba(224,154,62,.9)';
      ctx.setLineDash([5, 5]);
      ctx.beginPath();
      pred.forEach((p, i) => { const q = iso(p.x, p.y); if (i) ctx.lineTo(q.x, q.y); else ctx.moveTo(q.x, q.y); });
      ctx.stroke();
      ctx.setLineDash([]);
    }

    const sensors = a.sensor || {};
    const rays = [
      [car.a, sensors.front || 0],
      [car.a - .34, sensors.frontLeft || 0],
      [car.a + .34, sensors.frontRight || 0],
      [car.a - Math.PI / 2, sensors.left || 0],
      [car.a + Math.PI / 2, sensors.right || 0]
    ];
    const origin = iso(car.x, car.y);
    ctx.lineWidth = 1;
    for (const [ang, len] of rays) {
      const end = iso(car.x + Math.cos(ang) * Math.min(len, 260), car.y + Math.sin(ang) * Math.min(len, 260));
      ctx.strokeStyle = len < 90 ? 'rgba(212,82,58,.9)' : 'rgba(224,154,62,.45)';
      ctx.beginPath(); ctx.moveTo(origin.x, origin.y); ctx.lineTo(end.x, end.y); ctx.stroke();
    }

    if (a.dynamic?.nearest?.o) {
      const h = a.dynamic.nearest.o, p = iso(h.x, h.y);
      ctx.strokeStyle = 'rgba(212,82,58,.9)'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(p.x, p.y, 15, 0, Math.PI * 2); ctx.stroke();
    }

    if (a.goal) {
      const p = iso(a.goal.x, a.goal.y);
      ctx.strokeStyle = 'rgba(232,184,74,.8)'; ctx.setLineDash([3, 4]);
      ctx.beginPath(); ctx.arc(p.x, p.y, 11, 0, Math.PI * 2); ctx.stroke(); ctx.setLineDash([]);
    }
    ctx.restore();
  }

  function drawHUD(ctx) {
    if (!state.active) return;
    const a = ai?.state || ai || {};
    const w = 310, h = state.camera === 'DEBUG' ? 250 : 175;
    const x = 14, y = 70;
    ctx.save();
    ctx.fillStyle = 'rgba(8,9,11,.88)'; ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = 'rgba(224,154,62,.55)'; ctx.strokeRect(x, y, w, h);
    ctx.fillStyle = '#e09a3e'; ctx.font = 'bold 12px monospace'; ctx.textAlign = 'left';
    ctx.fillText(`AI OBSERVER // ${state.camera}`, x + 12, y + 19);
    ctx.fillStyle = '#e7e2d8'; ctx.font = '11px monospace';
    const speed = Math.hypot(car.vx, car.vy);
    const c = a.control || {};
    const lines = [
      `MODE      ${a.mode || a.state || 'IDLE'}`,
      `CONTROL   G ${(+c.throttle || 0).toFixed(2)} B ${(+c.brake || 0).toFixed(2)} S ${(+c.steer || 0).toFixed(2)}`,
      `SPEED     ${(speed * .19).toFixed(0)} km/h   POS ${Math.round(car.x)},${Math.round(car.y)}`,
      `TTC       ${Number.isFinite(a.prediction?.ttc) ? a.prediction.ttc.toFixed(2) + 's' : '--'}   RISK ${(a.prediction?.risk || 0).toFixed(2)}`,
      `WALL      F ${Math.round(a.sensor?.front || 0)}  L ${Math.round(a.sensor?.frontLeft || 0)}  R ${Math.round(a.sensor?.frontRight || 0)}`,
      `TRAFFIC   ${a.dynamic?.count || 0}   NEAR MISS ${state.nearMisses}`,
      `REPLANS   ${a.replans || 0}   RECOVERIES ${a.recoveries || 0}`,
      `TRAIL     ${state.trail.length} pts   MIN TTC ${Number.isFinite(state.minTTC) ? state.minTTC.toFixed(2) + 's' : '--'}`,
      `CAMERA    F1 CHASE  F2 TOP  F3 DEBUG`,
      `CONTROL   P PAUSE  O STEP  F8 HUD`
    ];
    lines.forEach((line, i) => ctx.fillText(line, x + 12, y + 39 + i * 14));
    if (state.camera === 'DEBUG') {
      ctx.fillStyle = '#e09a3e'; ctx.fillText('DECISIONS', x + 12, y + 186);
      ctx.fillStyle = '#e7e2d8';
      state.decisions.slice(-4).forEach((d, i) => ctx.fillText(`${d.t}s ${d.mode} ${d.reason}`, x + 12, y + 202 + i * 12));
    }
    if (state.paused) { ctx.fillStyle = '#d4523a'; ctx.font = 'bold 14px monospace'; ctx.fillText('|| PAUSED // O = STEP', x + 12, y + h - 8); }
    ctx.restore();
  }

  installKeys();
  return { state, record, reset, togglePause, setCamera, drawWorldOverlay, drawHUD };
}
