"""Builds the "how it should be" mockups as HTML, then renders them to PNG."""
import asyncio
from pathlib import Path
from icons import icon as I

OUT = Path("/home/claude/ux-audit/images/proposed")
HERE = Path(__file__).parent


def page(body: str, cls: str = "", extra_css: str = "") -> str:
    return f"""<!doctype html><html><head><meta charset="utf-8">
<link rel="stylesheet" href="base.css"><style>{extra_css}</style></head>
<body class="{cls}">{body}</body></html>"""


def pin(n, top, left):
    return f'<span class="pin" style="top:{top}px;left:{left}px">{n}</span>'


def nav(active="home"):
    items = [("home", "Home", "home"), ("study", "Study", "book"), ("plan", "Plan", "calendar"),
             ("chats", "Chats", "chat"), ("me", "Me", "user")]
    return '<nav class="nav">' + "".join(
        f'<a class="{"on" if k == active else ""}">{I(ic, 20)}<span>{lab}</span></a>' for k, lab, ic in items
    ) + "</nav>"


def topbar(streak=True):
    s = f'<span class="chip" style="background:#fff1eb;color:#c2410c">{I("flame",15,2.2,"#ff6b3d")} 6</span>' if streak else ""
    return f"""<div class="top"><span class="logo">{I("brain",20)}</span>
      <span class="b7 md">Tyro Study</span><span style="flex:1"></span>{s}<span class="avatar">T</span></div>"""


# 1. Dashboard ---------------------------------------------------------------
week = "".join(
    f'<div style="text-align:center"><div style="width:30px;height:30px;border-radius:999px;display:grid;place-items:center;'
    f'background:{bg};color:{fg};margin:0 auto">{inner}</div><div class="xs muted b6" style="margin-top:4px">{d}</div></div>'
    for d, bg, fg, inner in [
        ("M", "#ff6b3d", "#fff", I("check", 14, 3)), ("T", "#ff6b3d", "#fff", I("check", 14, 3)),
        ("W", "#ff6b3d", "#fff", I("check", 14, 3)), ("T", "#ff6b3d", "#fff", I("check", 14, 3)),
        ("F", "#ff6b3d", "#fff", I("check", 14, 3)), ("S", "#fff", "#ff6b3d", I("flame", 15, 2.2)),
        ("S", "#f4f6f8", "#9ca3af", ""),
    ]
)
dashboard = page(f"""
{topbar()}
<div class="page" style="margin-top:18px">
  <p class="sm muted b6">Good morning, Taelo</p>
  <h1 class="b8" style="font-size:23px;line-height:1.15;margin-top:2px">One lesson to hit today&rsquo;s goal</h1>

  <div class="card" style="background:var(--ink);color:#fff;margin-top:16px;padding:20px">
    <div class="tag" style="color:#9ca3af">{I("book",13)} Continue · MAT1503</div>
    <p class="b7" style="font-size:20px;line-height:1.25;margin-top:8px">Inverses; Rules of Matrix Arithmetic</p>
    <p class="sm" style="color:#c7cbd1;margin-top:6px">Topic 4 of 7 · 6 min read · 11-question quiz</p>
    <div class="bar" style="background:#2b2f37;margin-top:14px"><i style="width:43%;background:#4cb2f5"></i></div>
    <div class="btn white" style="margin-top:16px">Continue lesson {I("arrow",18)}</div>
  </div>

  <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-top:12px">
    <div class="card" style="background:var(--blue);padding:16px;min-width:0;overflow:hidden">
      <p class="sm b7">Today&rsquo;s goal</p>
      <div class="row" style="margin-top:10px;gap:12px">
        <svg width="52" height="52" viewBox="0 0 52 52"><circle cx="26" cy="26" r="21" fill="none" stroke="#fff" stroke-width="7"/>
          <circle cx="26" cy="26" r="21" fill="none" stroke="#16181d" stroke-width="7" stroke-linecap="round" stroke-dasharray="88 132" transform="rotate(-90 26 26)"/></svg>
        <div><p class="b8" style="font-size:22px">2/3</p><p class="xs muted b6">steps done</p></div>
      </div>
      <p class="xs b6" style="margin-top:10px">✓ Read · ✓ Flashcards · Quiz</p>
    </div>
    <div class="card" style="background:#fff1eb;padding:16px;min-width:0;overflow:hidden">
      <p class="sm b7 row" style="gap:6px">{I("flame",16,2.2,"#ff6b3d")} 6-day streak</p>
      <p class="xs muted b6" style="margin-top:4px">Pass 1 quiz today to keep it</p>
      <div style="display:grid;grid-template-columns:repeat(7,1fr);margin-top:12px;zoom:.62;width:240px">{week}</div>
    </div>
  </div>

  <div class="card row" style="margin-top:12px;padding:14px 16px;gap:12px">
    <span style="width:38px;height:38px;border-radius:12px;background:#fff1eb;display:grid;place-items:center;color:#ff6b3d">{I("calendar",18)}</span>
    <div style="flex:1;min-width:0"><p class="sm b7">Assignment 2 due in 5 days</p><p class="xs muted b6">MAT1503 · you&rsquo;re 3 topics away</p></div>
    <span class="chip">Plan</span>
  </div>
</div>
{nav("home")}
{pin(1,112,364)}{pin(2,150,364)}{pin(3,396,170)}{pin(4,396,364)}{pin(5,600,364)}{pin(6,706,364)}
""", "grey")

