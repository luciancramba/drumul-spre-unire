#!/usr/bin/env python3
"""Randează subtitrările și titlul ca PNG-uri transparente 1080x1920 (Chrome headless, fonturile jocului).
Rulare: python3 tools/short/subs.py  ->  out/subs/*.png"""
import os, subprocess, tempfile
HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, 'out', 'subs')
os.makedirs(OUT, exist_ok=True)
CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
SUBS = {
    's1': ['1 Decembrie 1918.', 'Alba Iulia.'],
    's2': ['1.228 de delegați.', 'Patru provincii.'],
    's3': ['Tu organizezi drumul.'],
    's4': ['Trimite trenuri.', 'Deblochează traseele.'],
    's5': ['Fiecare alegere contează.'],
    's6': ['Până la ora zece,', 'sala trebuie să fie plină.'],
}
CSS = '''<link href="https://fonts.googleapis.com/css2?family=Alegreya+Sans:wght@400;500;700;800&family=Cormorant+SC:wght@600;700&display=swap" rel="stylesheet">
<style>html,body{margin:0;width:1080px;height:1920px;background:transparent}
.sub{position:absolute;left:0;right:0;bottom:300px;text-align:center;padding:0 70px}
.sub span{display:inline;background:rgba(18,14,9,.74);color:#f4ead3;font:700 64px/1.62 "Cormorant SC",serif;padding:6px 26px;box-decoration-break:clone;-webkit-box-decoration-break:clone;letter-spacing:.01em}
.title{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;color:#f4ead3}
.tri{display:flex;width:210px;height:16px;margin-bottom:54px}.tri i{flex:1}.tri i:nth-child(1){background:#2c4d9c}.tri i:nth-child(2){background:#e2b21f}.tri i:nth-child(3){background:#b3302a}
h1{font:700 150px/.98 "Cormorant SC",serif;margin:0 0 40px}
p{margin:0;font:500 38px "Alegreya Sans",sans-serif;letter-spacing:.2em;text-transform:uppercase;color:#bfa774}
em{margin-top:70px;font:700 58px "Cormorant SC",serif;font-style:normal;color:#e2b21f}</style>'''
def shot(name, body):
    with tempfile.NamedTemporaryFile('w', suffix='.html', delete=False) as f:
        f.write(f'<!doctype html><meta charset="utf-8">{CSS}<body>{body}</body>'); path = f.name
    subprocess.run([CHROME, '--headless', '--disable-gpu', '--hide-scrollbars', '--default-background-color=00000000',
                    '--window-size=1080,1920', '--virtual-time-budget=6000', f'--screenshot={OUT}/{name}.png', f'file://{path}'],
                   check=True, capture_output=True)
    os.unlink(path)
for k, lines in SUBS.items():
    shot(k, '<div class="sub"><span>' + '<br>'.join(lines) + '</span></div>')
shot('title', '<div class="title"><div class="tri"><i></i><i></i><i></i></div><h1>Drumul<br>spre Unire</h1><p>Joc educațional</p><em>1 Decembrie 2026</em></div>')
print('wrote', len(SUBS) + 1, 'png in', OUT)
