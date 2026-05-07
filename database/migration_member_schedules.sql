-- ============================================================
-- Migration : ajout de la table member_schedules
-- À exécuter UNE SEULE FOIS sur votre base existante
-- Compatible avec la base timeflow déjà en place
-- ============================================================

CREATE TABLE IF NOT EXISTS `member_schedules` (
  `id`                  VARCHAR(36)  NOT NULL,
  `user_id`             VARCHAR(36)  NOT NULL,
  `day_of_week`         TINYINT      NOT NULL COMMENT '1=Lun 2=Mar 3=Mer 4=Jeu 5=Ven 6=Sam 7=Dim',
  `start_time`          TIME         NOT NULL,
  `end_time`            TIME         NOT NULL,
  `tolerance_minutes`   TINYINT      NOT NULL DEFAULT 5 COMMENT 'Tolérance en minutes avant retard',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_member_day` (`user_id`, `day_of_week`),
  CONSTRAINT `fk_ms_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Vérification
SELECT 'Table member_schedules créée avec succès.' AS statut;
