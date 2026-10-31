# Promotion d'OpenLoto

Ce dossier contient de quoi présenter OpenLoto sur un autre site (agendas de loto, sites d'associations, annuaires de logiciels libres).

- **`index.html`** : la page de référence avec l'aperçu de chaque élément et son **code à copier**. Une fois le site à jour, elle est visible sur <https://openloto.org/promotion/>.
- **`visuel-large`** (728×90), **`visuel-compact`** (468×60), **`visuel-rectangle`** (300×250), **`visuel-colonne`** (160×600), **`visuel-carre`** (600×315), en `.png` : images fixes, avec la boule principale et les quatre précédentes comme sur l'écran public (sauf le petit 468×60, sans boules). Les noms ne contiennent volontairement pas les dimensions (certains bloqueurs de publicité filtrent les fichiers nommés avec des tailles de bannières publicitaires). Les fichiers `@2x` ont deux fois plus de pixels pour les écrans haute résolution.
- **`encart-large.html`, `encart-rectangle.html`, `encart-carre.html`, `encart-colonne.html`** : encarts animés en HTML (un nouveau numéro sort toutes les quelques secondes), à intégrer avec une balise `iframe`. Rien n'est chargé depuis l'extérieur, pas de cookie ; l'animation est coupée si le visiteur a demandé moins de mouvement.

Tout est libre d'utilisation (licence MIT, comme le reste du projet). Le logo d'OpenLoto se trouve dans [`docs/logo`](../docs/logo).
