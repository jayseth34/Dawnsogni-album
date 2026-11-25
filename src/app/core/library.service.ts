import { Injectable, computed, effect, signal } from '@angular/core';
import { HistoryItem, Playlist, Prefs, Profile } from './models';

/** Everything a listener saves lives on their own device (localStorage). */
function stored<T>(key: string, init: T) {
  let v = init;
  try {
    const s = localStorage.getItem('ds_' + key);
    if (s) { const p = JSON.parse(s); v = (Array.isArray(init) ? p : init && typeof init === 'object' ? { ...init, ...p } : p) as T; }
  } catch {}
  const sig = signal<T>(v);
  effect(() => { try { localStorage.setItem('ds_' + key, JSON.stringify(sig())); } catch {} });
  return sig;
}

@Injectable({ providedIn: 'root' })
export class LibraryService {
  readonly liked = stored<string[]>('liked', []);
  readonly saved = stored<string[]>('saved', []);
  readonly playlists = stored<Playlist[]>('playlists', []);
  readonly history = stored<HistoryItem[]>('history', []);
  readonly downloaded = stored<string[]>('downloaded', []);
  readonly reminders = stored<string[]>('reminders', []);
  readonly seconds = stored<Record<string, number>>('seconds', {});   // listening time per track
  readonly profile = stored<Profile>('profile', { name: '', avatar: '' });
  readonly prefs = stored<Prefs>('prefs', { autoplay: true, reduceMotion: false, showExplicit: true });

  readonly recent = computed(() => {
    const seen = new Set<string>(), out: string[] = [];
    for (const h of this.history()) if (!seen.has(h.trackId)) { seen.add(h.trackId); out.push(h.trackId); }
    return out;
  });

  constructor() {
    effect(() => document.documentElement.classList.toggle('reduce-motion', this.prefs().reduceMotion));
  }

  toggle(list: 'liked' | 'saved' | 'reminders', id: string) {
    const s = this[list]; s.set(s().includes(id) ? s().filter((x) => x !== id) : [id, ...s()]);
    return s().includes(id);
  }
  isLiked = (id: string) => this.liked().includes(id);
  isSaved = (id: string) => this.saved().includes(id);

  logPlay(trackId: string) { this.history.set([{ trackId, at: Date.now() }, ...this.history()].slice(0, 500)); }
  addTime(trackId: string, sec: number) { const s = { ...this.seconds() }; s[trackId] = (s[trackId] || 0) + sec; this.seconds.set(s); }
  clearHistory() { this.history.set([]); this.seconds.set({}); }

  createPlaylist(name: string, trackIds: string[] = []) {
    const p: Playlist = { id: 'pl-' + Math.random().toString(36).slice(2, 8), name: name.trim() || 'My playlist', trackIds, created: Date.now() };
    this.playlists.set([p, ...this.playlists()]); return p;
  }
  addToPlaylist(pid: string, trackId: string) {
    this.playlists.set(this.playlists().map((p) => p.id === pid && !p.trackIds.includes(trackId) ? { ...p, trackIds: [...p.trackIds, trackId] } : p));
  }
  removeFromPlaylist(pid: string, trackId: string) { this.playlists.set(this.playlists().map((p) => p.id === pid ? { ...p, trackIds: p.trackIds.filter((t) => t !== trackId) } : p)); }
  renamePlaylist(pid: string, name: string) { this.playlists.set(this.playlists().map((p) => p.id === pid ? { ...p, name } : p)); }
  deletePlaylist(pid: string) { this.playlists.set(this.playlists().filter((p) => p.id !== pid)); }

  /* Offline downloads: the audio file is stored in the browser's cache. */
  async download(trackId: string, url: string) {
    const cache = await caches.open('ds-audio');
    const res = await fetch(url); if (!res.ok) throw new Error('Download failed');
    await cache.put(url, res);
    if (!this.downloaded().includes(trackId)) this.downloaded.set([trackId, ...this.downloaded()]);
  }
  async removeDownload(trackId: string, url: string) {
    try { (await caches.open('ds-audio')).delete(url); } catch {}
    this.downloaded.set(this.downloaded().filter((x) => x !== trackId));
  }
  async offlineUrl(url: string): Promise<string | null> {
    try { const r = await (await caches.open('ds-audio')).match(url); return r ? URL.createObjectURL(await r.blob()) : null; } catch { return null; }
  }
}
