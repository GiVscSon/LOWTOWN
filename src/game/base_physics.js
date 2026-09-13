import { TRANSPORT_TYPES } from './transport_constants.js';

const freeze = (v) => Object.freeze(v);

export const BASE_PHYSICS = freeze({
  [TRANSPORT_TYPES.CAR]: freeze({ type:'CAR', engineForce:460, reverseForce:260, brakeForce:760, lateralGrip:10.5, handbrakeGrip:2, drag:.993, handbrakeDrag:.972, steeringRate:1.9, handbrakeSteeringRate:1.65, steeringAuthoritySpeed:55, rollingResistance:.006, aeroDrag:.000012, yawInertia:2.4, yawDamping:3.2, slipAngleGrip:7.5, handbrakeSlipGrip:1.15, maxReverseSpeed:180, handlingModel:'auto', dynamicModelSpeed:180, dynamicBlendSpeed:35, wheelbase:2.7, corneringStiffness:3.2, maxLateralAccel:1.05, dynamicDamping:.35 }),
  [TRANSPORT_TYPES.BOAT]: freeze({ type:'BOAT', engineForce:250, reverseForce:150, brakeForce:170, lateralGrip:1.8, handbrakeGrip:1.8, drag:.985, handbrakeDrag:.985, steeringRate:.72, handbrakeSteeringRate:.72, steeringAuthoritySpeed:18, rollingResistance:.018, aeroDrag:.00002, yawInertia:1.35, yawDamping:1.8, slipAngleGrip:1.8, handbrakeSlipGrip:1.8, waterResistance:1, maxReverseSpeed:65 }),
  [TRANSPORT_TYPES.PLANE]: freeze({ type:'PLANE', engineForce:390, reverseForce:0, brakeForce:90, lateralGrip:.55, handbrakeGrip:.55, drag:.997, handbrakeDrag:.997, steeringRate:.48, handbrakeSteeringRate:.48, steeringAuthoritySpeed:35, rollingResistance:.002, aeroDrag:.000006, yawInertia:.85, yawDamping:1.1, slipAngleGrip:.55, handbrakeSlipGrip:.55, verticalForce:120, climbRate:95, maxAltitude:1800, minAltitude:40, maxReverseSpeed:0 })
});

export function getBasePhysics(type=TRANSPORT_TYPES.CAR){return BASE_PHYSICS[type]||BASE_PHYSICS[TRANSPORT_TYPES.CAR];}

export function deriveVehicleForces(base,vehicle){
  const mass=Math.max(1,Number(vehicle.mass)||1),power=Math.max(0,Number(vehicle.power)||0),brakes=Math.max(0,Number(vehicle.brakes)||0);
  const engineForce=base.engineForce*power,reverseForce=base.reverseForce*power,brakeForce=base.brakeForce*brakes;
  return {...base,type:vehicle.type,vehicleId:vehicle.id,mass,power,engineForce,reverseForce,brakeForce,acceleration:engineForce/mass,reverseAcceleration:reverseForce/mass,brakingAcceleration:brakeForce/mass};
}
