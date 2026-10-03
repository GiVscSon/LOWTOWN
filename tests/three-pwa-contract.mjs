import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';

const pkg=JSON.parse(readFileSync('package.json','utf8'));
const manifest=JSON.parse(readFileSync('public/manifest.webmanifest','utf8'));
const index=readFileSync('index.html','utf8');
const main=readFileSync('src/main.js','utf8');
const renderer=readFileSync('src/render/three/renderer.js','utf8');
const sw=readFileSync('public/sw.js','utf8');

assert.equal(pkg.dependencies.three,'0.185.1');
assert(index.includes('id="threeCanvas"'));
assert(index.includes('rel="manifest" href="./manifest.webmanifest"'));
assert(index.includes('src="./src/app/pwa.js"'));
assert(main.includes('createGameRuntime'));
const frame=readFileSync('src/render/frame.js','utf8');
assert(frame.includes('createLowtownThreeRenderer'));
assert(frame.includes('__lowtownRenderer'));
assert(renderer.includes('new THREE.WebGLRenderer'));
assert(renderer.includes('new THREE.PerspectiveCamera'));
assert(renderer.includes('THREE.MeshStandardMaterial'));
assert.equal(manifest.display,'standalone');
assert.equal(manifest.start_url,'./');
assert(manifest.icons.some(icon=>icon.sizes==='192x192'));
assert(manifest.icons.some(icon=>icon.sizes==='512x512'));
assert(sw.includes("self.addEventListener('fetch'"));
assert(sw.includes("self.addEventListener('install'"));
assert(existsSync('public/pwa-icon.svg'));
console.log('THREE_PWA_CONTRACT_OK',JSON.stringify({three:pkg.dependencies.three,display:manifest.display,icons:manifest.icons.length}));
