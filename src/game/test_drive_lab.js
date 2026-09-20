const route = [
  {x:1265,y:1200},{x:2065,y:1200},{x:2065,y:515},{x:1265,y:515},
  {x:1265,y:4135},{x:2065,y:4135},{x:2065,y:5015},{x:1265,y:5015},{x:1265,y:1200}
];
const routeLegs = route.length - 1;

export function createDriveLab({player,state,canvas,buildings,trafficCars,policeCars,routeInput,roam}) {
  const panel = document.createElement('section');
  panel.id = 'driveLab';
  panel.innerHTML = `<div class="lab-heading"><h1>LOWTOWN</h1><button id="labToggle" class="secondary" aria-label="Свернуть панель">−</button></div><small>PRIVATE TEST DRIVE · 1994</small>
    <div class="lab-actions"><button id="labRun">Автотест</button><button class="secondary" id="labReset">На старт</button></div>
    <div id="labStatus" role="status">Свободная поездка</div><div id="labMetrics"></div>
    <details><summary>Управление и проверки</summary><p>WASD / стрелки — газ, задний ход и руль. Пробел — ручник. На телефоне — кнопки внизу. M — карта.</p><p>Автотест ведёт машину по восьми участкам через северный и южный городские пояса. Трафик на время отключён. Проверяются кадры, направление, скольжение, мосты, повороты и столкновения.</p><p>Проверка изображения эвристическая: она не заменяет визуальный просмотр всех артефактов.</p></details>`;
  document.body.append(panel);
  const status = panel.querySelector('#labStatus'), metrics = panel.querySelector('#labMetrics');
  let running=false, steps=0, frames=0, waypoint=1, prev, saved, sampleCanvas=document.createElement('canvas');
  let issues=new Set(), maxSlip=0, distance=0, lastFrame=0, lastUi=0, lastSample=0, turns=0, lastAngle=0;
  sampleCanvas.width=32; sampleCanvas.height=24;
  const sampleCtx=sampleCanvas.getContext('2d',{willReadFrequently:true});
  const clear=()=>Object.keys(state.keys).forEach(k=>state.keys[k]=false);
  function reset() {
    Object.assign(player,{x:1265,y:1200,angle:0,vx:0,vy:0,speed:0,hp:100});
    Object.assign(state,{isDrowning:false,drownProgress:0,wanted:0,invulnTimer:180,isMapOpen:false,isGarageOpen:false});
    for(const id of ['mapModal','garageModal']) document.getElementById(id).style.display='none';
    clear();
  }
  if (window.matchMedia?.('(max-width: 700px), (pointer: coarse)').matches) panel.dataset.collapsed='true';
  panel.querySelector('#labToggle').addEventListener('click',()=>{
    panel.dataset.collapsed=panel.dataset.collapsed==='true'?'false':'true';
    panel.querySelector('#labToggle').textContent=panel.dataset.collapsed==='true'?'+':'−';
  });
  function stop(label) {
    running=false; clear(); player.speed=player.vx=player.vy=0;
    if(saved) {trafficCars.push(...saved.traffic); policeCars.push(...saved.police); if(roam?.fleet)roam.fleet.push(...saved.fleet); saved=null;}
    panel.querySelector('#labRun').textContent='Автотест';
    status.textContent=label;
    panel.dataset.result=issues.size ? 'fail' : (label.startsWith('Пройден') ? 'pass' : 'stopped');
    updateUi();
  }
  function updateUi() {
    metrics.textContent=running || steps ? `Маршрут: ${Math.min(waypoint,routeLegs)}/${routeLegs} · ${(steps/60).toFixed(1)} с\nПуть: ${distance.toFixed(0)} ед. · кадры: ${frames}\nМакс. скольжение: ${maxSlip.toFixed(1)}°\nОшибки: ${issues.size}${issues.size?'\n'+[...issues].join('\n'):''}` : 'Расширенный город · свободный руль';
  }
  function start() {
    if(running) {stop('Остановлен');return;}
    reset(); steps=frames=0;waypoint=1;maxSlip=distance=turns=0;issues=new Set();lastAngle=0;
    saved={traffic:trafficCars.splice(0),police:policeCars.splice(0),fleet:roam?.fleet?.splice(0)||[]};
    running=true;panel.dataset.result='running';panel.dataset.collapsed='false';status.textContent='Автотест: едем по маршруту';
    panel.querySelector('#labRun').textContent='Стоп';updateUi();
  }
  panel.querySelector('#labRun').addEventListener('click',start);
  panel.querySelector('#labReset').addEventListener('click',()=>{if(running)stop('Остановлен');reset();steps=0;issues.clear();status.textContent='Свободная поездка';updateUi();});
  function inspectPixels() {
    sampleCtx.drawImage(canvas,0,0,32,24);
    const data=sampleCtx.getImageData(0,0,32,24).data;
    let white=0,opaque=0;const colors=new Set();
    for(let i=0;i<data.length;i+=4){if(data[i]>245&&data[i+1]>245&&data[i+2]>245)white++;if(data[i+3])opaque++;colors.add(`${data[i]>>4},${data[i+1]>>4},${data[i+2]>>4}`);}
    if(white>740||opaque<20||colors.size<3)issues.add('Пустой/однотонный кадр');
  }
  updateUi();
  return {
    get running(){return running;},
    beforeStep(){
      if(!running)return;
      if(Math.hypot(player.x-route[waypoint].x,player.y-route[waypoint].y)<42) {
        waypoint++;
        if(waypoint===route.length){if(turns<5)issues.add('Не выполнены повороты');stop(issues.size?'Тест: обнаружены проблемы':`Пройдено: ${routeLegs} участков`);return;}
      }
      prev={x:player.x,y:player.y,angle:player.angle};
      Object.assign(state.keys,routeInput(player,route[waypoint]));
    },
    afterStep(){
      if(!running)return;steps++;
      const dx=player.x-prev.x,dy=player.y-prev.y,moved=Math.hypot(dx,dy);distance+=moved;
      if(![player.x,player.y,player.angle,player.vx,player.vy].every(Number.isFinite))issues.add('Некорректная геометрия (NaN)');
      if(moved>0.3&&player.speed>0.3){
        const forward=dx*Math.cos(player.angle)+dy*Math.sin(player.angle);
        const lateral=-dx*Math.sin(player.angle)+dy*Math.cos(player.angle);
        const slip=Math.abs(Math.atan2(lateral,forward))*180/Math.PI;
        maxSlip=Math.max(maxSlip,slip);
        if(forward<0)issues.add('Движение против носа машины');
        if(slip>18)issues.add('Избыточное боковое скольжение');
      }
      if(Math.abs(player.angle-lastAngle)>1.2){turns++;lastAngle=player.angle;}
      const da=player.angle-prev.angle;
      if((state.keys.left&&da>0.001)||(state.keys.right&&da< -0.001))issues.add('Перепутан знак поворота');
      if(moved>15)issues.add('Скачок положения');
      if(state.isDrowning)issues.add('Маршрут вышел в воду');
      if(buildings.some(b=>player.x>b.x-15&&player.x<b.x+b.w+15&&player.y>b.y-15&&player.y<b.y+b.h+15))issues.add('Маршрут задел здание');
      if(steps>6000){issues.add('Маршрут не завершён за 100 с');stop('Тест: превышено время');}
    },
    afterFrame(){
      const now=performance.now();
      if(running){frames++;if(lastFrame&&now-lastFrame>2000)issues.add('Зависание кадра >2 с');if(now-lastSample>500){inspectPixels();lastSample=now;}if(now-lastUi>200){updateUi();lastUi=now;}}
      lastFrame=now;
    },
    fail(message){issues.add(message);if(running)stop('Тест: ошибка выполнения');}
  };
}
