import { Component, computed, effect, inject, input, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { Router } from '@angular/router';
import { ContentService } from '../core/content.service';
import { LibraryService } from '../core/library.service';
import { PlayerService } from '../core/player.service';
import { UiService } from '../core/ui.service';
import { Art, Ico, ReleaseCard, TrackRow } from '../shared/shared';

const TABS = [['liked', 'Liked tracks'], ['albums', 'Saved albums'], ['playlists', 'Playlists'], ['recent', 'Recently played'], ['downloads', 'Downloads'], ['history', 'History']] as const;

@Component({
  selector: 'ds-library', standalone: true, imports: [DatePipe, Art, Ico, ReleaseCard, TrackRow],
  template: `
  <header class="page-head"><p class="kicker">Your collection</p><h1 class="goth">Library</h1></header>
  <div class="chips">@for (t of tabs; track t[0]) { <button [class.on]="active() === t[0]" (click)="go(t[0])">{{ t[1] }}</button> }</div>

  @switch (active()) {
    @case ('liked') {
      @if (liked().length) {
        <div class="lib-bar"><button class="btn red" (click)="player.playList(likedIds())"><ds-ico name="play" />Play all</button><span class="muted">{{ liked().length }} tracks</span></div>
        <div class="tlist">@for (x of liked(); track x.t.id; let i = $index) { <ds-track-row [t]="x.t" [r]="x.r" [num]="i + 1" [showArt]="true" [list]="likedIds()" /> }</div>
      } @else { <p class="empty-state">Tap the ♡ on any track to keep it here.</p> }
    }
    @case ('albums') {
      @if (savedReleases().length) { <div class="grid">@for (r of savedReleases(); track r.id) { <ds-release-card [r]="r" /> }</div> }
      @else { <p class="empty-state">Save albums, EPs and singles to find them here.</p> }
    }
    @case ('playlists') {
      @if (pl(); as p) {
        <div class="pl-head">
          <button class="icon-btn" (click)="openPl('')" aria-label="Back"><ds-ico name="back" /></button>
          <input class="pl-name" [value]="p.name" (change)="lib.renamePlaylist(p.id, $any($event.target).value)" aria-label="Playlist name" />
          <button class="btn red" [disabled]="!plTracks().length" (click)="player.playList(plIds())"><ds-ico name="play" />Play</button>
          <button class="btn ghost" (click)="del(p.id)">Delete</button>
        </div>
        @if (plTracks().length) {
          <div class="tlist">@for (x of plTracks(); track x.t.id; let i = $index) {
            <div class="pl-row"><ds-track-row [t]="x.t" [r]="x.r" [num]="i + 1" [showArt]="true" [list]="plIds()" />
              <button class="icon-btn" (click)="lib.removeFromPlaylist(p.id, x.t.id)" aria-label="Remove"><ds-ico name="close" /></button></div>
          }</div>
        } @else { <p class="empty-state">Use the ⋯ menu on any track → “Add to playlist”.</p> }
      } @else {
        <form class="new-pl" (submit)="create($event)"><input name="n" placeholder="New playlist name" autocomplete="off" /><button class="btn red"><ds-ico name="plus" />Create</button></form>
        <div class="pl-grid">@for (p of lib.playlists(); track p.id) {
          <button class="pl-card" (click)="openPl(p.id)">
            <div class="pl-mosaic">@for (c of covers(p.trackIds); track $index) { <ds-art [src]="c" /> }</div>
            <b>{{ p.name }}</b><small>{{ p.trackIds.length }} tracks</small>
          </button>
        } @empty { <p class="empty-state">No playlists yet.</p> }</div>
      }
    }
    @case ('recent') {
      @if (recent().length) { <div class="tlist">@for (x of recent(); track x.t.id; let i = $index) { <ds-track-row [t]="x.t" [r]="x.r" [num]="i + 1" [showArt]="true" [list]="recentIds()" /> }</div> }
      @else { <p class="empty-state">Nothing played yet.</p> }
    }
    @case ('downloads') {
      <p class="muted small-note">Downloaded tracks play without an internet connection on this device.</p>
      @if (downloads().length) { <div class="tlist">@for (x of downloads(); track x.t.id; let i = $index) { <ds-track-row [t]="x.t" [r]="x.r" [num]="i + 1" [showArt]="true" [list]="downloadIds()" /> }</div> }
      @else { <p class="empty-state">Use the ⋯ menu on a track → “Download”.</p> }
    }
    @case ('history') {
      @if (history().length) {
        <div class="lib-bar"><span class="muted">{{ lib.history().length }} plays</span><button class="btn ghost" (click)="clear()">Clear history</button></div>
        <ul class="hist">@for (h of history(); track $index) {
          <li (click)="player.playList([h.x.t.id])"><ds-art [src]="h.x.r.displayCover" /><div><b>{{ content.title(h.x.t, h.x.r) }}</b><small>{{ h.x.r.displayTitle }}</small></div><time>{{ h.at | date: 'd MMM, HH:mm' }}</time></li>
        }</ul>
      } @else { <p class="empty-state">Your listening history will show up here.</p> }
    }
  }`
})
export class Library {
  tab = input<string>(''); playlist = input<string>('');
  content = inject(ContentService); lib = inject(LibraryService); player = inject(PlayerService); ui = inject(UiService); router = inject(Router);
  tabs = TABS;
  active = signal<string>('liked');
  constructor() { effect(() => { if (this.tab()) this.active.set(this.tab()); if (this.playlist()) this.active.set('playlists'); }); }

  private resolve = (ids: string[]) => ids.map((id) => this.content.track(id)).filter((x): x is NonNullable<typeof x> => !!x);
  liked = computed(() => this.resolve(this.lib.liked())); likedIds = computed(() => this.liked().map((x) => x.t.id));
  savedReleases = computed(() => this.lib.saved().map((id) => this.content.release(id)).filter((r) => !!r) as any[]);
  recent = computed(() => this.resolve(this.lib.recent()).slice(0, 50)); recentIds = computed(() => this.recent().map((x) => x.t.id));
  downloads = computed(() => this.resolve(this.lib.downloaded())); downloadIds = computed(() => this.downloads().map((x) => x.t.id));
  history = computed(() => this.lib.history().slice(0, 200).map((h) => ({ at: h.at, x: this.content.track(h.trackId) })).filter((h) => !!h.x) as any[]);
  pl = computed(() => this.lib.playlists().find((p) => p.id === this.playlist()) || null);
  plTracks = computed(() => this.resolve(this.pl()?.trackIds || [])); plIds = computed(() => this.plTracks().map((x) => x.t.id));
  covers = (ids: string[]) => { const c = this.resolve(ids).map((x) => x.r.displayCover); return (c.length ? c : ['']).slice(0, 4); };

  go(t: string) { this.router.navigate(['/library'], { queryParams: { tab: t } }); }
  openPl(id: string) { this.router.navigate(['/library'], { queryParams: id ? { tab: 'playlists', playlist: id } : { tab: 'playlists' } }); }
  create(e: Event) { e.preventDefault(); const f = e.target as HTMLFormElement, i = f.elements.namedItem('n') as HTMLInputElement; const p = this.lib.createPlaylist(i.value); i.value = ''; this.openPl(p.id); }
  del(id: string) { if (confirm('Delete this playlist?')) { this.lib.deletePlaylist(id); this.openPl(''); } }
  clear() { if (confirm('Clear your listening history?')) this.lib.clearHistory(); }
}
