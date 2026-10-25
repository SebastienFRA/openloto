# OpenLoto

**Gestionnaire de loto pour associations : tirage en direct, contrôle des cartons et écran public, dans un seul fichier HTML.**

OpenLoto s'ouvre dans un navigateur, sans installation ni connexion internet. L'organisateur saisit les boules, contrôle les cartons des gagnants et fait défiler les lots. Le tirage s'affiche sur un écran public (vidéoprojecteur, télé) et, si vous le souhaitez, sur les téléphones des joueurs grâce à un petit serveur sur Raspberry Pi.

![Le direct : saisie des boules, grille, déroulé du loto](docs/captures/direct.png)

---

## Fonctionnalités

### Le direct
- Saisie des boules au clavier ou tirage aléatoire, avec annulation de la dernière boule.
- Grille des numéros sortis, 5 dernières boules, ordre de sortie.
- Annonce vocale des boules (voix du système), avec une phrase personnalisable (`le {n}`, `{n}… {chiffres}`…) et une répétition automatique.
- Raccourcis clavier configurables (par défaut : F2 saisie, F3 contrôle, F4 valider, F6 répéter, F8 tirage aléatoire, F9 étape suivante, Ctrl+Z annuler).
- Écran maintenu allumé pendant le loto, confirmation avant de fermer la page.
- Thème clair ou sombre.

![Le direct en thème sombre](docs/captures/theme-sombre.png)

### Le déroulé du loto
- Étapes successives : lots, entractes (avec durée) et annonces.
- Conditions de victoire :
  - une ou plusieurs lignes, carton plein ;
  - lignes au choix (ligne du milieu, lignes du haut et du bas, 2 premières, 2 dernières…) ;
  - tour du carton (lignes du haut et du bas, plus les unités et les 80/90 de la ligne du milieu) ;
  - aucun numéro sorti (loto inversé).
