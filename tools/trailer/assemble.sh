#!/usr/bin/env bash
# Crossfades shot1 + shot2, overlays the Romanian titles, writes out/trailer-9x16.mp4.
set -euo pipefail
cd "$(dirname "$0")"

command -v ffmpeg >/dev/null || { echo "ffmpeg not found (brew install ffmpeg)"; exit 1; }
python3 -c "import PIL" 2>/dev/null || { echo "Pillow not found (python3 -m pip install pillow)"; exit 1; }
for f in out/shot1.mp4 out/shot2.mp4; do
  [ -f "$f" ] || { echo "missing $f — run: node tools/trailer/generate.mjs"; exit 1; }
done

# Fonts: same families as the game (src/style.css). Fetched once from the google/fonts repo.
mkdir -p fonts
fetch_font() {  # $1 = file name, $2 = google/fonts ofl directory
  [ -f "fonts/$1" ] || curl -fsSL "https://github.com/google/fonts/raw/main/ofl/$2/$1" -o "fonts/$1"
}
fetch_font CormorantSC-Bold.ttf cormorantsc
fetch_font AlegreyaSans-Medium.ttf alegreyasans

# Titles as transparent PNGs (this ffmpeg build has no drawtext).
python3 titles.py >/dev/null

dur()   { ffprobe -v error -show_entries format=duration -of csv=p=0 "$1"; }
has_a() { [ -n "$(ffprobe -v error -select_streams a -show_entries stream=codec_type -of csv=p=0 "$1")" ]; }

XF=0.6
D1=$(dur out/shot1.mp4)
D2=$(dur out/shot2.mp4)
OFFSET=$(awk -v d="$D1" -v x="$XF" 'BEGIN{printf "%.3f", d - x}')
TOTAL=$(awk -v a="$D1" -v b="$D2" -v x="$XF" 'BEGIN{printf "%.3f", a + b - x}')
FADE_ST=$(awk -v t="$TOTAL" 'BEGIN{printf "%.3f", t - 0.5}')

# Title cards: PNG input index, y (px from top), fade-in start, fade-out end ("" = hold to the end).
# Card 1 shows over shot 1 (1.0–5.0 s); card 2 over shot 2 (from 8.0 s to the end).
fade_chain() {  # $1 in-start, $2 out-end or ""
  local s=$1 e=${2:-}
  if [ -z "$e" ]; then
    printf "format=rgba,fade=t=in:st=%s:d=0.6:alpha=1" "$s"
  else
    printf "format=rgba,fade=t=in:st=%s:d=0.6:alpha=1,fade=t=out:st=%s:d=0.6:alpha=1" "$s" "$(awk -v e="$e" 'BEGIN{printf "%.1f", e-0.6}')"
  fi
}
FILTER="[0:v]scale=720:1280:force_original_aspect_ratio=increase,crop=720:1280,fps=30,setsar=1[v0];
[1:v]scale=720:1280:force_original_aspect_ratio=increase,crop=720:1280,fps=30,setsar=1[v1];
[v0][v1]xfade=transition=fade:duration=${XF}:offset=${OFFSET}[vx];
[2:v]$(fade_chain 1.0 5.0)[t1];
[3:v]$(fade_chain 1.3 5.0)[t2];
[4:v]$(fade_chain 8.0)[t3];
[5:v]$(fade_chain 8.4)[t4];
[vx][t1]overlay=x=(W-w)/2:y=188:enable='between(t,1.0,5.0)'[o1];
[o1][t2]overlay=x=(W-w)/2:y=278:enable='between(t,1.3,5.0)'[o2];
[o2][t3]overlay=x=(W-w)/2:y=868:enable='gte(t,8.0)'[o3];
[o3][t4]overlay=x=(W-w)/2:y=978:enable='gte(t,8.4)',fade=t=out:st=${FADE_ST}:d=0.5[vout]"

AUDIO_ARGS=(-an)
if has_a out/shot1.mp4 && has_a out/shot2.mp4; then
  FILTER="${FILTER};[0:a][1:a]acrossfade=d=${XF}[aout]"
  AUDIO_ARGS=(-map "[aout]" -c:a aac -b:a 160k)
else
  echo "note: a shot has no audio track; writing a silent clip"
fi

ffmpeg -hide_banner -loglevel error -y -i out/shot1.mp4 -i out/shot2.mp4 \
  -loop 1 -i out/titles/t1.png -loop 1 -i out/titles/t2.png \
  -loop 1 -i out/titles/t3.png -loop 1 -i out/titles/t4.png \
  -filter_complex "$FILTER" -map "[vout]" "${AUDIO_ARGS[@]}" \
  -c:v libx264 -pix_fmt yuv420p -crf 20 -preset medium -movflags +faststart -shortest \
  out/trailer-9x16.mp4
echo "wrote out/trailer-9x16.mp4 (${TOTAL}s)"
