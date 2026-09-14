import assert from 'node:assert/strict';
import { createMissionSystem } from '../src/game/missions.js';

const world={mission:{x:0,y:0,radius:70}};
const mission=createMissionSystem(world);
const car={x:0,y:0};

for(let job=1;job<=3;job++){
  const before=mission.state();
  assert.equal(before.jobIndex,job-1,`expected Job ${job} to be active`);
  for(let stage=before.stage;stage<before.totalStages;stage++){
    const target=mission.state().target;
    car.x=target.x; car.y=target.y;
    assert.equal(mission.update(car),stage===before.totalStages-1,`Job ${job} stage ${stage+1} must advance`);
  }
  const completed=mission.state();
  assert.equal(completed.complete,true,`Job ${job} must complete`);
  assert.equal(completed.completedJobs,job,`Job ${job} must increment chain progress`);
  if(job<3) assert.equal(mission.next(),true,`Job ${job} must unlock next job`);
}
assert.equal(mission.state().chainComplete,true,'three-job chain must complete');
assert.equal(mission.next(),false,'completed prototype chain must not wrap to Job 1');
console.log('GAMEPLAY JOB CHAIN: PASS Job 1 -> Job 2 -> Job 3');
