import asyncio
from pathlib import Path
import screens2  # registers extra icons
from icons import icon as I
from mock import nav, topbar
HERE=Path(__file__).parent
def sw(name,hexv,use,dark=False):
    return f'''<div><div style="height:64px;border-radius:16px;background:{hexv};border:1px solid #e3e7ec"></div>
    <p class="sm b8" style="margin-top:6px">{name}</p><p class="xs muted b6">{hexv} · {use}</p></div>'''
colours="".join(sw(*c) for c in [("Ink","#16181d","text, primary buttons"),("Muted","#6b7280","secondary text"),("Line","#e3e7ec","borders, dividers"),
 ("Soft","#f4f6f8","chips, tracks"),("App grey","#eef1f4","page background"),("White","#ffffff","cards, sheets"),
 ("Sky","#4cb2f5","progress, links on dark"),("Orange","#ff6b3d","streak, mentions, pins"),("Green","#16a34a","passed, correct"),
 ("Red","#e5484d","wrong, destructive"),("Blue tint","#d6eafb","goal card"),("Mint tint","#dcefe6","success card"),
 ("Slate tint","#e2e9ef","neutral card"),("Peach tint","#fff1eb","streak card"),("Amber tint","#fff4e5","warnings, pinned")])
types="".join(f'<div class="row" style="gap:20px;padding:8px 0;border-bottom:1px solid var(--line)"><span class="xs muted b7" style="width:150px">{lab}</span><span style="font-size:{px}px;font-weight:{w};line-height:1.2">{txt}</span></div>'
 for lab,px,w,txt in [("Display · 28/800","28","800","Topic passed!"),("H1 · 26/800","26","800","My modules"),("H2 · 22/700","22","700","Quiz question text"),
 ("Title · 20/700","20","700","Inverses; Rules of Matrix Arithmetic"),("Body L · 16/500","16","500","Lesson paragraphs, 1.65 line height"),("Body · 14/600","14","600","Card text and labels"),
 ("Caption · 12/600","12","600","Meta: 6 min read · 11 questions"),("Overline · 11/700 caps","11","700","CONTINUE · MAT1503")])
def opt(letter,text,b,bg,lb,lf,end=""):
    return f'''<div class="row" style="border:2px solid {b};background:{bg};border-radius:18px;padding:11px 14px;gap:12px;width:250px">
    <span style="width:28px;height:28px;border-radius:10px;background:{lb};color:{lf};display:grid;place-items:center;font-weight:800;font-size:13px">{letter}</span><span class="sm b6">{text}</span>{end}</div>'''
