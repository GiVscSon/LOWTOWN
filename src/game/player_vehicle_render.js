const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const isoForward=(iso,x,y,a)=>{const c=iso(x,y),f=iso(x+Math.cos(a)*10,y+Math.sin(a)*10);return Math.atan2(f.y-c.y,f.x-c.x);};

export function drawIsometricCar(ctx,iso,state,{body='#e8b84a',accent='#171a1e',scale=1}={}){
  const p=iso(state.x,state.y), angle=isoForward(iso,state.x,state.y,state.a||0), speed=Math.abs(state.v||0);
  ctx.save();ctx.translate(p.x,p.y);ctx.rotate(angle);
  const L=46*scale,W=24*scale,H=9*scale;
  ctx.fillStyle='rgba(0,0,0,.55)';ctx.beginPath();ctx.ellipse(0,H+5,L*.72,W*.28,0,0,Math.PI*2);ctx.fill();
  ctx.fillStyle='#24282c';ctx.beginPath();ctx.moveTo(-L*.58,-W*.48);ctx.lineTo(L*.58,-W*.48);ctx.lineTo(L*.78,W*.28);ctx.lineTo(L*.56,W*.5);ctx.lineTo(-L*.62,W*.5);ctx.lineTo(-L*.8,W*.15);ctx.closePath();ctx.fill();
  ctx.fillStyle=body;ctx.beginPath();ctx.moveTo(-L*.58,-W*.42);ctx.lineTo(L*.52,-W*.42);ctx.lineTo(L*.7,W*.18);ctx.lineTo(L*.48,W*.38);ctx.lineTo(-L*.55,W*.38);ctx.lineTo(-L*.7,W*.08);ctx.closePath();ctx.fill();
  ctx.strokeStyle=accent;ctx.lineWidth=2*scale;ctx.stroke();
  ctx.fillStyle='#1b2228';ctx.beginPath();ctx.moveTo(-L*.3,-W*.28);ctx.lineTo(L*.18,-W*.28);ctx.lineTo(L*.42,W*.12);ctx.lineTo(-L*.36,W*.12);ctx.closePath();ctx.fill();
  ctx.fillStyle='#727b82';ctx.globalAlpha=.7;ctx.beginPath();ctx.moveTo(-L*.22,-W*.23);ctx.lineTo(L*.1,-W*.23);ctx.lineTo(L*.27,W*.05);ctx.lineTo(-L*.28,W*.05);ctx.closePath();ctx.fill();ctx.globalAlpha=1;
  ctx.fillStyle='#d4523a';ctx.fillRect(-L*.58,W*.2,7*scale,3*scale);ctx.fillStyle='#fff1a7';ctx.fillRect(L*.48,W*.16,6*scale,4*scale);
  ctx.fillStyle='#0a0b0d';ctx.fillRect(-L*.52,-W*.58,12*scale,4*scale);ctx.fillRect(L*.28,-W*.58,12*scale,4*scale);
  if(speed>8){ctx.strokeStyle='rgba(224,154,62,.28)';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(-L*.95,0);ctx.lineTo(-L*1.35,0);ctx.stroke();}
  ctx.restore();
}

/**
 * drawIsometricHelicopter
 *
 * state fields used:
 *   x, y          — world position
 *   a             — heading (radians)
 *   z             — altitude (0 = ground, positive = up)
 *   vx, vy        — velocity (for shadow offset)
 *   strafe        — lateral input [-1..1] for visual tilt
 *   rotorAngle    — accumulated rotor spin (radians), caller must increment each frame
 *
 * options:
 *   body          — fuselage colour  (default military olive)
 *   accent        — detail colour
 *   rotorColor    — blade colour
 *   scale         — uniform scale multiplier
 */
