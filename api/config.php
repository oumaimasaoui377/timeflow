<?php
// =============================================================
// Configuration base de données — XAMPP / MySQL
// =============================================================

date_default_timezone_set('Europe/Paris');

define('DB_HOST',    'localhost');
define('DB_NAME',    'timeflow');
define('DB_USER',    'root');
define('DB_PASS',    '');
define('DB_CHARSET', 'utf8mb4');

function getDB(): PDO {
    static $pdo = null;
    if ($pdo === null) {
        $dsn = "mysql:host=" . DB_HOST . ";dbname=" . DB_NAME . ";charset=" . DB_CHARSET;
        try {
            $pdo = new PDO($dsn, DB_USER, DB_PASS, [
                PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
                PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
                PDO::ATTR_EMULATE_PREPARES   => false,
            ]);
            $pdo->exec("SET time_zone = '+00:00'");
        } catch (PDOException $e) {
            http_response_code(500);
            // ⚠️ Vider tout output buffer avant d'envoyer du JSON
            while (ob_get_level()) ob_end_clean();
            header('Content-Type: application/json; charset=utf-8');
            die(json_encode(['error' => 'Connexion DB échouée : ' . $e->getMessage()]));
        }
    }
    return $pdo;
}

// ─── Vider tout output parasite (BOM, espaces, warnings PHP) ───
while (ob_get_level()) ob_end_clean();
ob_start();

// ─── Headers CORS — accepte TOUS les origines localhost ────────
$origin = $_SERVER['HTTP_ORIGIN'] ?? '';
// Autorise n'importe quel port localhost (Vite utilise :5173, :8080, :3000…)
if (preg_match('#^https?://localhost(:\d+)?$#', $origin)) {
    header("Access-Control-Allow-Origin: $origin");
} else {
    header('Access-Control-Allow-Origin: *');
}
header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    ob_end_clean();
    exit;
}
