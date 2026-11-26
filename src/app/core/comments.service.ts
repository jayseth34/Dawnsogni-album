import { Injectable, computed, inject, signal } from '@angular/core';
import { ContentService } from './content.service';

export interface SongComment { id: string; track: string; name: string; text: string; time: number; mine?: boolean }

const MINE = 'ds_mycomments';

@Injectable({ providedIn: 'root' })
export class CommentsService {
  private content = inject(ContentService);
  url = computed(() => (this.content.raw().commentsUrl || '').trim());
  enabled = computed(() => /^https:\/\/script\.google(usercontent)?\.com\//.test(this.url()));
  private cache = new Map<string, ReturnType<typeof signal<SongComment[] | null>>>();
  private mine = new Set<string>(JSON.parse(localStorage.getItem(MINE) || '[]'));

  /** Reactive list for a track; fetches on first use. null = loading. */
  list(track: string) {
    let s = this.cache.get(track);
    if (!s) { s = signal<SongComment[] | null>(null); this.cache.set(track, s); this.load(track); }
    return s;
  }

  async load(track: string) {
    const s = this.cache.get(track); if (!s || !this.enabled()) return;
    try {
      const r = await fetch(`${this.url()}?track=${encodeURIComponent(track)}&_=${Date.now()}`);
      const j = await r.json();
      s.set((j.comments || []).map((c: SongComment) => ({ ...c, mine: this.mine.has(c.id) })));
    } catch { if (s() === null) s.set([]); }
  }

  async post(track: string, name: string, text: string, website = ''): Promise<string | null> {
    try {
      // text/plain body → no CORS preflight (Apps Script can't answer one)
      const r = await fetch(this.url(), { method: 'POST', body: JSON.stringify({ track, name, text, website }) });
      const j = await r.json();
      if (!j.ok) return j.error || 'Could not post';
      if (j.comment) {
        this.mine.add(j.comment.id); localStorage.setItem(MINE, JSON.stringify([...this.mine]));
        const s = this.list(track); s.set([{ ...j.comment, mine: true }, ...(s() || [])]);
      }
      return null;
    } catch { return 'Network error — try again'; }
  }

  // ---- admin ----
  async all(url: string): Promise<SongComment[]> {
    const r = await fetch(`${url}?_=${Date.now()}`); const j = await r.json(); return j.comments || [];
  }
  async adminPost(url: string, body: object): Promise<any> {
    const r = await fetch(url, { method: 'POST', body: JSON.stringify(body) }); return r.json();
  }
}

export function ago(t: number): string {
  const s = Math.max(1, Math.round((Date.now() - t) / 1000));
  if (s < 60) return 'just now';
  const m = Math.round(s / 60); if (m < 60) return `${m}m`;
  const h = Math.round(m / 60); if (h < 24) return `${h}h`;
  const d = Math.round(h / 24); if (d < 30) return `${d}d`;
  return new Date(t).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
}
