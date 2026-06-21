<?php
/** Send the login code email via cPanel's local mail server (PHP mail()). */

require_once __DIR__ . '/http.php';

function send_login_code(string $to, string $code): void
{
    $cfg = require __DIR__ . '/../config.php';

    $subject = 'Your GymBuddy login code';
    $ttl = $cfg['code_ttl_minutes'];
    $text =
        "Your GymBuddy login code is:\n\n" .
        "    $code\n\n" .
        "It expires in {$ttl} minutes. If you didn't request this, ignore this email.\n";

    // During local dev we just log the code instead of emailing.
    if (!empty($cfg['mail_log_only'])) {
        $line = '[' . date('c') . "] to=$to code=$code\n";
        @file_put_contents(__DIR__ . '/../data/mail.log', $line, FILE_APPEND);
        return;
    }

    $from = $cfg['mail_from'];
    $fromName = $cfg['mail_from_name'];
    $headers = implode("\r\n", [
        "From: {$fromName} <{$from}>",
        "Reply-To: {$from}",
        'Content-Type: text/plain; charset=UTF-8',
        'MIME-Version: 1.0',
        'X-Mailer: GymBuddy',
    ]);

    // cPanel routes mail() through the local Exim server automatically.
    $ok = mail($to, $subject, $text, $headers, "-f{$from}");
    if (!$ok) {
        fail('Could not send the login email. Please try again later.', 500);
    }
}
