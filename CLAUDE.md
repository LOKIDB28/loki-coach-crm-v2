# LOKI CRM v2 : règles pour Claude Code

CRM interne de LOKI Coach (motorisés Prévost de luxe, Québec). Next.js 15 (App Router, TypeScript, Tailwind), Supabase (PostgreSQL), Vercel. Utilisateur : Louis-Philippe (LP), qui exécute le SQL, fusionne les PR et teste. Réponds en français, directement, sans flatterie.

## Règles permanentes

1. **Visuel :** skill apple-design, aperçu publié d'abord, approbation de LP, puis le code.
2. **Couleurs réservées, jamais touchées :** vert vif `#A6FA30` (Gagné, « Enregistré ✓ », « Copié ✓ » seulement), `INTELLIGENCE_YELLOW`, `LEAD_AGE_COLORS`, `RELANCE_COLORS`, `REP_COLORS`, `HOVER_TOOLTIP_BG`, `IMPORT_BADGE_COLOR`, rouge destructif Tailwind. Aucune nouvelle couleur sans demande. Le orange personnalisé de `theme.ts` masque la palette orange de Tailwind : `orange-700` ne compile pas.
3. **Données réelles :** aucune capture ni affichage de vraies données de clients. Données fictives ou banc d'essai hors du dépôt. Aucune écriture en production. Les tests e2e sont en lecture seule (compte `qa-bot`).
4. **Suppression de fichiers :** seulement les tiens, par nom exact, jamais par motif (`*.png`). Liste d'abord.
5. **Fusion :** ne fusionne jamais. Diff complet en texte, puis typecheck, lint, build, e2e, puis PR avec `gh`. Avant de choisir une branche de base, vérifie `gh pr view N --json state`.
6. **Pas de `/loop`** ni de réveil programmé.
7. **Hors de la zone demandée :** signale le problème, ne le corrige pas.
8. **Coût :** une session par chantier. Ne republie pas d'aperçu sans nécessité, ne relance pas toute la suite e2e pour un petit changement.

## Base de données et sécurité

- Tu n'exécutes aucun SQL. LP l'exécute dans le SQL Editor, section par section, avec une requête de vérification après chacune.
- Migrations numérotées dans `supabase/migrations/`, commentées, additives quand c'est possible.
- Aucune clé, aucun mot de passe : noms de variables d'environnement seulement, jamais les valeurs.
- `service_role` : lecture seule sur `deals`, `contacts`, `activities`, `pipeline_stages`. Tout nouveau besoin d'écriture passe par une fonction étroite en `SECURITY DEFINER`, avec `EXECUTE` retiré à `anon` et `authenticated`, et l'accord explicite de LP.
- Exception : une fonction `SECURITY DEFINER` qui n'agit que sur la ligne de `auth.uid()` (et refuse si `auth.uid()` est nul) peut être exécutable par `authenticated`, jamais par `anon`. Exemple : `regenerate_my_calendar_token()` (migration 0029).

## Décisions à ne pas rouvrir

- On archive, on ne supprime jamais (sauf une photo ou un document individuel). Les activités sont en ajout seulement.
- Les doublons sont signalés, jamais bloqués ni fusionnés automatiquement.
- Aucun courriel ni SMS automatique envoyé à des clients. Aucun scoring prédictif.
- Tous les utilisateurs internes voient tout. Les admins ne sont pas assignables à un dossier.
- La source d'un dossier est `contacts.source`, seule vérité.
- **Matériaux translucides :** le verre (flou) est réservé aux fonds assombris et aux barres flottantes (`.glass-scrim`, `.glass-bar`). Jamais sur les surfaces de lecture (panneaux de formulaire et de tiroir, cartes, tableaux), jamais empilé. Le texte `text-textSoft` doit rester à 4,5:1 minimum dans les deux thèmes.

## Git

- Utilise `git --no-pager` pour éviter le visionneur.
- Compte `gh` actif : `LOKIDB28`. Vérifie `gh auth status` avant de pousser.
