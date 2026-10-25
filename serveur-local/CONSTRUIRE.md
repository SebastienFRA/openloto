# Fabriquer OpenLoto-serveur.exe

L'exécutable Windows est le `node.exe` officiel de Node.js dans lequel est intégré le script `openloto-serveur.js`, grâce aux *Single Executable Applications* de Node.js. Aucune dépendance n'est ajoutée au serveur.

Avec Node.js 22 installé sur un PC Windows, dans ce dossier :

```bat
echo { "main": "openloto-serveur.js", "output": "sea-prep.blob", "disableExperimentalSEAWarning": true } > sea-config.json
node --experimental-sea-config sea-config.json
node -e "require('fs').copyFileSync(process.execPath, 'OpenLoto-serveur.exe')"
npx postject OpenLoto-serveur.exe NODE_SEA_BLOB sea-prep.blob --sentinel-fuse NODE_SEA_FUSE_fce680ab2cc467b6e072b8b5df1996b2
```

L'exécutable obtenu n'est pas signé : Windows affiche un avertissement au premier lancement.

Documentation : <https://nodejs.org/api/single-executable-applications.html>
