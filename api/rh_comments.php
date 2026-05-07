<?php
// =============================================================
// API — Commentaires RH
// =============================================================
require_once __DIR__ . '/config.php';

$method = $_SERVER['REQUEST_METHOD'];
$db = getDB();

if ($method === 'GET') {
    $teamId = $_GET['team_id'] ?? null;
    if (!$teamId) { http_response_code(400); echo json_encode(['error'=>'team_id requis']); exit; }
    $sql    = 'SELECT r.*, u.full_name as admin_name FROM rh_comments r JOIN users u ON u.id=r.admin_id WHERE r.team_id=?';
    $params = [$teamId];
    if (!empty($_GET['from'])) { $sql .= ' AND r.period_from >= ?'; $params[] = $_GET['from']; }
    if (!empty($_GET['to']))   { $sql .= ' AND r.period_to <= ?';   $params[] = $_GET['to']; }
    $sql .= ' ORDER BY r.created_at DESC';
    $stmt = $db->prepare($sql); $stmt->execute($params);
    echo json_encode($stmt->fetchAll());
    exit;
}

if ($method === 'POST') {
    $body       = json_decode(file_get_contents('php://input'), true);
    $adminId    = $body['adminId']    ?? null;
    $teamId     = $body['teamId']     ?? null;
    $periodFrom = $body['periodFrom'] ?? null;
    $periodTo   = $body['periodTo']   ?? null;
    $comment    = trim($body['comment'] ?? '');
    if (!$adminId || !$teamId || !$periodFrom || !$periodTo || !$comment) {
        http_response_code(400); echo json_encode(['error'=>'Données manquantes']); exit;
    }
    $id = bin2hex(random_bytes(16));
    $db->prepare('INSERT INTO rh_comments (id,admin_id,team_id,period_from,period_to,comment) VALUES (?,?,?,?,?,?)')
       ->execute([$id, $adminId, $teamId, $periodFrom, $periodTo, $comment]);
    http_response_code(201); echo json_encode(['success'=>true,'id'=>$id]);
    exit;
}

if ($method === 'DELETE') {
    $id = $_GET['id'] ?? null;
    if (!$id) { http_response_code(400); echo json_encode(['error'=>'ID requis']); exit; }
    $db->prepare('DELETE FROM rh_comments WHERE id=?')->execute([$id]);
    echo json_encode(['success'=>true]);
    exit;
}

http_response_code(405); echo json_encode(['error'=>'Méthode non autorisée']);
