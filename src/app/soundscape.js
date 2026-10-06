// Fixed ambience sources, one reusable noise buffer, bounded short event voices.
export function setAudioLevel(parameter,value,time,decay=.03){
  if(!parameter)return;
  if(value===0){parameter.cancelScheduledValues?.(0);parameter.value=0;parameter.setValueAtTime(0,time);}
  else parameter.setTargetAtTime(value,time,decay);
}
export function createSoundscape(a,master){
  const effects=a.createGain(),ambient=a.createGain();effects.connect(master);ambient.connect(master);
  const buffer=a.createBuffer(1,a.sampleRate*2,a.sampleRate),data=buffer.getChannelData(0);let seed=8917;
  for(let i=0;i<data.length;i++){seed=(Math.imul(seed,1664525)+1013904223)>>>0;data[i]=seed/2147483648-1;}
  const loops={},voices=new Set(),cooldowns=new Map();
  for(const [id,type,hz] of [['rain','highpass',1200],['wind','lowpass',240],['waves','lowpass',600],['fire','bandpass',900]]){
    const source=a.createBufferSource(),filter=a.createBiquadFilter(),gain=a.createGain();source.buffer=buffer;source.loop=true;filter.type=type;filter.frequency.value=hz;gain.gain.value=0;
    source.connect(filter);filter.connect(gain);gain.connect(ambient);source.start();loops[id]={source,gain};
  }
  const siren=a.createOscillator(),sirenGain=a.createGain();siren.type='sine';sirenGain.gain.value=0;siren.connect(sirenGain);sirenGain.connect(ambient);siren.start();
  const profiles={
    step:{noise:.045,hz:650,length:.075,tone:85,level:.025},swim:{noise:.1,hz:800,length:.22,tone:170,level:.03},
    splash:{noise:.18,hz:1300,length:.45,tone:240,level:.06},land:{noise:.09,hz:500,length:.13,tone:95,level:.06},
    impact:{noise:.12,hz:1400,length:.18,tone:110,level:.08},break:{noise:.14,hz:2600,length:.25,tone:440,level:.03},
    pistol:{noise:.27,hz:2800,length:.15,tone:135,level:.1},shotgun:{noise:.32,hz:1600,length:.3,tone:75,level:.15},
    flare:{noise:.17,hz:2200,length:.35,tone:260,level:.06},bat:{noise:.075,hz:450,length:.12,tone:100,level:.04},
    reload:{noise:.07,hz:3500,length:.065,tone:480,level:.025},door:{noise:.095,hz:1000,length:.16,tone:120,level:.065},
    jump:{noise:.035,hz:750,length:.12,tone:190,level:.015},horn:{noise:0,hz:1000,length:.3,tone:370,level:.1},
    thunder:{noise:.28,hz:350,length:1.4,tone:45,level:.07},skid:{noise:.07,hz:2100,length:.17,tone:680,level:.015}
  };
  function voice(profile,level,delay=0){
    if(voices.size>=32||level<.01||effects.gain.value===0)return;
    const time=a.currentTime+delay,duration=profile.length,gain=a.createGain(),filter=a.createBiquadFilter(),source=profile.noise?a.createBufferSource():a.createOscillator();
    filter.type='lowpass';filter.frequency.value=profile.hz;
    if(profile.noise){source.buffer=buffer;}else {source.type='triangle';source.frequency.setValueAtTime(profile.tone,time);source.frequency.exponentialRampToValueAtTime(Math.max(25,profile.tone*.45),time+duration);}
    gain.gain.setValueAtTime(.0001,time);gain.gain.linearRampToValueAtTime((profile.noise||profile.level)*level,time+.005);gain.gain.exponentialRampToValueAtTime(.0001,time+duration);
    source.connect(filter);filter.connect(gain);gain.connect(effects);voices.add(source);
    source.onended=()=>{voices.delete(source);source.disconnect();filter.disconnect();gain.disconnect();};source.start(time);source.stop(time+duration+.02);
  }
  function play(id,level=1){
    const p=profiles[id];if(!p||a.state!=='running')return false;
    if((cooldowns.get(id)||0)>a.currentTime)return false;cooldowns.set(id,a.currentTime+(id==='thunder'?3:id==='step'?.09:.035));
    voice(p,level);if(p.noise&&p.tone)voice({...p,noise:0},level*.7);
    if(id==='reload')voice(p,level,.28);return true;
  }
  return {effects,ambient,loops,voices,play,setLevels(sfx,environment){setAudioLevel(effects.gain,sfx,a.currentTime);setAudioLevel(ambient.gain,environment,a.currentTime);},
    update({rain=0,wind=0,waves=0,fire=0,sirens=0,time=0}){
      for(const [id,level] of Object.entries({rain:rain*.13,wind:wind*.055,waves:waves*(.06+.025*Math.sin(time*1.4)),fire:fire*(.09+.02*Math.sin(time*17))}))loops[id].gain.gain.setTargetAtTime(level,a.currentTime,.2);
      sirenGain.gain.setTargetAtTime(sirens*.055,a.currentTime,.15);siren.frequency.setTargetAtTime(720+220*Math.sin(time*5),a.currentTime,.025);
    },dispose(){for(const v of voices)try{v.stop();}catch{}voices.clear();for(const loop of Object.values(loops))loop.source.stop();siren.stop();effects.disconnect();ambient.disconnect();}};
}
