const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const finite=(v,f=0)=>Number.isFinite(Number(v))?Number(v):f;
const wrapAngle=a=>{while(a>Math.PI)a-=Math.PI*2;while(a<-Math.PI)a+=Math.PI*2;return a;};
export function resetArcadeCarState(state){state.v=0;state.steerAngle=0;state.vx=0;state.vy=0;state.yawRate=0;return state;}
export function stepArcadeCar(state,dt,input={},profile={}){
 const h=clamp(finite(dt,1/60),0,.05);if(h<=0)return telemetry(state,input);
 const maxSpeed=Math.max(40,finite(profile.maxForwardSpeed,455));
 const acceleration=Math.max(25,finite(profile.arcadeAcceleration,145));
 const reverseAcceleration=Math.max(15,finite(profile.arcadeReverseAcceleration,85));
 const brake=Math.max(40,finite(profile.arcadeBrake,420));
 const drag=Math.max(.05,finite(profile.arcadeDrag,2.8));
 const wheelbase=Math.max(18,finite(profile.wheelbase,58));
 const maxSteer=finite(profile.maxSteering,.58);
 const steerRate=Math.max(.5,finite(profile.steeringRateArcade,3.8));
 const throttle=clamp(finite(input.throttle),-1,1),brakeInput=clamp(finite(input.brake),0,1),steer=clamp(finite(input.steer),-1,1);
 state.steerAngle+=clamp(steer*maxSteer-state.steerAngle,-steerRate*h,steerRate*h);
 if(throttle>0)state.v+=acceleration*throttle*h;else if(throttle<0)state.v-=reverseAcceleration*Math.abs(throttle)*h;else state.v*=Math.max(0,1-drag*h);
 if(brakeInput>0){const amount=brake*brakeInput*h;state.v-=Math.sign(state.v||1)*Math.min(Math.abs(state.v),amount);}
 if(input.handbrake)state.v*=Math.max(0,1-4.5*h);
 if(Math.abs(state.v)<0.35)state.v=0;
 state.v=clamp(state.v,-maxSpeed*.28,maxSpeed);
 state.yawRate=Math.abs(state.v)>1?(state.v/wheelbase)*Math.tan(state.steerAngle):0;
 state.a=wrapAngle(state.a+state.yawRate*h);
 state.x+=Math.cos(state.a)*state.v*h;state.y+=Math.sin(state.a)*state.v*h;
 state.vx=Math.cos(state.a)*state.v;state.vy=Math.sin(state.a)*state.v;state.distance+=Math.abs(state.v)*h;state.age+=h;state.surface='road';
 state.arcade={speedRatio:Math.min(1,Math.abs(state.v)/maxSpeed),steerAngle:state.steerAngle,wheelbase};
 return telemetry(state,input);
}
export function telemetry(state,input={}){return{x:state.x,y:state.y,heading:state.a,velocity:Math.abs(state.v||0),forwardSpeed:state.v||0,lateralSpeed:0,yawRate:state.yawRate||0,slipAngle:0,traction:1,surface:'road',distance:state.distance||0,drift:false,controls:{...input}};}
