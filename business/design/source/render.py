import asyncio, re
from pathlib import Path
import mock, screens2
HERE = Path(__file__).parent
OUT = HERE / "out"; OUT.mkdir(exist_ok=True)
WF = """<style>*{font-family:"Flow Block",sans-serif!important;box-shadow:none!important;letter-spacing:0!important}
body{filter:grayscale(1) contrast(.55) brightness(1.18)}.pin{display:none!important}</style>"""
def clean(html): return re.sub(r'<span class="pin"[^>]*>\d+</span>', '', html)
PHONE = {**mock.PAGES, **screens2.NEW_PAGES}
async def main():
    from playwright.async_api import async_playwright
    async with async_playwright() as p:
        b = await p.chromium.launch()
        ctx = await b.new_context(viewport={"width": 390, "height": 780}, device_scale_factor=2)
        pg = await ctx.new_page()
        for name, html in PHONE.items():
            for variant, h in [("hifi", clean(html)), ("annotated", html), ("wire", clean(html).replace("</head>", WF + "</head>"))]:
                f = HERE / f"_{name}-{variant}.html"; f.write_text(h)
                await pg.goto(f.as_uri()); await pg.evaluate("document.fonts.ready")
                await pg.screenshot(path=str(OUT / f"{name}-{variant}.png"))
        ctx2 = await b.new_context(viewport={"width": 1280, "height": 800}, device_scale_factor=1.5)
        pg2 = await ctx2.new_page()
        for name, html in screens2.DESKTOP_PAGES.items():
            f = HERE / f"_{name}.html"; f.write_text(html)
            await pg2.goto(f.as_uri()); await pg2.evaluate("document.fonts.ready")
            await pg2.screenshot(path=str(OUT / f"{name}-hifi.png"))
        await b.close()
asyncio.run(main())
print("ok", len(list(OUT.glob("*.png"))))
