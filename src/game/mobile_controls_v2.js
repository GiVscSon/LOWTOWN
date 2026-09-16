// Mobile controls v2 - Ergonomic split layout
// Left hand: Steer Left/Right
// Right hand: Gas / Brake-Reverse

const setKey = (code, down) => {
  window.dispatchEvent(new KeyboardEvent(down ? 'keydown' : 'keyup', { code, bubbles: true }));
};

const releaseDrive = () => {
  setKey('ArrowUp', false);
  setKey('ArrowDown', false);
  setKey('ArrowLeft', false);
  setKey('ArrowRight', false);
};

export function setupMobileControlsV2() {
  if (typeof document === 'undefined') return;
  const existing = document.querySelector('.lowtown-mobile-pad');
  if (existing) existing.remove();

  const root = document.createElement('div');
  root.className = 'lowtown-mobile-pad mobile-arrow-pad';
  root.innerHTML = `
    <div class="mobile-steer-cluster">
      <button class="mobile-btn" data-key="ArrowLeft" aria-label="Steer Left">◀</button>
      <button class="mobile-btn" data-key="ArrowRight" aria-label="Steer Right">▶</button>
    </div>
    <div class="mobile-pedal-cluster">
      <button class="mobile-btn" data-key="ArrowUp" aria-label="Accelerate">▲</button>
      <button class="mobile-btn" data-key="ArrowDown" aria-label="Brake/Reverse">▼</button>
    </div>
    <div style="display:none">
      <button data-mobile="ai"></button>
      <button data-mobile="reset"></button>
    </div>
  `;

  const bind = (btn) => {
    const key = btn.getAttribute('data-key');
    if (!key) return;
    const start = (e) => { e.preventDefault(); btn.classList.add('active'); setKey(key, true); };
    const stop = (e) => { e.preventDefault(); btn.classList.remove('active'); setKey(key, false); };
    btn.addEventListener('pointerdown', start);
    btn.addEventListener('pointerup', stop);
    btn.addEventListener('pointercancel', stop);
    btn.addEventListener('pointerleave', stop);
  };

  root.querySelectorAll('.mobile-btn').forEach(bind);

  // Top action bar handlers
  const aiBtn = document.querySelector('[data-mobile="ai"]') || root.querySelector('[data-mobile="ai"]');
  if (aiBtn) {
    aiBtn.addEventListener('click', () => {
      if (window.__LOWTOWN_AI?.state) {
        let ai = window.__LOWTOWN_AI.state.active;
        ai = !ai;
        window.__LOWTOWN_AI.state.active = ai;
      }
    });
  }

  const resetBtn = document.querySelector('[data-mobile="reset"]') || root.querySelector('[data-mobile="reset"]');
  if (resetBtn) {
    resetBtn.addEventListener('click', () => {
      releaseDrive();
      if (typeof window.__LOWTOWN_RESET === 'function') window.__LOWTOWN_RESET();
    });
  }

  document.body.appendChild(root);
}

if (typeof window !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', setupMobileControlsV2);
  } else {
    setupMobileControlsV2();
  }
}
