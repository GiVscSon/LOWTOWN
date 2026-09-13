import assert from 'node:assert/strict';
import { axleLoads, drivetrainDistribution, limitDriveForce } from '../src/game/axle_physics.js';

const braking=axleLoads({mass:1500,longitudinalAcceleration:-6});
const accelerating=axleLoads({mass:1500,longitudinalAcceleration:6});
assert(braking.front>braking.rear,'braking must transfer load forward');
assert(accelerating.rear>accelerating.front,'acceleration must transfer load rearward');

const fwd=drivetrainDistribution('FWD',accelerating);
const rwd=drivetrainDistribution('RWD',accelerating);
const awd=drivetrainDistribution('AWD',accelerating);
assert(fwd.drivenLoad===accelerating.front,'FWD must use front axle load');
assert(rwd.drivenLoad===accelerating.rear,'RWD must use rear axle load');
assert(Math.abs(awd.drivenLoad-(accelerating.front+accelerating.rear))<1e-9,'AWD must use both axle loads');

const requested=12000;
const wetFwd=limitDriveForce(requested,{drivetrain:'FWD',mass:1500,friction:.68});
const wetRwd=limitDriveForce(requested,{drivetrain:'RWD',mass:1500,friction:.68});
const wetAwd=limitDriveForce(requested,{drivetrain:'AWD',mass:1500,friction:.68});
assert(wetFwd.force<requested&&wetRwd.force<requested,'limited-traction drivetrain must cap drive force');
assert(wetAwd.force>=wetFwd.force&&wetAwd.force>=wetRwd.force,'AWD must have at least as much available traction');
for(const r of [wetFwd,wetRwd,wetAwd])for(const k of ['force','capacity','frontLoad','rearLoad'])assert(Number.isFinite(r[k]),'axle result must remain finite');
console.log('PASS AXLE BALANCE',JSON.stringify({braking,accelerating,wetFwd,wetRwd,wetAwd}));
