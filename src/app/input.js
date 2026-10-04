// One shared runtime context owns state; this system has no hidden globals.
export function installAppInput(ctx) {
  ctx.isGamePaused = function isGamePaused() {
    return ctx.state.isMenuOpen || ctx.state.isMapOpen || ctx.state.isGarageOpen;
  };
  ctx.clearGameInput = function clearGameInput() {
    for (const {
      button,
      pointers
    } of ctx.drivePointerSets) {
      for (const id of pointers) if (button.hasPointerCapture?.(id)) button.releasePointerCapture?.(id);
      pointers.clear();
    }
    Object.keys(ctx.state.keys).forEach(key => ctx.state.keys[key] = false);
    ctx.env.document.querySelectorAll('.btn-drive').forEach(button => button.classList.remove('active'));
    ctx.player.attackHeld = ctx.player.jumpHeld = ctx.player.attackRequested = ctx.player.jumpRequested = false;
    ctx.accumulator = 0;
    ctx.lastSimulationTime = ctx.env.performance.now();
    ctx.state.lastFrameTime = ctx.env.performance.now();
  };
  ctx.syncGamePause = function syncGamePause() {
    const paused = ctx.isGamePaused(),
      now = ctx.env.performance.now();
    if (paused && ctx.state.pauseStarted === null) ctx.state.pauseStarted = now;else if (!paused && ctx.state.pauseStarted !== null) {
      ctx.state.pausedDuration += now - ctx.state.pauseStarted;
      ctx.state.pauseStarted = null;
      // Present the dismissed overlay before submitting the next world frame.
      // Physics resumes immediately on its independent fixed clock.
      ctx.lastGameRenderTime = now + 80;
    }
    ctx.clearGameInput();
    ctx.env.window.__lowtownRenderPaused = paused;
    ctx.sound.setPaused(paused);
  };
  ctx.setupInputListeners = function setupInputListeners() {
    // Browsers require a real gesture; any mouse/touch interaction unlocks radio.
    ctx.listen(ctx.env.window, 'pointerdown', () => ctx.sound.init(), {passive:true});
    ctx.listen(ctx.env.window, 'keydown', e => {
      if (e.code === 'Escape') {
        e.preventDefault();
        if (e.repeat) return;
        if (ctx.state.isMapOpen) ctx.toggleMap();else if (ctx.state.isGarageOpen) ctx.toggleGarage();else ctx.gameMenu?.escape();
        return;
      }
      if (ctx.isGamePaused()) {
        if (!e.repeat && e.code === 'KeyM' && ctx.state.isMapOpen) ctx.toggleMap();
        if (!e.repeat && e.code === 'KeyG' && ctx.state.isGarageOpen) ctx.toggleGarage();
        return;
      }
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) e.preventDefault();
      if (ctx.state.custodyTimer > 0) return;
      if (ctx.driveLab?.running) return;
      ctx.sound.init();
      if (e.code === 'KeyE' && !e.repeat) ctx.roam?.interact();
      if (e.code === 'KeyF' && !e.repeat) {ctx.state.keys.attack = true;ctx.player.attackRequested=true;}
      if (e.code === 'KeyQ' && !e.repeat) {if(ctx.roam?.mode==='foot')ctx.cycleWeapon();else ctx.roam?.toggleFlight();}
      if (e.code === 'KeyT' && !e.repeat && ctx.roam?.mode==='foot') ctx.reloadWeapon();
      if (/^Digit[1-5]$/.test(e.code) && !e.repeat && ctx.roam?.mode==='foot') ctx.selectWeapon(['fists','bat','pistol','shotgun','flare'][Number(e.code.at(-1))-1]);
      if (e.code === 'KeyW' || e.code === 'ArrowUp') ctx.state.keys.up = true;
      if (e.code === 'KeyS' || e.code === 'ArrowDown') ctx.state.keys.down = true;
      if (e.code === 'KeyA' || e.code === 'ArrowLeft') ctx.state.keys.left = true;
      if (e.code === 'KeyD' || e.code === 'ArrowRight') ctx.state.keys.right = true;
      if (e.code === 'Space') {ctx.state.keys.handbrake=true;if(!e.repeat&&ctx.roam?.mode==='foot')ctx.player.jumpRequested=true;}
      if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') ctx.state.keys.nitro = true;
      if (e.code === 'KeyM' && !e.repeat) ctx.toggleMap();
      if (e.code === 'KeyG' && !e.repeat) ctx.toggleGarage();
      if (e.code === 'KeyR' && !e.repeat) {
        const st = ctx.sound.nextStation();
        ctx.showToast(st);
      }
    });
    ctx.listen(ctx.env.window, 'keyup', e => {
      if (e.code === 'KeyW' || e.code === 'ArrowUp') ctx.state.keys.up = false;
      if (e.code === 'KeyS' || e.code === 'ArrowDown') ctx.state.keys.down = false;
      if (e.code === 'KeyA' || e.code === 'ArrowLeft') ctx.state.keys.left = false;
      if (e.code === 'KeyD' || e.code === 'ArrowRight') ctx.state.keys.right = false;
      if (e.code === 'KeyF') ctx.state.keys.attack = false;
      if (e.code === 'Space') ctx.state.keys.handbrake = false;
      if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') ctx.state.keys.nitro = false;
    });
    function bindDriveButton(elementId, keyName) {
      const btn = ctx.env.document.getElementById(elementId);
      if (!btn) return;
      const onPress = e => {
        if (e.cancelable) e.preventDefault();
        if (ctx.isGamePaused()) return;
        if (ctx.state.custodyTimer > 0) return;
        ctx.sound.init();
        ctx.state.keys[keyName] = true;
        if(ctx.roam?.mode==='foot'){if(keyName==='nitro'){ctx.state.keys.attack=true;ctx.player.attackRequested=true;}if(keyName==='handbrake')ctx.player.jumpRequested=true;}
        btn.classList.add('active');
        if (ctx.env.navigator.vibrate) ctx.env.navigator.vibrate(10);
      };
      const onRelease = e => {
        if (e.cancelable) e.preventDefault();
        ctx.state.keys[keyName] = false;
        if (keyName === 'nitro') ctx.state.keys.attack = false;
        btn.classList.remove('active');
      };
      if (ctx.env.window.PointerEvent) {
        const pointers = new Set();
        ctx.drivePointerSets.push({
          button: btn,
          pointers
        });
        ctx.listen(btn, 'pointerdown', e => {
          if (ctx.isGamePaused()) return;
          pointers.add(e.pointerId);
          btn.setPointerCapture?.(e.pointerId);
          onPress(e);
        });
        const release = e => {
          pointers.delete(e.pointerId);
          if (!pointers.size) onRelease(e);
        };
        ctx.listen(btn, 'pointerup', release);
        ctx.listen(btn, 'pointercancel', release);
        ctx.listen(btn, 'lostpointercapture', release);
      } else {
        ctx.listen(btn, 'touchstart', onPress, {
          passive: false
        });
        const release = e => {
          if (!e.targetTouches?.length) onRelease(e);
        };
        ctx.listen(btn, 'touchend', release, {
          passive: false
        });
        ctx.listen(btn, 'touchcancel', release, {
          passive: false
        });
        ctx.listen(btn, 'pointerdown', e => {
          if (e.pointerType === 'mouse') onPress(e);
        });
        ctx.listen(btn, 'pointerup', e => {
          if (e.pointerType === 'mouse') onRelease(e);
        });
        ctx.listen(btn, 'pointerleave', e => {
          if (e.pointerType === 'mouse') onRelease(e);
        });
      }
    }
    bindDriveButton('btnGas', 'up');
    bindDriveButton('btnBrake', 'down');
    bindDriveButton('btnLeft', 'left');
    bindDriveButton('btnRight', 'right');
    bindDriveButton('btnHandbrake', 'handbrake');
    bindDriveButton('btnNitro', 'nitro');
    ctx.listen(ctx.env.window, 'blur', ctx.clearGameInput);
    ctx.listen(ctx.env.document, 'visibilitychange', ctx.clearGameInput);
    ctx.listen(ctx.env.window, 'mouseup', () => {
      ctx.state.keys.up = false;
      ctx.state.keys.down = false;
      ctx.state.keys.left = false;
      ctx.state.keys.right = false;
      ctx.state.keys.handbrake = false;
      ctx.state.keys.nitro = false;
      ctx.state.keys.attack = false;
      ctx.env.document.querySelectorAll('.btn-drive').forEach(b => b.classList.remove('active'));
    });
    ctx.listen(ctx.env.document.getElementById('btnOpenMap'), 'click', ctx.toggleMap);
    ctx.listen(ctx.env.document.getElementById('radarContainer'), 'click', ctx.toggleMap);
    ctx.listen(ctx.env.document.getElementById('btnCloseMap'), 'click', ctx.toggleMap);
    ctx.listen(ctx.env.document.getElementById('btnOpenGarage'), 'click', ctx.toggleGarage);
    ctx.listen(ctx.env.document.getElementById('btnCloseGarage'), 'click', ctx.toggleGarage);
    ctx.listen(ctx.env.document.getElementById('btnRadio'), 'click', () => {
      ctx.sound.init();
      const st = ctx.sound.nextStation();
      ctx.showToast(st);
    });
    ctx.listen(ctx.env.document.getElementById('btnRepairCar'), 'click', () => {
      if (ctx.state.cash >= 80) {
        ctx.state.cash -= 80;
        ctx.player.hp = 100;
      ctx.player.damage = undefined;
        ctx.state.wanted = 0;
        ctx.state.wantedCooldown = 0;
        ctx.state.evading = false;
        ctx.releaseWantedPolice();
        ctx.state.tacticalCallDispatched = false;
        ctx.state.guardCallDispatched = false;
        ctx.showToast('🔧 МАШИНА ПОЛНОСТЬЮ ВОССТАНОВЛЕНА!');
        ctx.autoSaveProgress();
      } else {
        ctx.showToast('❌ НЕ ХВАТАЕТ ДЕНЕГ ($80)!');
      }
    });
  };
}
