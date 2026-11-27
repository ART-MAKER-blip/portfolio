# Art Nathaniel Malong — Portfolio

Portfolio for Art Nathaniel Malong: Data Annotation Reviewer, Digital Artist and IT Specialist.

A single-page, scroll-driven WebGL site. One fixed Three.js canvas holds a particle system that morphs between shapes as you scroll, while HTML text scrolls over it.

**Stack:** Vite + TypeScript, Three.js, GSAP + ScrollTrigger, Lenis.

## Run locally

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # typecheck + production build into dist/
npm run preview    # serve the production build
```

Deploys to Vercel with `npx vercel deploy --prod` (settings in `vercel.json`).

## Stages

| Stage | Particle shape | Content |
|---|---|---|
| 1. Hero | Interactive floating 3D laptop: code types itself out; your keystrokes press its keys and add code; click for a burst | "Hi, I'm Art Nathaniel Malong"; letters assemble and disintegrate with the scroll |
| 2. Globe | Spinning sphere | "Front-end developer" · "2D & 3D data annotation" |
| 3. Location | Outline of the Philippines, extruded | Based in the Philippines |
| 3b. Zoom | Map zooms into Mindanao, pin on Cagayan de Oro | Cagayan de Oro, Mindanao |
| 4. About me | Drifting ribbons | Front-end, Python/Java/Go, 2D & 3D data annotation, Bash, cloud |
| 5. Education | 3D graduation cap | BSIT (Digital Arts); NC III in Digital Arts (TESDA) |
| 6. Skills | 3D network | Front-end, programming, Bash & cloud, data annotation, digital arts |
| 7. Areas of work | Faint wisp + card strip | Five particle-art cards |
| 8. Contact | Frame around the email | artmalong123@gmail.com |

- The scroll choreography is in `src/scroll/timeline.ts`. Shape order there (`SHAPE`) must match the `shapes` array in `src/main.ts`.
- **3D models** are in `src/particles/models.ts`: the cap, the earlier mannequin and robot busts are signed distance functions; the hero laptop (`laptopCode`) is a procedural point set; and `sampleSdf` scatters particles over their surfaces. The network is a procedural 3D point set. The CDO zoom (`zoomMap` in `shapes.ts`) scales the map's own particles outward from Cagayan de Oro and turns some of them into a pin.
- **Hover:** every model turns toward the cursor (`hoverYaw` / `hoverPitch` in `config.ts`). Set a shape's `tilt: 0` in `src/main.ts` to keep it fixed, as the card wisp and contact frame are. Each shape's `offset` places it beside its text and is applied after the turn, so it turns in place.
- **Interactive laptop:** `src/sections/laptop.ts` drives typing progress and key presses; the shader hides untyped code, makes the newest characters glow and pushes pressed keys down (per-point `aReveal` / `aKey` data from `laptopCode`).
- Other shapes (sphere, ribbons, wisp, frame, image sampler for the map) are in `src/particles/shapes.ts`.
- Visual tuning (point count, size, noise, mouse repulsion) is in `src/particles/config.ts`.

## Still to swap

| What | Where |
|---|---|
| Card titles, tags and image descriptions | `src/sections/data.ts` |

The Philippines outline in `public/philippines.svg` is hand-approximated, not cartographically accurate.

## Card illustrations

The five "Areas of work" images are particle drawings in the same style as the robot: 3D point clouds of a monitor with bounding boxes, a drawing tablet, design layers, a browser window with a </> tag, and a terminal syncing to a cloud. To change or regenerate them:

```bash
node scripts/work-art.mjs /tmp/work-art
for i in 1 2 3 4 5; do
  rsvg-convert -w 800 -h 600 /tmp/work-art/work-$i.svg -o /tmp/work-art/work-$i.png
  magick /tmp/work-art/work-$i.png -quality 82 public/works/work-$i.webp
done
```
