<?php
/**
 * notification_helper.php
 * Helper functions to send SMS and sync subscription notifications for BDApps (Robi/Airtel)
 */

if (!function_exists('formatSubscriberId')) {
    function formatSubscriberId($rawMobile) {
        $digits = preg_replace('/\D+/', '', (string)$rawMobile);
        if (strpos($digits, '880') === 0 && strlen($digits) === 13) {
            return 'tel:' . $digits;
        } elseif (strpos($digits, '88') === 0 && strlen($digits) === 12) {
            return 'tel:' . $digits;
        } elseif (strpos($digits, '01') === 0 && strlen($digits) === 11) {
            return 'tel:88' . $digits;
        } elseif (strlen($digits) === 10 && strpos($digits, '1') === 0) {
            return 'tel:880' . $digits;
        }
        return 'tel:88' . $digits;
    }
}

if (!function_exists('formatMsisdn')) {
    function formatMsisdn($rawMobile) {
        $digits = preg_replace('/\D+/', '', (string)$rawMobile);
        if (strpos($digits, '880') === 0 && strlen($digits) === 13) {
            return substr($digits, 2);
        } elseif (strpos($digits, '88') === 0 && strlen($digits) === 12) {
            return substr($digits, 2);
        } elseif (strpos($digits, '01') === 0 && strlen($digits) === 11) {
            return $digits;
        } elseif (strlen($digits) === 10 && strpos($digits, '1') === 0) {
            return '0' . $digits;
        }
        return $digits;
    }
}

/**
 * Send SMS notification via BDApps SMS API
 */
if (!function_exists('sendBdappsSmsNotification')) {
    function sendBdappsSmsNotification($subscriberId, $messageText, $config) {
        $formattedAddress = formatSubscriberId($subscriberId);
        
        $smsData = array(
            "applicationId" => $config['applicationId'],
            "password" => $config['password'],
            "message" => $messageText,
            "destinationAddresses" => array($formattedAddress)
        );

        $smsJson = json_encode($smsData);

        // 1. Try sending through BDApps proxy
        $proxyUrl = "https://portal.rtsquad.com/api/bdapps/proxy";
        $ch = curl_init();
        curl_setopt($ch, CURLOPT_URL, $proxyUrl);
        curl_setopt($ch, CURLOPT_POST, true);
        curl_setopt($ch, CURLOPT_POSTFIELDS, $smsJson);
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_TIMEOUT, 15);
        curl_setopt($ch, CURLOPT_HTTPHEADER, array(
            "Content-Type: application/json; charset=utf-8",
            "Content-Length: " . strlen($smsJson),
            "X-Target-URL: https://developer.bdapps.com/sms/send"
        ));

        $response = curl_exec($ch);
        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        $curlErr = curl_error($ch);
        curl_close($ch);

        // 2. If proxy fails or returns error, try direct developer.bdapps.com
        if ($response === false || $httpCode >= 400) {
            $directUrl = "https://developer.bdapps.com/sms/send";
            $ch2 = curl_init();
            curl_setopt($ch2, CURLOPT_URL, $directUrl);
            curl_setopt($ch2, CURLOPT_POST, true);
            curl_setopt($ch2, CURLOPT_POSTFIELDS, $smsJson);
            curl_setopt($ch2, CURLOPT_RETURNTRANSFER, true);
            curl_setopt($ch2, CURLOPT_TIMEOUT, 15);
            curl_setopt($ch2, CURLOPT_HTTPHEADER, array(
                "Content-Type: application/json; charset=utf-8",
                "Content-Length: " . strlen($smsJson)
            ));

            $directRes = curl_exec($ch2);
            $directHttp = curl_getinfo($ch2, CURLINFO_HTTP_CODE);
            $directErr = curl_error($ch2);
            curl_close($ch2);

            @file_put_contents(__DIR__ . '/notification_log.txt', date('Y-m-d H:i:s') . " | Direct SMS to $formattedAddress | Code: $directHttp | Res: $directRes | Err: $directErr\n", FILE_APPEND);
            return $directRes;
        }

        @file_put_contents(__DIR__ . '/notification_log.txt', date('Y-m-d H:i:s') . " | Proxy SMS to $formattedAddress | Code: $httpCode | Res: $response | Err: $curlErr\n", FILE_APPEND);
        return $response;
    }
}

/**
 * Sync subscription event with Smriti Life Node.js server
 * (Marks user isSubscribed: true in MongoDB and triggers WhatsApp welcome message)
 */
if (!function_exists('notifySmritiLifeServer')) {
    function notifySmritiLifeServer($subscriberId, $userMobile, $status = 'REGISTERED', $statusCode = 'S1000') {
        $msisdn = formatMsisdn(!empty($userMobile) ? $userMobile : $subscriberId);
        $formattedSubId = formatSubscriberId(!empty($subscriberId) ? $subscriberId : $userMobile);

        $payload = array(
            'applicationId' => 'APP_140575',
            'subscriberId' => $formattedSubId,
            'msisdn' => $msisdn,
            'status' => $status,
            'statusCode' => $statusCode,
            'source' => 'robi_subscription_portal'
        );

        $jsonPayload = json_encode($payload);

        // Notify production server endpoint
        $serverUrl = "https://smritilife.com/api/subscription/notify";

        $ch = curl_init();
        curl_setopt($ch, CURLOPT_URL, $serverUrl);
        curl_setopt($ch, CURLOPT_POST, true);
        curl_setopt($ch, CURLOPT_POSTFIELDS, $jsonPayload);
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_TIMEOUT, 10);
        curl_setopt($ch, CURLOPT_HTTPHEADER, array(
            "Content-Type: application/json",
            "Content-Length: " . strlen($jsonPayload)
        ));

        $res = curl_exec($ch);
        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        $err = curl_error($ch);
        curl_close($ch);

        @file_put_contents(__DIR__ . '/notification_log.txt', date('Y-m-d H:i:s') . " | Smriti Server Sync: $msisdn | Code: $httpCode | Res: $res | Err: $err\n", FILE_APPEND);
        return $res;
    }
}
?>
