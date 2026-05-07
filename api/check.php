<?php
// =============================================================
// Diagnostic — http://localhost/timeflow/api/check.php
// À SUPPRIMER en production !
// =============================================================
require_once __DIR__ . '/config.php';

$db = getDB();

// Test connexion DB
$ok = true;
$results = [];

try {
    $stmt = $db->query('SELECT COUNT(*) as n FROM users');
    $row = $stmt->fetch();
    $results['users_count'] = $row['n'];
    $results['db_connection'] = '✅ OK';
} catch (Exception $e) {
    $results['db_connection'] = '❌ ' . $e->getMessage();
    $ok = false;
}

try {
    $stmt = $db->query('SELECT COUNT(*) as n FROM punch_records');
    $results['punches_count'] = $stmt->fetch()['n'];
} catch (Exception $e) {
    $results['punches_count'] = '❌ Table manquante';
}

try {
    $stmt = $db->query('SELECT COUNT(*) as n FROM weekly_schedules');
    $results['schedules_count'] = $stmt->fetch()['n'];
} catch (Exception $e) {
    $results['schedules_count'] = '❌ Table manquante';
}

try {
    $stmt = $db->query('SELECT COUNT(*) as n FROM rh_comments');
    $results['rh_comments_count'] = $stmt->fetch()['n'];
} catch (Exception $e) {
    $results['rh_comments_count'] = '❌ Table manquante';
}

// Lister les utilisateurs (sans hash)
try {
    $stmt = $db->query('SELECT id, full_name, email, team_id, role, created_at FROM users ORDER BY created_at DESC');
    $results['users'] = $stmt->fetchAll();
} catch (Exception $e) {
    $results['users'] = [];
}

// Test password_hash PHP
$testHash = password_hash('demo1234', PASSWORD_BCRYPT);
$testVerify = password_verify('demo1234', $testHash);
$results['php_bcrypt'] = $testVerify ? '✅ OK (bcrypt fonctionnel)' : '❌ Bcrypt KO';
$results['php_version'] = phpversion();

$results['status'] = $ok ? '✅ Tout est OK' : '❌ Erreurs détectées';

echo json_encode($results, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);
