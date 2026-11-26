import { Component, computed, inject } from '@angular/core';
import { ContentService } from '../core/content.service';
import { LibraryService } from '../core/library.service';
import { PlayerService } from '../core/player.service';
import { UiService } from '../core/ui.service';
import { Art, Ico, ReleaseCard } from '../shared/shared';

@Component({
  selector: 'ds-profile', standalone: true, imports: [Art, Ico, ReleaseCard],
  template: `
  <section class="prof-head">
    <label class="avatar" title="Change picture">
      @if (lib.profile().avatar) { <img [src]="lib.profile().avatar" alt="" /> } @else { <ds-ico name="user" /> }
      <input type="file" accept="image/*" (change)="avatar($event)" hidden />
      <span>Edit</span>
    </label>
    <div>
      <p class="kicker">Profile</p>
      <input class="prof-name" [value]="lib.profile().name" placeholder="Your name" (change)="setName($any($event.target).value)" aria-label="Your name" />
      <p class="muted">Listening since {{ since() }}</p>
    </div>
  </section>

  <section class="stats">
    <div><b>{{ hours() }}</b><span>listened</span></div>
    <div><b>{{ lib.history().length }}</b><span>plays</span></div>
    <div><b>{{ uniqueTracks() }}</b><span>tracks heard</span></div>
    <div><b>{{ lib.liked().length }}</b><span>liked</span></div>
  </section>

  @if (top().length) {
    <section class="shelf"><header><h3>Your top tracks</h3></header>
      <ol class="toplist">@for (x of top(); track x.t.id; let i = $index) {
        <li (click)="player.playList(topIds(), x.t.id)"><span class="n">{{ i + 1 }}</span><ds-art [src]="x.r.displayCover" /><div><b>{{ content.title(x.t, x.r) }}</b><small>{{ x.r.displayTitle }}</small></div><span class="muted">{{ mins(x.sec) }}</span></li>
      }</ol></section>
  }

  @if (favs().length) {
    <section class="shelf"><header><h3>Favourite albums</h3></header>
      <div class="cards">@for (r of favs(); track r.id) { <ds-release-card [r]="r" /> }</div></section>
  }

  <section class="settings">
    <h3>App preferences</h3>
    <label class="toggle"><span>Autoplay next track<small>Keep playing when a track ends</small></span><input type="checkbox" [checked]="lib.prefs().autoplay" (change)="pref('autoplay', $event)" /><i></i></label>
    <label class="toggle"><span>Reduce motion<small>Fewer animations</small></span><input type="checkbox" [checked]="lib.prefs().reduceMotion" (change)="pref('reduceMotion', $event)" /><i></i></label>
    <h3>Account</h3>
    <p class="muted small-note">Your profile, likes, playlists and history are saved on this device.</p>
    <div class="btns">
      <button class="btn ghost" (click)="exportData()">Export my data</button>
      <label class="btn ghost">Import data<input type="file" accept="application/json" hidden (change)="importData($event)" /></label>
      <button class="btn ghost danger" (click)="reset()">Reset this device</button>
    </div>
  </section>`
})
export class ProfilePage {
  content = inject(ContentService); lib = inject(LibraryService); player = inject(PlayerService); ui = inject(UiService);
  since = computed(() => { const h = this.lib.history(); return h.length ? new Date(h[h.length - 1].at).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' }) : 'today'; });
  hours = computed(() => { const s = Object.values(this.lib.seconds()).reduce((a, b) => a + b, 0); return s >= 3600 ? (s / 3600).toFixed(1) + ' h' : Math.round(s / 60) + ' min'; });
  uniqueTracks = computed(() => new Set(this.lib.history().map((h) => h.trackId)).size);
  top = computed(() => Object.entries(this.lib.seconds()).sort((a, b) => b[1] - a[1]).map(([id, sec]) => ({ ...this.content.track(id)!, sec })).filter((x) => x.t).slice(0, 5));
  topIds = computed(() => this.top().map((x) => x.t.id));
  favs = computed(() => this.lib.saved().map((id) => this.content.release(id)).filter((r) => !!r) as any[]);
  mins = (s: number) => (s >= 60 ? Math.round(s / 60) + ' min' : Math.round(s) + ' s');

  setName(name: string) { this.lib.profile.set({ ...this.lib.profile(), name: name.trim() }); this.ui.toast('Saved'); }
  pref(k: 'autoplay' | 'reduceMotion', e: Event) { this.lib.prefs.set({ ...this.lib.prefs(), [k]: (e.target as HTMLInputElement).checked }); }
  avatar(e: Event) {
    const f = (e.target as HTMLInputElement).files?.[0]; if (!f) return;
    const img = new Image(); img.onload = () => {
      const c = document.createElement('canvas'), s = 240, k = Math.max(s / img.width, s / img.height); c.width = c.height = s;
      c.getContext('2d')!.drawImage(img, (s - img.width * k) / 2, (s - img.height * k) / 2, img.width * k, img.height * k);
      this.lib.profile.set({ ...this.lib.profile(), avatar: c.toDataURL('image/jpeg', 0.85) }); this.ui.toast('Picture updated');
    }; img.src = URL.createObjectURL(f);
  }
  exportData() {
    const data: Record<string, any> = {}; for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i)!; if (k.startsWith('ds_')) data[k] = localStorage.getItem(k); }
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([JSON.stringify(data)], { type: 'application/json' })); a.download = 'dawn-sogni-library.json'; a.click();
  }
  async importData(e: Event) {
    const f = (e.target as HTMLInputElement).files?.[0]; if (!f) return;
    try { const d = JSON.parse(await f.text()); Object.entries(d).forEach(([k, v]) => k.startsWith('ds_') && localStorage.setItem(k, String(v))); location.reload(); } catch { this.ui.toast('That file could not be read'); }
  }
  reset() { if (confirm('Remove your profile, likes, playlists and history from this device?')) { Object.keys(localStorage).filter((k) => k.startsWith('ds_')).forEach((k) => localStorage.removeItem(k)); location.reload(); } }
}
