-- ================================================================
-- BASE DE DONNÉES : timeflow  v1
-- Compatible MySQL 5.7+ / MariaDB 10.3+ (XAMPP)
-- IMPORTANT : at_time est stocké en heure locale (Europe/Paris).
--             Le backend PHP convertit les horodatages ISO 8601
--             reçus du frontend avant insertion.
-- ================================================================

CREATE DATABASE IF NOT EXISTS `timeflow`
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE `timeflow`;

-- Table : users
CREATE TABLE IF NOT EXISTS `users` (
  `id`            VARCHAR(36)  NOT NULL,
  `full_name`     VARCHAR(120) NOT NULL,
  `email`         VARCHAR(180) NOT NULL,
  `password_hash` VARCHAR(255) NOT NULL,
  `team_id`       ENUM('it','dev','ops','rh') NOT NULL,
  `role`          ENUM('member','admin') NOT NULL DEFAULT 'member',
  `created_at`    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_email` (`email`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Table : punch_records
CREATE TABLE IF NOT EXISTS `punch_records` (
  `id`             VARCHAR(36)  NOT NULL,
  `user_id`        VARCHAR(36)  NOT NULL,
  `user_full_name` VARCHAR(120) NOT NULL,
  `team_id`        ENUM('it','dev','ops','rh') NOT NULL,
  `kind`           ENUM('in','break_out','break_in','out') NOT NULL,
  `location`       ENUM('onsite','remote') NOT NULL DEFAULT 'onsite',
  `at_time`        DATETIME     NOT NULL,
  `validated`      TINYINT(1)   NOT NULL DEFAULT 0,
  `late`           TINYINT(1)   NOT NULL DEFAULT 0,
  `justification`  TEXT         NULL,
  `created_at`     DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_user_id` (`user_id`),
  KEY `idx_team_id` (`team_id`),
  KEY `idx_at_time` (`at_time`),
  CONSTRAINT `fk_punch_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Table : team_codes
CREATE TABLE IF NOT EXISTS `team_codes` (
  `team_id`     ENUM('it','dev','ops','rh') NOT NULL,
  `member_code` VARCHAR(80) NOT NULL,
  `admin_code`  VARCHAR(80) NOT NULL,
  PRIMARY KEY (`team_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Table : weekly_schedules (planning par équipe)
CREATE TABLE IF NOT EXISTS `weekly_schedules` (
  `id`          VARCHAR(36) NOT NULL,
  `team_id`     ENUM('it','dev','ops','rh') NOT NULL,
  `day_of_week` TINYINT     NOT NULL COMMENT '1=Lun 2=Mar 3=Mer 4=Jeu 5=Ven 6=Sam 7=Dim',
  `start_time`  TIME        NOT NULL,
  `end_time`    TIME        NOT NULL,
  `updated_by`  VARCHAR(36) NULL,
  `updated_at`  DATETIME    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_team_day` (`team_id`, `day_of_week`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Table : member_schedules (planning individuel — prioritaire sur équipe)
CREATE TABLE IF NOT EXISTS `member_schedules` (
  `id`                  VARCHAR(36) NOT NULL,
  `user_id`             VARCHAR(36) NOT NULL,
  `day_of_week`         TINYINT     NOT NULL COMMENT '1=Lun … 7=Dim',
  `start_time`          TIME        NOT NULL,
  `end_time`            TIME        NOT NULL,
  `break_start`         TIME        NULL,
  `break_end`           TIME        NULL,
  `tolerance_minutes`   TINYINT     NOT NULL DEFAULT 5,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_member_day` (`user_id`, `day_of_week`),
  CONSTRAINT `fk_ms_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Table : rh_comments (annotations RH)
CREATE TABLE IF NOT EXISTS `rh_comments` (
  `id`          VARCHAR(36)  NOT NULL,
  `admin_id`    VARCHAR(36)  NOT NULL,
  `admin_name`  VARCHAR(120) NOT NULL,
  `team_id`     ENUM('it','dev','ops','rh') NOT NULL,
  `period_from` DATE         NOT NULL,
  `period_to`   DATE         NOT NULL,
  `comment`     TEXT         NOT NULL,
  `created_at`  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Données initiales : codes d'accès par équipe
INSERT IGNORE INTO `team_codes` (`team_id`, `member_code`, `admin_code`) VALUES
  ('it',  'IT-2024-MBR',  'ADMIN-IT-2024-PRIV'),
  ('dev', 'DEV-2024-MBR', 'ADMIN-DEV-2024-PRIV'),
  ('ops', 'OPS-2024-MBR', 'ADMIN-OPS-2024-PRIV'),
  ('rh',  'RH-2024-MBR',  'ADMIN-RH-2024-PRIV');
