const PAGES_ORIGIN = 'https://app.west-casa.com';
const SUBPATH      = '/trnrboi8000';

// Paths that must pass through to the Pages origin as-is (no prefix stripping)
const PASSTHROUGH  = ['/api/', '/auth/'];

export default {
  async fetch(request) {
    const url = new URL(request.url);

    // Root → placeholder
    if (url.pathname === '/' || url.pathname === '') {
      return new Response('west-casa.com', { status: 200 });
    }

    // /api/* and /auth/* → proxy to Pages origin as-is (backend API)
    if (PASSTHROUGH.some(p => url.pathname.startsWith(p))) {
      const target = new URL(url.pathname + url.search, PAGES_ORIGIN);
      return fetch(new Request(target, {
        method:  request.method,
        headers: request.headers,
        body:    ['GET', 'HEAD'].includes(request.method) ? undefined : request.body,
        redirect: 'follow',
      }));
    }

    // /trnrboi8000/* → proxy to Pages, stripping the subpath prefix
    if (url.pathname === SUBPATH || url.pathname.startsWith(SUBPATH + '/')) {
      const stripped = url.pathname.slice(SUBPATH.length) || '/';
      const target   = new URL(stripped + url.search, PAGES_ORIGIN);
      return fetch(new Request(target, {
        method:  request.method,
        headers: request.headers,
        body:    ['GET', 'HEAD'].includes(request.method) ? undefined : request.body,
        redirect: 'follow',
      }));
    }

    return new Response('Not found', { status: 404 });
  },
};
