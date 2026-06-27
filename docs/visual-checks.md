# Visual-check pass

Graphics drive this game (each story node renders a 3D scene), so "does it compile and
pass tests" is not enough. Anything that adds or moves something on screen -- a UI panel,
a HUD element, a scene actor, a prop, a camera or placement tweak -- gets a quick visual
pass before it is called done: **does it make sense, and is it placed well?**

This pass caught real issues that tests could not: a log panel overlapping the title, the
knight riding off the dirt path onto the grass, and a skeleton lunging while it was still
several steps away from the hero.

## How to run it

```
npm run dev      # start the dev server (http://localhost:5173)
npm run shots    # capture the default scene matrix -> .shots/contact-sheet.png
```

Open `.shots/contact-sheet.png` and eyeball it. The default matrix walks every band-1
scene at a few progress points (knight on the path, the bridge crossing, the chest
arrival, the skeleton's approach and lunge).

`.shots/` is gitignored -- these are throwaway working images, never committed.

## Targeting a specific thing

Two dev affordances in `app/main.ts` make scenes deterministic to shoot:

- `?node=<id>` loads any story node directly (`start`, `kruispunt`, `grot`, `brug`, `schat`).
- `?progress=<0..1>` freezes locomotion at that progress, so you can frame an exact moment
  (e.g. the skeleton lunge fires at `p > 0.9`).

Pass query strings as args to override the matrix:

```
npm run shots -- "?node=grot&progress=0.92" "?node=brug&progress=0.5"
```

Knobs via env: `SHOTS_BASE`, `SHOTS_VIEWPORT` ("w,h"), `SHOTS_WAIT` (ms before capture --
raise it to let animation play further before the frame is grabbed).

## Notes

- Requires headless chromium (via `npx playwright`) and ImageMagick `montage` for the
  contact sheet. Without `montage` the individual PNGs are still written.
- Vary the wait time across runs when checking animation timing: a single frame can hide a
  pose that only reads wrong mid-motion.