# 2. Onboarding --------------------------------------------------------------
def mod_row(code, name, on, meta):
    box = (f'<span style="width:26px;height:26px;border-radius:999px;background:var(--ink);color:#fff;display:grid;place-items:center">{I("check",15,3)}</span>'
           if on else '<span style="width:26px;height:26px;border-radius:999px;border:2px solid #cfd5dc"></span>')
    return f"""<div class="row" style="border:2px solid {'var(--ink)' if on else 'var(--line)'};border-radius:20px;padding:13px 14px;margin-top:10px;background:{'#f8fafc' if on else '#fff'}">
      <div style="flex:1;min-width:0"><p class="b7 md">{code}</p><p class="sm muted b5" style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis">{name}</p><p class="xs muted b6" style="margin-top:3px">{meta}</p></div>{box}</div>"""

onboarding = page(f"""
<div class="page" style="padding-top:22px">
  <div class="row between"><span class="logo" style="width:34px;height:34px">{I("brain",17)}</span>
    <div class="row" style="gap:6px"><i style="width:26px;height:6px;border-radius:9px;background:var(--ink)"></i><i style="width:26px;height:6px;border-radius:9px;background:var(--ink)"></i><i style="width:26px;height:6px;border-radius:9px;background:var(--line)"></i></div>
    <span class="sm muted b6">Skip</span></div>
  <p class="xs muted b7" style="margin-top:22px;letter-spacing:.06em">STEP 2 OF 3</p>
  <h1 class="b8" style="font-size:26px;line-height:1.15;margin-top:4px">Which modules are you doing this semester?</h1>
  <p class="sm muted b5" style="margin-top:6px">We&rsquo;ll set up your study plan around them.</p>
  <div class="row" style="height:48px;border-radius:999px;border:1.5px solid var(--ink);padding:0 16px;margin-top:16px">{I("search",18,2,"#6b7280")}<span class="md muted">MAT, COS, INF…</span></div>
  <div class="row" style="gap:8px;margin-top:12px;overflow:hidden">
    <span class="chip" style="background:var(--ink);color:#fff">BSc Computing</span><span class="chip">BSc Informatics</span><span class="chip">Education</span></div>
  {mod_row("MAT1503","Linear Algebra I",True,"21 topics · 2,140 students")}
  {mod_row("COS2601","Theoretical Computer Science II",True,"18 topics · 860 students")}
  {mod_row("COS1501","Theoretical Computer Science I",False,"18 topics · 1,320 students")}
</div>
<div style="position:absolute;left:0;right:0;bottom:0;padding:14px 16px 20px;background:linear-gradient(to top,#fff 75%,rgba(255,255,255,0))">
  <div class="btn">Continue with 2 modules {I("arrow",18)}</div></div>
{pin(1,24,192)}{pin(2,316,358)}{pin(3,724,345)}
""")

