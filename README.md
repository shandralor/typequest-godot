# TypeQuest

A gamified touch-typing tutor for kids (ages 6+), disguised as a branching fantasy
gamebook. The child reads and **types** unfolding Flemish (Belgian Dutch, AZERTY)
prose to reveal a lightly-navigable 3D story, and types a choice word to pick forks.
The teaching mechanism is the VOLUME of motivated, real typing -- not drills.

Built with **Three.js + TypeScript** on CC0 / royalty-free art and music (see credits
below).

## Layout

| path | what |
| --- | --- |
| `web/` | **the game.** Three.js + TypeScript + Vite. This is where the work happens. |
| `assets/` | the shared art + music store (both trees read it). |
| `godot/` | the earlier **Godot 4** implementation, kept for REFERENCE only -- see `godot/README.md`. |
| `docs/` | the briefs, handoffs, and `working-context.md` (the live state + next step). |

## Run

```bash
cd web
npm install
npm run dev        # play          -> http://localhost:5173/
npm run editor     # scene editor  -> http://localhost:5173/editor.html   (or ./editor.sh)
npm run test       # unit tests
npm run typecheck
```

## Status

Playable: a hex-island overworld the hero walks between adventures, five scenarios plus
a wake-up intro, forks, an on-screen keyboard with per-finger guidance driven by the
keyboard-layout axis, scoring, cumulative cross-run progress, and streaming music.
`docs/working-context.md` has the current state; `web/docs/` has the editor blueprint
and the rendering playbook.

## Credits

TypeQuest is built on the wonderful work of these creators. Please go support them.

### 3D art -- KayKit by Kay Lousberg
CC0. https://www.kaylousberg.com -- the Knight (hero), dungeon, forest, skeletons,
hexagon overworld, and the tool/resource/weapon bits.

### UI art -- Kenney
CC0. https://www.kenney.nl -- *UI Pack: RPG expansion* (panels, buttons, bars).

### Music -- AlkaKrab
Royalty-free / copyright-free. https://alkakrab.itch.io -- *50 Fantasy Open World
RPG Tracks*. Excellent game music, free to use in commercial projects; we credit to
send exposure their way.

Full asset-by-asset attribution is in [`CREDITS.md`](CREDITS.md).

## License

TypeQuest's own code and content are licensed under the **PolyForm Noncommercial
License 1.0.0** (see [`LICENSE.md`](LICENSE.md)): free to use, modify, and share
for any purpose EXCEPT commercial. This is source-available, not OSI "open source"
(that term forbids a no-commercial-use restriction).

The bundled art, fonts, and music are NOT ours and keep their own, more permissive
licenses -- the 3D and UI art are CC0, the fonts are OFL 1.1, the music is
royalty-free. See [`CREDITS.md`](CREDITS.md) and the per-pack `License.txt` files.
The noncommercial term applies to *TypeQuest* (the code + game); it does not and
cannot restrict those CC0/OFL assets.
