<?php
/** Workout sessions + recorded set results, plus progress queries. */

function list_sessions(): void
{
    $user = require_user();
    $rows = q(
        'SELECT s.*, w.name AS workout_name,
                (SELECT COUNT(*) FROM set_results sr WHERE sr.session_id = s.id) AS set_count,
                (SELECT COUNT(DISTINCT sr.exercise_id) FROM set_results sr WHERE sr.session_id = s.id) AS exercise_count
         FROM sessions s
         LEFT JOIN workouts w ON w.id = s.workout_id
         WHERE s.user_id = ?
         ORDER BY s.started_at DESC, s.id DESC',
        [$user['id']]
    );
    send_json(['sessions' => $rows]);
}

function get_session(string $id): void
{
    $user = require_user();
    $s = q1('SELECT * FROM sessions WHERE id = ? AND user_id = ?', [$id, $user['id']]);
    if (!$s) fail('Session not found.', 404);
    $s['ambient'] = !empty($s['ambient']) ? json_decode($s['ambient'], true) : null;
    $sets = q(
        'SELECT sr.*, e.name AS exercise_name, e.type AS exercise_type, e.unit
         FROM set_results sr JOIN exercises e ON e.id = sr.exercise_id
         WHERE sr.session_id = ? ORDER BY sr.id',
        [$id]
    );
    foreach ($sets as &$row) {
        $row['extras'] = !empty($row['extras']) ? json_decode($row['extras'], true) : null;
    }
    $s['sets'] = $sets;
    send_json(['session' => $s]);
}

/**
 * Create OR update a session with its set results in one call.
 *
 * Upsert keyed on client_uid: the client saves after EVERY logged exercise
 * (an in-progress session, ended_at=null), then once more when finishing.
 * Each call carries the full snapshot of sets so far, so we replace the row's
 * sets wholesale. A workout's data therefore reaches permanent storage the
 * moment each exercise is logged — pressing back, killing the app, or losing
 * localStorage can no longer wipe it. Re-posting the same payload is harmless.
 */
function create_session(): void
{
    $user = require_user();
    $b = body();

    $clientUid = isset($b['client_uid']) ? substr((string) $b['client_uid'], 0, 64) : null;
    $existing = $clientUid
        ? q1('SELECT id FROM sessions WHERE user_id = ? AND client_uid = ?', [$user['id'], $clientUid])
        : null;

    $workoutId = isset($b['workout_id']) && $b['workout_id'] !== null ? (int) $b['workout_id'] : null;
    if ($workoutId) {
        $own = q1('SELECT id FROM workouts WHERE id = ? AND user_id = ?', [$workoutId, $user['id']]);
        if (!$own) $workoutId = null;
    }
    $startedAt = isset($b['started_at']) ? norm_dt($b['started_at']) : date('Y-m-d H:i:s');
    $endedAt   = isset($b['ended_at']) && $b['ended_at'] ? norm_dt($b['ended_at']) : null;
    $ambient   = (isset($b['ambient']) && is_array($b['ambient']) && $b['ambient']) ? json_encode($b['ambient']) : null;

    $pdo = db();
    $pdo->beginTransaction();
    try {
        if ($existing) {
            $sid = (int) $existing['id'];
            exec_write(
                'UPDATE sessions SET workout_id = ?, started_at = ?, ended_at = ?, comments = ?, ambient = ?
                 WHERE id = ? AND user_id = ?',
                [$workoutId, $startedAt, $endedAt, $b['comments'] ?? null, $ambient, $sid, $user['id']]
            );
            // Replace the set snapshot with the latest full list from the client.
            exec_write('DELETE FROM set_results WHERE session_id = ?', [$sid]);
        } else {
            $sid = exec_write(
                'INSERT INTO sessions (user_id, workout_id, client_uid, started_at, ended_at, comments, ambient)
                 VALUES (?, ?, ?, ?, ?, ?, ?)',
                [$user['id'], $workoutId, $clientUid, $startedAt, $endedAt, $b['comments'] ?? null, $ambient]
            );
        }

        $sets = is_array($b['sets'] ?? null) ? $b['sets'] : [];
        foreach ($sets as $set) {
            $exId = (int) ($set['exercise_id'] ?? 0);
            $own = q1('SELECT id FROM exercises WHERE id = ? AND user_id = ?', [$exId, $user['id']]);
            if (!$own) continue;
            $extras = (isset($set['extras']) && is_array($set['extras']) && $set['extras'])
                ? json_encode($set['extras']) : null;
            exec_write(
                'INSERT INTO set_results
                 (session_id, exercise_id, set_number, reps, weight, distance, duration_secs, calories, effort, extras, comments, recorded_at)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
                [
                    $sid, $exId, (int) ($set['set_number'] ?? 1),
                    nn($set['reps'] ?? null), nn($set['weight'] ?? null),
                    nn($set['distance'] ?? null), nn($set['duration_secs'] ?? null),
                    nn($set['calories'] ?? null), nn($set['effort'] ?? null),
                    $extras, $set['comments'] ?? null,
                    isset($set['recorded_at']) ? norm_dt($set['recorded_at']) : $startedAt,
                ]
            );
        }
        $pdo->commit();
    } catch (Throwable $e) {
        $pdo->rollBack();
        throw $e;
    }
    send_json(['session_id' => $sid, 'updated' => (bool) $existing], $existing ? 200 : 201);
}

function delete_session(string $id): void
{
    $user = require_user();
    $s = q1('SELECT id FROM sessions WHERE id = ? AND user_id = ?', [$id, $user['id']]);
    if (!$s) fail('Session not found.', 404);
    exec_write('DELETE FROM sessions WHERE id = ?', [$id]);
    send_json(['ok' => true]);
}

/** Per-exercise progress series for charts. */
function exercise_progress(string $exerciseId): void
{
    $user = require_user();
    $own = q1('SELECT * FROM exercises WHERE id = ? AND user_id = ?', [$exerciseId, $user['id']]);
    if (!$own) fail('Exercise not found.', 404);

    $rows = q(
        'SELECT s.started_at AS date,
                SUM(sr.reps) AS total_reps,
                MAX(sr.weight) AS max_weight,
                -- Volume load: weight x reps summed across every set in the session.
                -- COALESCE keeps bodyweight sets (null weight) from voiding the sum.
                SUM(COALESCE(sr.weight, 0) * COALESCE(sr.reps, 0)) AS total_volume,
                SUM(sr.distance) AS total_distance,
                SUM(sr.duration_secs) AS total_duration,
                SUM(sr.calories) AS total_calories,
                COUNT(*) AS sets
         FROM set_results sr
         JOIN sessions s ON s.id = sr.session_id
         WHERE sr.exercise_id = ? AND s.user_id = ?
         GROUP BY s.id
         ORDER BY s.started_at',
        [$exerciseId, $user['id']]
    );
    send_json(['exercise' => $own, 'series' => $rows]);
}

/** Normalise a date-time string into the DB format; null on failure. */
function norm_dt($v): string
{
    $t = strtotime((string) $v);
    return $t ? date('Y-m-d H:i:s', $t) : date('Y-m-d H:i:s');
}

/** null-if-empty numeric helper. */
function nn($v)
{
    return ($v === null || $v === '') ? null : $v + 0;
}
