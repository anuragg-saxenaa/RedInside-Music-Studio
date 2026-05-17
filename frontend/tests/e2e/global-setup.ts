/**
 * Global setup: runs once before all Playwright specs.
 *
 * 1. HARD FAIL if backend is using real MiniMax API — would burn credits.
 *    Backend must be started with: MINIMAX_BASE_URL=http://localhost:8999 npm run dev
 *    or via: npm run dev:mock  (in backend/)
 *
 * 2. Clean up orphaned test projects from previous runs.
 */
export default async function globalSetup() {
  // ── 1. Enforce mock mode — abort if backend explicitly uses real MiniMax ──
  try {
    const health = await fetch('http://localhost:3000/health');
    if (health.ok) {
      const body = await health.json() as { minimax?: string; minimaxHost?: string };

      if (body.minimax === 'real') {
        // Definitive: backend reports real API → abort
        throw new Error(
          `\n\n` +
          `╔══════════════════════════════════════════════════════════════╗\n` +
          `║  BLOCKED: Backend is connected to REAL MiniMax API          ║\n` +
          `║  Running tests would exhaust your daily API credits.         ║\n` +
          `║                                                              ║\n` +
          `║  Restart backend in mock mode:                               ║\n` +
          `║    cd backend && npm run dev:mock                            ║\n` +
          `╚══════════════════════════════════════════════════════════════╝\n`
        );
      } else if (body.minimax === 'mock') {
        console.log(`[global-setup] Backend mock mode verified (${body.minimaxHost})`);
      } else {
        // Old backend code — health has no minimax field yet.
        // Fall back: verify mock server is reachable at port 8999.
        try {
          const mockPing = await fetch('http://localhost:8999');
          if (mockPing.ok) {
            console.log('[global-setup] Mock server reachable at :8999 — assuming mock mode');
          } else {
            console.warn('[global-setup] WARNING: Cannot confirm mock mode. Restart backend with: npm run dev:mock');
          }
        } catch {
          console.warn('[global-setup] WARNING: Mock server not reachable at :8999. Restart backend with: npm run dev:mock');
        }
      }
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    if (message.includes('BLOCKED')) throw err;
    console.warn('[global-setup] Backend health check failed — may not be running yet');
  }

  // ── 2. Clean up orphaned test projects ────────────────────────────────────
  try {
    const res = await fetch('http://localhost:3000/api/projects');
    if (!res.ok) return;
    const projects: Array<{ id: string; name: string }> = await res.json();

    const testPattern = /test|audit|pipeline|walkthrough|real_user|batch|mastering|delete|contract|processor|worker|img_|fixture|workflow|audio|medley|upload|history|viral|api test|jobs|settings|complete|alias|convert|lyrics test|music test|video test|voice test|model valid|renamed|version track|multi v|core test|404_|playlist|find_|user_|zip_/i;

    const toDelete = projects.filter(p => testPattern.test(p.name));
    await Promise.all(
      toDelete.map(p =>
        fetch(`http://localhost:3000/api/projects/${p.id}`, { method: 'DELETE' }).catch(() => {})
      )
    );
    if (toDelete.length > 0) {
      console.log(`[global-setup] Cleaned ${toDelete.length} orphaned test projects`);
    }
  } catch {
    // Backend not running or no projects — fine
  }
}
