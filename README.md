<div align="center">

# ⏱ TimeFlow

### Application de gestion du temps de travail & pointage en ligne

![React](https://img.shields.io/badge/React-18-61DAFB?style=flat-square&logo=react)
![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?style=flat-square&logo=typescript)
![PHP](https://img.shields.io/badge/PHP-8.1-777BB4?style=flat-square&logo=php)
![MySQL](https://img.shields.io/badge/MySQL-5.7+-4479A1?style=flat-square&logo=mysql)
![Tailwind CSS](https://img.shields.io/badge/Tailwind-3-06B6D4?style=flat-square&logo=tailwindcss)
![Vite](https://img.shields.io/badge/Vite-5-646CFF?style=flat-square&logo=vite)

<br/>

> 🎓 Projet réalisé en **stage de 1ère année** à l'[EPSI](https://www.epsi.fr/) — développé seule, de A à Z, en conditions réelles en entreprise.

<br/>

<!--
  📸 SCREENSHOT À FAIRE — PAGE DE CONNEXION
  → Ouvrir http://localhost:8080
  → Navigateur plein écran (F11), sans barre d'adresse visible
  → Résolution recommandée : 1280×800
  → Sauvegarder sous : docs/screenshots/login.png
-->
![Écran de connexion](docs/screenshots/login.png)

</div>

---

## 🙋 À propos du projet

Ce projet a été conçu et développé **entièrement pendant mon stage de première année** à l'EPSI (École Supérieure de l'Alternance et de l'Informatique).

L'objectif était de répondre à un besoin réel de l'entreprise : **remplacer le suivi manuel des présences** (feuilles papier ou fichiers Excel) par une application web moderne, accessible depuis n'importe quel navigateur.

J'ai pris en charge :
- l'analyse du besoin avec le responsable
- la conception de la base de données
- le développement du backend en PHP (API REST)
- le développement du frontend en React/TypeScript
- les tests et la mise en production sur XAMPP

> C'est mon **premier projet full-stack complet**, réalisé en autonomie dans un contexte professionnel.

---

## 📋 Présentation

**TimeFlow** est une application web de **gestion du temps de travail** pour les équipes d'une organisation. Chaque membre peut pointer ses arrivées, pauses et départs depuis son navigateur. Les administrateurs disposent d'un tableau de bord complet pour suivre les présences en temps réel, détecter les retards, valider les pointages et exporter les données.

### Ce que l'application permet

| Rôle | Fonctionnalité |
|------|---------------|
| 👤 **Membre** | Pointer entrée / pause / reprise / sortie |
| 👤 **Membre** | Choisir entre Sur site ou Télétravail |
| 👤 **Membre** | Voir son planning hebdomadaire |
| 👤 **Membre** | Consulter son historique (semaine / mois / année) |
| 👤 **Membre** | Ajouter une justification sur un pointage |
| 🔐 **Admin** | Tableau de bord temps réel par équipe |
| 🔐 **Admin** | Valider, corriger ou supprimer des pointages |
| 🔐 **Admin** | Détecter automatiquement les retards et anomalies |
| 🔐 **Admin** | Gérer les plannings horaires (équipe & individuel) |
| 🔐 **Admin** | Créer et supprimer des comptes membres |
| 🔐 **Admin** | Exporter les données en Excel (XLSX) |
| 🔐 **Admin** | Laisser des annotations RH sur une période |
| 🔐 **Admin** | Importer des pointages en masse (CSV/XLSX) |

---

## 🖼 Captures d'écran

<!--
  📸 SCREENSHOT À FAIRE — DASHBOARD MEMBRE
  → Se connecter avec un compte membre
  → Ouvrir http://localhost:8080/dashboard
  → S'assurer que le planning de la semaine est visible en haut
  → Le bouton "POINTER ENTRÉE" doit être visible au centre
  → Résolution recommandée : 1280×900
  → Sauvegarder sous : docs/screenshots/dashboard.png
-->

### Espace membre — Pointage du jour

![Dashboard membre](docs/screenshots/dashboard.png)

<!--
  📸 SCREENSHOT À FAIRE — ADMIN TABLEAU DE BORD
  → Se connecter avec un compte admin
  → Ouvrir http://localhost:8080/admin
  → S'assurer qu'il y a des pointages visibles dans la liste
  → Résolution recommandée : 1440×900
  → Sauvegarder sous : docs/screenshots/admin-dashboard.png
-->

### Espace admin — Suivi des présences

![Admin dashboard](docs/screenshots/admin-dashboard.png)

<!--
  📸 SCREENSHOT À FAIRE — GESTION PLANNING
  → Dans l'espace admin, aller dans la section "Planning"
  → Afficher la grille horaire d'une équipe remplie (ex : Lun–Ven 09:00 → 17:00)
  → Résolution recommandée : 1440×900
  → Sauvegarder sous : docs/screenshots/admin-planning.png
-->

### Gestion des plannings

![Planning](docs/screenshots/admin-planning.png)

<!--
  📸 SCREENSHOT À FAIRE — HISTORIQUE MEMBRE
  → En tant que membre, cliquer sur "Voir mon historique de pointage"
  → La fenêtre doit s'ouvrir avec des données visibles (mode "Semaine")
  → Résolution recommandée : 1280×800
  → Sauvegarder sous : docs/screenshots/historique.png
-->

### Historique de pointages

![Historique](docs/screenshots/historique.png)

---

## 🧠 Explications techniques

### Comment ça fonctionne globalement

L'application est découpée en deux parties qui communiquent entre elles :

- **Le frontend** (ce que l'utilisateur voit) est construit avec **React**. C'est lui qui affiche les pages, gère les clics, et envoie des requêtes au backend.
- **Le backend** (la logique côté serveur) est écrit en **PHP**. Il reçoit les requêtes du frontend, lit ou écrit dans la base de données **MySQL**, et renvoie les données au format JSON.

```
Navigateur (React)  ←──── HTTP/JSON ────→  API PHP  ←──→  MySQL
```

---

### Le frontend — React + TypeScript

React permet de construire l'interface sous forme de **composants** réutilisables. Par exemple, le bouton de pointage, le planning de la semaine, ou la liste des pointages du jour sont chacun un composant indépendant.

TypeScript est une surcouche de JavaScript qui ajoute des **types** : on définit exactement à quoi ressemble un pointage, un utilisateur, un planning — ce qui évite les erreurs silencieuses.

```typescript
// Exemple : définition d'un pointage
export interface PunchRecord {
  id: string;
  userId: string;
  kind: "in" | "break_out" | "break_in" | "out"; // seulement ces 4 valeurs possibles
  location: "onsite" | "remote";
  at: string;       // date/heure ISO
  validated: boolean;
  late: boolean;
  justification?: string | null;
}
```

---

### Vite — le moteur de développement

**Vite** est l'outil qui compile le projet et lance le serveur local (`npm run dev`). Il transforme le TypeScript/React en JavaScript standard que le navigateur comprend, et recharge la page automatiquement à chaque modification de fichier. C'est beaucoup plus rapide que les anciens outils comme Webpack.

---

### Tailwind CSS — le style sans quitter le code

Au lieu d'écrire des fichiers CSS séparés, **Tailwind CSS** fournit des classes prêtes à l'emploi qu'on applique directement dans le JSX :

```jsx
// Sans Tailwind (CSS séparé)
<button className="mon-bouton">Pointer</button>

// Avec Tailwind (tout inline)
<button className="bg-blue-700 text-white px-8 py-4 rounded-2xl font-bold hover:scale-105 transition">
  Pointer
</button>
```

Chaque classe = une règle CSS. `bg-blue-700` = fond bleu foncé, `rounded-2xl` = coins très arrondis, `hover:scale-105` = légèrement agrandi au survol.

---

### Le backend — API REST en PHP

Le backend expose des **endpoints** (URLs) que le frontend appelle. Chaque fichier PHP gère une ressource :

| Fichier | Ce qu'il fait |
|---------|--------------|
| `users.php` | Connexion, création et suppression de comptes |
| `punches.php` | Créer, lire, modifier les pointages |
| `schedules.php` | Lire et sauvegarder les plannings d'équipe |
| `member_schedules.php` | Plannings individuels par membre |
| `rh_comments.php` | Annotations RH |

Exemple de flux pour un pointage :

```
1. L'utilisateur clique "POINTER ENTRÉE"
2. React envoie une requête POST vers /api/punches.php
   avec { userId, kind: "in", location: "onsite", at: "2024-05-07T09:03:00Z" }
3. PHP vérifie les données, les insère en base MySQL
4. PHP répond { success: true, id: "abc123" }
5. React affiche un toast "Entrée pointée à 09:03"
```

---

### La base de données — MySQL

La base contient 6 tables reliées entre elles :

```
users ──────────────────────────────────────────┐
  │                                              │
  ├──→ punch_records  (tous les pointages)       │
  │                                              │
  └──→ member_schedules (planning individuel)    │
                                                 │
team_codes         (codes d'accès par équipe)    │
weekly_schedules   (planning par équipe)         │
rh_comments        (annotations RH)  ───────────┘
```

La relation clé : un `punch_record` appartient toujours à un `user` — si le compte est supprimé, tous ses pointages le sont aussi (CASCADE).

---

### Sécurité & authentification

- Les mots de passe sont stockés **hashés** en base (PHP `password_hash()`)
- La session est gardée dans le `localStorage` du navigateur
- Les codes d'accès par équipe empêchent n'importe qui de s'inscrire
- Les headers CORS sont configurés dans `config.php`

---

## 🏗 Structure du projet

```
timeflow/
├── api/                        # Backend PHP (API REST)
│   ├── config.php              # Connexion MySQL + CORS
│   ├── users.php               # Auth, création, suppression
│   ├── punches.php             # CRUD pointages
│   ├── schedules.php           # Plannings équipe
│   ├── member_schedules.php    # Plannings individuels
│   └── rh_comments.php        # Annotations RH
│
├── database/
│   └── timeflow.sql            # Schéma complet + données initiales
│
└── src/                        # Frontend React/TypeScript
    ├── components/
    │   ├── app/                # AppHeader, Logo
    │   └── ui/                 # Composants shadcn/ui (boutons, modals…)
    ├── contexts/
    │   └── AuthContext.tsx     # Gestion de la session utilisateur
    ├── lib/
    │   ├── store.ts            # Tous les appels API vers le backend
    │   ├── teams.ts            # Configuration des équipes et codes
    │   ├── time.ts             # Calculs de temps, fuseaux horaires
    │   └── utils.ts            # Fonctions utilitaires
    └── pages/
        ├── Login.tsx           # Page connexion & inscription
        ├── Dashboard.tsx       # Espace membre
        └── Admin.tsx           # Espace administrateur
```

---

## 🚀 Installation

### Prérequis

- [Node.js](https://nodejs.org/) ≥ 18
- [XAMPP](https://www.apachefriends.org/) (Apache + MySQL)

### 1. Cloner le dépôt

```bash
git clone https://github.com/votre-utilisateur/timeflow.git
cd timeflow
```

### 2. Créer la base de données

1. Lancer XAMPP → démarrer **Apache** et **MySQL**
2. Ouvrir [phpMyAdmin](http://localhost/phpmyadmin)
3. Importer `database/timeflow.sql`

### 3. Déployer l'API PHP

Copier le dossier dans `htdocs` de XAMPP :

```
C:\xampp\htdocs\timeflow\      (Windows)
/opt/lampp/htdocs/timeflow/    (Linux/Mac)
```

Tester que l'API fonctionne : [http://localhost/timeflow/api/check.php](http://localhost/timeflow/api/check.php)

### 4. Lancer le frontend

```bash
npm install
npm run dev
```

Application disponible sur → **[http://localhost:8080](http://localhost:8080)**

---

## 🔑 Codes d'accès

Requis à l'inscription pour rejoindre une équipe.

| Équipe | Code membre | Code admin |
|--------|-------------|------------|
| IT | `IT-2024-MBR` | `ADMIN-IT-2024-PRIV` |
| Dev | `DEV-2024-MBR` | `ADMIN-DEV-2024-PRIV` |
| Ops | `OPS-2024-MBR` | `ADMIN-OPS-2024-PRIV` |
| RH | `RH-2024-MBR` | `ADMIN-RH-2024-PRIV` |

---

## 🛠 Stack technique

| | Technologie | Pourquoi |
|--|-------------|----------|
| ⚡ | **Vite 5** | Compilation ultra-rapide, HMR instantané |
| ⚛️ | **React 18** | Composants réactifs, gestion d'état simple |
| 🔷 | **TypeScript 5** | Typage fort, moins d'erreurs à l'exécution |
| 🎨 | **Tailwind CSS 3** | Style rapide et cohérent sans CSS séparé |
| 🧩 | **shadcn/ui** | Composants accessibles et personnalisables |
| 🐘 | **PHP 8.1** | Backend léger, compatible XAMPP |
| 🗃️ | **MySQL** | Base de données relationnelle éprouvée |
| ✅ | **Zod** | Validation des formulaires côté frontend |
| 📊 | **SheetJS** | Export Excel des pointages |

---

## 📄 Licence

MIT — libre d'utilisation et de modification.

---

<div align="center">

Projet réalisé par une étudiante en 1ère année à l'**EPSI** · Stage 2024  
*Premier projet full-stack — React · TypeScript · PHP · MySQL*

</div>
