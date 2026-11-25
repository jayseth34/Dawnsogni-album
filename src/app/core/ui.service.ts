import { Injectable, signal } from '@angular/core';

export const fmt = (s: number) => (isFinite(s) && s > 0 ? `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}` : '0:00');
export const fmtLong = (s: number) => {
  if (!s) return '';
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = Math.round(s % 60);
  return h ? `${h} hr ${m} min` : `${m} min ${sec} sec`;
};
export function countdown(target: Date | null, now: number) {
  if (!target) return null;
  let s = Math.max(0, Math.floor((target.getTime() - now) / 1000));
  if (!s) return null;
  const d = Math.floor(s / 86400); s -= d * 86400; const h = Math.floor(s / 3600); s -= h * 3600; const m = Math.floor(s / 60); s -= m * 60;
  return { d, h, m, s };
}

/* Lyrics: plain text or synced with [mm:ss.xx] stamps; [Section] lines become small labels. */
export interface LyricLine { t: number | null; text: string; tag: boolean; gap: boolean; }
const TS = /^\s*\[(\d+):(\d+(?:\.\d+)?)\]\s?(.*)$/;
export function parseLyrics(text?: string): { synced: boolean; lines: LyricLine[] } {
  const raw = String(text || '').replace(/\r/g, '').split('\n').map((l) => { const m = l.match(TS); return m ? { t: +m[1] * 60 + +m[2], text: m[3] } : { t: null, text: l }; });
  const st = raw.filter((l) => l.t !== null).length, synced = st > 0 && st >= raw.filter((l) => l.text.trim()).length * 0.6;
  return {
    synced,
    lines: (synced ? raw.filter((l) => l.t !== null) : raw).map((l) => {
      const t = l.text.trim(), tag = /^\[.*\]$/.test(t);
      return { t: l.t, text: tag ? t.slice(1, -1) : t, tag, gap: !t };
    })
  };
}

export interface MenuState { trackId: string; x: number; y: number; }

@Injectable({ providedIn: 'root' })
export class UiService {
  readonly toastMsg = signal('');
  readonly menu = signal<MenuState | null>(null);
  readonly picker = signal<string | null>(null);   // track id waiting for a playlist choice
  private t: any;

  toast(m: string) { this.toastMsg.set(m); clearTimeout(this.t); this.t = setTimeout(() => this.toastMsg.set(''), 2400); }

  openMenu(trackId: string, ev: MouseEvent) {
    ev.stopPropagation();
    const b = (ev.currentTarget as HTMLElement).getBoundingClientRect();
    const x = Math.max(8, Math.min(b.right - 240, innerWidth - 248));
    let y = b.bottom + 6; if (y + 340 > innerHeight) y = Math.max(8, b.top - 346);
    this.menu.set({ trackId, x, y });
  }

  async share(title: string, path: string) {
    const url = location.href.split('#')[0] + '#' + path;
    try {
      if (navigator.share) { await navigator.share({ title, url }); return; }
      await navigator.clipboard.writeText(url); this.toast('Link copied');
    } catch {}
  }
}
