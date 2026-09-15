import * as Sentry from '@sentry/browser';
import posthog from 'posthog-js';

const sentryDsn = import.meta.env.VITE_SENTRY_DSN;
const sentryEnvironment = import.meta.env.VITE_SENTRY_ENVIRONMENT || 'production';
const sentryRelease = import.meta.env.VITE_SENTRY_RELEASE || undefined;
const sentryEnabled = Boolean(sentryDsn);

const posthogKey = import.meta.env.VITE_POSTHOG_KEY;
const posthogHost = import.meta.env.VITE_POSTHOG_HOST || 'https://us.i.posthog.com';
const posthogEnabled = Boolean(posthogKey);

if (sentryEnabled) {
  Sentry.init({
    dsn: sentryDsn,
    environment: sentryEnvironment,
    release: sentryRelease,
    sendDefaultPii: false,
    tracesSampleRate: 0,
    beforeSend(event) {
      event.tags = {
        ...(event.tags || {}),
        game: 'LOWTOWN',
        telemetry: 'browser'
      };
      return event;
    }
  });

  Sentry.setTag('game', 'LOWTOWN');
  Sentry.setTag('runtime', 'browser');
}

if (posthogEnabled) {
  posthog.init(posthogKey, {
    api_host: posthogHost,
    autocapture: false,
    capture_pageview: false,
    capture_pageleave: true,
    persistence: 'localStorage+cookie',
    person_profiles: 'identified_only',
    loaded(client) {
      client.register({
        game: 'LOWTOWN',
        runtime: 'browser',
        environment: import.meta.env.VITE_SENTRY_ENVIRONMENT || 'production'
      });
      client.capture('lowtown_loaded');
    }
  });
}

function context(data = {}) {
  if (sentryEnabled) Sentry.setContext('lowtown', data);
  if (posthogEnabled) posthog.register({ lowtown: data });
}

function breadcrumb(message, category = 'gameplay', data = {}) {
  if (sentryEnabled) {
    Sentry.addBreadcrumb({
      message,
      category,
      level: 'info',
      data
    });
  }
  if (posthogEnabled) {
    posthog.capture('lowtown_breadcrumb', {
      message,
      category,
      ...data
    });
  }
}

function captureEvent(event, data = {}) {
  if (!posthogEnabled) return;
  posthog.capture(event, {
    game: 'LOWTOWN',
    ...data
  });
}

function captureError(error, data = {}) {
  let sentryId = null;
  if (sentryEnabled) {
    sentryId = Sentry.withScope(scope => {
      scope.setContext('lowtown', data);
      return Sentry.captureException(error);
    });
  }
  if (posthogEnabled) {
    posthog.capture('$exception', {
      $exception_message: error instanceof Error ? error.message : String(error),
      $exception_type: error?.name || 'Error',
      ...data
    });
  }
  return sentryId;
}

function captureMessage(message, data = {}, level = 'info') {
  let sentryId = null;
  if (sentryEnabled) {
    sentryId = Sentry.withScope(scope => {
      scope.setContext('lowtown', data);
      return Sentry.captureMessage(message, level);
    });
  }
  if (posthogEnabled) {
    posthog.capture('lowtown_message', {
      message,
      level,
      ...data
    });
  }
  return sentryId;
}

addEventListener('error', event => {
  const error = event.error || new Error(event.message || 'LOWTOWN browser error');
  captureError(error, { source: 'window.error', filename: event.filename || '' });
});

addEventListener('unhandledrejection', event => {
  captureError(event.reason instanceof Error ? event.reason : new Error(String(event.reason)), {
    source: 'unhandledrejection'
  });
});

window.__LOWTOWN_TELEMETRY = {
  enabled: sentryEnabled || posthogEnabled,
  sentryEnabled,
  posthogEnabled,
  sentry: Sentry,
  posthog,
  context,
  breadcrumb,
  captureEvent,
  captureError,
  captureMessage,
  flush: timeout => sentryEnabled ? Sentry.flush(timeout) : Promise.resolve(true)
};

if (sentryEnabled) {
  breadcrumb('LOWTOWN Sentry telemetry initialized', 'system', {
    environment: sentryEnvironment,
    release: sentryRelease || 'unversioned',
    path: location.pathname
  });
}
