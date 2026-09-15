import { defineConfig } from 'vite';
import { sentryVitePlugin } from '@sentry/vite-plugin';

const hasSentryUploadConfig = Boolean(
  process.env.SENTRY_AUTH_TOKEN &&
  process.env.SENTRY_ORG &&
  process.env.SENTRY_PROJECT
);

export default defineConfig({
  base: '/LOWTOWN/',
  plugins: hasSentryUploadConfig
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
    : []
});
