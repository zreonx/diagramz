import * as React from 'react';

/**
 * Polyfill for React 18 secret internals removed or renamed in React 19.
 * Libraries compiled against React 18 (like @excalidraw/excalidraw 0.17.x)
 * expect `React.__SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED.ReactCurrentOwner`.
 */
export function applyReact19Shim() {
  if (typeof window === 'undefined') return;

  // Polyfill window.process
  const win = window as any;
  win.process = win.process || { env: {} };
  win.process.env = win.process.env || {};
  win.process.env.IS_PREACT = 'false';
  win.process.env.NODE_ENV = process.env.NODE_ENV || 'production';

  const reactAny = React as any;
  const clientInternals =
    reactAny.__CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE || {};

  const secretInternals =
    reactAny.__SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED || clientInternals;

  if (!secretInternals.ReactCurrentOwner) {
    Object.defineProperty(secretInternals, 'ReactCurrentOwner', {
      get() {
        return clientInternals.A || { current: null };
      },
      set(v) {
        clientInternals.A = v;
      },
      configurable: true,
      enumerable: true,
    });
  }

  if (!secretInternals.ReactCurrentDispatcher) {
    Object.defineProperty(secretInternals, 'ReactCurrentDispatcher', {
      get() {
        return clientInternals.H || { current: null };
      },
      set(v) {
        clientInternals.H = v;
      },
      configurable: true,
      enumerable: true,
    });
  }

  if (!secretInternals.ReactCurrentBatchConfig) {
    secretInternals.ReactCurrentBatchConfig = { transition: null };
  }

  reactAny.__SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED = secretInternals;
  if (reactAny.default && typeof reactAny.default === 'object') {
    reactAny.default.__SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED = secretInternals;
  }

  if (win.React) {
    win.React.__SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED = secretInternals;
    if (win.React.default && typeof win.React.default === 'object') {
      win.React.default.__SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED = secretInternals;
    }
  }
}

// Execute immediately upon module evaluation
applyReact19Shim();
