#!/usr/bin/env bash
# Собирает статический сайт в _site/: веб-интерфейс, ядро, данные и (если установлены) шрифты.
set -euo pipefail
cd "$(dirname "$0")/.."
rm -rf _site
mkdir -p _site/engine _site/data _site/fonts
cp -r web/. _site/
cp engine/*.js _site/engine/
cp data/*.json _site/data/
cp LICENSE NOTICE _site/
for fam in pt-serif pt-sans; do
  dir="node_modules/@fontsource/$fam/files"
  if [ -d "$dir" ]; then
    for subset in cyrillic cyrillic-ext latin; do
      for w in 400 700; do
        f="$dir/$fam-$subset-$w-normal.woff2"
        [ -f "$f" ] && cp "$f" _site/fonts/
      done
    done
    [ -f "node_modules/@fontsource/$fam/LICENSE" ] && cp "node_modules/@fontsource/$fam/LICENSE" "_site/fonts/OFL-$fam.txt"
  fi
done
echo "Сайт собран в _site/"
