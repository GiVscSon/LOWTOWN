import assert from 'node:assert/strict';
import { createWorldState, WORLD_STATE_STORAGE_KEY } from '../src/game/world_state.js';

function storage(){const m=new Map();return{getItem:k=>m.get(k)??null,setItem:(k,v)=>m.set(k,v),removeItem:k=>m.delete(k)};}

const store=storage();
const state=createWorldState(store);
assert.equal(state.snapshot().cash,0);
assert.equal(state.snapshot().wanted,0);

state.completeJob(600);
assert.equal(state.snapshot().cash,600);
assert.equal(state.snapshot().completedJobs,1);

state.addHeat(55);
assert.equal(state.snapshot().wanted,3);
assert.equal(state.snapshot().heat,55);
state.addHeat(50);
assert.equal(state.snapshot().wanted,5);
assert.equal(state.snapshot().heat,100);
state.cool(10);
assert.equal(state.snapshot().wanted,5);

state.discover('INDUSTRIAL');
state.discover('INDUSTRIAL');
assert.deepEqual(state.snapshot().discovered,['INDUSTRIAL']);

const restored=createWorldState(store);
assert.equal(restored.snapshot().cash,600);
assert.equal(restored.snapshot().completedJobs,1);
assert.equal(restored.snapshot().wanted,5);
assert.equal(restored.snapshot().discovered[0],'INDUSTRIAL');
assert.equal(store.getItem(WORLD_STATE_STORAGE_KEY).startsWith('{'),true);

console.log('world-state smoke: ok');
