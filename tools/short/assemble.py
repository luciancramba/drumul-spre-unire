#!/usr/bin/env python3
"""Montează short-ul 9:16 (27,5 s) din capturile din joc, imaginea AI de la zori, subtitrări, titlu și muzică.
Rulare (în ordine): python3 tools/short/music.py && python3 tools/short/subs.py && python3 tools/short/assemble.py
Scrie out/short-9x16.mp4 (cu subtitrări) și out/short-9x16-fara-subtitrari.mp4 (pentru editare)."""
import os, subprocess
HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, 'out')
REF = os.path.join(HERE, 'ref')
XF = 0.5
FPS = 30
# (fișier, durată, zoom, x, y); zoom/x/y sunt expresii zoompan, `p` = progresul 0..1
SEG = [
    ('zori.webp',        5.5, '1+0.18*p', '(iw-iw/zoom)/2',              '(ih-ih/zoom)*(0.7-0.5*p)'),
    ('regiune.jpg',      6.5, '1+0.25*p', '(iw-iw/zoom)*(0.3+0.4*p)',    '(ih-ih/zoom)*(0.4+0.2*p)'),
    ('telegrama.jpg',    3.5, '1+0.02*p',  '(iw-iw/zoom)/2',              '(ih-ih/zoom)*0.5'),
    ('oras.jpg',         3.5, '1+0.2*p',  '(iw-iw/zoom)/2',              '(ih-ih/zoom)*(0.5-0.2*p)'),
    ('multime.jpg',      3.5, '1.25-0.25*p', '(iw-iw/zoom)*0.3',         '(ih-ih/zoom)*0.5'),
    ('multime-larg.jpg', 3.5, '1+0.12*p', '(iw-iw/zoom)*0.3',            '(ih-ih/zoom)*0.5'),
    ('fundal.jpg',       4.5, '1+0.04*p', '(iw-iw/zoom)/2',              '(ih-ih/zoom)/2'),  # fundal de titlu
]
SUBS = [('s1', .5, 4.7), ('s2', 5.6, 10.6), ('s3', 11.4, 14.0), ('s4', 14.3, 17.0), ('s5', 17.3, 19.9), ('s6', 20.2, 23.0)]
TITLE = (23.6, 27.5)
TOTAL = sum(s[1] for s in SEG) - XF * (len(SEG) - 1)

def make_background():
    # fundal de titlu: brun foarte închis, cu o rază caldă în centru (fără imagini)
    from PIL import Image
    import numpy as np
    yy, xx = np.mgrid[0:1920, 0:1080]
    r = np.sqrt(((xx - 540) / 700) ** 2 + ((yy - 900) / 1100) ** 2)
    k = np.clip(1 - r, 0, 1) ** 1.6
    img = np.stack([20 + 30 * k, 16 + 22 * k, 11 + 12 * k], -1).astype('uint8')
    Image.fromarray(img).save(os.path.join(REF, 'fundal.jpg'), quality=95)

def build(with_subs, target):
    ins, fc = [], []
    for i, (f, d, z, x, y) in enumerate(SEG):
        ins += ['-loop', '1', '-framerate', str(FPS), '-t', f'{d:.2f}', '-i', os.path.join(REF, f)]
        n = int(d * FPS)
        dark = ''
        fc.append(f"[{i}:v]scale=2160:3840:flags=lanczos,zoompan=z='{z.replace('p', f'(on/{n - 1})')}':"
                  f"x='{x.replace('p', f'(on/{n - 1})')}':y='{y.replace('p', f'(on/{n - 1})')}':d={n}:s=1080x1920:fps={FPS}{dark},setsar=1,format=yuv420p[v{i}]")
    cur, off = 'v0', 0.0
    for i in range(1, len(SEG)):
        off += SEG[i - 1][1] - XF
        fc.append(f"[{cur}][v{i}]xfade=transition=fade:duration={XF}:offset={off:.2f}[x{i}]")
        cur = f'x{i}'
    k = len(SEG)
    overlays = []
    if with_subs:
        overlays += [(f'{n}.png', a, b, 0.4, 0.4) for n, a, b in SUBS]
    overlays.append(('title.png', TITLE[0], TITLE[1], 0.7, 0.0))
    for j, (f, a, b, fi, fo) in enumerate(overlays):
        ins += ['-loop', '1', '-framerate', str(FPS), '-t', f'{b - a:.2f}', '-i', os.path.join(OUT, 'subs', f)]
        chain = f"[{k + j}:v]format=rgba,fade=t=in:st=0:d={fi}:alpha=1"
        if fo:
            chain += f",fade=t=out:st={b - a - fo:.2f}:d={fo}:alpha=1"
        fc.append(chain + f",setpts=PTS+{a}/TB[o{j}]")
        fc.append(f"[{cur}][o{j}]overlay=eof_action=pass:enable='between(t,{a},{b})'[y{j}]")
        cur = f'y{j}'
    fc.append(f"[{cur}]noise=alls=4:allf=t,vignette=PI/6,fade=t=out:st={TOTAL - 0.8:.2f}:d=0.8,format=yuv420p[vout]")
    ins += ['-i', os.path.join(OUT, 'music.wav')]
    a = len(SEG) + len(overlays)
    fc.append(f"[{a}:a]afade=t=out:st={TOTAL - 1.5:.2f}:d=1.5,aresample=48000[aout]")
    cmd = ['ffmpeg', '-hide_banner', '-loglevel', 'error', '-y', *ins, '-filter_complex', ';'.join(fc),
           '-map', '[vout]', '-map', '[aout]', '-t', f'{TOTAL:.2f}', '-r', str(FPS),
           '-c:v', 'libx264', '-crf', '23', '-maxrate', '9M', '-bufsize', '18M', '-preset', 'medium', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-b:a', '192k', '-movflags', '+faststart', target]
    subprocess.run(cmd, check=True)
    print('wrote', target, f'{TOTAL:.1f}s')

if __name__ == '__main__':
    make_background()
    build(True, os.path.join(OUT, 'short-9x16.mp4'))
    build(False, os.path.join(OUT, 'short-9x16-fara-subtitrari.mp4'))
