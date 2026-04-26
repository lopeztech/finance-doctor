import '@testing-library/jest-dom';

// jsdom (jest 30) doesn't ship a global `fetch`. The Firebase Auth Node entry
// reads it at module evaluation time, so provide a no-op polyfill here so
// tests can import modules that transitively touch firebase/auth without
// needing per-test mocks.
if (typeof globalThis.fetch === 'undefined') {
  globalThis.fetch = (() => Promise.reject(new Error('fetch is not stubbed in this test'))) as typeof fetch;
}
