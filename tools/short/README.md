# Short 9:16 (27,5 s)

Montat local, fără credite: capturi din joc, imaginea AI de la zori (`ref/zori.webp`, aceeași ca la trailer), subtitrări, titlu și muzică compusă în cod.

    python3 tools/short/music.py      # out/music.wav (numpy + scipy)
    python3 tools/short/subs.py       # out/subs/*.png (Chrome headless, fonturile jocului)
    python3 tools/short/assemble.py   # out/short-9x16.mp4 + out/short-9x16-fara-subtitrari.mp4 (ffmpeg)

`out/` e ignorat de git. Capturile din `ref/` vin din joc (1080×1920, ramura cu economia strânsă).

Cronometraj (s): 0 zori · 5 regiunea · 11 telegramă · 14 oraș · 17 mulțimea · 20 mulțimea larg · 23 titlu · 27,5 final.
Muzica: re minor care se deschide în re major la titlu, timpane de la 10 s, clopot la 23 s. Voiceover-ul se pune separat peste video.
