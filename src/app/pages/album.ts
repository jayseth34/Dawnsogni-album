import { Component, computed, effect, inject, input, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { ContentService } from '../core/content.service';
import { LibraryService } from '../core/library.service';
import { PlayerService } from '../core/player.service';
import { UiService, fmtLong, parseLyrics } from '../core/ui.service';
import { Art, Countdown, Ico, ReleaseCard, Status, TrackRow } from '../shared/shared';
import { calendarFile } from './releases';
import { Comments } from '../shared/comments';
import { CommentsService } from '../core/comments.service';
import { ViewRelease } from '../core/models';

@Component({
  selector: 'ds-album', standalone: true, imports: [RouterLink, DatePipe, Art, Ico, Status, Countdown, TrackRow, ReleaseCard, Comments],
  template: `
  @if (r(); as r) {
    <div class="al-bg"><ds-art [src]="r.displayCover" /></div>
    <section class="al-head">
      <div class="al-art" [class.teaser]="r.stage === 'teaser'"><ds-art [src]="r.displayCover" [alt]="r.displayTitle" /></div>
      <div class="al-info">
        <div class="row-gap"><ds-status [stage]="r.stage" /><span class="muted">{{ r.type }}</span>@if (explicit()) { <span class="exp">E</span> }</div>
        <h1 class="goth">{{ r.displayTitle }}</h1>
        <p class="al-meta">
          <b>{{ content.raw().artist.name }}</b>
          @if (r.date && r.stage !== 'teaser') { <span>{{ r.date | date: 'd MMMM y' }}</span> }
          @if (r.stage === 'released' || r.stage === 'upcoming') { <span>{{ r.tracks.length }} {{ r.tracks.length === 1 ? 'track' : 'tracks' }}</span> }
          @if (r.stage === 'released' && r.totalDuration) { <span>{{ long(r.totalDuration) }}</span> }
        </p>
        @if (r.stage !== 'released' && r.date) { <ds-countdown [date]="r.date" /> }
      </div>
    </section>

    @if (locked()) {
      <section class="lockbox">
        <ds-ico name="lock" /><h3>Exclusive release</h3><p>Enter your access code to unlock it.</p>
        <form (submit)="unlock($event)"><input #code name="code" placeholder="Access code" autocomplete="off" /><button class="btn red">Unlock</button></form>
        @if (badCode()) { <p class="err">That code isn't right.</p> }
      </section>
    } @else {
      <div class="al-actions">
        @if (r.showTracklist && r.tracks.length) {
          <button class="play-xl" (click)="playAll()" [attr.aria-label]="'Play ' + r.displayTitle"><ds-ico [name]="player.isPlayingRelease(r) ? 'pause' : 'play'" /></button>
          <button class="icon-btn lg" [class.on]="player.shuffle()" (click)="player.playRelease(r, undefined, true)" aria-label="Shuffle"><ds-ico name="shuffle" /></button>
        }
        <button class="icon-btn lg" [class.on]="lib.isSaved(r.id)" (click)="save()" [attr.aria-label]="lib.isSaved(r.id) ? 'Remove from library' : 'Save to library'"><ds-ico [name]="lib.isSaved(r.id) ? 'saved' : 'save'" /></button>
        <button class="icon-btn lg" (click)="ui.share(r.displayTitle, '/album/' + r.id)" aria-label="Share"><ds-ico name="share" /></button>
        @if (r.stage === 'announced' || r.stage === 'upcoming') {
          <button class="btn ghost" [class.on]="lib.reminders().includes(r.id)" (click)="presave()"><ds-ico [name]="lib.reminders().includes(r.id) ? 'saved' : 'bell'" />{{ lib.reminders().includes(r.id) ? 'Pre-saved' : 'Pre-save' }}</button>
        }
        @if (r.stage === 'released') { <span class="out-now">Out now</span> }
      </div>

      @if (r.stage === 'teaser') { <p class="al-desc">{{ r.teaserText || 'Something new is on the way. The tracklist stays hidden for now.' }}</p> }
      @else if (r.description) { <p class="al-desc">{{ r.description }}</p> }

      @if (r.showTracklist && r.tracks.length) {
        <section class="tlist al-tl">
          <div class="tl-head"><span>#</span><span>Title</span><span></span></div>
          @for (t of r.tracks; track t.id; let i = $index) {
            <div [id]="'t-' + t.id" [class.hl]="highlight() === t.id"><ds-track-row [t]="t" [r]="r" [num]="i + 1" [sub]="t.credits || ''" /></div>
          }
        </section>
      } @else if (r.stage === 'announced') { <p class="al-desc muted">The tracklist will be revealed closer to release.</p> }

      @if (r.credits?.length && r.stage !== 'teaser') {
        <section class="credits"><h3>Credits</h3>
          <dl>@for (c of r.credits; track $index) { <div><dt>{{ c.role }}</dt><dd>{{ c.name }}</dd></div> }</dl></section>
      }

      @if (lyricTracks().length && r.stage !== 'teaser') {
        <section class="credits"><h3>Lyrics</h3>
          @for (t of lyricTracks(); track t.id) {
            <details class="lyr"><summary>{{ t.title }}</summary>
              <div class="lyr-body">@for (l of parse(t.lyrics).lines; track $index) {
                @if (l.gap) { <br /> } @else if (l.tag) { <p class="tag">{{ l.text }}</p> } @else { <p>{{ l.text }}</p> }
              }</div></details>
          }
        </section>
      }

      @if (r.stage !== 'teaser' && r.showTracklist && r.tracks.length && cm.enabled()) {
        <section class="credits cm-sec" id="comments"><h3>Comments</h3>
          @if (r.tracks.length > 1) {
            <div class="chips cm-chips">@for (t of r.tracks; track t.id) {
              <button [class.on]="cmTrack(r) === t.id" (click)="cmSel.set(t.id)">{{ content.title(t, r) }}</button>
            }</div>
          }
          <ds-comments [track]="cmTrack(r)" />
        </section>
      }
    }

    @if (more().length) {
      <section class="shelf"><header><h3>More from {{ content.raw().artist.name }}</h3></header>
        <div class="cards">@for (x of more(); track x.id) { <ds-release-card [r]="x" /> }</div></section>
    }
  } @else if (content.loaded()) {
    <section class="empty-state"><h2 class="goth">Not found</h2><p>This release isn't available.</p><a class="btn ghost" routerLink="/">Back home</a></section>
  }`
})
export class Album {
  id = input<string>(''); t = input<string>('');
  cm = inject(CommentsService); cmSel = signal('');
  cmTrack = (r: ViewRelease) => { const ids = r.tracks.map((x) => x.id); const s = this.cmSel() || this.t(); return ids.includes(s) ? s : ids[0]; };
  content = inject(ContentService); lib = inject(LibraryService); player = inject(PlayerService); ui = inject(UiService);
  r = computed(() => this.content.release(this.id()));
  locked = computed(() => !!this.r() && this.content.isLocked(this.r()!));
  explicit = computed(() => !!this.r()?.tracks.some((t) => t.explicit) && this.r()!.stage !== 'teaser');
  lyricTracks = computed(() => (this.r()?.tracks || []).filter((t) => t.lyrics?.trim()));
  more = computed(() => this.content.out().filter((x) => x.id !== this.id()).slice(0, 8));
  highlight = signal('');
  badCode = signal(false);
  parse = parseLyrics; long = fmtLong;

  constructor() {
    effect(() => {
      const t = this.t(); if (!t || !this.r()) return;
      this.highlight.set(t);
      setTimeout(() => document.getElementById('t-' + t)?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 300);
    });
  }
  playAll() { const r = this.r()!; this.player.isPlayingRelease(r) ? this.player.toggle() : this.player.playRelease(r); }
  save() { this.ui.toast(this.lib.toggle('saved', this.r()!.id) ? 'Saved to your library' : 'Removed from your library'); }
  presave() {
    const r = this.r()!, on = this.lib.toggle('reminders', r.id);
    if (on) { this.lib.isSaved(r.id) || this.lib.toggle('saved', r.id); this.ui.toast('Pre-saved — added to your library'); calendarFile(r); }
    else this.ui.toast('Pre-save removed');
  }
  async unlock(e: Event) {
    e.preventDefault();
    const code = ((e.target as HTMLFormElement).elements.namedItem('code') as HTMLInputElement).value;
    const ok = await this.content.unlock(this.r()!, code); this.badCode.set(!ok); if (ok) this.ui.toast('Unlocked');
  }
}

/** /track/:id — open the track's release with the track highlighted. */
@Component({ selector: 'ds-track-link', standalone: true, template: `` })
export class TrackLink {
  id = input<string>('');
  constructor() {
    const content = inject(ContentService), router = inject(Router);
    effect(() => {
      if (!content.loaded()) return;
      const x = content.track(this.id());
      router.navigate(x ? ['/album', x.r.id] : ['/'], { queryParams: x ? { t: x.t.id } : {}, replaceUrl: true });
    });
  }
}
