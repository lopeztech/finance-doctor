import '@testing-library/jest-dom';

// jsdom (jest 30) doesn't ship a global `fetch`/`Response`/`Headers`/`Request`.
// The Firebase Auth Node entry reads them at module evaluation time, so
// provide no-op polyfills here so tests can import modules that transitively
// touch firebase/auth without needing per-test mocks.
const g = globalThis as unknown as {
  fetch?: typeof fetch;
  Response?: typeof Response;
  Request?: typeof Request;
  Headers?: typeof Headers;
};

if (typeof g.fetch === 'undefined') {
  g.fetch = (() => Promise.reject(new Error('fetch is not stubbed in this test'))) as typeof fetch;
}
class StubResponse {}
class StubRequest {}
class StubHeaders {}
if (typeof g.Response === 'undefined') g.Response = StubResponse as unknown as typeof Response;
if (typeof g.Request === 'undefined') g.Request = StubRequest as unknown as typeof Request;
if (typeof g.Headers === 'undefined') g.Headers = StubHeaders as unknown as typeof Headers;
