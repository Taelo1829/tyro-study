"""New screens in the style of the 27 Oct 2026 UX review mockups (mock.py / base.css):
onboarding step 3, module group chats, review cards, Me tab, a failed quiz, and a
desktop dashboard. Same tokens, type and components as the existing mockups."""
from icons import PATHS
from icons import icon as I
from mock import page, nav, topbar, pin

PATHS.update({
    "send": '<path d="m22 2-7 20-4-9-9-4Z"/><path d="M22 2 11 13"/>',
    "mic": '<rect x="9" y="2" width="6" height="12" rx="3"/><path d="M19 10v1a7 7 0 0 1-14 0v-1M12 18v4"/>',
    "image": '<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.1-3.1a2 2 0 0 0-2.8 0L6 21"/>',
    "pin": '<path d="M12 17v5M9 10.8V4h6v6.8l2 3.2H7z"/>',
    "reply": '<path d="M9 17 4 12l5-5"/><path d="M20 18v-2a4 4 0 0 0-4-4H4"/>',
    "flag": '<path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1zM4 22v-7"/>',
    "ban": '<circle cx="12" cy="12" r="10"/><path d="m4.9 4.9 14.2 14.2"/>',
    "copy": '<rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>',
    "logout": '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"/>',
    "settings": '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1Z"/>',
    "bellOff": '<path d="M8.7 3A6 6 0 0 1 18 8a21.3 21.3 0 0 0 .6 5M17 17H3s3-2 3-9a4.67 4.67 0 0 1 .3-1.7M10.3 21a1.94 1.94 0 0 0 3.4 0M2 2l20 20"/>',
    "at": '<circle cx="12" cy="12" r="4"/><path d="M16 8v5a3 3 0 0 0 6 0v-1a10 10 0 1 0-4 8"/>',
    "rotate": '<path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5"/>',
    "shield": '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10"/>',
    "grad": '<path d="M22 10 12 5 2 10l10 5 10-5Z"/><path d="M6 12v5c3 3 9 3 12 0v-5"/>',
    "chart": '<path d="M3 3v18h18"/><path d="M18 17V9M13 17V5M8 17v-3"/>',
})


def avatar(letter, bg="#16181d", fg="#fff", size=34):
    return (f'<span style="width:{size}px;height:{size}px;border-radius:999px;background:{bg};color:{fg};display:grid;'
            f'place-items:center;font-weight:800;font-size:{int(size*.42)}px;flex-shrink:0">{letter}</span>')


def back_header(title, sub="", right=""):
    return f"""<div class="row" style="height:64px;padding:0 12px;gap:10px;border-bottom:1px solid var(--line);background:#fff">
      {I("back",22)}<div style="flex:1;min-width:0"><p class="b8 md" style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis">{title}</p>
      {f'<p class="xs muted b6">{sub}</p>' if sub else ''}</div>{right}</div>"""


# 9. Onboarding step 3 -------------------------------------------------------
def goal(mins, label, on):
    return f"""<div style="flex:1;border:2px solid {'var(--ink)' if on else 'var(--line)'};background:{'#f8fafc' if on else '#fff'};border-radius:20px;padding:14px 10px;text-align:center">
      <p class="b8" style="font-size:22px">{mins}</p><p class="xs muted b7">min a day</p><p class="xs b6" style="margin-top:6px">{label}</p></div>"""

