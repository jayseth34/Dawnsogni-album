import { Injectable, computed, inject, signal } from '@angular/core';
import { ContentService, rawUrl } from './content.service';
import { LibraryService } from './library.service';
import { Track, ViewRelease } from './models';

export const PREVIEW_SECONDS = 30;
export type Repeat = 'off' | 'all' | 'one';

@Injectable({ providedIn: 'root' })
export class PlayerService {
  private content = inject(ContentService);
  private lib = inject(LibraryService);
  readonly audio = new Audio();

  readonly queue = signal<string[]>([]);       // track ids
  readonly index = signal(-1);
  readonly playing = signal(false);
  readonly time = signal(0);
  readonly duration = signal(0);
  readonly shuffle = signal(false);
  readonly repeat = signal<Repeat>('off');
  readonly open = signal(false);                // full-screen player
  readonly peaks = signal<number[]>([]);

  readonly current = computed(() => { const id = this.queue()[this.index()]; return id ? this.content.track(id) : null; });
  readonly isPreview = computed(() => { const c = this.current(); return !!c && !this.content.isFull(c.t, c.r); });
  /** Progress window: full track, or the 30s preview window. */
  readonly start = computed(() => (this.isPreview() ? this.current()!.t.previewStart || 0 : 0));
  readonly length = computed(() => (this.isPreview() ? Math.min(PREVIEW_SECONDS, Math.max(0, this.duration() - this.start())) || PREVIEW_SECONDS : this.duration()));
  readonly pos = computed(() => Math.max(0, this.time() - this.start()));
  readonly progress = computed(() => (this.length() ? Math.min(1, this.pos() / this.length()) : 0));

  private lastTick = 0;
  private peakCache: Record<string, number[]> = {};

  constructor() {
    const a = this.audio; a.preload = 'auto';
    a.addEventListener('play', () => this.playing.set(true));
    a.addEventListener('pause', () => this.playing.set(false));
    a.addEventListener('loadedmetadata', () => { this.duration.set(a.duration || 0); if (this.start()) a.currentTime = this.start(); });
    a.addEventListener('timeupdate', () => {
      this.time.set(a.currentTime);
      const c = this.current(); const now = performance.now();
      if (c && !a.paused && this.lastTick) this.lib.addTime(c.t.id, Math.min(2, (now - this.lastTick) / 1000));
      this.lastTick = now;
      if (this.isPreview() && a.currentTime >= this.start() + this.length()) this.ended();
    });
    a.addEventListener('ended', () => this.ended());
    a.addEventListener('error', () => { const alt = !a.dataset['raw'] && rawUrl(a.src); if (alt) { a.dataset['raw'] = '1'; a.src = alt; a.play().catch(() => {}); } });
    if ('mediaSession' in navigator) {
      navigator.mediaSession.setActionHandler('play', () => a.play());
      navigator.mediaSession.setActionHandler('pause', () => a.pause());
      navigator.mediaSession.setActionHandler('previoustrack', () => this.prev());
      navigator.mediaSession.setActionHandler('nexttrack', () => this.next());
    }
  }

  /** Play a list of track ids starting at one of them. */
  playList(ids: string[], startId?: string, shuffle = false): void {
    ids = ids.filter((id) => this.content.track(id) && !this.content.isLocked(this.content.track(id)!.r));
    if (!ids.length) return;
    if (shuffle) { ids = [...ids].sort(() => Math.random() - 0.5); this.shuffle.set(true); }
    this.queue.set(ids);
    this.load(Math.max(0, startId ? ids.indexOf(startId) : 0));
  }
  playRelease(r: ViewRelease, startId?: string, shuffle = false) { this.playList(r.tracks.map((t) => t.id), startId, shuffle); }
  isCurrent = (id: string) => this.current()?.t.id === id;
  isPlayingRelease = (r: ViewRelease) => this.playing() && !!this.current() && this.current()!.r.id === r.id;

