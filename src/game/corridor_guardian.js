export function createCorridorGuardian({enter=78, emergency=112, restore=52}={}) {
  const state={mode:'NORMAL',events:0,recoveries:0,lastSide:0,active:false,maxCrossTrack:0};
  const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
  function apply(control,ai={}) {
    const c={...control};
    const cross=Number(ai.crossTrack)||0;
    const abs=Math.abs(cross);
    const headingError=Math.abs(Number(ai.headingError)||0);
    const turning=ai.mode==='TURN_AROUND'||ai.tactical==='TURN_AROUND'||headingError>2.2||Number(ai.curvature||0)>2.35;
    state.maxCrossTrack=Math.max(state.maxCrossTrack,abs);
    if(abs<restore){
      if(state.active){state.mode='LANE_RESTORED';state.events++;}
      state.active=false;
      if(state.mode==='LANE_RESTORED')state.mode='NORMAL';
      return c;
    }
    if(abs>=emergency && !turning){
      state.active=true;
      state.mode='CORRIDOR_RECOVERY';
      state.events++;
      state.recoveries++;
      state.lastSide=Math.sign(cross)||state.lastSide;
      const correction=-state.lastSide;
      c.steer=clamp(correction*(0.82+Math.min(.18,(abs-emergency)/90)),-1,1);
      c.throttle=Math.min(Number(c.throttle)||0,.34);
      c.brake=Math.max(Number(c.brake)||0,abs>145?.28:.12);
      c.handbrake=false;
      return c;
    }
    if(abs>=enter){
      state.active=true;
      state.mode=turning?'TURN_AROUND_GUARD':'CORRIDOR_GUARD';
      state.lastSide=Math.sign(cross)||state.lastSide;
      const correction=-state.lastSide;
      const strength=clamp(.42+(abs-enter)/70,.42,.82);
      if(turning){
        const base=Number(c.steer)||0;
        c.steer=clamp(base*.72+correction*.28,-1,1);
        c.throttle=Math.min(Number(c.throttle)||0,.68);
        if(abs>128)c.throttle=Math.min(c.throttle,.56);
        c.brake=abs>145?Math.max(Number(c.brake)||0,.08):Number(c.brake)||0;
        c.handbrake=false;
      }else{
        c.steer=clamp((Number(c.steer)||0)*.35+correction*strength,-1,1);
        c.throttle=Math.min(Number(c.throttle)||0,.62);
        if(abs>100)c.brake=Math.max(Number(c.brake)||0,.08);
      }
      return c;
    }
    return c;
  }
  return {state,apply};
}