onboarding3 = page(f"""
<div class="page" style="padding-top:22px">
  <div class="row between"><span class="logo" style="width:34px;height:34px">{I("brain",17)}</span>
    <div class="row" style="gap:6px"><i style="width:26px;height:6px;border-radius:9px;background:var(--ink)"></i><i style="width:26px;height:6px;border-radius:9px;background:var(--ink)"></i><i style="width:26px;height:6px;border-radius:9px;background:var(--ink)"></i></div>
    <span class="sm muted b6">Skip</span></div>
  <p class="xs muted b7" style="margin-top:22px;letter-spacing:.06em">STEP 3 OF 3</p>
  <h1 class="b8" style="font-size:26px;line-height:1.15;margin-top:4px">When is your next deadline?</h1>
  <p class="sm muted b5" style="margin-top:6px">We&rsquo;ll pace your plan and remind you before it.</p>

  <div class="card outline" style="margin-top:16px;padding:14px 16px">
    <div class="row between"><p class="b7 md">MAT1503</p><span class="chip" style="font-size:12px">Assignment 2</span></div>
    <div class="row" style="height:46px;border-radius:14px;border:1.5px solid var(--line);padding:0 14px;margin-top:10px;gap:10px">{I("calendar",17,2,"#6b7280")}<span class="md b6">Fri 13 Nov 2026</span></div>
  </div>
  <div class="card outline" style="margin-top:10px;padding:14px 16px">
    <div class="row between"><p class="b7 md">COS2601</p><span class="chip" style="font-size:12px">Exam</span></div>
    <div class="row" style="height:46px;border-radius:14px;border:1.5px dashed #cfd5dc;padding:0 14px;margin-top:10px;gap:10px">{I("calendar",17,2,"#9ca3af")}<span class="md muted b5">Add a date (optional)</span></div>
  </div>

  <p class="b7 md" style="margin-top:20px">How much can you study a day?</p>
  <div class="row" style="gap:10px;margin-top:10px">{goal(5,"Light",False)}{goal(15,"Steady",True)}{goal(30,"Intense",False)}</div>
  <div class="row" style="gap:10px;margin-top:14px;background:var(--soft);border-radius:16px;padding:10px 14px">{I("bell",17)}<p class="sm b6">Remind me at <b>19:00</b></p><span style="flex:1"></span><span class="sm b7" style="text-decoration:underline">Change</span></div>
</div>
<div style="position:absolute;left:0;right:0;bottom:0;padding:14px 16px 20px;background:linear-gradient(to top,#fff 75%,rgba(255,255,255,0))">
  <div class="btn">Start my first lesson {I("arrow",18)}</div></div>
""")


# 10. Chats: module groups ----------------------------------------------------
def group_row(code, name, last, time, unread=0, mention=False, muted=False, color="#d6eafb"):
    badge = ""
    if mention:
        badge = f'<span style="min-width:22px;height:22px;border-radius:999px;background:var(--orange);color:#fff;display:grid;place-items:center">{I("at",13,2.6)}</span>'
    elif unread:
        badge = f'<span style="min-width:22px;height:22px;padding:0 7px;border-radius:999px;background:var(--ink);color:#fff;font-size:12px;font-weight:800;display:grid;place-items:center">{unread}</span>'
    m = f'<span style="color:#9ca3af">{I("bellOff",14)}</span>' if muted else ""
    return f"""<div class="row" style="padding:12px 4px;gap:12px;border-bottom:1px solid var(--line)">
      <span style="width:48px;height:48px;border-radius:16px;background:{color};display:grid;place-items:center;font-weight:800;font-size:12px;flex-shrink:0">{code[:3]}</span>
      <div style="flex:1;min-width:0">
        <div class="row between"><p class="b8 md">{code}</p><span class="xs muted b6">{time}</span></div>
        <p class="xs muted b6">{name}</p>
        <div class="row" style="gap:6px;margin-top:3px"><p class="sm b5" style="flex:1;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;color:{'var(--ink)' if unread or mention else 'var(--muted)'}">{last}</p>{m}{badge}</div>
      </div></div>"""

chats = page(f"""
{topbar()}
<div class="page" style="margin-top:16px">
  <h1 class="b8" style="font-size:26px">Module groups</h1>
  <p class="sm muted b5" style="margin-top:2px">One group for each module you&rsquo;re doing</p>
  <div class="row" style="height:44px;border-radius:999px;background:var(--soft);padding:0 16px;margin-top:14px;gap:8px">{I("search",17,2,"#6b7280")}<span class="sm muted b5">Search messages</span></div>
  <div style="margin-top:6px">
    {group_row("MAT1503","Linear Algebra I","Lerato: @Taelo did you get Q4 of the inverse exercise?","10:42",mention=True)}
    {group_row("COS2601","Theoretical Computer Science II","Sipho: Anyone doing the regex quiz tonight?","09:15",unread=7,color="#dcefe6")}
    {group_row("COS2614","Programming: Contemporary Concepts","Admin: Exam prep session moved to Sat 10:00","Tue",unread=1,color="#e2e9ef")}
    {group_row("INF1520","Human-Computer Interaction I","Naledi: Thanks, that summary helped","Mon",muted=True,color="#fff1eb")}
  </div>
  <div class="row" style="gap:10px;margin-top:14px;background:#eef7fe;border-radius:16px;padding:12px 14px">{I("users",18,2,"#0b6db3")}<p class="sm b6" style="color:#0b6db3">Join a module to join its group</p></div>
</div>
{nav("chats")}
""")


