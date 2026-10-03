// One shared runtime context owns state; this system has no hidden globals.
export function installRenderCanvasCity(ctx){
const {WEATHER_PRESETS,districtPoint,drawArchitecture,sourceDistrict,streetPoints,streetWidth,worldPoint}=ctx.dependencies;
ctx.drawStreetSignal = function drawStreetSignal(x, y, axis) {
  ctx.ctx.save();
  ctx.ctx.translate(x, y);
  ctx.ctx.transform(1 / ctx.env.Math.sqrt(3), -1 / ctx.env.Math.sqrt(3), 1, 1, 0, 0);
  ctx.ctx.strokeStyle = '#5f6560';
  ctx.ctx.lineWidth = 2;
  ctx.ctx.beginPath();
  ctx.ctx.moveTo(0, 0);
  ctx.ctx.lineTo(0, -28);
  ctx.ctx.stroke();
  ctx.ctx.fillStyle = '#151b1c';
  ctx.ctx.fillRect(-4, -37, 8, 20);
  const active = ctx.streetSignal(axis),
    colors = {
      red: '#df6352',
      amber: '#e7b656',
      green: '#7dc793'
    };
  ['red', 'amber', 'green'].forEach((color, i) => {
    ctx.ctx.fillStyle = active === color ? colors[color] : '#343a36';
    ctx.ctx.shadowColor = colors[color];
    ctx.ctx.shadowBlur = active === color ? 4 : 0;
    ctx.ctx.beginPath();
    ctx.ctx.arc(0, -33 + i * 6, 2.1, 0, ctx.env.Math.PI * 2);
    ctx.ctx.fill();
  });
  ctx.ctx.restore();
};
ctx.drawTransitStops = function drawTransitStops() {
  const placed = new Set();
  for (const {
    x,
    y
  } of ctx.transitStopSigns()) {
    const key = `${ctx.env.Math.round(x)}:${ctx.env.Math.round(y)}`;
    if (placed.has(key) || ctx.env.Math.abs(x - ctx.player.x) > 2200 || ctx.env.Math.abs(y - ctx.player.y) > 2200) continue;
    placed.add(key);
    ctx.ctx.strokeStyle = '#343a39';
    ctx.ctx.lineWidth = 3;
    ctx.ctx.beginPath();
    ctx.ctx.moveTo(x, y + 15);
    ctx.ctx.lineTo(x, y - 12);
    ctx.ctx.stroke();
    ctx.ctx.fillStyle = '#d5a54e';
    ctx.ctx.fillRect(x - 7, y - 14, 14, 12);
    ctx.ctx.strokeStyle = '#20201b';
    ctx.ctx.lineWidth = 1;
    ctx.ctx.strokeRect(x - 7, y - 14, 14, 12);
    ctx.ctx.fillStyle = '#171a1b';
    ctx.ctx.font = 'bold 7px monospace';
    ctx.ctx.textAlign = 'center';
    ctx.ctx.fillText('BUS', x, y - 6);
    ctx.ctx.fillStyle = 'rgba(22,27,27,.7)';
    ctx.ctx.fillRect(x - 12, y + 5, 24, 3);
  }
};
ctx.stableVisualHash = function stableVisualHash(a, b, c = 0) {
  const value = ctx.env.Math.sin(a * 12.9898 + b * 78.233 + c * 37.719) * 43758.5453;
  return value - ctx.env.Math.floor(value);
};
ctx.streetPaintVisible = function streetPaintVisible(x1, y1, x2 = x1, y2 = y1) {
  if ((ctx.roam?.altitude || 0) > 30) return true;
  const range = ctx.env.Math.max(ctx.canvas.width, ctx.canvas.height) * 2.2 + 200;
  return ctx.env.Math.max(x1, x2) >= ctx.player.x - range && ctx.env.Math.min(x1, x2) <= ctx.player.x + range && ctx.env.Math.max(y1, y2) >= ctx.player.y - range && ctx.env.Math.min(y1, y2) <= ctx.player.y + range;
};
ctx.drawStreetCorridor = function drawStreetCorridor(target, road, color, extra = 0, scale = 1, ox = 0, oy = 0) {
  if (target === ctx.ctx && !ctx.streetPaintVisible(road.x, road.y, road.x + road.w, road.y + road.h)) return;
  target.save();
  target.strokeStyle = color;
  target.lineWidth = (streetWidth(road) + extra) * scale;
  target.lineJoin = 'round';
  target.lineCap = 'round';
  target.beginPath();
  streetPoints(road).forEach(([x, y], i) => i ? target.lineTo(ox + x * scale, oy + y * scale) : target.moveTo(ox + x * scale, oy + y * scale));
  target.stroke();
  target.restore();
};
ctx.drawWetRoadSurface = function drawWetRoadSurface(r, index) {
  if (r.x > ctx.player.x + 1500 || r.y > ctx.player.y + 1500 || r.x + r.w < ctx.player.x - 1500 || r.y + r.h < ctx.player.y - 1500) return;
  ctx.ctx.save();
  ctx.ctx.beginPath();
  ctx.ctx.rect(r.x, r.y, r.w, r.h);
  ctx.ctx.clip();
  const across = r.dir === 'h' ? r.h : r.w;
  const length = r.dir === 'h' ? r.w : r.h;
  // Reflections and wear sit on the shared asphalt material. A separate
  // directional gradient for each road produces rectangular seams at turns.
  ctx.ctx.globalCompositeOperation = 'screen';
  for (let i = 0; i < ctx.env.Math.min(9, ctx.env.Math.floor(length / 180) + 2); i++) {
    const along = (ctx.stableVisualHash(index, i, 2) * .86 + .07) * length;
    const lane = (ctx.stableVisualHash(index, i, 5) * .72 + .14) * across;
    const warm = i % 4 === 3;
    const color = warm ? '211,55,25' : '231,161,58';
    const px = r.dir === 'h' ? r.x + along : r.x + lane;
    const py = r.dir === 'h' ? r.y + lane : r.y + along;
    const g = ctx.ctx.createRadialGradient(px, py, 1, px, py, 25 + i % 3 * 8);
    g.addColorStop(0, `rgba(${color},.18)`);
    g.addColorStop(1, `rgba(${color},0)`);
    ctx.ctx.fillStyle = g;
    ctx.ctx.beginPath();
    ctx.ctx.ellipse(px, py, r.dir === 'h' ? 55 : 10, r.dir === 'h' ? 10 : 55, 0, 0, ctx.env.Math.PI * 2);
    ctx.ctx.fill();
  }
  ctx.ctx.globalCompositeOperation = 'source-over';
  for (let n = 0; n < ctx.env.Math.min(450, length * .3); n++) {
    const u = ctx.stableVisualHash(index, n, 19),
      v = ctx.stableVisualHash(index, n, 23);
    const px = r.x + u * r.w,
      py = r.y + v * r.h;
    ctx.ctx.fillStyle = n % 4 === 0 ? 'rgba(161,155,133,.14)' : 'rgba(3,7,9,.25)';
    ctx.ctx.fillRect(px, py, 1 + u * 5, .7 + v * 2);
    if (n % 29 === 0) {
      ctx.ctx.strokeStyle = 'rgba(6,9,11,.5)';
      ctx.ctx.lineWidth = 1;
      ctx.ctx.beginPath();
      ctx.ctx.moveTo(px, py);
      ctx.ctx.lineTo(px + 12, py + 4);
      ctx.ctx.lineTo(px + 20, py - 3);
      ctx.ctx.stroke();
    }
  }
  ctx.ctx.strokeStyle = 'rgba(198,205,201,.08)';
  ctx.ctx.lineWidth = 1;
  for (let i = 0; i < 5; i++) {
    const along = ctx.stableVisualHash(index, i, 9) * length;
    ctx.ctx.beginPath();
    if (r.dir === 'h') {
      ctx.ctx.moveTo(r.x + along, r.y + across * .2);
      ctx.ctx.lineTo(r.x + along + 34, r.y + across * .42);
      ctx.ctx.lineTo(r.x + along + 12, r.y + across * .72);
    } else {
      ctx.ctx.moveTo(r.x + across * .2, r.y + along);
      ctx.ctx.lineTo(r.x + across * .42, r.y + along + 34);
      ctx.ctx.lineTo(r.x + across * .72, r.y + along + 12);
    }
    ctx.ctx.stroke();
  }
  ctx.ctx.restore();
};
ctx.traceSmoothBridgePath = // Canvas and map views follow the same centreline as the road corridor.
function traceSmoothBridgePath(target, points, radius = 120) {
  if (!Array.isArray(points) || points.length < 2) return false;
  const safe = points.filter(p => Number.isFinite(p?.x) && Number.isFinite(p?.y));
  if (safe.length < 2) return false;
  target.beginPath();
  target.moveTo(safe[0].x, safe[0].y);
  for (let i = 1; i < safe.length - 1; i++) {
    const prev = safe[i - 1],
      point = safe[i],
      next = safe[i + 1];
    const inLength = ctx.env.Math.hypot(point.x - prev.x, point.y - prev.y) || 1;
    const outLength = ctx.env.Math.hypot(next.x - point.x, next.y - point.y) || 1;
    const trim = ctx.env.Math.min(radius, inLength * .34, outLength * .34);
    const inPoint = {
      x: point.x + (prev.x - point.x) * trim / inLength,
      y: point.y + (prev.y - point.y) * trim / inLength
    };
    const outPoint = {
      x: point.x + (next.x - point.x) * trim / outLength,
      y: point.y + (next.y - point.y) * trim / outLength
    };
    target.lineTo(inPoint.x, inPoint.y);
    target.quadraticCurveTo(point.x, point.y, outPoint.x, outPoint.y);
  }
  const end = safe.at(-1);
  target.lineTo(end.x, end.y);
  return true;
};
ctx.drawSmoothBridgeDeck = function drawSmoothBridgeDeck(bridgePath, index = 0) {
  if (!bridgePath?.path?.length) return;
  const width = ctx.env.Math.max(bridgePath.width || ctx.ROAD_W, ctx.ROAD_W * .72);
  const radius = width * .5;
  ctx.ctx.save();
  ctx.ctx.lineJoin = 'round';
  ctx.ctx.lineCap = ctx.bridgeEndCap;
  if (!ctx.traceSmoothBridgePath(ctx.ctx, bridgePath.path, radius)) {
    ctx.ctx.restore();
    return;
  }
  ctx.ctx.strokeStyle = 'rgba(100,113,113,.8)';
  ctx.ctx.lineWidth = width + 8;
  ctx.ctx.stroke();
  ctx.traceSmoothBridgePath(ctx.ctx, bridgePath.path, radius);
  ctx.ctx.strokeStyle = ctx.PALETTE.asphalt;
  ctx.ctx.lineWidth = width;
  ctx.ctx.stroke();
  ctx.traceSmoothBridgePath(ctx.ctx, bridgePath.path, radius);
  ctx.ctx.setLineDash([16, 20]);
  ctx.ctx.lineDashOffset = -(bridgePath.path[0]?.x || 0);
  ctx.ctx.strokeStyle = ctx.PALETTE.roadMarkingYellow;
  ctx.ctx.lineWidth = 2.5;
  ctx.ctx.stroke();
  ctx.ctx.setLineDash([]);
  ctx.ctx.lineDashOffset = 0;
  if (ctx.weather.rain > .02) {
    ctx.traceSmoothBridgePath(ctx.ctx, bridgePath.path, radius * .9);
    ctx.ctx.globalCompositeOperation = 'screen';
    ctx.ctx.strokeStyle = `rgba(177,193,184,${.035 + ctx.weather.rain * .035})`;
    ctx.ctx.lineWidth = ctx.env.Math.max(2, width * .24);
    ctx.ctx.stroke();
  }
  ctx.ctx.restore();
};
ctx.drawWeather = function drawWeather(w, h) {
  const t = ctx.weather.time,
    wind = ctx.weather.gust;
  ctx.ctx.save();
  if (ctx.weather.rain > .02) {
    ctx.ctx.strokeStyle = `rgba(161,199,217,${.13 + ctx.weather.rain * .2})`;
    ctx.ctx.lineWidth = .7;
    const count = ctx.env.Math.min(260, ctx.env.Math.round(w * h / 5200 * ctx.weather.rain));
    ctx.ctx.beginPath();
    for (let i = 0; i < count; i++) {
      const x = (i * 173.31 + t * wind * 83) % (w + 50) - 25,
        y = (i * 117.13 + t * (310 + i % 5 * 26)) % (h + 35) - 20;
      ctx.ctx.moveTo(x, y);
      ctx.ctx.lineTo(x + wind * 10, y + 8 + ctx.weather.rain * 9);
    }
    ctx.ctx.stroke();
    ctx.ctx.strokeStyle = `rgba(168,201,211,${ctx.weather.rain * .15})`;
    ctx.ctx.lineWidth = .6;
    for (let i = 0; i < 28; i++) {
      const phase = (t * 1.6 + i * .31) % 1;
      ctx.ctx.beginPath();
      ctx.ctx.ellipse(i * 233.17 % w, i * 137.19 % h, phase * 5, phase * 1.6, 0, 0, ctx.env.Math.PI * 2);
      ctx.ctx.stroke();
    }
  }
  if (ctx.weather.fog > .02) {
    const fog = ctx.ctx.createLinearGradient(0, 0, 0, h);
    fog.addColorStop(0, `rgba(130,153,158,${ctx.weather.fog * .28})`);
    fog.addColorStop(1, `rgba(100,124,130,${ctx.weather.fog * .06})`);
    ctx.ctx.fillStyle = fog;
    ctx.ctx.fillRect(0, 0, w, h);
    for (let i = 0; i < 3; i++) {
      const x = (t * wind * 19 + i * w * .42) % (w * 1.8) - w * .4;
      const bank = ctx.ctx.createRadialGradient(x, h * (.2 + i * .24), 0, x, h * (.2 + i * .24), w * .48);
      bank.addColorStop(0, `rgba(156,174,178,${ctx.weather.fog * .09})`);
      bank.addColorStop(1, 'rgba(156,174,178,0)');
      ctx.ctx.fillStyle = bank;
      ctx.ctx.fillRect(0, 0, w, h);
    }
  }
  if (wind > .3) {
    ctx.ctx.fillStyle = 'rgba(160,133,83,.38)';
    for (let i = 0; i < 16; i++) {
      const x = (i * 137 + t * wind * 100) % (w + 30) - 15,
        y = (i * 191 + ctx.env.Math.sin(t * 2 + i) * 14) % (h + 20);
      ctx.ctx.save();
      ctx.ctx.translate(x, y);
      ctx.ctx.rotate(t * 3 + i);
      ctx.ctx.fillRect(-2, -.6, 4, 1.2);
      ctx.ctx.restore();
    }
  }
  if (ctx.weather.flash > 0) {
    ctx.ctx.fillStyle = `rgba(201,219,244,${ctx.weather.flash})`;
    ctx.ctx.fillRect(0, 0, w, h);
  }
  ctx.ctx.restore();
  const badge = ctx.env.document.getElementById('btnWeather');
  if (badge) badge.textContent = WEATHER_PRESETS[ctx.weather.kind].label;
};
ctx.drawVehicleAtmosphere = function drawVehicleAtmosphere(target, vehicle, lift = 0) {
  if (lift > 12) return;
  const speed = ctx.env.Math.abs(vehicle.speed || 0),
    w = vehicle.width || 48,
    h = vehicle.height || 24,
    t = ctx.weather.time;
  target.save();
  target.translate(vehicle.x, vehicle.y);
  target.rotate(vehicle.angle || 0);
  if (speed > .3 && ctx.weather.wetness > .08) {
    target.strokeStyle = `rgba(164,199,211,${ctx.env.Math.min(.3, ctx.weather.wetness * speed * .06)})`;
    target.lineWidth = 1;
    for (const side of [-1, 1]) for (let i = 0; i < 5; i++) {
      const phase = (t * 4 + i * .21) % 1,
        x = -w * .3 - phase * (10 + speed * 4),
        y = side * (h * .46 + phase * 7);
      target.beginPath();
      target.moveTo(x, y);
      target.lineTo(x - 3, y + side * 1.3);
      target.stroke();
    }
  }
  if (speed > .15) {
    const damage = (vehicle.hp ?? 100) < 40;
    for (let i = 0; i < (damage ? 6 : 2); i++) {
      const phase = (t * 1.4 + i * .27) % 1;
      target.fillStyle = damage ? `rgba(54,53,48,${(1 - phase) * .35})` : `rgba(154,158,151,${(1 - phase) * .13})`;
      target.beginPath();
      target.ellipse(-w * .53 - phase * 15, 3 + ctx.env.Math.sin(t + i) * 2, 1 + phase * 4, 1 + phase * 2, 0, 0, ctx.env.Math.PI * 2);
      target.fill();
    }
  }
  if (ctx.weather.wetness > .1) {
    target.fillStyle = `rgba(241,209,143,${ctx.weather.wetness * .1})`;
    target.beginPath();
    target.ellipse(w * .55, 0, w * .36, h * .43, 0, 0, ctx.env.Math.PI * 2);
    target.fill();
  }
  target.restore();
};
ctx.drawNoirPostFx = function drawNoirPostFx(w, h) {
  ctx.ctx.save();
  const vignette = ctx.ctx.createRadialGradient(w * .5, h * .48, ctx.env.Math.min(w, h) * .18, w * .5, h * .48, ctx.env.Math.max(w, h) * .72);
  vignette.addColorStop(0, 'rgba(0,0,0,0)');
  vignette.addColorStop(.72, 'rgba(0,0,0,.08)');
  vignette.addColorStop(1, 'rgba(0,0,0,.55)');
  ctx.ctx.fillStyle = vignette;
  ctx.ctx.fillRect(0, 0, w, h);
  ctx.ctx.fillStyle = 'rgba(255,218,150,.018)';
  for (let y = 0; y < h; y += 4) ctx.ctx.fillRect(0, y, w, 1);
  ctx.ctx.restore();
};
ctx.drawBuilding = function drawBuilding(b, index) {
  drawArchitecture(ctx.ctx, b, index, ctx.env.performance.now() / 1000);
};
ctx.drawCityScenery = function drawCityScenery() {
  // Footpaths join civic entrances to the response driveway without adding a road through a building.
  for (const base of ctx.serviceBases) {
    const exit = base.building.exitPath;
    if (!exit?.length) continue;
    ctx.ctx.strokeStyle = 'rgba(132,132,117,.24)';
    ctx.ctx.lineWidth = 15;
    ctx.ctx.lineJoin = 'round';
    ctx.ctx.beginPath();
    exit.forEach((p, i) => i ? ctx.ctx.lineTo(p.x, p.y) : ctx.ctx.moveTo(p.x, p.y));
    ctx.ctx.stroke();
  }
  // Parking bays and stationary cars make blocks feel inhabited.
  ctx.parkedCars.forEach(car => {
    car.bayX ??= car.x;
    car.bayY ??= car.y;
    ctx.ctx.save();
    ctx.ctx.translate(car.bayX, car.bayY);
    ctx.ctx.rotate(car.angle);
    ctx.ctx.strokeStyle = 'rgba(210,215,220,.16)';
    ctx.ctx.lineWidth = 1.5;
    ctx.ctx.strokeRect(-34, -18, 68, 36);
    ctx.ctx.restore();
  });
  ctx.cranes.forEach((crane, index) => {
    const boomY = crane.y - 150;
    ctx.ctx.strokeStyle = index % 2 ? '#a86528' : '#c48632';
    ctx.ctx.lineWidth = 11;
    ctx.ctx.beginPath();
    ctx.ctx.moveTo(crane.x, crane.y);
    ctx.ctx.lineTo(crane.x, boomY);
    ctx.ctx.lineTo(crane.x + crane.reach, boomY);
    ctx.ctx.stroke();
    ctx.ctx.strokeStyle = '#6c401f';
    ctx.ctx.lineWidth = 3;
    ctx.ctx.beginPath();
    ctx.ctx.moveTo(crane.x, boomY);
    ctx.ctx.lineTo(crane.x + crane.reach * .75, crane.y - 35);
    ctx.ctx.stroke();
    const hookX = crane.x + crane.reach * .82 + ctx.env.Math.sin(ctx.env.performance.now() / 5200 + index) * 5;
    const cable = 88 + ctx.env.Math.sin(ctx.env.performance.now() / 8200 + index * 2) * 22;
    ctx.ctx.beginPath();
    ctx.ctx.moveTo(hookX, boomY);
    ctx.ctx.lineTo(hookX, boomY + cable);
    ctx.ctx.stroke();
    ctx.ctx.fillStyle = '#111820';
    ctx.ctx.fillRect(hookX - 9, boomY + cable - 3, 18, 12);
  });
};
ctx.drawBillboard = function drawBillboard(board) {
  ctx.ctx.save();
  ctx.ctx.translate(board.x, board.y);
  ctx.ctx.transform(1 / ctx.env.Math.sqrt(3), -1 / ctx.env.Math.sqrt(3), 1, 1, 0, 0);
  ctx.ctx.strokeStyle = '#3a423f';
  ctx.ctx.lineWidth = 4;
  ctx.ctx.beginPath();
  ctx.ctx.moveTo(-36, 0);
  ctx.ctx.lineTo(-36, -56);
  ctx.ctx.moveTo(36, 0);
  ctx.ctx.lineTo(36, -56);
  ctx.ctx.stroke();
  ctx.ctx.fillStyle = '#131918';
  ctx.ctx.fillRect(-65, -83, 130, 36);
  ctx.ctx.strokeStyle = board.color;
  ctx.ctx.lineWidth = 2;
  ctx.ctx.strokeRect(-65, -83, 130, 36);
  ctx.ctx.fillStyle = board.color;
  ctx.ctx.font = '900 12px monospace';
  ctx.ctx.textAlign = 'center';
  ctx.ctx.fillText(board.text, 0, -60, 120);
  ctx.ctx.restore();
};
ctx.drawStreetLamp = function drawStreetLamp(lamp, index) {
  const glow = ctx.ctx.createRadialGradient(lamp.x, lamp.y, 2, lamp.x, lamp.y, 62);
  glow.addColorStop(0, 'rgba(232,184,74,.28)');
  glow.addColorStop(1, 'rgba(232,184,74,0)');
  ctx.ctx.fillStyle = glow;
  ctx.ctx.beginPath();
  ctx.ctx.arc(lamp.x, lamp.y, 62, 0, ctx.env.Math.PI * 2);
  ctx.ctx.fill();
  ctx.ctx.strokeStyle = '#4b5563';
  ctx.ctx.lineWidth = 4;
  ctx.ctx.beginPath();
  ctx.ctx.moveTo(lamp.x, lamp.y);
  ctx.ctx.lineTo(lamp.x - 48, lamp.y - 48);
  ctx.ctx.lineTo(lamp.x - 48 + (index % 2 ? -8 : 8), lamp.y - 48 + (index % 2 ? 8 : -8));
  ctx.ctx.stroke();
  ctx.ctx.fillStyle = lamp.tone;
  ctx.ctx.shadowColor = lamp.tone;
  ctx.ctx.shadowBlur = 13;
  ctx.ctx.beginPath();
  ctx.ctx.arc(lamp.x - 48 + (index % 2 ? -8 : 8), lamp.y - 48 + (index % 2 ? 8 : -8), 4, 0, ctx.env.Math.PI * 2);
  ctx.ctx.fill();
  ctx.ctx.shadowBlur = 0;
};
ctx.drawDistrictGroundDetails = function drawDistrictGroundDetails() {
  // Parks, plazas, service yards and wet reflections break up the block grid
  // without changing the city's collision geometry.
  const rounded = (x, y, w, h, r) => {
    ctx.ctx.beginPath();
    ctx.ctx.moveTo(x + r, y);
    ctx.ctx.lineTo(x + w - r, y);
    ctx.ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.ctx.lineTo(x + w, y + h - r);
    ctx.ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.ctx.lineTo(x + r, y + h);
    ctx.ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.ctx.lineTo(x, y + r);
    ctx.ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.ctx.closePath();
  };
  for (const [i, park] of ctx.parkZones.entries()) {
    rounded(park.x, park.y, park.w, park.h, 28);
    ctx.ctx.fillStyle = park.courtyard ? '#44443e' : i % 2 ? '#1b3024' : '#203529';
    ctx.ctx.fill();
    ctx.ctx.strokeStyle = '#615d50';
    ctx.ctx.lineWidth = 5;
    ctx.ctx.stroke();
    if (park.courtyard) {
      ctx.ctx.save();
      ctx.ctx.clip();
      ctx.ctx.strokeStyle = 'rgba(180,172,149,.14)';
      ctx.ctx.lineWidth = 1;
      for (let y = park.y; y < park.y + park.h; y += 18) {
        ctx.ctx.beginPath();
        ctx.ctx.moveTo(park.x, y);
        ctx.ctx.lineTo(park.x + park.w, y);
        ctx.ctx.stroke();
      }
      for (let x = park.x; x < park.x + park.w; x += 26) {
        ctx.ctx.beginPath();
        ctx.ctx.moveTo(x, park.y);
        ctx.ctx.lineTo(x, park.y + park.h);
        ctx.ctx.stroke();
      }
      ctx.ctx.restore();
    }
    // Curved pale paths replace the rigid cross used in the first version.
    ctx.ctx.strokeStyle = 'rgba(190,178,145,.42)';
    ctx.ctx.lineWidth = 15;
    ctx.ctx.lineCap = 'round';
    ctx.ctx.beginPath();
    ctx.ctx.moveTo(park.x + 18, park.y + park.h * .68);
    ctx.ctx.quadraticCurveTo(park.x + park.w * .42, park.y + park.h * .2, park.x + park.w - 18, park.y + park.h * .42);
    ctx.ctx.stroke();
    ctx.ctx.beginPath();
    ctx.ctx.moveTo(park.x + park.w * .46, park.y + 15);
    ctx.ctx.quadraticCurveTo(park.x + park.w * .64, park.y + park.h * .55, park.x + park.w * .54, park.y + park.h - 15);
    ctx.ctx.stroke();
    const cx = park.x + park.w * .53,
      cy = park.y + park.h * .51;
    if (park.type === 0) {
      ctx.ctx.fillStyle = 'rgba(0,0,0,.4)';
      ctx.ctx.beginPath();
      ctx.ctx.ellipse(cx + 8, cy + 10, 49, 29, 0, 0, ctx.env.Math.PI * 2);
      ctx.ctx.fill();
      ctx.ctx.fillStyle = '#4c5552';
      ctx.ctx.beginPath();
      ctx.ctx.ellipse(cx, cy + 7, 43, 28, 0, 0, ctx.env.Math.PI * 2);
      ctx.ctx.fill();
      ctx.ctx.fillStyle = '#8c9188';
      ctx.ctx.beginPath();
      ctx.ctx.ellipse(cx, cy, 43, 28, 0, 0, ctx.env.Math.PI * 2);
      ctx.ctx.fill();
      ctx.ctx.strokeStyle = '#a7a99f';
      ctx.ctx.lineWidth = 5;
      ctx.ctx.stroke();
      const glow = ctx.ctx.createRadialGradient(cx, cy, 2, cx, cy, 38);
      glow.addColorStop(0, 'rgba(134,197,204,.65)');
      glow.addColorStop(1, 'rgba(55,116,125,.12)');
      ctx.ctx.fillStyle = glow;
      ctx.ctx.beginPath();
      ctx.ctx.ellipse(cx, cy, 31, 19, 0, 0, ctx.env.Math.PI * 2);
      ctx.ctx.fill();
      for (let ripple = 0; ripple < 3; ripple++) {
        const radius = 5 + (ctx.env.performance.now() / 160 + ripple * 10) % 26;
        ctx.ctx.strokeStyle = `rgba(183,219,214,${.25 * (1 - radius / 32)})`;
        ctx.ctx.lineWidth = 1;
        ctx.ctx.beginPath();
        ctx.ctx.ellipse(cx, cy, radius, radius * .58, 0, 0, ctx.env.Math.PI * 2);
        ctx.ctx.stroke();
      }
      ctx.ctx.fillStyle = '#7c837c';
      ctx.ctx.fillRect(cx - 6, cy - 30, 12, 30);
      ctx.ctx.beginPath();
      ctx.ctx.ellipse(cx, cy - 30, 9, 5, 0, 0, ctx.env.Math.PI * 2);
      ctx.ctx.fill();
      ctx.ctx.strokeStyle = 'rgba(173,224,228,.65)';
      ctx.ctx.lineWidth = 2;
      for (let n = -1; n <= 1; n++) {
        ctx.ctx.beginPath();
        ctx.ctx.moveTo(cx + n * 4, cy - 29);
        ctx.ctx.quadraticCurveTo(cx + n * 13, cy - 42, cx + n * 19, cy - 4);
        ctx.ctx.stroke();
      }
    } else if (park.type === 1) {
      ctx.ctx.fillStyle = '#565b53';
      ctx.ctx.beginPath();
      ctx.ctx.ellipse(cx, cy + 5, park.w * .22, park.h * .25, -.25, 0, ctx.env.Math.PI * 2);
      ctx.ctx.fill();
      ctx.ctx.fillStyle = '#102d34';
      ctx.ctx.beginPath();
      ctx.ctx.ellipse(cx, cy, park.w * .2, park.h * .23, -.25, 0, ctx.env.Math.PI * 2);
      ctx.ctx.fill();
      ctx.ctx.strokeStyle = 'rgba(109,162,157,.55)';
      ctx.ctx.lineWidth = 4;
      ctx.ctx.stroke();
      for (let l = 0; l < 5; l++) {
        ctx.ctx.strokeStyle = 'rgba(151,196,187,.18)';
        ctx.ctx.lineWidth = 2;
        ctx.ctx.beginPath();
        ctx.ctx.arc(cx - 18 + l * 9, cy, 12, 0, ctx.env.Math.PI);
        ctx.ctx.stroke();
      }
      ctx.ctx.strokeStyle = '#718052';
      ctx.ctx.lineWidth = 3;
      for (let r = 0; r < 8; r++) {
        const a = r * .78;
        ctx.ctx.beginPath();
        ctx.ctx.moveTo(cx + ctx.env.Math.cos(a) * park.w * .19, cy + ctx.env.Math.sin(a) * park.h * .21);
        ctx.ctx.lineTo(cx + ctx.env.Math.cos(a) * park.w * .21, cy - 12 + ctx.env.Math.sin(a) * park.h * .22);
        ctx.ctx.stroke();
      }
    } else if (park.type === 2) {
      ctx.ctx.fillStyle = '#3b3a31';
      ctx.ctx.fillRect(cx - 48, cy - 29, 96, 58);
      ctx.ctx.strokeStyle = 'rgba(225,207,158,.48)';
      ctx.ctx.lineWidth = 3;
      ctx.ctx.strokeRect(cx - 48, cy - 29, 96, 58);
      ctx.ctx.beginPath();
      ctx.ctx.moveTo(cx, cy - 29);
      ctx.ctx.lineTo(cx, cy + 29);
      ctx.ctx.stroke();
      ctx.ctx.beginPath();
      ctx.ctx.arc(cx - 31, cy, 10, 0, ctx.env.Math.PI * 2);
      ctx.ctx.arc(cx + 31, cy, 10, 0, ctx.env.Math.PI * 2);
      ctx.ctx.stroke();
    } else if (park.type === 3) {
      for (let s = 0; s < 4; s++) {
        const sx = cx - 62 + s * 40;
        ctx.ctx.fillStyle = 'rgba(0,0,0,.35)';
        ctx.ctx.fillRect(sx + 6, cy - 10, 31, 25);
        ctx.ctx.fillStyle = ['#9a5733', '#365f69', '#84642e', '#6c3d34'][s];
        ctx.ctx.fillRect(sx, cy - 18, 28, 23);
        ctx.ctx.fillStyle = '#201d1a';
        ctx.ctx.fillRect(sx + 5, cy - 13, 18, 14);
        ctx.ctx.fillStyle = '#d3c29a';
        ctx.ctx.beginPath();
        ctx.ctx.moveTo(sx - 4, cy - 22);
        ctx.ctx.lineTo(sx + 32, cy - 22);
        ctx.ctx.lineTo(sx + 27, cy - 31);
        ctx.ctx.lineTo(sx + 1, cy - 31);
        ctx.ctx.closePath();
        ctx.ctx.fill();
        ctx.ctx.strokeStyle = '#5b4932';
        ctx.ctx.stroke();
      }
    } else if (park.type === 4) {
      ctx.ctx.fillStyle = '#633e38';
      ctx.ctx.beginPath();
      ctx.ctx.ellipse(cx, cy, park.w * .22, park.h * .2, 0, 0, ctx.env.Math.PI * 2);
      ctx.ctx.fill();
      ctx.ctx.strokeStyle = '#e1b44e';
      ctx.ctx.lineWidth = 5;
      ctx.ctx.beginPath();
      ctx.ctx.moveTo(cx - 28, cy + 12);
      ctx.ctx.lineTo(cx - 16, cy - 20);
      ctx.ctx.lineTo(cx + 18, cy - 20);
      ctx.ctx.lineTo(cx + 34, cy + 12);
      ctx.ctx.stroke();
      ctx.ctx.strokeStyle = '#607b85';
      ctx.ctx.lineWidth = 3;
      ctx.ctx.beginPath();
      ctx.ctx.moveTo(cx + 38, cy - 26);
      ctx.ctx.lineTo(cx + 54, cy + 16);
      ctx.ctx.stroke();
      ctx.ctx.fillStyle = '#cf8450';
      ctx.ctx.beginPath();
      ctx.ctx.moveTo(cx + 38, cy - 26);
      ctx.ctx.lineTo(cx + 55, cy - 26);
      ctx.ctx.lineTo(cx + 66, cy + 15);
      ctx.ctx.lineTo(cx + 50, cy + 15);
      ctx.ctx.closePath();
      ctx.ctx.fill();
      ctx.ctx.strokeStyle = '#323c3b';
      ctx.ctx.lineWidth = 2;
      ctx.ctx.beginPath();
      ctx.ctx.moveTo(cx - 43, cy - 22);
      ctx.ctx.lineTo(cx - 43, cy + 7);
      ctx.ctx.moveTo(cx - 55, cy - 22);
      ctx.ctx.lineTo(cx - 31, cy - 22);
      ctx.ctx.moveTo(cx - 55, cy + 7);
      ctx.ctx.lineTo(cx - 31, cy + 7);
      ctx.ctx.stroke();
    } else if (park.type === 5) {
      ctx.ctx.fillStyle = '#31402b';
      ctx.ctx.fillRect(cx - 70, cy - 43, 140, 86);
      for (let row = 0; row < 2; row++) for (let col = 0; col < 2; col++) {
        const gx = cx - 52 + col * 62,
          gy = cy - 26 + row * 43;
        ctx.ctx.fillStyle = '#665543';
        ctx.ctx.fillRect(gx, gy, 45, 26);
        ctx.ctx.fillStyle = ['#617744', '#71814a', '#897246', '#476745'][(row * 2 + col) % 4];
        ctx.ctx.fillRect(gx + 3, gy + 3, 39, 20);
        for (let leaf = 0; leaf < 4; leaf++) {
          ctx.ctx.fillStyle = leaf % 2 ? '#9b9b55' : '#6e8751';
          ctx.ctx.beginPath();
          ctx.ctx.arc(gx + 7 + leaf * 9, gy + 9 + leaf % 2 * 6, 3, 0, ctx.env.Math.PI * 2);
          ctx.ctx.fill();
        }
      }
      ctx.ctx.strokeStyle = '#9c9a7b';
      ctx.ctx.lineWidth = 4;
      ctx.ctx.strokeRect(cx - 75, cy - 48, 150, 96);
    } else if (park.type === 6) {
      ctx.ctx.fillStyle = '#6a6b60';
      ctx.ctx.beginPath();
      ctx.ctx.ellipse(cx, cy, park.w * .23, park.h * .22, -.08, 0, ctx.env.Math.PI * 2);
      ctx.ctx.fill();
      ctx.ctx.fillStyle = '#222c2c';
      ctx.ctx.beginPath();
      ctx.ctx.ellipse(cx, cy, park.w * .17, park.h * .16, -.08, 0, ctx.env.Math.PI * 2);
      ctx.ctx.fill();
      ctx.ctx.strokeStyle = '#b49767';
      ctx.ctx.lineWidth = 5;
      ctx.ctx.beginPath();
      ctx.ctx.ellipse(cx, cy, park.w * .22, park.h * .21, -.08, 0, ctx.env.Math.PI * 2);
      ctx.ctx.stroke();
      ctx.ctx.strokeStyle = 'rgba(219,211,183,.48)';
      ctx.ctx.lineWidth = 2;
      ctx.ctx.beginPath();
      ctx.ctx.moveTo(cx - park.w * .15, cy);
      ctx.ctx.quadraticCurveTo(cx, cy - park.h * .18, cx + park.w * .15, cy);
      ctx.ctx.stroke();
    } else {
      ctx.ctx.fillStyle = '#3d4837';
      ctx.ctx.beginPath();
      ctx.ctx.ellipse(cx, cy, park.w * .22, park.h * .2, 0, 0, ctx.env.Math.PI * 2);
      ctx.ctx.fill();
      ctx.ctx.strokeStyle = '#c3aa72';
      ctx.ctx.lineWidth = 5;
      ctx.ctx.strokeRect(cx - 60, cy - 28, 120, 56);
      for (let hoop = 0; hoop < 3; hoop++) {
        const hx = cx - 35 + hoop * 35;
        ctx.ctx.strokeStyle = '#d6a760';
        ctx.ctx.lineWidth = 3;
        ctx.ctx.beginPath();
        ctx.ctx.moveTo(hx, cy - 28);
        ctx.ctx.lineTo(hx, cy - 12);
        ctx.ctx.arc(hx + 8, cy - 12, 8, ctx.env.Math.PI, ctx.env.Math.PI * 2);
        ctx.ctx.moveTo(hx + 16, cy - 12);
        ctx.ctx.lineTo(hx + 16, cy + 12);
        ctx.ctx.stroke();
      }
      ctx.ctx.fillStyle = '#7b6d48';
      ctx.ctx.fillRect(cx - 36, cy + 39, 72, 8);
      ctx.ctx.fillRect(cx - 25, cy + 31, 7, 8);
      ctx.ctx.fillRect(cx + 18, cy + 31, 7, 8);
    }
    // Tree belts, benches, bins and warm footlights make the park inhabited.

    park.benches.forEach(bench => {
      ctx.ctx.fillStyle = 'rgba(0,0,0,.4)';
      ctx.ctx.fillRect(bench.x - 15, bench.y + 8, 42, 7);
      ctx.ctx.fillStyle = '#30251c';
      ctx.ctx.fillRect(bench.x - 17, bench.y + 4, 38, 7);
      ctx.ctx.fillStyle = '#8b6842';
      ctx.ctx.fillRect(bench.x - 19, bench.y, 38, 6);
      ctx.ctx.fillStyle = '#54402b';
      ctx.ctx.fillRect(bench.x - 17, bench.y - 8, 38, 6);
      ctx.ctx.fillRect(bench.x - 15, bench.y + 6, 4, 9);
      ctx.ctx.fillRect(bench.x + 15, bench.y + 6, 4, 9);
    });
    for (let l = 0; l < 4; l++) {
      const lx = park.x + park.w * (.18 + l * .22),
        ly = park.y + park.h * .18;
      const g = ctx.ctx.createRadialGradient(lx, ly, 1, lx, ly, 24);
      g.addColorStop(0, 'rgba(232,184,74,.35)');
      g.addColorStop(1, 'rgba(232,184,74,0)');
      ctx.ctx.fillStyle = g;
      ctx.ctx.beginPath();
      ctx.ctx.arc(lx, ly, 24, 0, ctx.env.Math.PI * 2);
      ctx.ctx.fill();
      ctx.ctx.fillStyle = '#d8aa52';
      ctx.ctx.beginPath();
      ctx.ctx.arc(lx, ly, 3, 0, ctx.env.Math.PI * 2);
      ctx.ctx.fill();
    }
  }
  const yards = [{
    x: 3150,
    y: 650,
    w: 620,
    h: 395
  }, {
    x: 4050,
    y: 650,
    w: 470,
    h: 395
  }, {
    x: 3150,
    y: 3550,
    w: 620,
    h: 460
  }, {
    x: 4050,
    y: 3550,
    w: 470,
    h: 460
  }, {
    x: 3150,
    y: 6550,
    w: 620,
    h: 455
  }, {
    x: 4050,
    y: 6550,
    w: 470,
    h: 455
  }, {
    x: 3150,
    y: 7350,
    w: 620,
    h: 500
  }, {
    x: 4050,
    y: 7350,
    w: 470,
    h: 500
  }].map(r => {
    const d = sourceDistrict(r);
    return {
      ...r,
      ...districtPoint(r, d.id),
      w: r.w * d.w / d.source.w,
      h: r.h * d.h / d.source.h
    };
  });
  for (const [n, yard] of yards.entries()) {
    ctx.ctx.fillStyle = n % 2 ? '#292b2a' : '#2d2d29';
    ctx.ctx.fillRect(yard.x, yard.y, yard.w, yard.h);
    ctx.ctx.strokeStyle = 'rgba(188,154,91,.25)';
    ctx.ctx.lineWidth = 3;
    ctx.ctx.setLineDash([18, 13]);
    ctx.ctx.strokeRect(yard.x + 14, yard.y + 14, yard.w - 28, yard.h - 28);
    ctx.ctx.setLineDash([]);
    for (let c = 0; c < 4; c++) {
      const cx = yard.x + 55 + c * ctx.env.Math.min(125, (yard.w - 110) / 3),
        cy = yard.y + 55 + (c + n) % 2 * 72;
      ctx.ctx.fillStyle = ['#70442d', '#355261', '#6b6d62', '#7a542c'][(c + n) % 4];
      ctx.ctx.fillRect(cx, cy, 62, 30);
      ctx.ctx.strokeStyle = '#171a1b';
      ctx.ctx.lineWidth = 2;
      ctx.ctx.strokeRect(cx, cy, 62, 30);
    }
  }
  ctx.ctx.save();
  ctx.ctx.globalCompositeOperation = 'screen';
  for (let i = 0; i < 34; i++) {
    const {
      x,
      y
    } = worldPoint({
      x: 520 + i * 733 % 6250,
      y: [1170, 4170, 7170][i % 3]
    });
    const g = ctx.ctx.createLinearGradient(x - 45, y, x + 45, y);
    g.addColorStop(0, 'rgba(224,154,62,0)');
    g.addColorStop(.5, 'rgba(224,154,62,.10)');
    g.addColorStop(1, 'rgba(224,154,62,0)');
    ctx.ctx.fillStyle = g;
    ctx.ctx.beginPath();
    ctx.ctx.ellipse(x, y, 58, 9 + i % 3 * 3, 0, 0, ctx.env.Math.PI * 2);
    ctx.ctx.fill();
  }
  ctx.ctx.restore();
};
ctx.drawScenicRoads = function drawScenicRoads(target, scale = 1, offsetX = 0, offsetY = 0, map = false) {
  target.save();
  target.lineJoin = 'round';
  target.lineCap = 'round';
  for (const road of ctx.scenicRoads) {
    const path = () => {
      target.beginPath();
      road.points.forEach(([x, y], i) => i ? target.lineTo(x * scale + offsetX, y * scale + offsetY) : target.moveTo(x * scale + offsetX, y * scale + offsetY));
    };
    if (road.footway) {
      path();
      target.strokeStyle = map ? '#777968' : '#55584b';
      target.lineWidth = road.width * scale;
      target.stroke();
      continue;
    }
    if (!map) {
      path();
      target.strokeStyle = '#666356';
      target.lineWidth = (road.width + 18) * scale;
      target.stroke();
      path();
      target.strokeStyle = '#373c39';
      target.lineWidth = (road.width + 12) * scale;
      target.stroke();
    }
    path();
    target.strokeStyle = map ? '#646a68' : '#171d20';
    target.lineWidth = road.width * scale;
    target.stroke();
    if (!map) {
      path();
      target.strokeStyle = 'rgba(211,179,111,.48)';
      target.lineWidth = 1.5 * scale;
      target.setLineDash([13 * scale, 19 * scale]);
      target.stroke();
      target.setLineDash([]);
    }
  }
  target.restore();
};
ctx.drawShoreLife = function drawShoreLife() {
  // Broken tidal lines and distinct marsh / rock clusters follow each actual
  // shoreline curve instead of repeating a few points from the district box.
  for (const detail of ctx.shorelineDetails) {
    if (ctx.env.Math.abs(detail.x - ctx.player.x) > 3900 || ctx.env.Math.abs(detail.y - ctx.player.y) > 3900) continue;
    const tx = ctx.env.Math.cos(detail.tangent),
      ty = ctx.env.Math.sin(detail.tangent),
      nx = -ty,
      ny = tx;
    const waveOffset = detail.type === 'tideline' ? -18 : -(12 + detail.seed * 8);
    ctx.ctx.strokeStyle = detail.natural ? 'rgba(151,190,169,.20)' : 'rgba(137,179,174,.15)';
    ctx.ctx.lineWidth = detail.natural ? 2 : 1.5;
    ctx.ctx.lineCap = 'round';
    ctx.ctx.beginPath();
    ctx.ctx.moveTo(detail.x + nx * waveOffset - tx * 12, detail.y + ny * waveOffset - ty * 12);
    ctx.ctx.quadraticCurveTo(detail.x + nx * (waveOffset - 3) + tx * 2, detail.y + ny * (waveOffset - 3) + ty * 2, detail.x + nx * (waveOffset + 2) + tx * 17, detail.y + ny * (waveOffset + 2) + ty * 17);
    ctx.ctx.stroke();
    if (detail.type === 'reeds') {
      ctx.ctx.fillStyle = 'rgba(7,12,12,.45)';
      ctx.ctx.beginPath();
      ctx.ctx.ellipse(detail.x + 5, detail.y + 7, 17, 10, detail.tangent, 0, ctx.env.Math.PI * 2);
      ctx.ctx.fill();
      for (let blade = 0; blade < 6; blade++) {
        const side = (blade - 2.5) * 3.1,
          bend = (blade % 3 - 1) * 5,
          height = 15 + detail.seed * 15 + blade % 2 * 4;
        const bx = detail.x + tx * side,
          by = detail.y + ty * side;
        ctx.ctx.strokeStyle = blade % 3 === 0 ? '#9b9466' : blade % 2 ? '#66704b' : '#798055';
        ctx.ctx.lineWidth = 1.7;
        ctx.ctx.beginPath();
        ctx.ctx.moveTo(bx, by);
        ctx.ctx.quadraticCurveTo(bx + nx * bend, by + ny * bend, bx + nx * bend + tx * 3, by + ny * bend - height);
        ctx.ctx.stroke();
      }
    } else if (detail.type === 'brush') {
      ctx.ctx.fillStyle = 'rgba(0,0,0,.3)';
      ctx.ctx.beginPath();
      ctx.ctx.ellipse(detail.x + 3, detail.y + 7, 19, 10, detail.tangent, 0, ctx.env.Math.PI * 2);
      ctx.ctx.fill();
      for (let tuft = 0; tuft < 4; tuft++) {
        const side = (tuft - 1.5) * 7,
          px = detail.x + tx * side,
          py = detail.y + ty * side,
          r = 5 + detail.seed * 3;
        ctx.ctx.fillStyle = ['#3d4b39', '#536047', '#46523d', '#625c43'][tuft];
        ctx.ctx.beginPath();
        ctx.ctx.ellipse(px, py, r, r * .68, detail.tangent + tuft * .3, 0, ctx.env.Math.PI * 2);
        ctx.ctx.fill();
        ctx.ctx.fillStyle = 'rgba(158,153,111,.28)';
        ctx.ctx.beginPath();
        ctx.ctx.arc(px - 2, py - 2, 2, 0, ctx.env.Math.PI * 2);
        ctx.ctx.fill();
      }
    } else if (detail.type === 'timber') {
      ctx.ctx.save();
      ctx.ctx.translate(detail.x, detail.y);
      ctx.ctx.rotate(detail.tangent + .18);
      ctx.ctx.fillStyle = 'rgba(0,0,0,.35)';
      ctx.ctx.fillRect(-18, 2, 38, 9);
      ctx.ctx.fillStyle = '#4c4130';
      ctx.ctx.fillRect(-20, -4, 39, 8);
      ctx.ctx.fillStyle = '#826744';
      ctx.ctx.fillRect(-17, -5, 31, 4);
      ctx.ctx.fillStyle = '#302d26';
      ctx.ctx.beginPath();
      ctx.ctx.arc(18, 0, 4, 0, ctx.env.Math.PI * 2);
      ctx.ctx.fill();
      ctx.ctx.restore();
    } else {
      const along = 13 + detail.seed * 10,
        across = 7 + detail.seed * 5;
      ctx.ctx.fillStyle = 'rgba(4,8,9,.42)';
      ctx.ctx.beginPath();
      ctx.ctx.ellipse(detail.x + 5, detail.y + 6, along, across, detail.tangent, 0, ctx.env.Math.PI * 2);
      ctx.ctx.fill();
      ctx.ctx.fillStyle = detail.natural ? '#51544a' : '#55554d';
      ctx.ctx.beginPath();
      ctx.ctx.moveTo(detail.x - tx * along, detail.y - ty * along);
      ctx.ctx.lineTo(detail.x - tx * along * .48 + nx * across, detail.y - ty * along * .48 + ny * across);
      ctx.ctx.lineTo(detail.x + tx * along * .55 + nx * across * .8, detail.y + ty * along * .55 + ny * across * .8);
      ctx.ctx.lineTo(detail.x + tx * along, detail.y + ty * along);
      ctx.ctx.lineTo(detail.x + tx * along * .45 - nx * across * .8, detail.y + ty * along * .45 - ny * across * .8);
      ctx.ctx.lineTo(detail.x - tx * along * .55 - nx * across * .65, detail.y - ty * along * .55 - ny * across * .65);
      ctx.ctx.closePath();
      ctx.ctx.fill();
      ctx.ctx.strokeStyle = 'rgba(199,190,157,.28)';
      ctx.ctx.lineWidth = 1.3;
      ctx.ctx.beginPath();
      ctx.ctx.moveTo(detail.x - tx * along * .45, detail.y - ty * along * .45);
      ctx.ctx.lineTo(detail.x + tx * along * .3 + nx * across * .5, detail.y + ty * along * .3 + ny * across * .5);
      ctx.ctx.stroke();
      if (detail.seed > .68) {
        ctx.ctx.fillStyle = '#292c27';
        ctx.ctx.beginPath();
        ctx.ctx.ellipse(detail.x + nx * 14, detail.y + ny * 14, 5, 3, detail.tangent, 0, ctx.env.Math.PI * 2);
        ctx.ctx.fill();
      }
    }
  }
  for (const {
    x,
    y
  } of [[2500, 1770], [2500, 2100], [4850, 1770], [4850, 2100]].map(([x, y]) => worldPoint({
    x,
    y
  }))) {
    ctx.ctx.fillStyle = '#5f4730';
    ctx.ctx.fillRect(x - 5, y - 5, 10, 22);
    ctx.ctx.fillStyle = '#d7b56d';
    ctx.ctx.beginPath();
    ctx.ctx.arc(x, y - 6, 6, 0, ctx.env.Math.PI * 2);
    ctx.ctx.fill();
  }
  // Navigation buoys and moored dinghies make channels read as usable water.
  const buoys = [[2670, 850], [2670, 1500], [5020, 900], [5020, 1600], [7170, 900], [7170, 3900], [2670, 6900], [5020, 7600], [7170, 9900], [9700, 10400]];
  buoys.map(([x, y]) => worldPoint({
    x,
    y
  })).filter(p => !ctx.isPositionOnWaterObstacle(p.x, p.y)).forEach(({
    x,
    y
  }, i) => {
    const g = ctx.ctx.createRadialGradient(x, y, 2, x, y, 28);
    g.addColorStop(0, i % 2 ? 'rgba(226,72,45,.45)' : 'rgba(232,184,74,.4)');
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.ctx.fillStyle = g;
    ctx.ctx.beginPath();
    ctx.ctx.arc(x, y, 28, 0, ctx.env.Math.PI * 2);
    ctx.ctx.fill();
    ctx.ctx.fillStyle = i % 2 ? '#d4523a' : '#e8b84a';
    ctx.ctx.beginPath();
    ctx.ctx.arc(x, y, 7, 0, ctx.env.Math.PI * 2);
    ctx.ctx.fill();
    ctx.ctx.fillStyle = '#dad4c3';
    ctx.ctx.fillRect(x - 2, y - 14, 4, 9);
  });
  const dinghies = [[2600, 1920], [4950, 2250], [7050, 4700], [2750, 7750], [7200, 10400]];
  dinghies.map(([x, y]) => worldPoint({
    x,
    y
  })).filter(p => !ctx.isPositionOnWaterObstacle(p.x, p.y)).forEach(({
    x,
    y
  }, i) => {
    ctx.ctx.save();
    ctx.ctx.translate(x, y);
    ctx.ctx.rotate(i % 2 ? .25 : -.18);
    ctx.ctx.fillStyle = '#27383d';
    ctx.ctx.beginPath();
    ctx.ctx.moveTo(25, 0);
    ctx.ctx.lineTo(5, -10);
    ctx.ctx.lineTo(-24, -7);
    ctx.ctx.lineTo(-24, 7);
    ctx.ctx.lineTo(5, 10);
    ctx.ctx.closePath();
    ctx.ctx.fill();
    ctx.ctx.strokeStyle = '#8e8877';
    ctx.ctx.lineWidth = 2;
    ctx.ctx.stroke();
    ctx.ctx.fillStyle = '#171d1f';
    ctx.ctx.fillRect(-10, -5, 18, 10);
    ctx.ctx.restore();
  });
};
ctx.drawRunwaySurface = function drawRunwaySurface(runway, index) {
  const shoulder = 14,
    centerY = runway.y + runway.h / 2;
  ctx.ctx.save();

  // A dark compacted shoulder makes the strip read as a built airfield surface,
  // rather than a grey rectangle pasted onto district terrain.
  ctx.ctx.fillStyle = '#202626';
  ctx.ctx.fillRect(runway.x - shoulder, runway.y - shoulder, runway.w + shoulder * 2, runway.h + shoulder * 2);
  const asphalt = ctx.ctx.createLinearGradient(runway.x, runway.y, runway.x, runway.y + runway.h);
  asphalt.addColorStop(0, '#343a3a');
  asphalt.addColorStop(.5, '#292f2f');
  asphalt.addColorStop(1, '#343a3a');
  ctx.ctx.fillStyle = asphalt;
  ctx.ctx.fillRect(runway.x, runway.y, runway.w, runway.h);

  // Narrow service aprons give parked aircraft a believable paved bay without
  // changing the logical runway rectangle used by take-off and landing.
  const apronW = ctx.env.Math.min(190, ctx.env.Math.max(120, runway.w * .22)),
    apronX = runway.x + runway.w * .33;
  ctx.ctx.fillStyle = '#2d3434';
  ctx.ctx.fillRect(apronX, runway.y - 30, apronW, 30);
  ctx.ctx.fillRect(apronX, runway.y + runway.h, apronW, 30);
  ctx.ctx.strokeStyle = 'rgba(171,169,147,.30)';
  ctx.ctx.lineWidth = 1;
  ctx.ctx.strokeRect(apronX, runway.y - 30, apronW, 30);
  ctx.ctx.strokeRect(apronX, runway.y + runway.h, apronW, 30);

  // Edge paint and threshold bars.
  ctx.ctx.strokeStyle = 'rgba(226,224,203,.78)';
  ctx.ctx.lineWidth = 2;
  ctx.ctx.setLineDash([]);
  ctx.ctx.beginPath();
  ctx.ctx.moveTo(runway.x + 8, runway.y + 8);
  ctx.ctx.lineTo(runway.x + runway.w - 8, runway.y + 8);
  ctx.ctx.moveTo(runway.x + 8, runway.y + runway.h - 8);
  ctx.ctx.lineTo(runway.x + runway.w - 8, runway.y + runway.h - 8);
  ctx.ctx.stroke();
  ctx.ctx.fillStyle = 'rgba(229,227,207,.82)';
  for (const side of [0, 1]) {
    const baseX = side ? runway.x + runway.w - 30 : runway.x + 14;
    for (let row = 0; row < 5; row++) {
      const y = runway.y + 14 + row * (runway.h - 28) / 4;
      const x = side ? baseX : baseX;
      ctx.ctx.fillRect(x, y - 2, 16, 4);
    }
  }

  // Centre line and runway numbers.
  ctx.ctx.strokeStyle = 'rgba(235,232,209,.72)';
  ctx.ctx.lineWidth = 3;
  ctx.ctx.setLineDash([24, 22]);
  ctx.ctx.beginPath();
  ctx.ctx.moveTo(runway.x + 55, centerY);
  ctx.ctx.lineTo(runway.x + runway.w - 55, centerY);
  ctx.ctx.stroke();
  ctx.ctx.setLineDash([]);
  ctx.ctx.fillStyle = 'rgba(235,232,209,.70)';
  ctx.ctx.font = 'bold 15px monospace';
  ctx.ctx.textAlign = 'center';
  ctx.ctx.textBaseline = 'middle';
  const headings = ['09', '27'];
  ctx.ctx.fillText(headings[0], runway.x + 52, centerY);
  ctx.ctx.fillText(headings[1], runway.x + runway.w - 52, centerY);

  // Small amber/white edge lights keep the strip readable in LOWTOWN's night palette.
  for (let x = runway.x + 24; x < runway.x + runway.w - 20; x += 72) {
    const pulse = .58 + .08 * ctx.env.Math.sin((x + index * 31) * .07);
    ctx.ctx.fillStyle = `rgba(231,205,142,${pulse})`;
    for (const y of [runway.y - 5, runway.y + runway.h + 5]) {
      ctx.ctx.beginPath();
      ctx.ctx.arc(x, y, 2.4, 0, ctx.env.Math.PI * 2);
      ctx.ctx.fill();
    }
  }
  ctx.ctx.restore();
};
}
