# Tyro Study design source

Every screen in `../screens`, `../wireframes`, `../../prototype/index.html` and `../../03-ux-ui-design.pdf` is generated from these files.

- `mock.py`: the 8 screens from the UX review (27 Oct 2026), same as `docs/ux-review/mockups/build.py`
- `screens2.py`: the 8 screens added on 29 Oct 2026 (onboarding deadlines, module groups, thread, message actions, review cards, Me, not passed, desktop home)
- `base.css`, `fonts.css`, `fonts/`: design tokens and the Urbanist font (and Flow Block for wireframes), both SIL Open Font License
- `render.py`: renders every screen to `out/` as hi-fi, annotated and wireframe PNGs
- `ds.py`: renders the design system sheet
- `proto.py` + `proto_template.html`: builds the clickable prototype (`out/prototype.html`)
- `doc.py`: builds the PDF (needs the images in `pdfimg/`)

To re-render after a change: `pip install playwright pillow`, then `python render.py && python ds.py && python proto.py`.
