<?php
declare(strict_types=1);

$redirectPath = '/contact/';
$recipient = 'markokostic96@gmail.com';
$fromAddress = 'info@appstechllc.com';
$fromName = 'AppsTech Website';

function redirect_with_status(string $path, string $status): never
{
    header('Location: ' . $path . '?status=' . rawurlencode($status), true, 303);
    exit;
}

function clean_line(string $value): string
{
    return trim(str_replace(["\r", "\n"], ' ', $value));
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    header('Allow: POST');
    echo 'Method Not Allowed';
    exit;
}

if (!empty($_POST['company_website'] ?? '')) {
    redirect_with_status($redirectPath, 'success');
}

$name = clean_line((string)($_POST['name'] ?? ''));
$email = clean_line((string)($_POST['email'] ?? ''));
$phone = clean_line((string)($_POST['phone'] ?? ''));
$message = trim((string)($_POST['message'] ?? ''));

if ($name === '' || $message === '' || !filter_var($email, FILTER_VALIDATE_EMAIL)) {
    redirect_with_status($redirectPath, 'error');
}

$subject = 'New website enquiry from ' . $name;
$bodyLines = [
    'A new message was submitted from the AppsTech website contact form.',
    '',
    'Name: ' . $name,
    'Email: ' . $email,
    'Phone: ' . ($phone !== '' ? $phone : 'Not provided'),
    '',
    'Message:',
    $message,
];

$headers = [
    'MIME-Version: 1.0',
    'Content-Type: text/plain; charset=UTF-8',
    'From: ' . $fromName . ' <' . $fromAddress . '>',
    'Reply-To: ' . $email,
    'X-Mailer: PHP/' . phpversion(),
];

$sent = mail($recipient, $subject, implode(PHP_EOL, $bodyLines), implode("\r\n", $headers));

redirect_with_status($redirectPath, $sent ? 'success' : 'error');
