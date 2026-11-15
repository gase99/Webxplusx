#!/usr/bin/env python3
"""Render a clean, light-theme vertical product walkthrough for A-Cut 2Dpro.

Requirements: Pillow, NumPy, imageio-ffmpeg, arabic-reshaper, python-bidi.
Run from repository root: .venv/bin/python promo-video/scripts/render-light-promo.py
"""
from __future__ import annotations

import math
import os
import subprocess
from pathlib import Path

import arabic_reshaper
import imageio_ffmpeg
import numpy as np
from bidi.algorithm import get_display
from PIL import Image, ImageDraw, ImageFont, ImageFilter

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "promo-video" / "A-Cut-2Dpro-light-promo.mp4"
W, H, FPS = 720, 1280, 24
TOTAL = 28 * FPS
FONT_REG = "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"
FONT_BOLD = "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"

C = {
    "bg": "#F5F8FC", "paper": "#FFFFFF", "ink": "#15223A", "muted": "#68778E",
    "line": "#E4EAF2", "blue": "#2878F0", "blue2": "#5AA6FF", "blue_pale": "#EAF3FF",
    "teal": "#12A995", "teal_pale": "#E8FAF5", "violet": "#7965E8", "violet_pale": "#F1EEFF",
    "amber": "#E8A52A", "amber_pale": "#FFF5DF", "rose": "#E56B84", "rose_pale": "#FFF0F3",
    "green": "#249B70", "green_pale": "#E9F8F0", "white": "#FFFFFF", "darkblue": "#234B93"
}

RESHAPER = arabic_reshaper.ArabicReshaper(configuration={"delete_harakat": False, "support_ligatures": True})
FONTS: dict[tuple[int, bool], ImageFont.FreeTypeFont] = {}

def font(size: int, bold: bool = False):
    key = (size, bold)
    if key not in FONTS:
        FONTS[key] = ImageFont.truetype(FONT_BOLD if bold else FONT_REG, size)
    return FONTS[key]

def rtl(text: str) -> str:
    # shape connected Arabic/Persian glyphs, then reorder for Pillow's LTR drawing.
    return get_display(RESHAPER.reshape(str(text)))

def text(draw: ImageDraw.ImageDraw, xy, value: str, size=24, color=None, bold=False, anchor="mm", direction=True):
    value = rtl(value) if direction else str(value)
    draw.text(xy, value, font=font(size, bold), fill=color or C["ink"], anchor=anchor)

def rounded(draw, box, radius, fill, outline=None, width=1):
    draw.rounded_rectangle(box, radius=radius, fill=fill, outline=outline, width=width)

def shadow_card(base: Image.Image, box, radius=28, fill=None, shadow=(27, 43, 69, 28), blur=20, offset=(0, 12), outline=None):
    x0,y0,x1,y1 = box
    sh = Image.new("RGBA", base.size, (0,0,0,0))
    sd = ImageDraw.Draw(sh)
    sd.rounded_rectangle((x0+offset[0],y0+offset[1],x1+offset[0],y1+offset[1]), radius=radius, fill=shadow)
    sh = sh.filter(ImageFilter.GaussianBlur(blur))
    base.alpha_composite(sh)
    ImageDraw.Draw(base).rounded_rectangle(box, radius=radius, fill=fill or C["paper"], outline=outline or C["line"], width=2)

