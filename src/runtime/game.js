import {createLifetime} from './lifetime.js';
import {RUNTIME_DEPENDENCIES} from './dependencies.js';
import {installCharacterActions} from '../simulation/character_actions.js';
import {installRuntimeState} from './state.js';
import {installRuntimeDiagnostics} from './diagnostics.js';
import {installAppAudio} from '../app/audio.js';
import {installWorldCity} from '../world/city.js';
import {installSimulationStep} from '../simulation/step.js';
import {installSimulationTraffic} from '../simulation/traffic.js';
import {installRenderCanvasCity} from '../render/canvas/city.js';
import {installWorldSupport} from '../world/support.js';
import {installWorldTransit} from '../world/transit.js';
import {installSimulationPedestrians} from '../simulation/pedestrians.js';
import {installSimulationServices} from '../simulation/services.js';
import {installSimulationPlayer} from '../simulation/player.js';
import {installSimulationContacts} from '../simulation/contacts.js';
import {installSimulationPolice} from '../simulation/police.js';
import {installRenderFrame} from '../render/frame.js';
import {installUiInterface} from '../ui/interface.js';
import {installRenderCanvasActors} from '../render/canvas/actors.js';
import {installAppPersistence} from '../app/persistence.js';
import {installAppInput} from '../app/input.js';
import {installRuntimeLoop} from './loop.js';
import {installAppBootstrap} from '../app/bootstrap.js';

export function createGameRuntime({environment={},dependencies={}}={}){
 const env={Math:globalThis.Math,performance:globalThis.performance,console:globalThis.console,window:globalThis.window,document:globalThis.document,navigator:globalThis.navigator,localStorage:undefined,requestAnimationFrame:globalThis.requestAnimationFrame?.bind(globalThis),setTimeout:globalThis.setTimeout?.bind(globalThis),setInterval:globalThis.setInterval?.bind(globalThis),cancelAnimationFrame:globalThis.cancelAnimationFrame?.bind(globalThis),clearTimeout:globalThis.clearTimeout?.bind(globalThis),clearInterval:globalThis.clearInterval?.bind(globalThis),...environment};
 if(!env.localStorage)try{env.localStorage=globalThis.localStorage;}catch{}
 const lifetime=createLifetime(env);
 const ctx={env,listen:lifetime.listen,dependencies:{...RUNTIME_DEPENDENCIES,...dependencies}};
 installAppAudio(ctx);
 installRuntimeDiagnostics(ctx);
 installWorldCity(ctx);
 installSimulationStep(ctx);
 installSimulationTraffic(ctx);
 installRenderCanvasCity(ctx);
 installWorldSupport(ctx);
 installWorldTransit(ctx);
 installSimulationPedestrians(ctx);
 installSimulationServices(ctx);
 installSimulationPlayer(ctx);
 installSimulationContacts(ctx);
 installCharacterActions(ctx);
 installSimulationPolice(ctx);
 installRenderFrame(ctx);
 installUiInterface(ctx);
 installRenderCanvasActors(ctx);
 installAppPersistence(ctx);
 installAppInput(ctx);
 installRuntimeLoop(ctx);
 installAppBootstrap(ctx);
 installRuntimeState(ctx);
 let started=false;
 return {context:ctx,get state(){return ctx.state;},get world(){return {islands:ctx.allIslands,roads:ctx.roads,bridges:ctx.bridges,buildings:ctx.buildings};},
  start(){if(started||lifetime.stopped)return;started=true;if(env.document.readyState==='loading')ctx.listen(env.window,'DOMContentLoaded',()=>{if(!lifetime.stopped)ctx.boot();},{once:true});else ctx.boot();},
  step(dt){if(!lifetime.stopped)ctx.updatePhysics(dt);},render(){if(!lifetime.stopped)ctx.renderWorld();},
  stop(){if(lifetime.stopped)return;ctx.gameMenu?.close();ctx.clearGameInput();ctx.sound.setPaused(true);lifetime.dispose();ctx.sound.ctx?.close?.();ctx.driveLab?.dispose();ctx.roamControls?.remove();ctx.threeRenderer?.dispose();}
 };
}
