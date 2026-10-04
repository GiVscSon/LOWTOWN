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
    this.paused = false;
    this.stations = ['📻 OFF', '📻 90s RETROWAVE', '📻 NOIR ELECTRO', '📻 SYNTH ROCK'];
    try {
      const saved = JSON.parse(ctx.env.localStorage.getItem('lowtown_audio_settings'));
      if (Number.isFinite(saved?.volume)) this.volume = ctx.env.Math.max(0, ctx.env.Math.min(1, saved.volume));
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
      this.motorGain.gain.setValueAtTime(0.035, this.ctx.currentTime);
      const filter = this.ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(380, this.ctx.currentTime);
      this.motorOsc.connect(filter);
      filter.connect(this.motorGain);
      this.motorGain.connect(this.masterGain);
      this.motorOsc.start();
      this.enabled = true;
      if (this.stationIdx) this.startSynthRadio();
    } catch (e) {}
  }
  saveSettings() {
    try {
      ctx.env.localStorage.setItem('lowtown_audio_settings', JSON.stringify({
        volume: this.volume,
        station: this.stationIdx
      }));
    } catch {}
  }
  setVolume(volume) {
    if (!Number.isFinite(volume)) return;
    this.volume = ctx.env.Math.max(0, ctx.env.Math.min(1, volume));
    this.saveSettings();
    this.setPaused(this.paused);
  }
  setPaused(paused) {
    this.paused = Boolean(paused);
    this.masterGain?.gain.setTargetAtTime(this.paused ? 0 : this.volume, this.ctx.currentTime, .03);
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
