# Art Nathaniel Malong — Portfolio

Personal portfolio for Art Nathaniel Malong: Data Annotation Reviewer, Digital Artist and IT Specialist.

A minimal black-theme site in plain HTML, CSS and JavaScript (no build step, no dependencies). Each section has a 3D ASCII figure that is ray-marched live in the browser and morphs as you scroll:

| Section    | Figure            |
| ---------- | ----------------- |
| Hero       | Robot head        |
| About      | Open hand         |
| Experience | Pointing hand     |
| Education  | Graduation cap    |
| Skills     | Pencil            |
| Contact    | Waving hand       |

## Run locally

Open `index.html` in a browser, or serve the folder:

```bash
python3 -m http.server 8000
```

Then visit http://localhost:8000

## Files

- `index.html` – page content; each section picks its figure with `data-shape="..."`
- `styles.css` – black minimalist theme and responsive layout
- `script.js` – mobile nav, scroll progress line, fade-in on scroll
- `ascii-hand.js` – the ASCII 3D renderer: shapes (`robotSdf`, `handSdf`, `capSdf`, `pencilSdf`) and the `SHAPES` list of per-section angles and zoom
