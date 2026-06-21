<?php
/** Tiny HTTP helpers: JSON responses, body parsing, CORS. */

function send_json($data, int $status = 200): void
{
    http_response_code($status);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode($data, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
    exit;
}

function fail(string $message, int $status = 400, array $extra = []): void
{
    send_json(array_merge(['error' => $message], $extra), $status);
}

/** Decode the JSON request body into an array. */
function body(): array
{
    $raw = file_get_contents('php://input');
    if ($raw === '' || $raw === false) return [];
    $data = json_decode($raw, true);
    return is_array($data) ? $data : [];
}

/** Require a field to be present and non-empty; returns its trimmed value. */
function need(array $src, string $key): string
{
    if (!isset($src[$key]) || trim((string) $src[$key]) === '') {
        fail("Missing required field: $key", 422);
    }
    return trim((string) $src[$key]);
}

function cors(): void
{
    $cfg = require __DIR__ . '/../config.php';
    $origins = $cfg['cors_origins'] ?? [];
    $origin = $_SERVER['HTTP_ORIGIN'] ?? '';
    if ($origin && in_array($origin, $origins, true)) {
        header("Access-Control-Allow-Origin: $origin");
        header('Access-Control-Allow-Credentials: true');
        header('Vary: Origin');
    }
    header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
    header('Access-Control-Allow-Headers: Content-Type, Authorization');
    if (($_SERVER['REQUEST_METHOD'] ?? '') === 'OPTIONS') {
        http_response_code(204);
        exit;
    }
}
