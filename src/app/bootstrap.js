import {characterPose} from '../render/shared/character_pose.js';
// One shared runtime context owns state; this system has no hidden globals.
export function installAppBootstrap(ctx) {
  const {
    WEATHER_PRESETS,
    createDriveLab,
    createFreeRoam,
    createGameMenu,
    onRoadSurface,
    routeInput,
    worldPoint
  } = ctx.dependencies;
  ctx.boot = function boot() {
    ctx.initTopology();
    const startLocation = {
      x: ctx.player.x,
      y: ctx.player.y,
      angle: ctx.player.angle
    };
    ctx.listen(ctx.env.window, 'lowtown-before-update', () => ctx.autoSaveProgress());
    ctx.initThreeRuntime();
    ctx.roam = createFreeRoam(ctx.player, ctx.parkedCars, ctx.buildings, ctx.trees, ctx.isPositionOnSolidGround, ctx.showToast, ctx.solidProps, ctx.isPositionOnWaterObstacle, () => [...ctx.trafficCars, ...ctx.policeCars, ...ctx.incidentPoliceCars, ...ctx.incidentResponseVehicles, ...ctx.breakableProps.filter(p => p.intact !== false && p.type !== 'hydrant')], {
      mapPoint: worldPoint,
      runways: ctx.PLANE_RUNWAYS,
      streets: ctx.roads,
      footSupport: (x, y) => ctx.getWalkSurface()(x, y),
      footBlocked: ctx.isPedestrianSceneryBlocked
    });
    const roamControls = ctx.env.document.createElement('div');
    roamControls.className = 'roam-controls';
    const enterButton = ctx.env.document.createElement('button');
    enterButton.id = 'btnRoamEnter';
    enterButton.textContent = 'Выйти / сесть · E';
    ctx.listen(enterButton, 'click', () => {
      if (!ctx.isGamePaused()) ctx.roam.interact();
    });
    const flyButton = ctx.env.document.createElement('button');
    flyButton.id = 'btnRoamFly';
    flyButton.textContent = 'Взлёт / снижение · Q';
    ctx.listen(flyButton, 'click', () => {
      if (!ctx.isGamePaused()) ctx.roam.toggleFlight();
    });
    const weaponButton=ctx.env.document.createElement('button');weaponButton.id='btnWeapon';weaponButton.textContent='Кулаки · Q';
    ctx.listen(weaponButton,'click',()=>{if(!ctx.isGamePaused())ctx.cycleWeapon();});
    const reloadButton=ctx.env.document.createElement('button');reloadButton.id='btnReload';reloadButton.textContent='Перезарядить · T';
    ctx.listen(reloadButton,'click',()=>{if(!ctx.isGamePaused())ctx.reloadWeapon();});
    roamControls.append(enterButton, flyButton,weaponButton,reloadButton);
    ctx.env.document.body.appendChild(roamControls);ctx.roamControls=roamControls;
    ctx.loadProgress();
    ctx.setupInputListeners();
    const cameraButton = ctx.env.document.getElementById('btnCamera');
    let updateCameraButton = () => {};
    if (cameraButton && ctx.threeRenderer) {
      const presets = ['near', 'normal', 'overview'],
        labels = {
          near: 'Ближе',
          normal: 'Обычный',
          overview: 'Обзор'
        };
      updateCameraButton = () => {
        const label = labels[ctx.threeRenderer.cameraPreset];
        cameraButton.textContent = 'Камера: ' + label;
        cameraButton.setAttribute('aria-label', 'Приближение камеры: ' + label + '. Нажмите, чтобы переключить.');
        ctx.gameMenu?.refresh();
      };
      updateCameraButton();
      ctx.listen(cameraButton, 'click', () => {
        ctx.threeRenderer.setCameraPreset(presets[(presets.indexOf(ctx.threeRenderer.cameraPreset) + 1) % presets.length]);
        updateCameraButton();
      });
    } else if (cameraButton) cameraButton.style.display = 'none';
    ctx.listen(ctx.env.document.getElementById('btnWeather'), 'click', () => {
      ctx.weather.next();
      ctx.showToast('Погода: ' + WEATHER_PRESETS[ctx.weather.kind].label);
    });
    ctx.driveLab = createDriveLab({listen:ctx.listen,
      player: ctx.player,
      state: ctx.state,
      canvas: ctx.canvas,
      roads: ctx.roads,
      buildings: ctx.buildings,
      trafficCars: ctx.trafficCars,
      policeCars: ctx.policeCars,
      routeInput,
      roam: ctx.roam,
      responseActors: [ctx.incidentPoliceCars, ctx.incidentResponseVehicles, ctx.airMedicalVehicles],
      visible: ctx.localBridgeQA
    });
    if (typeof createGameMenu === 'function') ctx.gameMenu = createGameMenu({listen:ctx.listen,
      onPause(open) {
        ctx.state.isMenuOpen = open;
        ctx.syncGamePause();
      },
      save: ctx.autoSaveProgress,
      getContext: () => `${ctx.districtAt(ctx.player.x, ctx.player.y)?.name || 'LOWTOWN'} · $${ctx.state.cash.toLocaleString('ru-RU')}${ctx.state.custodyTimer > 0 ? ' · Задержание' : ''}`,
      canTravel: () => ctx.state.custodyTimer <= 0,
      getCamera: () => ctx.threeRenderer?.cameraPreset || null,
      getGraphics: () => ctx.threeRenderer?.graphics || null,
      setGraphics(patch) {
        ctx.threeRenderer?.setGraphics(patch);
        ctx.renderWorld();
      },
      setCamera(preset) {
        ctx.threeRenderer?.setCameraPreset(preset);
        updateCameraButton();
        ctx.renderWorld();
      },
      getAudio: () => ({
        volume: ctx.sound.volume,
        station: ctx.sound.stationIdx
      }),
      setVolume(volume) {
        ctx.sound.init();
        ctx.sound.setVolume(volume);
      },
      setStation(station) {
        ctx.sound.init();
        ctx.sound.setStation(station);
      },
      openMap: ctx.toggleMap,
      openGarage: ctx.toggleGarage,
      returnToStart() {
        ctx.env.document.getElementById('labReset')?.click();
        ctx.roam.resetToSedan(startLocation.x, startLocation.y, startLocation.angle);
        Object.assign(ctx.player, {
          ...startLocation,
          vx: 0,
          vy: 0,
          speed: 0,
          steeringAngle: 0,
          reverseDelay: 0
        });
        ctx.clearGameInput();
        ctx.autoSaveProgress();
        ctx.showToast('Возвращение на старт · прогресс сохранён');
      }
    });
    // Deterministic survey positions are available only on a local QA preview.
    // The published game never exposes this control surface.
    if (['127.0.0.1', 'localhost'].includes(ctx.env.window.location?.hostname) && ctx.env.window.location.search.includes('cityQA=1')) {
      ctx.env.window.__lowtownCityQA = {
        menuState: () => ({
          paused: ctx.isGamePaused(),
          view: ctx.gameMenu?.isOpen ? 'menu' : ctx.state.isMapOpen ? 'map' : ctx.state.isGarageOpen ? 'garage' : 'game',
          audio: {
            volume: ctx.sound.volume,
            station: ctx.sound.stationIdx,
            gain: ctx.sound.masterGain?.gain.value ?? null
          },
          keys: {
            ...ctx.state.keys
          }
        }),
        worldPoint,
        advanceScene(seconds = 1) {
          ctx.qaManualSceneClock ??= ctx.env.performance.now();
          const count = ctx.env.Math.round(ctx.env.Math.max(0, ctx.env.Math.min(2, seconds)) * 60);
          for (let frame = 0; frame < count; frame++) {
            ctx.qaSignalTimeOffset += 1000 / 60;
            ctx.driveLab?.beforeStep();
            ctx.updatePhysics(1 / 60);
            ctx.driveLab?.afterStep();
          }
          ctx.accumulator = 0;
          ctx.state.lastFrameTime = ctx.env.performance.now();
          ctx.renderWorld();
          ctx.driveLab?.afterFrame();
        },
        districts: () => ctx.islands.map(i => ({
          id: i.id,
          name: i.name,
          x: i.x,
          y: i.y,
          w: i.w,
          h: i.h
        })),
        viewStreet(x, y) {
          if (!ctx.isPositionOnSolidGround(x, y) || ctx.isPedestrianSceneryBlocked(x, y)) throw new Error('Street view requires clear ground');
          ctx.roam.resetToSedan(x, y, 0);
          ctx.threeRenderer.setCameraPreset(ctx.threeRenderer.cameraPreset);
          Object.keys(ctx.state.keys).forEach(key => ctx.state.keys[key] = false);
          ctx.state.wanted = 0;
          ctx.state.invulnTimer = 9999;
          ctx.renderWorld();
          return {
            x,
            y
          };
        },
        viewBridgeEntrance(index = 0) {
          const paths = (ctx.roadPaintGeometry || (ctx.roadPaintGeometry = ctx.buildRoadPaintGeometry())).bridgePaths || [];
          if (!paths.length) throw new Error('No smooth bridge paths');
          const bridge = paths[(index % paths.length + paths.length) % paths.length],
            a = bridge.path[0],
            b = bridge.path[1] || a;
          const dx = b.x - a.x,
            dy = b.y - a.y,
            length = ctx.env.Math.hypot(dx, dy) || 1,
            heading = ctx.env.Math.atan2(dy, dx);
          let x = a.x - dx / length * 150,
            y = a.y - dy / length * 150;
          if (!ctx.isPositionOnSolidGround(x, y)) {
            x = a.x + dx / length * 35;
            y = a.y + dy / length * 35;
          }
          ctx.roam.resetToSedan(x, y, heading);
          Object.keys(ctx.state.keys).forEach(key => ctx.state.keys[key] = false);
          ctx.state.wanted = 0;
          ctx.state.invulnTimer = 9999;
          ctx.renderWorld();
          return {
            id: bridge.id,
            index,
            x,
            y,
            heading,
            start: {
              x: a.x,
              y: a.y
            },
            width: bridge.width
          };
        },
        viewBridgeSpan(index = 0, t = .5, onFoot = false, sideView = false) {
          ctx.qaManualSceneClock ??= ctx.env.performance.now();
          const profiles = ctx.threeRenderer.bridgeProfiles,
            profile = profiles[(index % profiles.length + profiles.length) % profiles.length];
          const point = profile.samples[ctx.env.Math.min(profile.samples.length - 1, ctx.env.Math.round(ctx.env.Math.max(0, ctx.env.Math.min(1, t)) * (profile.samples.length - 1)))];
          const heading = ctx.env.Math.atan2(point.tangent.y, point.tangent.x);
          if (onFoot) ctx.roam.resetToFoot(point.point.x, point.point.y, heading);else ctx.roam.resetToSedan(point.point.x, point.point.y, heading);
          Object.keys(ctx.state.keys).forEach(key => ctx.state.keys[key] = false);
          ctx.state.wanted = 0;
          ctx.state.invulnTimer = 9999;
          ctx.renderWorld();
          if (sideView) {
            const {
              camera,
              renderer,
              scene
            } = ctx.threeRenderer;
            camera.position.set(point.point.x - ctx.env.Math.sin(heading) * 950 + ctx.env.Math.cos(heading) * 300, point.height + 320, point.point.y + ctx.env.Math.cos(heading) * 950 + ctx.env.Math.sin(heading) * 300);
            camera.lookAt(point.point.x, point.height + 35, point.point.y);
            renderer.render(scene, camera);
          }
          return {
            id: profile.id,
            x: point.point.x,
            y: point.point.y,
            height: point.height,
            heading
          };
        },
        startMedicalIncident() {
          const incident = ctx.cityIncidentDirector.start('crash', ctx.safeSpawnPoints[13], {
            duration: 600
          });
          incident.reported = true;
          return {
            id: incident.id,
            x: incident.x,
            y: incident.y
          };
        },
        startIncident(kind, x, y) {
          const target = ctx.incidentLocation(kind, {
            x,
            y
          });
          if (!target) throw new Error('No suitable incident site');
          const incident = ctx.cityIncidentDirector.start(kind, target, {
            duration: 300
          });
          if (!incident) throw new Error('Unknown incident kind');
          incident.reported = true;
          return {
            id: incident.id,
            x: incident.x,
            y: incident.y
          };
        },
        viewAirScene(x, y) {
          if (ctx.roam.profile.kind !== 'air' || ctx.roam.altitude < 30) throw new Error('Air scene requires an airborne aircraft');
          Object.assign(ctx.player, {
            x,
            y,
            speed: 0,
            vx: 0,
            vy: 0
          });
          Object.keys(ctx.state.keys).forEach(key => ctx.state.keys[key] = false);
          ctx.state.wanted = 0;
          ctx.renderWorld();
        },
        viewDistrict(id) {
          const island = ctx.islands.find(i => i.id === id);
          if (!island || ctx.roam.profile.kind !== 'air' || ctx.roam.altitude < 180) throw new Error('Survey requires an airborne aircraft');
          ctx.qaManualSceneClock ??= ctx.env.performance.now();
          Object.assign(ctx.player, {
            x: island.x + island.w / 2,
            y: island.y + island.h / 2,
            speed: 0,
            vx: 0,
            vy: 0
          });
          Object.keys(ctx.state.keys).forEach(key => ctx.state.keys[key] = false);
          ctx.state.wanted = 0;
          ctx.threeRenderer.setCameraPreset(ctx.threeRenderer.cameraPreset);
          ctx.renderWorld();
          return {
            id,
            altitude: ctx.roam.altitude,
            mode: ctx.roam.mode
          };
        },
        collisionScene(kind = 'car', onFoot = false) {
          // Fixture input is advanced explicitly by advanceScene(). Freeze
          // before its first draw so GPU/keyboard latency cannot move actors
          // between scene setup and the measured contact interval.
          ctx.qaManualSceneClock ??= ctx.env.performance.now();
          const origin = {
            x: 1600,
            y: 1200
          };
          for (const list of [ctx.trafficCars, ctx.parkedCars, ctx.pedestrians, ctx.roam.fleet]) for (let i = list.length - 1; i >= 0; i--) if (ctx.env.Math.hypot(list[i].x - origin.x, list[i].y - origin.y) < 350) list.splice(i, 1);
          ctx.incidentPoliceCars.length = 0;
          ctx.incidentResponseVehicles.length = 0;
          ctx.policeCars.length = 0;
          ctx.cityIncidentDirector.finish();
          ctx.cityIncidentDirector.state.cooldown = 99999;
          ctx.roam.resetToSedan(origin.x, origin.y, 0);
          ctx.state.invulnTimer = 999999;
          ctx.state.wanted = 0;
          const target = {
            x: origin.x + 90,
            y: origin.y,
            angle: 0
          };
          if (kind === 'car') ctx.parkedCars.push({
            ...target,
            type: 'sedan',
            color: '#629b9e',
            width: 48,
            height: 24,
            mass: 1500,
            speed: 0
          });else if (kind === 'bin') ctx.breakableProps.push({
            ...target,
            type: 'dumpster',
            intact: true,
            w: 26,
            h: 18,
            mass: 130
          });else if (kind === 'person') ctx.pedestrians.push({
            ...target,
            pause: 999,
            walkSpeed: 0,
            reaction: 'calm',
            hp: 100,
            shirt: '#8a733b',
            skin: '#caa17e'
          });else throw new Error('Unknown collision scene');
          if (onFoot) ctx.roam.resetToFoot(target.x - 28, target.y - 28, ctx.env.Math.PI / 4);
          Object.keys(ctx.state.keys).forEach(key => ctx.state.keys[key] = false);
          ctx.renderWorld();
          return {
            origin,
            target
          };
        },
        interactionScene(type='crate') {
          ctx.env.window.__lowtownCityQA.collisionScene('bin',true);
          const x=1690,y=1200;
          for(let i=ctx.breakableProps.length-1;i>=0;i--)if(ctx.env.Math.hypot(ctx.breakableProps[i].x-x,ctx.breakableProps[i].y-y)<250)ctx.breakableProps.splice(i,1);
          const width=type==='sedan'?48:16,body={type,x,y,angle:0,width,height:type==='sedan'?24:16,w:width,h:16,mass:type==='sedan'?1500:type==='barrel'?45:type==='dumpster'?130:22,hp:36,intact:true,collisionHeight:18,speed:0};
          if(type==='person'){body.hp=100;body.entityType='pedestrian';body.pause=999;ctx.pedestrians.push(body);}
          else if(type==='sedan'){body.hp=100;ctx.parkedCars.push(body);}else ctx.breakableProps.push(body);
          ctx.invalidateScenery();ctx.roam.resetToFoot(x-width/2-15,y,0);
          ctx.threeRenderer.setCameraPreset('near');ctx.renderWorld();
          return {type,x,y};
        },
        coastalScene(){
          const beach=ctx.beachZones[0];
          ctx.qaManualSceneClock=ctx.env.performance.now();
          ctx.clearGameInput();ctx.roam.resetToFoot(beach.x+beach.w/2,beach.y+100,0);ctx.selectWeapon('fists');
          const x=beach.x+beach.w/2,y=beach.y-80;Object.assign(ctx.player,{x,y,jumpHeight:0});
          ctx.player.waterSafe={x:beach.x+beach.w/2,y:beach.y+160};ctx.stepWaterInteraction(1/60);
          ctx.threeRenderer.setCameraPreset('near');ctx.renderWorld();return {beach,x,y};
        },
        coastalState:()=>({player:{x:ctx.player.x,y:ctx.player.y,inWater:!!ctx.player.inWater,waterTime:ctx.player.waterTime||0,swimPhase:ctx.player.swimPhase||0,weapon:ctx.player.weapon||'fists',ammo:ctx.player.ammo,reloadRemaining:ctx.player.reloadRemaining||0,animation:characterPose(ctx.player).action,animationTime:ctx.player.animationTime||0},beaches:ctx.beachZones,swimmers:ctx.pedestrians.filter(p=>p.inWater).length,beachPeople:ctx.pedestrians.filter(p=>p.beachRoute).length,incident:ctx.cityIncidentDirector.current()?.kind,effects:ctx.effects.active}),
        interactionState: () => ({player:{x:ctx.player.x,y:ctx.player.y,hp:ctx.player.hp,jumpHeight:ctx.player.jumpHeight||0,attackTime:ctx.player.attackTime||0},effects:ctx.effects.active,details:ctx.worldDetailCount,
          props:ctx.breakableProps.map(p=>({type:p.type,x:p.x,y:p.y,hp:p.hp,intact:p.intact})),people:ctx.pedestrians.map(p=>({hp:p.hp,reaction:p.reaction,combatTimer:p.combatTimer})),cars:ctx.parkedCars.map(p=>({hp:p.hp,damage:p.damage}))}),
        setWeather(kind, instant = false) {
          ctx.weather.set(kind);
          if (instant) Object.assign(ctx.weather, {
            ...WEATHER_PRESETS[kind],
            wetness: WEATHER_PRESETS[kind].rain
          });
        },
        detain() {
          ctx.respawnPlayer('задержание');
          ctx.renderWorld();
        },
        snapshot: () => ({
          stationExitPath: ctx.serviceBases.find(b => b.kind === 'police')?.building.exitPath,
          weather: {
            kind: ctx.weather.kind,
            rain: ctx.weather.rain,
            fog: ctx.weather.fog,
            wind: ctx.weather.wind,
            wetness: ctx.weather.wetness
          },
          player: {
            x: ctx.player.x,
            y: ctx.player.y,
            angle: ctx.player.angle,
            speed: ctx.player.speed,
            hp: ctx.player.hp,
            mode: ctx.roam.mode,
            custodyTimer: ctx.state.custodyTimer,
            station: ctx.state.custodyStation,
            keys: {
              ...ctx.state.keys
            }
          },
          collisionBodies: ctx.cityCollisionBodies().filter(b => !ctx.pedestrians.includes(b)).map(b => ({
            x: b.x,
            y: b.y,
            angle: b.angle,
            width: b.width || b.w,
            height: b.height || b.h,
            mass: b.mass,
            type: b.type,
            kind: b.kind,
            speed: b.speed
          })),
          signals: (ctx.roadPaintGeometry || (ctx.roadPaintGeometry = ctx.buildRoadPaintGeometry())).signals.map(j => ({
            x: j.x,
            y: j.y,
            w: j.w,
            h: j.h
          })),
          signalPhase: {
            x: ctx.streetSignal('x'),
            y: ctx.streetSignal('y')
          },
          busStops: ctx.transitStopSigns(),
          residents: ctx.pedestrians.map(p => ({
            x: p.x,
            y: p.y,
            heading: p.heading,
            activity: p.activity || 'walking',
            district: p.districtId,
            purpose: p.purpose,
            gait: p.gait,
            blockedTimer: p.blockedTimer || 0,
            reaction: p.reaction,
            goal: p.goal,
            avoidZone: p.avoidZone,
            stance: p.stance,
            hp: p.hp,
            knockdownTimer: p.knockdownTimer
          })),
          responders: [...ctx.incidentPoliceCars, ...ctx.incidentResponseVehicles, ...ctx.policeCars].map(u => ({
            id: `${u.model || u.role}:${u.responseIncidentId || 0}:${u.responseBase || ''}`,
            model: u.model,
            status: u.status,
            x: u.x,
            y: u.y,
            angle: u.angle,
            speed: u.speed,
            goal: u.route?.[0],
            remaining: u.route?.length,
            width: u.width,
            height: u.height,
            yielding: !!u.cooperativeYield,
            passing: !!u.emergencyManeuver,
            blocked: !!u.emergencyBlocked,
            rotationBlocked: !!u.rotationBlocked,
            neighbors: ctx.emergencyPassingActors(u).filter(a => ctx.env.Math.hypot(a.x - u.x, a.y - u.y) < 160).map(a => ({
              x: a.x,
              y: a.y,
              angle: a.angle,
              width: a.width,
              height: a.height,
              type: a.type,
              model: a.model
            })),
            peopleNear: ctx.pedestrians.filter(p => ctx.env.Math.hypot(p.x - u.x, p.y - u.y) < 120).map(p => ({
              x: p.x,
              y: p.y,
              reaction: p.reaction,
              goal: p.goal,
              evacuating: !!p.evacuation
            })),
            supported: ctx.serviceFootprintSupported(u),
            safe: ctx.emergencyPassingGroundClear(u)
          })),
          yieldingTraffic: ctx.trafficCars.filter(c => c.yieldHome).length,
          incident: ctx.cityIncidentDirector.current() ? {
            id: ctx.cityIncidentDirector.current().id,
            fireSuppressed: !!ctx.cityIncidentDirector.current().fireSuppressed,
            medicalTreated: !!ctx.cityIncidentDirector.current().medicalTreated,
            medicalProvider: ctx.cityIncidentDirector.current().medicalProvider,
            airMedicalResponse: ctx.cityIncidentDirector.current().airMedicalResponse
          } : null,
          districts: ctx.islands.map(i => ({
            id: i.id,
            people: ctx.pedestrians.filter(p => p.districtId === i.id).length,
            buildings: ctx.buildings.filter(b => b.districtId === i.id).length,
            profile: ctx.districtProfiles[i.id]
          })),
          serviceBases: ctx.serviceBases.map(b => ({
            sign: b.building.sign,
            kind: b.kind,
            origin: b.origin,
            entry: b.entry
          })),
          airMedicalBases: ctx.airMedicalBases().map(b => ({
            sign: b.building.sign,
            x: b.x,
            y: b.y,
            altitude: b.altitude
          })),
          airMedicalVehicles: ctx.airMedicalVehicles.map(u => ({
            x: u.x,
            y: u.y,
            altitude: u.altitude,
            status: u.status,
            responseIncidentId: u.responseIncidentId,
            responseBase: u.responseBase
          })),
          people: ctx.pedestrians.length,
          traffic: ctx.trafficCars.length,
          badPeople: ctx.pedestrians.filter(p => ctx.isPedestrianSceneryBlocked(p.x, p.y, 0, p.inWater === true)).length,
          trafficOffRoad: ctx.trafficCars.filter(c => !onRoadSurface(c.x, c.y, ctx.roads, ctx.bridges, ctx.scenicRoads, ctx.roadEnds)).length
        })
      };
    }
    ctx.state.lastFrameTime = ctx.env.performance.now();
    ctx.startSimulationLoop();
    ctx.env.requestAnimationFrame(ctx.gameLoop);
  };
}
