// One shared runtime context owns state; this system has no hidden globals.
export function installRenderCanvasActors(ctx){
const {drawTransport,projectIso}=ctx.dependencies;
ctx.drawScreenPedestrian = function drawScreenPedestrian(ped, sx, sy, index, zoom = 1) {
  // Identity size stays fixed. Only the camera scales the complete figure.
  const size = (ped.player ? 1.12 : ped.visualScale ?? .9) * zoom;
  const heading = ped.heading ?? (ped.vx < 0 ? ctx.env.Math.PI : 0);
  const direction = projectIso(ctx.env.Math.cos(heading), ctx.env.Math.sin(heading));
  const norm = ctx.env.Math.hypot(direction.x, direction.y);
  const fx = direction.x / norm,
    fy = direction.y / norm;
  const back = fy < -.2,
    profile = ctx.env.Math.abs(fx);
  const swing = ctx.env.Math.sin(ped.walkPhase || 0) * (ped.gait || 0);
  const shoulder = 3.8 - profile * .9,
    hip = 2.1 - profile * .5;
  const shirt = ped.shirt || '#62503f',
    pants = ped.pants || '#22262a',
    skin = ped.skin || '#c99f77';
  const accessory = ped.accessory || '';
  ctx.ctx.save();
  ctx.ctx.translate(sx, sy-(ped.jumpHeight||0)*zoom);
  ctx.ctx.scale(size, size);
  ctx.ctx.fillStyle = 'rgba(0,0,0,.45)';
  ctx.ctx.beginPath();
  ctx.ctx.ellipse(2, 1, 6, 2.7, -.15, 0, ctx.env.Math.PI * 2);
  ctx.ctx.fill();
  if (ped.stance === 'down') {
    ctx.ctx.save();
    ctx.ctx.rotate(-.16);
    ctx.ctx.fillStyle = pants;
    ctx.ctx.fillRect(-7, -4, 10, 3.5);
    ctx.ctx.fillStyle = shirt;
    ctx.ctx.fillRect(-1, -5.3, 7, 4.6);
    ctx.ctx.fillStyle = skin;
    ctx.ctx.beginPath();
    ctx.ctx.ellipse(7, -3.2, 2.3, 2.1, 0, 0, ctx.env.Math.PI * 2);
    ctx.ctx.fill();
    ctx.ctx.restore();
    ctx.ctx.restore();
    return;
  }
  const limb = (points, color, width) => {
    ctx.ctx.strokeStyle = color;
    ctx.ctx.lineWidth = width;
    ctx.ctx.lineCap = 'round';
    ctx.ctx.lineJoin = 'round';
    ctx.ctx.beginPath();
    points.forEach(([x, y], i) => i ? ctx.ctx.lineTo(x, y) : ctx.ctx.moveTo(x, y));
    ctx.ctx.stroke();
  };
  for (const side of [-1, 1]) {
    const stride = swing * side * 3.5,
      footX = side * hip + fx * stride,
      footY = fy * stride * .5;
    limb([[side * hip, -11], [side * hip + fx * stride * .45, -5.5], [footX, footY - ctx.env.Math.max(0, stride) * .15]], pants, 2.7);
    limb([[footX, footY], [footX + fx * 1.7, footY + fy * .7]], '#101315', 2.3);
  }
  if (accessory === 'backpack' || accessory === 'shoulderBag') {
    ctx.ctx.fillStyle = accessory === 'backpack' ? '#514638' : '#604535';
    ctx.ctx.fillRect(-shoulder - 3, -19, 4, 8);
    ctx.ctx.fillStyle = 'rgba(206,180,125,.65)';
    ctx.ctx.fillRect(-shoulder - 2, -18, 1, 5);
  }
  const arm = side => {
    if ((ped.activity === 'coffee' || ped.activity === 'reading') && side === (fx > 0 ? 1 : -1)) {
      limb([[side * shoulder, -21], [side * (shoulder + 1), -17], [side * 2, -19]], shirt, 2.3);
      ctx.ctx.fillStyle = skin;
      ctx.ctx.fillRect(side * 2 - 1, -20, 2, 2);
      ctx.ctx.fillStyle = ped.activity === 'coffee' ? '#e2d3b3' : '#8b9f91';
      ctx.ctx.fillRect(side * 2 - 1.5, -22, ped.activity === 'coffee' ? 3 : 5, 3.5);
      return;
    }
    if (ped.activity === 'talking' && side === (fx > 0 ? 1 : -1)) {
      const gesture = ctx.env.Math.sin(ctx.env.performance.now() / 350 + index) * 1.2;
      limb([[side * shoulder, -21], [side * (shoulder + 2), -18], [side * (shoulder + 4), -21 + gesture]], shirt, 2.3);
      ctx.ctx.fillStyle = skin;
      ctx.ctx.fillRect(side * (shoulder + 4) - 1, -22 + gesture, 2, 2);
      return;
    }
    if ((ped.activity === 'checkingPhone' || ped.activity === 'checkingTimetable') && side === (fx > 0 ? 1 : -1)) {
      limb([[side * shoulder, -21], [side * (shoulder + 1), -16], [side * 2, -20]], shirt, 2.3);
      ctx.ctx.fillStyle = skin;
      ctx.ctx.fillRect(side * 2 - 1, -21, 2, 2);
      ctx.ctx.fillStyle = '#161b1d';
      ctx.ctx.fillRect(side * 2 - 1, -23, 2.4, 3);
      return;
    }
    if (ped.stance === 'handsUp' || ped.stance === 'fighting') {
      const raised = ped.stance === 'handsUp' || side === (fx > 0 ? 1 : -1);
      const elbowY = raised ? -27 : -24,
        handY = raised ? -31 : -23;
      limb([[side * shoulder, -21], [side * (shoulder + 1.2), elbowY], [side * (shoulder + 2), handY]], shirt, 2.3);
      ctx.ctx.fillStyle = skin;
      ctx.ctx.beginPath();
      ctx.ctx.arc(side * (shoulder + 2), handY, 1.35, 0, ctx.env.Math.PI * 2);
      ctx.ctx.fill();
      return;
    }
    const stride = -swing * side * 2.8;
    limb([[side * shoulder, -21], [side * (shoulder + 1) + fx * stride * .45, -16], [side * (shoulder + .8) + fx * stride, -11 + fy * stride * .4]], shirt, 2.3);
    ctx.ctx.fillStyle = skin;
    ctx.ctx.beginPath();
    ctx.ctx.ellipse(side * (shoulder + .8) + fx * stride, -10.5 + fy * stride * .4, 1.1, 1.5, 0, 0, ctx.env.Math.PI * 2);
    ctx.ctx.fill();
  };
  arm(fx > 0 ? -1 : 1);
  const coat = ctx.ctx.createLinearGradient(-shoulder, -22, shoulder, -12);
  coat.addColorStop(0, shirt);
  coat.addColorStop(.55, shirt);
  coat.addColorStop(1, '#23272a');
  ctx.ctx.fillStyle = coat;
  ctx.ctx.beginPath();
  ctx.ctx.moveTo(-shoulder, -21);
  ctx.ctx.quadraticCurveTo(0, -23, shoulder, -21);
  ctx.ctx.lineTo(3, -10);
  ctx.ctx.lineTo(-3, -10);
  ctx.ctx.closePath();
  ctx.ctx.fill();
  if (!back) {
    limb([[fx, -21], [fx * .6, -11]], 'rgba(12,15,18,.65)', .8);
    limb([[-2, -21], [0, -18], [2, -21]], '#b5a58a', .8);
    ctx.ctx.fillStyle = '#a69778';
    for (const y of [-16, -13]) ctx.ctx.fillRect(fx + .6, y, .7, .7);
  } else limb([[-2.7, -19], [2.7, -19]], 'rgba(12,15,18,.35)', .7);
  if (accessory === 'satchel' || accessory === 'shoulderBag') {
    limb([[-shoulder, -21], [0, -17], [shoulder, -11]], '#70523a', .9);
    ctx.ctx.fillStyle = '#4b382c';
    ctx.ctx.fillRect(shoulder - 1, -15, 3.4, 4.2);
  }
  arm(fx > 0 ? 1 : -1);
  if (ped.activity === 'shopping') {
    ctx.ctx.fillStyle = '#bc9770';
    ctx.ctx.fillRect(shoulder + 1, -12, 4.5, 6);
    ctx.ctx.strokeStyle = '#6e5940';
    ctx.ctx.lineWidth = .7;
    ctx.ctx.strokeRect(shoulder + 2, -14, 2.5, 3);
  }
  ctx.ctx.fillStyle = skin;
  ctx.ctx.fillRect(-1.2, -25, 2.4, 3.5);
  const head = ctx.ctx.createLinearGradient(-2.8, -29, 3, -24);
  head.addColorStop(0, skin);
  head.addColorStop(1, '#80674e');
  ctx.ctx.fillStyle = back ? ped.hair || '#211915' : head;
  ctx.ctx.beginPath();
  ctx.ctx.ellipse(0, -26.5, 2.8 - profile * .35, 3.7, 0, 0, ctx.env.Math.PI * 2);
  ctx.ctx.fill();
  ctx.ctx.fillStyle = ped.hair || '#211915';
  ctx.ctx.beginPath();
  ctx.ctx.ellipse(-fx * .45, -28.3, 2.8, 2, 0, ctx.env.Math.PI, ctx.env.Math.PI * 2);
  ctx.ctx.fill();
  if (!back) {
    ctx.ctx.fillStyle = skin;
    ctx.ctx.fillRect(fx * 2.2, -26.5, 1, 1.5);
    ctx.ctx.fillStyle = '#30271e';
    ctx.ctx.fillRect(fx * 1.3, -27, .7, .7);
  }
  if (accessory === 'cap' || accessory === 'beanie') {
    ctx.ctx.fillStyle = accessory === 'cap' ? '#354044' : '#734b3c';
    ctx.ctx.beginPath();
    ctx.ctx.ellipse(0, -29.2, 3.1, 1.8, 0, ctx.env.Math.PI, ctx.env.Math.PI * 2);
    ctx.ctx.fill();
    ctx.ctx.fillRect(fx > 0 ? -1.7 : -2.8, -29.4, 4.8, 1.2);
  } else if (accessory === 'hood') {
    ctx.ctx.strokeStyle = '#5d5143';
    ctx.ctx.lineWidth = 1.8;
    ctx.ctx.beginPath();
    ctx.ctx.arc(0, -27, 3.6, ctx.env.Math.PI, ctx.env.Math.PI * 2);
    ctx.ctx.stroke();
  } else if (accessory === 'scarf') {
    ctx.ctx.fillStyle = '#b16448';
    ctx.ctx.fillRect(-2.5, -23, 5, 2.3);
    ctx.ctx.fillRect(fx > 0 ? 1 : -2, -22, 1.5, 5);
  } else if (accessory === 'vest') {
    ctx.ctx.strokeStyle = '#e1b447';
    ctx.ctx.lineWidth = 1;
    ctx.ctx.beginPath();
    ctx.ctx.moveTo(-2.2, -20);
    ctx.ctx.lineTo(2.2, -12);
    ctx.ctx.moveTo(2.2, -20);
    ctx.ctx.lineTo(-2.2, -12);
    ctx.ctx.stroke();
  }
  if (index % 6 === 0) {
    ctx.ctx.fillStyle = '#25282b';
    ctx.ctx.fillRect(-3.1, -30, 6.2, 1.8);
    ctx.ctx.fillRect(-2.3, -31.7, 4.6, 2);
  }
  if (index % 5 === 0) {
    limb([[shoulder, -20], [shoulder + 1, -12]], '#201c19', .8);
    ctx.ctx.fillStyle = '#513d2e';
    ctx.ctx.fillRect(shoulder, -13, 3, 5);
    ctx.ctx.strokeStyle = '#907453';
    ctx.ctx.lineWidth = .5;
    ctx.ctx.strokeRect(shoulder, -13, 3, 5);
  }
  if (ped.player) {
    ctx.ctx.strokeStyle = '#e8b84a';
    ctx.ctx.lineWidth = 1;
    ctx.ctx.beginPath();
    ctx.ctx.ellipse(0, 2, 8, 4, 0, 0, ctx.env.Math.PI * 2);
    ctx.ctx.stroke();
  }
  if (ped.medicalTreated) {
    ctx.ctx.fillStyle = '#cbe5e7';
    ctx.ctx.fillRect(-2, -38, 4, 10);
    ctx.ctx.fillRect(-5, -35, 10, 4);
    ctx.ctx.strokeStyle = '#17252b';
    ctx.ctx.lineWidth = .7;
    ctx.ctx.strokeRect(-5, -38, 10, 10);
  }
  if (ped.reaction === 'fleeing' || ped.reaction === 'curious') {
    ctx.ctx.fillStyle = ped.reaction === 'fleeing' ? '#ef6655' : '#f0c46c';
    ctx.ctx.font = 'bold 8px monospace';
    ctx.ctx.textAlign = 'center';
    ctx.ctx.fillText(ped.reaction === 'fleeing' ? '!' : '?', 0, -35);
  }
  ctx.ctx.restore();
};
ctx.drawCityIncidentMarker = function drawCityIncidentMarker(incident) {
  const pulse = 1 + ctx.env.Math.sin(ctx.env.performance.now() / 180) * .13;
  ctx.ctx.save();
  ctx.ctx.translate(incident.x, incident.y);
  ctx.ctx.transform(1 / ctx.env.Math.sqrt(3), -1 / ctx.env.Math.sqrt(3), 1, 1, 0, 0);
  if (incident.kind === 'fire' && !incident.fireSuppressed) {
    const t = ctx.weather.time,
      wind = ctx.weather.gust;
    const glow = ctx.ctx.createRadialGradient(0, -20, 3, 0, -20, 65);
    glow.addColorStop(0, 'rgba(255,163,52,.45)');
    glow.addColorStop(1, 'rgba(255,80,21,0)');
    ctx.ctx.fillStyle = glow;
    ctx.ctx.fillRect(-70, -90, 140, 120);
    for (let i = 0; i < 12; i++) {
      const phase = (t * (.7 + i % 3 * .11) + i * .17) % 1,
        base = (i % 5 - 2) * 9,
        lean = wind * phase * 18 + ctx.env.Math.sin(t * 4 + i) * 3;
      ctx.ctx.fillStyle = i % 2 ? 'rgba(244,100,31,.85)' : 'rgba(255,198,78,.82)';
      ctx.ctx.beginPath();
      ctx.ctx.moveTo(base - 6, -5);
      ctx.ctx.quadraticCurveTo(base - 9 + lean, -20 - phase * 25, base + lean, -30 - phase * 25);
      ctx.ctx.quadraticCurveTo(base + 10 + lean, -17, base + 6, -5);
      ctx.ctx.closePath();
      ctx.ctx.fill();
    }
    for (let i = 0; i < 10; i++) {
      const phase = (t * .24 + i * .13) % 1,
        x = (i % 3 - 1) * 8 + wind * phase * 60,
        y = -25 - phase * 100;
      ctx.ctx.fillStyle = `rgba(43,47,45,${(1 - phase) * .22})`;
      ctx.ctx.beginPath();
      ctx.ctx.ellipse(x, y, 7 + phase * 18, 6 + phase * 13, 0, 0, ctx.env.Math.PI * 2);
      ctx.ctx.fill();
    }
    ctx.ctx.fillStyle = '#ffd06e';
    for (let i = 0; i < 10; i++) {
      const phase = (t * .9 + i * .19) % 1;
      ctx.ctx.globalAlpha = (1 - phase) * .7;
      ctx.ctx.fillRect((i % 4 - 1.5) * 11 + phase * wind * 45, -20 - phase * 70, 1.3, 2.4);
    }
    ctx.ctx.globalAlpha = 1;
    if (ctx.weather.rain > .3) {
      ctx.ctx.fillStyle = 'rgba(218,224,218,.18)';
      for (let i = 0; i < 3; i++) {
        ctx.ctx.beginPath();
        ctx.ctx.arc((i - 1) * 15, -18 - (t * 12 + i * 7) % 24, 7, 0, ctx.env.Math.PI * 2);
        ctx.ctx.fill();
      }
    }
  } else if (incident.kind === 'fire' && incident.fireSuppressed) {
    ctx.ctx.fillStyle = 'rgba(172,190,183,.16)';
    ctx.ctx.beginPath();
    ctx.ctx.ellipse(0, -14, 26, 15, 0, 0, ctx.env.Math.PI * 2);
    ctx.ctx.fill();
    for (let i = 0; i < 4; i++) {
      const drift = ctx.env.Math.sin(ctx.env.performance.now() / 380 + i * 1.4) * 5,
        rise = (ctx.env.performance.now() / 145 + i * 11) % 27;
      ctx.ctx.fillStyle = 'rgba(194,205,196,.38)';
      ctx.ctx.beginPath();
      ctx.ctx.arc((i - 1.5) * 8 + drift, -18 - rise, 4 + i % 2 * 2, 0, ctx.env.Math.PI * 2);
      ctx.ctx.fill();
    }
  }
  ctx.ctx.globalAlpha = .78;
  ctx.ctx.fillStyle = 'rgba(10,13,15,.82)';
  ctx.ctx.strokeStyle = '#e8b84a';
  ctx.ctx.lineWidth = 2;
  ctx.ctx.beginPath();
  ctx.ctx.arc(0, -8, 13 * pulse, 0, ctx.env.Math.PI * 2);
  ctx.ctx.fill();
  ctx.ctx.stroke();
  ctx.ctx.fillStyle = '#f4ede0';
  ctx.ctx.font = 'bold 12px monospace';
  ctx.ctx.textAlign = 'center';
  ctx.ctx.textBaseline = 'middle';
  ctx.ctx.fillText(incident.mark, 0, -8);
  ctx.ctx.fillStyle = '#f0c46c';
  ctx.ctx.font = 'bold 8px monospace';
  ctx.ctx.fillText(incident.title, 0, -27);
  ctx.ctx.restore();
};
ctx.drawDetailedCar = function drawDetailedCar(canvasContext, x, y, ang, color, w, h, isPolice = false, model = 'sedan', lift = 0, vehicle = {}) {
  ctx.drawVehicleAtmosphere(canvasContext, {
    ...vehicle,
    x,
    y,
    angle: ang,
    width: w,
    height: h
  }, lift);
  drawTransport(canvasContext, {
    ...vehicle,
    type: model,
    kind: 'land',
    x,
    y,
    angle: ang,
    color,
    width: w,
    height: h,
    isPolice,
    rain: ctx.weather.rain
  }, ctx.env.performance.now() / 1000, lift);
};
}
