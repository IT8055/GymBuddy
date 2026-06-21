<?php
/** Email magic-code authentication. */

require_once __DIR__ . '/../lib/mail.php';

function auth_request(): void
{
    $cfg = require __DIR__ . '/../config.php';
    $email = strtolower(need(body(), 'email'));
    if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
        fail('Please enter a valid email address.', 422);
    }

    // Find or create the user.
    $user = q1('SELECT * FROM users WHERE email = ?', [$email]);
    if (!$user) {
        $id = exec_write('INSERT INTO users (email) VALUES (?)', [$email]);
        $user = ['id' => $id, 'email' => $email];
    }

    // Generate a 6-digit code, store only its hash.
    $code = str_pad((string) random_int(0, 999999), 6, '0', STR_PAD_LEFT);
    $hash = password_hash($code, PASSWORD_DEFAULT);
    $expires = date('Y-m-d H:i:s', time() + $cfg['code_ttl_minutes'] * 60);

    // Invalidate previous unused codes for this user.
    exec_write('UPDATE login_codes SET used = 1 WHERE user_id = ? AND used = 0', [$user['id']]);
    exec_write(
        'INSERT INTO login_codes (user_id, code_hash, expires_at) VALUES (?, ?, ?)',
        [$user['id'], $hash, $expires]
    );

    send_login_code($email, $code);

    // Tell the client (in dev only) that the code was logged, not emailed.
    send_json(['ok' => true, 'dev_logged' => !empty($cfg['mail_log_only'])]);
}

function auth_verify(): void
{
    $cfg = require __DIR__ . '/../config.php';
    $b = body();
    $email = strtolower(need($b, 'email'));
    $code = need($b, 'code');

    $user = q1('SELECT * FROM users WHERE email = ?', [$email]);
    if (!$user) fail('Invalid code.', 401);

    $row = q1(
        'SELECT * FROM login_codes WHERE user_id = ? AND used = 0 ORDER BY id DESC LIMIT 1',
        [$user['id']]
    );
    if (!$row) fail('No active code. Request a new one.', 401);

    if (strtotime($row['expires_at']) < time()) {
        exec_write('UPDATE login_codes SET used = 1 WHERE id = ?', [$row['id']]);
        fail('That code has expired. Request a new one.', 401);
    }
    if ((int) $row['attempts'] >= $cfg['code_max_attempts']) {
        exec_write('UPDATE login_codes SET used = 1 WHERE id = ?', [$row['id']]);
        fail('Too many attempts. Request a new code.', 429);
    }

    if (!password_verify($code, $row['code_hash'])) {
        exec_write('UPDATE login_codes SET attempts = attempts + 1 WHERE id = ?', [$row['id']]);
        fail('Incorrect code.', 401);
    }

    // Success — burn the code and issue a session token.
    exec_write('UPDATE login_codes SET used = 1 WHERE id = ?', [$row['id']]);
    $token = issue_token((int) $user['id']);
    send_json(['ok' => true, 'token' => $token, 'user' => ['id' => $user['id'], 'email' => $user['email']]]);
}

function me(): void
{
    $user = require_user();
    send_json(['user' => ['id' => $user['id'], 'email' => $user['email'], 'created_at' => $user['created_at']]]);
}
