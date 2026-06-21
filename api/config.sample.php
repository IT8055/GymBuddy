<?php
/**
 * GymBuddy configuration — SAMPLE.
 *
 * Copy this file to `config.php` and fill in real values on the server.
 * `config.php` is git-ignored so real secrets are never committed.
 */

return [
    // 'mysql' on a normal server, 'sqlite' for zero-setup local dev.
    'db_driver' => getenv('GYMBUDDY_DB') ?: 'mysql',

    // ---- MySQL ----
    'mysql' => [
        'host'     => 'localhost',
        'dbname'   => 'your_database_name',
        'user'     => 'your_database_user',
        'password' => 'your_database_password',
        'charset'  => 'utf8mb4',
    ],

    // ---- SQLite (local dev fallback) ----
    'sqlite' => [
        'path' => __DIR__ . '/data/gymbuddy.sqlite',
    ],

    // Secret used to sign session tokens (HMAC). Set to a long random string,
    // e.g. the output of: php -r "echo bin2hex(random_bytes(32));"
    'app_secret' => 'CHANGE_ME_to_a_long_random_string_at_least_32_chars',

    // Sender address for login-code emails (must be a real mailbox on your domain).
    'mail_from'      => 'gymbuddy@example.com',
    'mail_from_name' => 'GymBuddy',

    // Login code settings.
    'code_ttl_minutes'   => 10,
    'code_max_attempts'  => 5,
    'session_ttl_days'   => 30,

    // During local dev, write the emailed code to api/data/mail.log instead of sending.
    'mail_log_only' => getenv('GYMBUDDY_DB') === 'sqlite',

    // Allowed origins for CORS (empty = same-origin only, which is the default deploy setup).
    'cors_origins' => [],
];