# 11. Group thread -------------------------------------------------------------
def msg(who, letter, color, text, time, me=False, reply=None, extra=""):
    rq = (f'<div style="border-left:3px solid {"#9ca3af" if me else "#4cb2f5"};padding:2px 8px;margin-bottom:6px;border-radius:4px;'
          f'background:{"#2b2f37" if me else "#eef7fe"}"><p class="xs b7">{reply[0]}</p><p class="xs b5" style="opacity:.8">{reply[1]}</p></div>') if reply else ""
    bubble = (f'<div style="max-width:250px;background:{"var(--ink)" if me else "#fff"};color:{"#fff" if me else "var(--ink)"};'
              f'border-radius:{"18px 18px 4px 18px" if me else "18px 18px 18px 4px"};padding:9px 12px;{"" if me else "border:1px solid var(--line);"}">'
              f'{"" if me else f"<p class=\"xs b8\" style=\"color:{color}\">{who}</p>"}{rq}<p class="sm b5" style="line-height:1.45">{text}</p>'
              f'{extra}<p class="xs" style="text-align:right;opacity:.6;margin-top:2px">{time}</p></div>')
    if me:
        return f'<div class="row" style="justify-content:flex-end;margin-top:10px">{bubble}</div>'
    return f'<div class="row" style="align-items:flex-end;gap:8px;margin-top:10px">{avatar(letter, color, "#fff", 28)}{bubble}</div>'

topic_card = f"""<div class="row" style="gap:10px;background:var(--soft);border-radius:12px;padding:8px 10px;margin-top:6px">
  <span style="width:30px;height:30px;border-radius:9px;background:var(--ink);color:#fff;display:grid;place-items:center">{I("book",15)}</span>
  <div style="min-width:0"><p class="xs b8">Inverses; Rules of Matrix Arithmetic</p><p class="xs muted b6">MAT1503 · Topic 4 · Open lesson</p></div></div>"""

thread = page(f"""
{back_header("MAT1503 · Linear Algebra I", "2,140 members · 38 online", f'<span class="row" style="gap:12px">{I("bell",20)}{I("more",20)}</span>')}
<div class="row" style="gap:10px;background:#fff8e6;padding:9px 16px;border-bottom:1px solid #f5e3b3">
  <span style="color:#b45309">{I("pin",16)}</span><p class="xs b6" style="flex:1;min-width:0"><b>Pinned by Tyro:</b> Assignment 2 is due Fri 13 Nov. Don&rsquo;t share answers.</p></div>
<div class="page" style="padding-top:4px">
  <p class="xs muted b7" style="text-align:center;margin-top:6px">TODAY</p>
  {msg("Lerato","L","#7c3aed","How do you know a matrix is invertible without finding the inverse?","10:31")}
  {msg("Sipho","S","#0b6db3","If det(A) ≠ 0 it&rsquo;s invertible. This lesson explains it:","10:34", extra=topic_card)}
  {msg("","","", "Thanks! So for a 2 × 2 it&rsquo;s just ad − bc?","10:38", me=True, reply=("Sipho","If det(A) ≠ 0 it&rsquo;s invertible…"))}
  {msg("Lerato","L","#7c3aed","<b style=\"color:#c2410c\">@Taelo</b> yes, and if it&rsquo;s 0 there&rsquo;s no inverse. Did you get Q4 of the inverse exercise?","10:42")}
  <div class="row xs muted b6" style="gap:6px;margin-top:10px">{avatar("N","#16a34a","#fff",20)} Naledi is typing…</div>
</div>
<div style="position:absolute;left:0;right:0;bottom:0;padding:10px 12px 16px;background:#fff;border-top:1px solid var(--line)">
  <div class="row" style="gap:8px">
    <span style="width:42px;height:42px;border-radius:999px;background:var(--soft);display:grid;place-items:center">{I("image",19)}</span>
    <div class="row" style="flex:1;height:44px;border-radius:999px;border:1.5px solid var(--line);padding:0 14px"><span class="sm muted b5">Message MAT1503…</span></div>
    <span style="width:44px;height:44px;border-radius:999px;background:var(--ink);color:#fff;display:grid;place-items:center">{I("mic",19)}</span>
  </div></div>
""", "grey")


