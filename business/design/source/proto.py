import asyncio, json, base64, io, re
from pathlib import Path
from PIL import Image
HERE=Path(__file__).parent
NAV={"home":"01-dashboard","study":"08-my-modules","plan":None,"chats":"10-chats-groups","me":"14-me"}
# (screen, [(locator kind, value, target)])
LINKS={
 "02-onboarding":[("text","Continue with 2 modules","09-onboarding-deadlines")],
 "09-onboarding-deadlines":[("text","Start my first lesson","04-lesson")],
 "01-dashboard":[("text","Continue lesson","04-lesson"),("text","Assignment 2 due in 5 days","08-my-modules"),("nav",None,None)],
 "08-my-modules":[("textn","Continue",0,"03-learning-path"),("nav",None,None)],
 "03-learning-path":[("text","Inverses; Rules of Arithmetic","04-lesson"),("nav",None,None)],
 "04-lesson":[("text","done reading","05-quiz-question"),("text","8 cards","13-review-cards"),("text","Chapter 1","03-learning-path")],
 "13-review-cards":[("text","Good","05-quiz-question")],
 "05-quiz-question":[("text","Check answer","06-quiz-feedback")],
 "06-quiz-feedback":[("text","Got it, next question","07-quiz-results")],
 "07-quiz-results":[("text","Next topic","01-dashboard"),("text","Review my 2 mistakes","06-quiz-feedback")],
 "15-quiz-not-passed":[("text","Review my 4 mistakes","06-quiz-feedback"),("text","Try the quiz again","05-quiz-question")],
 "10-chats-groups":[("text","Linear Algebra I","11-group-thread"),("nav",None,None)],
 "11-group-thread":[("text","Thanks! So for a","12-message-actions"),("css",".row svg >> nth=0","10-chats-groups")],
 "12-message-actions":[("text","Report message","11-group-thread"),("text","Reply","11-group-thread")],
 "14-me":[("nav",None,None)],
}
async def main():
    from playwright.async_api import async_playwright
    spots={}
    async with async_playwright() as p:
        b=await p.chromium.launch(); pg=await b.new_page(viewport={"width":390,"height":780})
        for name,links in LINKS.items():
            await pg.goto((HERE/f"_{name}-hifi.html").as_uri()); await pg.evaluate("document.fonts.ready")
            out=[]
            for l in links:
                if l[0]=="nav":
                    items=await pg.query_selector_all(".nav a")
                    for el,key in zip(items,NAV):
                        if NAV[key] and NAV[key]!=name:
                            bb=await el.bounding_box(); out.append([bb["x"],bb["y"],bb["width"],bb["height"],NAV[key]])
                    continue
                if l[0]=="textn": loc=pg.get_by_text(l[1],exact=True).nth(l[2]); tgt=l[3]
                elif l[0]=="css": loc=pg.locator(l[1]); tgt=l[2]
                else: loc=pg.get_by_text(l[1]).first; tgt=l[2]
                bb=await loc.bounding_box()
                if not bb: print("MISSING",name,l); continue
                pad=8; out.append([bb["x"]-pad,bb["y"]-pad,bb["width"]+2*pad,bb["height"]+2*pad,tgt])
            spots[name]=out
        await b.close()
    imgs={}
    order=["02-onboarding","09-onboarding-deadlines","01-dashboard","08-my-modules","03-learning-path","04-lesson","13-review-cards","05-quiz-question","06-quiz-feedback","07-quiz-results","15-quiz-not-passed","10-chats-groups","11-group-thread","12-message-actions","14-me"]
    for n in order:
        im=Image.open(HERE/f"out/{n}-hifi.png").convert("RGB"); buf=io.BytesIO(); im.save(buf,"JPEG",quality=86)
        imgs[n]="data:image/jpeg;base64,"+base64.b64encode(buf.getvalue()).decode()
    titles={"02-onboarding":"Onboarding: pick modules","09-onboarding-deadlines":"Onboarding: deadlines and goal","01-dashboard":"Home","08-my-modules":"My modules","03-learning-path":"Chapter path","04-lesson":"Lesson","13-review-cards":"Review cards","05-quiz-question":"Quiz question","06-quiz-feedback":"Answer feedback","07-quiz-results":"Quiz passed","15-quiz-not-passed":"Quiz not passed","10-chats-groups":"Module groups","11-group-thread":"MAT1503 group","12-message-actions":"Message actions","14-me":"Me"}
    html=open(HERE/"proto_template.html").read().replace("__DATA__",json.dumps({"imgs":imgs,"spots":spots,"order":order,"titles":titles}))
    (HERE/"out/prototype.html").write_text(html); print("prototype", len(html)//1024, "KB"); json.dump(spots,open(HERE/"spots.json","w"))
asyncio.run(main())
