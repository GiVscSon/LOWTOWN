import assert from 'node:assert/strict';
import {mkdirSync,writeFileSync} from 'node:fs';
import * as THREE from 'three';
import {createWeather} from '../../src/simulation/surfaces.js';
import {daylightAt} from '../../src/simulation/day_cycle.js';
import {createSoundscape} from '../../src/app/soundscape.js';
import {installAppAudio} from '../../src/app/audio.js';
import {characterEyeOpen,characterGeometries,createCharacterBatch} from '../../src/render/three/characters.js';
import {runtimeCity} from '../helpers/runtime-city.mjs';
const report={rates:[],pause:false,saved:false,sound:false,detail:false};
assert(daylightAt(12).daylight>.99&&daylightAt(22).daylight===0&&daylightAt(6).twilight>0);
for(const hz of [30,60,120]){
 const w=createWeather();w.setCycleMinutes(10);const kinds=new Set([w.kind]);let min=1,max=0;
 for(let i=0;i<hz*600;i++){w.step(1/hz);kinds.add(w.kind);min=Math.min(min,w.daylight);max=Math.max(max,w.daylight);assert(Number.isFinite(w.wetness)&&w.wetness>=0&&w.wetness<=1);}
 assert(Math.abs(w.hour-22)<.001);assert.equal(min,0);assert.equal(max,1);assert.equal(kinds.size,5);
 w.setMode('storm');for(let i=0;i<hz*4;i++)w.step(1/hz);assert.equal(w.kind,'storm');assert(w.rain>.8&&w.wetness>.1);
 w.setTimeMode('day');w.step(.1);assert.equal(w.hour,12);assert.equal(w.daylight,1);report.rates.push({hz,kinds:[...kinds],min,max});
}
const storage=new Map(),localStorage={getItem:k=>storage.get(k),setItem:(k,v)=>storage.set(k,v)},saved=createWeather(localStorage);
saved.setTimeMode('day');saved.setCycleMinutes(30);saved.setMode('fog');saved.save();const loaded=createWeather(localStorage);assert.equal(loaded.hour,12);assert.equal(loaded.clock.minutes,30);assert.equal(loaded.mode,'fog');assert.equal(loaded.kind,'fog');report.saved=true;
const {runtime}=runtimeCity(),ctx=runtime.context;const before=ctx.weather.time;ctx.state.isMenuOpen=true;runtime.step(.1);assert.equal(ctx.weather.time,before);ctx.state.isMenuOpen=false;ctx.state.isMapOpen=true;runtime.step(.1);assert.equal(ctx.weather.time,before);report.pause=true;
let sources=0,buffers=0;const nodes=[],param=()=>({value:0,setValueAtTime(v){this.value=v;},setTargetAtTime(v){this.value=v;},linearRampToValueAtTime(v){this.value=v;},exponentialRampToValueAtTime(v){this.value=v;}});
const node=()=>{const n={gain:param(),frequency:param(),connect(){},disconnect(){},start(){},stop(){}};nodes.push(n);return n;};
const a={sampleRate:8000,currentTime:0,state:'running',createGain:node,createBiquadFilter:node,createOscillator:()=>{sources++;return node();},createBuffer:(_n,length)=>{buffers++;return {getChannelData:()=>new Float32Array(length)};},createBufferSource:()=>{sources++;return node();}};
const s=createSoundscape(a,node());s.setLevels(.8,.4);assert.equal(buffers,1);assert.equal(sources,5);
s.update({rain:1,wind:1,waves:1,fire:1,sirens:1,time:1});assert(s.loops.rain.gain.gain.value>.1&&s.loops.wind.gain.gain.value>0);
for(let i=0;i<300;i++){a.currentTime+=.1;s.play(['pistol','shotgun','reload','step','splash','thunder'][i%6]);assert(s.voices.size<=32);}
assert.equal(buffers,1);const initial=sources;s.setLevels(0,0);s.play('impact');assert.equal(sources,initial);for(const n of nodes)n.onended?.();assert.equal(s.voices.size,0);s.dispose();report.sound={voicesBounded:32,noiseBuffers:buffers,ambienceSources:5};
// The first E key also unlocks audio: its successful exit must still sound.
const events=[],doorCtx={env:{Math,window:{AudioContext:class {constructor(){this.state='running';this.currentTime=0;this.destination={};}createOscillator(){return node();}createGain(){return node();}createBiquadFilter(){return node();}}},localStorage:{getItem(){return null;},setItem(){}},setInterval(){return 1;},clearInterval(){}},roam:{mode:'sedan'},player:{x:0,y:0},state:{keys:{}}};
installAppAudio(doorCtx);const doorAudio=new doorCtx.SynthAudio();doorAudio.init();doorAudio.sfx={play:id=>events.push(id)};doorCtx.roam.mode='foot';doorAudio.stepScene(1/60);assert(events.includes('door'),'first gesture vehicle exit lost its door sound');
const triangleCount=Object.values(characterGeometries()).reduce((sum,g)=>sum+g.attributes.position.count/3,0);assert(triangleCount<2600);
assert(characterEyeOpen({animationTime:.08})<.1&&characterEyeOpen({animationTime:1})===1&&characterEyeOpen({dead:true})<.1);
const scene=new THREE.Scene(),batch=createCharacterBatch(scene,10),count=scene.children.length;
batch.update([{x:0,y:0,animationTime:.08},{x:0,y:0,animationTime:1}],()=>0);assert(batch.batches.face.geometry.attributes.eyeOpen.getX(0)<.1);assert.equal(batch.batches.face.geometry.attributes.eyeOpen.getX(1),1);assert.equal(scene.children.length,count);
report.detail={triangleCount,sharedMeshes:count,blink:true};mkdirSync('artifacts/living-city-1.1/climate',{recursive:true});writeFileSync('artifacts/living-city-1.1/climate/matrix.json',JSON.stringify(report,null,2));console.log('CLIMATE_SOUND_MATRIX_OK',JSON.stringify(report));
