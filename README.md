# Stellar Game — V11

Jeu de tanks multijoueur sur PC et mobile, avec les graphismes et le logo du projet original.

## Lancer la copie récupérée de GitHub

```bash
git clone https://github.com/isbruz1/stellar-game.git
cd stellar-game
npm ci
npm start
```

Ouvrir http://localhost:3000. Pour essayer la version V11 avant fusion, utiliser la branche `improvements/stellar-v11` avec `git switch improvements/stellar-v11` avant `npm ci`.

## Nouveautés

- Déplacements calculés par le serveur à fréquence fixe ; envoyer plus de messages ne fait plus accélérer le tank.
- Carte envoyée une seule fois par manche, au lieu de vingt fois par seconde.
- Chat du salon, limité à 180 caractères et protégé contre les messages trop rapprochés.
- Invitation par lien avec code de serveur prérempli après sélection du profil.
- Réglages accessibles depuis les profils, le menu et le salon : sons, animations réduites, interface compacte.
- Sauvegarde JSON des profils et restauration sans écraser les profils déjà présents.
- Statistiques locales de parties, victoires et éliminations. Les statistiques incluses dans un export sont informatives ; la restauration importe les profils uniquement.
- Tir continu à la souris, remise à zéro des commandes quand la fenêtre perd le focus.
- Indicateur de connexion et de latence, retour aux profils après reconnexion.
- Menus utilisables en portrait ; avertissement paysage pendant le combat seulement.
- Quitter une manche ne redonne plus la vie ; l’hôte peut quitter son salon ; anciens salons correctement quittés.
- Endpoint `/health`, configuration Render et tests automatiques GitHub Actions.

Les profils sont locaux, sans authentification distante. Après réinitialisation, importer une sauvegarde faite auparavant permet de les restaurer. GitHub conserve le code et les assets, pas les profils du navigateur. Les salons et parties sont en mémoire et disparaissent au redémarrage du serveur.

## Vérifications

`npm test` vérifie les déplacements, l’arrêt des commandes périmées, l’envoi de la carte, les salons, le chat et l’absence de résurrection lors du retour au salon. Vérifier aussi sur les appareils réels : joysticks, clavier, invitation, import/export et reconnexion.

## Render

Le fichier `render.yaml` permet une création par Blueprint. Pour un service existant, conserver `npm ci` comme commande de build et `npm start` comme commande de démarrage. Render doit suivre la branche contenant les changements. Après fusion de la proposition dans `master`, le déploiement dépend des réglages d’auto-déploiement du service.
