import assert from 'node:assert/strict';
const source=await (await import('node:fs/promises')).readFile(new URL('../src/game/mobile_controls_v2.js',import.meta.url),'utf8');
for(const token of ['mobile-stick','data-mobile="ai"','data-mobile="reset"','data-mobile="handbrake"','setKey(\'w\'','setKey(\'s\'','setKey(\'a\'','setKey(\'d\''])assert.ok(source.includes(token),`mobile control contract missing ${token}`);
assert.match(source,/ai=!ai/);
assert.match(source,/releaseDrive\(\)/);
console.log('MOBILE CONTROLS V2 CONTRACT: PASS STICK + AI + RESET + HANDBRAKE');
