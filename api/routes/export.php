<?php
/** CSV export of all recorded set results for the current user. */

function export_csv(): void
{
    // Allow token via query string too, so a plain <a download> link works.
    $token = bearer_token() ?: ($_GET['token'] ?? null);
    $uid = token_user_id($token);
    if (!$uid) fail('Not authenticated', 401);

    $rows = q(
        'SELECT s.started_at, s.ended_at, s.comments AS session_comments, s.ambient,
                w.name AS workout, e.name AS exercise, e.machine_number, e.type,
                e.equipment_settings, sr.set_number, sr.reps, sr.weight, sr.distance,
                sr.duration_secs, sr.calories, sr.effort, sr.extras, sr.comments AS set_comments, e.unit
         FROM set_results sr
         JOIN sessions s  ON s.id = sr.session_id
         JOIN exercises e ON e.id = sr.exercise_id
         LEFT JOIN workouts w ON w.id = s.workout_id
         WHERE s.user_id = ?
         ORDER BY s.started_at, sr.id',
        [$uid]
    );

    // Collect the union of all custom-metric labels so they each get a column.
    $extraLabels = [];
    foreach ($rows as $r) {
        if (!empty($r['extras'])) {
            $ex = json_decode($r['extras'], true);
            if (is_array($ex)) foreach (array_keys($ex) as $k) $extraLabels[$k] = true;
        }
    }
    $extraLabels = array_keys($extraLabels);

    header('Content-Type: text/csv; charset=utf-8');
    header('Content-Disposition: attachment; filename="gymbuddy-export-' . date('Y-m-d') . '.csv"');

    $out = fopen('php://output', 'w');
    fputcsv($out, array_merge([
        'Date', 'Ended', 'Workout', 'Exercise', 'Machine', 'Type', 'Equipment settings',
        'Set #', 'Reps', 'Weight', 'Distance', 'Duration (s)', 'Calories', 'Effort (1-10)', 'Unit',
    ], $extraLabels, ['Temp (°C)', 'Humidity (%)', 'Weather', 'Set comments', 'Session comments']));
    foreach ($rows as $r) {
        $ex = !empty($r['extras']) ? json_decode($r['extras'], true) : [];
        $extraVals = array_map(fn ($k) => is_array($ex) && isset($ex[$k]) ? $ex[$k] : '', $extraLabels);
        $amb = !empty($r['ambient']) ? json_decode($r['ambient'], true) : [];
        fputcsv($out, array_merge([
            $r['started_at'], $r['ended_at'], $r['workout'], $r['exercise'], $r['machine_number'],
            $r['type'], $r['equipment_settings'], $r['set_number'], $r['reps'], $r['weight'],
            $r['distance'], $r['duration_secs'], $r['calories'], $r['effort'], $r['unit'],
        ], $extraVals, [
            $amb['temp_c'] ?? '', $amb['humidity'] ?? '', $amb['weather'] ?? '',
            $r['set_comments'], $r['session_comments'],
        ]));
    }
    fclose($out);
    exit;
}