# 12. Message actions sheet ----------------------------------------------------
def action(ic, label, sub="", danger=False):
    col = "#c4262b" if danger else "var(--ink)"
    return f"""<div class="row" style="gap:14px;padding:13px 4px;border-bottom:1px solid var(--line)">
      <span style="width:38px;height:38px;border-radius:12px;background:{'#fef2f2' if danger else 'var(--soft)'};color:{col};display:grid;place-items:center">{I(ic,18)}</span>
      <div><p class="md b7" style="color:{col}">{label}</p>{f'<p class="xs muted b6">{sub}</p>' if sub else ''}</div></div>"""

actions = page(f"""
{back_header("MAT1503 · Linear Algebra I", "2,140 members · 38 online")}
<div style="position:absolute;inset:64px 0 0 0;background:rgba(22,24,29,.45)"></div>
<div style="position:absolute;left:16px;right:16px;top:150px">
  {msg("Thabo","T","#b45309","Here are the memo answers for Assignment 2, just copy them 👇","10:47")}
</div>
<div style="position:absolute;left:0;right:0;bottom:0;background:#fff;border-radius:26px 26px 0 0;padding:10px 18px 22px">
  <div style="width:40px;height:5px;border-radius:9px;background:#d4d9df;margin:0 auto 8px"></div>
  {action("reply","Reply")}
  {action("copy","Copy text")}
  {action("flag","Report message","Goes to the Tyro moderators. Thabo isn&rsquo;t told who reported.",True)}
  {action("ban","Block Thabo","Hide his messages for you in every group",True)}
  <p class="xs muted b6" style="margin-top:12px;line-height:1.5">Sharing assessment answers breaks the Terms of Use and UNISA&rsquo;s rules.</p>
</div>
""")


# 13. Review cards (spaced repetition) ------------------------------------------
review = page(f"""
<div class="page" style="padding-top:18px">
  <div class="row" style="gap:12px">{I("x",24,2.2)}<div class="bar" style="flex:1"><i style="width:35%;background:var(--sky)"></i></div><span class="sm b7">7/20</span></div>
  <div class="row between" style="margin-top:14px"><span class="chip">MAT1503 · Due today</span><span class="chip">{I("rotate",14)} Answer shown</span></div>
  <div style="margin-top:18px;height:310px;border-radius:28px;background:var(--ink);color:#fff;padding:24px;display:flex;flex-direction:column;justify-content:space-between;box-shadow:0 20px 40px -20px rgba(22,24,29,.5)">
    <span class="tag" style="color:#9ca3af">{I("cards",13)} Definition</span>
    <p class="b7" style="font-size:24px;line-height:1.3">When is a square matrix <span style="color:#4cb2f5">invertible</span>?</p>
    <p class="sm" style="color:#9ca3af">Inverses; Rules of Matrix Arithmetic</p>
  </div>
  <div style="margin-top:14px;border-radius:22px;border:2px solid var(--line);padding:14px 16px">
    <p class="xs muted b7" style="letter-spacing:.06em">ANSWER</p>
    <p class="md b6" style="margin-top:4px;line-height:1.5">When there is a matrix B with AB = BA = I. Equivalently, det(A) ≠ 0.</p>
  </div>
</div>
<div style="position:absolute;left:0;right:0;bottom:0;padding:12px 16px 20px;background:#fff">
  <p class="xs muted b7" style="text-align:center;margin-bottom:8px">How well did you know it?</p>
  <div class="row" style="gap:8px">
    <div class="btn ghost" style="flex:1;font-size:14px;flex-direction:column;gap:0;height:58px"><span>Again</span><span class="xs muted b6">10 min</span></div>
    <div class="btn ghost" style="flex:1;font-size:14px;flex-direction:column;gap:0;height:58px"><span>Hard</span><span class="xs muted b6">1 day</span></div>
    <div class="btn" style="flex:1;font-size:14px;flex-direction:column;gap:0;height:58px"><span>Good</span><span class="xs b6" style="opacity:.7">3 days</span></div>
    <div class="btn ghost" style="flex:1;font-size:14px;flex-direction:column;gap:0;height:58px"><span>Easy</span><span class="xs muted b6">7 days</span></div>
  </div></div>
""")


# 14. Me ----------------------------------------------------------------------
def me_row(ic, label, value="", danger=False):
    return f"""<div class="row" style="gap:14px;padding:14px 4px;border-bottom:1px solid var(--line)">
      <span style="color:{'#c4262b' if danger else 'var(--ink)'}">{I(ic,20)}</span><p class="md b6" style="flex:1;color:{'#c4262b' if danger else 'var(--ink)'}">{label}</p>
      <span class="sm muted b6">{value}</span>{'' if danger else f'<span class="muted">{I("chev",18)}</span>'}</div>"""

