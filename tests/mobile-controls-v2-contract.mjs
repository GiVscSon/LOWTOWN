import assert from 'node:assert/strict';
const source=await (await import('node:fs/promises')).readFile(new URL('../src/game/mobile_controls_v2.js',import.meta.url),'utf8');
for(const token of ['mobile-arrow-pad','data-key="ArrowUp"','data-key="ArrowDown"','data-key="ArrowLeft"','data-key="ArrowRight"','data-mobile="ai"','data-mobile="reset"','setKey=','releaseDrive'])assert.ok(source.includes(token),`mobile arrow contract missing ${token}`);
assert.match(source,/ai=!ai/);
console.log('MOBILE CONTROLS V2 CONTRACT: PASS FOUR ARROWS + AI + RESET');