export function drawIsometricHelicopter(ctx, iso, state, {
  body        = '#5a6e3a',
  accent      = '#2a2e1e',
  rotorColor  = '#1a1d13',
  scale       = 1,
} = {}) {
  const alt      = Math.max(0, state.z || 0);
  const strafe   = clamp(state.strafe || 0, -1, 1);
  const rotor    = state.rotorAngle || 0;

  // isometric projected position
  const p        = iso(state.x, state.y);
  const angle    = isoForward(iso, state.x, state.y, state.a || 0);

  // altitude lifts the sprite on screen; shadow stays on ground
  const liftY    = alt * 0.18;           // pixels above ground per unit altitude
  const shadowAlpha = Math.max(0.08, 0.55 - alt * 0.0005);
  const shadowScaleX = 1 + alt * 0.0008; // shadow grows as heli climbs

  // ── GROUND SHADOW ──────────────────────────────────────────────
  ctx.save();
  ctx.translate(p.x + (state.vx || 0) * 0.4, p.y + (state.vy || 0) * 0.15);
  ctx.rotate(angle);
  ctx.globalAlpha = shadowAlpha;
  ctx.fillStyle   = '#000';
  ctx.beginPath();
  ctx.ellipse(0, 0, 38 * scale * shadowScaleX, 14 * scale, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;
  ctx.restore();

  // ── HELICOPTER BODY (lifted by altitude) ───────────────────────
  ctx.save();
  ctx.translate(p.x, p.y - liftY);
  ctx.rotate(angle);

  // lateral tilt from strafe: shear the draw slightly
  const tiltShear = strafe * 0.18;
  ctx.transform(1, tiltShear, 0, 1, 0, 0);

  const L = 52 * scale;
  const W = 18 * scale;

  // --- tail boom ---
  ctx.fillStyle = accent;
  ctx.beginPath();
  ctx.moveTo(-L * 0.18, -W * 0.22);
  ctx.lineTo(-L * 0.90, -W * 0.08);
  ctx.lineTo(-L * 0.90,  W * 0.08);
  ctx.lineTo(-L * 0.18,  W * 0.22);
  ctx.closePath();
  ctx.fill();

  // --- tail rotor (small circle at boom end) ---
  ctx.save();
  ctx.translate(-L * 0.92, 0);
  ctx.strokeStyle = rotorColor;
  ctx.lineWidth   = 1.5 * scale;
  // two blades at right angles
  for (let i = 0; i < 2; i++) {
    ctx.save();
    ctx.rotate(rotor * 3.5 + i * Math.PI / 2); // faster spin than main
    ctx.beginPath();
    ctx.moveTo(0, -W * 0.55);
    ctx.lineTo(0,  W * 0.55);
    ctx.stroke();
    ctx.restore();
  }
  ctx.restore();

  // --- fuselage (main body) ---
  ctx.fillStyle = body;
  ctx.beginPath();
  ctx.moveTo(-L * 0.20, -W * 0.50);
  ctx.lineTo( L * 0.38, -W * 0.50);
  ctx.quadraticCurveTo(L * 0.62, -W * 0.30, L * 0.62,  0);
  ctx.quadraticCurveTo(L * 0.62,  W * 0.30, L * 0.38,  W * 0.50);
  ctx.lineTo(-L * 0.20,  W * 0.50);
  ctx.quadraticCurveTo(-L * 0.44, W * 0.28, -L * 0.44, 0);
  ctx.quadraticCurveTo(-L * 0.44,-W * 0.28,-L * 0.20, -W * 0.50);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = accent;
  ctx.lineWidth   = 1.5 * scale;
  ctx.stroke();

  // --- cockpit glass ---
  ctx.fillStyle   = '#a8d8f0';
  ctx.globalAlpha = 0.75;
  ctx.beginPath();
  ctx.moveTo(L * 0.14, -W * 0.35);
  ctx.lineTo(L * 0.52, -W * 0.18);
  ctx.lineTo(L * 0.52,  W * 0.18);
  ctx.lineTo(L * 0.14,  W * 0.35);
  ctx.closePath();
  ctx.fill();
  ctx.globalAlpha = 1;

  // --- skids (landing gear) ---
  ctx.strokeStyle = accent;
  ctx.lineWidth   = 2 * scale;
  // left skid
  ctx.beginPath();
  ctx.moveTo(-L * 0.28, -W * 0.68);
  ctx.lineTo( L * 0.40, -W * 0.68);
  ctx.stroke();
  // right skid
  ctx.beginPath();
  ctx.moveTo(-L * 0.28,  W * 0.68);
  ctx.lineTo( L * 0.40,  W * 0.68);
  ctx.stroke();
  // struts
  for (const sx of [-0.12, 0.26]) {
    for (const side of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(L * sx, W * 0.50 * side);
      ctx.lineTo(L * sx, W * 0.68 * side);
      ctx.stroke();
    }
  }

  // ── MAIN ROTOR (drawn on top, above fuselage) ─────────────────
  const rR      = 44 * scale; // rotor radius
  const nBlades = 4;
  ctx.strokeStyle = rotorColor;
  ctx.lineWidth   = 3.5 * scale;
  ctx.lineCap     = 'round';
  for (let i = 0; i < nBlades; i++) {
    const bAngle = rotor + (i * Math.PI * 2) / nBlades;
    const bx     = Math.cos(bAngle) * rR;
    const by     = Math.sin(bAngle) * rR * 0.38; // iso flattening
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(bx, by);
    ctx.stroke();
  }
  // rotor hub
  ctx.fillStyle = accent;
  ctx.beginPath();
  ctx.arc(0, 0, 4 * scale, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}
