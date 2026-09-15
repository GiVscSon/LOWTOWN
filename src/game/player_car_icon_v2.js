const CAR_W = 76;
const CAR_H = 42;

function drawPlayerCarIcon() {
  const canvas = document.querySelector('#game');
  const transport = window.__LOWTOWN_TRANSPORT?.player?.state;
  if (!canvas || !transport) {
    requestAnimationFrame(drawPlayerCarIcon);
    return;
  }

  const ctx = canvas.getContext('2d');
  const w = canvas.clientWidth;
  const h = canvas.clientHeight;
  const speed = Math.hypot(transport.vx || 0, transport.vy || 0);
  const angle = Math.atan2(
    Math.sin(transport.a || 0) - Math.cos(transport.a || 0),
    Math.cos(transport.a || 0) + Math.sin(transport.a || 0)
  );

  ctx.save();
  ctx.translate(w * 0.5, h * 0.5);
  ctx.rotate(angle);

  // Ground shadow
  ctx.fillStyle = 'rgba(0,0,0,.58)';
  ctx.beginPath();
  ctx.ellipse(0, 11, 39, 10, 0, 0, Math.PI * 2);
  ctx.fill();

  // Wheels
  ctx.fillStyle = '#090b0d';
  for (const x of [-25, 25]) {
    ctx.beginPath();
    ctx.roundRect(x - 5, -18, 10, 36, 4);
    ctx.fill();
  }

  // Lower body
  ctx.fillStyle = '#a87422';
  ctx.strokeStyle = '#080a0c';
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.roundRect(-36, -13, 72, 26, 8);
  ctx.fill();
  ctx.stroke();

  // Yellow upper body and hood/trunk
  ctx.fillStyle = '#e8b84a';
  ctx.beginPath();
  ctx.moveTo(-31, -11);
  ctx.lineTo(-17, -16);
  ctx.lineTo(16, -16);
  ctx.lineTo(31, -8);
  ctx.lineTo(28, 9);
  ctx.lineTo(-28, 9);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // Cabin glass
  ctx.fillStyle = '#182027';
  ctx.beginPath();
  ctx.moveTo(-14, -12);
  ctx.lineTo(10, -12);
  ctx.lineTo(22, -4);
  ctx.lineTo(17, 5);
  ctx.lineTo(-19, 5);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = '#4b555d';
  ctx.lineWidth = 1.2;
  ctx.stroke();

  // Window divider
  ctx.strokeStyle = '#0b0e11';
  ctx.beginPath();
  ctx.moveTo(0, -12);
  ctx.lineTo(-1, 5);
  ctx.stroke();

  // Front grille
  ctx.fillStyle = '#15191d';
  ctx.fillRect(26, -5, 6, 10);
  ctx.fillStyle = '#d9dfe1';
  ctx.fillRect(28, -2, 4, 1);
  ctx.fillRect(28, 2, 4, 1);

  // Headlights
  ctx.fillStyle = '#fff1a7';
  ctx.fillRect(30, -10, 5, 5);
  ctx.fillRect(30, 5, 5, 5);

  // Tail lights
  ctx.fillStyle = '#d4523a';
  ctx.fillRect(-35, -10, 6, 5);
  ctx.fillRect(-35, 5, 6, 5);

  // Roof highlight and center stripe
  ctx.fillStyle = 'rgba(255,241,167,.45)';
  ctx.fillRect(-11, -14, 18, 2);
  ctx.fillStyle = 'rgba(255,255,255,.12)';
  ctx.fillRect(-1, -9, 2, 16);

  // Player marker, deliberately small so it reads as a vehicle marker, not a waypoint
  ctx.fillStyle = '#e09a3e';
  ctx.beginPath();
  ctx.moveTo(0, -31);
  ctx.lineTo(-6, -23);
  ctx.lineTo(6, -23);
  ctx.closePath();
  ctx.fill();

  if (speed > 20) {
    ctx.fillStyle = 'rgba(224,154,62,.22)';
    ctx.beginPath();
    ctx.ellipse(-37, 0, 10 + Math.min(10, speed * .02), 7, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.restore();
  requestAnimationFrame(drawPlayerCarIcon);
}

requestAnimationFrame(drawPlayerCarIcon);
