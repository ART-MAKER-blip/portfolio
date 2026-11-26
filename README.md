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
| 1. Hero | Head-and-shoulders silhouette | Name and title |
| 2. Globe | Spinning sphere | "Reviewing AI training data" · "Working remotely" |
| 3. Location | Outline of the Philippines | Based in the Philippines |
| 4. About | Drifting ribbons | Professional summary |
| 5. Experience | Annotation bounding boxes | Data Annotation Reviewer; Technical Assistant / OJT |
| 6. Education | Graduation cap | BSIT (Digital Arts); NC III in Digital Arts (TESDA) |
| 7. Skills | Network with four hubs | The four skill groups |
| 8. Areas of work | Faint wisp + card strip | Five focus areas |
| 9. Contact | Frame around the email | artmalong123@gmail.com |

- The scroll choreography is in `src/scroll/timeline.ts`. Shape order there (`SHAPE`) must match the `shapes` array in `src/main.ts`.
- Procedural shapes (`boxes`, `network`, sphere, ribbons, wisp, frame) are in `src/particles/shapes.ts`. The silhouette, map and cap are sampled from images in `public/`.
- Visual tuning (point count, size, noise, mouse repulsion) is in `src/particles/config.ts`.

## Still to swap

| What | Where |
|---|---|
| Portrait silhouette (generic placeholder) | `public/silhouette.png`: any transparent PNG/SVG. A cut-out photo of yourself works well. |
| Card images (abstract covers) | `public/works/work-1.svg` … `work-5.svg`: any 4:3 image, e.g. your artwork |
| Card titles / tags | `src/sections/data.ts` |

The Philippines outline in `public/philippines.svg` is hand-approximated, not cartographically accurate.
