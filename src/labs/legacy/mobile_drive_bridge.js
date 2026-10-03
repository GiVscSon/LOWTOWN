const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));

export function createMobileDriveBridge({getInput,onAIToggle,onReset}={}){
  const state={throttle:0,steer:0,brake:0,handbrake:false};
  const api={
    read(){
      const input=typeof getInput==='function'?getInput():state;
      return {throttle:clamp(Number(input.throttle)||0,-1,1),steer:clamp(Number(input.steer)||0,-1,1),brake:clamp(Number(input.brake)||0,0,1),handbrake:!!input.handbrake};
    },
    setInput(next={}){Object.assign(state,next);return api.read();},
    toggleAI(){return typeof onAIToggle==='function'?onAIToggle():false;},
    reset(){if(typeof onReset==='function')onReset();},
    state
  };
  return api;
}

if(typeof window!=='undefined')window.__LOWTOWN_MOBILE_DRIVE__=createMobileDriveBridge();
