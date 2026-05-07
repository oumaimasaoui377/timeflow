-- ================================================================
-- VUES RACCOURCIS — à importer une seule fois dans phpMyAdmin
-- Après ça, tu cliques sur la vue dans la liste à gauche et
-- les données s'affichent directement, sans taper de requête.
-- ================================================================

USE `timeflow`;

-- Vue 1 : Tous les utilisateurs inscrits (sans le mot de passe)
CREATE OR REPLACE VIEW `vue_utilisateurs` AS
SELECT
  id,
  full_name        AS `Nom`,
  email            AS `Email`,
  team_id          AS `Equipe`,
  role             AS `Role`,
  created_at       AS `Inscrit le`
FROM users
ORDER BY created_at DESC;

-- Vue 2 : Tous les pointages avec le nom de l'employé
CREATE OR REPLACE VIEW `vue_pointages` AS
SELECT
  p.id,
  u.full_name      AS `Employe`,
  u.email          AS `Email`,
  p.team_id        AS `Equipe`,
  p.kind           AS `Type`,
  p.location       AS `Lieu`,
  p.at_time        AS `Heure`,
  p.late           AS `Retard`,
  p.justification  AS `Justification`,
  p.validated      AS `Valide`,
  p.created_at     AS `Cree le`
FROM punch_records p
JOIN users u ON u.id = p.user_id
ORDER BY p.at_time DESC;

-- Vue 3 : Pointages du jour uniquement
CREATE OR REPLACE VIEW `vue_pointages_aujourdhui` AS
SELECT
  u.full_name      AS `Employe`,
  p.team_id        AS `Equipe`,
  p.kind           AS `Type`,
  p.location       AS `Lieu`,
  p.at_time        AS `Heure`,
  p.late           AS `Retard`,
  p.justification  AS `Justification`,
  p.validated      AS `Valide`
FROM punch_records p
JOIN users u ON u.id = p.user_id
WHERE DATE(p.at_time) = CURDATE()
ORDER BY p.at_time DESC;

-- Vue 4 : Commentaires RH avec le nom de l'admin
CREATE OR REPLACE VIEW `vue_commentaires_rh` AS
SELECT
  c.id,
  u.full_name      AS `Admin`,
  c.team_id        AS `Equipe`,
  c.period_from    AS `Debut`,
  c.period_to      AS `Fin`,
  c.comment        AS `Commentaire`,
  c.created_at     AS `Date`
FROM rh_comments c
JOIN users u ON u.id = c.admin_id
ORDER BY c.created_at DESC;
