-- GymBuddy schema (SQLite) — used automatically for local dev.

CREATE TABLE IF NOT EXISTS users (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  email       TEXT NOT NULL UNIQUE,
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS login_codes (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  code_hash   TEXT NOT NULL,
  expires_at  TEXT NOT NULL,
  attempts    INTEGER NOT NULL DEFAULT 0,
  used        INTEGER NOT NULL DEFAULT 0,
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS exercises (
  id                 INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id            INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name               TEXT NOT NULL,
  description        TEXT,
  machine_number     TEXT,
  type               TEXT NOT NULL DEFAULT 'reps',
  equipment_settings TEXT,
  unit               TEXT,
  reps_per_minute    INTEGER,
  default_weight     REAL,
  steps              TEXT,
  default_duration_secs INTEGER,
  target_value       REAL,
  target_label       TEXT,
  metrics            TEXT,
  archived           INTEGER NOT NULL DEFAULT 0,
  created_at         TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS workouts (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  description TEXT,
  archived    INTEGER NOT NULL DEFAULT 0,
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS workout_items (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  workout_id   INTEGER NOT NULL REFERENCES workouts(id) ON DELETE CASCADE,
  exercise_id  INTEGER NOT NULL REFERENCES exercises(id) ON DELETE CASCADE,
  position     INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS sessions (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  workout_id  INTEGER REFERENCES workouts(id) ON DELETE SET NULL,
  client_uid  TEXT UNIQUE,
  started_at  TEXT NOT NULL,
  ended_at    TEXT,
  comments    TEXT,
  ambient     TEXT,
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS set_results (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id    INTEGER NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  exercise_id   INTEGER NOT NULL REFERENCES exercises(id) ON DELETE CASCADE,
  set_number    INTEGER NOT NULL DEFAULT 1,
  reps          INTEGER,
  weight        REAL,
  distance      REAL,
  duration_secs INTEGER,
  calories      INTEGER,
  effort        INTEGER,
  extras        TEXT,
  comments      TEXT,
  recorded_at   TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_ex_user     ON exercises(user_id);
CREATE INDEX IF NOT EXISTS idx_wo_user     ON workouts(user_id);
CREATE INDEX IF NOT EXISTS idx_wi_workout  ON workout_items(workout_id);
CREATE INDEX IF NOT EXISTS idx_se_user     ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sr_session  ON set_results(session_id);
CREATE INDEX IF NOT EXISTS idx_sr_exercise ON set_results(exercise_id);
