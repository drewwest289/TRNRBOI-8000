import express from 'express';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Where queue and token files live.
// On Render set QUEUE_DIR=/tmp — the working dir is read-only in prod.
const QUEUE_DIR        = process.env.QUEUE_DIR ?? __dirname;
const QUEUE_FILE       = path.join(QUEUE_DIR, 'pending.json');
const STRAVA_TOKEN_FILE = path.join(QUEUE_DIR, 'strava_tokens.json');

// ── HAE normalizer ────────────────────────────────────────────────────────────
// Mirror of src/lib/normalize.js — kept in sync manually.

function normalizeHAEWorkout(w) {
  try {
    let distMi = null;
    if (w.distance && typeof w.distance === 'object' && w.distance.qty) {
      const qty   = parseFloat(w.distance.qty);
      const units = (w.distance.units || 'mi').toLowerCase();
      distMi = units.includes('km') ? qty * 0.621371 : qty;
    }
    const durMin  = w.duration ? Math.round(parseFloat(w.duration) / 60) : null;
    const dateStr = w.start ? w.start.substring(0, 10) : null;
    let hr = null;
    if (w.avgHeartRate && typeof w.avgHeartRate === 'object') {
      hr = Math.round(parseFloat(w.avgHeartRate.qty));
    } else if (w.heartRate?.avg) {
      hr = Math.round(parseFloat(w.heartRate.avg.qty));
    }
    const name = (w.name || '').toLowerCase();
    let type = 'Easy';
    if (name.includes('interval') || name.includes('hiit'))  type = 'Intervals';
    else if (name.includes('walk') || name.includes('other')) type = 'Cross-train';
    else if (distMi && distMi >= 8)                           type = 'Long run';
    const isRun = name.includes('run');
    return { date: dateStr, distMi, durMin, hr, type, name: w.name || 'Workout', isRun };
  } catch {
    return null;
  }
}

// ── Queue helpers ─────────────────────────────────────────────────────────────

function readQueue() {
  try {
    return fs.existsSync(QUEUE_FILE)
      ? JSON.parse(fs.readFileSync(QUEUE_FILE, 'utf8'))
      : [];
  } catch {
    return [];
  }
}

function writeQueue(q) { fs.writeFileSync(QUEUE_FILE, JSON.stringify(q, null, 2)); }

function isDuplicateInQueue(queue, workout) {
  return queue.some(q =>
    q.date === workout.date &&
    Math.abs((q.distMi ?? 0) - (workout.distMi ?? 0)) < 0.01
  );
}

// ── Strava token helpers ──────────────────────────────────────────────────────

function readStravaTokens() {
  try {
    return fs.existsSync(STRAVA_TOKEN_FILE)
      ? JSON.parse(fs.readFileSync(STRAVA_TOKEN_FILE, 'utf8'))
      : null;
  } catch {
    return null;
  }
}

