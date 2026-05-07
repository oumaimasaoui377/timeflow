<?php
// =============================================================
// API — Pointages (punch_records)
// =============================================================
require_once __DIR__ . '/config.php';

$method = $_SERVER['REQUEST_METHOD'];
$db = getDB();

function toMysqlDatetime(string $isoString): string {
    try {
        $dt = new DateTime($isoString, new DateTimeZone('UTC'));
        $dt->setTimezone(new DateTimeZone('Europe/Paris'));
        return $dt->format('Y-m-d H:i:s');
    } catch (Exception $e) {
        return (new DateTime('now', new DateTimeZone('Europe/Paris')))->format('Y-m-d H:i:s');
    }
}

// ---- GET ----
if ($method === 'GET') {
    $where  = [];
    $params = [];

    if (!empty($_GET['user_id'])) {
        $where[]  = 'p.user_id = ?';
        $params[] = $_GET['user_id'];

        if (!empty($_GET['today'])) {
            $where[] = "DATE(CONVERT_TZ(p.at_time, '+00:00', 'Europe/Paris')) = CURDATE()";
        }

        if (!empty($_GET['period']) && !empty($_GET['ref'])) {
            $ref    = $_GET['ref'];
            $period = $_GET['period'];
            if ($period === 'week') {
                $where[]  = 'YEARWEEK(p.at_time, 1) = YEARWEEK(?, 1)';
                $params[] = $ref;
            } elseif ($period === 'month') {
                $where[]  = "DATE_FORMAT(p.at_time, '%Y-%m') = DATE_FORMAT(?, '%Y-%m')";
                $params[] = $ref;
            } elseif ($period === 'year') {
                $year   = (int)substr($ref, 0, 4);
                $month  = (int)substr($ref, 5, 2);
                $yStart = $month >= 9 ? $year : $year - 1;
                $yEnd   = $yStart + 1;
                $where[]  = 'p.at_time BETWEEN ? AND ?';
                $params[] = "$yStart-09-01 00:00:00";
                $params[] = "$yEnd-08-31 23:59:59";
            }
        }
    }

    if (!empty($_GET['team_id'])) {
        $where[]  = 'p.team_id = ?';
        $params[] = $_GET['team_id'];
    }

    if (!empty($_GET['from'])) { $where[] = 'DATE(p.at_time) >= ?'; $params[] = $_GET['from']; }
    if (!empty($_GET['to']))   { $where[] = 'DATE(p.at_time) <= ?'; $params[] = $_GET['to']; }

    $sql = 'SELECT p.*, DATE_FORMAT(p.at_time, "%Y-%m-%dT%H:%i:%s.000Z") as at_time FROM punch_records p';
    if ($where) $sql .= ' WHERE ' . implode(' AND ', $where);
    $sql .= ' ORDER BY p.at_time ASC';

    $stmt = $db->prepare($sql);
    $stmt->execute($params);
    echo json_encode($stmt->fetchAll());
    exit;
}

// ---- POST ----
if ($method === 'POST') {
    $body         = json_decode(file_get_contents('php://input'), true);
    $userId       = $body['userId']       ?? null;
    $userFullName = $body['userFullName'] ?? null;
    $teamId       = $body['teamId']       ?? null;
    $kind         = $body['kind']         ?? null;
    $location     = $body['location']     ?? 'onsite';
    $late         = !empty($body['late']) ? 1 : 0;
    $justif       = isset($body['justification']) ? trim($body['justification']) : null;

    $atRaw = $body['at'] ?? null;
    $at    = $atRaw
        ? toMysqlDatetime($atRaw)
        : (new DateTime('now', new DateTimeZone('Europe/Paris')))->format('Y-m-d H:i:s');

    $allowed = ['in', 'break_out', 'break_in', 'out'];
    if (!$userId || !$teamId || !in_array($kind, $allowed)) {
        http_response_code(400);
        echo json_encode(['error' => 'Champs obligatoires invalides']);
        exit;
    }

    $id = bin2hex(random_bytes(16));
    $db->prepare(
        'INSERT INTO punch_records (id, user_id, user_full_name, team_id, kind, location, at_time, validated, late, justification)
         VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?, ?)'
    )->execute([$id, $userId, $userFullName, $teamId, $kind, $location, $at, $late, $justif]);

    http_response_code(201);
    echo json_encode(['success' => true, 'id' => $id]);
    exit;
}

// ---- PUT ----
if ($method === 'PUT') {
    $id = $_GET['id'] ?? null;
    if (!$id) { http_response_code(400); echo json_encode(['error' => 'ID requis']); exit; }

    $body = json_decode(file_get_contents('php://input'), true);
    if (isset($body['validated'])) {
        $db->prepare('UPDATE punch_records SET validated=? WHERE id=?')
           ->execute([(int)(bool)$body['validated'], $id]);
    }
    if (isset($body['late'])) {
        $db->prepare('UPDATE punch_records SET late=? WHERE id=?')
           ->execute([(int)(bool)$body['late'], $id]);
    }
    if (array_key_exists('at', $body)) {
        $db->prepare('UPDATE punch_records SET at_time=? WHERE id=?')
           ->execute([toMysqlDatetime($body['at']), $id]);
    }
    if (array_key_exists('justification', $body)) {
        $db->prepare('UPDATE punch_records SET justification=? WHERE id=?')
           ->execute([trim($body['justification']) ?: null, $id]);
    }
    echo json_encode(['success' => true]);
    exit;
}

http_response_code(405);
echo json_encode(['error' => 'Méthode non autorisée']);