def pill(draw, center, label, bg, fg, size=18, width=None, height=42):
    x,y = center
    f=font(size, True)
    shown=rtl(label)
    bb=draw.textbbox((0,0), shown, font=f)
    w=width or max(96, bb[2]-bb[0]+34)
    rounded(draw,(x-w/2,y-height/2,x+w/2,y+height/2),height//2,bg)
    draw.text((x,y),shown,font=f,fill=fg,anchor="mm")

def draw_background():
    im=Image.new("RGBA",(W,H),C["bg"])
    glow=Image.new("RGBA",(W,H),(0,0,0,0)); d=ImageDraw.Draw(glow)
    d.ellipse((-230,-230,420,420),fill=(83,157,255,38))
    d.ellipse((440,820,1020,1430),fill=(95,215,187,30))
    im.alpha_composite(glow.filter(ImageFilter.GaussianBlur(90)))
    return im

def draw_header(im, active=0):
    d=ImageDraw.Draw(im)
    # Tiny brand mark + name
    rounded(d,(44,48,98,102),17,C["blue"])
    text(d,(71,76),"A",27,C["white"],True,direction=False)
    text(d,(624,73),"A-Cut 2Dpro",24,C["ink"],True,direction=False,anchor="rm")
    text(d,(623,101),"بهینه‌ساز برش ورق",13,C["muted"],False,anchor="rm")
    # Four-step compact progress bar
    labels=["ورق و قطعات","نقشه","لیبل","خروجی"]
    y=154
    for i,label in enumerate(labels):
        x=88+i*181
        is_active=i==active
        rounded(d,(x-78,y-25,x+78,y+25),22,C["blue"] if is_active else C["white"],None if is_active else C["line"],2)
        text(d,(x,y),f"{i+1}  {label}",14,C["white"] if is_active else C["muted"],True)

def draw_title(im, eyebrow, title, subtitle):
    d=ImageDraw.Draw(im)
    text(d,(660,218),eyebrow,15,C["blue"],True,anchor="rm")
    text(d,(660,264),title,31,C["ink"],True,anchor="rm")
    text(d,(660,308),subtitle,17,C["muted"],False,anchor="rm")

def draw_footer(im, caption, progress):
    d=ImageDraw.Draw(im)
    # Progress line and a discreet promise.
    rounded(d,(50,1180,670,1188),4,"#E6ECF4")
    rounded(d,(50,1180,50+620*max(0,min(1,progress)),1188),4,C["blue"])
    text(d,(660,1222),caption,18,C["ink"],True,anchor="rm")
    text(d,(660,1252),"ورودی دقیق  •  محاسبهٔ خودکار  •  خروجی آمادهٔ کارگاه",12,C["muted"],False,anchor="rm")

def page_intro(local):
    im=draw_background(); draw_header(im,0); d=ImageDraw.Draw(im)
    # Decorative color bubbles
    d.ellipse((520,220,710,410),fill=C["blue_pale"])
    d.ellipse((44,665,180,801),fill=C["teal_pale"])
    text(d,(650,328),"برش دقیق‌تر، پرت کمتر",36,C["ink"],True,anchor="rm")
    text(d,(650,384),"از ثبت ابعاد تا نقشه و فایل‌های آمادهٔ تولید",19,C["muted"],False,anchor="rm")
    shadow_card(im,(48,470,672,1002),32)
    d=ImageDraw.Draw(im)
    # Stylized board and cut parts
    rounded(d,(92,532,628,846),24,"#F8FAFD",C["line"],2)
    rounded(d,(114,554,342,704),16,C["blue_pale"],"#C9DFFF",2)
    rounded(d,(354,554,602,704),16,C["teal_pale"],"#BCEBDD",2)
    rounded(d,(114,716,275,824),16,C["amber_pale"],"#F3D99F",2)
    rounded(d,(287,716,444,824),16,C["violet_pale"],"#D8D0FF",2)
    rounded(d,(456,716,602,824),16,C["rose_pale"],"#F5CBD4",2)
    text(d,(228,627),"چیدمان هوشمند",20,C["blue"],True)
    text(d,(478,627),"کسر خودکار نوار",20,C["teal"],True)
    text(d,(194,771),"نقشه",17,C["amber"],True)
    text(d,(365,771),"لیبل",17,C["violet"],True)
    text(d,(530,771),"PDF / DXF",16,C["rose"],True,direction=False)
    pill(d,(360,921),"نسخهٔ اندروید و وب",C["blue"],C["white"],18,250,50)
    draw_footer(im,"یک جریان کار ساده برای کارگاه شما",local)
    return im

def page_setup(local):
    im=draw_background(); draw_header(im,0); draw_title(im,"مرحلهٔ ۱","ابعاد را یک‌بار تعریف کنید","تنظیمات هر پروژه ذخیره می‌شود و همیشه در دسترس است")
    shadow_card(im,(42,348,678,1090),30)
    d=ImageDraw.Draw(im)
    text(d,(638,391),"مشخصات متریال",21,C["ink"],True,anchor="rm")
    # three setting chips
    fields=[("ابعاد ورق خام","3660 × 1830","mm",C["blue"],C["blue_pale"]),
            ("ضخامت تیغه","4","mm",C["amber"],C["amber_pale"]),
            ("ضخامت نوار","1","mm",C["teal"],C["teal_pale"])]
    positions=[(82,432,638,536),(82,555,348,660),(372,555,638,660)]
    for (label,value,unit,accent,pale),(x0,y0,x1,y1) in zip(fields,positions):
        rounded(d,(x0,y0,x1,y1),20,pale)
        text(d,(x1-18,y0+28),label,15,C["muted"],True,anchor="rm")
        text(d,(x0+18,y0+73),value,23,accent,True,direction=("×" not in value),anchor="lm")
        text(d,(x1-18,y0+74),unit,13,C["muted"],False,anchor="rm",direction=False)
    text(d,(638,703),"قطعهٔ ثبت‌شده",18,C["ink"],True,anchor="rm")
    # table header and values
    rounded(d,(82,728,638,786),15,"#F6F8FC")
    headers=[("نام",552),("طول",410),("عرض",300),("تعداد",190),("نوار",105)]
    for label,x in headers: text(d,(x,757),label,14,C["muted"],True)
    rounded(d,(82,800,638,872),14,C["white"],C["line"],2)
    vals=[("طبقهٔ کمد",552),("450",410),("150",300),("6",190),("۲ لبه",105)]
    for value,x in vals: text(d,(x,836),value,16,C["ink"],True,direction=value.isdigit())
    # result deduction
    rounded(d,(82,900,638,1019),20,C["teal_pale"],"#C7F0E4",2)
    text(d,(610,932),"محاسبهٔ خودکار ابعاد برش",16,C["teal"],True,anchor="rm")
    text(d,(112,971),"150 − (2 × 1 mm) = 148 mm",19,C["ink"],True,anchor="lm",direction=False)
    text(d,(610,1000),"ابعاد اصلی حفظ می‌شود؛ اندازهٔ خالص برای چیدمان استفاده می‌شود.",12,C["muted"],False,anchor="rm")
    draw_footer(im,"ابعاد نوار به‌صورت خودکار از قطعه کسر می‌شود",local)
    return im

def page_analysis(local):
    im=draw_background(); draw_header(im,1); draw_title(im,"مرحلهٔ ۲","تحلیل و نقشهٔ برش","چیدمان سریع گیلوتینی با محاسبهٔ پرت و بهره‌وری")
    # metrics row
    d=ImageDraw.Draw(im)
    metrics=[("ورق مصرفی","۲ ورق",C["blue"],C["blue_pale"]),("بهره‌وری","۸۷٪",C["teal"],C["teal_pale"]),("قطعات","۱۸ / ۱۸",C["violet"],C["violet_pale"])]
    for i,(label,value,accent,pale) in enumerate(metrics):
        x=44+i*216
        rounded(d,(x,348,x+196,454),20,C["white"],C["line"],2)
        rounded(d,(x+14,364,x+52,402),12,pale)
        d.ellipse((x+26,376,x+40,390),fill=accent)
        text(d,(x+176,376),label,13,C["muted"],True,anchor="rm")
        text(d,(x+176,421),value,25,accent,True,anchor="rm")
    shadow_card(im,(44,480,676,1034),28)
    d=ImageDraw.Draw(im)
    text(d,(642,518),"نقشهٔ ورق خام  •  3660 × 1830 mm",17,C["ink"],True,anchor="rm",direction=False)
    x0,y0,x1,y1=82,562,638,925
    rounded(d,(x0,y0,x1,y1),18,"#F2F5FA",C["line"],2)
    # placements progressively appear
    pieces=[(98,579,295,701,C["blue_pale"],"طبقه"),(301,579,489,701,C["teal_pale"],"درب"),(495,579,622,701,C["amber_pale"],"کف"),
            (98,710,228,904,C["violet_pale"],"بدنه"),(234,710,404,807,C["rose_pale"],"کشو"),(410,710,622,826,C["blue_pale"],"طبقه"),
            (234,813,404,904,C["teal_pale"],"درب"),(410,832,622,904,C["amber_pale"],"پشت")]
    reveal=max(0,min(1,(local-0.14)/0.68)); visible=math.ceil(reveal*len(pieces))
    for i,(ax,ay,bx,by,pale,label) in enumerate(pieces[:visible]):
        rounded(d,(ax,ay,bx,by),10,pale,"#CAD6E6",2)
        text(d,((ax+bx)//2,(ay+by)//2),label,13,C["ink"],True)
    text(d,(640,970),"کسر نوار",14,C["muted"],True,anchor="rm")
    pill(d,(500,970),"۱ mm × لبه‌ها",C["teal_pale"],C["teal"],13,160,36)
    text(d,(640,1008),"نمایش رنگی قطعات + اندازهٔ خالص و عملیات لبه",13,C["muted"],False,anchor="rm")
    draw_footer(im,"محاسبه و نقشه؛ آمادهٔ بررسی در چند ثانیه",local)
    return im

def page_labels(local):
    im=draw_background(); draw_header(im,2); draw_title(im,"مرحلهٔ ۳","لیبل‌های آمادهٔ کارگاه","شمارهٔ قطعه روی لیبل با نقشه و فهرست قطعات هماهنگ است")
    shadow_card(im,(42,348,678,1090),30)
    d=ImageDraw.Draw(im)
    text(d,(638,391),"پیش‌نمایش لیبل‌ها",20,C["ink"],True,anchor="rm")
    items=[("S1-01","طبقهٔ کمد","450 × 148",C["blue"],C["blue_pale"]),
           ("S1-02","درب کابینت","715 × 396",C["teal"],C["teal_pale"]),
           ("S1-03","بدنهٔ کناری","720 × 560",C["violet"],C["violet_pale"]),
           ("S1-04","کشوی بالا","420 × 160",C["amber"],C["amber_pale"]),
           ("S2-01","طبقهٔ میانی","520 × 340",C["rose"],C["rose_pale"]),
           ("S2-02","درب کوچک","360 × 420",C["blue"],C["blue_pale"])]
    reveal=max(0,min(1,(local-0.13)/0.55)); n=math.ceil(reveal*len(items))
    for i,(code,name,dims,accent,pale) in enumerate(items[:n]):
        col=i%2; row=i//2; x=76+col*292; y=438+row*194
        rounded(d,(x,y,x+270,y+164),20,C["white"],"#DCE4EF",2)
        rounded(d,(x+14,y+16,x+132,y+50),11,pale)
        text(d,(x+73,y+33),code,14,accent,True,direction=False)
        text(d,(x+248,y+77),name,16,C["ink"],True,anchor="rm")
        text(d,(x+248,y+116),dims,14,C["muted"],True,anchor="rm",direction=False)
        # small edge operation chips
        pill(d,(x+64,y+143),"نوار",C["teal_pale"],C["teal"],11,78,28)
        pill(d,(x+154,y+143),"فارسی",C["rose_pale"],C["rose"],11,88,28)
    rounded(d,(78,1035,642,1072),16,C["violet_pale"])
    text(d,(360,1054),"شبکهٔ A4 • قابل چاپ یا ذخیره به‌صورت PDF",14,C["violet"],True)
    draw_footer(im,"لیبل دقیق برای شناسایی سریع هر قطعه",local)
    return im

def page_exports(local):
    im=draw_background(); draw_header(im,3); draw_title(im,"مرحلهٔ ۴","خروجی دلخواهتان را بگیرید","برای چاپ، ذخیره، اشتراک‌گذاری یا ارسال به دستگاه CNC")
    cards=[("چاپ","نقشه و فهرست قطعات","مناسب استفاده در کارگاه",C["blue"],C["blue_pale"],"A4"),
           ("PDF","نقشه و لیبل‌ها","برای موبایل و اشتراک‌گذاری",C["violet"],C["violet_pale"],"PDF"),
           ("DXF","فایل برای CNC","مختصات و لایه‌های تفکیک‌شده",C["teal"],C["teal_pale"],"DXF")]
    reveal=max(0,min(1,(local-0.10)/0.6)); n=math.ceil(reveal*3)
    for i,(title,desc,sub,accent,pale,tag) in enumerate(cards[:n]):
        y=365+i*215
        shadow_card(im,(54,y,666,y+184),26)
        d=ImageDraw.Draw(im)
        rounded(d,(82,y+32,180,y+130),25,pale)
        text(d,(131,y+81),tag,20,accent,True,direction=False)
        text(d,(626,y+58),title,24,C["ink"],True,anchor="rm")
        text(d,(626,y+101),desc,16,accent,True,anchor="rm")
        text(d,(626,y+139),sub,13,C["muted"],False,anchor="rm")
    draw_footer(im,"یک پروژه؛ چاپ، PDF و DXF در یک مسیر ساده",local)
    return im

def page_outro(local):
    im=draw_background(); draw_header(im,3); d=ImageDraw.Draw(im)
    # Large clean end card
    shadow_card(im,(48,315,672,930),36)
    d=ImageDraw.Draw(im)
    rounded(d,(276,365,444,533),45,C["blue"])
    text(d,(360,449),"A",80,C["white"],True,direction=False)
    text(d,(360,602),"A-Cut 2Dpro",40,C["ink"],True,direction=False)
    text(d,(360,665),"بهینه‌سازی برش ورق، ساده و دقیق",19,C["muted"],True)
    pill(d,(360,755),"شروع کنید",C["blue"],C["white"],21,230,60)
    text(d,(360,833),"اندروید  •  وب  •  ویندوز",18,C["darkblue"],True)
    text(d,(360,887),"gase99.github.io/Webxplusx",17,C["muted"],False,direction=False)
    draw_footer(im,"A-Cut 2Dpro  —  کارگاه، یک قدم جلوتر",local)
    return im

SCENES=[
    ("intro",0,84,page_intro,"از تعریف ابعاد تا نقشه و خروجی"),
    ("setup",84,228,page_setup,"ابعاد ورق، تیغه و نوار را تعریف کنید"),
    ("analysis",228,372,page_analysis,"محاسبهٔ چیدمان و نمایش نقشه"),
    ("labels",372,468,page_labels,"لیبل‌ها با ابعاد خالص و شناسهٔ قطعه"),
    ("exports",468,588,page_exports,"چاپ، PDF و DXF؛ آمادهٔ تولید"),
    ("outro",588,672,page_outro,"A-Cut 2Dpro — بهینه‌سازی برش ورق")
]
TRANS=10

def make_scene(idx, frame):
    _,start,end,fn,_=SCENES[idx]
    local=max(0,min(1,(frame-start)/(end-start)))
    return fn(local)

def main():
    OUT.parent.mkdir(parents=True,exist_ok=True)
    ffmpeg=imageio_ffmpeg.get_ffmpeg_exe()
    cmd=[ffmpeg,"-y","-f","rawvideo","-vcodec","rawvideo","-pix_fmt","rgb24","-s",f"{W}x{H}","-r",str(FPS),"-i","-","-an","-c:v","libx264","-preset","ultrafast","-crf","20","-pix_fmt","yuv420p","-movflags","+faststart",str(OUT)]
    proc=subprocess.Popen(cmd,stdin=subprocess.PIPE,stdout=subprocess.DEVNULL,stderr=subprocess.PIPE)
    assert proc.stdin
    try:
        for frame in range(TOTAL):
            idx=next(i for i,(_,start,end,_,_) in enumerate(SCENES) if start<=frame<end)
            cur=make_scene(idx,frame)
            # Crossfade around scene boundaries for a smooth, modern cut.
            if idx>0 and frame < SCENES[idx][1]+TRANS:
                prev=make_scene(idx-1,SCENES[idx][1]-1)
                alpha=(frame-SCENES[idx][1]+1)/TRANS
                cur=Image.blend(prev,cur,max(0,min(1,alpha)))
            elif idx<len(SCENES)-1 and frame>=SCENES[idx][2]-TRANS:
                nxt=make_scene(idx+1,SCENES[idx][2])
                alpha=(frame-(SCENES[idx][2]-TRANS))/TRANS
                cur=Image.blend(cur,nxt,max(0,min(1,alpha)))
            proc.stdin.write(np.asarray(cur.convert("RGB"),dtype=np.uint8).tobytes())
            if frame % 120 == 0:
                print(f"Rendering {frame}/{TOTAL} frames ({frame/TOTAL:.0%})",flush=True)
        proc.stdin.close()
    except Exception:
        proc.kill()
        raise
    stderr=proc.stderr.read().decode("utf-8","replace") if proc.stderr else ""
    code=proc.wait()
    if code:
        raise RuntimeError(f"ffmpeg failed ({code}):\n{stderr[-5000:]}")
    print(f"Rendered: {OUT} ({OUT.stat().st_size/1_000_000:.1f} MB)")

if __name__=="__main__":
    main()
