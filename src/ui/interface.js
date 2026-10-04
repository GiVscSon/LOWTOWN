// One shared runtime context owns state; this system has no hidden globals.
export function installUiInterface(ctx){
const {VEHICLES,VEHICLE_ASSETS,coastPath}=ctx.dependencies;
ctx.renderHud = function renderHud() {
  ctx.renderRadar();
  const foot = ctx.roam?.mode === 'foot';
  if (ctx.hudFootMode !== foot) {
    ctx.hudFootMode = foot;
    for (const [id,label] of [['btnHandbrake',foot?'Прыжок':'HB'],['btnNitro',foot?'Удар':'N2O']]) {
      const button=ctx.env.document.getElementById(id),span=button?.querySelector?.('span');
      if(span)span.textContent=label;
      button?.setAttribute?.('aria-label',foot?(id==='btnHandbrake'?'Прыжок · Пробел':'Удар · F'):(id==='btnHandbrake'?'Ручной тормоз':'Нитро'));
    }
    const gauge=ctx.env.document.querySelector?.('.nitro-gauge');if(gauge)gauge.hidden=foot;
  }
  const speedEl = ctx.env.document.getElementById('hudSpeed');
  if (speedEl) speedEl.innerText = ctx.roam?.mode === 'foot' ? 'ПЕШКОМ' : ctx.env.Math.round(ctx.env.Math.abs(ctx.player.speed) * 12);
  const enterEl = ctx.env.document.getElementById('btnRoamEnter');
  if (enterEl) enterEl.textContent = ctx.roam?.mode === 'foot' ? 'Сесть · E' : 'Выйти · E';
  const flyEl = ctx.env.document.getElementById('btnRoamFly');
  if (flyEl) flyEl.style.display = ctx.roam?.profile?.kind === 'air' ? '' : 'none';
  const gearEl = ctx.env.document.getElementById('hudGear');
  if (gearEl) gearEl.innerText = ctx.player.gear;
  const rpmEl = ctx.env.document.getElementById('hudRpm');
  if (rpmEl) rpmEl.style.width = ctx.env.Math.round(ctx.player.rpm * 100) + '%';
  const cashEl = ctx.env.document.getElementById('hudCash');
  if (cashEl) cashEl.innerText = ctx.state.cash;
  const hpBarEl = ctx.env.document.getElementById('hudHpBar');
  if (hpBarEl) hpBarEl.style.width = ctx.env.Math.max(0, ctx.player.hp) + '%';
  const hpValEl = ctx.env.document.getElementById('hudHpVal');
  if (hpValEl) hpValEl.innerText = ctx.env.Math.round(ctx.player.hp) + '%';
  for (let i = 1; i <= 5; i++) {
    const star = ctx.env.document.getElementById(`star${i}`);
    if (!star) continue;
    if (i <= ctx.state.wanted) {
      if (ctx.state.evading) {
        star.classList.remove('lit');
        star.classList.add('evade-lit');
      } else {
        star.classList.remove('evade-lit');
        star.classList.add('lit');
      }
    } else star.classList.remove('lit', 'evade-lit');
  }
};
ctx.renderRadar = function renderRadar() {
  const rw = ctx.radarCanvas.width;
  const rh = ctx.radarCanvas.height;
  ctx.radarCtx.clearRect(0, 0, rw, rh);
  const radarRange = 900;
  const scale = rw / (radarRange * 2);
  ctx.radarCtx.save();
  ctx.radarCtx.translate(rw / 2, rh / 2);
  [...ctx.islands, ...ctx.islets].forEach(isl => {
    ctx.radarCtx.fillStyle = 'rgba(255, 255, 255, 0.08)';
    coastPath(ctx.radarCtx, isl, scale, -ctx.player.x * scale, -ctx.player.y * scale);
    ctx.radarCtx.fill();
  });
  ctx.bridges.forEach(br => ctx.drawStreetCorridor(ctx.radarCtx, br, 'rgba(56,189,248,.4)', 0, scale, -ctx.player.x * scale, -ctx.player.y * scale));
  ctx.drawScenicRoads(ctx.radarCtx, scale, -ctx.player.x * scale, -ctx.player.y * scale, true);
  ctx.roads.forEach(r => ctx.drawStreetCorridor(ctx.radarCtx, r, 'rgba(255,255,255,.2)', 0, scale, -ctx.player.x * scale, -ctx.player.y * scale));
  ctx.CARPARTS.forEach(p => {
    if (!p.found) {
      ctx.radarCtx.fillStyle = '#e59d35';
      ctx.radarCtx.beginPath();
      ctx.radarCtx.arc((p.x - ctx.player.x) * scale, (p.y - ctx.player.y) * scale, 3.5, 0, ctx.env.Math.PI * 2);
      ctx.radarCtx.fill();
    }
  });
  for (const vehicle of ctx.roam?.fleet || []) {
    ctx.radarCtx.fillStyle = vehicle.kind === 'water' ? '#61b9ce' : vehicle.kind === 'air' ? '#ddd7be' : '#bd9954';
    ctx.radarCtx.fillRect((vehicle.x - ctx.player.x) * scale - 2, (vehicle.y - ctx.player.y) * scale - 2, 4, 4);
  }
  ctx.radarCtx.rotate(ctx.player.angle + ctx.env.Math.PI / 2);
  ctx.radarCtx.fillStyle = '#e59d35';
  ctx.radarCtx.beginPath();
  ctx.radarCtx.moveTo(0, -6);
  ctx.radarCtx.lineTo(4, 5);
  ctx.radarCtx.lineTo(0, 3);
  ctx.radarCtx.lineTo(-4, 5);
  ctx.radarCtx.closePath();
  ctx.radarCtx.fill();
  ctx.radarCtx.restore();
};
ctx.renderFullMap = function renderFullMap() {
  const mw = ctx.fullMapCanvas.width;
  const mh = ctx.fullMapCanvas.height;
  ctx.fullMapCtx.clearRect(0, 0, mw, mh);
  const scale = ctx.env.Math.min(mw / ctx.WORLD_W, mh / ctx.WORLD_H);
  const mapX = (mw - ctx.WORLD_W * scale) / 2;
  const mapY = (mh - ctx.WORLD_H * scale) / 2;
  ctx.fullMapCtx.fillStyle = '#06090e';
  ctx.fullMapCtx.fillRect(0, 0, mw, mh);
  [...ctx.islands, ...ctx.islets].forEach(isl => {
    ctx.fullMapCtx.fillStyle = ctx.districtProfiles[isl.id]?.land || '#1e2430';
    coastPath(ctx.fullMapCtx, isl, scale, mapX, mapY);
    ctx.fullMapCtx.fill();
    ctx.fullMapCtx.strokeStyle = '#334155';
    ctx.fullMapCtx.stroke();
  });
  const mapPaint = ctx.roadPaintGeometry || (ctx.roadPaintGeometry = ctx.buildRoadPaintGeometry());
  const smoothBridgeIds = new Set((mapPaint.bridgePaths || []).map(path => path.id));
  ctx.fullMapCtx.save();
  ctx.fullMapCtx.lineCap = 'round';
  ctx.fullMapCtx.lineJoin = 'round';
  for (const bridgePath of mapPaint.bridgePaths || []) {
    const points = bridgePath.path.map(point => ({
      x: mapX + point.x * scale,
      y: mapY + point.y * scale
    }));
    if (!ctx.traceSmoothBridgePath(ctx.fullMapCtx, points, bridgePath.width * .5 * scale)) continue;
    ctx.fullMapCtx.strokeStyle = '#38bdf8';
    ctx.fullMapCtx.lineWidth = ctx.env.Math.max(3, bridgePath.width * scale);
    ctx.fullMapCtx.stroke();
  }
  ctx.fullMapCtx.restore();
  ctx.bridges.filter(br => br.footway || !smoothBridgeIds.has(br.logicalId || br.id)).forEach(br => {
    ctx.fullMapCtx.fillStyle = br.footway ? '#78909c' : '#38bdf8';
    ctx.fullMapCtx.fillRect(mapX + br.x * scale, mapY + br.y * scale, br.w * scale, br.h * scale);
  });
  ctx.fullMapCtx.fillStyle = 'rgba(235, 240, 250, 0.5)';
  ctx.drawScenicRoads(ctx.fullMapCtx, scale, mapX, mapY, true);
  ctx.roads.forEach(r => ctx.drawStreetCorridor(ctx.fullMapCtx, r, 'rgba(235,240,250,.5)', 0, scale, mapX, mapY));
  ctx.fullMapCtx.textAlign = 'center';
  ctx.fullMapCtx.font = 'bold 9px sans-serif';
  for (const island of ctx.islands) {
    const x = mapX + (island.x + island.w / 2) * scale,
      y = mapY + (island.y + island.h * .93) * scale;
    ctx.fullMapCtx.fillStyle = 'rgba(6,9,14,.82)';
    ctx.fullMapCtx.fillRect(x - 66, y - 10, 132, 15);
    ctx.fullMapCtx.fillStyle = '#d3c6a7';
    ctx.fullMapCtx.fillText(island.name.toUpperCase(), x, y);
  }
  for (const base of ctx.serviceBases) {
    const x = mapX + base.origin.x * scale,
      y = mapY + base.origin.y * scale;
    ctx.fullMapCtx.fillStyle = base.kind === 'hospital' ? '#d7ded2' : base.kind === 'firestation' ? '#ce6950' : base.kind === 'police' ? '#88aabb' : '#a2aa7b';
    ctx.fullMapCtx.fillRect(x - 3, y - 3, 6, 6);
    ctx.fullMapCtx.strokeStyle = '#11171b';
    ctx.fullMapCtx.lineWidth = 1;
    ctx.fullMapCtx.strokeRect(x - 3, y - 3, 6, 6);
  }
  for (const base of ctx.airMedicalBases()) {
    const x = mapX + base.x * scale,
      y = mapY + base.y * scale;
    ctx.fullMapCtx.fillStyle = '#e5e4d9';
    ctx.fullMapCtx.fillText('H+', x, y);
  }
  for (const unit of ctx.airMedicalVehicles) {
    const x = mapX + unit.x * scale,
      y = mapY + unit.y * scale;
    ctx.fullMapCtx.fillStyle = '#e5e4d9';
    ctx.fullMapCtx.beginPath();
    ctx.fullMapCtx.arc(x, y, 3, 0, ctx.env.Math.PI * 2);
    ctx.fullMapCtx.fill();
  }
  ctx.CARPARTS.forEach(p => {
    if (!p.found) {
      ctx.fullMapCtx.fillStyle = '#e59d35';
      ctx.fullMapCtx.beginPath();
      ctx.fullMapCtx.arc(mapX + p.x * scale, mapY + p.y * scale, 4, 0, ctx.env.Math.PI * 2);
      ctx.fullMapCtx.fill();
    }
  });
  for (const vehicle of ctx.roam?.fleet || []) {
    ctx.fullMapCtx.fillStyle = vehicle.kind === 'water' ? '#61b9ce' : vehicle.kind === 'air' ? '#ddd7be' : '#bd9954';
    const x = mapX + vehicle.x * scale,
      y = mapY + vehicle.y * scale;
    ctx.fullMapCtx.strokeStyle = '#080b0e';
    ctx.fullMapCtx.lineWidth = 1.25;
    ctx.fullMapCtx.beginPath();
    if (vehicle.kind === 'air') {
      ctx.fullMapCtx.moveTo(x, y - 4.5);
      ctx.fullMapCtx.lineTo(x + 4, y + 3.5);
      ctx.fullMapCtx.lineTo(x - 4, y + 3.5);
      ctx.fullMapCtx.closePath();
    } else if (vehicle.kind === 'water') {
      ctx.fullMapCtx.moveTo(x, y - 4);
      ctx.fullMapCtx.lineTo(x + 4, y);
      ctx.fullMapCtx.lineTo(x, y + 4);
      ctx.fullMapCtx.lineTo(x - 4, y);
      ctx.fullMapCtx.closePath();
    } else ctx.fullMapCtx.arc(x, y, 3.2, 0, ctx.env.Math.PI * 2);
    ctx.fullMapCtx.fill();
    ctx.fullMapCtx.stroke();
  }
  for (const runway of ctx.PLANE_RUNWAYS) {
    const x = mapX + runway.x * scale,
      y = mapY + runway.y * scale;
    const w = runway.w * scale,
      h = ctx.env.Math.max(4, runway.h * scale);
    ctx.fullMapCtx.fillStyle = '#414443';
    ctx.fullMapCtx.fillRect(x, y, w, h);
    ctx.fullMapCtx.strokeStyle = '#e0d0a0';
    ctx.fullMapCtx.lineWidth = 1.2;
    ctx.fullMapCtx.strokeRect(x, y, w, h);
    ctx.fullMapCtx.strokeStyle = '#f2ead0';
    ctx.fullMapCtx.lineWidth = 1;
    ctx.fullMapCtx.setLineDash([3, 2]);
    ctx.fullMapCtx.beginPath();
    ctx.fullMapCtx.moveTo(x + 2, y + h / 2);
    ctx.fullMapCtx.lineTo(x + w - 2, y + h / 2);
    ctx.fullMapCtx.stroke();
    ctx.fullMapCtx.setLineDash([]);
    const labelY = y - 7;
    ctx.fullMapCtx.fillStyle = 'rgba(7,10,13,.94)';
    ctx.fullMapCtx.fillRect(x + w / 2 - 10, labelY - 5.5, 20, 11);
    ctx.fullMapCtx.strokeStyle = '#e0d0a0';
    ctx.fullMapCtx.lineWidth = 1;
    ctx.fullMapCtx.strokeRect(x + w / 2 - 10, labelY - 5.5, 20, 11);
    ctx.fullMapCtx.fillStyle = '#f2dfaa';
    ctx.fullMapCtx.font = 'bold 7px monospace';
    ctx.fullMapCtx.textAlign = 'center';
    ctx.fullMapCtx.textBaseline = 'middle';
    ctx.fullMapCtx.fillText('ВПП', x + w / 2, labelY);
  }
  ctx.fullMapCtx.fillStyle = '#f4f1e9';
  ctx.fullMapCtx.strokeStyle = '#182329';
  ctx.fullMapCtx.lineWidth = 2;
  ctx.fullMapCtx.beginPath();
  const playerX = mapX + ctx.player.x * scale,
    playerY = mapY + ctx.player.y * scale;
  ctx.fullMapCtx.arc(playerX, playerY, 4, 0, ctx.env.Math.PI * 2);
  ctx.fullMapCtx.fill();
  ctx.fullMapCtx.stroke();
  ctx.fullMapCtx.strokeStyle = '#68d7f2';
  ctx.fullMapCtx.lineWidth = 1.5;
  ctx.fullMapCtx.beginPath();
  ctx.fullMapCtx.moveTo(playerX, playerY);
  ctx.fullMapCtx.lineTo(playerX + ctx.env.Math.cos(ctx.player.angle) * 8, playerY + ctx.env.Math.sin(ctx.player.angle) * 8);
  ctx.fullMapCtx.stroke();
};
ctx.updateGaragePartsUI = function updateGaragePartsUI() {
  const container = ctx.env.document.getElementById('partsContainer');
  if (!container) return;
  container.innerHTML = '';
  let foundCount = 0;
  ctx.CARPARTS.forEach(p => {
    if (p.found) foundCount++;
    const card = ctx.env.document.createElement('div');
    card.className = 'part-card' + (p.found ? ' found' : '');
    card.innerHTML = `
      <div class="part-title">${p.found ? p.name : '???'}</div>
      <div class="part-bonus">${p.found ? p.bonus : 'Не найдено'}</div>
    `;
    container.appendChild(card);
  });
  const cnt = ctx.env.document.getElementById('partsFoundCount');
  if (cnt) cnt.innerText = foundCount;
};
ctx.showToast = function showToast(msg) {
  const existing = ctx.env.document.getElementById('toastMsg');
  if (existing) existing.remove();
  const toast = ctx.env.document.createElement('div');
  toast.id = 'toastMsg';
  toast.className = 'toast-alert';
  toast.innerHTML = `<span>💬</span><span>${msg}</span>`;
  const container = ctx.env.document.getElementById('bannerContainer');
  if (container) {
    container.appendChild(toast);
    ctx.env.setTimeout(() => toast.remove(), 2800);
  }
};
ctx.toggleMap = function toggleMap() {
  const modal = ctx.env.document.getElementById('mapModal');
  if (!modal) return;
  ctx.state.isMapOpen = modal.style.display !== 'flex';
  if (ctx.state.isMapOpen) {
    ctx.state.isGarageOpen = false;
    ctx.env.document.getElementById('garageModal').style.display = 'none';
  }
  modal.style.display = ctx.state.isMapOpen ? 'flex' : 'none';
  ctx.syncGamePause();
  if (ctx.state.isMapOpen) ctx.renderFullMap();
};
ctx.updateGarageVehicle = function updateGarageVehicle() {
  const type = ctx.roam?.mode || 'sedan',
    profile = ctx.roam?.profile || VEHICLES.sedan;
  const image = ctx.env.document.getElementById('garageVehicleImage'),
    label = ctx.env.document.getElementById('garageVehicleName'),
    stats = ctx.env.document.getElementById('garageVehicleStats');
  if (image) {
    image.src = VEHICLE_ASSETS[type] || '';
    image.style.display = VEHICLE_ASSETS[type] ? 'block' : 'none';
    image.alt = profile?.name || 'Транспорт';
  }
  if (label) label.textContent = type === 'foot' ? 'Пешком' : profile?.name || 'Седан';
  if (stats) stats.textContent = type === 'foot' ? 'Подойдите к транспорту и нажмите E' : `${ctx.env.Math.round(profile?.mass || 1500)} кг · состояние ${ctx.env.Math.round(ctx.player.hp)}%`;
};
ctx.toggleGarage = function toggleGarage() {
  const modal = ctx.env.document.getElementById('garageModal');
  if (!modal) return;
  ctx.state.isGarageOpen = modal.style.display !== 'flex';
  if (ctx.state.isGarageOpen) {
    ctx.state.isMapOpen = false;
    ctx.env.document.getElementById('mapModal').style.display = 'none';
  }
  if (ctx.state.isGarageOpen) ctx.updateGarageVehicle();
  modal.style.display = ctx.state.isGarageOpen ? 'flex' : 'none';
  ctx.syncGamePause();
};
}