# 3. Learning path -----------------------------------------------------------
def node(state, title, sub, x):
    styles = {
        "done": ("#16a34a", "#fff", I("check", 26, 3)),
        "current": ("#16181d", "#fff", I("book", 24, 2.2)),
        "locked": ("#eef1f4", "#9ca3af", I("lock", 22, 2.2)),
        "quiz": ("#eef1f4", "#9ca3af", I("trophy", 24, 2.2)),
    }
    bg, fg, ic = styles[state]
    ring = 'box-shadow:0 0 0 6px #d6eafb;' if state == "current" else ""
    label = f"""<div style="margin-left:14px"><p class="sm b7" style="color:{'#9ca3af' if state in ('locked','quiz') else 'var(--ink)'}">{title}</p><p class="xs muted b6">{sub}</p></div>"""
    return f"""<div class="row" style="margin-left:{x}px;margin-top:14px;gap:0">
      <span style="width:58px;height:58px;border-radius:999px;background:{bg};color:{fg};display:grid;place-items:center;flex-shrink:0;{ring}">{ic}</span>{label}</div>"""

path = page(f"""
{topbar()}
<div class="page" style="margin-top:14px">
  <div class="row between">
    <div><p class="xs muted b7" style="letter-spacing:.06em">MAT1503 · LINEAR ALGEBRA I</p><p class="b8" style="font-size:20px;margin-top:2px">Chapter 1 · Systems &amp; Matrices</p></div>
  </div>
  <div class="row" style="margin-top:10px;gap:10px"><div class="bar" style="flex:1"><i style="width:43%;background:#16a34a"></i></div><span class="xs b7">3 of 7</span></div>
  <div style="position:relative;margin-top:4px">
    {node("done","Introduction to Systems","Passed · 90%",0)}
    {node("done","Gaussian Elimination","Passed · 80%",56)}
    {node("done","Matrices & Arithmetic","Passed · 73%",112)}
    <div style="position:relative">{node("current","Inverses; Rules of Arithmetic","Up next · 6 min read",56)}
      <span class="chip" style="position:absolute;left:44px;top:-2px;background:var(--orange);color:#fff;font-size:11px;padding:3px 9px">START</span></div>
    {node("locked","Elementary Matrices","Pass &ldquo;Inverses&rdquo; to unlock",0)}
    {node("locked","Further Results on Systems","",56)}
    {node("quiz","Chapter 1 quiz","Opens when all 7 topics are passed",112)}
  </div>
</div>
{nav("study")}
{pin(1,150,6)}{pin(2,356,4)}{pin(3,440,4)}{pin(4,604,110)}
""")

# 4. Lesson ------------------------------------------------------------------
def step(n, label, state):
    if state == "done":
        c = f'<span style="width:22px;height:22px;border-radius:999px;background:#16a34a;color:#fff;display:grid;place-items:center">{I("check",13,3)}</span>'
    elif state == "on":
        c = f'<span style="width:22px;height:22px;border-radius:999px;background:var(--ink);color:#fff;display:grid;place-items:center;font-size:12px;font-weight:800">{n}</span>'
    else:
        c = f'<span style="width:22px;height:22px;border-radius:999px;border:2px solid #cfd5dc;color:#9ca3af;display:grid;place-items:center;font-size:11px;font-weight:800">{n}</span>'
    return f'<div class="row" style="gap:6px">{c}<span class="sm b7" style="color:{"var(--ink)" if state != "todo" else "#9ca3af"}">{label}</span></div>'

