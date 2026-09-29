#!/usr/bin/env bash
# Crops the painted map into the 9:16 start frame used by shot 2.
set -euo pipefail
cd "$(dirname "$0")/../.."
command -v ffmpeg >/dev/null || { echo "ffmpeg not found (brew install ffmpeg)"; exit 1; }
mkdir -p tools/trailer/ref
# 840x1494 window from x=450 centres the star fortress; the field stays partly visible at the left edge.
ffmpeg -hide_banner -loglevel error -y -i assets/map-1918.jpg \
  -vf "crop=840:1494:450:0,scale=1080:1920:flags=lanczos" -q:v 3 \
  tools/trailer/ref/map-portrait.jpg
echo "wrote tools/trailer/ref/map-portrait.jpg"
