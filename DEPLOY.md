# Deploying GymBuddy

The whole app — frontend **and** PHP backend — builds into a single folder, `dist/`,
so deploying an update is "build, then upload one folder."

## 1. Build

```bash
npm run build
```

This produces `dist/` containing:

```
dist/
├── index.html            ← the BUILT shell (loads assets/index-*.js)
├── assets/  sw.js  workbox-*.js  manifest.webmanifest  icons/
└── api/                  ← PHP backend, copied in automatically (incl. config.php)
```

The `api/` folder is copied into `dist/` by a post-build step in
[`vite.config.ts`](vite.config.ts) (`copyApiToDist`). You do **not** copy it by hand.

## 2. Upload to the server

Sync the **contents of `dist/`** into `public_html/dev/GymBuddy/` (overwrite existing
files). After it, the server should look exactly like the tree above.

> ⚠️ **The #1 deploy mistake:** uploading the project root instead of `dist/`.
> The root `index.html` is the *dev* file — it loads `/src/main.ts`, which a browser
> can't run, giving a blank/white screen. Only ever deploy `dist/`. Never upload
> `src/`, `node_modules/`, `package.json`, `vite.config.ts`, etc.

> ⚠️ **Don't delete the `api/` folder on the server** during cleanup. If you ever do,
> re-running `npm run build` + uploading `dist/` restores it (config included).

When replacing files, also remove **old hashed assets** (e.g. a previous
`assets/index-<oldhash>.js`) so only the current build remains.

## 3. Secrets / `config.php`

`api/config.php` holds the live MySQL credentials, `app_secret`, and mail settings.
It is **git-ignored** (never committed) but **is** copied into `dist/api/` at build
time, so it ships with the deploy. Keep your local `api/config.php` as the source of
truth — if you rotate the DB password or secret, update it there and rebuild.

## 4. Verify

1. `https://walker-jones.eu/dev/GymBuddy/api/health` → `{"ok":true,"driver":"mysql",...}`
2. `https://walker-jones.eu/dev/GymBuddy/` → app loads; version pill / Settings footer
   shows the new version.
3. The service worker auto-updates installed phones on next launch.

## Bumping the version

Update the version in **both** [`src/version.ts`](src/version.ts) and
[`package.json`](package.json) before building, so the in-app version and the
"Updated to vX 🎉" toast are correct.
