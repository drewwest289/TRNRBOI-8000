import express from 'express';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Where the pending-workout queue file lives.
// Default: server/ directory (local dev).
// On Render set QUEUE_DIR=/tmp — the working dir is read-only in prod.
const QUEUE_DIR  = process.env.QUEUE_DIR ?? __dirname;
const QUEUE_FILE = path.join(QUEUE_DIR, 'pending.json');

// ── Normalize ─────────────────────────────────────────────────────────────────
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
    // Corrupted file or unreadable path — start fresh rather than crashing.
    return [];
  }
}

function writeQueue(q) { fs.writeFileSync(QUEUE_FILE, JSON.stringify(q, null, 2)); }

function isDuplicateInQueue(queue, workout) {
  // Same date and within 0.01 mi counts as a duplicate.
  return queue.some(q =>
    q.date === workout.date &&
    Math.abs((q.distMi ?? 0) - (workout.distMi ?? 0)) < 0.01
  );
}

// ── Express ───────────────────────────────────────────────────────────────────

// CORS origins — comma-separated list in CORS_ORIGINS env var.
// Add your Cloudflare Pages URL (e.g. https://your-app.pages.dev) in the Render dashboard.
const CORS_ORIGINS = process.env.CORS_ORIGINS
  ? process.env.CORS_ORIGINS.split(',').map(s => s.trim())
  : ['http://localhost:5173', 'http://localhost:5174', 'http://127.0.0.1:5173'];

const app = express();
app.use(cors({ origin: CORS_ORIGINS }));
app.use(express.json({ limit: '25mb' }));

// POST /api/workouts — receive from Apple Shortcuts (single workout)
// Also accepts a full Health Auto Export bulk export { data: { workouts: [] } }
app.post('/api/workouts', (req, res) => {
  const raw = req.body;
  if (!raw) return res.status(400).json({ error: 'Empty body' });

  // Normalise: support both a single workout object and a full HAE bulk export.
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

  // Validate: each workout must have at least a date.
  const valid = incoming.filter(w => w.date);
  if (valid.length === 0) {
    return res.status(422).json({ error: 'No workouts with a valid date found.' });
  }

  const queue  = readQueue();
  let added = 0, dupes = 0;
  for (const workout of valid) {
    if (isDuplicateInQueue(queue, workout)) {
      dupes++;
      continue;
    }
    queue.push({ ...workout, receivedAt: new Date().toISOString() });
    added++;
    console.log(`[api] queued: ${workout.name} on ${workout.date} — ${workout.distMi?.toFixed(2) ?? 'no dist'} mi`);
  }

  writeQueue(queue);
  res.json({ ok: true, added, dupes, queueLength: queue.length });
});

// GET /api/workouts/pending — React app polls this
app.get('/api/workouts/pending', (_req, res) => {
  res.json(readQueue());
});

// DELETE /api/workouts/pending — React app calls this after committing to Dexie
app.delete('/api/workouts/pending', (_req, res) => {
  writeQueue([]);
  res.json({ ok: true });
});

// Health check — Render pings one of these to confirm the service is alive.
// /api/health  — used by the React app's WatchSyncCard status check
// /health      — Render's default health-check path convention
app.get('/api/health', (_req, res) => res.json({ ok: true, queueLength: readQueue().length }));
app.get('/health',     (_req, res) => res.json({ ok: true }));

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`[api] listening on port ${PORT}`);
  console.log(`[api] queue file : ${QUEUE_FILE}`);
  console.log(`[api] CORS origins: ${CORS_ORIGINS.join(', ')}`);
  console.log(`[api]`);
  console.log(`[api]   POST   /api/workouts          — Apple Shortcuts → single workout or bulk HAE export`);
  console.log(`[api]   GET    /api/workouts/pending   — React app polls`);
  console.log(`[api]   DELETE /api/workouts/pending   — React app clears after sync`);
  console.log(`[api]   GET    /health                 — Render health check`);
});
