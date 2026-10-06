import {createSoundscape,setAudioLevel} from './soundscape.js';
// One shared runtime context owns state; this system has no hidden globals.
export function installAppAudio(ctx){
ctx.SynthAudio = class SynthAudio {
  constructor() {
    this.ctx = null;
    this.motorOsc = null;
    this.motorGain = null;
    this.radioGain = null;
    this.radioInterval = null;
    this.enabled = false;
    this.stationIdx = 1;
    this.radioStep = 0;
    this.radioNextTime = 0;
    this.voices = new Set();
    this.masterGain = null;
    this.volume = 1;
    this.effectsVolume=.8;this.ambienceVolume=.45;this.sceneClock=0;this.stepDistance=0;this.lastPosition=null;this.lastMode=null;
    this.paused = false;
    this.stations = ['📻 OFF', '📻 90s RETROWAVE', '📻 NOIR ELECTRO', '📻 SYNTH ROCK'];
    try {
      const saved = JSON.parse(ctx.env.localStorage.getItem('lowtown_audio_settings'));
      if (Number.isFinite(saved?.volume)) this.volume = ctx.env.Math.max(0, ctx.env.Math.min(1, saved.volume));
      for(const key of ['effectsVolume','ambienceVolume'])if(Number.isFinite(saved?.[key]))this[key]=ctx.env.Math.max(0,ctx.env.Math.min(1,saved[key]));
      if (Number.isInteger(saved?.station) && saved.station >= 0 && saved.station < this.stations.length) this.stationIdx = saved.station;
    } catch {}
  }
  init() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume().catch(() => {});
      return;
    }
    try {
      const AudioContext = ctx.env.window.AudioContext || ctx.env.window.webkitAudioContext;
      this.ctx = new AudioContext();
      if (this.ctx.state === 'suspended') this.ctx.resume();
      this.motorOsc = this.ctx.createOscillator();
      this.motorGain = this.ctx.createGain();
      this.radioGain = this.ctx.createGain();
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.setValueAtTime(this.paused ? 0 : this.volume, this.ctx.currentTime);
      this.masterGain.connect(this.ctx.destination);
      this.radioGain.gain.setValueAtTime(0.65, this.ctx.currentTime);
      this.radioGain.connect(this.masterGain);
      this.motorOsc.type = 'sawtooth';
      this.motorOsc.frequency.setValueAtTime(45, this.ctx.currentTime);
      this.motorGain.gain.setValueAtTime(ctx.roam?.mode==='foot'||ctx.player?.inWater?0:.035*this.effectsVolume, this.ctx.currentTime);
      const filter = this.ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(380, this.ctx.currentTime);
      this.motorOsc.connect(filter);
      filter.connect(this.motorGain);
      this.motorGain.connect(this.masterGain);
      this.motorOsc.start();
      this.lastMode=ctx.roam?.mode||'sedan';
      if(this.ctx.createBuffer&&this.ctx.createBufferSource){this.sfx=createSoundscape(this.ctx,this.masterGain);this.sfx.setLevels(this.effectsVolume,this.ambienceVolume);}
      this.enabled = true;
      if (this.stationIdx) this.startSynthRadio();
    } catch (e) {}
  }
  saveSettings() {
    try {
      ctx.env.localStorage.setItem('lowtown_audio_settings', JSON.stringify({
        volume: this.volume,
        station: this.stationIdx,effectsVolume:this.effectsVolume,ambienceVolume:this.ambienceVolume
      }));
    } catch {}
  }
  setVolume(volume) {
    if (!Number.isFinite(volume)) return;
    this.volume = ctx.env.Math.max(0, ctx.env.Math.min(1, volume));
    this.saveSettings();
    this.setPaused(this.paused);
  }
  setEffectsVolume(value){if(Number.isFinite(value)){
    this.effectsVolume=ctx.env.Math.max(0,ctx.env.Math.min(1,value));this.sfx?.setLevels(this.effectsVolume,this.ambienceVolume);
    // The engine shares the effects control and must mute without waiting for
    // another physics step, including a paused or overloaded driving scene.
    if(this.ctx)setAudioLevel(this.motorGain?.gain,ctx.roam?.mode==='foot'||ctx.player?.inWater?0:.035*this.effectsVolume,this.ctx.currentTime,.05);
    this.saveSettings();
  }}
  setAmbienceVolume(value){if(Number.isFinite(value)){this.ambienceVolume=ctx.env.Math.max(0,ctx.env.Math.min(1,value));this.sfx?.setLevels(this.effectsVolume,this.ambienceVolume);this.saveSettings();}}
  playEffect(id,source){if(this.paused||!this.volume)return;const distance=source?ctx.env.Math.hypot(source.x-ctx.player.x,source.y-ctx.player.y):0;this.sfx?.play(id,1/(1+(distance/160)**2));}
  playWeapon(id,source){this.playEffect(id,source);}
  stepScene(dt){
    if(!this.enabled||this.paused||!this.sfx)return;
    const p=ctx.player,mode=ctx.roam?.mode||'sedan',foot=mode==='foot',pos=this.lastPosition,distance=pos?ctx.env.Math.hypot(p.x-pos.x,p.y-pos.y):0;
    if(this.lastMode!==null&&this.lastMode!==mode)this.playEffect('door');this.lastMode=mode;
    if(foot&&distance<80&&!p.knockdownTimer){this.stepDistance+=distance;const stride=p.inWater?20:ctx.state.keys.nitro?12:16;if(this.stepDistance>=stride&&!p.jumpHeight){this.playEffect(p.inWater?'swim':'step');this.stepDistance%=stride;}}
    else this.stepDistance=0;
    if(p.jumpHeight>0&&!this.wasJumping)this.playEffect('jump');this.wasJumping=p.jumpHeight>0;
    this.lastPosition={x:p.x,y:p.y};this.sceneClock+=dt;if(this.sceneClock<.1)return;this.sceneClock%=.1;
    const attenuation=b=>1/(1+(ctx.env.Math.hypot(b.x-p.x,b.y-p.y)/230)**2);
    const units=[...ctx.policeCars,...ctx.incidentPoliceCars,...ctx.incidentResponseVehicles].filter(b=>b.siren||b.status==='enroute'||b.tactic||ctx.state.wanted>0&&ctx.policeCars.includes(b));
    const sirens=units.reduce((max,b)=>ctx.env.Math.max(max,attenuation(b)),0),fire=[...ctx.burningBodies].reduce((max,b)=>ctx.env.Math.max(max,attenuation(b)),0);
    const waves=p.inWater?1:ctx.surfaceAt(p.x,p.y)==='beach'?.55:0;
    this.sfx.update({rain:ctx.weather.rain,wind:ctx.weather.gust,waves,fire,sirens,time:ctx.effectClock||0});
    this.motorGain.gain.setTargetAtTime(foot||p.inWater?0:.035*this.effectsVolume,this.ctx.currentTime,.05);
    if(ctx.weather.flash>.05&&!this.hadFlash)this.playEffect('thunder');this.hadFlash=ctx.weather.flash>.05;
    if(!foot&&ctx.state.keys.handbrake&&ctx.env.Math.abs(p.speed)>2)this.playEffect('skid');
  }
  setPaused(paused) {
    this.paused = Boolean(paused);
    if(!this.masterGain)return;
    if(this.volume===0)setAudioLevel(this.masterGain.gain,0,this.ctx.currentTime);
    else this.masterGain.gain.setTargetAtTime(this.paused ? 0 : this.volume, this.ctx.currentTime, .03);
  }
  update(rpmRatio, speed) {
    if (!this.enabled || !this.ctx) return;
    const targetFreq = 42 + rpmRatio * 110 + ctx.env.Math.abs(speed) * 3;
    this.motorOsc.frequency.setTargetAtTime(targetFreq, this.ctx.currentTime, 0.05);
  }
  nextStation() {
    return this.setStation((this.stationIdx + 1) % this.stations.length);
  }
  setStation(index) {
    if (!Number.isInteger(index) || index < 0 || index >= this.stations.length) return this.stations[this.stationIdx];
    this.stationIdx = index;
    if (this.radioInterval) ctx.env.clearInterval(this.radioInterval);
    this.radioInterval = null;
    for (const voice of this.voices) try { voice.stop(); } catch {}
    this.voices.clear();
    this.saveSettings();
    if (this.stationIdx === 0) return this.stations[0];
    this.startSynthRadio();
    return this.stations[this.stationIdx];
  }
  startSynthRadio() {
    if (!this.ctx) return;
    if (this.radioInterval) ctx.env.clearInterval(this.radioInterval);
    this.radioStep = 0; this.radioNextTime = this.ctx.currentTime;
    const tracks = [null,
      {bpm:108,root:130.81,notes:[0,7,12,10,7,3,5,7,0,7,12,15,12,10,7,5],chords:[0,-5,-2,-7],wave:'triangle'},
      {bpm:84,root:110,notes:[0,3,7,10,7,3,2,0,0,7,10,12,10,7,5,3],chords:[0,-2,-5,-7],wave:'sine'},
      {bpm:126,root:98,notes:[0,0,7,12,10,7,5,3,0,7,12,7,10,7,3,5],chords:[0,-5,-7,-2],wave:'triangle'}];
    const schedule = () => {
      if (!this.ctx || !this.stationIdx) return;
      if (this.paused || !this.volume || this.ctx.state !== 'running') { this.radioNextTime = this.ctx.currentTime; return; }
      const track=tracks[this.stationIdx],interval=60/track.bpm/2;
      this.radioNextTime=Math.max(this.ctx.currentTime,this.radioNextTime);
      let scheduled=0;
      while(this.radioNextTime<this.ctx.currentTime+.3 && scheduled++<4){
        const step=this.radioStep++,time=this.radioNextTime,root=track.root*2**(track.chords[Math.floor(step/16)%4]/12);
        this.radioNote(root*2**(track.notes[step%16]/12),time,interval*.85,.16,track.wave);
        if(step%2===0)this.radioNote(root/2,time,interval*1.7,.13,'triangle');
        if(step%8===0)for(const semi of [0,3,7])this.radioNote(root*2**(semi/12),time,interval*6,.035,'sine');
        if(step%4===0)this.radioNote(70,time,.13,.17,'sine',32);
        if(step%4===2)this.radioNote(180,time,.08,.045,'triangle',65);
        this.radioNextTime+=interval;
      }
    };
    schedule();this.radioInterval=ctx.env.setInterval(schedule,100);
  }
  radioNote(frequency,time,duration,level,wave,fallTo) {
    if(this.voices.size>=48)return;
    const osc=this.ctx.createOscillator(),gain=this.ctx.createGain();
    osc.type=wave;osc.frequency.setValueAtTime(frequency,time);
    if(fallTo)osc.frequency.exponentialRampToValueAtTime(fallTo,time+duration);
    gain.gain.setValueAtTime(.0001,time);gain.gain.linearRampToValueAtTime(level,time+.012);
    gain.gain.exponentialRampToValueAtTime(.0001,time+duration);
    osc.connect(gain);gain.connect(this.radioGain);this.voices.add(osc);
    osc.onended=()=>{this.voices.delete(osc);osc.disconnect();gain.disconnect();};
    osc.start(time);osc.stop(time+duration+.01);
  }
  playSplash() {
    if (!this.enabled || !this.ctx) return;
    if(this.sfx)return this.playEffect('splash');
    try {
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(240, now);
      osc.frequency.exponentialRampToValueAtTime(40, now + 0.35);
      gain.gain.setValueAtTime(0.3, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.35);
      osc.connect(gain);
      gain.connect(this.masterGain);
      osc.start(now);
      osc.stop(now + 0.36);
    } catch (e) {}
  }
  playImpact() {
    if (!this.enabled || !this.ctx) return;
    if(this.sfx)return this.playEffect('impact');
    try {
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(110, now);
      osc.frequency.exponentialRampToValueAtTime(30, now + 0.18);
      gain.gain.setValueAtTime(0.2, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.18);
      osc.connect(gain);
      gain.connect(this.masterGain);
      osc.start(now);
      osc.stop(now + 0.19);
    } catch (e) {}
  }
  playPropBreak() {
    if (!this.enabled || !this.ctx) return;
    if(this.sfx)return this.playEffect('break');
    try {
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'square';
      osc.frequency.setValueAtTime(450, now);
      osc.frequency.exponentialRampToValueAtTime(80, now + 0.15);
      gain.gain.setValueAtTime(0.15, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.15);
      osc.connect(gain);
      gain.connect(this.masterGain);
      osc.start(now);
      osc.stop(now + 0.16);
    } catch (e) {}
  }
};
}