lesson = page(f"""
<div style="height:3px;background:var(--soft)"><i style="display:block;height:100%;width:38%;background:var(--sky)"></i></div>
<div class="page">
  <div class="row between" style="height:54px">
    <span class="row sm b7" style="gap:4px">{I("back",20)} Chapter 1</span>
    <span class="row" style="gap:8px"><span class="chip">{I("download",15)} PDF</span><span class="chip">{I("pencil",15)} Notes</span></span>
  </div>
  <div class="row between" style="background:var(--soft);border-radius:999px;padding:9px 14px">
    {step(1,"Read","on")}<span style="flex:1;height:2px;background:#d4d9df;margin:0 4px"></span>
    {step(2,"Cards","todo")}<span style="flex:1;height:2px;background:#d4d9df;margin:0 4px"></span>
    {step(3,"Quiz","todo")}
  </div>
  <h1 class="b8" style="font-size:25px;line-height:1.2;margin-top:18px">Inverses; Rules of Matrix Arithmetic</h1>
  <p class="row sm muted b6" style="gap:6px;margin-top:6px">{I("clock",15)} 6 min read · 11 quiz questions</p>
  <div style="border-left:4px solid var(--sky);background:#eef7fe;border-radius:16px;padding:12px 14px;margin-top:14px">
    <p class="sm b7">By the end you&rsquo;ll be able to:</p>
    <p class="sm b5" style="margin-top:4px;line-height:1.55">• Define the inverse of a matrix<br>• Calculate the inverse of a 2 × 2 matrix<br>• Use the rules of matrix arithmetic</p>
  </div>
  <p class="md b5" style="line-height:1.65;margin-top:14px">A square matrix <b>A</b> is <b>invertible</b> if there is a matrix <b>B</b> with AB = BA = I. We call B the inverse of A and write A<sup>−1</sup>…</p>
</div>
<div style="position:absolute;left:0;right:0;bottom:0;padding:12px 16px 18px;background:#fff;border-top:1px solid var(--line)">
  <div class="row" style="gap:10px">
    <div class="btn ghost" style="width:120px;font-size:15px">{I("cards",17)} 8 cards</div>
    <div class="btn" style="flex:1;font-size:15px">I&rsquo;m done reading {I("arrow",17)}</div>
  </div></div>
{pin(1,4,140)}{pin(2,84,2)}{pin(3,152,364)}{pin(4,222,364)}{pin(5,690,364)}
""")

# 5. Quiz question (focus mode) ---------------------------------------------
segs = "".join(f'<i style="flex:1;height:6px;border-radius:9px;background:{c}"></i>' for c in ["#16a34a", "#16a34a", "#16181d"] + ["#e3e7ec"] * 8)
def opt(letter, text, state=""):
    st = {"": ("var(--line)", "#fff", "#f4f6f8", "var(--ink)"),
          "sel": ("var(--ink)", "#f8fafc", "var(--ink)", "#fff")}[state]
    return f"""<div class="row" style="border:2px solid {st[0]};background:{st[1]};border-radius:18px;padding:13px 14px;margin-top:10px;gap:12px">
      <span style="width:30px;height:30px;border-radius:10px;background:{st[2]};color:{st[3]};display:grid;place-items:center;font-weight:800;font-size:14px">{letter}</span>
      <span class="md b6">{text}</span></div>"""

quiz = page(f"""
<div class="page" style="padding-top:18px">
  <div class="row" style="gap:12px">{I("x",24,2.2)}<div class="row" style="flex:1;gap:4px">{segs}</div><span class="sm b7">3/11</span></div>
  <div class="row between" style="margin-top:16px">
    <span class="chip">Inverses · Medium</span>
    <span class="row" style="gap:8px"><span class="chip">{I("pencil",15)} Scrap paper</span></span>
  </div>
  <h2 class="b7" style="font-size:22px;line-height:1.3;margin-top:16px">If (A + B)(A − B) = A² − B² for square matrices A and B, what must be true?</h2>
  {opt("A","A = B")}{opt("B","A + B = 0")}{opt("C","AB = BA","sel")}{opt("D","A and B are both invertible")}
</div>
<div style="position:absolute;left:0;right:0;bottom:0;padding:12px 16px 20px;background:#fff;border-top:1px solid var(--line)">
  <div class="btn">Check answer</div></div>
{pin(1,40,4)}{pin(2,40,190)}{pin(3,88,364)}{pin(4,700,364)}
""")

# 6. Feedback sheet ----------------------------------------------------------
def opt2(letter, text, state):
    st = {"": ("var(--line)", "#fff", "#f4f6f8", "var(--ink)", ""),
          "wrong": ("#f3a4a6", "#fef2f2", "#e5484d", "#fff", f'<span style="margin-left:auto;color:#e5484d">{I("x",18,2.6)}</span>'),
          "right": ("#16a34a", "#ecfdf3", "#16a34a", "#fff", f'<span style="margin-left:auto;color:#16a34a">{I("check",18,2.6)}</span>')}[state]
    return f"""<div class="row" style="border:2px solid {st[0]};background:{st[1]};border-radius:18px;padding:11px 14px;margin-top:9px;gap:12px;opacity:{'.5' if state=='' else '1'}">
      <span style="width:28px;height:28px;border-radius:10px;background:{st[2]};color:{st[3]};display:grid;place-items:center;font-weight:800;font-size:13px">{letter}</span>
      <span class="md b6">{text}</span>{st[4]}</div>"""

