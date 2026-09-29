"""Schița de layout (nord sus) folosită ca referință pentru harta pictată cu AI.
Rulează: python3 tools/make_layout.py  -> reference/layout-sketch.png
Coordonatele sunt în spațiul lumii jocului (1600 x 1067)."""
from PIL import Image, ImageDraw
import math, random
random.seed(3)
W,H=1600,1067
im=Image.new('RGB',(W,H),(226,224,214));d=ImageDraw.Draw(im)
for i in range(900):
    x=random.random()*170; y=random.random()*H
    d.ellipse([x-14,y-10,x+14,y+10],fill=(150,158,150))          # dealuri / Apuseni la vest
for i in range(300):
    x=170+random.random()*400; y=random.random()*140
    d.ellipse([x-12,y-9,x+12,y+9],fill=(160,166,158))
d.polygon([(170,140),(930,160),(960,900),(170,960)],fill=(232,230,222))  # platoul
for i in range(40):
    x=random.random()*W;y=random.random()*H
    if 300<x<980 and 250<y<760: continue
    w=random.randint(60,140);h=random.randint(25,50)
    d.rectangle([x,y,x+w,y+h],fill=(190,178,156))
def line(pts,w,c): d.line(pts,fill=c,width=w,joint='curve')
line([(170,215),(500,235),(850,250),(1150,265),(1420,300)],16,(95,120,140))      # Ampoi
line([(1500,0),(1440,260),(1470,520),(1400,780),(1450,1067)],50,(85,110,130))    # Mureș
line([(1310,0),(1290,300),(1275,640),(1240,900),(1170,1067)],9,(60,55,50))       # calea ferată
d.rectangle([1205,610,1262,650],fill=(222,190,110));d.rectangle([1205,600,1262,612],fill=(150,60,40))  # gara
for i in range(420):
    x=900+random.random()*300;y=330+random.random()*520
    d.rectangle([x,y,x+10,y+7],fill=(170,70,50))                                  # orașul de jos
road=(120,92,60)
line([(1180,0),(1160,150),(1130,265),(1080,380),(1000,470),(960,520)],12,road)   # nord: Teiuș / Cluj
line([(1000,1067),(1005,850),(1000,660),(975,560),(960,520)],12,road)           # sud: Sebeș / Sibiu
line([(1262,630),(1100,590),(990,545),(960,520)],10,road)                         # gară -> Poarta I
line([(960,520),(885,505),(640,500),(398,490),(330,500)],10,road)                 # axa prin cetate
line([(0,420),(120,440),(230,470),(300,500)],12,road)                             # vest: Zlatna / Apuseni
line([(0,1000),(120,900),(220,760),(270,640),(300,560)],12,road)                  # sud-vest: Vințu / Deva
d.ellipse([90,360,380,720],fill=(242,241,236))                                    # Câmpul lui Horea
for tx,ty in [(250,470),(220,560),(270,620),(170,520)]:
    d.rectangle([tx-10,ty-5,tx+10,ty+5],fill=(110,80,50))                         # tribune
cx,cy,R,sq=645,500,255,.8
pts=[]
for i in range(7):
    a=-math.pi/2+i*2*math.pi/7
    for da,r in [(-.30,.66),(-.215,.78),(0,1),(.215,.78),(.30,.66)]:
        pts.append((cx+math.cos(a+da)*R*r,cy+math.sin(a+da)*R*r*sq))
d.polygon([(cx+(x-cx)*1.14,cy+(y-cy)*1.14) for x,y in pts],fill=(120,125,118))
d.polygon(pts,fill=(150,140,120))
d.polygon([(cx+(x-cx)*.88,cy+(y-cy)*.88) for x,y in pts],fill=(214,208,190))
line([(885,505),(640,500),(398,490)],10,road)
d.rectangle([560,540,690,575],fill=(200,180,140));d.rectangle([545,528,568,578],fill=(190,170,130))  # Sf. Mihail
d.rectangle([700,535,790,590],fill=(205,190,160))   # Palatul Principilor
d.rectangle([630,410,700,440],fill=(230,220,195))   # Casina militară
d.rectangle([470,540,530,580],fill=(215,200,170))   # Batthyaneum
for r in [(480,400,580,425),(730,400,830,425),(760,610,850,635),(470,610,560,635)]:
    d.rectangle(r,fill=(200,190,165))               # cazărmi
d.ellipse([625,470,645,490],fill=(90,90,90))        # monumente
for gx,gy in [(960,520),(885,505),(398,490)]:
    d.rectangle([gx-12,gy-12,gx+12,gy+12],fill=(90,80,70))  # porțile I, III, IV
im.save('reference/layout-sketch.png')
