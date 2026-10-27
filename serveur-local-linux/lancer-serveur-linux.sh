#!/bin/sh
# OpenLoto - lance le serveur local sur un PC Linux.
# Utilisation, dans un terminal ouvert dans ce dossier :   sh lancer-serveur-linux.sh
cd "$(dirname "$0")" || exit 1
BIN=./OpenLoto-serveur-linux-x64
if [ -f "$BIN" ] && [ "$(uname -m)" = "x86_64" ]; then
  chmod +x "$BIN" 2>/dev/null
  exec "$BIN"
fi
if command -v node >/dev/null 2>&1; then
  exec node openloto-serveur.js
fi
echo ""
echo "  Impossible de lancer le serveur OpenLoto :"
echo "  - placez OpenLoto-serveur-linux-x64 (téléchargé depuis les Releases) dans ce dossier,"
echo "  - ou installez Node.js (par exemple : sudo apt install nodejs), puis relancez."
echo ""
exit 1