feedback = page(f"""
<div class="page" style="padding-top:18px">
  <div class="row" style="gap:12px">{I("x",24,2.2)}<div class="row" style="flex:1;gap:4px">{segs}</div><span class="sm b7">3/11</span></div>
  <h2 class="b7" style="font-size:19px;line-height:1.3;margin-top:18px">If (A + B)(A − B) = A² − B² for square matrices A and B, what must be true?</h2>
  {opt2("A","A = B","wrong")}{opt2("B","A + B = 0","")}{opt2("C","AB = BA","right")}
</div>
<div style="position:absolute;left:0;right:0;bottom:0;background:#fff4f4;border-top:2px solid #f3a4a6;border-radius:26px 26px 0 0;padding:18px 18px 20px">
  <p class="row b8" style="font-size:20px;color:#c4262b;gap:8px">{I("x",22,3)} Not quite</p>
  <p class="md b5" style="line-height:1.55;margin-top:8px">Expand it: (A + B)(A − B) = A² − AB + BA − B². That equals A² − B² only when <b>BA − AB = 0</b>, so A and B must commute: <b>AB = BA</b>.</p>
  <p class="row sm b7" style="gap:6px;margin-top:10px;text-decoration:underline;text-underline-offset:3px">{I("book",15)} Review &ldquo;Rules of Matrix Arithmetic&rdquo;</p>
  <div class="btn" style="margin-top:14px;background:#c4262b">Got it, next question</div>
</div>
{pin(1,520,364)}{pin(2,590,300)}{pin(3,700,364)}
""")

# 7. Results -----------------------------------------------------------------
confetti = "".join(
    f'<i style="position:absolute;left:{x}px;top:{y}px;width:{w}px;height:{h}px;border-radius:3px;background:{c};transform:rotate({r}deg)"></i>'
    for x, y, w, h, c, r in [(40,40,8,14,"#ff6b3d",20),(90,90,10,10,"#4cb2f5",0),(320,50,8,14,"#16a34a",-30),(280,120,10,10,"#ffc94d",45),
                             (60,170,10,10,"#ffc94d",10),(340,190,8,14,"#ff6b3d",60),(160,30,8,8,"#16a34a",0),(230,70,8,14,"#4cb2f5",-15)]
)
results = page(f"""
<div style="position:absolute;inset:0 0 auto 0;height:240px">{confetti}</div>
<div class="page" style="padding-top:18px;position:relative;text-align:center">
  <div class="row between">{I("x",24,2.2)}<span></span></div>
  <div style="width:150px;height:150px;margin:18px auto 0;position:relative">
    <svg width="150" height="150" viewBox="0 0 150 150"><circle cx="75" cy="75" r="62" fill="none" stroke="#ecfdf3" stroke-width="14"/>
      <circle cx="75" cy="75" r="62" fill="none" stroke="#16a34a" stroke-width="14" stroke-linecap="round" stroke-dasharray="319 390" transform="rotate(-90 75 75)"/></svg>
    <div style="position:absolute;inset:0;display:grid;place-items:center"><div><p class="b8" style="font-size:38px">82%</p><p class="xs muted b7">9 of 11</p></div></div>
  </div>
  <h1 class="b8" style="font-size:28px;margin-top:12px">Topic passed!</h1>
  <p class="md muted b5" style="margin-top:4px">You beat your best score by 9%.</p>
  <div class="row" style="justify-content:center;gap:10px;margin-top:16px">
    <span class="chip" style="background:#fff1eb;color:#c2410c;font-size:14px;padding:8px 14px">{I("flame",16,2.2,"#ff6b3d")} 6-day streak</span>
    <span class="chip" style="background:#eef7fe;color:#0b6db3;font-size:14px;padding:8px 14px">{I("spark",16,2.2)} +45 XP</span>
  </div>
  <div class="card outline row" style="margin-top:18px;text-align:left;gap:12px;padding:14px 16px">
    <span style="width:40px;height:40px;border-radius:12px;background:var(--mint);display:grid;place-items:center;color:#16a34a">{I("unlock",20)}</span>
    <div style="flex:1;min-width:0"><p class="xs muted b7" style="letter-spacing:.05em">UNLOCKED</p><p class="sm b7">Elementary Matrices &amp; Finding A⁻¹</p></div>
  </div>
</div>
<div style="position:absolute;left:0;right:0;bottom:0;padding:12px 16px 20px;background:#fff">
  <div class="btn">Next topic {I("arrow",18)}</div>
  <div class="btn ghost" style="margin-top:10px;font-size:15px">Review my 2 mistakes</div></div>
{pin(1,60,290)}{pin(2,330,330)}{pin(3,414,364)}{pin(4,636,364)}
""")

