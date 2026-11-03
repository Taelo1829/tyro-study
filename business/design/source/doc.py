"""Builds business/03-ux-ui-design.pdf from the rendered screens in pdfimg/."""
import asyncio
from pathlib import Path

HERE = Path(__file__).parent
IMG = "pdfimg/"


def phone(name, caption="", w=150, kind="hifi"):
    src = f"{IMG}{name}-{kind}.jpg" if not name.startswith("current-") else f"{IMG}{name}"
    return f'<figure class="ph" style="width:{w}px"><div class="frame"><img src="{src}"></div>{f"<figcaption>{caption}</figcaption>" if caption else ""}</figure>'


def screen_block(name, title, status, notes, req=""):
    lis = "".join(f"<li>{n}</li>" for n in notes)
    return f"""<div class="sb">{phone(name, w=190)}<div class="sbt"><h4>{title} <span class="st {status[0]}">{status[1]}</span></h4>
    {f'<p class="req">{req}</p>' if req else ''}<ul>{lis}</ul></div></div>"""


NEW = ("new", "New 29 Oct")
REV = ("rev", "UX review 27 Oct")

# --- Journey maps -------------------------------------------------------------
def journey(title, persona, goal, stages):
    head = "".join(f"<th>{s[0]}</th>" for s in stages)
    rows = ""
    for i, label in enumerate(["Doing", "Screen", "Feeling", "Pain today", "Design response"]):
        cells = ""
        for s in stages:
            v = s[i + 1]
            if label == "Feeling":
                v = f'<span class="mood m{v[0]}">{v[1]}</span>'
            cells += f"<td>{v}</td>"
        rows += f"<tr><th class='rl'>{label}</th>{cells}</tr>"
    return f"""<div class="journey"><h3>{title}</h3><p class="meta"><b>Who:</b> {persona} &nbsp;·&nbsp; <b>Goal:</b> {goal}</p>
    <table class="jt"><thead><tr><th></th>{head}</tr></thead><tbody>{rows}</tbody></table></div>"""

J1 = journey("Journey 1 · First visit to first pass", "Working UNISA student, studies on a phone after work",
  "find help for a module and know it works, in one sitting", [
  ("Discover", "Googles a topic, lands on a free note", "Public note", ("3", "Curious"), "Note is good but the next step is a sign-up wall", "Sample quiz on the note, then “Create a free account”"),
  ("Sign up", "Email, password, level, 6-digit code", "Register", ("2", "Impatient"), "Code email may land in spam", "Clear “check spam / resend in 60 s” copy"),
  ("Set up", "Picks modules and a deadline", "Onboarding 2–3", ("3", "Hopeful"), "Today: empty dashboard, join modules one by one", "One multi-select step, deadline and daily goal"),
  ("Learn", "Reads the first lesson", "Lesson", ("4", "Focused"), "Long scroll, quiz button at the very end", "Read → Cards → Quiz steps, sticky “I’m done reading”"),
  ("Prove it", "Takes the topic quiz", "Quiz, feedback, results", ("5", "Proud"), "Submit hidden on phones; no reason when wrong", "Focus mode, explanation per answer, celebration"),
])
J2 = journey("Journey 2 · Daily 10-minute study", "Same student, two weeks in, on the taxi home",
  "keep the streak and move one topic forward", [
  ("Prompt", "Gets a 19:00 reminder", "Push notification", ("3", "Neutral"), "Bell dot looks like an alert all the time", "One meaningful reminder a day, at the chosen time"),
  ("Resume", "Opens the app", "Home", ("4", "Oriented"), "“Up next” can point at a locked topic", "Big Continue card, always an unlocked topic"),
  ("Revise", "Reviews due flashcards", "Review cards", ("4", "Efficient"), "Flashcards only exist inside a topic tab", "Daily due cards with spaced repetition"),
  ("Practise", "Quiz, misses two", "Quiz → Not passed", ("2", "Frustrated"), "Same screen for pass and fail", "“So close” screen, review mistakes first"),
  ("Close", "Sees streak kept", "Results / Home", ("4", "Satisfied"), "Streak counts visits, not study", "Streak counts a lesson or a passed quiz"),
])
J3 = journey("Journey 3 · Getting unstuck in a module group", "Student stuck on an exercise late at night",
  "get a quick, trustworthy answer from classmates", [
  ("Stuck", "Can’t see why a matrix isn’t invertible", "Lesson / quiz", ("2", "Stuck"), "Only 1:1 chat with friends they already know", "Every module has its own group"),
  ("Ask", "Opens the MAT1503 group, asks", "Module groups → thread", ("3", "Hopeful"), "Has to find a friend first", "Group joined automatically with the module"),
  ("Answer", "Classmate replies with a lesson link", "Thread, topic card", ("5", "Relieved"), "Links are plain text", "Tyro links show as cards that open the lesson"),
  ("Notified", "Gets a mention later", "Push (mention)", ("4", "Included"), "Risk of noisy groups", "Mentions and replies only by default"),
  ("Safe", "Sees answer-sharing, reports it", "Message actions", ("3", "Reassured"), "No report or block today", "Report, block, admin moderation, pinned rules"),
])

# --- Flow diagram ---------------------------------------------------------------
def flow(items, w=92):
    out = ""
    for i, it in enumerate(items):
        if isinstance(it, str):
            out += f'<div class="arrow">{it}</div>'
        else:
            out += phone(it[0], it[1], w=w)
    return f'<div class="flow">{out}</div>'

