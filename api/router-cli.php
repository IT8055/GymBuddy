<?php
/**
 * Front controller for the PHP built-in server (`npm run api`).
 * Serves real files if they exist, otherwise hands everything to index.php.
 */
$path = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH);
$file = __DIR__ . $path;
if ($path !== '/' && file_exists($file) && !is_dir($file) && pathinfo($file, PATHINFO_EXTENSION) !== 'php') {
    return false; // let the built-in server serve the static asset
}
require __DIR__ . '/index.php';
