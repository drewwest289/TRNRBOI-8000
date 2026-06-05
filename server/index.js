import express from 'express';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createClient } from '@supabase/supabase-js';
import jwt from 'jsonwebtoken';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Where queue and token files live.
// On Render set QUEUE_DIR=/tmp — the working dir is read-only in prod.
const QUEUE_DIR        = process.env.QUEUE_DIR ?? __dirname;
const QUEUE_FILE       = path.join(QUEUE_DIR, 'pending.json');
const STRAVA_TOKEN_FILE = path.join(QUEUE_DIR, 'strava_tokens.json');

// ── Supabase ──────────────────────────────────────────────────────────────────

// The service_role key bypasses Row Level Security — only used server-side.
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
);

// ── JWT helpers ───────────────────────────────────────────────────────────────

const JWT_SECRET   = process.env.JWT_SECRET;
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';
const JWT_TTL      = '30d';

function signToken(user) {
  if (!JWT_SECRET) throw new Error('JWT_SECRET env var is not set');
  return jwt.sign(
    { sub: user.id, stravaId: user.strava_id, name: user.name },
    JWT_SECRET,
    { expiresIn: JWT_TTL }
  );
}

// Middleware: verify Bearer token and attach req.user = { id, stravaId, name }
function requireAuth(req, res, next) {
  if (!JWT_SECRET) return res.status(500).json({ error: 'Auth not configured (JWT_SECRET missing)' });
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) return res.status(401).json({ error: 'Unauthorized' });
  try {
    const payload = jwt.verify(header.slice(7), JWT_SECRET);
    req.user = { id: payload.sub, stravaId: payload.stravaId, name: payload.name };
    next();
  } catch {
    res.status(401).json({ error: 'Invalid or expired token' });
  }
}

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

// Returns a valid access token for a given user_id, refreshing from Supabase if needed.
// Falls back to the legacy global token file for backwards compatibility during migration.
async function getValidAccessToken(userId = null) {
  if (userId) {
    const { data: row, error } = await supabase
      .from('strava_tokens')
      .select('access_token, refresh_token, expires_at')
      .eq('user_id', userId)
      .single();

    if (error || !row) throw new Error('No Strava tokens found for user');

    const expiresAtMs = row.expires_at * 1000;
    if (Date.now() < expiresAtMs - 5 * 60 * 1000) return row.access_token;

    console.log('[strava] refreshing token for user', userId);
    const fresh = await stravaTokenRequest({ grant_type: 'refresh_token', refresh_token: row.refresh_token });
    await supabase.from('strava_tokens').upsert({
      user_id:       userId,
      access_token:  fresh.access_token,
      refresh_token: fresh.refresh_token,
      expires_at:    fresh.expires_at,
    });
    console.log('[strava] token refreshed, new expiry:', new Date(fresh.expires_at * 1000).toISOString());
    return fresh.access_token;
  }

  // Legacy path: global token file (used until all routes are migrated to per-user).
  const tokens = readStravaTokens();
  if (!tokens) throw new Error('Strava not connected — complete OAuth first via GET /auth/strava');
  const expiresAt = tokens.expires_at * 1000;
  if (Date.now() < expiresAt - 5 * 60 * 1000) return tokens.access_token;

  console.log('[strava] access token expired — refreshing (global)');
  const fresh = await stravaTokenRequest({ grant_type: 'refresh_token', refresh_token: tokens.refresh_token });
  writeStravaTokens(fresh);
  console.log('[strava] tokens refreshed, new expiry:', new Date(fresh.expires_at * 1000).toISOString());
  return fresh.access_token;
}

// Authenticated fetch against Strava API v3.
async function stravaGet(path, params = {}, userId = null) {
  const token = await getValidAccessToken(userId);
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
  : [
      'http://localhost:5173',
      'http://localhost:5174',
      'http://127.0.0.1:5173',
      'https://trainer-app-v2.pages.dev',
      'https://trnrboi8000.pages.dev',
      'https://trnrboi-8000.pages.dev',
      'https://app.west-casa.com',
    ];

const app = express();
app.use(cors({ origin: CORS_ORIGINS }));
app.use(express.json({ limit: '25mb' }));

// ── HAE push endpoints ────────────────────────────────────────────────────────

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

// ── Auth endpoints ────────────────────────────────────────────────────────────

// Step 1 — redirect browser to Strava's authorization page.
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
  url.searchParams.set('scope',         'read,activity:read_all,profile:read_all');
  res.redirect(url.toString());
});