# 8. My modules --------------------------------------------------------------
def modcard(code, name, pct, nxt, due=None, color="#16a34a"):
    dash = round(2 * 3.1416 * 20 * pct / 100)
    due_html = f'<span class="chip" style="background:#fff1eb;color:#c2410c;font-size:12px;padding:4px 10px">{I("calendar",13)} {due}</span>' if due else ""
    return f"""<div class="card outline" style="margin-top:12px;padding:16px">
      <div class="row" style="gap:12px;align-items:flex-start">
        <div style="position:relative;width:50px;height:50px;flex-shrink:0">
          <svg width="50" height="50" viewBox="0 0 50 50"><circle cx="25" cy="25" r="20" fill="none" stroke="#eef1f4" stroke-width="6"/>
          <circle cx="25" cy="25" r="20" fill="none" stroke="{color}" stroke-width="6" stroke-linecap="round" stroke-dasharray="{dash} 200" transform="rotate(-90 25 25)"/></svg>
          <span class="xs b8" style="position:absolute;inset:0;display:grid;place-items:center">{pct}%</span></div>
        <div style="flex:1;min-width:0"><p class="b8 md">{code}</p><p class="sm muted b5">{name}</p></div>
        <span class="muted">{I("more",20)}</span>
      </div>
      <div class="row" style="margin-top:12px;gap:8px">{due_html}</div>
      <div class="row" style="margin-top:12px;background:var(--soft);border-radius:999px;padding:6px 6px 6px 16px">
        <div style="flex:1;min-width:0"><p class="xs muted b7">NEXT UP</p><p class="sm b7" style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis">{nxt}</p></div>
        <span class="btn" style="height:40px;padding:0 16px;font-size:14px">Continue</span></div>
    </div>"""

modules = page(f"""
{topbar()}
<div class="page" style="margin-top:16px">
  <div class="row between"><h1 class="b8" style="font-size:26px">My modules</h1><span class="chip" style="background:var(--ink);color:#fff">+ Add</span></div>
  {modcard("MAT1503","Linear Algebra I",12,"Inverses; Rules of Matrix Arithmetic","Assignment 2 · 5 days")}
  {modcard("COS2601","Theoretical Computer Science II",0,"Start: Regular Languages",None,"#4cb2f5")}
  <div class="card" style="margin-top:12px;background:var(--soft);padding:14px 16px">
    <div class="row" style="gap:10px">{I("users",18)}<p class="sm b6"><b>14 classmates</b> are studying MAT1503 this week</p></div>
  </div>
</div>
{nav("study")}
{pin(1,92,290)}{pin(2,150,4)}{pin(3,160,364)}{pin(4,244,364)}{pin(5,300,364)}{pin(6,516,364)}
""")

PAGES = {
    "01-dashboard": dashboard, "02-onboarding": onboarding, "03-learning-path": path,
    "04-lesson": lesson, "05-quiz-question": quiz, "06-quiz-feedback": feedback,
    "07-quiz-results": results, "08-my-modules": modules,
}


async def render():
    from playwright.async_api import async_playwright
    async with async_playwright() as p:
        b = await p.chromium.launch()
        ctx = await b.new_context(viewport={"width": 390, "height": 780}, device_scale_factor=1.6)
        pg = await ctx.new_page()
        for name, html in PAGES.items():
            f = HERE / f"{name}.html"
            f.write_text(html)
            await pg.goto(f.as_uri())
            await pg.evaluate("document.fonts.ready")
            await pg.screenshot(path=str(OUT / f"{name}.png"))
            print("rendered", name)
        await b.close()

asyncio.run(render())
