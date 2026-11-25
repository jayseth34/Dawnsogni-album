import { Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ContentService } from '../core/content.service';
import { LibraryService } from '../core/library.service';
import { PlayerService } from '../core/player.service';
import { Art, Countdown, Ico, ReleaseCard, Status, TrackRow } from '../shared/shared';

@Component({
  selector: 'ds-home', standalone: true, imports: [RouterLink, Art, Ico, Status, Countdown, ReleaseCard, TrackRow],
  template: `
  <section class="welcome">
    <p class="kicker">{{ greeting() }}{{ lib.profile().name ? ', ' + lib.profile().name : '' }}</p>
    <h1 class="brand-word">{{ content.raw().artist.name }}</h1>
    <p class="tagline">{{ content.raw().artist.tagline || 'A different frequency' }}</p>
  </section>

  @if (f(); as f) {
    <section class="feature">
      <div class="feature-bg"><ds-art [src]="f.displayCover" /></div>
      <a class="feature-art" [routerLink]="['/album', f.id]"><ds-art [src]="f.displayCover" [alt]="f.displayTitle" /></a>
      <div class="feature-info">
        <div class="row-gap"><ds-status [stage]="f.stage" /><span class="muted">{{ f.type }}{{ f.year ? ' · ' + f.year : '' }}</span></div>
        <h2 class="goth">{{ f.displayTitle }}</h2>
        @if (f.stage === 'teaser' && f.teaserText) { <p class="desc">{{ f.teaserText }}</p> }
        @else if (f.description) { <p class="desc clamp">{{ f.description }}</p> }
        @if (f.stage !== 'released' && f.date) { <ds-countdown [date]="f.date" /> }
        <div class="btns">
          @if (f.showTracklist && f.tracks.length && !content.isLocked(f)) {
            <button class="btn red" (click)="player.isPlayingRelease(f) ? player.toggle() : player.playRelease(f)"><ds-ico [name]="player.isPlayingRelease(f) ? 'pause' : 'play'" />{{ f.stage === 'released' ? 'Play' : 'Play preview' }}</button>
          }
          <a class="btn ghost" [routerLink]="['/album', f.id]">{{ f.stage === 'released' ? 'Open ' + f.type.toLowerCase() : 'See release' }}</a>
        </div>
      </div>
    </section>
  }

  @if (newest().length) {
    <section class="shelf"><header><h3>New releases</h3><a routerLink="/albums">See all</a></header>
      <div class="cards">@for (r of newest(); track r.id) { <ds-release-card [r]="r" /> }</div></section>
  }

  @if (content.upcoming().length) {
    <section class="shelf"><header><h3>Coming soon</h3><a routerLink="/releases">All releases</a></header>
      <div class="cards">@for (r of content.upcoming(); track r.id) {
        <div class="up-wrap"><ds-release-card [r]="r" />@if (r.date) { <ds-countdown [date]="r.date" [small]="true" /> }</div>
      }</div></section>
  }

  @if (featuredTracks().length) {
    <section class="shelf"><header><h3>Featured tracks</h3></header>
      <div class="tlist">@for (x of featuredTracks(); track x.t.id; let i = $index) {
        <ds-track-row [t]="x.t" [r]="x.r" [num]="i + 1" [showArt]="true" [list]="featuredIds()" />
      }</div></section>
  }

  @if (recent().length) {
    <section class="shelf"><header><h3>Recently played</h3><a routerLink="/library" [queryParams]="{ tab: 'recent' }">History</a></header>
      <div class="cards">@for (x of recent(); track x.t.id) {
        <button class="tcard" (click)="player.playList(recentIds(), x.t.id)">
          <div class="rcard-art"><ds-art [src]="x.r.displayCover" /><span class="fab"><ds-ico [name]="player.isCurrent(x.t.id) && player.playing() ? 'pause' : 'play'" /></span></div>
          <p class="rcard-t">{{ content.title(x.t, x.r) }}</p><p class="rcard-s">{{ x.r.displayTitle }}</p>
        </button>
      }</div></section>
  }

  @if (recommended().length) {
    <section class="shelf"><header><h3>Recommended for you</h3></header>
      <div class="tlist">@for (x of recommended(); track x.t.id; let i = $index) {
        <ds-track-row [t]="x.t" [r]="x.r" [num]="i + 1" [showArt]="true" [list]="recommendedIds()" />
      }</div></section>
  }

  @if (!content.releases().length && content.loaded()) {
    <section class="empty-state"><h2 class="goth">Soon</h2><p>The first release is on its way.</p></section>
  }
  `
})
export class Home {
  content = inject(ContentService); lib = inject(LibraryService); player = inject(PlayerService);
  f = this.content.featured;
  greeting = computed(() => { const h = new Date(this.content.now()).getHours(); return h < 5 ? 'Late night' : h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening'; });
  newest = computed(() => this.content.out().slice(0, 10));
  private playable = computed(() => this.content.tracks().filter((x) => !this.content.isLocked(x.r) && x.r.stage !== 'teaser'));
  featuredTracks = computed(() => { const f = this.playable().filter((x) => x.t.featured); return (f.length ? f : this.playable()).slice(0, 6); });
  featuredIds = computed(() => this.featuredTracks().map((x) => x.t.id));
  recent = computed(() => this.lib.recent().map((id) => this.content.track(id)).filter((x): x is NonNullable<typeof x> => !!x).slice(0, 10));
  recentIds = computed(() => this.recent().map((x) => x.t.id));
  recommended = computed(() => {
    const played = new Set(this.lib.recent()), secs = this.lib.seconds();
    const day = Math.floor(this.content.now() / 864e5);
    return [...this.playable()].sort((a, b) => (played.has(a.t.id) ? 1 : 0) - (played.has(b.t.id) ? 1 : 0) || (secs[a.t.id] || 0) - (secs[b.t.id] || 0) || hash(a.t.id + day) - hash(b.t.id + day))
      .filter((x) => !this.featuredIds().includes(x.t.id)).slice(0, 6);
  });
  recommendedIds = computed(() => this.recommended().map((x) => x.t.id));
}
function hash(s: string) { let h = 7; for (const c of s) h = (h * 31 + c.charCodeAt(0)) >>> 0; return h; }
