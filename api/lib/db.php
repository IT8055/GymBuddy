<?php
/** PDO connection + schema bootstrap. Works with MySQL (cPanel) or SQLite (local). */

function db(): PDO
{
    static $pdo = null;
    if ($pdo !== null) return $pdo;

    $cfg = require __DIR__ . '/../config.php';
    $driver = $cfg['db_driver'];

    if ($driver === 'sqlite') {
        $path = $cfg['sqlite']['path'];
        @mkdir(dirname($path), 0775, true);
        $fresh = !file_exists($path);
        $pdo = new PDO('sqlite:' . $path);
        $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
        $pdo->setAttribute(PDO::ATTR_DEFAULT_FETCH_MODE, PDO::FETCH_ASSOC);
        $pdo->exec('PRAGMA foreign_keys = ON');
        if ($fresh) {
            $pdo->exec(file_get_contents(__DIR__ . '/../schema.sqlite.sql'));
        }
    } else {
        $m = $cfg['mysql'];
        $dsn = "mysql:host={$m['host']};dbname={$m['dbname']};charset={$m['charset']}";
        $pdo = new PDO($dsn, $m['user'], $m['password'], [
            PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
            PDO::ATTR_EMULATE_PREPARES   => false,
            // Return INT/DECIMAL columns as native numbers (not strings) so the
            // frontend's numeric id comparisons work the same as on SQLite.
            PDO::ATTR_STRINGIFY_FETCHES  => false,
        ]);
    }

    return $pdo;
}

/** Convenience: run a query with params and return all rows. */
function q(string $sql, array $params = []): array
{
    $st = db()->prepare($sql);
    $st->execute($params);
    return $st->fetchAll();
}

/** Convenience: run a query and return the first row or null. */
function q1(string $sql, array $params = []): ?array
{
    $st = db()->prepare($sql);
    $st->execute($params);
    $row = $st->fetch();
    return $row === false ? null : $row;
}

/** Convenience: run a write and return the last insert id. */
function exec_write(string $sql, array $params = []): int
{
    $st = db()->prepare($sql);
    $st->execute($params);
    return (int) db()->lastInsertId();
}
