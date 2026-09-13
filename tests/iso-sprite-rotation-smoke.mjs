import assert from 'node:assert/strict';
import { isoSpriteRotation } from '../src/game/iso_sprite_rotation.js';

const a0=isoSpriteRotation(0);
const a90=isoSpriteRotation(Math.PI/2);
assert.ok(Math.abs(a0+Math.PI/4)<.01,'world +X must project to an isometric -45 degree screen heading');
assert.ok(Math.abs(a90-Math.PI/4)<.01,'world +Y must project to an isometric +45 degree screen heading');
assert.ok(Number.isFinite(isoSpriteRotation(Math.PI)));
console.log('ISO SPRITE ROTATION: PASS WORLD HEADING -> SCREEN HEADING');
