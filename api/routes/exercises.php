<?php
/** Exercise definitions CRUD. */

/** Scalar editable fields and how to coerce them. */
function exercise_fields(): array
{
    return [
        'name'             => 'str',
        'description'      => 'str',
        'machine_number'   => 'str',
        'type'             => 'type',
        'equipment_settings' => 'str',
        'unit'             => 'str',
        'reps_per_minute'  => 'int',
        'default_weight'   => 'num',
        'default_duration_secs' => 'int',
        'target_value'     => 'num',
        'target_label'     => 'str',
    ];
}

/** JSON-encoded fields (stored as TEXT). */
function exercise_json_fields(): array
{
    return ['steps', 'metrics'];
}

function coerce($val, string $kind)
{
    if ($val === null || $val === '') return null;
    switch ($kind) {
        case 'int':  return (int) $val;
        case 'num':  return (float) $val;
        case 'type': return in_array($val, ['reps', 'timed', 'target'], true) ? $val : 'reps';
        default:     return (string) $val;
    }
}

/** Decode JSON columns so the client receives arrays, not strings. */
function decode_exercise(?array $row): ?array
{
    if (!$row) return $row;
    foreach (exercise_json_fields() as $f) {
        if (array_key_exists($f, $row)) {
            $decoded = $row[$f] !== null && $row[$f] !== '' ? json_decode($row[$f], true) : null;
            $row[$f] = is_array($decoded) ? $decoded : null;
        }
    }
    return $row;
}

function list_exercises(): void
{
    $user = require_user();
    $rows = q('SELECT * FROM exercises WHERE user_id = ? AND archived = 0 ORDER BY name', [$user['id']]);
    send_json(['exercises' => array_map('decode_exercise', $rows)]);
}

function create_exercise(): void
{
    $user = require_user();
    $b = body();
    if (trim((string)($b['name'] ?? '')) === '') fail('Name is required.', 422);

    $cols = ['user_id'];
    $vals = [$user['id']];
    $ph   = ['?'];
    foreach (exercise_fields() as $f => $kind) {
        $v = coerce($b[$f] ?? null, $kind);
        if ($v === null) continue;
        $cols[] = $f; $vals[] = $v; $ph[] = '?';
    }
    foreach (exercise_json_fields() as $f) {
        if (isset($b[$f]) && is_array($b[$f])) {
            $cols[] = $f; $vals[] = json_encode($b[$f]); $ph[] = '?';
        }
    }
    $sql = 'INSERT INTO exercises (' . implode(',', $cols) . ') VALUES (' . implode(',', $ph) . ')';
    $id = exec_write($sql, $vals);
    send_json(['exercise' => decode_exercise(q1('SELECT * FROM exercises WHERE id = ?', [$id]))], 201);
}

function update_exercise(string $id): void
{
    $user = require_user();
    $own = q1('SELECT id FROM exercises WHERE id = ? AND user_id = ?', [$id, $user['id']]);
    if (!$own) fail('Exercise not found.', 404);

    $b = body();
    $sets = [];
    $vals = [];
    foreach (exercise_fields() as $f => $kind) {
        if (array_key_exists($f, $b)) { $sets[] = "$f = ?"; $vals[] = coerce($b[$f], $kind); }
    }
    foreach (exercise_json_fields() as $f) {
        if (array_key_exists($f, $b)) {
            $sets[] = "$f = ?";
            $vals[] = is_array($b[$f]) ? json_encode($b[$f]) : null;
        }
    }
    if ($sets) {
        $vals[] = $id;
        exec_write('UPDATE exercises SET ' . implode(',', $sets) . ' WHERE id = ?', $vals);
    }
    send_json(['exercise' => decode_exercise(q1('SELECT * FROM exercises WHERE id = ?', [$id]))]);
}

function delete_exercise(string $id): void
{
    $user = require_user();
    $own = q1('SELECT id FROM exercises WHERE id = ? AND user_id = ?', [$id, $user['id']]);
    if (!$own) fail('Exercise not found.', 404);
    // Soft-archive so historical set_results stay intact.
    exec_write('UPDATE exercises SET archived = 1 WHERE id = ?', [$id]);
    send_json(['ok' => true]);
}
