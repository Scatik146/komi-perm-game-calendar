#!/usr/bin/env bash
# Собирает статический сайт в _site/: веб-интерфейс, ядро, данные и (если установлены) шрифты.
set -euo pipefail
cd "$(dirname "$0")/.."
rm -rf _site
mkdir -p _site/engine _site/data _site/fonts
cp web/* _site/
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
permic="node_modules/@fontsource/noto-sans-old-permic"
if [ -d "$permic/files" ]; then
  f=$(ls "$permic"/files/*old-permic-400-normal.woff2 2>/dev/null | head -1)
  [ -n "$f" ] && cp "$f" _site/fonts/noto-sans-old-permic.woff2
  [ -f "$permic/LICENSE" ] && cp "$permic/LICENSE" _site/fonts/OFL-noto-sans-old-permic.txt
fi
echo "Сайт собран в _site/"