- Nombre de gagnants par lot, ou illimité (tous les gagnants d'une même boule).
- Couleurs de cartons par lot, nouvelle partie (boules remises à zéro), note affichée pendant le jeu.
- Avertissement en rouge quand on revient en arrière ou qu'on saute des étapes.

![Configuration du déroulé : lots, conditions de victoire, entracte](docs/captures/configuration.png)

### Le contrôle des cartons
- Fenêtre de contrôle (F3) qui met le tirage en pause.
- Vérification par le code du carton : gagnant, non gagnant ou combinaison complète **avant** la dernière boule (annonce en retard).
- Départage : mise en attente de plusieurs gagnants, choix du gagnant retenu, lot supplémentaire.
- Pendant le contrôle, l'écran public affiche la grille et le carton vérifié.
- Base de cartons importable et modifiable (testé avec plus de 5 000 cartons), avec contrôle des plaques (voir plus bas).

![Contrôle d'un carton gagnant](docs/captures/controle-carton.png)

### La saisie des cartons
- Un outil à part, `outils/saisie-cartons.html`, pour enregistrer vos cartons un par un, au clavier ou à la voix (Chrome et Edge).
- Les cases avancent toutes seules ; un aperçu du carton réel (une colonne par dizaine) permet de comparer d'un coup d'œil avec le carton papier.
- Contrôles à la saisie : numéros de 1 à 90, pas de doublon, un seul numéro par dizaine sur une ligne, numéro de carton unique, carton identique à un autre signalé.
- Mode plaque : numéros de carton consécutifs remplis automatiquement et vérification que chaque numéro de 1 à 90 apparaît une seule fois sur la plaque.
- **Vérification des plaques** : retrouve les plaques de 6 cartons consécutifs et signale les erreurs de saisie probables, avec la correction suggérée (voir plus bas).
- Recherche, modification, suppression (avec annulation), import d'un fichier déjà exporté pour reprendre ou fusionner une saisie.
- Export en `.txt`, à importer dans OpenLoto : **Configuration → Cartons → Importer**.

Pratique pour répartir la saisie entre plusieurs bénévoles : chacun saisit une partie des cartons sur son ordinateur, puis les fichiers exportés sont importés ensemble dans OpenLoto.

![Saisie des cartons avec aperçu du carton réel](docs/captures/saisie-cartons.png)

### L'écran public
- Fenêtre séparée à placer sur un second écran, ou aperçu dans la page de l'organisateur.
- Titre et logo de l'association (logo allégé automatiquement), lot en cours et condition.
- Animation de chaque nouvelle boule (désactivable), message d'accueil et de fin, mode démo.

![Écran public pendant le tirage](docs/captures/ecran-public.png)

![Écran public pendant le contrôle d'un carton](docs/captures/ecran-public-controle.png)

### Sur les téléphones (option Raspberry Pi)
- Les joueurs suivent le tirage sur leur téléphone via un lien, sans application.
- Grille complète ou dernières boules, plein écran, écran maintenu allumé.
- Nombre de téléphones connectés affiché chez l'organisateur, avec reconnexion automatique.
- Données légères : environ 0,6 Mo par heure et par téléphone.

![Suivi du tirage sur les téléphones des joueurs](docs/captures/telephones.jpg)

### Après le loto
- Journal complet de la soirée (boules, gagnants, départages, pic de téléphones connectés).
- Bilan imprimable.
- Export et import de la configuration, sauvegarde complète du direct, export du déroulé en PDF ou CSV.

### Simulation
- Mode simulation pour répéter un loto : nombre de cartons en jeu, vitesse, erreurs de joueurs, durée réelle estimée.

---

## Vérification des plaques et fournisseurs de cartons

Chez certains fournisseurs, les cartons sont imprimés par **plaques de 6 cartons aux numéros consécutifs** (par exemple 106282 à 106287) qui, ensemble, contiennent **chaque numéro de 1 à 90 exactement une fois**. Même vendus à l'unité, ces cartons gardent cette propriété.

OpenLoto s'en sert pour repérer les erreurs de saisie, sans rien deviner :
- les plaques complètes et correctes sont validées ;
- dans une plaque où un numéro apparaît deux fois et un autre manque, la faute de frappe est presque certaine : le contrôle indique sur quel(s) carton(s) elle se trouve et par quel numéro la corriger ;
- pour les plaques dont tous les cartons n'ont pas été saisis, un numéro présent sur deux cartons de la même plaque est aussi signalé.

Le contrôle se lance depuis l'outil de saisie (**Vérifier les plaques**) ou dans OpenLoto (**Configuration → Cartons → Contrôler les plaques**). Sur 2 300 cartons réels, il a retrouvé 205 plaques et signalé 11 erreurs de saisie en moins d'une seconde.

**Fournisseurs dont les cartons suivent cette logique :**

| Fournisseur | Plaques de 6 cartons consécutifs couvrant 1 à 90 |
|---|---|
| Lotoquine | ✓ constaté |

Vous utilisez des cartons d'un autre fournisseur ? Dites-nous, via l'onglet **Issues** du dépôt, si leurs plaques suivent la même règle (ou une autre) : nous compléterons ce tableau.

---

## Démarrage rapide (sans serveur)

1. Téléchargez `Loto.html`.
2. Ouvrez-le avec un navigateur récent (Chrome, Edge ou Firefox).
3. Dans l'onglet **Configuration**, renseignez le titre, le logo, le déroulé et vos cartons.
4. Cliquez sur **Charger dans le direct**, ouvrez l'écran public et lancez le loto.

Tout est enregistré dans le navigateur de l'ordinateur. Pensez à **exporter la configuration** pour en garder une copie ou la transférer sur un autre poste.

> Pour placer automatiquement l'écran public sur un second écran, utilisez Chrome ou Edge.

---

## Diffusion sur les téléphones (Raspberry Pi)

Le dossier `raspberry/` contient un petit serveur **Node.js sans dépendance**. Il sert la page aux téléphones et leur relaie le tirage en temps réel. L'ordinateur de l'organisateur lui envoie l'état du loto, protégé par une clé de diffusion.

### Installation

Sur le Raspberry Pi (Raspberry Pi OS) :

```bash
# Node.js
sudo apt install -y nodejs

# Utilisateur dédié et dossier du service
sudo useradd --system --no-create-home --shell /usr/sbin/nologin loto
sudo mkdir -p /opt/loto

# Fichiers d'OpenLoto
sudo cp Loto.html raspberry/loto-server.js /opt/loto/
sudo cp raspberry/loto.env.example /opt/loto/loto.env
sudo cp raspberry/loto.service /etc/systemd/system/loto.service

# Clé de diffusion : générez-en une et collez-la dans loto.env
openssl rand -hex 24
sudo nano /opt/loto/loto.env

# Droits et démarrage
sudo chown -R root:loto /opt/loto
sudo chmod 640 /opt/loto/loto.env
sudo systemctl daemon-reload
sudo systemctl enable --now loto
```

Le service écoute sur le port **8123**. Après chaque modification de la clé : `sudo systemctl restart loto`.

### Changer le port d'écoute

Le port se règle dans le fichier du service, à la ligne `Environment=PORT=8123` :

```bash
sudo nano /etc/systemd/system/loto.service
# remplacez 8123 par le port voulu, par exemple : Environment=PORT=8080

sudo systemctl daemon-reload
sudo systemctl restart loto
```

Pensez ensuite à reporter le nouveau port dans l'adresse du serveur côté organisateur (`http://192.168.1.50:8080`), dans le lien donné aux joueurs et, le cas échéant, dans la redirection de port de votre box.

### Côté organisateur

Dans OpenLoto : **Réglages → Config réseau (téléphones)**.
- **Adresse du serveur** : par exemple `http://192.168.1.50:8123`.
- **Clé de diffusion** : la même que dans `loto.env`.

Cliquez sur **Tester la connexion**. Le lien affiché est celui à communiquer aux joueurs, par exemple avec un QR code.

> Pour que les joueurs se connectent depuis la 4G/5G plutôt que le wifi de la salle, le port 8123 doit être redirigé vers le Pi sur votre box. Ne publiez jamais votre clé de diffusion.

---

## Structure du dépôt

```
OpenLoto/
├── Loto.html                  Le programme (organisateur + écran public)
├── outils/
│   └── saisie-cartons.html    Saisie des cartons (export .txt pour OpenLoto)
├── raspberry/
│   ├── loto-server.js         Serveur de diffusion (Node.js, sans dépendance)
│   ├── loto.service           Service systemd
│   └── loto.env.example       Modèle du fichier de clé
├── docs/captures/             Captures d'écran du README
├── LICENSE
└── README.md
```

---

> Les captures d'écran montrent un loto fictif (lots, cartons et association inventés).

## Note sur le développement

OpenLoto a été conçu et développé avec l'aide d'une intelligence artificielle (Claude, d'Anthropic). Chacun est libre de le reprendre, de l'adapter et de l'améliorer : c'est tout l'esprit de la licence MIT.

## Licence

[MIT](LICENSE) : utilisation, modification et redistribution libres, y compris dans un cadre commercial, à condition de conserver la mention de licence.
