<?php
// =============================================================
// API — Utilisateurs
// GET    /api/users.php          → liste tous les utilisateurs
// POST   /api/users.php          → crée un utilisateur
// DELETE /api/users.php?id=xxx   → supprime un utilisateur
// POST   /api/users.php?action=login → authentification
// =============================================================
require_once __DIR__ . '/config.php';

$method = $_SERVER['REQUEST_METHOD'];
$action = $_GET['action'] ?? null;
$db = getDB();

// ---- LOGIN ----
if ($method === 'POST' && $action === 'login') {
    $body     = json_decode(file_get_contents('php://input'), true);
    $email    = trim($body['email']    ?? '');
    $password = trim($body['password'] ?? '');

    if (!$email || !$password) {
        http_response_code(400);
        echo json_encode(['error' => 'Email et mot de passe requis']);
        exit;
    }

    $stmt = $db->prepare('SELECT * FROM users WHERE email = ?');
    $stmt->execute([$email]);
    $user = $stmt->fetch();

    if (!$user || !password_verify($password, $user['password_hash'])) {
        http_response_code(401);
        echo json_encode(['error' => 'Identifiants incorrects']);
        exit;
    }

    unset($user['password_hash']);
    echo json_encode(['success' => true, 'user' => $user]);
    exit;
}

// ---- GET : liste utilisateurs ----
if ($method === 'GET') {
    $stmt = $db->query('SELECT id, full_name, email, team_id, role, created_at FROM users ORDER BY full_name');
    echo json_encode($stmt->fetchAll());
    exit;
}

// ---- POST : créer utilisateur ----
if ($method === 'POST') {
    $body     = json_decode(file_get_contents('php://input'), true);
    $fullName = trim($body['fullName'] ?? '');
    $email    = strtolower(trim($body['email']    ?? ''));
    $password = trim($body['password'] ?? '');
    $teamId   = trim($body['teamId']   ?? '');
    $role     = in_array($body['role'] ?? '', ['member', 'admin']) ? $body['role'] : 'member';

    if (!$fullName || !$email || !$password || !$teamId) {
        http_response_code(400);
        echo json_encode(['error' => 'Champs obligatoires manquants']);
        exit;
    }

    $chk = $db->prepare('SELECT id FROM users WHERE email = ?');
    $chk->execute([$email]);
    if ($chk->fetch()) {
        http_response_code(409);
        echo json_encode(['error' => 'Email déjà utilisé']);
        exit;
    }

    $hash = password_hash($password, PASSWORD_BCRYPT);
    $id   = bin2hex(random_bytes(16));

    $db->prepare('INSERT INTO users (id, full_name, email, password_hash, team_id, role) VALUES (?, ?, ?, ?, ?, ?)')
       ->execute([$id, $fullName, $email, $hash, $teamId, $role]);

    http_response_code(201);
    echo json_encode(['success' => true, 'id' => $id]);
    exit;
}

// ---- DELETE ----
if ($method === 'DELETE') {
    $id = $_GET['id'] ?? null;
    if (!$id) { http_response_code(400); echo json_encode(['error' => 'ID requis']); exit; }
    $db->prepare('DELETE FROM users WHERE id = ?')->execute([$id]);
    echo json_encode(['success' => true]);
    exit;
}

http_response_code(405);
echo json_encode(['error' => 'Méthode non autorisée']);
