export function createMobileControlsV2(){
  const root=document.createElement('div');
  root.className='lowtown-mobile-controls';
  root.innerHTML='<div class="mobile-arrow-pad" aria-label="Управление машиной"><button class="mobile-arrow up" data-key="ArrowUp" aria-label="Вперёд">▲</button><button class="mobile-arrow left" data-key="ArrowLeft" aria-label="Влево">◀</button><button class="mobile-arrow down" data-key="ArrowDown" aria-label="Назад">▼</button><button class="mobile-arrow right" data-key="ArrowRight" aria-label="Вправо">▶</button></div><div class="mobile-actions"><button class="mobile-btn mobile-ai" data-mobile="ai">AI: OFF</button><button class="mobile-btn" data-mobile="reset">RESET</button></div>';
  const action=()=>window.__LOWTOWN_ACTIONS__;
  const held=new Set();