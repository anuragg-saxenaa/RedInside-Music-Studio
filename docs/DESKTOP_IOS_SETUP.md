# Desktop (macOS/Tauri) & iOS (Capacitor) Setup

Both wrap the **same** React web app. Data stays synced (shared Turso + R2). The web/PWA app is unaffected — these are extra build targets.

All commands run from `frontend/`.

---

## B — macOS Desktop (Tauri)

Produces a native `.app` / `.dmg`.

**One-time prerequisites (your Mac):**
```bash
# Rust toolchain (Tauri's native shell)
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
# Xcode command-line tools (usually already present)
xcode-select --install
```

**First-time init (generates src-tauri/ Rust crate around the existing tauri.conf.json):**
```bash
cd frontend
npx tauri init --ci \
  --app-name "RedInside Studio" \
  --window-title "RedInside Studio" \
  --frontend-dist ../dist \
  --dev-url http://localhost:5173 \
  --before-dev-command "npm run dev" \
  --before-build-command "npm run build"
# generate native icons from our logo
npx tauri icon public/icons/icon-512.png
```
(`tauri.conf.json` with our window/bundle settings is already committed; `init` fills in the Rust crate + Cargo.toml.)

**Run / build:**
```bash
npm run tauri:dev      # live desktop dev window
npm run tauri:build    # → src-tauri/target/release/bundle/dmg/*.dmg
```

The app loads the bundled `dist` (offline-capable via the PWA service worker) and uses `VITE_API_BASE_URL` to reach the production backend (Render). Media keys / Now Playing work via the Media Session integration (sub-project E).

**Distribution:** an unsigned `.app` runs locally (right-click → Open). For Gatekeeper-clean distribution, sign + notarize with an **Apple Developer ID** (`tauri.conf.json` → `bundle.macOS.signingIdentity`).

---

## C — iOS (Capacitor)

Produces a real Xcode project / App Store build.

**One-time prerequisites:** Xcode + CocoaPods (`sudo gem install cocoapods`), and an **Apple Developer account** to run on device / submit.

**Add the iOS project (generated from `capacitor.config.ts`):**
```bash
cd frontend
npm run build
npm run ios:add        # cap add ios  → creates ios/ (gitignored)
npm run ios:sync       # build + cap sync ios
npm run ios:open       # opens Xcode
```

In Xcode: pick your Team (signing), then Run on a simulator/device, or Product → Archive → distribute to App Store / TestFlight.

The web build is the source of truth (already E2E-tested). Background audio + lock-screen controls come from the existing `<audio>` + Media Session. Deep links use the hash router.

**Sync after web changes:** `npm run ios:sync` (rebuilds `dist` and copies into the iOS project).

---

## Notes
- `ios/`, `android/`, `src-tauri/target/`, `src-tauri/gen/` are gitignored (regenerated locally).
- Set `VITE_API_BASE_URL` (build env) to the production backend (`https://redinside-backend.onrender.com`) so native apps reach the same data.
- CI does **not** build native targets (needs Rust/Xcode); the web app + its tests remain the gating pipeline.
