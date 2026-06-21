<?php
/** Health check — confirms the API and DB are reachable. */
function health(): void
{
    $driver = (require __DIR__ . '/../config.php')['db_driver'];
    try {
        db()->query('SELECT 1');
        send_json(['ok' => true, 'driver' => $driver, 'time' => date('c')]);
    } catch (Throwable $e) {
        fail('Database unreachable', 500);
    }
}
