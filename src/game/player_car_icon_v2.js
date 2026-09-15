const CAR_W = 92;
const CAR_H = 52;

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

  // Soft contact shadow on wet asphalt.
  ctx.fillStyle = 'rgba(0,0,0,.66)';
  ctx.beginPath();
  ctx.ellipse(-1, 14, 46, 12, 0, 0, Math.PI * 2);
  ctx.fill();

  // Warm reflected light under the car.
  ctx.fillStyle = 'rgba(224,154,62,.13)';
  ctx.beginPath();
  ctx.ellipse(6, 15, 38, 7, 0, 0, Math.PI * 2);
  ctx.fill();

  // Wheels and dark wheel arches.
  ctx.fillStyle = '#07090b';
  for (const x of [-29, 29]) {
    ctx.beginPath();
    ctx.roundRect(x - 6, -19, 12, 39, 4);
    ctx.fill();
  }

  // Lower bumper / rocker section gives the silhouette more mass.
  ctx.fillStyle = '#8c641f';
  ctx.strokeStyle = '#07090b';
  ctx.lineWidth = 2.6;
  ctx.beginPath();
  ctx.moveTo(-40, -11);
  ctx.lineTo(-34, -17);
  ctx.lineTo(29, -17);
  ctx.lineTo(41, -7);
  ctx.lineTo(38, 10);
  ctx.lineTo(27, 16);
  ctx.lineTo(-33, 16);
  ctx.lineTo(-41, 8);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // Main yellow body with hood, shoulders and rear deck.
  ctx.fillStyle = '#e8b84a';
  ctx.beginPath();
  ctx.moveTo(-35, -10);
  ctx.lineTo(-22, -18);
  ctx.lineTo(18, -18);
  ctx.lineTo(34, -8);
  ctx.lineTo(31, 10);
  ctx.lineTo(23, 13);
  ctx.lineTo(-28, 13);
  ctx.lineTo(-36, 6);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // Bright hood plane catches the sodium streetlight.
  ctx.fillStyle = 'rgba(255,241,167,.20)';
  ctx.beginPath();
  ctx.moveTo(15, -15);
  ctx.lineTo(32, -7);
  ctx.lineTo(27, 3);
  ctx.lineTo(9, 1);
  ctx.closePath();
  ctx.fill();

  // Cabin, split windshield and side glass.
  ctx.fillStyle = '#12191e';
  ctx.beginPath();
  ctx.moveTo(-17, -14);
  ctx.lineTo(9, -14);
  ctx.lineTo(24, -5);
  ctx.lineTo(18, 6);
  ctx.lineTo(-22, 6);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = '#56616a';
  ctx.lineWidth = 1.3;
  ctx.stroke();

  ctx.fillStyle = 'rgba(118,132,141,.28)';
  ctx.beginPath();
  ctx.moveTo(-13, -11);
  ctx.lineTo(-1, -11);
  ctx.lineTo(-2, 3);
  ctx.lineTo(-18, 3);
  ctx.closePath();
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(2, -11);
  ctx.lineTo(8, -11);
  ctx.lineTo(20, -4);
  ctx.lineTo(16, 3);
  ctx.lineTo(1, 3);
  ctx.closePath();
  ctx.fill();

  // Window pillar.
  ctx.strokeStyle = '#080b0e';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(0, -14);
  ctx.lineTo(-1, 5);
  ctx.stroke();

  // Front grille and bumper detail.
  ctx.fillStyle = '#111519';
  ctx.fillRect(31, -6, 8, 12);
  ctx.fillStyle = '#9ba1a4';
  ctx.fillRect(34, -3, 4, 1);
  ctx.fillRect(34, 0, 4, 1);
  ctx.fillRect(34, 3, 4, 1);

  // Headlights.
  ctx.fillStyle = '#fff1a7';
  ctx.shadowColor = 'rgba(255,241,167,.65)';
  ctx.shadowBlur = 7;
  ctx.fillRect(31, -11, 6, 5);
  ctx.fillRect(31, 6, 6, 5);
  ctx.shadowBlur = 0;

  // Rear lamps.
  ctx.fillStyle = '#d4523a';
  ctx.fillRect(-38, -10, 7, 5);
  ctx.fillRect(-38, 6, 7, 5);

  // Thin chrome beltline and roof highlight.
  ctx.strokeStyle = 'rgba(255,241,167,.42)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(-22, 8);
  ctx.lineTo(25, 8);
  ctx.stroke();
  ctx.fillStyle = 'rgba(255,241,167,.48)';
  ctx.fillRect(-12, -17, 19, 2);

  // Small roof aerial for a distinctly 90s silhouette.
  ctx.strokeStyle = '#111519';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(-7, -17);
  ctx.lineTo(-12, -24);
  ctx.stroke();

  // Subtle center reflection.
  ctx.fillStyle = 'rgba(255,255,255,.10)';
  ctx.fillRect(-1, -9, 2, 17);

  // Tiny player marker, kept close to the roof so it reads as an in-world cue.
  ctx.fillStyle = '#e09a3e';
  ctx.beginPath();
  ctx.moveTo(0, -34);
  ctx.lineTo(-6, -25);
  ctx.lineTo(6, -25);
  ctx.closePath();
  ctx.fill();

  // Speed streak and red rear glow at higher velocity.
  if (speed > 20) {
    ctx.strokeStyle = 'rgba(224,154,62,.30)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-42, -3);
    ctx.lineTo(-57, -5);
    ctx.moveTo(-43, 4);
    ctx.lineTo(-55, 7);
    ctx.stroke();
  }

  ctx.restore();
  requestAnimationFrame(drawPlayerCarIcon);
}

requestAnimationFrame(drawPlayerCarIcon);
