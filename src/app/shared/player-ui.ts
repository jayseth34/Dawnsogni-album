import { Component, ElementRef, computed, effect, inject, signal, viewChild } from '@angular/core';
import { Router } from '@angular/router';
import { ContentService } from '../core/content.service';
import { LibraryService } from '../core/library.service';
import { PlayerService } from '../core/player.service';
import { UiService, fmt, parseLyrics } from '../core/ui.service';
import { Art, Ico } from './shared';

/* ---------------- Full-screen player ---------------- */
@Component({
  selector: 'ds-player-full', standalone: true, imports: [Art, Ico],
  template: `
  @if (c(); as c) {
  <div class="fp" [class.open]="p.open()" [class.playing]="p.playing()" role="dialog" aria-label="Now playing">
    <div class="fp-bg"><ds-art [src]="c.r.displayCover" /></div>
    <header class="fp-top">
      <button class="icon-btn" (click)="p.open.set(false)" aria-label="Close player"><ds-ico name="down" /></button>
      <div class="fp-from"><small>Playing from {{ c.r.type }}</small><b (click)="goAlbum()">{{ c.r.displayTitle }}</b></div>
      <button class="icon-btn" (click)="ui.openMenu(c.t.id, $event)" aria-label="More"><ds-ico name="more" /></button>
    </header>

    <div class="fp-body">
      <div class="fp-main">
        <div class="fp-art"><ds-art [src]="c.r.displayCover" [alt]="c.r.displayTitle" /></div>
        <div class="fp-title">
          <div><h2>{{ content.title(c.t, c.r) }}@if (c.t.explicit) { <span class="exp">E</span> }</h2><p>{{ content.raw().artist.name }}@if (p.isPreview()) { <span class="pv">30s preview</span> }</p></div>
          <button class="icon-btn lg like" [class.on]="lib.isLiked(c.t.id)" (click)="like()" aria-label="Like"><ds-ico [name]="lib.isLiked(c.t.id) ? 'heart' : 'heartO'" /></button>
        </div>
        <div class="wave" (click)="seek($event)" role="slider" aria-label="Seek" [attr.aria-valuenow]="p.pos()">
          @for (h of p.peaks(); track $index) { <i [class.on]="$index / p.peaks().length < p.progress()" [style.--h]="h"></i> }
        </div>
        <div class="fp-times"><span>{{ fmt(p.pos()) }}</span><span>{{ fmt(p.length()) }}</span></div>
        <div class="fp-ctrl">
          <button class="icon-btn" [class.on]="p.shuffle()" (click)="p.shuffle.set(!p.shuffle())" aria-label="Shuffle"><ds-ico name="shuffle" /></button>
          <button class="icon-btn lg" (click)="p.prev()" aria-label="Previous"><ds-ico name="prev" /></button>
          <button class="play-xl" (click)="p.toggle()" aria-label="Play or pause"><ds-ico [name]="p.playing() ? 'pause' : 'play'" /></button>
          <button class="icon-btn lg" (click)="p.next()" aria-label="Next"><ds-ico name="next" /></button>
          <button class="icon-btn rep" [class.on]="p.repeat() !== 'off'" (click)="p.cycleRepeat()" aria-label="Repeat"><ds-ico name="repeat" />@if (p.repeat() === 'one') { <sup>1</sup> }</button>
        </div>
        <div class="fp-tabs">
          <button [class.on]="tab() === 'lyrics'" (click)="tab.set('lyrics')"><ds-ico name="lyrics" />Lyrics</button>
          <button [class.on]="tab() === 'queue'" (click)="tab.set('queue')"><ds-ico name="queue" />Queue</button>
        </div>
      </div>

      <aside class="fp-side">
        @if (tab() === 'lyrics') {
          <div class="lyrics-box" #lyr>
            @if (lyrics().lines.length && c.r.stage !== 'teaser') {
              <div [class.synced]="lyrics().synced">
                @for (l of lyrics().lines; track $index) {
                  @if (l.gap) { <div class="ly-gap"></div> }
                  @else { <p class="ly" [class.tag]="l.tag" [class.on]="$index === line()" [class.past]="lyrics().synced && $index < line()" (click)="l.t !== null && jump(l.t)">{{ l.text }}</p> }
                }
              </div>
            } @else { <p class="muted">No lyrics for this track yet.</p> }
          </div>
        } @else {
          <div class="queue">
            <h4>Now playing</h4>
            <div class="q-row on"><ds-art [src]="c.r.displayCover" /><div><b>{{ content.title(c.t, c.r) }}</b><small>{{ c.r.displayTitle }}</small></div></div>
            @if (upNext().length) { <h4>Up next</h4> }
            @for (q of upNext(); track q.i) {
              <div class="q-row">
                <ds-art [src]="q.x.r.displayCover" /><div (click)="p.jump(q.i)"><b>{{ content.title(q.x.t, q.x.r) }}</b><small>{{ q.x.r.displayTitle }}</small></div>
                <button class="icon-btn sm" (click)="p.move(q.i, -1)" aria-label="Move up">↑</button>
                <button class="icon-btn sm" (click)="p.move(q.i, 1)" aria-label="Move down">↓</button>
                <button class="icon-btn sm" (click)="p.removeAt(q.i)" aria-label="Remove"><ds-ico name="close" /></button>
              </div>
            } @empty { <p class="muted">Nothing queued. Use ⋯ → “Add to queue” on any track.</p> }
          </div>
        }
      </aside>
    </div>
  </div>
  }`
})
export class PlayerFull {
  p = inject(PlayerService); content = inject(ContentService); lib = inject(LibraryService); ui = inject(UiService); router = inject(Router);
  c = this.p.current; fmt = fmt;
  tab = signal<'lyrics' | 'queue'>('lyrics');
  lyr = viewChild<ElementRef<HTMLElement>>('lyr');
  lyrics = computed(() => parseLyrics(this.c()?.t.lyrics));
  line = computed(() => {
    const L = this.lyrics(); if (!L.synced) return -1;
    const t = this.p.time() + 0.15; let idx = -1; L.lines.forEach((l, i) => { if (l.t !== null && l.t <= t) idx = i; }); return idx;
  });
  upNext = computed(() => this.p.queue().map((id, i) => ({ i, x: this.content.track(id) })).filter((q) => q.i > this.p.index() && q.x) as any[]);
  private lastScroll = 0;

