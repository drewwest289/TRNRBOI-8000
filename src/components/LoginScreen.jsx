// The login screen shown to unauthenticated users.
// Clicking "Sign in with Strava" navigates the browser to the backend's
// /auth/strava route, which redirects to Strava, then back to the app
// with a ?token= query param that useAuth picks up.
export default function LoginScreen() {
  function handleLogin() {
    // Vite proxies /auth/* to localhost:3001 in dev; CF worker handles it in prod.
    window.location.href = '/auth/strava';
  }

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        {/* Header */}
        <div className="text-center mb-10">
          <h1
            className="text-white"
            style={{ fontFamily: '"Press Start 2P", monospace', fontSize: '13px', lineHeight: 1.8 }}
          >
            TRNRBOI 8000
          </h1>
          <p className="text-xs mt-2" style={{ color: 'var(--text-muted)' }}>
            16-WEEK TRAINING COMPUTER
          </p>
        </div>

        {/* Card */}
        <div className="card text-center">
          <p className="text-sm mb-1" style={{ color: 'var(--text-primary)' }}>
            Sign in to access your training plan
          </p>
          <p className="text-xs mb-6" style={{ color: 'var(--text-muted)' }}>
            Your runs, plan, and race date are private to your account.
          </p>

          <button
            onClick={handleLogin}
            className="w-full flex items-center justify-center gap-3 py-3 px-4 font-semibold text-sm transition-colors"
            style={{
              background: '#FC4C02',
              color: '#fff',
              fontFamily: '"Space Mono", monospace',
            }}
          >
            {/* Strava wordmark icon */}
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
              <path d="M15.387 17.944l-2.089-4.116h-3.065L15.387 24l5.15-10.172h-3.066m-7.008-5.599l2.836 5.598h4.172L10.463 0 4 13.801h4.171" />
            </svg>
            Sign in with Strava
          </button>
        </div>

        <p className="text-center text-xs mt-6" style={{ color: 'var(--text-muted)', opacity: 0.5 }}>
          A Strava account is required to log in.
        </p>
      </div>
    </div>
  );
}
