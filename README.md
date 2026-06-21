# GymBuddy 💪

**Your phone, turned into a personal gym coach.** Build your workouts once, then
let GymBuddy run them with you at the gym — live countdowns, rep pacing, audio
cues — and quietly log every set so you can watch yourself get stronger.

Installs straight to your home screen like a native app, works offline on the gym
floor, and your whole history exports to a spreadsheet whenever you want it.

### ✨ What it does
- 🏋️ **Three kinds of exercise** — reps & weights, timed (cycling, rowing…), and
  target/stopwatch (e.g. "30 stair flights").
- ⏱️ **Guided workout mode** — reps count down in a big on-screen ring, timers and
  rest periods run themselves, with beeps and a spoken 3-2-1.
- 🧩 **Build & reorder on the fly** — do exercises in any order, add more mid-session,
  or freestyle a quick session and save it as a workout.
- 📈 **Track everything** — weight, reps, distance, calories, effort (1–10), notes,
  and even the **weather** at each session. Progress charts + one-tap CSV export.
- 🔐 **Passwordless login** — just your email and a 6-digit code.
- 📶 **Offline-first** — log sets with no signal; they sync automatically when you're back.
- 📲 **Installable PWA** — add to home screen on iOS or Android, runs full-screen.

### 🛠️ Built with
- **Frontend:** TypeScript + Vite, vanilla (no framework) — installable PWA with a
  service worker and an IndexedDB offline sync queue.
- **Backend:** plain PHP 8 REST API + MySQL (also runs on SQLite for local dev) —
  no framework, no build step on the server.
- **Auth:** signed HMAC session tokens; 6-digit email login codes.

Designed to drop into a subfolder of any PHP/MySQL host (built and tested on cPanel).

---

## Local development

You need Node 18+ and PHP 8 (with `pdo_sqlite`). Locally the API uses a SQLite
file so you don't need MySQL; on the server it uses MySQL automatically.

```bash
npm install

# Terminal 1 — PHP API on :8787 using a local SQLite db, login codes written to a log
GYMBUDDY_DB=sqlite npm run api

# Terminal 2 — Vite dev server (proxies /dev/GymBuddy/api -> :8787)
npm run dev
```

Open the printed URL (e.g. `http://localhost:5173/dev/GymBuddy/`).
In dev, login codes are **not emailed** — they're appended to `api/data/mail.log`.

Other scripts:
- `npm run build` — type-check + production build into `dist/`
- `npm run icons` — regenerate all icons from `public/icons/icon.svg`
- `npm run e2e` — headless-Chromium end-to-end test (needs the prod-mirror server running)

---

## Deploying to cPanel

### 1. Create the MySQL database
In cPanel → MySQL Databases, create a database and a user with ALL PRIVILEGES,
e.g. DB `gymbuddy`, user `gymbuddy_user`, and a generated password.

### 2. Import the schema
cPanel → **phpMyAdmin** → select `gymbuddy` → **Import** →
upload [`api/schema.mysql.sql`](api/schema.mysql.sql) → Go.

### 3. Build the frontend
```bash
npm install && npm run build
```
This produces `dist/` (the app shell, hashed assets, `manifest.webmanifest`,
`sw.js`, icons).

### 4. Upload files
In cPanel **File Manager**, into `public_html/dev/GymBuddy/`:

| Upload | To |
|---|---|
| **contents of `dist/`** | `public_html/dev/GymBuddy/` |
| the whole **`api/`** folder | `public_html/dev/GymBuddy/api/` |

So you end up with `…/dev/GymBuddy/index.html` and `…/dev/GymBuddy/api/index.php`.

### 5. Configure the API
1. Copy `api/config.sample.php` to `api/config.php`.
2. Edit `api/config.php`:
   - Set `'db_driver' => 'mysql'` (or leave it — it defaults to mysql when the
     `GYMBUDDY_DB` env var is absent, which it is on cPanel).
   - Fill in your MySQL database name, user and password.
   - Set a long random **`app_secret`** (e.g. `openssl rand -hex 32`).
   - Set `mail_from` to a **real mailbox you create in cPanel**, e.g.
     `gymbuddy@your-domain.com`.
3. Make sure `api/data/` is writable (it stores logs only on the server). 0755 is fine.

### 6. Confirm `.htaccess` and HTTPS
`api/.htaccess` routes `/api/*` to the PHP front controller and blocks direct
access to config/db/logs. Its `RewriteBase` is already set to
`/dev/GymBuddy/api/`. A PWA **requires HTTPS** — enable AutoSSL in cPanel for the
domain if it isn't already.

### 7. Smoke test
- Visit `https://your-domain.com/dev/GymBuddy/api/health` → should return JSON
  `{"ok":true,"driver":"mysql",...}`.
- Visit `https://your-domain.com/dev/GymBuddy/` → enter your email → you should
  receive a 6-digit code by email → sign in.

If the email doesn't arrive: check cPanel → Email → that the `mail_from` mailbox
exists, and look in `api/data/error.log`.

---

## Installing on a phone
- **iPhone (Safari):** Share → *Add to Home Screen*.
- **Android (Chrome):** the *Install app* prompt, or ⋮ → *Add to Home screen*.

It then runs full-screen with the GymBuddy icon, and works offline.

---

## How the pieces fit

```
dev/GymBuddy/
├── index.html, assets/, sw.js, manifest.webmanifest, icons/   ← built frontend (from dist/)
└── api/
    ├── index.php            ← front controller + route table
    ├── .htaccess            ← /api/* → index.php, protects secrets
    ├── config.php           ← YOUR secrets (not in git)
    ├── schema.mysql.sql     ← import once
    ├── lib/                 ← db, http, auth (HMAC tokens), mail
    ├── routes/              ← auth, exercises, workouts, sessions, export, meta
    └── data/                ← logs (server) / sqlite db (local dev)
```

### Data model
- **Exercise** — a reusable move, one of three types:
  - **Reps** — weight + a *routine* (ordered warm-up / set / cooldown / rest steps)
    and a reps-per-minute pace that drives the per-set countdown.
  - **Timed** — a fixed duration (e.g. cycling), plus configurable end-of-session
    metrics (distance, calories).
  - **Target** — a goal like "30 flights" run against a count-up stopwatch; you log
    your time plus configurable metrics at the end.
- **Workout** — a named, ordered list of exercises.
- **Session** — one logged run of a workout (start/end, overall comments).
- **SetResult** — the numbers recorded per set, including an **effort score (1–10)**
  and per-exercise notes captured at the end of each exercise.

> **Re-importing the schema:** if you imported an earlier version, drop the old
> tables in phpMyAdmin before importing `schema.mysql.sql` again (the exercise
> and set_results tables changed).

### API endpoints
```
POST /auth/request            {email}            → emails a code
POST /auth/verify             {email,code}       → {token}
GET  /me
GET/POST           /exercises
PUT/DELETE         /exercises/{id}
GET/POST           /workouts
GET/PUT/DELETE     /workouts/{id}
GET/POST           /sessions          (POST is idempotent on client_uid for offline sync)
GET/DELETE         /sessions/{id}
GET  /progress/{exerciseId}
GET  /export.csv?token=...
```

### Notes
- Sessions sync offline-first: logged to IndexedDB, pushed to the server when
  online, de-duplicated server-side by `client_uid`.
- Deleting an exercise/workout **archives** it so historical results stay intact.
- Apple Health sync is intentionally **not** in v1 (HealthKit needs a native iOS
  app). The CSV export is the bridge for now.
