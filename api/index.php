<?php
/** GymBuddy API front controller. All /api/* requests route through here. */

error_reporting(E_ALL);
ini_set('display_errors', '0'); // never leak errors to clients
set_exception_handler(function (Throwable $e) {
    @file_put_contents(__DIR__ . '/data/error.log',
        '[' . date('c') . '] ' . $e->getMessage() . ' @ ' . $e->getFile() . ':' . $e->getLine() . "\n",
        FILE_APPEND);
    if (!headers_sent()) {
        http_response_code(500);
        header('Content-Type: application/json');
    }
    echo json_encode(['error' => 'Server error']);
});

require_once __DIR__ . '/lib/http.php';
require_once __DIR__ . '/lib/db.php';
require_once __DIR__ . '/lib/auth.php';

cors();

// ---- Resolve the route path (works under /dev/GymBuddy/api on the server
//      and as stripped paths behind the local Vite proxy) ----
$uri = parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH) ?: '/';
$pos = strpos($uri, '/api');
$route = $pos !== false ? substr($uri, $pos + 4) : $uri;
$route = '/' . trim(rawurldecode($route), '/');
$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';

// ---- Route table: [method, pattern, handler-file, function] ----
$routes = [
    ['GET',    '#^/health$#',                    'meta',      'health'],
    ['POST',   '#^/auth/request$#',              'auth',      'auth_request'],
    ['POST',   '#^/auth/verify$#',               'auth',      'auth_verify'],
    ['GET',    '#^/me$#',                         'auth',      'me'],

    ['GET',    '#^/exercises$#',                  'exercises', 'list_exercises'],
    ['POST',   '#^/exercises$#',                  'exercises', 'create_exercise'],
    ['PUT',    '#^/exercises/(\d+)$#',            'exercises', 'update_exercise'],
    ['DELETE', '#^/exercises/(\d+)$#',            'exercises', 'delete_exercise'],

    ['GET',    '#^/workouts$#',                   'workouts',  'list_workouts'],
    ['POST',   '#^/workouts$#',                   'workouts',  'create_workout'],
    ['GET',    '#^/workouts/(\d+)$#',             'workouts',  'get_workout'],
    ['PUT',    '#^/workouts/(\d+)$#',             'workouts',  'update_workout'],
    ['DELETE', '#^/workouts/(\d+)$#',             'workouts',  'delete_workout'],

    ['GET',    '#^/sessions$#',                   'sessions',  'list_sessions'],
    ['POST',   '#^/sessions$#',                   'sessions',  'create_session'],
    ['GET',    '#^/sessions/(\d+)$#',             'sessions',  'get_session'],
    ['DELETE', '#^/sessions/(\d+)$#',             'sessions',  'delete_session'],

    ['GET',    '#^/progress/(\d+)$#',             'sessions',  'exercise_progress'],
    ['GET',    '#^/export\.csv$#',                'export',    'export_csv'],
];

foreach ($routes as [$m, $pattern, $file, $fn]) {
    if ($m !== $method) continue;
    if (preg_match($pattern, $route, $args)) {
        array_shift($args); // drop full match
        require_once __DIR__ . "/routes/$file.php";
        $fn(...$args);
        exit;
    }
}

fail('Not found: ' . $method . ' ' . $route, 404);
