import { Injectable, computed, signal } from '@angular/core';
import { Release, ReleaseStatus, SiteContent, Track, ViewRelease } from './models';

/** Where the site is hosted (GitHub Pages) — used to read the freshest content straight from the repo. */
const onPages = location.hostname.endsWith('.github.io');
export const OWNER = onPages ? location.hostname.split('.')[0] : 'jayseth34';
export const REPO = onPages ? location.pathname.split('/')[1] || 'dawnsogni-album' : 'dawnsogni-album';
export const BRANCH = 'gh-pages';
const RAW = `https://raw.githubusercontent.com/${OWNER}/${REPO}/${BRANCH}/`;

/** A file uploaded seconds ago may not be on Pages yet — fall back to GitHub directly. */
export function rawUrl(u: string): string | null {
  try {
    const x = new URL(u, location.href), i = x.pathname.indexOf('/media/');
    return i >= 0 && x.origin === location.origin ? RAW + x.pathname.slice(i + 1) : null;
  } catch { return null; }
}

export const EMPTY: SiteContent = { artist: { name: 'Dawn Sogni', tagline: 'A different frequency' }, releases: [] };
const ORDER: ReleaseStatus[] = ['teaser', 'announced', 'upcoming', 'released'];

@Injectable({ providedIn: 'root' })
export class ContentService {
  readonly raw = signal<SiteContent>(EMPTY);
  readonly loaded = signal(false);
  readonly now = signal(Date.now());
  readonly unlocked = signal<string[]>(JSON.parse(localStorage.getItem('ds_unlocked') || '[]'));

  constructor() {
    this.load();
    setInterval(() => this.now.set(Date.now()), 1000);
  }

  async load() {
    let c: SiteContent | null = null;
    try {
      const r = await fetch(`https://api.github.com/repos/${OWNER}/${REPO}/contents/content.json?ref=${BRANCH}&t=${Date.now()}`,
        { headers: { Accept: 'application/vnd.github.raw+json' }, cache: 'no-store' });
      if (r.ok) c = await r.json();
    } catch {}
    if (!c) { try { c = await (await fetch('content.json?v=' + Date.now(), { cache: 'no-store' })).json(); } catch {} }
    this.raw.set(normalize(c));
    this.loaded.set(true);
  }

  /** Published releases with their effective stage, newest first. */
  readonly releases = computed<ViewRelease[]>(() => {
    const now = this.now();
    return this.raw().releases.filter((r) => r.published).map((r) => view(r, now))
      .sort((a, b) => (b.date?.getTime() || 0) - (a.date?.getTime() || 0));
  });
  readonly out = computed(() => this.releases().filter((r) => r.stage === 'released'));
  readonly upcoming = computed(() => this.releases().filter((r) => r.stage !== 'released')
    .sort((a, b) => (a.date?.getTime() || Infinity) - (b.date?.getTime() || Infinity)));
  readonly featured = computed(() => this.releases().find((r) => r.featured) || this.out()[0] || this.upcoming()[0] || null);

  /** Every track that can be played right now (fully or as a preview), with its release. */
  readonly tracks = computed(() => this.releases().flatMap((r) => r.showTracklist ? r.tracks.map((t) => ({ t, r })) : []));
  track(id: string) { return this.tracks().find((x) => x.t.id === id) || null; }
  release(id: string) { return this.releases().find((r) => r.id === id) || null; }

  /** Track titles stay hidden while a release is only a teaser. */
  title(t: Track, r: ViewRelease) { return r.stage === 'teaser' ? `Preview ${r.tracks.indexOf(t) + 1}` : t.title; }

  /** Can this track be played in full right now? (otherwise a 30s preview) */
  isFull(t: Track, r: ViewRelease) { return r.stage === 'released' || !!t.unlocked; }
  isLocked(r: ViewRelease) { return !!r.exclusive && !!r.accessHash && !this.unlocked().includes(r.id); }
  async unlock(r: ViewRelease, code: string) {
    const h = await sha256(code.trim().toLowerCase());
    if (h !== r.accessHash) return false;
    const u = [...this.unlocked(), r.id]; this.unlocked.set(u); localStorage.setItem('ds_unlocked', JSON.stringify(u));
    return true;
  }
}

export async function sha256(s: string) {
  const b = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s));
  return [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, '0')).join('');
}

function normalize(c: any): SiteContent {
  if (!c) return EMPTY;
  const out: SiteContent = {
    artist: { ...EMPTY.artist, ...(c.artist || {}) },
    shopUrl: c.shopUrl || c.brand?.shopUrl || '', instagram: c.instagram || c.brand?.instagram || '',
    releases: Array.isArray(c.releases) ? c.releases : []
  };
  // older format: a flat list of songs → one single per song
  if (!out.releases.length && Array.isArray(c.songs)) {
    out.releases = c.songs.filter((s: any) => s.audio && s.title).map((s: any) => ({
      id: s.id, title: s.title, type: 'Single', status: 'released', published: true,
      releaseDate: s.date || s.releaseDate || '', cover: s.cover || '', tracks: [{ id: s.id + '-t', title: s.title, audio: s.audio, lyrics: s.lyrics || '' }]
    }));
  }
  out.releases.forEach((r) => { r.tracks = r.tracks || []; r.credits = r.credits || []; });
  return out;
}

function view(r: Release, now: number): ViewRelease {
  const date = r.releaseDate ? new Date(r.releaseDate.length <= 10 ? r.releaseDate + 'T00:00:00' : r.releaseDate) : null;
  let stage = r.status || 'released';
  // once the release date has passed, announced/upcoming projects go OUT NOW automatically
  if (date && date.getTime() <= now && (stage === 'announced' || stage === 'upcoming')) stage = 'released';
  const teaser = stage === 'teaser';
  return {
    ...r, stage, date, year: date ? String(date.getFullYear()) : '',
    displayTitle: teaser ? (r.teaserText ? 'Untitled project' : 'Something is coming') : r.title,
    displayCover: teaser ? (r.teaserArt || '') : (r.cover || r.teaserArt || ''),
    showTracklist: ORDER.indexOf(stage) >= ORDER.indexOf('upcoming') || (teaser && r.tracks.some((t) => t.previewStart != null)),
    totalDuration: r.tracks.reduce((s, t) => s + (t.duration || 0), 0)
  };
}