// Step 2 — Strava redirects back here with ?code=...
// Upserts the user + tokens in Supabase, issues a JWT, then redirects to the frontend.
app.get('/auth/strava/callback', async (req, res) => {
  const { code, error } = req.query;
  if (error) return res.status(400).json({ error: `Strava denied: ${error}` });
  if (!code)  return res.status(400).json({ error: 'Missing code parameter' });

  try {
    const tokenData = await stravaTokenRequest({ grant_type: 'authorization_code', code });
    const athlete   = tokenData.athlete;

    // Upsert user row (create on first login, update name/avatar on subsequent logins).
    const { data: user, error: userErr } = await supabase
      .from('users')
      .upsert(
        { strava_id: athlete.id, name: athlete.firstname + ' ' + athlete.lastname, avatar_url: athlete.profile_medium },
        { onConflict: 'strava_id' }
      )
      .select()
      .single();

    if (userErr) throw new Error(`Supabase user upsert: ${userErr.message}`);

    // Upsert Strava tokens for this user.
    const { error: tokenErr } = await supabase
      .from('strava_tokens')
      .upsert({
        user_id:       user.id,
        access_token:  tokenData.access_token,
        refresh_token: tokenData.refresh_token,
        expires_at:    tokenData.expires_at,
      });

    if (tokenErr) throw new Error(`Supabase token upsert: ${tokenErr.message}`);

    // Also keep the legacy global token file so existing Strava proxy routes
    // continue working while we migrate them to per-user. Remove in Phase 3.
    writeStravaTokens(tokenData);

    const appToken = signToken(user);
    console.log('[auth] login:', user.name, '— strava_id:', athlete.id);

    // Redirect the browser back to the frontend with the JWT in the query string.
    // The frontend will read it, store it in localStorage, and strip it from the URL.
    res.redirect(`${FRONTEND_URL}/?token=${appToken}`);
  } catch (err) {
    console.error('[auth] callback error:', err.message);
    res.redirect(`${FRONTEND_URL}/?auth_error=${encodeURIComponent(err.message)}`);
  }
});

// Returns the current user's profile from their JWT.
app.get('/auth/me', requireAuth, (req, res) => {
  res.json({ id: req.user.id, stravaId: req.user.stravaId, name: req.user.name });
});

// Client calls this to signal logout (no server-side session to destroy; JWT is stateless).
app.post('/auth/logout', (_req, res) => res.json({ ok: true }));

// Legacy status endpoint — still works for backwards compat.
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
// These still use the global token file during Phase 2.
// Phase 3 will add requireAuth and pass req.user.id to stravaGet.

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

app.get('/api/strava/activities/all', async (req, res) => {
  try {
    const all = [];
    let page = 1;
    while (all.length < 500) {
      const batch = await stravaGet('/athlete/activities', { per_page: 200, page });
      if (!batch.length) break;
      all.push(...batch);
      if (batch.length < 200) break;
      page++;
    }
    res.json(all);
  } catch (err) {
    console.error('[strava]', err.message);
    res.status(502).json({ error: err.message });
  }
});

app.get('/api/strava/activities/:id', async (req, res) => {
  try {
    const data = await stravaGet(`/activities/${req.params.id}`, { include_all_efforts: true });
    res.json(data);
  } catch (err) {
    console.error('[strava]', err.message);
    res.status(502).json({ error: err.message });
  }
});

app.get('/api/strava/activities/:id/streams', async (req, res) => {
  try {
    const keys = req.query.keys || 'heartrate,latlng,altitude,time,distance,velocity_smooth,watts';
    const data = await stravaGet(`/activities/${req.params.id}/streams`, { keys, key_by_type: true });
    res.json(data);
  } catch (err) {
    console.error('[strava]', err.message);
    res.status(502).json({ error: err.message });
  }
});