// Persist tokens to Render environment variables so they survive redeploys.
// Requires RENDER_API_KEY and RENDER_SERVICE_ID to be set; silently skips
// if either is missing so local dev and non-Render deployments still work.
// Render's API does NOT trigger a redeploy when env vars are updated this way.
async function persistTokensToRender(tokens) {
  const apiKey    = process.env.RENDER_API_KEY;
  const serviceId = process.env.RENDER_SERVICE_ID;
  if (!apiKey || !serviceId) {
    console.warn('[strava] RENDER_API_KEY / RENDER_SERVICE_ID not set — tokens will not survive redeploys');
    return;
  }

  const BASE    = 'https://api.render.com/v1';
  const headers = { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json', Accept: 'application/json' };

  // Fetch all existing env vars (paginated, up to 100 per page).
  const existing = [];
  let cursor = null;
  do {
    const url = new URL(`${BASE}/services/${serviceId}/env-vars`);
    url.searchParams.set('limit', '100');
    if (cursor) url.searchParams.set('cursor', cursor);
    const res = await fetch(url.toString(), { headers });
    if (!res.ok) throw new Error(`GET env-vars ${res.status}`);
    const page = await res.json();
    cursor = null;
    for (const item of page) {
      // Render returns [{ envVar: { key, value }, cursor }]
      const ev = item.envVar ?? item;
      if (ev?.key) existing.push({ key: ev.key, value: ev.value ?? '' });
      if (item.cursor) cursor = item.cursor;
    }
  } while (cursor);

  // Merge the three token fields into the existing set.
  const TOKEN_KEYS = new Set(['STRAVA_ACCESS_TOKEN', 'STRAVA_REFRESH_TOKEN', 'STRAVA_TOKEN_EXPIRES_AT']);
  const merged = [
    ...existing.filter(v => !TOKEN_KEYS.has(v.key)),
    { key: 'STRAVA_ACCESS_TOKEN',    value: tokens.access_token },
    { key: 'STRAVA_REFRESH_TOKEN',   value: tokens.refresh_token },
    { key: 'STRAVA_TOKEN_EXPIRES_AT', value: String(tokens.expires_at) },
  ];

  const put = await fetch(`${BASE}/services/${serviceId}/env-vars`, {
    method: 'PUT',
    headers,
    body: JSON.stringify(merged),
  });
  if (!put.ok) {
    const text = await put.text();
    throw new Error(`PUT env-vars ${put.status}: ${text}`);
  }
  console.log('[strava] tokens persisted to Render env vars (survive redeploys)');
}

function writeStravaTokens(tokens) {
  fs.writeFileSync(STRAVA_TOKEN_FILE, JSON.stringify(tokens, null, 2));
  // Fire-and-forget — failure here is non-fatal; tokens still work this session.
  persistTokensToRender(tokens).catch(err =>
    console.error('[strava] Render env persist failed:', err.message)
  );
}

// On startup: if the token file was wiped (redeploy), rebuild it from env vars
// that were written by a previous session's persistTokensToRender call.
function restoreTokensFromEnv() {
  if (fs.existsSync(STRAVA_TOKEN_FILE)) return;
  const access  = process.env.STRAVA_ACCESS_TOKEN;
  const refresh = process.env.STRAVA_REFRESH_TOKEN;
  const expires = process.env.STRAVA_TOKEN_EXPIRES_AT;
  if (!access || !refresh || !expires) return;
  const tokens = { access_token: access, refresh_token: refresh, expires_at: parseInt(expires, 10) };
  fs.writeFileSync(STRAVA_TOKEN_FILE, JSON.stringify(tokens, null, 2));
  console.log('[strava] tokens restored from env vars — expiry:', new Date(tokens.expires_at * 1000).toISOString());
}

// Exchange or refresh tokens with Strava. Returns the new token set.
async function stravaTokenRequest(params) {
  const res = await fetch('https://www.strava.com/oauth/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      client_id:     process.env.STRAVA_CLIENT_ID,
      client_secret: process.env.STRAVA_CLIENT_SECRET,
      ...params,
    }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Strava token error ${res.status}: ${text}`);
  }
  return res.json();
}

// Returns a valid access token, refreshing automatically if expired.
async function getValidAccessToken() {
  const tokens = readStravaTokens();
  if (!tokens) throw new Error('Strava not connected — complete OAuth first via GET /auth/strava');

  // Strava tokens expire every 6 hours; refresh if within 5 minutes of expiry.
  const expiresAt = tokens.expires_at * 1000; // convert Unix seconds → ms
  if (Date.now() < expiresAt - 5 * 60 * 1000) {
    return tokens.access_token;
  }

  console.log('[strava] access token expired — refreshing');
  const fresh = await stravaTokenRequest({
    grant_type:    'refresh_token',
    refresh_token: tokens.refresh_token,
  });
  writeStravaTokens(fresh);
  console.log('[strava] tokens refreshed, new expiry:', new Date(fresh.expires_at * 1000).toISOString());
  return fresh.access_token;
}

// Authenticated fetch against Strava API v3.
async function stravaGet(path, params = {}) {
  const token = await getValidAccessToken();
  const url   = new URL(`https://www.strava.com/api/v3${path}`);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);

  const res = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Strava API ${res.status} on ${path}: ${text}`);
  }
  return res.json();
}

// ── Express ───────────────────────────────────────────────────────────────────

const CORS_ORIGINS = process.env.CORS_ORIGINS
  ? process.env.CORS_ORIGINS.split(',').map(s => s.trim())
  : ['http://localhost:5173', 'http://localhost:5174', 'http://127.0.0.1:5173'];

const app = express();
app.use(cors({ origin: CORS_ORIGINS }));
app.use(express.json({ limit: '25mb' }));

// ── HAE push endpoints (unchanged) ────────────────────────────────────────────

app.post('/api/workouts', (req, res) => {
  const raw = req.body;
  if (!raw) return res.status(400).json({ error: 'Empty body' });

  let incoming = [];
  if (Array.isArray(raw?.data?.workouts)) {
    incoming = raw.data.workouts.map(normalizeHAEWorkout).filter(Boolean);
  } else {
    const w = normalizeHAEWorkout(raw);
    if (w) incoming = [w];
  }

  if (incoming.length === 0) {
    return res.status(422).json({
      error: 'Could not normalise payload. Expected a single HAE workout object or a { data: { workouts: [] } } bulk export.',
    });
  }

  const valid = incoming.filter(w => w.date);
  if (valid.length === 0) {
    return res.status(422).json({ error: 'No workouts with a valid date found.' });
  }

  const queue = readQueue();
  let added = 0, dupes = 0;
  for (const workout of valid) {
    if (isDuplicateInQueue(queue, workout)) { dupes++; continue; }
    queue.push({ ...workout, receivedAt: new Date().toISOString() });
    added++;
    console.log(`[api] queued: ${workout.name} on ${workout.date} — ${workout.distMi?.toFixed(2) ?? 'no dist'} mi`);
  }

  writeQueue(queue);
  res.json({ ok: true, added, dupes, queueLength: queue.length });
});

app.get('/api/workouts/pending', (_req, res) => res.json(readQueue()));

app.delete('/api/workouts/pending', (_req, res) => {
  writeQueue([]);
  res.json({ ok: true });
});

// ── Strava OAuth ──────────────────────────────────────────────────────────────

// Step 1 — redirect browser to Strava's authorization page.
// Visit GET /auth/strava in a browser to kick off the flow.
app.get('/auth/strava', (_req, res) => {
  const clientId    = process.env.STRAVA_CLIENT_ID;
  const redirectUri = process.env.STRAVA_REDIRECT_URI;
  if (!clientId || !redirectUri) {
    return res.status(500).json({ error: 'STRAVA_CLIENT_ID or STRAVA_REDIRECT_URI not set' });
  }
  const url = new URL('https://www.strava.com/oauth/authorize');
  url.searchParams.set('client_id',     clientId);
  url.searchParams.set('redirect_uri',  redirectUri);
  url.searchParams.set('response_type', 'code');
  // activity:read_all includes private activities; remove if not needed.
  url.searchParams.set('scope',         'read,activity:read_all,profile:read_all');
  res.redirect(url.toString());
});

// Step 2 — Strava redirects back here with ?code=...
// STRAVA_REDIRECT_URI must point to this route, e.g.
//   https://half-marathon-api.onrender.com/auth/strava/callback
app.get('/auth/strava/callback', async (req, res) => {
  const { code, error } = req.query;
  if (error) return res.status(400).json({ error: `Strava denied: ${error}` });
  if (!code)  return res.status(400).json({ error: 'Missing code parameter' });

  try {
    const tokens = await stravaTokenRequest({ grant_type: 'authorization_code', code });
    writeStravaTokens(tokens);
    console.log('[strava] OAuth complete — athlete:', tokens.athlete?.username ?? tokens.athlete?.id);
    res.json({
      ok: true,
      athlete:   tokens.athlete?.username ?? tokens.athlete?.id,
      expiresAt: new Date(tokens.expires_at * 1000).toISOString(),
    });
  } catch (err) {
    console.error('[strava] token exchange failed:', err.message);
    res.status(502).json({ error: err.message });
  }
});

// Status — shows whether tokens are stored and when they expire.
app.get('/auth/strava/status', (_req, res) => {
  const tokens = readStravaTokens();
  if (!tokens) return res.json({ connected: false });
  res.json({
    connected:  true,
    athleteId:  tokens.athlete?.id,
    expiresAt:  new Date(tokens.expires_at * 1000).toISOString(),
    needsRefresh: Date.now() >= tokens.expires_at * 1000 - 5 * 60 * 1000,
  });
});

// ── Strava API proxy endpoints ────────────────────────────────────────────────

// GET /api/strava/activities?per_page=30&page=1&before=<unix>&after=<unix>
app.get('/api/strava/activities', async (req, res) => {
  try {
    const { per_page = 30, page = 1, before, after } = req.query;
    const params = { per_page, page };
    if (before) params.before = before;
    if (after)  params.after  = after;
    const data = await stravaGet('/athlete/activities', params);
    res.json(data);
  } catch (err) {
    console.error('[strava]', err.message);
    res.status(502).json({ error: err.message });
  }
});

// GET /api/strava/activities/:id — full detail including best efforts
app.get('/api/strava/activities/:id', async (req, res) => {
  try {
    const data = await stravaGet(`/activities/${req.params.id}`, { include_all_efforts: true });
    res.json(data);
  } catch (err) {
    console.error('[strava]', err.message);
    res.status(502).json({ error: err.message });
  }
});

// GET /api/strava/activities/:id/streams?keys=heartrate,latlng,altitude,time,distance,velocity_smooth,watts
// keys defaults to the most useful set; override via query param.
app.get('/api/strava/activities/:id/streams', async (req, res) => {
  try {
    const keys = req.query.keys || 'heartrate,latlng,altitude,time,distance,velocity_smooth,watts';
    const data = await stravaGet(`/activities/${req.params.id}/streams`, {
      keys,
      key_by_type: true,
    });
    res.json(data);
  } catch (err) {
    console.error('[strava]', err.message);
    res.status(502).json({ error: err.message });
  }
});

// GET /api/strava/athlete — profile, stats, and PR/best-efforts summary
app.get('/api/strava/athlete', async (req, res) => {
  try {
    const [athlete, stats] = await Promise.all([
      stravaGet('/athlete'),
      // Stats requires athlete ID — pull it from stored tokens so we don't
      // need the client to know it.
      (async () => {
        const tokens = readStravaTokens();
        const id = tokens?.athlete?.id;
        if (!id) return null;
        return stravaGet(`/athletes/${id}/stats`);
      })(),
    ]);
    res.json({ athlete, stats });
  } catch (err) {
    console.error('[strava]', err.message);
    res.status(502).json({ error: err.message });
  }
});

// ── Health checks ─────────────────────────────────────────────────────────────

app.get('/api/health', (_req, res) => res.json({ ok: true, queueLength: readQueue().length }));
app.get('/health',     (_req, res) => res.json({ ok: true }));

// ── Start ─────────────────────────────────────────────────────────────────────

// Restore Strava tokens from env vars if /tmp was wiped by a redeploy.
restoreTokensFromEnv();

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`[api] listening on port ${PORT}`);
  console.log(`[api] queue file  : ${QUEUE_FILE}`);
  console.log(`[api] token file  : ${STRAVA_TOKEN_FILE}`);
  console.log(`[api] CORS origins: ${CORS_ORIGINS.join(', ')}`);
  console.log(`[api]`);
  console.log(`[api]   POST   /api/workouts                   — HAE push`);
  console.log(`[api]   GET    /api/workouts/pending            — React app polls`);
  console.log(`[api]   DELETE /api/workouts/pending            — React app clears`);
  console.log(`[api]`);
  console.log(`[api]   GET    /auth/strava                     — start OAuth (open in browser)`);
  console.log(`[api]   GET    /auth/strava/callback            — OAuth redirect target`);
  console.log(`[api]   GET    /auth/strava/status              — token status`);
  console.log(`[api]`);
  console.log(`[api]   GET    /api/strava/activities           — recent activities`);
  console.log(`[api]   GET    /api/strava/activities/:id       — activity detail`);
  console.log(`[api]   GET    /api/strava/activities/:id/streams — HR, GPS, power`);
  console.log(`[api]   GET    /api/strava/athlete              — profile + stats`);
  console.log(`[api]`);
  console.log(`[api]   GET    /health                          — Render health check`);
});
