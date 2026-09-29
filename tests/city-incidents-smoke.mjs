import assert from 'node:assert/strict';
import { createCityIncidentDirector, updateCrowdReactions } from '../src/game/city_incidents.js';

const people = [
  { id: 1, x: 10, y: 0 },
  { id: 2, x: 245, y: 0 },
  { id: 3, x: 560, y: 0 },
  { id: 4, x: 1100, y: 0 }
];
const director = createCityIncidentDirector({
  nodes: [{ id: 'junction-1', x: 0, y: 0 }],
  random: () => 0,
  initialDelay: 0,
  minDelay: 1,
  maxDelay: 1,
  activeDuration: 0.5,
  radius: 800
});

const started = director.update(0.1, { player: { x: 0, y: 0 }, people });
assert(started, 'director should create an incident near an occupied road node');
assert.equal(started.x, 0);
assert.equal(director.state.started, 1);
assert(started.actors.length >= 1, 'incidents should place people in the scene');

const forced = director.start('fire', { x: 0, y: 0 }, { duration: 4 });
assert.equal(forced.actors[0].role, 'evacuee');
assert(forced.actors.some(actor=>actor.role==='injured'&&actor.stance==='down'),'fire scenes should include a patient for ambulance response');
const first = updateCrowdReactions(people, forced, 0.1);
assert.equal(people[0].reaction, 'fleeing', 'people in the danger zone should flee');
assert(people[0].eventFleeX > 0, 'flee direction should lead away from the incident');
assert(first.curious > 0, 'nearby bystanders should stop treating the incident as scenery');
assert.equal(people[3].reaction, 'calm', 'people outside the event area should keep their normal route');

let response;
for (let i = 0; i < 8; i++) response = updateCrowdReactions(people, forced, 0.25);
assert(response.reported && forced.reported, 'a nearby witness should report a sustained incident');

const expired = createCityIncidentDirector({ nodes: [], initialDelay: 0, activeDuration: 0.5 });
expired.start('fight', { x: 2, y: 3 }, { duration: 0.5 });
for (let i = 0; i < 2; i++) expired.update(0.25, { player: { x: 0, y: 0 }, people: [] });
assert.equal(expired.current(), null, 'incidents should clear after their timer');
assert.equal(expired.state.completed, 1);

console.log('PASS: local incidents, fleeing crowds, curiosity, witness reports and event cleanup');
