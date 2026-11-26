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
| 1. Hero | 3D robot bust (glowing eyes, antenna, chest core) | Name and title |
| 2. Globe | Spinning sphere | "Reviewing AI training data" · "Working remotely" |
| 3. Location | Outline of the Philippines, extruded | Based in the Philippines |
| 4. About | Drifting ribbons | Professional summary |
| 5. Experience | 3D annotation cuboids | Data Annotation Reviewer; Technical Assistant / OJT |
| 6. Education | 3D graduation cap | BSIT (Digital Arts); NC III in Digital Arts (TESDA) |
| 7. Skills | 3D network with four hubs | The four skill groups |
| 8. Areas of work | Faint wisp + card strip | Five focus areas |
| 9. Contact | Frame around the email | artmalong123@gmail.com |

- The scroll choreography is in `src/scroll/timeline.ts`. Shape order there (`SHAPE`) must match the `shapes` array in `src/main.ts`.
- **3D models** are in `src/particles/models.ts`: the robot and cap are signed distance functions, and `sampleSdf` scatters particles over their surfaces. The cuboids and network are procedural 3D point sets.
- **Hover:** every model turns toward the cursor (`hoverYaw` / `hoverPitch` in `config.ts`). Set a shape's `tilt: 0` in `src/main.ts` to keep it fixed, as the card wisp and contact frame are. Each shape's `offset` places it beside its text and is applied after the turn, so it turns in place.
- Other shapes (sphere, ribbons, wisp, frame, image sampler for the map) are in `src/particles/shapes.ts`.
- Visual tuning (point count, size, noise, mouse repulsion) is in `src/particles/config.ts`.

## Still to swap

| What | Where |
|---|---|
| Card images (abstract covers) | `public/works/work-1.svg` … `work-5.svg`: any 4:3 image, e.g. your artwork |
| Card titles / tags | `src/sections/data.ts` |

The Philippines outline in `public/philippines.svg` is hand-approximated, not cartographically accurate.