html=f'''<!doctype html><html><head><meta charset="utf-8"><link rel="stylesheet" href="base.css">
<style>html,body{{width:1100px;height:auto;overflow:visible}} body{{padding:28px}} h3{{font-size:13px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;color:#6b7280;margin:26px 0 12px}}
.grid5{{display:grid;grid-template-columns:repeat(5,1fr);gap:16px}} .demo{{position:relative;width:390px;height:92px;background:#eef1f4;border-radius:20px;overflow:hidden}}</style></head><body>
<h3 style="margin-top:0">Colour</h3><div class="grid5">{colours}</div>
<div style="display:grid;grid-template-columns:1.25fr 1fr;gap:36px">
<div><h3>Type · Urbanist</h3>{types}</div>
<div><h3>Buttons</h3>
 <div class="btn" style="width:260px">Continue lesson {I("arrow",18)}</div>
 <div class="btn ghost" style="width:260px;margin-top:10px">Review my 2 mistakes</div>
 <div class="row" style="gap:10px;margin-top:10px"><div class="btn" style="width:125px;background:#c4262b;font-size:15px">Danger</div><div style="background:var(--ink);padding:10px;border-radius:999px"><div class="btn white" style="width:105px;height:40px;font-size:14px">On dark</div></div></div>
 <h3>Chips &amp; tags</h3>
 <div class="row" style="gap:8px;flex-wrap:wrap"><span class="chip">Inverses · Medium</span><span class="chip" style="background:var(--ink);color:#fff">BSc Computing</span>
 <span class="chip" style="background:#fff1eb;color:#c2410c">{I("flame",14,2.2,"#ff6b3d")} 6</span><span class="chip" style="background:#eef7fe;color:#0b6db3">{I("spark",14)} +45 XP</span>
 <span class="tag muted">{I("book",12)} Continue · MAT1503</span></div>
 <h3>Progress</h3>
 <div class="bar" style="width:260px"><i style="width:43%"></i></div>
 <div class="row" style="gap:4px;width:260px;margin-top:12px">{"".join(f'<i style="flex:1;height:6px;border-radius:9px;background:{c}"></i>' for c in ["#16a34a","#16a34a","#e5484d","#16181d"]+["#e3e7ec"]*6)}</div>
 <div class="row" style="gap:14px;margin-top:12px">
  <svg width="52" height="52" viewBox="0 0 52 52"><circle cx="26" cy="26" r="21" fill="none" stroke="#eef1f4" stroke-width="7"/><circle cx="26" cy="26" r="21" fill="none" stroke="#16a34a" stroke-width="7" stroke-linecap="round" stroke-dasharray="88 132" transform="rotate(-90 26 26)"/></svg>
  <span style="width:46px;height:46px;border-radius:999px;background:#16a34a;color:#fff;display:grid;place-items:center">{I("check",22,3)}</span>
  <span style="width:46px;height:46px;border-radius:999px;background:#16181d;color:#fff;display:grid;place-items:center;box-shadow:0 0 0 5px #d6eafb">{I("book",20)}</span>
  <span style="width:46px;height:46px;border-radius:999px;background:#eef1f4;color:#9ca3af;display:grid;place-items:center">{I("lock",19)}</span>
  <span style="width:46px;height:46px;border-radius:999px;background:#eef1f4;color:#9ca3af;display:grid;place-items:center">{I("trophy",20)}</span></div>
 <p class="xs muted b6" style="margin-top:6px">Ring · path nodes: passed, current, locked, chapter quiz</p>
</div></div>
<div style="display:grid;grid-template-columns:1fr 1fr;gap:36px">
<div><h3>Answer options</h3>
 <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
 {opt("A","Default","var(--line)","#fff","#f4f6f8","var(--ink)")}
 {opt("B","Selected","var(--ink)","#f8fafc","var(--ink)","#fff")}
 {opt("C","Correct","#16a34a","#ecfdf3","#16a34a","#fff",f'<span style="margin-left:auto;color:#16a34a">{I("check",17,2.6)}</span>')}
 {opt("D","Wrong","#f3a4a6","#fef2f2","#e5484d","#fff",f'<span style="margin-left:auto;color:#e5484d">{I("x",17,2.6)}</span>')}</div>
 <h3>Inputs</h3>
 <div class="row" style="height:48px;border-radius:999px;border:1.5px solid var(--ink);padding:0 16px;width:420px">{I("search",18,2,"#6b7280")}<span class="md muted">MAT, COS, INF…</span></div>
 <div class="row" style="height:46px;border-radius:14px;border:1.5px solid #8a929c;padding:0 14px;margin-top:10px;gap:10px;width:420px">{I("calendar",17,2,"#6b7280")}<span class="md b6">Fri 13 Nov 2026</span></div>
</div>
<div><h3>Navigation</h3>
 <div class="demo">{topbar()}</div>
 <div class="demo" style="margin-top:10px">{nav("home")}</div>
 <h3>Cards</h3>
 <div class="row" style="gap:10px;align-items:stretch">
  <div class="card" style="background:var(--ink);color:#fff;width:150px;padding:14px"><p class="tag" style="color:#9ca3af">Hero</p><p class="sm b7" style="margin-top:6px">Continue card</p></div>
  <div class="card outline" style="width:150px;padding:14px"><p class="tag muted">Outline</p><p class="sm b7" style="margin-top:6px">Module card</p></div>
  <div class="card" style="background:var(--blue);width:150px;padding:14px"><p class="tag muted">Tint</p><p class="sm b7" style="margin-top:6px">Stat card</p></div></div>
</div></div>
<h3>Shape, space &amp; icons</h3>
<div class="row" style="gap:28px;flex-wrap:wrap">
 <p class="sm b6">Radius: cards 26 · options 18 · inputs 14 · pills 999</p><p class="sm b6">Spacing: 4-pt steps · page gutter 16 · card padding 16–20</p>
 <p class="sm b6">Touch targets ≥ 44 px · buttons 52 px</p>
 <div class="row" style="gap:12px">{"".join(I(n,22) for n in ["home","book","calendar","chat","user","flame","check","lock","trophy","cards","quiz","bell","search","send","mic","flag"])}</div></div>
<p class="xs muted b6" style="margin-top:8px">Icons: Lucide (already used in the app), 2 px stroke, 20 px default.</p>
</body></html>'''
async def main():
    from playwright.async_api import async_playwright
    async with async_playwright() as p:
        b=await p.chromium.launch(); pg=await b.new_page(viewport={"width":1100,"height":800},device_scale_factor=2)
        f=HERE/"_ds.html"; f.write_text(html); await pg.goto(f.as_uri()); await pg.evaluate("document.fonts.ready")
        await pg.screenshot(path=str(HERE/"out/design-system.png"),full_page=True); await b.close()
asyncio.run(main())