CSS = """
@page { size: A4; margin: 16mm 14mm 16mm 14mm; }
* { box-sizing: border-box; }
body { font-family: Urbanist, system-ui, sans-serif; color: #16181d; font-size: 10.5pt; line-height: 1.45; margin: 0; }
@font-face{font-family:Urbanist;font-weight:400;src:url("fonts/urbanist-latin-400-normal.woff2")}
@font-face{font-family:Urbanist;font-weight:500;src:url("fonts/urbanist-latin-500-normal.woff2")}
@font-face{font-family:Urbanist;font-weight:600;src:url("fonts/urbanist-latin-600-normal.woff2")}
@font-face{font-family:Urbanist;font-weight:700;src:url("fonts/urbanist-latin-700-normal.woff2")}
@font-face{font-family:Urbanist;font-weight:800;src:url("fonts/urbanist-latin-800-normal.woff2")}
h1 { font-size: 30pt; font-weight: 800; line-height: 1.05; margin: 0; letter-spacing: -.01em; }
h2 { font-size: 19pt; font-weight: 800; margin: 0 0 4mm; letter-spacing: -.01em; break-after: avoid; }
h2 .n { color: #ff6b3d; margin-right: 6px; }
h3 { font-size: 12.5pt; font-weight: 800; margin: 6mm 0 2mm; break-after: avoid; }
h4 { font-size: 11pt; font-weight: 800; margin: 0 0 1.5mm; }
p { margin: 0 0 2.5mm; }
.lead { font-size: 11.5pt; color: #374151; }
.muted { color: #5b6270; }
.section { break-before: page; }
.kicker { font-size: 8.5pt; font-weight: 800; letter-spacing: .1em; text-transform: uppercase; color: #5b6270; margin-bottom: 2mm; }
table { width: 100%; border-collapse: collapse; font-size: 8.8pt; margin: 2mm 0 3.5mm; }
th, td { text-align: left; vertical-align: top; padding: 4px 6px; border-bottom: 1px solid #e3e7ec; }
thead th { font-size: 8pt; text-transform: uppercase; letter-spacing: .05em; color: #5b6270; border-bottom: 1.5px solid #16181d; }
tr { break-inside: avoid; }
.ph { margin: 0; display: inline-block; vertical-align: top; }
.ph .frame { border-radius: 14px; overflow: hidden; border: 1px solid #d9dee4; aspect-ratio: 390/780; background: #fff; box-shadow: 0 6px 14px -8px rgba(22,24,29,.35); }
.ph img { width: 100%; height: 100%; object-fit: cover; object-position: top; display: block; }
.ph figcaption { font-size: 8pt; font-weight: 600; color: #5b6270; text-align: center; margin-top: 4px; line-height: 1.25; }
.row { display: flex; gap: 10px; align-items: flex-start; }
.grid { display: flex; flex-wrap: wrap; gap: 12px 10px; }
.sb { display: flex; gap: 14px; align-items: flex-start; break-inside: avoid; margin-bottom: 7mm; }
.sbt { flex: 1; }
.sbt ul { margin: 1mm 0 0; padding-left: 15px; } .sbt li { margin: 1.2mm 0; }
.req { font-size: 8.5pt; color: #5b6270; font-weight: 600; margin: 0 0 1mm; }
.st { font-size: 7.5pt; font-weight: 800; border-radius: 99px; padding: 2px 7px; vertical-align: 2px; margin-left: 4px; letter-spacing: .02em; }
.st.new { background: #fff1eb; color: #9a3412; } .st.rev { background: #d6eafb; color: #0b4f86; } .st.built { background: #dcefe6; color: #14532d; }
.journey { break-inside: avoid; margin-bottom: 4mm; }
.meta { font-size: 9pt; color: #374151; }
.jt th, .jt td { font-size: 8.3pt; padding: 4px 5px; width: 18%; }
.jt th.rl { width: 10%; font-size: 7.5pt; text-transform: uppercase; color: #5b6270; letter-spacing: .04em; }
.jt thead th { background: #16181d; color: #fff; border: 0; text-transform: none; font-size: 8.5pt; letter-spacing: 0; }
.jt thead th:first-child { background: transparent; }
.mood { font-weight: 800; padding: 1px 7px; border-radius: 99px; font-size: 8pt; }
.m1,.m2 { background: #fef2f2; color: #b91c1c; } .m3 { background: #f4f6f8; color: #374151; } .m4,.m5 { background: #dcefe6; color: #14532d; }
.flow { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; margin: 2mm 0 5mm; break-inside: avoid; }
.arrow { font-size: 14pt; color: #ff6b3d; font-weight: 800; }
.box { border: 1.5px solid #e3e7ec; border-radius: 12px; padding: 4mm; break-inside: avoid; }
.callout { background: #fff4e5; border-left: 4px solid #d97706; border-radius: 8px; padding: 3mm 4mm; margin: 3mm 0; break-inside: avoid; font-size: 9.5pt; }
.ok { color: #15803d; font-weight: 800; } .bad { color: #b91c1c; font-weight: 800; }
.swatch { display: inline-block; width: 12px; height: 12px; border-radius: 3px; vertical-align: -1px; border: 1px solid #d9dee4; margin-right: 4px; }
.cover { height: 260mm; display: flex; flex-direction: column; }
.cover .hero { margin-top: auto; display: flex; gap: 12px; justify-content: center; }
.toc td { font-size: 10.5pt; padding: 6px 4px; } .toc td:first-child { color: #ff6b3d; font-weight: 800; width: 10mm; }
.ia { display: flex; gap: 8px; margin: 3mm 0; }
.ia .col { flex: 1; border: 1.5px solid #e3e7ec; border-radius: 12px; padding: 3mm; font-size: 8.5pt; }
.ia .col b { display: block; font-size: 10pt; margin-bottom: 1mm; }
.two { display: grid; grid-template-columns: 1fr 1fr; gap: 6mm; }
img.wide { width: 100%; border-radius: 10px; border: 1px solid #e3e7ec; display: block; }
"""

