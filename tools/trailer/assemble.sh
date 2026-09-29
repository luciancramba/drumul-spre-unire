#!/usr/bin/env bash
# Crossfades shot1 + shot2, burns the Romanian titles, writes out/trailer-9x16.mp4.
set -euo pipefail
cd "$(dirname "$0")"

command -v ffmpeg >/dev/null || { echo "ffmpeg not found (brew install ffmpeg)"; exit 1; }
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
TITLE_FONT=fonts/CormorantSC-Bold.ttf
BODY_FONT=fonts/AlegreyaSans-Medium.ttf

dur()   { ffprobe -v error -show_entries format=duration -of csv=p=0 "$1"; }
has_a() { [ -n "$(ffprobe -v error -select_streams a -show_entries stream=codec_type -of csv=p=0 "$1")" ]; }

XF=0.6
D1=$(dur out/shot1.mp4)
D2=$(dur out/shot2.mp4)
OFFSET=$(awk -v d="$D1" -v x="$XF" 'BEGIN{printf "%.3f", d - x}')
TOTAL=$(awk -v a="$D1" -v b="$D2" -v x="$XF" 'BEGIN{printf "%.3f", a + b - x}')
FADE_ST=$(awk -v t="$TOTAL" 'BEGIN{printf "%.3f", t - 0.5}')

# alpha expression: fade in over 0.6 s at $1, hold, fade out over 0.6 s ending at $2 (or hold to the end if $2 is empty).
alpha() {
  local s=$1 e=${2:-}
  if [ -z "$e" ]; then
    printf "if(lt(t\\,%s)\\,0\\,if(lt(t\\,%s+0.6)\\,(t-%s)/0.6\\,1))" "$s" "$s" "$s"
  else
    printf "if(lt(t\\,%s)\\,0\\,if(lt(t\\,%s+0.6)\\,(t-%s)/0.6\\,if(lt(t\\,%s-0.6)\\,1\\,if(lt(t\\,%s)\\,(%s-t)/0.6\\,0))))" "$s" "$s" "$s" "$e" "$e" "$e"
  fi
}
title() {  # $1 font, $2 size, $3 y, $4 colour, $5 alpha expr, $6 text
  printf "drawtext=fontfile=%s:fontsize=%s:x=(w-text_w)/2:y=%s:fontcolor=%s:alpha='%s':shadowcolor=black@0.7:shadowx=2:shadowy=2:text='%s'" \
    "$1" "$2" "$3" "$4" "$5" "$6"
}
BRASS=0xecd08a
PARCH=0xecdfc2

T1=$(title "$TITLE_FONT" 64 200 "$BRASS" "$(alpha 1.0 5.0)" "1 Decembrie 1918")
T2=$(title "$BODY_FONT"  34 290 "$PARCH" "$(alpha 1.3 5.0)" "1.228 de delegați. O singură zi.")
T3=$(title "$TITLE_FONT" 78 880 "$BRASS" "$(alpha 8.0)"     "Drumul spre Unire")
T4=$(title "$BODY_FONT"  34 990 "$PARCH" "$(alpha 8.4)"     "Joacă istoria. Din 1 Decembrie 2026.")

FILTER="[0:v]scale=720:1280:force_original_aspect_ratio=increase,crop=720:1280,fps=30,setsar=1[v0];
[1:v]scale=720:1280:force_original_aspect_ratio=increase,crop=720:1280,fps=30,setsar=1[v1];
[v0][v1]xfade=transition=fade:duration=${XF}:offset=${OFFSET}[vx];
[vx]${T1},${T2},${T3},${T4},fade=t=out:st=${FADE_ST}:d=0.5[vout]"

AUDIO_ARGS=(-an)
if has_a out/shot1.mp4 && has_a out/shot2.mp4; then
  FILTER="${FILTER};[0:a][1:a]acrossfade=d=${XF}[aout]"
  AUDIO_ARGS=(-map "[aout]" -c:a aac -b:a 160k)
else
  echo "note: a shot has no audio track; writing a silent clip"
fi

ffmpeg -hide_banner -loglevel error -y -i out/shot1.mp4 -i out/shot2.mp4 \
  -filter_complex "$FILTER" -map "[vout]" "${AUDIO_ARGS[@]}" \
  -c:v libx264 -pix_fmt yuv420p -crf 20 -preset medium -movflags +faststart \
  out/trailer-9x16.mp4
echo "wrote out/trailer-9x16.mp4 (${TOTAL}s)"