me = page(f"""
{topbar()}
<div class="page" style="margin-top:18px">
  <div class="row" style="gap:14px">{avatar("T","#16181d","#fff",64)}
    <div><p class="b8" style="font-size:22px">Taelo</p><p class="sm muted b6">BSc Computing · University</p></div></div>
  <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-top:16px">
    <div class="card" style="background:#fff1eb;padding:12px;text-align:center"><p class="b8" style="font-size:20px">6</p><p class="xs muted b7">day streak</p></div>
    <div class="card" style="background:var(--mint);padding:12px;text-align:center"><p class="b8" style="font-size:20px">14</p><p class="xs muted b7">topics passed</p></div>
    <div class="card" style="background:var(--blue);padding:12px;text-align:center"><p class="b8" style="font-size:20px">1,240</p><p class="xs muted b7">XP</p></div>
  </div>
  <div class="card" style="margin-top:14px;padding:4px 16px">
    {me_row("user","Profile")}
    {me_row("grad","Study level","University")}
    {me_row("target","Daily goal","15 min")}
    {me_row("bell","Notifications","19:00")}
    {me_row("shield","Privacy and data")}
    {me_row("logout","Sign out","",True)}
  </div>
</div>
{nav("me")}
""", "grey")


# 15. Quiz not passed ----------------------------------------------------------
fail = page(f"""
<div class="page" style="padding-top:18px;text-align:center">
  <div class="row between">{I("x",24,2.2)}<span></span></div>
  <div style="width:150px;height:150px;margin:18px auto 0;position:relative">
    <svg width="150" height="150" viewBox="0 0 150 150"><circle cx="75" cy="75" r="62" fill="none" stroke="#fff4e5" stroke-width="14"/>
      <circle cx="75" cy="75" r="62" fill="none" stroke="#d97706" stroke-width="14" stroke-linecap="round" stroke-dasharray="248 390" transform="rotate(-90 75 75)"/></svg>
    <div style="position:absolute;inset:0;display:grid;place-items:center"><div><p class="b8" style="font-size:38px">64%</p><p class="xs muted b7">7 of 11</p></div></div>
  </div>
  <h1 class="b8" style="font-size:28px;margin-top:12px">So close</h1>
  <p class="md muted b5" style="margin-top:4px">1 more right answer would pass (70%).</p>
  <div class="card outline" style="margin-top:18px;text-align:left;padding:14px 16px">
    <p class="xs muted b7" style="letter-spacing:.05em">REVISE THESE</p>
    <p class="sm b7 row" style="gap:8px;margin-top:8px">{I("book",15)} Rules of Matrix Arithmetic · 2 missed</p>
    <p class="sm b7 row" style="gap:8px;margin-top:6px">{I("book",15)} Inverse of a 2 × 2 matrix · 2 missed</p>
  </div>
  <p class="sm muted b6" style="margin-top:14px">Your streak is safe: you studied today.</p>
</div>
<div style="position:absolute;left:0;right:0;bottom:0;padding:12px 16px 20px;background:#fff">
  <div class="btn">Review my 4 mistakes</div>
  <div class="btn ghost" style="margin-top:10px;font-size:15px">Try the quiz again</div></div>
""")


# 16. Desktop dashboard (1280 x 800) ---------------------------------------------
side_items = [("home", "Home", True), ("book", "Study", False), ("calendar", "Plan", False), ("chat", "Chats", False), ("user", "Me", False)]
side = "".join(
    f'<div class="row" style="gap:12px;padding:11px 14px;border-radius:999px;margin-top:4px;{"background:var(--ink);color:#fff" if on else "color:var(--muted)"}">{I(ic,19)}<span class="sm b7">{lab}</span></div>'
    for ic, lab, on in side_items)

def mini_mod(code, name, pct, nxt, color):
    return f"""<div class="card outline" style="padding:16px">
      <div class="row between"><p class="b8 md">{code}</p><span class="xs b8">{pct}%</span></div><p class="xs muted b6">{name}</p>
      <div class="bar" style="margin-top:10px"><i style="width:{max(pct,3)}%;background:{color}"></i></div>
      <p class="xs muted b7" style="margin-top:12px">NEXT UP</p><p class="sm b7">{nxt}</p></div>"""

