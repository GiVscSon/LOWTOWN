import { defineConfig } from 'vite';
import { sentryVitePlugin } from '@sentry/vite-plugin';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {pwaIcon} from './scripts/pwa-icons.mjs';

function offlineGameBundle(){
  return {name:'lowtown-offline-bundle',apply:'build',enforce:'post',generateBundle(_,bundle){
    const icons=[{name:'pwa-192.png',bytes:pwaIcon(192)},{name:'pwa-512.png',bytes:pwaIcon(512)}];
    for(const icon of icons)this.emitFile({type:'asset',fileName:icon.name,source:icon.bytes});
    const files=[...Object.keys(bundle).filter(name=>!name.endsWith('.map')),...icons.map(icon=>icon.name)];
    const hash=createHash('sha256');
    for(const name of files.sort())hash.update(name).update(bundle[name]?.code||bundle[name]?.source||icons.find(icon=>icon.name===name)?.bytes||'');
    const template=readFileSync(new URL('./public/sw.js',import.meta.url),'utf8');
    hash.update(template);
    this.emitFile({type:'asset',fileName:'sw.js',source:template.replace('__LOWTOWN_BUILD__',hash.digest('hex').slice(0,16)).replace('/* BUILD_ASSETS */[]',JSON.stringify(files))});
  }};
}

const hasSentryUploadConfig = Boolean(
  process.env.SENTRY_AUTH_TOKEN &&
  process.env.SENTRY_ORG &&
  process.env.SENTRY_PROJECT
);

export default defineConfig({
  base: './',
  plugins: [offlineGameBundle(),...(hasSentryUploadConfig
    ? [
        sentryVitePlugin({
          org: process.env.SENTRY_ORG,
          project: process.env.SENTRY_PROJECT,
          authToken: process.env.SENTRY_AUTH_TOKEN,
          release: {
            name: process.env.VITE_SENTRY_RELEASE || undefined
          },
          sourcemaps: {
            filesToDeleteAfterUpload: ['dist/**/*.map']
          }
        })
      ]
    : [])]
});
