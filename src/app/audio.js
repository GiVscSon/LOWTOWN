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
    this.stationIdx = 0;
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
      this.radioGain.gain.setValueAtTime(0.04, this.ctx.currentTime);
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
    if (this.radioInterval) clearInterval(this.radioInterval);
    this.radioInterval = null;
    this.saveSettings();
    if (this.stationIdx === 0) return this.stations[0];
    this.startSynthRadio();
    return this.stations[this.stationIdx];
  }
  startSynthRadio() {
    if (!this.ctx) return;
    const notes = this.stationIdx === 1 ? [130, 164, 196, 246, 261, 329] : this.stationIdx === 2 ? [110, 138, 165, 220, 277] : [98, 123, 147, 196, 220];
    let step = 0;
    this.radioInterval = ctx.env.setInterval(() => {
      if (!this.ctx || this.stationIdx === 0 || this.paused || !this.volume) return;
      try {
        const osc = this.ctx.createOscillator();
        const g = this.ctx.createGain();
        osc.type = this.stationIdx === 1 ? 'sawtooth' : this.stationIdx === 2 ? 'sine' : 'square';
        const freq = notes[step % notes.length];
        osc.frequency.setValueAtTime(freq, this.ctx.currentTime);
        g.gain.setValueAtTime(0.03, this.ctx.currentTime);
        g.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.22);
        osc.connect(g);
        g.connect(this.radioGain);
        osc.start();
        osc.stop(this.ctx.currentTime + 0.24);
        step++;
      } catch (e) {}
    }, 240);
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
