<?php
/** Workouts (named plans = ordered lists of exercises) CRUD. */

require_once __DIR__ . '/exercises.php'; // for decode_exercise()

function list_workouts(): void
{
    $user = require_user();
    $rows = q('SELECT * FROM workouts WHERE user_id = ? AND archived = 0 ORDER BY name', [$user['id']]);
    foreach ($rows as &$w) {
        $w['items'] = workout_items((int) $w['id']);
    }
    send_json(['workouts' => $rows]);
}

function workout_items(int $workoutId): array
{
    $rows = q(
        'SELECT wi.id, wi.exercise_id, wi.position, e.name, e.type, e.machine_number,
                e.description, e.equipment_settings, e.unit, e.reps_per_minute,
                e.default_weight, e.steps, e.default_duration_secs,
                e.target_value, e.target_label, e.metrics
         FROM workout_items wi
         JOIN exercises e ON e.id = wi.exercise_id
         WHERE wi.workout_id = ?
         ORDER BY wi.position, wi.id',
        [$workoutId]
    );
    return array_map('decode_exercise', $rows);
}

function get_workout(string $id): void
{
    $user = require_user();
    $w = q1('SELECT * FROM workouts WHERE id = ? AND user_id = ?', [$id, $user['id']]);
    if (!$w) fail('Workout not found.', 404);
    $w['items'] = workout_items((int) $id);
    send_json(['workout' => $w]);
}

/** Replace the ordered item list for a workout from an array of exercise ids. */
function set_workout_items(int $workoutId, array $exerciseIds, int $userId): void
{
    exec_write('DELETE FROM workout_items WHERE workout_id = ?', [$workoutId]);
    $pos = 0;
    foreach ($exerciseIds as $exId) {
        $exId = (int) $exId;
        $ok = q1('SELECT id FROM exercises WHERE id = ? AND user_id = ?', [$exId, $userId]);
        if (!$ok) continue;
        exec_write(
            'INSERT INTO workout_items (workout_id, exercise_id, position) VALUES (?, ?, ?)',
            [$workoutId, $exId, $pos++]
        );
    }
}

function create_workout(): void
{
    $user = require_user();
    $b = body();
    $name = need($b, 'name');
    $id = exec_write(
        'INSERT INTO workouts (user_id, name, description) VALUES (?, ?, ?)',
        [$user['id'], $name, $b['description'] ?? null]
    );
    if (!empty($b['exercise_ids']) && is_array($b['exercise_ids'])) {
        set_workout_items($id, $b['exercise_ids'], (int) $user['id']);
    }
    $w = q1('SELECT * FROM workouts WHERE id = ?', [$id]);
    $w['items'] = workout_items($id);
    send_json(['workout' => $w], 201);
}

function update_workout(string $id): void
{
    $user = require_user();
    $w = q1('SELECT * FROM workouts WHERE id = ? AND user_id = ?', [$id, $user['id']]);
    if (!$w) fail('Workout not found.', 404);

    $b = body();
    $sets = [];
    $vals = [];
    foreach (['name', 'description'] as $f) {
        if (array_key_exists($f, $b)) { $sets[] = "$f = ?"; $vals[] = $b[$f]; }
    }
    if ($sets) {
        $vals[] = $id;
        exec_write('UPDATE workouts SET ' . implode(',', $sets) . ' WHERE id = ?', $vals);
    }
    if (array_key_exists('exercise_ids', $b) && is_array($b['exercise_ids'])) {
        set_workout_items((int) $id, $b['exercise_ids'], (int) $user['id']);
    }
    $out = q1('SELECT * FROM workouts WHERE id = ?', [$id]);
    $out['items'] = workout_items((int) $id);
    send_json(['workout' => $out]);
}

function delete_workout(string $id): void
{
    $user = require_user();
    $w = q1('SELECT id FROM workouts WHERE id = ? AND user_id = ?', [$id, $user['id']]);
    if (!$w) fail('Workout not found.', 404);
    exec_write('UPDATE workouts SET archived = 1 WHERE id = ?', [$id]);
    send_json(['ok' => true]);
}