  constructor() {
    effect(() => {
      const i = this.line(), box = this.lyr()?.nativeElement; if (i < 0 || !box || !this.p.open()) return;
      if (Date.now() - this.lastScroll < 2500) return;
      const el = box.querySelectorAll('.ly')[0] && box.querySelector('.ly.on') as HTMLElement | null;
      el && box.scrollTo({ top: el.offsetTop - box.clientHeight / 2 + el.clientHeight / 2, behavior: 'smooth' });
    });
    addEventListener('keydown', (e) => { if (e.key === 'Escape') this.p.open.set(false); });
    document.addEventListener('wheel', (e) => { if ((e.target as HTMLElement).closest?.('.lyrics-box')) this.lastScroll = Date.now(); }, { passive: true });
    document.addEventListener('touchmove', (e) => { if ((e.target as HTMLElement).closest?.('.lyrics-box')) this.lastScroll = Date.now(); }, { passive: true });
    effect(() => document.body.classList.toggle('fp-open', this.p.open()));
  }
  seek(e: MouseEvent) { const r = (e.currentTarget as HTMLElement).getBoundingClientRect(); this.p.seek((e.clientX - r.left) / r.width); }
  jump(t: number) { if (!this.p.isPreview()) this.p.audio.currentTime = t; }
  like() { const id = this.c()!.t.id; this.ui.toast(this.lib.toggle('liked', id) ? 'Added to Liked tracks' : 'Removed from Liked tracks'); }
  goAlbum() { this.p.open.set(false); this.router.navigate(['/album', this.c()!.r.id]); }
}

/* ---------------- Mini player ---------------- */
@Component({
  selector: 'ds-player-mini', standalone: true, imports: [Art, Ico],
  template: `
  @if (c(); as c) {
    <div class="mini" (click)="p.open.set(true)">
      <div class="mini-prog"><i [style.width.%]="p.progress() * 100"></i></div>
      <ds-art class="mini-art" [src]="c.r.displayCover" />
      <div class="mini-t"><b>{{ content.title(c.t, c.r) }}</b><small>{{ content.raw().artist.name }}@if (p.isPreview()) { · preview }</small></div>
      <div class="mini-seek" (click)="$event.stopPropagation()">
        <span>{{ fmt(p.pos()) }}</span>
        <div class="bar" (click)="seek($event)"><i [style.width.%]="p.progress() * 100"></i></div>
        <span>{{ fmt(p.length()) }}</span>
      </div>
      <div class="mini-ctrl" (click)="$event.stopPropagation()">
        <button class="icon-btn like hide-sm" [class.on]="lib.isLiked(c.t.id)" (click)="like()" aria-label="Like"><ds-ico [name]="lib.isLiked(c.t.id) ? 'heart' : 'heartO'" /></button>
        <button class="icon-btn hide-sm" (click)="p.prev()" aria-label="Previous"><ds-ico name="prev" /></button>
        <button class="mini-play" (click)="p.toggle()" aria-label="Play or pause"><ds-ico [name]="p.playing() ? 'pause' : 'play'" /></button>
        <button class="icon-btn" (click)="p.next()" aria-label="Next"><ds-ico name="next" /></button>
      </div>
    </div>
  }`
})
export class PlayerMini {
  p = inject(PlayerService); content = inject(ContentService); lib = inject(LibraryService); ui = inject(UiService);
  c = this.p.current; fmt = fmt;
  seek(e: MouseEvent) { const r = (e.currentTarget as HTMLElement).getBoundingClientRect(); this.p.seek((e.clientX - r.left) / r.width); }
  like() { const id = this.c()!.t.id; this.ui.toast(this.lib.toggle('liked', id) ? 'Added to Liked tracks' : 'Removed from Liked tracks'); }
}