  toggle(): void { if (!this.current()) return; this.audio.paused ? this.audio.play().catch(() => {}) : this.audio.pause(); }
  next(): void {
    const q = this.queue(); if (!q.length) return;
    if (this.shuffle() && q.length > 1) { let n; do { n = Math.floor(Math.random() * q.length); } while (n === this.index()); this.load(n); return; }
    if (this.index() < q.length - 1) { this.load(this.index() + 1); return; }
    if (this.repeat() === 'all') { this.load(0); return; }
    this.audio.pause(); this.audio.currentTime = this.start();
  }
  prev(): void { if (this.pos() > 3) { this.audio.currentTime = this.start(); return; } this.load(Math.max(0, this.index() - 1)); }
  seek(frac: number) { if (this.length()) this.audio.currentTime = this.start() + frac * this.length(); }
  cycleRepeat() { this.repeat.set(this.repeat() === 'off' ? 'all' : this.repeat() === 'all' ? 'one' : 'off'); }

  addToQueue(id: string): void { if (!this.queue().length) { this.playList([id]); return; } this.queue.set([...this.queue(), id]); }
  playNext(id: string): void { if (!this.queue().length) { this.playList([id]); return; } const q = [...this.queue()]; q.splice(this.index() + 1, 0, id); this.queue.set(q); }
  removeAt(i: number): void {
    if (i === this.index()) return; const q = [...this.queue()]; q.splice(i, 1); this.queue.set(q);
    if (i < this.index()) this.index.set(this.index() - 1);
  }
  move(i: number, d: number) {
    const j = i + d, q = [...this.queue()]; if (j < 0 || j >= q.length) return;
    [q[i], q[j]] = [q[j], q[i]]; this.queue.set(q);
    if (this.index() === i) this.index.set(j); else if (this.index() === j) this.index.set(i);
  }
  jump(i: number) { this.load(i); }

  private ended(): void {
    if (this.repeat() === 'one') { this.audio.currentTime = this.start(); this.audio.play().catch(() => {}); return; }
    if (this.lib.prefs().autoplay) this.next(); else this.audio.pause();
  }

  private async load(i: number) {
    this.index.set(i);
    const c = this.current(); if (!c) return;
    const a = this.audio; delete a.dataset['raw'];
    this.time.set(0); this.duration.set(c.t.duration || 0); this.lastTick = 0;
    const offline = this.lib.downloaded().includes(c.t.id) ? await this.lib.offlineUrl(c.t.audio) : null;
    a.src = offline || c.t.audio;
    a.play().catch(() => {});
    this.lib.logPlay(c.t.id);
    this.loadPeaks(c.t);
    if ('mediaSession' in navigator) {
      const cover = c.r.displayCover;
      navigator.mediaSession.metadata = new MediaMetadata({
        title: this.content.title(c.t, c.r), artist: this.content.raw().artist.name, album: c.r.displayTitle,
        artwork: cover ? [{ src: new URL(cover, location.href).href, sizes: '1500x1500', type: 'image/jpeg' }] : []
      });
    }
  }

  /** Real waveform peaks from the audio file (cached per track). */
  private async loadPeaks(t: Track): Promise<void> {
    const N = 72;
    if (this.peakCache[t.id]) { this.peaks.set(this.peakCache[t.id]); return; }
    let h = 7; for (const ch of t.id) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
    this.peaks.set(Array.from({ length: N }, (_, i) => { h = (h * 1103515245 + 12345) >>> 0; return 0.25 + (((h >>> 8) % 1000) / 1000) * 0.7 * (0.6 + 0.4 * Math.sin(i / 6)); }));
    try {
      let res = await fetch(t.audio); if (!res.ok && rawUrl(t.audio)) res = await fetch(rawUrl(t.audio)!);
      const AC = (window as any).AudioContext || (window as any).webkitAudioContext, ctx = new AC();
      const ab = await res.arrayBuffer();
      const buf: AudioBuffer = await new Promise((ok, no) => { const p = ctx.decodeAudioData(ab, ok, no); if (p?.then) p.then(ok, no); });
      const d = buf.getChannelData(0), step = Math.floor(d.length / N), out: number[] = [];
      for (let b = 0; b < N; b++) { let m = 0; for (let i = b * step; i < (b + 1) * step; i += 96) m = Math.max(m, Math.abs(d[i])); out.push(m); }
      const mx = Math.max(...out, 0.01); this.peakCache[t.id] = out.map((v) => 0.1 + (v / mx) * 0.9);
      if (this.current()?.t.id === t.id) this.peaks.set(this.peakCache[t.id]);
      ctx.close?.();
    } catch {}
  }
}
