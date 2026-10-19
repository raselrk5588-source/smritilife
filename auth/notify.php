<?php
/**
 * notify.php
 * Webhook receiver for BDApps asynchronous Subscription Notification events (Robi/Airtel)
 * Configure this URL in BDApps Developer Portal under "Subscription Notification URL"
 */

header('Content-Type: application/json; charset=utf-8');
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: POST, GET, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type");

if ($_SERVER['REQUEST_METHOD'] == 'OPTIONS') {
    http_response_code(200);
    exit();
}

require_once __DIR__ . '/notification_helper.php';
$config = include __DIR__ . '/config.php';

$rawBody = file_get_contents('php://input');
@file_put_contents(__DIR__ . '/notification_log.txt', date('Y-m-d H:i:s') . " | Webhook Raw: " . $rawBody . "\n", FILE_APPEND);

$payload = json_decode($rawBody, true);

if (!is_array($payload)) {
    echo json_encode([
        'statusCode' => 'S1000',
        'statusDetail' => 'Received empty or invalid payload'
    ]);
    exit();
}

$subscriberId = $payload['subscriberId'] ?? $payload['msisdn'] ?? '';
$status = (string)($payload['status'] ?? $payload['subscriptionStatus'] ?? '');
$statusCode = (string)($payload['statusCode'] ?? 'S1000');

// BDApps status '1' or 'REGISTERED' represents active subscription
$isSubscribed = ($status === '1' || strtoupper($status) === 'REGISTERED' || strtoupper($status) === 'SUBSCRIBED');

if ($isSubscribed && !empty($subscriberId)) {
    // 1. Send SMS notification to the subscriber via BDApps SMS API
    $smsText = "স্মৃতি লাইফ (Smriti Life)-এ স্বাগতম! ১৯০ টাকায় আপনার সাবস্ক্রিপশন সফলভাবে সম্পন্ন হয়েছে। সেবাটি সক্রিয় থাকবে। লগইন করুন: https://smritilife.com";
    sendBdappsSmsNotification($subscriberId, $smsText, $config);

    // 2. Sync subscription with Smriti Life Main Server and trigger WhatsApp welcome message
    notifySmritiLifeServer($subscriberId, $subscriberId, 'REGISTERED', $statusCode);
} elseif (!empty($subscriberId) && ($status === '0' || strtoupper($status) === 'UNREGISTERED')) {
    // Unsubscription event
    notifySmritiLifeServer($subscriberId, $subscriberId, 'UNREGISTERED', $statusCode);
}

// BDApps expects statusCode S1000 in acknowledgement
echo json_encode([
    'statusCode' => 'S1000',
    'statusDetail' => 'Success'
]);
?>
