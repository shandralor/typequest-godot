# TypeQuest

A gamified touch-typing tutor for kids (ages 6+), disguised as a branching fantasy
gamebook. The child reads and **types** unfolding Flemish (Belgian Dutch, AZERTY)
prose to reveal a lightly-navigable 3D story, and types a choice word to pick forks.
The teaching mechanism is the VOLUME of motivated, real typing -- not drills.

Built with **Godot 4** on CC0 / royalty-free art and music (see credits below).

## Status

Playable proof-of-concept: a hex-island overworld where the knight walks between
adventures, two short scenarios (a forest quest and a sword-grinding song), an
on-screen keyboard with finger guidance, a progressive reveal window, scoring, and
background music. See `docs/godot-handoff.md` for the full implementation guide and
`docs/working-context.md` for the current state.

## Run

```bash
godot --path .            # play (Godot 4.7)
bash tests/run.sh         # headless test suite
```

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

Code is open source (license TBD). Bundled art/music are CC0 or royalty-free per the
credits above; their respective terms apply to those assets.
