import * as Sentry from '@sentry/browser';

const dsn = import.meta.env.VITE_SENTRY_DSN;
const environment = import.meta.env.VITE_SENTRY_ENVIRONMENT || 'production';
const release = import.meta.env.VITE_SENTRY_RELEASE || undefined;
const enabled = Boolean(dsn);

if (enabled) {
  Sentry.init({
    dsn,
    environment,
    release,
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

function context(data = {}) {
  if (!enabled) return;
  Sentry.setContext('lowtown', data);
}

function breadcrumb(message, category = 'gameplay', data = {}) {
  if (!enabled) return;
  Sentry.addBreadcrumb({
    message,
    category,
    level: 'info',
    data
  });
}

function captureError(error, data = {}) {
  if (!enabled) return null;
  return Sentry.withScope(scope => {
    scope.setContext('lowtown', data);
    return Sentry.captureException(error);
  });
}

function captureMessage(message, data = {}, level = 'info') {
  if (!enabled) return null;
  return Sentry.withScope(scope => {
    scope.setContext('lowtown', data);
    return Sentry.captureMessage(message, level);
  });
}

window.__LOWTOWN_TELEMETRY = {
  enabled,
  sentry: Sentry,
  context,
  breadcrumb,
  captureError,
  captureMessage,
  flush: timeout => enabled ? Sentry.flush(timeout) : Promise.resolve(true)
};

if (enabled) {
  breadcrumb('LOWTOWN telemetry initialized', 'system', {
    environment,
    release: release || 'unversioned',
    path: location.pathname
  });
}
