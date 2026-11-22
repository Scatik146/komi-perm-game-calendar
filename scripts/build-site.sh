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
for fam in pt-serif pt-sans noto-serif-hebrew noto-naskh-arabic noto-sans-math noto-sans-symbols-2; do
  dir="node_modules/@fontsource/$fam/files"
  if [ -d "$dir" ]; then
    for subset in cyrillic cyrillic-ext latin latin-ext hebrew arabic math symbols; do
      for w in 400 700; do
        f="$dir/$fam-$subset-$w-normal.woff2"
        [ -f "$f" ] && cp "$f" _site/fonts/
      done
    done
    [ -f "node_modules/@fontsource/$fam/LICENSE" ] && cp "node_modules/@fontsource/$fam/LICENSE" "_site/fonts/OFL-$fam.txt"
  fi
  # На GitHub (CI) шрифт и его лицензия обязательны: системными шрифтами сайт не пользуется.
  if [ -n "${CI:-}" ] && [ ! -f "_site/fonts/OFL-$fam.txt" ]; then
    echo "Нет шрифта или лицензии: $fam" >&2
    exit 1
  fi
done
# Каждый файл шрифта, на который ссылается CSS, должен лежать на сайте.
if [ -n "${CI:-}" ]; then
  for f in $(grep -oh 'fonts/[A-Za-z0-9.-]*\.woff2' web/*.css | sort -u); do
    [ -f "_site/$f" ] || { echo "Нет файла шрифта: $f" >&2; exit 1; }
  done
fi
echo "Сайт собран в _site/"
