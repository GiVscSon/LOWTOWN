import { TRANSPORT_TYPES, TRANSPORT_PROFILES } from './transport_physics.js';

const freeze=(v)=>Object.freeze(v);

// Physics is shared by transport type, while every individual vehicle gets its own physical identity.
export const VEHICLE_PROFILES=freeze({
  taxi:freeze({id:'taxi',name:'Taxi',type:TRANSPORT_TYPES.CAR,base:'CAR',mass:1350,maxSpeed:500,engine:1.02,braking:1.08,steering:1.12,grip:1.08,drag:1.00,turnRadius:1.02}),
  sedan:freeze({id:'sedan',name:'Sedan',type:TRANSPORT_TYPES.CAR,base:'CAR',mass:1500,maxSpeed:455,engine:.90,braking:1.00,steering:.92,grip:1.00,drag:1.02,turnRadius:1.08}),
  coupe:freeze({id:'coupe',name:'Coupe',type:TRANSPORT_TYPES.CAR,base:'CAR',mass:1250,maxSpeed:520,engine:1.12,braking:1.03,steering:1.18,grip:1.02,drag:.98,turnRadius:.94}),
  police:freeze({id:'police',name:'Police',type:TRANSPORT_TYPES.CAR,base:'CAR',mass:1600,maxSpeed:510,engine:1.08,braking:1.15,steering:1.00,grip:1.12,drag:.99,turnRadius:1.00}),
  van:freeze({id:'van',name:'Van',type:TRANSPORT_TYPES.CAR,base:'CAR',mass:2200,maxSpeed:360,engine:.72,braking:.88,steering:.68,grip:.90,drag:1.08,turnRadius:1.28}),
  truck:freeze({id:'truck',name:'Truck',type:TRANSPORT_TYPES.CAR,base:'CAR',mass:5200,maxSpeed:300,engine:.58,braking:.72,steering:.52,grip:.82,drag:1.16,turnRadius:1.55}),
  ferry:freeze({id:'ferry',name:'Ferry',type:TRANSPORT_TYPES.BOAT,base:'BOAT',mass:12000,maxSpeed:150,engine:1.25,braking:1.0,steering:.72,grip:1.0,drag:1.0,turnRadius:1.45}),
  speedboat:freeze({id:'speedboat',name:'Speedboat',type:TRANSPORT_TYPES.BOAT,base:'BOAT',mass:1800,maxSpeed:220,engine:1.45,braking:.82,steering:1.28,grip:.88,drag:.94,turnRadius:.82}),
  light_plane:freeze({id:'light_plane',name:'Light Plane',type:TRANSPORT_TYPES.PLANE,base:'PLANE',mass:900,maxSpeed:690,engine:1.0,braking:1.0,steering:1.18,grip:1.0,drag:1.0,turnRadius:.86}),
  cargo_plane:freeze({id:'cargo_plane',name:'Cargo Plane',type:TRANSPORT_TYPES.PLANE,base:'PLANE',mass:18000,maxSpeed:610,engine:1.25,braking:.82,steering:.55,grip:.72,drag:1.14,turnRadius:1.75})
});

export function getTransportProfile(id='sedan'){
  return VEHICLE_PROFILES[id]||VEHICLE_PROFILES.sedan;
}

export function resolveTransportPhysics(id='sedan'){
  const v=getTransportProfile(id);
  const base=TRANSPORT_PROFILES[v.base]||TRANSPORT_PROFILES.CAR;
  const massScale=base.mass/v.mass;
  return {
    ...base,
    type:v.type,
    mass:v.mass,
    maxForwardSpeed:v.maxSpeed,
    engineForce:base.engineForce*v.engine*massScale,
    reverseForce:base.reverseForce*v.engine*massScale,
    brakeForce:base.brakeForce*v.braking*massScale,
    steeringRate:base.steeringRate*v.steering,
    handbrakeSteeringRate:base.handbrakeSteeringRate*v.steering,
    lateralGrip:base.lateralGrip*v.grip,
    slipAngleGrip:base.slipAngleGrip*v.grip,
    handbrakeGrip:base.handbrakeGrip*v.grip,
    handbrakeSlipGrip:base.handbrakeSlipGrip*v.grip,
    drag:Math.pow(base.drag,v.drag),
    handbrakeDrag:Math.pow(base.handbrakeDrag,v.drag),
    turnRadius:v.turnRadius
  };
}

export function listTransportProfiles(type=null){
  return Object.values(VEHICLE_PROFILES).filter(v=>!type||v.type===type);
}
