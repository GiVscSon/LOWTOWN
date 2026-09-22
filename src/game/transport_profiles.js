import { TRANSPORT_TYPES } from './transport_constants.js';
import { getBasePhysics, deriveVehicleForces } from './base_physics.js';
const freeze = (v) => Object.freeze(v);

export const TRANSPORT_TYPE_PROFILES = freeze({
  CAR:        freeze({ type: TRANSPORT_TYPES.CAR,        base: 'CAR'   }),
  BOAT:       freeze({ type: TRANSPORT_TYPES.BOAT,       base: 'BOAT'  }),
  PLANE:      freeze({ type: TRANSPORT_TYPES.PLANE,      base: 'PLANE' }),
  HELICOPTER: freeze({ type: TRANSPORT_TYPES.HELICOPTER, base: 'PLANE' }),
});

export const VEHICLE_PROFILES = freeze({
  taxi:        freeze({ id:'taxi',        name:'Taxi',         type:TRANSPORT_TYPES.CAR,        mass:1350,  maxSpeed:500, power:1.02, brakes:1.08, steering:1.12, grip:1.08, drag:1,    turnRadius:1.02, drivetrain:'FWD' }),
  sedan:       freeze({ id:'sedan',       name:'Sedan',        type:TRANSPORT_TYPES.CAR,        mass:1500,  maxSpeed:455, power:.9,   brakes:1,    steering:.92,  grip:1,    drag:1.02, turnRadius:1.08, drivetrain:'RWD' }),
  coupe:       freeze({ id:'coupe',       name:'Coupe',        type:TRANSPORT_TYPES.CAR,        mass:1250,  maxSpeed:520, power:1.12, brakes:1.03, steering:1.18, grip:1.02, drag:.98,  turnRadius:.94,  drivetrain:'RWD' }),
  police:      freeze({ id:'police',      name:'Police',       type:TRANSPORT_TYPES.CAR,        mass:1600,  maxSpeed:510, power:1.08, brakes:1.15, steering:1,    grip:1.12, drag:.99,  turnRadius:1,    drivetrain:'RWD' }),
  van:         freeze({ id:'van',         name:'Van',          type:TRANSPORT_TYPES.CAR,        mass:2200,  maxSpeed:360, power:.72,  brakes:.88,  steering:.68,  grip:.9,   drag:1.08, turnRadius:1.28, drivetrain:'FWD' }),
  truck:       freeze({ id:'truck',       name:'Truck',        type:TRANSPORT_TYPES.CAR,        mass:5200,  maxSpeed:300, power:.58,  brakes:.72,  steering:.52,  grip:.82,  drag:1.16, turnRadius:1.55, drivetrain:'RWD' }),
  ferry:       freeze({ id:'ferry',       name:'Ferry',        type:TRANSPORT_TYPES.BOAT,       mass:12000, maxSpeed:150, power:1.25, brakes:1,    steering:.72,  grip:1,    drag:1,    turnRadius:1.45 }),
  speedboat:   freeze({ id:'speedboat',   name:'Speedboat',    type:TRANSPORT_TYPES.BOAT,       mass:1800,  maxSpeed:220, power:1.45, brakes:.82,  steering:1.28, grip:.88,  drag:.94,  turnRadius:.82  }),
  motor_boat:  freeze({ id:'motor_boat',  name:'Motor Boat',   type:TRANSPORT_TYPES.BOAT,       mass:900,   maxSpeed:180, power:1.18, brakes:.9,   steering:1.42, grip:.92,  drag:.90,  turnRadius:.68  }),
  light_plane: freeze({ id:'light_plane', name:'Light Plane',  type:TRANSPORT_TYPES.PLANE,      mass:900,   maxSpeed:690, power:1,    brakes:1,    steering:1.18, grip:1,    drag:1,    turnRadius:.86  }),
  cargo_plane: freeze({ id:'cargo_plane', name:'Cargo Plane',  type:TRANSPORT_TYPES.PLANE,      mass:18000, maxSpeed:610, power:1.25, brakes:.82,  steering:.55,  grip:.72,  drag:1.14, turnRadius:1.75 }),
  helicopter:  freeze({ id:'helicopter',  name:'Helicopter',   type:TRANSPORT_TYPES.HELICOPTER, mass:1800,  maxSpeed:280, power:1.32, brakes:1.1,  steering:1.55, grip:1.12, drag:.96,  turnRadius:.55, verticalForce:1.4, maxAltitude:600, minAltitude:20 }),
});

export function getTransportProfile(id = 'sedan') {
  return VEHICLE_PROFILES[id] || VEHICLE_PROFILES.sedan;
}

export function getTransportTypeProfile(type = TRANSPORT_TYPES.CAR) {
  return TRANSPORT_TYPE_PROFILES[type] || TRANSPORT_TYPE_PROFILES.CAR;
}

export function resolveTransportPhysics(id = 'sedan') {
  const vehicle = getTransportProfile(id);
  const type    = getTransportTypeProfile(vehicle.type);
  const base    = getBasePhysics(type.base);
  const p       = deriveVehicleForces(base, vehicle);
  return {
    ...p,
    maxForwardSpeed:       vehicle.maxSpeed,
    steeringRate:          base.steeringRate          * vehicle.steering,
    handbrakeSteeringRate: base.handbrakeSteeringRate  * vehicle.steering,
    lateralGrip:           base.lateralGrip            * vehicle.grip,
    slipAngleGrip:         base.slipAngleGrip          * vehicle.grip,
    handbrakeGrip:         base.handbrakeGrip          * vehicle.grip,
    handbrakeSlipGrip:     base.handbrakeSlipGrip      * vehicle.grip,
    drag:                  Math.pow(base.drag,           vehicle.drag),
    handbrakeDrag:         Math.pow(base.handbrakeDrag,  vehicle.drag),
    turnRadius:            vehicle.turnRadius,
    drivetrain:            vehicle.drivetrain || 'RWD',
    ...(vehicle.verticalForce != null ? { verticalForce: vehicle.verticalForce } : {}),
    ...(vehicle.maxAltitude   != null ? { maxAltitude:   vehicle.maxAltitude   } : {}),
    ...(vehicle.minAltitude   != null ? { minAltitude:   vehicle.minAltitude   } : {}),
  };
}

export function listTransportProfiles(type = null) {
  return Object.values(VEHICLE_PROFILES).filter(v => !type || v.type === type);
}