desktop_dashboard = f"""<!doctype html><html><head><meta charset="utf-8"><link rel="stylesheet" href="base.css">
<style>html,body{{width:1280px;height:800px}}</style></head><body class="grey">
<div style="display:grid;grid-template-columns:240px 1fr 340px;gap:24px;padding:24px;height:800px">
  <aside class="card" style="padding:18px;display:flex;flex-direction:column">
    <div class="row" style="gap:10px"><span class="logo">{I("brain",20)}</span><span class="b8 md">Tyro Study</span></div>
    <div style="margin-top:24px">{side}</div>
    <span style="flex:1"></span>
    <div class="card" style="background:var(--soft);padding:14px"><p class="sm b7">Install the app</p><p class="xs muted b6" style="margin-top:2px">Study offline on your phone</p></div>
  </aside>
  <main>
    <p class="sm muted b6">Good morning, Taelo</p>
    <h1 class="b8" style="font-size:32px;line-height:1.15;margin-top:2px">One lesson to hit today&rsquo;s goal</h1>
    <div class="card" style="background:var(--ink);color:#fff;margin-top:18px;padding:26px;display:grid;grid-template-columns:1fr 220px;gap:24px;align-items:end">
      <div><div class="tag" style="color:#9ca3af">{I("book",13)} Continue · MAT1503</div>
        <p class="b7" style="font-size:26px;line-height:1.25;margin-top:8px">Inverses; Rules of Matrix Arithmetic</p>
        <p class="sm" style="color:#c7cbd1;margin-top:6px">Topic 4 of 7 · 6 min read · 11-question quiz</p>
        <div class="bar" style="background:#2b2f37;margin-top:16px"><i style="width:43%;background:#4cb2f5"></i></div></div>
      <div class="btn white">Continue lesson {I("arrow",18)}</div>
    </div>
    <p class="b8 md" style="margin-top:22px">My modules</p>
    <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:14px;margin-top:10px">
      {mini_mod("MAT1503","Linear Algebra I",12,"Inverses; Rules of Matrix Arithmetic","#16a34a")}
      {mini_mod("COS2601","Theoretical CS II",0,"Regular Languages","#4cb2f5")}
      {mini_mod("COS2614","Contemporary Concepts",36,"Qt signals and slots","#16a34a")}
    </div>
  </main>
  <aside>
    <div class="card" style="background:var(--blue);padding:18px"><p class="sm b7">Today&rsquo;s goal</p>
      <div class="row" style="margin-top:10px;gap:14px"><svg width="60" height="60" viewBox="0 0 52 52"><circle cx="26" cy="26" r="21" fill="none" stroke="#fff" stroke-width="7"/><circle cx="26" cy="26" r="21" fill="none" stroke="#16181d" stroke-width="7" stroke-linecap="round" stroke-dasharray="88 132" transform="rotate(-90 26 26)"/></svg>
      <div><p class="b8" style="font-size:24px">2/3</p><p class="xs muted b6">✓ Read · ✓ Cards · Quiz</p></div></div></div>
    <div class="card" style="background:#fff1eb;padding:18px;margin-top:14px"><p class="sm b7 row" style="gap:6px">{I("flame",16,2.2,"#ff6b3d")} 6-day streak</p><p class="xs muted b6" style="margin-top:4px">Pass 1 quiz today to keep it</p></div>
    <div class="card" style="padding:18px;margin-top:14px"><p class="sm b7">Coming up</p>
      <div class="row" style="gap:10px;margin-top:10px">{I("calendar",17,2,"#ff6b3d")}<div><p class="sm b7">Assignment 2 · MAT1503</p><p class="xs muted b6">Fri 13 Nov · 3 topics to go</p></div></div>
      <div class="row" style="gap:10px;margin-top:10px">{I("calendar",17,2,"#6b7280")}<div><p class="sm b7">COS2614 exam</p><p class="xs muted b6">Tue 3 Nov · 09:00</p></div></div></div>
    <div class="card" style="padding:18px;margin-top:14px"><p class="sm b7">MAT1503 group</p><p class="xs muted b6" style="margin-top:2px">Lerato mentioned you · 10:42</p></div>
  </aside>
</div></body></html>"""

NEW_PAGES = {
    "09-onboarding-deadlines": onboarding3,
    "10-chats-groups": chats,
    "11-group-thread": thread,
    "12-message-actions": actions,
    "13-review-cards": review,
    "14-me": me,
    "15-quiz-not-passed": fail,
}
DESKTOP_PAGES = {"16-desktop-dashboard": desktop_dashboard}
