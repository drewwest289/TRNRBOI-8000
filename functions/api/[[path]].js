/**
 * Cloudflare Pages Function — API proxy
 *
 * Intercepts every request to /api/* and forwards it to the Render server.
 * This lets the React app continue to call relative /api/... paths in production
 * without any frontend code changes.
 *
 * Required env var (set in Cloudflare Pages → Settings → Environment variables):
 *   RENDER_API_URL  e.g. https://half-marathon-api.onrender.com
 *
 * The [[path]] filename is a catch-all — it matches /api/workouts,
 * /api/workouts/pending, /api/health, etc.
 */
export async function onRequest({ request, env }) {
  const renderApiUrl = env.RENDER_API_URL;

  if (!renderApiUrl) {
    return new Response(
      JSON.stringify({ error: 'RENDER_API_URL is not set in Cloudflare Pages environment variables.' }),
      { status: 503, headers: { 'Content-Type': 'application/json' } }
    );
  }

  // Build the target URL: replace the Pages origin with the Render origin.
  // e.g. https://your-app.pages.dev/api/workouts/pending
  //   →  https://half-marathon-api.onrender.com/api/workouts/pending
  const origin = renderApiUrl.replace(/\/$/, '');
  const { pathname, search } = new URL(request.url);
  const target = `${origin}${pathname}${search}`;

  const proxyRequest = new Request(target, {
    method:  request.method,
    headers: request.headers,
    body:    ['GET', 'HEAD'].includes(request.method) ? undefined : request.body,
    redirect: 'follow',
  });

  try {
    return await fetch(proxyRequest);
  } catch (err) {
    return new Response(
      JSON.stringify({ error: 'API server unreachable', detail: err.message }),
      { status: 502, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
