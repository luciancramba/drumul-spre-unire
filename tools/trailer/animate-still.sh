#!/usr/bin/env bash
# Turns a 9:16 still into out/shot1.mp4: slow push-in rising toward the gate, film grain,
# light vignette, silent audio track (so acrossfade in assemble.sh still works).
# Usage: tools/trailer/animate-still.sh [ref/shot1-still.webp]
set -euo pipefail
cd "$(dirname "$0")"
SRC=${1:-ref/shot1-still.webp}
[ -f "$SRC" ] || { echo "missing $SRC"; exit 1; }
mkdir -p out
ffmpeg -hide_banner -loglevel error -y -loop 1 -framerate 30 -i "$SRC" \
  -f lavfi -i anullsrc=r=48000:cl=stereo \
  -filter_complex "[0:v]scale=2160:3840:flags=lanczos,zoompan=z='1+0.18*on/179':x='(iw-iw/zoom)/2':y='(ih-ih/zoom)*(0.7-0.5*on/179)':d=180:s=720x1280:fps=30,noise=alls=7:allf=t,vignette=PI/5,format=yuv420p[v]" \
  -map "[v]" -map 1:a -frames:v 180 -t 6 \
  -c:v libx264 -crf 18 -preset medium -c:a aac -b:a 96k -shortest out/shot1.mp4
echo "wrote out/shot1.mp4 (6s)"