/* ---------------- Track options menu + playlist picker + toast ---------------- */
@Component({
  selector: 'ds-overlays', standalone: true, imports: [Ico],
  template: `
  @if (ui.menu(); as m) {
    <div class="scrim" (click)="ui.menu.set(null)"></div>
    @if (x(); as x) {
      <div class="menu" [style.left.px]="m.x" [style.top.px]="m.y" role="menu">
        <p class="menu-t">{{ content.title(x.t, x.r) }}</p>
        <button (click)="act('next')"><ds-ico name="queue" />Play next</button>
        <button (click)="act('queue')"><ds-ico name="plus" />Add to queue</button>
        <button (click)="act('playlist')"><ds-ico name="lib" />Add to playlist…</button>
        <button (click)="act('like')"><ds-ico [name]="lib.isLiked(x.t.id) ? 'heart' : 'heartO'" />{{ lib.isLiked(x.t.id) ? 'Remove from Liked' : 'Like' }}</button>
        @if (content.isFull(x.t, x.r)) { <button (click)="act('dl')"><ds-ico name="dl" />{{ lib.downloaded().includes(x.t.id) ? 'Remove download' : 'Download' }}</button> }
        <button (click)="act('album')"><ds-ico name="disc" />Go to {{ x.r.type.toLowerCase() }}</button>
        <button (click)="act('share')"><ds-ico name="share" />Share track</button>
      </div>
    }
  }
  @if (ui.picker(); as tid) {
    <div class="scrim dark" (click)="ui.picker.set(null)"></div>
    <div class="sheet" role="dialog" aria-label="Add to playlist">
      <h3>Add to playlist</h3>
      <form (submit)="newPl($event, tid)"><input name="n" placeholder="New playlist" autocomplete="off" /><button class="btn red">Create</button></form>
      @for (pl of lib.playlists(); track pl.id) {
        <button class="sheet-row" (click)="addTo(pl.id, tid)"><b>{{ pl.name }}</b><small>{{ pl.trackIds.length }} tracks</small></button>
      }
    </div>
  }
  @if (ui.toastMsg()) { <div class="toast" role="status">{{ ui.toastMsg() }}</div> }`
})
export class Overlays {
  ui = inject(UiService); content = inject(ContentService); lib = inject(LibraryService); p = inject(PlayerService); router = inject(Router);
  x = computed(() => { const m = this.ui.menu(); return m ? this.content.track(m.trackId) : null; });
  async act(a: string) {
    const x = this.x()!; this.ui.menu.set(null);
    if (a === 'next') { this.p.playNext(x.t.id); this.ui.toast('Plays next'); }
    if (a === 'queue') { this.p.addToQueue(x.t.id); this.ui.toast('Added to queue'); }
    if (a === 'playlist') this.ui.picker.set(x.t.id);
    if (a === 'like') this.ui.toast(this.lib.toggle('liked', x.t.id) ? 'Added to Liked tracks' : 'Removed from Liked tracks');
    if (a === 'album') { this.p.open.set(false); this.router.navigate(['/album', x.r.id]); }
    if (a === 'share') this.ui.share(this.content.title(x.t, x.r), '/track/' + x.t.id);
    if (a === 'dl') {
      if (this.lib.downloaded().includes(x.t.id)) { await this.lib.removeDownload(x.t.id, x.t.audio); this.ui.toast('Download removed'); }
      else { this.ui.toast('Downloading…'); try { await this.lib.download(x.t.id, x.t.audio); this.ui.toast('Downloaded — plays offline'); } catch { this.ui.toast('Download failed'); } }
    }
  }
  addTo(pid: string, tid: string) { this.lib.addToPlaylist(pid, tid); this.ui.picker.set(null); this.ui.toast('Added to playlist'); }
  newPl(e: Event, tid: string) { e.preventDefault(); const i = (e.target as HTMLFormElement).elements.namedItem('n') as HTMLInputElement; this.lib.createPlaylist(i.value, [tid]); this.ui.picker.set(null); this.ui.toast('Playlist created'); }
}
