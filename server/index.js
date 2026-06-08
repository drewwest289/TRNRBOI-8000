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
const QUEUE_DIR  = process.env.QUEUE_DIR ?? __dirname;
const QUEUE_FILE = path.join(QUEUE_DIR, 'pending.json');

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
    { sub: user.id, stravaId: user.strava_id, name: user.name, isAdmin: !!user.is_admin },
    JWT_SECRET,
    { expiresIn: JWT_TTL }
  );
}

// Middleware: verify Bearer token and attach req.user = { id, stravaId, name, isAdmin }
function requireAuth(req, res, next) {
  if (!JWT_SECRET) return res.status(500).json({ error: 'Auth not configured (JWT_SECRET missing)' });
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) return res.status(401).json({ error: 'Unauthorized' });
  try {
    const payload = jwt.verify(header.slice(7), JWT_SECRET);
    req.user = { id: payload.sub, stravaId: payload.stravaId, name: payload.name, isAdmin: !!payload.isAdmin };
    next();
  } catch {
    res.status(401).json({ error: 'Invalid or expired token' });
  }
}

// Middleware: requireAuth + must carry the is_admin flag from the users table.
function requireAdmin(req, res, next) {
  requireAuth(req, res, () => {
    if (!req.user.isAdmin) return res.status(403).json({ error: 'Admin access required' });
    next();
  });
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

// Single source of truth for resolving a Strava activity's display type.
// Ported from PaceTab.classifyActivity — ranked workout_type signal first,
// then name-keyword heuristics. The merged /api/activities endpoint resolves
// type once here so every tab agrees.
function activityClassifier(a) {
  const sport = (a.sport_type || a.type || '').toLowerCase();
  if (sport !== 'run') return 'Cross-train';
  const wt   = a.workout_type;
  const name = (a.name || '').toLowerCase();
  if (wt === 1) return 'Race';
  if (wt === 2) return 'Long run';
  if (wt === 3) return 'Tempo';
  if (name.includes('tempo') || name.includes('threshold')) return 'Tempo';
  if (name.includes('interval') || name.includes('hiit') || name.includes('speed')) return 'Intervals';
  if (name.includes('long') || name.includes('lsd'))  return 'Long run';
  if (name.includes('race') || name.includes('5k') || name.includes('10k')) return 'Race';

  // Strava's relative effort (suffer_score) catches hard efforts that weren't
  // explicitly named or tagged. Dividing by moving_time gives pts/minute:
  //   Zone 2 easy ≈ 0.4/min,  Zone 3/4 threshold ≈ 0.75–1.3/min
  // Threshold of 1.0/min requires sustained above-aerobic effort.
  if (a.suffer_score && a.moving_time > 0) {
    if (a.suffer_score / (a.moving_time / 60) >= 1.0) return 'Hard';
  }

  return 'Easy';
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
async function getValidAccessToken(userId) {
  const { data: row, error } = await supabase
    .from('strava_tokens')
    .select('access_token, refresh_token, expires_at')
    .eq('user_id', userId)
    .single();

  if (error || !row) throw new Error('No Strava tokens found for user');

  if (Date.now() < row.expires_at * 1000 - 5 * 60 * 1000) return row.access_token;

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
  res.json({ id: req.user.id, stravaId: req.user.stravaId, name: req.user.name, isAdmin: req.user.isAdmin });
});

// Client calls this to signal logout (no server-side session to destroy; JWT is stateless).
app.post('/auth/logout', (_req, res) => res.json({ ok: true }));

// Legacy status endpoint — replaced by /auth/me + per-user token check.
app.get('/auth/strava/status', requireAuth, async (req, res) => {
  const { data } = await supabase
    .from('strava_tokens')
    .select('expires_at')
    .eq('user_id', req.user.id)
    .maybeSingle();
  if (!data) return res.json({ connected: false });
  res.json({
    connected:    true,
    expiresAt:    new Date(data.expires_at * 1000).toISOString(),
    needsRefresh: Date.now() >= data.expires_at * 1000 - 5 * 60 * 1000,
  });
});

// ── Strava API proxy endpoints (Phase 5: per-user auth) ──────────────────────

app.get('/api/strava/activities', requireAuth, async (req, res) => {
  try {
    const { per_page = 30, page = 1, before, after } = req.query;
    const params = { per_page, page };
    if (before) params.before = before;
    if (after)  params.after  = after;
    const data = await stravaGet('/athlete/activities', params, req.user.id);
    res.json(data);
  } catch (err) {
    console.error('[strava]', err.message);
    res.status(502).json({ error: err.message });
  }
});

app.get('/api/strava/activities/all', requireAuth, async (req, res) => {
  try {
    const all = [];
    let page = 1;
    while (all.length < 500) {
      const batch = await stravaGet('/athlete/activities', { per_page: 200, page }, req.user.id);
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

app.get('/api/strava/activities/:id', requireAuth, async (req, res) => {
  try {
    const data = await stravaGet(`/activities/${req.params.id}`, { include_all_efforts: true }, req.user.id);
    res.json(data);
  } catch (err) {
    console.error('[strava]', err.message);
    res.status(502).json({ error: err.message });
  }
});

app.get('/api/strava/activities/:id/streams', requireAuth, async (req, res) => {
  try {
    const keys = req.query.keys || 'heartrate,latlng,altitude,time,distance,velocity_smooth,watts';
    const data = await stravaGet(`/activities/${req.params.id}/streams`, { keys, key_by_type: true }, req.user.id);
    res.json(data);
  } catch (err) {
    console.error('[strava]', err.message);
    res.status(502).json({ error: err.message });
  }
});

app.get('/api/strava/athlete', requireAuth, async (req, res) => {
  try {
    const [athlete, stats] = await Promise.all([
      stravaGet('/athlete', {}, req.user.id),
      stravaGet(`/athletes/${req.user.stravaId}/stats`, {}, req.user.id),
    ]);
    res.json({ athlete, stats });
  } catch (err) {
    console.error('[strava]', err.message);
    res.status(502).json({ error: err.message });
  }
});

// ── Phase 7: merged activities (Strava + thin local overrides) ───────────────
// Single source of truth for "what runs happened" — live Strava activities,
// classified once here, with user corrections/local-only entries overlaid from
// activity_overrides. Every tab reads from this so they can never disagree.

app.get('/api/activities', requireAuth, async (req, res) => {
  try {
    const all = [];
    let page = 1;
    while (all.length < 500) {
      const batch = await stravaGet('/athlete/activities', { per_page: 200, page }, req.user.id);
      if (!batch.length) break;
      all.push(...batch);
      if (batch.length < 200) break;
      page++;
    }

    const { data: overrides, error } = await supabase
      .from('activity_overrides')
      .select('id, strava_id, date, dist, dur, type, notes')
      .eq('user_id', req.user.id);
    if (error) return res.status(500).json({ error: error.message });

    const overrideByStravaId = new Map(
      (overrides || []).filter(o => o.strava_id != null).map(o => [String(o.strava_id), o])
    );

    const stravaActivities = all.map(a => {
      const override = overrideByStravaId.get(String(a.id));
      return {
        id:       a.id,
        stravaId: a.id,
        date:     a.start_date_local ? a.start_date_local.substring(0, 10) : null,
        distMi:   parseFloat((a.distance / 1609.34).toFixed(2)),
        durMin:   Math.round(a.moving_time / 60),
        hr:       a.average_heartrate ? Math.round(a.average_heartrate) : null,
        cadence:  a.average_cadence ? Math.round(a.average_cadence * 2) : null,
        name:     a.name || 'Activity',
        source:   'strava',
        raw:      a,
        type:     (override && override.type) || activityClassifier(a),
        notes:    (override && override.notes) || '',
      };
    });

    const localActivities = (overrides || [])
      .filter(o => o.strava_id == null)
      .map(o => ({
        id:       `local-${o.id}`,
        stravaId: null,
        date:     o.date,
        distMi:   o.dist,
        durMin:   o.dur,
        hr:       null,
        cadence:  null,
        name:     o.type || 'Activity',
        source:   'manual',
        raw:      null,
        type:     o.type || 'Easy',
        notes:    o.notes || '',
      }));

    const merged = [...stravaActivities, ...localActivities]
      .sort((x, y) => (y.date || '').localeCompare(x.date || ''));

    res.json(merged);
  } catch (err) {
    console.error('[activities]', err.message);
    res.status(502).json({ error: err.message });
  }
});

// Upsert a type/notes correction for a Strava-linked activity.
app.put('/api/activities/:strava_id/override', requireAuth, async (req, res) => {
  const stravaId = parseInt(req.params.strava_id, 10);
  if (!Number.isFinite(stravaId)) return res.status(400).json({ error: 'invalid strava_id' });
  const { type, notes } = req.body;
  const { error } = await supabase
    .from('activity_overrides')
    .upsert(
      { user_id: req.user.id, strava_id: stravaId, type: type ?? null, notes: notes ?? null },
      { onConflict: 'user_id,strava_id' }
    );
  if (error) return res.status(500).json({ error: error.message });
  res.json({ ok: true });
});

// Create a local-only activity entry with no Strava counterpart (cross-training, rest day, etc.)
app.post('/api/activities/manual', requireAuth, async (req, res) => {
  const { date, dist, dur, type, notes } = req.body;
  if (!date || dist == null || dur == null) {
    return res.status(400).json({ error: 'date, dist, and dur are required' });
  }
  const { data, error } = await supabase
    .from('activity_overrides')
    .insert({
      user_id:   req.user.id,
      strava_id: null,
      date,
      dist:      parseFloat(dist),
      dur:       parseInt(dur, 10),
      type:      type || 'Easy',
      notes:     notes || null,
    })
    .select('id')
    .single();
  if (error) return res.status(500).json({ error: error.message });
  res.json({ ok: true, id: data.id });
});

// Update a local-only activity entry in place.
app.put('/api/activities/manual/:id', requireAuth, async (req, res) => {
  const { date, dist, dur, type, notes } = req.body;
  const fields = {};
  if (date !== undefined)  fields.date  = date;
  if (dist !== undefined)  fields.dist  = parseFloat(dist);
  if (dur !== undefined)   fields.dur   = parseInt(dur, 10);
  if (type !== undefined)  fields.type  = type;
  if (notes !== undefined) fields.notes = notes;
  fields.updated_at = new Date().toISOString();

  const { error } = await supabase
    .from('activity_overrides')
    .update(fields)
    .eq('id', req.params.id)
    .eq('user_id', req.user.id)
    .is('strava_id', null);
  if (error) return res.status(500).json({ error: error.message });
  res.json({ ok: true });
});

// Remove a local-only activity entry.
app.delete('/api/activities/manual/:id', requireAuth, async (req, res) => {
  const { error } = await supabase
    .from('activity_overrides')
    .delete()
    .eq('id', req.params.id)
    .eq('user_id', req.user.id)
    .is('strava_id', null);
  if (error) return res.status(500).json({ error: error.message });
  res.json({ ok: true });
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

// ── Team leaderboard ──────────────────────────────────────────────────────────

function isoDate(date) {
  return date.toISOString().slice(0, 10);
}

function weekStartOf(dateStr) {
  const d = new Date(dateStr + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() - d.getUTCDay());
  return isoDate(d);
}

function addDays(dateStr, n) {
  const d = new Date(dateStr + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + n);
  return isoDate(d);
}

function computeMetrics(runs, today) {
  const thisWeek = weekStartOf(today);

  const weeklyMiles = runs
    .filter(r => weekStartOf(r.date) === thisWeek)
    .reduce((s, r) => s + parseFloat(r.dist), 0);

  const cut30 = addDays(today, -30);
  const longestRun = runs
    .filter(r => r.date >= cut30 && r.type !== 'Cross-train')
    .reduce((max, r) => Math.max(max, parseFloat(r.dist)), 0);

  const activityDates = new Set(runs.map(r => r.date));
  let streak = 0;
  let check = today;
  while (activityDates.has(check)) {
    streak++;
    check = addDays(check, -1);
  }

  const cut8 = addDays(today, -56);
  const cut4 = addDays(today, -28);
  const runRuns = runs.filter(r => r.dist > 0 && r.dur > 0 && r.type !== 'Cross-train');
  const recent  = runRuns.filter(r => r.date >= cut4);
  const prior   = runRuns.filter(r => r.date >= cut8 && r.date < cut4);

  function avgPace(arr) {
    if (!arr.length) return null;
    return arr.reduce((s, r) => s + r.dur / parseFloat(r.dist), 0) / arr.length;
  }
  const rp = avgPace(recent);
  const pp = avgPace(prior);
  const paceImprovement = rp != null && pp != null ? parseFloat((pp - rp).toFixed(2)) : 0;

  return {
    weeklyMiles:     parseFloat(weeklyMiles.toFixed(2)),
    longestRun:      parseFloat(longestRun.toFixed(2)),
    streak,
    paceImprovement,
  };
}

app.get('/api/team/leaderboard', requireAuth, async (req, res) => {
  try {
    const [{ data: users, error: userErr }, { data: manualRows, error: manualErr }] = await Promise.all([
      supabase.from('users').select('id, name'),
      supabase.from('activity_overrides')
        .select('user_id, date, dist, dur, type')
        .is('strava_id', null),
    ]);
    if (userErr)  return res.status(500).json({ error: userErr.message });
    if (manualErr) return res.status(500).json({ error: manualErr.message });

    const today   = isoDate(new Date());
    const since90 = addDays(today, -90);
    const after90 = Math.floor(new Date(since90 + 'T00:00:00Z').getTime() / 1000);

    // Manual entries from activity_overrides (no strava_id = manually logged)
    const manualByUser = {};
    for (const r of manualRows ?? []) {
      if (!manualByUser[r.user_id]) manualByUser[r.user_id] = [];
      manualByUser[r.user_id].push({
        date: r.date, dist: parseFloat(r.dist), dur: r.dur, type: r.type ?? 'Easy',
      });
    }

    // Fetch live Strava activities for each user in parallel.
    // Uses server-side token access (the same getValidAccessToken path used by /api/activities).
    // Failures are silenced — a user with a broken token just shows 0 Strava runs.
    const stravaByUser = {};
    await Promise.all((users ?? []).map(async u => {
      try {
        const batch = await stravaGet('/athlete/activities', { per_page: 200, after: after90 }, u.id);
        stravaByUser[u.id] = batch
          .filter(a => (a.sport_type || a.type || '').toLowerCase() === 'run')
          .map(a => ({
            date: a.start_date_local?.substring(0, 10) ?? '',
            dist: parseFloat((a.distance / 1609.34).toFixed(2)),
            dur:  Math.round(a.moving_time / 60),
            type: activityClassifier(a),
          }));
      } catch {
        stravaByUser[u.id] = [];
      }
    }));

    const leaderboard = (users ?? []).map(u => ({
      id:      u.id,
      name:    u.name,
      metrics: computeMetrics([...(stravaByUser[u.id] ?? []), ...(manualByUser[u.id] ?? [])], today),
    }));

    res.json(leaderboard);
  } catch (err) {
    console.error('[team]', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ── Admin (owner-only user management) ───────────────────────────────────────
// Strava access tokens are valid for ~6 hours; the timestamp a token was issued
// (expires_at - that window) is the closest signal we have to "last active",
// since this app fetches activities live rather than running a tracked sync job.
const STRAVA_TOKEN_TTL_SECONDS = 6 * 60 * 60;

app.get('/api/admin/users', requireAdmin, async (req, res) => {
  try {
    const [{ data: users, error: userErr }, { data: tokens, error: tokenErr }] = await Promise.all([
      supabase.from('users').select('*'),
      supabase.from('strava_tokens').select('user_id, expires_at'),
    ]);
    if (userErr)  return res.status(500).json({ error: userErr.message });
    if (tokenErr) return res.status(500).json({ error: tokenErr.message });

    const tokenByUser = new Map((tokens ?? []).map(t => [t.user_id, t]));

    const list = (users ?? []).map(u => {
      const token = tokenByUser.get(u.id);
      const lastActiveAt = token
        ? new Date((token.expires_at - STRAVA_TOKEN_TTL_SECONDS) * 1000).toISOString()
        : null;
      return {
        id:          u.id,
        name:        u.name,
        stravaId:    u.strava_id,
        avatarUrl:   u.avatar_url ?? null,
        isAdmin:     !!u.is_admin,
        joinedAt:    u.created_at ?? null,
        lastActiveAt,
      };
    });

    list.sort((a, b) => (b.joinedAt ?? '').localeCompare(a.joinedAt ?? ''));
    res.json(list);
  } catch (err) {
    console.error('[admin/users]', err.message);
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/admin/users/:id', requireAdmin, async (req, res) => {
  const { id } = req.params;
  if (id === req.user.id) return res.status(400).json({ error: "Can't remove your own account" });

  try {
    // Children first — in case a table is missing an `on delete cascade` FK,
    // this still leaves no orphaned rows. Each is a no-op if already empty.
    for (const table of ['strava_tokens', 'activity_overrides', 'plan_settings', 'plan_overrides', 'runs']) {
      const { error } = await supabase.from(table).delete().eq('user_id', id);
      if (error) return res.status(500).json({ error: `${table}: ${error.message}` });
    }
    const { error: userErr } = await supabase.from('users').delete().eq('id', id);
    if (userErr) return res.status(500).json({ error: userErr.message });

    console.log('[admin] removed user', id, '— by', req.user.name);
    res.json({ ok: true });
  } catch (err) {
    console.error('[admin/users delete]', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ── Health checks ─────────────────────────────────────────────────────────────

app.get('/api/health', (_req, res) => res.json({ ok: true, queueLength: readQueue().length }));
app.get('/health',     (_req, res) => res.json({ ok: true }));

// ── Start ─────────────────────────────────────────────────────────────────────

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`[api] listening on port ${PORT}`);
  console.log(`[api] Supabase: ${process.env.SUPABASE_URL ? 'configured' : 'NOT CONFIGURED — set SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY'}`);
  console.log(`[api] JWT:      ${JWT_SECRET ? 'configured' : 'NOT CONFIGURED — set JWT_SECRET'}`);
  console.log(`[api] Frontend: ${FRONTEND_URL}`);
});
