import { Component, computed, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { BRANCH, OWNER, REPO, sha256 } from '../core/content.service';
import { Release, ReleaseStatus, ReleaseType, SiteContent, Track } from '../core/models';

declare const DSMedia: any;
const MAXB = 45 * 1024 * 1024;
const uid = (p: string) => p + '-' + Math.random().toString(36).slice(2, 8);
const TYPES: ReleaseType[] = ['Album', 'EP', 'Single', 'Deluxe'];
const STATUSES: [ReleaseStatus, string][] = [['teaser', 'Teaser — mystery art, previews, tracklist hidden'], ['announced', 'Announced — title, artwork, date, credits, pre-save'],
  ['upcoming', 'Upcoming — tracklist revealed, previews, countdown'], ['released', 'Released — OUT NOW, everything playable']];

@Component({
  selector: 'ds-admin', standalone: true, imports: [RouterLink],
  template: `
  <div class="adm">
    <header class="adm-bar">
      <a routerLink="/" class="adm-logo"><img src="assets/ds-logo-dark.png" alt="" /><span>Admin</span></a>
      <span class="adm-status" [class.dirty]="dirty()">{{ busy().size ? 'Processing files…' : dirty() ? 'Unsaved changes' : connected() ? 'All changes published' : '' }}</span>
      <a href="#/" target="_blank" class="abtn ghost">View site ↗</a>
      <button class="abtn red" [disabled]="!dirty() || busy().size > 0 || publishing()" (click)="publish()">{{ publishing() ? 'Publishing…' : 'Publish' }}</button>
    </header>

    @if (!connected()) {
      <section class="acard connect">
        <h2>Connect to GitHub</h2>
        <p class="hint">Publishing writes to your repository and the site updates instantly. Create a
          <a href="https://github.com/settings/personal-access-tokens/new" target="_blank" rel="noopener">fine-grained token</a>
          with access to <b>only {{ repo }}</b> and <b>Contents: Read and write</b>. It's stored only in this browser.</p>
        <form class="arow" (submit)="connect($event)"><input name="tok" type="password" placeholder="github_pat_…" autocomplete="off" [value]="token" /><button class="abtn red">Connect</button></form>
        @if (err()) { <p class="aerr">{{ err() }}</p> }
      </section>
    } @else {
    <div class="adm-grid">
      <aside class="adm-side">
        <button class="abtn red full" (click)="newRelease()">+ New release</button>
        <button class="rel-item" [class.on]="sel() === 'settings'" (click)="sel.set('settings')"><b>Artist & settings</b><small>Name, tagline, links</small></button>
        @for (r of d().releases; track r.id) {
          <button class="rel-item" [class.on]="sel() === r.id" (click)="sel.set(r.id)">
            <img [src]="src(r.cover || r.teaserArt)" alt="" onerror="this.style.visibility='hidden'" />
            <div><b>{{ r.title || 'Untitled' }}</b><small>{{ r.type }} · {{ statusLabel(r.status) }}{{ r.published ? '' : ' · hidden' }}{{ r.featured ? ' · ★' : '' }}</small></div>
          </button>
        }
        <p class="hint small">Signed in to {{ owner }}/{{ repo }} · <a href="javascript:void 0" (click)="forget()">sign out</a></p>
      </aside>

      <main class="adm-main">
        @if (sel() === 'settings') {
          <section class="acard">
            <h2>Artist & settings</h2>
            <div class="g2">
              <label>Artist name<input [value]="d().artist.name" (input)="d().artist.name = v($event); touch()" /></label>
              <label>Tagline<input [value]="d().artist.tagline || ''" (input)="d().artist.tagline = v($event); touch()" placeholder="A different frequency" /></label>
              <label>Shop link<input [value]="d().shopUrl || ''" (input)="d().shopUrl = v($event); touch()" /></label>
              <label>Instagram link<input [value]="d().instagram || ''" (input)="d().instagram = v($event); touch()" /></label>
            </div>
          </section>
        } @else if (rel(); as r) {
          <section class="acard">
            <div class="ahead"><h2>{{ r.title || 'New release' }}</h2>
              <label class="sw"><input type="checkbox" [checked]="r.published" (change)="r.published = c($event); touch()" /><i></i>{{ r.published ? 'Published' : 'Hidden' }}</label>
              <label class="sw"><input type="checkbox" [checked]="!!r.featured" (change)="setFeatured(r, c($event))" /><i></i>Featured on Home</label>
            </div>
            <div class="g3">
              <label>Title<input [value]="r.title" (input)="r.title = v($event); touch()" placeholder="Album / EP / single name" /></label>
              <label>Type<select (change)="r.type = $any(v($event)); touch()">@for (t of types; track t) { <option [value]="t" [selected]="r.type === t">{{ t === 'Deluxe' ? 'Deluxe edition' : t }}</option> }</select></label>
              <label>Release date & time<input type="datetime-local" [value]="r.releaseDate || ''" (input)="r.releaseDate = v($event); touch()" /></label>
            </div>
            <label>Release status<select (change)="r.status = $any(v($event)); touch()">@for (s of statuses; track s[0]) { <option [value]="s[0]" [selected]="r.status === s[0]">{{ s[1] }}</option> }</select></label>
            <p class="hint small">Announced and Upcoming releases switch to <b>Out now</b> automatically when the release date arrives.</p>
            <label>Description<textarea rows="3" (input)="r.description = v($event); touch()">{{ r.description || '' }}</textarea></label>
            <label>Teaser text (shown during the Teaser stage)<input [value]="r.teaserText || ''" (input)="r.teaserText = v($event); touch()" placeholder="Something is coming…" /></label>
            <div class="g2">
              <div class="upl"><span>Album artwork</span>
                <div class="upl-row">@if (r.cover) { <img [src]="src(r.cover)" alt="" /> }
                  <label class="abtn ghost sm">{{ r.cover ? 'Replace' : 'Upload' }}<input type="file" accept="image/*" hidden (change)="pick($event, r, 'cover')" /></label>
                  @if (r.cover) { <button class="abtn ghost sm" (click)="r.cover = ''; touch()">Remove</button> }
                  <small>{{ note(r.id + '.cover', r.cover) }}</small></div></div>
              <div class="upl"><span>Teaser artwork</span>
                <div class="upl-row">@if (r.teaserArt) { <img [src]="src(r.teaserArt)" alt="" /> }
                  <label class="abtn ghost sm">{{ r.teaserArt ? 'Replace' : 'Upload' }}<input type="file" accept="image/*" hidden (change)="pick($event, r, 'teaserArt')" /></label>
                  @if (r.teaserArt) { <button class="abtn ghost sm" (click)="r.teaserArt = ''; touch()">Remove</button> }
                  <small>{{ note(r.id + '.teaserArt', r.teaserArt) }}</small></div></div>
            </div>

            <h3>Credits</h3>
            @for (cr of r.credits; track $index; let i = $index) {
              <div class="arow"><input [value]="cr.role" (input)="cr.role = v($event); touch()" placeholder="Role (Producer, Mixing, Feat…)" />
                <input [value]="cr.name" (input)="cr.name = v($event); touch()" placeholder="Name" />
                <button class="abtn ghost sm" (click)="r.credits!.splice(i, 1); touch()">✕</button></div>
            }
            <button class="abtn ghost sm" (click)="r.credits!.push({ role: '', name: '' }); touch()">+ Add credit</button>

            <h3>Exclusive</h3>
            <label class="sw"><input type="checkbox" [checked]="!!r.exclusive" (change)="r.exclusive = c($event); touch()" /><i></i>Locked with an access code</label>
            @if (r.exclusive) {
              <label>Access code {{ r.accessHash ? '(set — type a new one to change)' : '' }}<input (change)="setCode(r, v($event))" placeholder="e.g. NIGHTSHIFT" /></label>
            }
          </section>

          <section class="acard">
            <div class="ahead"><h2>Tracks</h2><button class="abtn red sm" (click)="addTrack(r)">+ Add track</button></div>
            <p class="hint small">Drag order with ↑ ↓. Audio is compressed automatically (a video dropped in becomes audio). Duration is read from the file.</p>
            @for (t of r.tracks; track t.id; let i = $index) {
              <details class="tcard" [open]="openTrack() === t.id" (toggle)="onToggle($event, t.id)">
                <summary><span class="tn">{{ i + 1 }}</span><b>{{ t.title || 'Untitled track' }}</b>
                  @if (t.explicit) { <span class="exp">E</span> }<small>{{ fmt(t.duration) }}{{ t.audio ? '' : ' · no audio' }}</small>
                  <span class="spacer"></span>
                  <button class="abtn ghost xs" (click)="move(r, i, -1, $event)">↑</button><button class="abtn ghost xs" (click)="move(r, i, 1, $event)">↓</button>
                  <button class="abtn ghost xs" (click)="delTrack(r, i, $event)">✕</button></summary>
                <div class="tbody">
                  <label>Title<input [value]="t.title" (input)="t.title = v($event); touch()" /></label>
                  <div class="upl"><span>Audio</span>
                    <div class="upl-row">@if (t.audio && !busy().has(t.id + '.audio')) { <audio controls preload="none" [src]="src(t.audio)"></audio> }
                      @if (!busy().has(t.id + '.audio')) { <label class="abtn ghost sm">{{ t.audio ? 'Replace' : 'Upload audio' }}<input type="file" accept="audio/*,video/*" hidden (change)="pick($event, t, 'audio')" /></label> }
                      <small>{{ note(t.id + '.audio', t.audio) }}</small></div></div>
                  <div class="g3">
                    <label class="sw"><input type="checkbox" [checked]="!!t.explicit" (change)="t.explicit = c($event); touch()" /><i></i>Explicit</label>
                    <label class="sw"><input type="checkbox" [checked]="!!t.unlocked" (change)="t.unlocked = c($event); touch()" /><i></i>Out before release (single)</label>
                    <label class="sw"><input type="checkbox" [checked]="!!t.featured" (change)="t.featured = c($event); touch()" /><i></i>Featured track</label>
                  </div>
                  <div class="g2">
                    <label>Preview starts at (seconds)<input type="number" min="0" [value]="t.previewStart ?? ''" (input)="t.previewStart = num($event); touch()" placeholder="e.g. 45" /></label>
                    <label>Credits<input [value]="t.credits || ''" (input)="t.credits = v($event); touch()" placeholder="Prod. … · Written by …" /></label>
                  </div>
                  <label>Lyrics <small class="hint">— plain, or synced with [mm:ss.xx] at the start of lines</small><textarea rows="8" (input)="t.lyrics = v($event); touch()">{{ t.lyrics || '' }}</textarea></label>
                </div>
              </details>
            } @empty { <p class="hint">No tracks yet.</p> }
          </section>

          <button class="abtn ghost danger" (click)="delRelease(r)">Delete this release</button>
        }

        @if (log().length) {
          <section class="acard log"><h3>Publishing</h3><ol>@for (l of log(); track $index) { <li [class]="l.c">{{ l.m }}</li> }</ol></section>
        }
      </main>
    </div>
    }
  </div>`
})
export class Admin {
  owner = OWNER; repo = REPO; types = TYPES; statuses = STATUSES;
  token = localStorage.getItem('dsadmin_token') || '';
  connected = signal(false); err = signal(''); dirty = signal(false); publishing = signal(false);
  rev = signal(0); sel = signal<string>('settings'); openTrack = signal('');
  busy = signal(new Map<string, string>());
  log = signal<{ m: string; c: string }[]>([]);
  private data: SiteContent = { artist: { name: 'Dawn Sogni', tagline: 'A different frequency' }, releases: [] };
  private pending = new Map<string, File>(); private previews = new Map<string, string>(); private blobs = new Map<string, { path: string; sha: string }>();
  d = computed(() => { this.rev(); return this.data; });
  rel = computed(() => this.d().releases.find((r) => r.id === this.sel()) || null);

  constructor() {
    if (this.token) this.connect();
    addEventListener('beforeunload', (e) => { if (this.dirty()) { e.preventDefault(); (e as any).returnValue = ''; } });
    if (!(window as any).DSMedia) { const s = document.createElement('script'); s.src = 'media.js'; document.head.append(s); }
  }

  v = (e: Event) => (e.target as HTMLInputElement).value;
  c = (e: Event) => (e.target as HTMLInputElement).checked;
  num = (e: Event) => { const x = (e.target as HTMLInputElement).value; return x === '' ? undefined : Math.max(0, +x); };
  touch() { this.dirty.set(true); this.rev.update((n) => n + 1); }
  fmt = (s?: number) => (s ? `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, '0')}` : '–:––');
  statusLabel = (s: string) => ({ teaser: 'Teaser', announced: 'Announced', upcoming: 'Upcoming', released: 'Released' } as any)[s] || s;
  src = (v?: string) => (!v ? '' : v.startsWith('pending:') ? this.previews.get(v.slice(8)) || '' : v);
  note(key: string, v?: string) {
    if (this.busy().has(key)) return this.busy().get(key)!;
    if (v?.startsWith('pending:')) return `${this.pending.get(v.slice(8))?.name} — uploads when you publish`;
    return v ? '' : 'No file';
  }

  /* ---------- GitHub ---------- */
  private async gh(path: string, opts: RequestInit = {}) {
    const res = await fetch(`https://api.github.com/repos/${OWNER}/${REPO}${path}`, { ...opts, headers: { Authorization: `Bearer ${this.token}`, Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28' } });
    const body = res.status === 204 ? null : await res.json().catch(() => null);
    if (!res.ok) { const e: any = new Error(body?.message || res.statusText); e.status = res.status; throw e; }
    return body;
  }
  async connect(e?: Event) {
    if (e) { e.preventDefault(); this.token = ((e.target as HTMLFormElement).elements.namedItem('tok') as HTMLInputElement).value.trim(); }
    if (!this.token) return;
    this.err.set('');
    try {
      const repo = await this.gh('');
      if (repo.permissions && !repo.permissions.push) { this.err.set("This token can't write to the repository."); return; }
      localStorage.setItem('dsadmin_token', this.token);
      const res = await fetch(`https://api.github.com/repos/${OWNER}/${REPO}/contents/content.json?ref=${BRANCH}&t=${Date.now()}`,
        { headers: { Authorization: `Bearer ${this.token}`, Accept: 'application/vnd.github.raw+json' }, cache: 'no-store' });
      if (res.ok) this.data = migrate(await res.json());
      else if (res.status !== 404) throw new Error('Could not read content.json (' + res.status + ')');
      this.connected.set(true); this.rev.update((n) => n + 1);
      if (this.data.releases[0]) this.sel.set(this.data.releases[0].id);
    } catch (er: any) { this.err.set(er.status === 401 ? 'Token rejected — check it and try again.' : 'Error: ' + er.message); }
  }
  forget() { localStorage.removeItem('dsadmin_token'); location.reload(); }

  /* ---------- Releases & tracks ---------- */
  newRelease() {
    const r: Release = { id: uid('rel'), title: '', type: 'Single', status: 'announced', published: false, releaseDate: '', description: '', cover: '', teaserArt: '', credits: [], tracks: [] };
    this.data.releases.unshift(r); this.sel.set(r.id); this.touch();
  }
  delRelease(r: Release) { if (!confirm(`Delete “${r.title || 'this release'}” and all its tracks?`)) return; this.data.releases = this.data.releases.filter((x) => x !== r); this.sel.set('settings'); this.touch(); }
  setFeatured(r: Release, on: boolean) { this.data.releases.forEach((x) => (x.featured = false)); r.featured = on; this.touch(); }
  async setCode(r: Release, code: string) { if (!code.trim()) return; r.accessHash = await sha256(code.trim().toLowerCase()); this.touch(); }
  addTrack(r: Release) { const t: Track = { id: uid('trk'), title: '', audio: '', lyrics: '' }; r.tracks.push(t); this.openTrack.set(t.id); this.touch(); }
  delTrack(r: Release, i: number, e: Event) { e.preventDefault(); if (confirm('Delete this track?')) { r.tracks.splice(i, 1); this.touch(); } }
  move(r: Release, i: number, dlt: number, e: Event) { e.preventDefault(); const j = i + dlt; if (j < 0 || j >= r.tracks.length) return; [r.tracks[i], r.tracks[j]] = [r.tracks[j], r.tracks[i]]; this.touch(); }
  onToggle(e: Event, id: string) { if ((e.target as HTMLDetailsElement).open) this.openTrack.set(id); }

  /* ---------- Files: optimise, then hold until publish ---------- */
  private setBusy(key: string, text: string | null) { const m = new Map(this.busy()); text == null ? m.delete(key) : m.set(key, text); this.busy.set(m); }
  async pick(e: Event, obj: any, field: string) {
    const input = e.target as HTMLInputElement, f = input.files?.[0]; input.value = ''; if (!f) return;
    const key = `${obj.id}.${field}`;
    try {
      let out: File;
      if (field === 'audio') {
        const M = (window as any).DSMedia;
        const prog = (p: number, l?: string) => this.setBusy(key, `${l || 'Processing'}… ${Math.round(p * 100)}%`);
        this.setBusy(key, 'Optimising audio…');
        out = !M ? f : M.isVideo(f) ? await M.extractAudio(f, prog) : await M.audio(f, prog);
        obj.duration = Math.round(await audioDuration(out));
        if (!obj.title) obj.title = f.name.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ');
      } else {
        this.setBusy(key, 'Optimising image…');
        out = (window as any).DSMedia ? await (window as any).DSMedia.image(f) : f;
      }
      if (out.size > MAXB) throw new Error(`This file is ${(out.size / 1048576).toFixed(0)} MB even after compressing — the limit is 45 MB.`);
      const id = Math.random().toString(36).slice(2, 10);
      this.pending.set(id, out); this.previews.set(id, URL.createObjectURL(out));
      obj[field] = 'pending:' + id; this.touch();
    } catch (er: any) { alert(er.message || String(er)); }
    finally { this.setBusy(key, null); this.rev.update((n) => n + 1); }
  }

  /* ---------- Publish: all files + content.json in ONE commit ---------- */
  private addLog(m: string, c = '') { this.log.set([...this.log(), { m, c }]); }
  private async blob(content: string, label: string) {
    let last: any;
    for (let a = 1; a <= 3; a++) {
      try { return (await this.gh('/git/blobs', { method: 'POST', body: JSON.stringify({ content, encoding: 'base64' }) })).sha as string; }
      catch (e: any) { last = e; if (e.status && e.status < 500 && e.status !== 408 && e.status !== 429) break; this.addLog(`${label}: retrying…`); await new Promise((r) => setTimeout(r, 1500 * a)); }
    }
    throw last;
  }
  async publish() {
    this.publishing.set(true); this.log.set([]);
    try {
      const stamp = new Date().toISOString().replace(/[-:T]/g, '').slice(0, 14), tree: any[] = [];
      const refs: [any, string][] = [];
      for (const r of this.data.releases) { refs.push([r, 'cover'], [r, 'teaserArt']); r.tracks.forEach((t) => refs.push([t, 'audio'])); }
      for (const [o, k] of refs) {
        const v: string = o[k] || ''; if (!v.startsWith('pending:')) continue;
        const id = v.slice(8), f = this.pending.get(id)!;
        if (!this.blobs.has(id)) {
          this.addLog(`Uploading ${f.name} (${(f.size / 1048576).toFixed(1)} MB)…`);
          const sha = await this.blob(await fileB64(f), f.name);
          this.blobs.set(id, { path: `media/${stamp}-${slug(f.name)}.${ext(f.name)}`, sha });
          this.addLog(`Uploaded ${f.name}`, 'ok');
        }
        tree.push({ path: this.blobs.get(id)!.path, mode: '100644', type: 'blob', sha: this.blobs.get(id)!.sha });
      }
      const out: SiteContent = JSON.parse(JSON.stringify(this.data));
      const fix = (v?: string) => (v?.startsWith('pending:') ? this.blobs.get(v.slice(8))?.path || '' : v || '');
      out.releases.forEach((r) => { r.cover = fix(r.cover); r.teaserArt = fix(r.teaserArt); r.tracks.forEach((t) => (t.audio = fix(t.audio))); });
      tree.push({ path: 'content.json', mode: '100644', type: 'blob', sha: await this.blob(b64utf8(JSON.stringify(out, null, 2) + '\n'), 'content.json') });
      const ref = await this.gh(`/git/ref/heads/${BRANCH}`), head = await this.gh(`/git/commits/${ref.object.sha}`);
      const t = await this.gh('/git/trees', { method: 'POST', body: JSON.stringify({ base_tree: head.tree.sha, tree }) });
      const cm = await this.gh('/git/commits', { method: 'POST', body: JSON.stringify({ message: 'Update releases', tree: t.sha, parents: [ref.object.sha] }) });
      await this.gh(`/git/refs/heads/${BRANCH}`, { method: 'PATCH', body: JSON.stringify({ sha: cm.sha }) });
      this.data = out; this.pending.clear(); this.blobs.clear(); this.dirty.set(false); this.rev.update((n) => n + 1);
      this.addLog('Published — live now. Refresh the site to see it.', 'done');
    } catch (e: any) { this.addLog('Failed: ' + e.message + ' — press Publish again; finished uploads won’t repeat.', 'err'); }
    finally { this.publishing.set(false); }
  }
}

function migrate(c: any): SiteContent {
  const out: SiteContent = { artist: { name: 'Dawn Sogni', tagline: 'A different frequency', ...(c.artist || {}) }, shopUrl: c.shopUrl || c.brand?.shopUrl || '', instagram: c.instagram || c.brand?.instagram || '', releases: c.releases || [] };
  if (!c.releases && Array.isArray(c.songs)) out.releases = c.songs.filter((s: any) => s.audio && s.title).map((s: any) => ({
    id: s.id, title: s.title, type: 'Single', status: 'released', published: true, releaseDate: (s.date || s.releaseDate || '') ? (s.date || s.releaseDate) + 'T00:00' : '',
    cover: s.cover || '', teaserArt: '', description: '', credits: [], tracks: [{ id: s.id + '-t', title: s.title, audio: s.audio, lyrics: s.lyrics || '' }]
  }));
  out.releases.forEach((r) => { r.credits ||= []; r.tracks ||= []; });
  return out;
}
function audioDuration(f: File): Promise<number> {
  return new Promise((ok) => { const a = new Audio(); a.preload = 'metadata'; a.onloadedmetadata = () => ok(a.duration || 0); a.onerror = () => ok(0); a.src = URL.createObjectURL(f); });
}
const b64utf8 = (str: string) => { const b = new TextEncoder().encode(str); let s = ''; for (let i = 0; i < b.length; i += 0x8000) s += String.fromCharCode.apply(null, b.subarray(i, i + 0x8000) as any); return btoa(s); };
const fileB64 = (f: File) => new Promise<string>((ok, no) => { const r = new FileReader(); r.onload = () => ok(String(r.result).split(',')[1]); r.onerror = no; r.readAsDataURL(f); });
const slug = (s: string) => s.toLowerCase().replace(/\.[^.]+$/, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'file';
const ext = (s: string) => (s.match(/\.([a-z0-9]+)$/i) || [, 'bin'])[1]!.toLowerCase();