app.get('/api/strava/athlete', async (req, res) => {
  try {
    const [athlete, stats] = await Promise.all([
      stravaGet('/athlete'),
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

// ── Phase 4: per-user CRUD ────────────────────────────────────────────────────

// Plan settings (start date + race date)
app.get('/api/plan/settings', requireAuth, async (req, res) => {
  const { data, error } = await supabase
    .from('plan_settings')
    .select('start_date, race_date')
    .eq('user_id', req.user.id)
    .maybeSingle();
  if (error) return res.status(500).json({ error: error.message });
  res.json(data ?? { start_date: null, race_date: null });
});

app.put('/api/plan/settings', requireAuth, async (req, res) => {
  const { start_date, race_date } = req.body;
  const { error } = await supabase
    .from('plan_settings')
    .upsert({ user_id: req.user.id, start_date: start_date ?? null, race_date: race_date ?? null },
            { onConflict: 'user_id' });
  if (error) return res.status(500).json({ error: error.message });
  res.json({ ok: true });
});

// Plan overrides (per-day schedule edits)
app.get('/api/plan/overrides', requireAuth, async (req, res) => {
  const { data, error } = await supabase
    .from('plan_overrides')
    .select('date, day_str')
    .eq('user_id', req.user.id);
  if (error) return res.status(500).json({ error: error.message });
  res.json(data ?? []);
});

app.put('/api/plan/overrides/:date', requireAuth, async (req, res) => {
  const { date } = req.params;
  const { day_str } = req.body;
  if (!day_str) return res.status(400).json({ error: 'day_str required' });
  const { error } = await supabase
    .from('plan_overrides')
    .upsert({ user_id: req.user.id, date, day_str }, { onConflict: 'user_id,date' });
  if (error) return res.status(500).json({ error: error.message });
  res.json({ ok: true });
});

app.delete('/api/plan/overrides/:date', requireAuth, async (req, res) => {
  const { error } = await supabase
    .from('plan_overrides')
    .delete()
    .eq('user_id', req.user.id)
    .eq('date', req.params.date);
  if (error) return res.status(500).json({ error: error.message });
  res.json({ ok: true });
});

// Runs
app.get('/api/runs', requireAuth, async (req, res) => {
  const { data, error } = await supabase
    .from('runs')
    .select('*')
    .eq('user_id', req.user.id)
    .order('date', { ascending: false });
  if (error) return res.status(500).json({ error: error.message });
  res.json(data ?? []);
});

app.post('/api/runs', requireAuth, async (req, res) => {
  const { date, dist, dur, type, notes, strava_id } = req.body;
  if (!date || dist == null || dur == null) {
    return res.status(400).json({ error: 'date, dist, and dur are required' });
  }
  const { data, error } = await supabase
    .from('runs')
    .insert({ user_id: req.user.id, date, dist: parseFloat(dist), dur: parseInt(dur), type, notes, strava_id: strava_id ?? null })
    .select('id')
    .single();
  if (error) return res.status(500).json({ error: error.message });
  res.json({ ok: true, id: data.id });
});

app.delete('/api/runs/:id', requireAuth, async (req, res) => {
  const { error } = await supabase
    .from('runs')
    .delete()
    .eq('id', req.params.id)
    .eq('user_id', req.user.id);
  if (error) return res.status(500).json({ error: error.message });
  res.json({ ok: true });
});

// ── Health checks ─────────────────────────────────────────────────────────────

app.get('/api/health', (_req, res) => res.json({ ok: true, queueLength: readQueue().length }));
app.get('/health',     (_req, res) => res.json({ ok: true }));

// ── Start ─────────────────────────────────────────────────────────────────────

restoreTokensFromEnv();

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`[api] listening on port ${PORT}`);
  console.log(`[api] Supabase: ${process.env.SUPABASE_URL ? 'configured' : 'NOT CONFIGURED — set SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY'}`);
  console.log(`[api] JWT:      ${JWT_SECRET ? 'configured' : 'NOT CONFIGURED — set JWT_SECRET'}`);
  console.log(`[api] Frontend: ${FRONTEND_URL}`);
});
