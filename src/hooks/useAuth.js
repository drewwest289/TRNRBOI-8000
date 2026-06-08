import { useState, useEffect } from 'react';

const TOKEN_KEY = 'trnr_auth_token';

// Decode the JWT payload without verifying the signature (verification happens on the server).
function decodeToken(token) {
  try {
    const payload = token.split('.')[1];
    return JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/')));
  } catch {
    return null;
  }
}

function isExpired(decoded) {
  if (!decoded?.exp) return true;
  return Date.now() / 1000 > decoded.exp;
}

function loadStoredToken() {
  const token = localStorage.getItem(TOKEN_KEY);
  if (!token) return null;
  const decoded = decodeToken(token);
  if (!decoded || isExpired(decoded)) {
    localStorage.removeItem(TOKEN_KEY);
    return null;
  }
  return { token, decoded };
}

export function useAuth() {
  const [auth, setAuth] = useState(() => loadStoredToken());

  // On mount: check if the URL has ?token= (redirect back from Strava OAuth).
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const urlToken    = params.get('token');
    const urlAuthErr  = params.get('auth_error');

    // Strip the query params from the URL regardless of outcome.
    if (urlToken || urlAuthErr) {
      const clean = window.location.pathname + window.location.hash;
      window.history.replaceState(null, '', clean);
    }

    if (urlAuthErr) {
      console.error('[auth] OAuth error:', decodeURIComponent(urlAuthErr));
      return;
    }

    if (urlToken) {
      const decoded = decodeToken(urlToken);
      if (decoded && !isExpired(decoded)) {
        localStorage.setItem(TOKEN_KEY, urlToken);
        setAuth({ token: urlToken, decoded });
      }
    }
  }, []);

  function logout() {
    localStorage.removeItem(TOKEN_KEY);
    setAuth(null);
    // Let the server know (fire-and-forget).
    fetch('/api/auth/logout', { method: 'POST' }).catch(() => {});
  }

  const user = auth
    ? { id: auth.decoded.sub, stravaId: auth.decoded.stravaId, name: auth.decoded.name, isAdmin: !!auth.decoded.isAdmin }
    : null;

  return { user, token: auth?.token ?? null, logout };
}
