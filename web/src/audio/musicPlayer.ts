// Background music: a crossfading, shuffled playlist per CONTEXT. Faithful port of
// audio/music_player.gd, with the two differences a browser forces:
//
//   * Tracks STREAM. Godot preloads its folder; here each track is an <audio> element with
//     preload="none" pointing at /audio/music/<context>/, so nothing is fetched until it
//     plays and the 38 MB of music never blocks the game loading.
//   * Browsers refuse to play audio before the user has interacted with the page. A context
//     asked for too early is remembered and started on the first keypress or click.
//
// Volumes are linear here rather than Godot's dB: -9 dB ~ 0.35, silence ~ 0.

import { TRACKS } from "./tracks.generated";

const FADE = 1.5; // crossfade seconds
const MUSIC_VOL = 0.35; // playing volume (music sits under the game)

/**
 * Per-context behaviour, mirroring the Godot CONTEXT_CONFIG:
 *   start      -- filename that plays FIRST every time this context starts
 *   shuffle    -- shuffle the rest of the playlist
 *   introSkip  -- seconds to seek into the first track so its silent intro is skipped
 */
const CONTEXT_CONFIG: Record<string, { start?: string; shuffle?: boolean; introSkip?: number }> = {
  menu: { start: "01 - Quiet Menu.ogg", shuffle: true, introSkip: 5.0 },
  overworld: { shuffle: true },
  adventure: { shuffle: true },
};

function shuffle<T>(arr: T[]): void {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
}

export class MusicPlayer {
  private a = new Audio();
  private b = new Audio();
  private active: HTMLAudioElement;
  private context = "";
  private playlist: string[] = [];
  private idx = 0;
  private fades = new Map<HTMLAudioElement, number>();
  /** a context requested before the browser allowed sound */
  private blocked = "";
  private unlocked = false;
  private muted = false;

  constructor() {
    for (const el of [this.a, this.b]) {
      el.preload = "none"; // stream: nothing is fetched until it plays
      el.volume = 0;
      el.addEventListener("ended", () => this.onEnded(el));
    }
    this.active = this.a;
  }

  /**
   * Call once from a real user gesture. Until this lands, contexts are remembered but silent
   * (browsers block audio before an interaction).
   */
  unlock(): void {
    if (this.unlocked) return;
    this.unlocked = true;
    if (this.blocked) {
      const c = this.blocked;
      this.blocked = "";
      this.context = ""; // force a real start
      this.playContext(c);
    }
  }

  setMuted(muted: boolean): void {
    this.muted = muted;
    if (muted) {
      this.stopFade(this.a);
      this.stopFade(this.b);
      this.a.volume = 0;
      this.b.volume = 0;
      this.a.pause();
      this.b.pause();
    } else if (this.context) {
      const c = this.context;
      this.context = "";
      this.playContext(c);
    }
  }

  /** Fade to a track for `context`. No-op if that context is already playing. */
  playContext(context: string): void {
    if (context === this.context) return;
    this.context = context;
    if (this.muted) return;
    if (!this.unlocked) {
      this.blocked = context; // start it on the first gesture
      return;
    }
    const cfg = CONTEXT_CONFIG[context] ?? {};
    this.playlist = [...(TRACKS[context] ?? [])];
    if (this.playlist.length === 0) {
      this.fadeOut(this.active); // no tracks for this context -> silence, never an error
      return;
    }
    if (cfg.shuffle !== false) shuffle(this.playlist);
    // an explicit start track jumps to the front (played first every time)
    if (cfg.start) {
      const i = this.playlist.findIndex((p) => p.endsWith("/" + cfg.start));
      if (i > 0) this.playlist.unshift(this.playlist.splice(i, 1)[0]);
    }
    this.idx = 0;
    this.crossfadeTo(this.playlist[0], cfg.introSkip ?? 0);
  }

  private crossfadeTo(src: string, seek = 0): void {
    const incoming = this.active === this.a ? this.b : this.a;
    const outgoing = this.active;
    incoming.src = src;
    incoming.volume = 0;
    incoming.currentTime = 0;
    // play() FIRST: with preload="none" the browser fetches nothing until asked, so waiting on
    // loadedmetadata before playing would wait forever. The intro skip is applied once the
    // metadata arrives (we need the duration to know the seek is inside the track).
    if (seek > 0) {
      const applySeek = (): void => {
        if (Number.isFinite(incoming.duration) && seek < incoming.duration) incoming.currentTime = seek;
      };
      if (incoming.readyState >= 1) applySeek();
      else incoming.addEventListener("loadedmetadata", applySeek, { once: true });
    }
    void incoming.play().catch(() => {
      // autoplay refused after all: wait for the next gesture
      this.unlocked = false;
      this.blocked = this.context;
    });
    this.fadeTo(incoming, MUSIC_VOL);
    this.fadeTo(outgoing, 0, () => outgoing.pause());
    this.active = incoming;
  }

  private fadeOut(el: HTMLAudioElement): void {
    this.fadeTo(el, 0, () => el.pause());
  }

  private stopFade(el: HTMLAudioElement): void {
    const h = this.fades.get(el);
    if (h !== undefined) window.clearInterval(h);
    this.fades.delete(el);
  }

  /** Linear volume ramp over FADE seconds (the browser has no tween). */
  private fadeTo(el: HTMLAudioElement, target: number, done?: () => void): void {
    this.stopFade(el);
    const step = 1 / 30;
    const from = el.volume;
    let t = 0;
    const h = window.setInterval(() => {
      t += step;
      const k = Math.min(1, t / FADE);
      el.volume = Math.max(0, Math.min(1, from + (target - from) * k));
      if (k >= 1) {
        this.stopFade(el);
        done?.();
      }
    }, step * 1000);
    this.fades.set(el, h);
  }

  private onEnded(el: HTMLAudioElement): void {
    // only the active track advances the playlist; a faded-out player was paused, not ended
    if (el !== this.active || this.playlist.length === 0) return;
    this.idx = (this.idx + 1) % this.playlist.length;
    this.crossfadeTo(this.playlist[this.idx]);
  }
}
