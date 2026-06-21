-- GymBuddy schema (MySQL / MariaDB) — import via phpMyAdmin on cPanel.
-- Re-importing: drop the old tables first if you changed the schema.
SET NAMES utf8mb4;

CREATE TABLE IF NOT EXISTS users (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  email       VARCHAR(255) NOT NULL UNIQUE,
  created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS login_codes (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  user_id     INT NOT NULL,
  code_hash   VARCHAR(255) NOT NULL,
  expires_at  DATETIME NOT NULL,
  attempts    INT NOT NULL DEFAULT 0,
  used        TINYINT NOT NULL DEFAULT 0,
  created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_lc_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS exercises (
  id                 INT AUTO_INCREMENT PRIMARY KEY,
  user_id            INT NOT NULL,
  name               VARCHAR(255) NOT NULL,
  description        TEXT NULL,
  machine_number     VARCHAR(64) NULL,
  type               ENUM('reps','timed','target') NOT NULL DEFAULT 'reps',
  equipment_settings TEXT NULL,            -- free text / notes on seat, incline, pin, etc.
  unit               VARCHAR(16) NULL,     -- kg/lb, km/mi, etc.

  -- Reps type
  reps_per_minute    INT NULL,             -- pace used to time each set
  default_weight     DECIMAL(7,2) NULL,
  steps              TEXT NULL,            -- JSON: ordered routine of warmup/set/cooldown/rest

  -- Timed type
  default_duration_secs INT NULL,

  -- Target type
  target_value       DECIMAL(9,2) NULL,    -- e.g. 30
  target_label       VARCHAR(64) NULL,     -- e.g. "flights"

  -- Timed + Target: JSON array of extra metrics to capture, e.g. ["distance","calories"]
  metrics            TEXT NULL,

  archived           TINYINT NOT NULL DEFAULT 0,
  created_at         DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_ex_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS workouts (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  user_id     INT NOT NULL,
  name        VARCHAR(255) NOT NULL,
  description TEXT NULL,
  archived    TINYINT NOT NULL DEFAULT 0,
  created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_wo_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS workout_items (
  id           INT AUTO_INCREMENT PRIMARY KEY,
  workout_id   INT NOT NULL,
  exercise_id  INT NOT NULL,
  position     INT NOT NULL DEFAULT 0,
  CONSTRAINT fk_wi_workout  FOREIGN KEY (workout_id)  REFERENCES workouts(id)  ON DELETE CASCADE,
  CONSTRAINT fk_wi_exercise FOREIGN KEY (exercise_id) REFERENCES exercises(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS sessions (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  user_id     INT NOT NULL,
  workout_id  INT NULL,
  client_uid  VARCHAR(64) NULL UNIQUE,     -- dedupe key for offline sync
  started_at  DATETIME NOT NULL,
  ended_at    DATETIME NULL,
  comments    TEXT NULL,
  ambient     TEXT NULL,                   -- JSON: weather snapshot at finish
  created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_se_user    FOREIGN KEY (user_id)    REFERENCES users(id)    ON DELETE CASCADE,
  CONSTRAINT fk_se_workout FOREIGN KEY (workout_id) REFERENCES workouts(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS set_results (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  session_id    INT NOT NULL,
  exercise_id   INT NOT NULL,
  set_number    INT NOT NULL DEFAULT 1,
  reps          INT NULL,
  weight        DECIMAL(7,2) NULL,
  distance      DECIMAL(9,2) NULL,
  duration_secs INT NULL,
  calories      INT NULL,
  effort        TINYINT NULL,              -- perceived effort 1-10
  extras        TEXT NULL,                 -- JSON of custom metrics, e.g. {"Floors climbed":30}
  comments      TEXT NULL,
  recorded_at   DATETIME NOT NULL,
  CONSTRAINT fk_sr_session  FOREIGN KEY (session_id)  REFERENCES sessions(id)  ON DELETE CASCADE,
  CONSTRAINT fk_sr_exercise FOREIGN KEY (exercise_id) REFERENCES exercises(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE INDEX idx_ex_user      ON exercises(user_id);
CREATE INDEX idx_wo_user      ON workouts(user_id);
CREATE INDEX idx_wi_workout   ON workout_items(workout_id);
CREATE INDEX idx_se_user      ON sessions(user_id);
CREATE INDEX idx_sr_session   ON set_results(session_id);
CREATE INDEX idx_sr_exercise  ON set_results(exercise_id);
