# Promotion d'OpenLoto

Ce dossier contient de quoi présenter OpenLoto sur un autre site (agendas de loto, sites d'associations, annuaires de logiciels libres).

- **`index.html`** : la page de référence avec l'aperçu de chaque élément et son **code à copier**. Une fois le site à jour, elle est visible sur <https://openloto.org/promotion/>.
- **`banniere-LARGEURxHAUTEUR.png`** : images fixes (728×90, 468×60, 300×250, 160×600, 600×315), avec la boule principale et les quatre précédentes comme sur l'écran public (sauf le petit 468×60, sans boules). Les fichiers `@2x` ont deux fois plus de pixels pour les écrans haute résolution.
- **`encart-728x90.html`, `encart-300x250.html`, `encart-600x315.html`, `encart-160x600.html`** : encarts animés en HTML (un nouveau numéro sort toutes les quelques secondes), à intégrer avec une balise `iframe`. Rien n'est chargé depuis l'extérieur, pas de cookie ; l'animation est coupée si le visiteur a demandé moins de mouvement.

Tout est libre d'utilisation (licence MIT, comme le reste du projet). Le logo d'OpenLoto se trouve dans [`docs/logo`](../docs/logo).
