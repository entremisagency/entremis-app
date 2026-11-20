#!/bin/sh
# Change le numéro de version des fichiers dans index.html et demande.html (ex. ?v=20261121-1432),
# pour que les navigateurs prennent la nouvelle version tout de suite après une mise en ligne.
# À lancer depuis le dossier du dépôt :  sh outils/version.sh
V=$(date +%Y%m%d-%H%M)
for f in index.html demande.html; do
  sed -i.bak -E "s/\?v=[0-9a-z-]+/?v=$V/g" "$f" && rm -f "$f.bak"
done
echo "Version des fichiers : $V"
