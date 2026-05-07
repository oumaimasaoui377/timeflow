<?php
// =============================================================
// API — Planning individuel par membre (member_schedules)
// GET    /api/member_schedules.php?user_id=xxx  → planning du membre
// PUT    /api/member_schedules.php              → sauvegarder
// DELETE /api/member_schedules.php?user_id=xxx → supprimer
// =============================================================
require_once __DIR__ . '/config.php';

$method = $_SERVER['REQUEST_METHOD'];
$db = getDB();

// S'assurer que la table existe (création automatique si absente)
$db->exec("
    CREATE TABLE IF NOT EXISTS `member_schedules` (
        `id`                  VARCHAR(36)  NOT NULL,
        `user_id`             VARCHAR(36)  NOT NULL,
        `day_of_week`         TINYINT      NOT NULL,
        `start_time`          TIME         NOT NULL,
        `end_time`            TIME         NOT NULL,
        `break_start`         TIME         NULL DEFAULT NULL,
        `break_end`           TIME         NULL DEFAULT NULL,
        `tolerance_minutes`   TINYINT      NOT NULL DEFAULT 5,
        PRIMARY KEY (`id`),
        UNIQUE KEY `uq_member_day` (`user_id`, `day_of_week`)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
");

// ---- GET ----
if ($method === 'GET') {
    $userId = $_GET['user_id'] ?? null;
    if (!$userId) { http_response_code(400); echo json_encode(['error' => 'user_id requis']); exit; }
    $stmt = $db->prepare('SELECT day_of_week, start_time, end_time, break_start, break_end, tolerance_minutes FROM member_schedules WHERE user_id = ? ORDER BY day_of_week');
    $stmt->execute([$userId]);
    echo json_encode($stmt->fetchAll());
    exit;
}

// ---- PUT ----
if ($method === 'PUT') {
    $body   = json_decode(file_get_contents('php://input'), true);
    $userId = $body['userId'] ?? null;
    $days   = $body['days']   ?? [];

    if (!$userId || !is_array($days)) {
        http_response_code(400); echo json_encode(['error' => 'Données invalides']); exit;
    }

    $db->prepare('DELETE FROM member_schedules WHERE user_id = ?')->execute([$userId]);

    if (!empty($days)) {
        $stmt = $db->prepare(
            'INSERT INTO member_schedules (id, user_id, day_of_week, start_time, end_time, break_start, break_end, tolerance_minutes)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
        );
        foreach ($days as $d) {
            $tol   = isset($d['toleranceMinutes']) ? (int)$d['toleranceMinutes'] : 5;
            $bs    = !empty($d['breakStart']) ? $d['breakStart'] . (strlen($d['breakStart']) === 5 ? ':00' : '') : null;
            $be    = !empty($d['breakEnd'])   ? $d['breakEnd']   . (strlen($d['breakEnd'])   === 5 ? ':00' : '') : null;
            $stmt->execute([
                bin2hex(random_bytes(16)),
                $userId,
                (int)$d['dayOfWeek'],
                $d['startTime'] . (strlen($d['startTime']) === 5 ? ':00' : ''),
                $d['endTime']   . (strlen($d['endTime'])   === 5 ? ':00' : ''),
                $bs,
                $be,
                $tol,
            ]);
        }
    }

    echo json_encode(['success' => true]);
    exit;
}

// ---- DELETE ----
if ($method === 'DELETE') {
    $userId = $_GET['user_id'] ?? null;
    if (!$userId) { http_response_code(400); echo json_encode(['error' => 'user_id requis']); exit; }
    $db->prepare('DELETE FROM member_schedules WHERE user_id = ?')->execute([$userId]);
    echo json_encode(['success' => true]);
    exit;
}

http_response_code(405);
echo json_encode(['error' => 'Méthode non autorisée']);
