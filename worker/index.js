const PAGES_ORIGIN  = 'https://app.west-casa.com';
const RENDER_ORIGIN = 'https://half-marathon-api.onrender.com';
const SUBPATH       = '/trnrboi8000';

export default {
  async fetch(request) {
    const url = new URL(request.url);

    // Root → placeholder
    if (url.pathname === '/' || url.pathname === '') {
      return new Response('west-casa.com', { status: 200 });
    }

    // /auth/* → redirect browser directly to Render backend.
    // OAuth is a browser navigation flow, not an API call, so we let the
    // browser talk to Render directly rather than trying to proxy it.
    if (url.pathname.startsWith('/auth/')) {
      const target = new URL(url.pathname + url.search, RENDER_ORIGIN);
      return Response.redirect(target.toString(), 302);
    }

    // /api/* → Pages origin, which has a Pages function that proxies to Render.
    if (url.pathname.startsWith('/api/')) {
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
