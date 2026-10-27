# Fabriquer les exécutables du serveur local

L'exécutable Windows est le `node.exe` officiel de Node.js dans lequel est intégré le script `openloto-serveur.js`, grâce aux *Single Executable Applications* de Node.js. Aucune dépendance n'est ajoutée au serveur.

Avec Node.js 22 installé sur un PC Windows, dans le dossier `serveur-local-windows` :

```bat
echo { "main": "openloto-serveur.js", "output": "sea-prep.blob", "disableExperimentalSEAWarning": true } > sea-config.json
node --experimental-sea-config sea-config.json
node -e "require('fs').copyFileSync(process.execPath, 'OpenLoto-serveur.exe')"
npx postject OpenLoto-serveur.exe NODE_SEA_BLOB sea-prep.blob --sentinel-fuse NODE_SEA_FUSE_fce680ab2cc467b6e072b8b5df1996b2
```

L'exécutable obtenu n'est pas signé : Windows affiche un avertissement au premier lancement.

## Linux (PC, 64 bits)

Même principe, avec Node.js 22 installé sur un PC Linux, dans le dossier `serveur-local-linux` :

```sh
echo '{ "main": "openloto-serveur.js", "output": "sea-prep.blob", "disableExperimentalSEAWarning": true }' > sea-config.json
node --experimental-sea-config sea-config.json
cp "$(command -v node)" OpenLoto-serveur-linux-x64
npx postject OpenLoto-serveur-linux-x64 NODE_SEA_BLOB sea-prep.blob --sentinel-fuse NODE_SEA_FUSE_fce680ab2cc467b6e072b8b5df1996b2
chmod +x OpenLoto-serveur-linux-x64
```

Le programme obtenu fonctionne sur les distributions récentes (glibc 2.28 ou plus : Ubuntu 20.04+, Debian 10+, Fedora…).

Documentation : <https://nodejs.org/api/single-executable-applications.html>