def build():
    contrast = [
        ("Ink text on white", "#16181d", "#ffffff", 17.76, "Body text", "ok", "–"),
        ("Muted text on white", "#6b7280", "#ffffff", 4.83, "Secondary text", "ok", "–"),
        ("Muted text on app grey", "#6b7280", "#eef1f4", 4.26, "Captions on grey pages", "bad", "Use #4b5563 (6.67:1) for text on grey"),
        ("Locked / disabled grey", "#9ca3af", "#ffffff", 2.54, "Locked topic titles", "bad", "Use #6b7280 + lock icon + “Pass X to unlock”"),
        ("White on orange", "#ffffff", "#ff6b3d", 2.83, "START chip, @ badge", "bad", "White on #c2410c (5.18:1); keep #ff6b3d for icons only"),
        ("White on green", "#ffffff", "#16a34a", 3.30, "Passed node (icon only)", "ok", "Fine for icons; use #15803d (5.02:1) if text"),
        ("Dark orange on peach", "#c2410c", "#fff1eb", 4.69, "Streak chip", "ok", "–"),
        ("Error red on pink", "#c4262b", "#fff4f4", 5.33, "“Not quite” sheet", "ok", "–"),
        ("Blue on light blue", "#0b6db3", "#eef7fe", 5.03, "Info notes, XP chip", "ok", "–"),
        ("Grey on ink", "#9ca3af", "#16181d", 6.99, "Captions in hero card", "ok", "–"),
        ("Input border on white", "#e3e7ec", "#ffffff", 1.24, "Text fields (non-text)", "bad", "Field borders #8a929c (3.15:1)"),
        ("Amber ring on amber tint", "#d97706", "#fff4e5", 2.93, "Score ring (non-text)", "bad", "Add the score as text (done) and use #b45309"),
    ]
    crow = "".join(
        f"<tr><td>{n}</td><td><span class='swatch' style='background:{a}'></span>{a} on <span class='swatch' style='background:{b}'></span>{b}</td>"
        f"<td>{r:.2f}:1</td><td>{u}</td><td class='{res}'>{'Pass' if res=='ok' else 'Fail'}</td><td>{fix}</td></tr>"
        for n, a, b, r, u, res, fix in contrast)

    html = f"""<!doctype html><html><head><meta charset="utf-8"><title>Tyro Study UX/UI Design</title><style>{CSS}</style></head><body>

<section class="cover">
  <div class="kicker">Tyro Study · Phase 3 of the project lifecycle</div>
  <h1>UX/UI design<br>and prototyping</h1>
  <p class="lead" style="margin-top:5mm;max-width:150mm">How students will use the redesigned Tyro Study: journeys, wireframes, high-fidelity screens, a clickable prototype, the design system, responsive and accessibility rules, and the usability test plan.</p>
  <p class="muted" style="font-size:9.5pt">29 October 2026 · Builds on <b>01-discovery-and-business-analysis.md</b>, <b>02-requirements.md</b> and the UX review in <b>docs/ux-review/</b></p>
  <div class="hero">{phone("01-dashboard","",150)}{phone("04-lesson","",150)}{phone("07-quiz-results","",150)}{phone("11-group-thread","",150)}</div>
</section>

<section class="section">
  <h2>Contents</h2>
  <table class="toc">
    <tr><td>0</td><td>About this design</td></tr>
    <tr><td>1</td><td>User journeys</td></tr>
    <tr><td>2</td><td>Information architecture and wireframes</td></tr>
    <tr><td>3</td><td>High-fidelity screens</td></tr>
    <tr><td>4</td><td>Prototype</td></tr>
    <tr><td>5</td><td>Design system: typography, colour and components</td></tr>
    <tr><td>6</td><td>Responsive layouts and accessibility</td></tr>
    <tr><td>7</td><td>Usability testing</td></tr>
    <tr><td>8</td><td>Handoff and next steps</td></tr>
  </table>

  <h2 style="margin-top:10mm"><span class="n">0</span>About this design</h2>
  <p><b>The latest design</b> is the redesign from the UX review of 27 October 2026 (eight screens, drawn from the live app at www.tyrostudy.co.za), extended on 29 October with seven new phone screens and a desktop layout for the requirements added since: onboarding deadlines, module group chats, spaced-repetition review, the Me tab and the “not passed” result. Every screen uses Tyro’s own font (Urbanist), colours and components.</p>
  <table>
    <thead><tr><th>Label</th><th>Meaning</th></tr></thead>
    <tr><td><span class="st rev">UX review 27 Oct</span></td><td>Screen from the UX review redesign (docs/ux-review/mockups)</td></tr>
    <tr><td><span class="st new">New 29 Oct</span></td><td>New screen in this document, same style</td></tr>
    <tr><td><span class="st built">Built</span></td><td>Already in the app</td></tr>
  </table>
  <p><b>Design principles</b> for an audience of mostly adult distance learners, often on a phone and in their second or third language:</p>
  <table>
    <thead><tr><th style="width:28%">Principle</th><th>What it means on screen</th></tr></thead>
    <tr><td><b>One clear next step</b></td><td>Each screen has one main black button. Home always says what to do next.</td></tr>
    <tr><td><b>Reward study, not visits</b></td><td>Streaks, rings and celebrations respond to lessons and passed quizzes.</td></tr>
    <tr><td><b>Teach, don’t just test</b></td><td>Every answer is explained; mistakes link back to the lesson.</td></tr>
    <tr><td><b>Calm and respectful</b></td><td>Quiet fun (no childish mascots), no shaming copy, kind fail screens.</td></tr>
    <tr><td><b>Thumb-first</b></td><td>Main actions are pinned to the bottom of the screen and at least 44 px tall.</td></tr>
    <tr><td><b>Plain English</b></td><td>Short sentences, South African spelling, no idioms.</td></tr>
  </table>
</section>

<section class="section">
  <h2><span class="n">1</span>User journeys</h2>
  <p>Three journeys cover the moments that decide whether students stay: the first session (activation), the daily habit (retention) and getting help (the new module groups). Feelings come from the UX review walkthrough and should be confirmed in usability testing (section 7).</p>
  {J1}
  {J2}
</section>
<section class="section">
  {J3}
  <h3>Personas behind the journeys</h3>
  <table>
    <thead><tr><th style="width:24%">Persona</th><th>Context</th><th>Needs from the design</th></tr></thead>
    <tr><td><b>Working distance learner</b> (core)</td><td>UNISA, part-time, mid-range Android, prepaid data, studies in short sessions</td><td>Fast resume, small data use, clear plan, explanations in plain English</td></tr>
    <tr><td><b>Matric learner</b></td><td>Grade 11–12, phone-only, revises before exams</td><td>Same flows with “subjects” and “grades”; safe, level-only groups</td></tr>
    <tr><td><b>Content admin</b></td><td>Builds modules from textbooks with AI, desktop</td><td>Fast editing, publish and lock controls, moderation queue, analytics</td></tr>
  </table>
  <h3>Journey 1 at a glance</h3>
  {flow([("02-onboarding","Pick modules"),"→",("09-onboarding-deadlines","Deadline + goal"),"→",("04-lesson","First lesson"),"→",("05-quiz-question","Quiz"),"→",("06-quiz-feedback","Feedback"),"→",("07-quiz-results","Passed")], 78)}
</section>

<section class="section">
  <h2><span class="n">2</span>Information architecture and wireframes</h2>
  <p>The bottom navigation becomes five short labels. <b>Logout moves into Me</b> so it can’t be tapped by mistake, and <b>Chats becomes module groups</b>.</p>
  <div class="ia">
    <div class="col"><b>Home</b>Continue card<br>Today’s goal<br>Streak (week view)<br>Next deadline</div>
    <div class="col"><b>Study</b>My modules (+ Add)<br>Module → chapter path<br>Lesson · Cards · Quiz<br>Chapter quiz · Mock exam<br>Review cards (due)</div>
    <div class="col"><b>Plan</b>Timetable<br>Study sessions<br>Assignment and exam dates<br>Reminders</div>
    <div class="col"><b>Chats</b>One group per joined module<br>Thread · pinned notice<br>Report · block<br>Notification setting</div>
    <div class="col"><b>Me</b>Profile · level<br>Daily goal · notifications<br>Privacy and data<br>Sign out<br><i>Admin (admins only)</i></div>
  </div>
</section>
<section class="section">
  <h3 style="margin-top:0">Wireframes</h3>
  <p>Low-fidelity wireframes show layout and hierarchy without colour or copy, so structure can be judged on its own. They are generated from the same screens, so they always match the high-fidelity design.</p>
  <div class="grid">
    {phone("02-onboarding","Onboarding · modules",104,"wire")}{phone("09-onboarding-deadlines","Onboarding · deadline",104,"wire")}{phone("01-dashboard","Home",104,"wire")}{phone("08-my-modules","My modules",104,"wire")}{phone("03-learning-path","Chapter path",104,"wire")}
    {phone("04-lesson","Lesson",104,"wire")}{phone("13-review-cards","Review cards",104,"wire")}{phone("05-quiz-question","Quiz",104,"wire")}{phone("06-quiz-feedback","Feedback",104,"wire")}{phone("07-quiz-results","Passed",104,"wire")}
    {phone("15-quiz-not-passed","Not passed",104,"wire")}{phone("10-chats-groups","Module groups",104,"wire")}{phone("11-group-thread","Group thread",104,"wire")}{phone("12-message-actions","Message actions",104,"wire")}{phone("14-me","Me",104,"wire")}
  </div>
</section>

<section class="section">
  <h2><span class="n">3</span>High-fidelity screens</h2>
  <p>Phone size 390 × 780. Notes explain the decisions; requirement ids refer to 02-requirements.md.</p>
  <h3>Before and after</h3>
  <div class="row" style="justify-content:space-between">
    <div style="text-align:center">{phone("current-04-dashboard-top.jpg","Home now",115)}{phone("01-dashboard","Home redesigned",115)}</div>
    <div style="text-align:center">{phone("current-14-quiz-question.jpg","Quiz now",115)}{phone("05-quiz-question","Quiz redesigned",115)}</div>
  </div>
  <p class="muted" style="font-size:9pt;margin-top:3mm">Now: stats first, the next step third and small; on phones the quiz Submit button sits under the nav bar next to Logout. Redesigned: the next step is the first thing you see, and quizzes open in focus mode.</p>
  <h3>Getting started</h3>
  {screen_block("02-onboarding","Onboarding · pick modules",REV,["Progress dots and Skip, so nobody feels trapped.","Search by code and course chips; tick several modules, then one Continue.","Student counts (from enrolments) as social proof."],"FR-12, FR-13")}
</section>
<section class="section">
  {screen_block("09-onboarding-deadlines","Onboarding · deadlines and daily goal",NEW,["Optional deadline per module feeds reminders and the Home nudge.","5 / 15 / 30 minutes sets the size of the daily goal.","Reminder time asked here, not with a red bell dot.","Ends with “Start my first lesson”: aim for a passed quiz within 10 minutes."],"FR-12, FR-52, FR-53")}
  {screen_block("01-dashboard","Home",REV,["Headline says what to do today.","Black Continue card: the first unlocked, unpassed topic (fixes the locked “Up next” bug).","Daily goal ring and a streak that shows the week.","One deadline nudge tied to progress. New bottom nav."],"FR-23, FR-51, FR-53")}
  {screen_block("08-my-modules","My modules",REV,["Progress ring and Next up on every card.","Leave moves into the ⋯ menu.","+ Add replaces the separate Browse tab."],"FR-11, FR-50")}
</section>
<section class="section">
  <h3>Studying</h3>
  {screen_block("03-learning-path","Chapter path",REV,["Chapter shown as a path: passed (✓ and score), one current node, locked “coming next”.","Lock reason in words: “Pass ‘Inverses’ to unlock”.","Chapter quiz is the trophy at the end."],"FR-54, BR-20")}
  {screen_block("04-lesson","Lesson",REV,["Reading progress bar and Read → Cards → Quiz steps.","Reading time, quiz size and learning outcomes up front.","Sticky bottom bar: cards and “I’m done reading”."],"FR-20, FR-24")}
  {screen_block("13-review-cards","Review cards (spaced repetition)",NEW,["A short daily review of cards that are due.","Again / Hard / Good / Easy schedules the next review (10 min to 7 days).","Counts towards the daily goal, so five minutes still keeps the streak."],"FR-41")}
</section>
<section class="section">
  <h3>Quizzes</h3>
  {screen_block("05-quiz-question","Quiz · focus mode",REV,["No bottom nav; ✕ exits and keeps answers.","Segmented progress shows right and wrong so far.","Scrap paper in the header; sticky Check answer; A–D letters."],"FR-31, FR-35, FR-36")}
  {screen_block("06-quiz-feedback","Answer feedback",REV,["“Not quite” with icon and colour (never colour alone).","Two-line explanation of the reasoning.","Link to the right part of the lesson, then one big button."],"FR-32")}
  {screen_block("07-quiz-results","Quiz passed",REV,["Celebration, score ring, gain over best score.","Shows what it unlocked, so locks feel like progress.","One main button (Next topic), one secondary."],"FR-34")}
</section>
<section class="section">
  {screen_block("15-quiz-not-passed","Quiz not passed",NEW,["Kind and specific: “1 more right answer would pass”.","Lists the topics to revise.","Review mistakes is the main action; trying again is second.","Reassures that the streak is safe (study counted)."],"FR-34, BR-20")}
  <h3>Module group chats</h3>
  {screen_block("10-chats-groups","Module groups",NEW,["One row per joined module, newest activity first.","Orange @ badge for mentions; counts for unread; muted groups dimmed.","Empty state explains that joining a module joins its group."],"FR-63, FR-64, FR-66")}
</section>
<section class="section">
  {screen_block("11-group-thread","Group thread",NEW,["Header shows members and an online count (from last-seen, not Pusher presence, which caps at 100).","Pinned notice from Tyro with the no-answer-sharing rule.","Replies, @mentions and Tyro links shown as lesson cards.","Image and voice note buttons as in today’s chat."],"FR-65, FR-6A, FR-69")}
  {screen_block("12-message-actions","Message actions",NEW,["Long-press a message: Reply, Copy, Report, Block.","Report is anonymous and goes to the admin moderation list.","Block hides that person’s messages for you in every group.","Short reminder of the academic integrity rule."],"FR-68, BR-75")}
  {screen_block("14-me","Me",NEW,["Profile, level, daily goal, notifications, privacy.","Sign out lives here, away from the main navigation.","Small stats row: streak, topics passed, XP."],"FR-05, FR-06")}
</section>

<section class="section">
  <h2><span class="n">4</span>Prototype</h2>
  <p>A clickable prototype of all 15 phone screens is saved next to this document as <b>business/prototype/index.html</b>. Open it in any browser: tap where you would in the app, use Back and Restart, and switch on <i>Show hotspots</i> to see what is tappable. It works offline and on a phone, so it can be used for usability testing straight away.</p>
  <div class="callout">The prototype is screen-to-screen only: no typing, animation or real data. That is enough to test whether people find the next step and understand each screen, which is what the first round of testing is for.</div>
  <h3>Flows wired in the prototype</h3>
  <p class="kicker" style="margin-top:3mm">Onboarding</p>
  {flow([("02-onboarding","Modules"),"→",("09-onboarding-deadlines","Deadline"),"→",("04-lesson","Lesson")], 70)}
  <p class="kicker">Daily study loop</p>
  {flow([("01-dashboard","Home"),"→",("04-lesson","Lesson"),"→",("13-review-cards","Cards"),"→",("05-quiz-question","Quiz"),"→",("06-quiz-feedback","Feedback"),"→",("07-quiz-results","Passed"),"↺",("15-quiz-not-passed","or not passed")], 64)}
  <p class="kicker">Module groups</p>
  {flow([("10-chats-groups","Groups"),"→",("11-group-thread","Thread"),"→",("12-message-actions","Report / block")], 70)}
  <table>
    <thead><tr><th>From</th><th>Tap</th><th>Goes to</th></tr></thead>
    <tr><td>Home</td><td>Continue lesson · deadline card · Study / Chats / Me</td><td>Lesson · My modules · tabs</td></tr>
    <tr><td>My modules</td><td>Continue on MAT1503</td><td>Chapter path</td></tr>
    <tr><td>Lesson</td><td>8 cards · I’m done reading · back</td><td>Review cards · Quiz · Chapter path</td></tr>
    <tr><td>Quiz, feedback, results · groups</td><td>Check answer · Got it · Next topic · MAT1503 row · a message</td><td>Next screen in the flow</td></tr>
  </table>
</section>

<section class="section">
  <h2><span class="n">5</span>Design system</h2>
  <p>The system is already in the code as CSS variables (<b>--neo-*</b> in src/app/globals.css) and in the mockups (<b>base.css</b>). This page is the reference for both, so new screens and components stay consistent.</p>
  <img class="wide" src="{IMG}design-system.jpg">
</section>
<section class="section">
  <h3 style="margin-top:0">Tokens</h3>
  <div class="two">
  <table><thead><tr><th>Token</th><th>Value</th><th>Use</th></tr></thead>
    <tr><td>--neo-text / ink</td><td><span class="swatch" style="background:#16181d"></span>#16181d</td><td>Text, primary buttons, current node</td></tr>
    <tr><td>--neo-muted</td><td><span class="swatch" style="background:#6b7280"></span>#6b7280</td><td>Secondary text on white</td></tr>
    <tr><td>--neo-border</td><td><span class="swatch" style="background:#e3e7ec"></span>#e3e7ec</td><td>Dividers, card outlines</td></tr>
    <tr><td>--neo-surface-soft</td><td><span class="swatch" style="background:#f4f6f8"></span>#f4f6f8</td><td>Chips, bar tracks</td></tr>
    <tr><td>--neo-accent</td><td><span class="swatch" style="background:#4cb2f5"></span>#4cb2f5</td><td>Progress, highlights on dark</td></tr>
    <tr><td>--neo-orange</td><td><span class="swatch" style="background:#ff6b3d"></span>#ff6b3d</td><td>Streak, mentions (icons)</td></tr>
    <tr><td>--neo-success</td><td><span class="swatch" style="background:#16a34a"></span>#16a34a</td><td>Correct, passed</td></tr>
    <tr><td>--neo-danger</td><td><span class="swatch" style="background:#e5484d"></span>#e5484d</td><td>Wrong, destructive</td></tr>
    <tr><td>--neo-tint-blue / mint / slate</td><td>#d6eafb · #dcefe6 · #e2e9ef</td><td>Stat and info cards</td></tr>
  </table>
  <table><thead><tr><th>Token</th><th>Value</th></tr></thead>
    <tr><td>Font</td><td>Urbanist 400–800 (next/font, self-hosted)</td></tr>
    <tr><td>Type scale</td><td>28 · 26 · 22 · 20 · 16 · 14 · 12 · 11 px</td></tr>
    <tr><td>Line height</td><td>1.15 headings · 1.45 UI · 1.65 lessons</td></tr>
    <tr><td>Radius</td><td>Cards 26 · options 18 · inputs 14 · pills 999</td></tr>
    <tr><td>Spacing</td><td>4-pt steps; gutter 16; card padding 16–20</td></tr>
    <tr><td>Elevation</td><td>Bars: 0 8px 24px −8px rgba(22,24,29,.2); cards flat</td></tr>
    <tr><td>Heights</td><td>Buttons 52 · inputs 46–48 · nav 68 · top bar 64</td></tr>
    <tr><td>Icons</td><td>Lucide, 2 px stroke, 20 px</td></tr>
    <tr><td>Motion</td><td>150–250 ms ease-out; respect prefers-reduced-motion</td></tr>
  </table>
  </div>
  <h3>Components</h3>
  <table><thead><tr><th style="width:22%">Component</th><th>Variants and states</th><th style="width:30%">In code</th></tr></thead>
    <tr><td>Button</td><td>Primary (ink) · white on dark · ghost · danger; disabled; loading</td><td>components/ui/button.tsx</td></tr>
    <tr><td>Card</td><td>Hero (ink) · outline · tint · flat (neo-flat)</td><td>components/ui/card.tsx</td></tr>
    <tr><td>Chip / tag</td><td>Neutral · selected · streak · XP · overline tag</td><td>components/ui/badge.tsx</td></tr>
    <tr><td>Answer option</td><td>Default · selected · correct · wrong · dimmed</td><td>quiz-runner.tsx (extract to ui/)</td></tr>
    <tr><td>Progress</td><td>Bar · segmented quiz bar · ring · path node (4 states)</td><td>New: ui/progress.tsx, ui/path-node.tsx</td></tr>
    <tr><td>Navigation</td><td>Top bar (streak chip, avatar) · bottom nav (5 items) · desktop sidebar</td><td>top-nav.tsx, mobile-nav.tsx</td></tr>
    <tr><td>Sheet</td><td>Bottom sheet: feedback, message actions, confirmations</td><td>New: ui/sheet.tsx (replaces alert/confirm)</td></tr>
    <tr><td>Message bubble</td><td>Mine · theirs · reply quote · link card · removed by moderator</td><td>chat/message-thread.tsx</td></tr>
    <tr><td>Input</td><td>Search pill · field with icon · date; focus ring; error text</td><td>components/ui/input.tsx</td></tr>
    <tr><td>Toast · skeleton</td><td>Success · error; skeleton cards instead of “Loading…”</td><td>ui/toast.tsx, ui/skeleton.tsx</td></tr>
  </table>
</section>

<section class="section">
  <h2><span class="n">6</span>Responsive layouts and accessibility</h2>
  <h3 style="margin-top:0">Breakpoints</h3>
  <table><thead><tr><th>Width</th><th>Layout</th><th>Navigation</th></tr></thead>
    <tr><td>360–639 px (phones)</td><td>One column, 16 px gutters, sticky bottom actions</td><td>Floating bottom nav; hidden in quizzes, lessons and threads</td></tr>
    <tr><td>640–1023 px (tablets)</td><td>Two-column cards; lesson text max 680 px</td><td>Bottom nav or top nav</td></tr>
    <tr><td>≥ 1024 px (desktop)</td><td>Sidebar · main · side panel (goal, deadlines, group mentions)</td><td>Left sidebar; desktop notepad stays</td></tr>
  </table>
  <img class="wide" src="{IMG}16-desktop-dashboard-hifi.jpg">
  <p class="muted" style="font-size:9pt;margin-top:2mm">Home at 1280 px <span class="st new">New 29 Oct</span>: the same Continue card and goal, with My modules and Coming up beside it instead of below.</p>
  <h3>Admin analytics (built, sample data)</h3>
  <img class="wide" src="{IMG}admin-analytics.jpg" style="max-height:120mm;object-fit:cover;object-position:top">
  <p class="muted" style="font-size:9pt;margin-top:2mm">/admin/analytics, added 29 October 2026 <span class="st built">Built</span>. Shown with test data. On phones the metric cards go two across and tables scroll inside their card.</p>
</section>
<section class="section">
  <h3 style="margin-top:0">Colour contrast (WCAG 2.2 AA)</h3>
  <p>Worked out from the actual token values. Text needs 4.5:1 (3:1 for large text); icons and field borders need 3:1.</p>
  <table><thead><tr><th>Pair</th><th>Colours</th><th>Ratio</th><th>Where</th><th>Result</th><th>Fix</th></tr></thead>{crow}</table>
  <h3>Accessibility checklist</h3>
  <table><thead><tr><th style="width:42%">Rule</th><th>Status and action</th></tr></thead>
    <tr><td>Pinch-zoom allowed (WCAG 1.4.4)</td><td class="bad">Fails today: remove <i>maximumScale: 1</i> and <i>userScalable: false</i> from src/app/layout.tsx (NFR-40)</td></tr>
    <tr><td>Never colour alone for right/wrong, locked, passed</td><td>Designed with icons and words on every state</td></tr>
    <tr><td>Touch targets ≥ 44 × 44 px; nothing under fixed bars</td><td>Buttons 52 px; bottom nav hidden in focus screens</td></tr>
    <tr><td>Keyboard and screen reader</td><td>Options are radio buttons in a fieldset; sheets trap focus and close with Esc; visible 2 px focus ring in ink</td></tr>
    <tr><td>Announce results</td><td>“Correct” / “Not quite” in an aria-live region</td></tr>
    <tr><td>Reduced motion</td><td>Confetti and ring animations off when prefers-reduced-motion is set</td></tr>
    <tr><td>Readable lessons</td><td>16 px body, 1.65 line height, max 70 characters a line, maths rendered as text not images</td></tr>
    <tr><td>Plain language</td><td>Short sentences; consistent words (“module” / “subject” by level)</td></tr>
    <tr><td>Text alternatives</td><td>Alt text for lesson images; transcripts for voice notes (later)</td></tr>
  </table>
</section>

<section class="section">
  <h2><span class="n">7</span>Usability testing</h2>
  <div class="callout">No usability test has been run on the redesign yet. This is the plan for the first round, using the clickable prototype, then a second round on the built screens.</div>
  <h3>Round 1 · prototype (before building)</h3>
  <table>
    <tr><th style="width:24%">Participants</th><td>6 UNISA students (mix of first- and second-year, at least 3 working part-time, at least 2 who study in their second language) plus 2 Grade 12 learners. Recruit from classmates and module WhatsApp groups.</td></tr>
    <tr><th>Format</th><td>30 minutes, remote (video call, screen share) or in person on the participant’s own phone. Think aloud. One facilitator, one note-taker.</td></tr>
    <tr><th>Incentive</th><td>Mobile data voucher (R50–R100).</td></tr>
    <tr><th>Consent</th><td>Short POPIA consent: what is recorded, kept for 90 days, used only to improve Tyro.</td></tr>
  </table>
  <h3>Tasks</h3>
  <table><thead><tr><th>#</th><th>Task (read to participant)</th><th>Success means</th><th>Journey</th></tr></thead>
    <tr><td>1</td><td>“You’ve just signed up. Set Tyro up for this semester.”</td><td>Picks 2 modules and a deadline, reaches the first lesson</td><td>J1</td></tr>
    <tr><td>2</td><td>“You have 10 minutes on the taxi. Carry on studying.”</td><td>Taps Continue on Home without help</td><td>J2</td></tr>
    <tr><td>3</td><td>“Finish reading and test yourself.”</td><td>Finds “I’m done reading”, then the quiz</td><td>J1</td></tr>
    <tr><td>4</td><td>“You got this question wrong. Why?”</td><td>Explains the reason from the feedback sheet</td><td>J1</td></tr>
    <tr><td>5</td><td>“What happens next after this result?”</td><td>Understands what was unlocked / what to revise</td><td>J1, J2</td></tr>
    <tr><td>6</td><td>“Ask your MAT1503 classmates for help.”</td><td>Opens Chats → MAT1503 group</td><td>J3</td></tr>
    <tr><td>7</td><td>“Someone is posting assignment answers. Deal with it.”</td><td>Long-presses and reports</td><td>J3</td></tr>
    <tr><td>8</td><td>“Sign out.”</td><td>Finds Sign out in Me</td><td>–</td></tr>
  </table>
  <h3>What we measure</h3>
  <table><thead><tr><th>Measure</th><th>How</th><th>Target</th></tr></thead>
    <tr><td>Task success</td><td>Completed without help</td><td>≥ 80% per task</td></tr>
    <tr><td>Ease per task</td><td>Single Ease Question (1–7) after each task</td><td>≥ 5.5 average</td></tr>
    <tr><td>Overall usability</td><td>System Usability Scale (10 questions) at the end</td><td>≥ 75</td></tr>
    <tr><td>Wording problems</td><td>Words participants misread or ask about</td><td>Fix every one seen twice</td></tr>
    <tr><td>Wrong taps</td><td>Taps on non-hotspots (note-taker)</td><td>Find the confusing spots</td></tr>
  </table>
  <h3>After launch</h3>
  <p>The analytics added on 29 October measure the same things at scale: activation (pass a quiz within 24 h), Day-1 and Day-7 return, and the funnel sign-up → module → lesson → quiz → pass. Compare two weeks before and after each redesigned screen ships, and run Round 2 on the built app with 5 new participants.</p>
</section>

<section class="section">
  <h2><span class="n">8</span>Handoff and next steps</h2>
  <table><thead><tr><th>#</th><th>Step</th><th>Owner</th><th>Effort</th></tr></thead>
    <tr><td>1</td><td>Run Round 1 usability testing with the prototype; update screens</td><td>Product</td><td>1 week</td></tr>
    <tr><td>2</td><td>Quick wins: zoom fix, Up Next fix, quiz focus mode, Logout → Me, pass/fail results</td><td>Dev</td><td>S (days)</td></tr>
    <tr><td>3</td><td>Contrast fixes: muted text on grey, locked text, orange chips, field borders</td><td>Dev</td><td>S</td></tr>
    <tr><td>4</td><td>Extract components: Sheet, Progress, PathNode, AnswerOption</td><td>Dev</td><td>M</td></tr>
    <tr><td>5</td><td>Onboarding, explanations per answer, chapter path, lesson steps</td><td>Dev</td><td>M each</td></tr>
    <tr><td>6</td><td>Review cards (spaced repetition) and daily goal</td><td>Dev</td><td>M–L</td></tr>
    <tr><td>7</td><td>Module group chats with moderation (later stage)</td><td>Dev</td><td>L</td></tr>
    <tr><td>8</td><td>Desktop layout (sidebar, side panel)</td><td>Dev</td><td>M</td></tr>
  </table>
  <h3>Files</h3>
  <table><thead><tr><th>File</th><th>What it is</th></tr></thead>
    <tr><td>business/03-ux-ui-design.pdf</td><td>This document</td></tr>
    <tr><td>business/prototype/index.html</td><td>Clickable prototype (15 screens, works offline)</td></tr>
    <tr><td>business/design/screens/</td><td>High-fidelity PNGs (phone 2×, desktop 1.5×)</td></tr>
    <tr><td>business/design/wireframes/</td><td>Wireframe PNGs</td></tr>
    <tr><td>business/design/source/</td><td>HTML/Python source for every screen (edit and re-render)</td></tr>
    <tr><td>docs/ux-review/</td><td>The 27 October UX review with current-app screenshots</td></tr>
  </table>
</section>
</body></html>"""
    (HERE / "doc.html").write_text(html)


async def pdf():
    from playwright.async_api import async_playwright
    async with async_playwright() as p:
        b = await p.chromium.launch()
        pg = await b.new_page()
        await pg.goto((HERE / "doc.html").as_uri(), wait_until="networkidle")
        await pg.evaluate("document.fonts.ready")
        await pg.pdf(path=str(HERE / "03-ux-ui-design.pdf"), format="A4", print_background=True,
                     display_header_footer=True,
                     header_template="<span></span>",
                     footer_template='<div style="font-size:7pt;color:#6b7280;width:100%;padding:0 14mm;display:flex;justify-content:space-between;font-family:sans-serif"><span>Tyro Study · UX/UI design and prototyping · 29 Oct 2026</span><span><span class="pageNumber"></span> / <span class="totalPages"></span></span></div>',
                     margin={"top": "16mm", "bottom": "16mm", "left": "14mm", "right": "14mm"})
        await b.close()

build()
asyncio.run(pdf())
print("pdf built")
