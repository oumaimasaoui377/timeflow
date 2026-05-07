<?php
// =============================================================
// API — Planning hebdomadaire (weekly_schedules)
// GET    /api/schedules.php?team_id=xxx  → planning de l'équipe
// PUT    /api/schedules.php              → mettre à jour le planning
// =============================================================
require_once __DIR__ . '/config.php';

$method = $_SERVER['REQUEST_METHOD'];
$db = getDB();

// S'assurer que les colonnes break_start/break_end/tolerance_minutes existent
try {
    $db->exec("ALTER TABLE weekly_schedules
        ADD COLUMN IF NOT EXISTS break_start        TIME    NULL DEFAULT NULL,
        ADD COLUMN IF NOT EXISTS break_end          TIME    NULL DEFAULT NULL,
        ADD COLUMN IF NOT EXISTS tolerance_minutes  TINYINT NOT NULL DEFAULT 5
    ");
} catch (Exception $e) { /* colonnes déjà présentes, ignorer */ }

if ($method === 'GET') {
    $teamId = $_GET['team_id'] ?? null;
    if (!$teamId) { http_response_code(400); echo json_encode(['error'=>'team_id requis']); exit; }
    $stmt = $db->prepare('SELECT day_of_week, start_time, end_time, break_start, break_end, tolerance_minutes FROM weekly_schedules WHERE team_id = ? ORDER BY day_of_week');
    $stmt->execute([$teamId]);
    echo json_encode($stmt->fetchAll());
    exit;
}

if ($method === 'PUT') {
    $body    = json_decode(file_get_contents('php://input'), true);
    $teamId  = $body['teamId']  ?? null;
    $adminId = $body['adminId'] ?? null;
    $days    = $body['days']    ?? [];

    if (!$teamId || !$adminId || !is_array($days)) {
        http_response_code(400); echo json_encode(['error'=>'Données invalides']); exit;
    }

    $stmt = $db->prepare('
        INSERT INTO weekly_schedules (id, team_id, day_of_week, start_time, end_time, break_start, break_end, tolerance_minutes, updated_by, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())
        ON DUPLICATE KEY UPDATE
            start_time=VALUES(start_time),
            end_time=VALUES(end_time),
            break_start=VALUES(break_start),
            break_end=VALUES(break_end),
            tolerance_minutes=VALUES(tolerance_minutes),
            updated_by=VALUES(updated_by),
            updated_at=NOW()
    ');
    foreach ($days as $d) {
        $tol = isset($d['toleranceMinutes']) ? (int)$d['toleranceMinutes'] : 5;
        $bs  = !empty($d['breakStart']) ? $d['breakStart'] . (strlen($d['breakStart']) === 5 ? ':00' : '') : null;
        $be  = !empty($d['breakEnd'])   ? $d['breakEnd']   . (strlen($d['breakEnd'])   === 5 ? ':00' : '') : null;
        $stmt->execute([
            bin2hex(random_bytes(16)),
            $teamId,
            (int)$d['dayOfWeek'],
            $d['startTime'] . (strlen($d['startTime']) === 5 ? ':00' : ''),
            $d['endTime']   . (strlen($d['endTime'])   === 5 ? ':00' : ''),
            $bs, $be, $tol,
            $adminId,
        ]);
    }
    echo json_encode(['success' => true]);
    exit;
}

http_response_code(405); echo json_encode(['error' => 'Méthode non autorisée']);
