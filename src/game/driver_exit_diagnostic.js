const finite=(v,f=0)=>Number.isFinite(Number(v))?Number(v):f;
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));

export const DRIVER_EXIT_STATES=Object.freeze({DRIVING:'DRIVING',STALLED:'STALLED',EXITING:'EXITING',ON_FOOT:'ON_FOOT'});

export function createDriverExitDiagnostic(options={}){
  const stallSeconds=Math.max(.5,finite(options.stallSeconds,2.5));
  const minThrottle=Math.max(.1,finite(options.minThrottle,.75));
  const minSpeed=Math.max(0,finite(options.minSpeed,1));
  const state={phase:DRIVER_EXIT_STATES.DRIVING,stallTime:0,exitReason:null,driverX:finite(options.driverX,0),driverY:finite(options.driverY,0),driverA:finite(options.driverA,0),vehicleX:finite(options.vehicleX,0),vehicleY:finite(options.vehicleY,0),vehicleSpeed:0,commandThrottle:0,appliedThrottle:0,engineAcceleration:0,frameDistance:0,physicsHealthy:null};
  function reset(vehicle={}){state.phase=DRIVER_EXIT_STATES.DRIVING;state.stallTime=0;state.exitReason=null;state.vehicleX=finite(vehicle.x,state.vehicleX);state.vehicleY=finite(vehicle.y,state.vehicleY);state.vehicleSpeed=finite(vehicle.speed,0);state.driverX=finite(vehicle.x,state.driverX);state.driverY=finite(vehicle.y,state.driverY);state.driverA=finite(vehicle.heading,state.driverA);return snapshot();}
  function update(dt,telemetry={}){
    const h=clamp(finite(dt),0,.25);
    state.vehicleX=finite(telemetry.x,state.vehicleX);state.vehicleY=finite(telemetry.y,state.vehicleY);state.vehicleSpeed=Math.abs(finite(telemetry.velocity,state.vehicleSpeed));state.commandThrottle=clamp(finite(telemetry.actuator?.target?.throttle,telemetry.controls?.throttle),-1,1);state.appliedThrottle=clamp(finite(telemetry.actuator?.applied?.throttle,telemetry.controls?.throttle),-1,1);state.engineAcceleration=Math.abs(finite(telemetry.acceleration));state.frameDistance=Math.max(0,finite(telemetry.frameDistance));
    const demanding=Math.abs(state.commandThrottle)>=minThrottle&&Math.abs(state.appliedThrottle)>=minThrottle;
    const moving=state.vehicleSpeed>minSpeed||state.frameDistance>minSpeed*h;
    if(state.phase===DRIVER_EXIT_STATES.DRIVING){if(demanding&&!moving){state.stallTime+=h;}else if(moving){state.stallTime=0;}
      if(state.stallTime>=stallSeconds){state.phase=DRIVER_EXIT_STATES.EXITING;state.exitReason=state.engineAcceleration<1e-3?'NO_ENGINE_RESPONSE':'NO_VEHICLE_MOTION';state.physicsHealthy=false;}
      else if(moving)state.physicsHealthy=true;
    }
    return snapshot();
  }
  function exit(vehicle={}){state.phase=DRIVER_EXIT_STATES.ON_FOOT;state.driverX=finite(vehicle.x,state.vehicleX);state.driverY=finite(vehicle.y,state.vehicleY);state.driverA=finite(vehicle.heading,state.driverA);return snapshot();}
  function snapshot(){return {...state};}
  return {state,reset,update,exit,snapshot,get stalled(){return state.phase===DRIVER_EXIT_STATES.EXITING;},get onFoot(){return state.phase===DRIVER_EXIT_STATES.ON_FOOT;}};
}
