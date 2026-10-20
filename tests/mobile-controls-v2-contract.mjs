import assert from 'node:assert/strict';
const source=await (await import('node:fs/promises')).readFile(new URL('../src/labs/legacy/mobile_controls_v2.js',import.meta.url),'utf8');
for(const token of ['mobile-arrow-pad','data-key="ArrowUp"','data-key="ArrowDown"','data-key="ArrowLeft"','data-key="ArrowRight"','data-mobile="ai"','data-mobile="reset"','setKey=','releaseDrive'])assert.ok(source.includes(token),`mobile arrow contract missing ${token}`);
assert.match(source,/ai=!ai/);

const html=await (await import('node:fs/promises')).readFile(new URL('../index.html',import.meta.url),'utf8');
const controlNames={
  btnLeft:'Поворот налево',
  btnRight:'Поворот направо',
  btnNitro:'Нитро',
  btnGas:'Ускорение',
  btnHandbrake:'Ручной тормоз',
  btnBrake:'Тормоз и задний ход',
};
for(const [id,name] of Object.entries(controlNames)){
  const openingTag=html.match(new RegExp(`<button\\b[^>]*\\bid="${id}"[^>]*>`))?.[0];
  assert.ok(openingTag,`mobile control ${id} must exist`);
  assert.ok(openingTag.includes(`aria-label="${name}"`),`mobile control ${id} must expose the name "${name}"`);
}

console.log('MOBILE CONTROLS: PASS FOUR ARROWS + AI + RESET + ACCESSIBLE BUTTON NAMES');
