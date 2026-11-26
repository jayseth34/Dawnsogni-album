import { Component, computed, inject, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ContentService, rawUrl } from '../core/content.service';
import { LibraryService } from '../core/library.service';
import { Track, ViewRelease } from '../core/models';
import { PlayerService } from '../core/player.service';
import { UiService, countdown, fmt } from '../core/ui.service';

export const ICONS: Record<string, string> = {
  play: 'M8 5v14l11-7z', pause: 'M7 5h3.5v14H7zM13.5 5H17v14h-3.5z',
  prev: 'M6 6h2v12H6zM9.5 12 18 18V6z', next: 'M16 6h2v12h-2zM6 18l8.5-6L6 6z',
  shuffle: 'M14.8 4H20v5.2l-2-2-3.6 3.6-1.4-1.4L16.6 5.8zM4 18.6 16.6 6l1.4 1.4L5.4 20zM13 14.4l1.4-1.4 3.6 3.6 2-2V20h-5.2l2-2z',
  repeat: 'M7 7h10v3l4-4-4-4v3H5v6h2zm10 10H7v-3l-4 4 4 4v-3h12v-6h-2z',
  heart: 'M12 21s-7.5-4.6-9.5-9.2C1.2 8.6 3.3 5 6.8 5c2 0 3.4 1.1 4.2 2.4h2C13.8 6.1 15.2 5 17.2 5c3.5 0 5.6 3.6 4.3 6.8C19.5 16.4 12 21 12 21z',
  heartO: 'M12 21s-7.5-4.6-9.5-9.2C1.2 8.6 3.3 5 6.8 5c2 0 3.4 1.1 4.2 2.4h2C13.8 6.1 15.2 5 17.2 5c3.5 0 5.6 3.6 4.3 6.8C19.5 16.4 12 21 12 21zm0-2.4c2.4-1.6 6.3-4.6 7.6-7.6.8-1.9-.3-4-2.4-4-1.5 0-2.5 1-3.2 2.3h-4C9.3 8 8.3 7 6.8 7 4.7 7 3.6 9.1 4.4 11c1.3 3 5.2 6 7.6 7.6z',
  more: 'M5 10a2 2 0 1 1 0 4 2 2 0 0 1 0-4zm7 0a2 2 0 1 1 0 4 2 2 0 0 1 0-4zm7 0a2 2 0 1 1 0 4 2 2 0 0 1 0-4z',
  queue: 'M3 6h12v2H3zm0 5h12v2H3zm0 5h8v2H3zm14-5v6.2a3 3 0 1 0 2 2.8V9h3V6h-5z',
  lyrics: 'M4 4h16v12H7l-3 3zm3 4v2h10V8zm0 4v2h7v-2z',
  chat: 'M4 4h16a1 1 0 0 1 1 1v11a1 1 0 0 1-1 1H9l-5 4v-4a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1zm3 5v2h10V9zm0 4v2h6v-2z',
  down: 'M12 16 6 10l1.4-1.4L12 13.2l4.6-4.6L18 10z', back: 'M15.5 4 7.5 12l8 8 1.4-1.4L10.3 12l6.6-6.6z',
  share: 'M18 16a3 3 0 0 0-2.4 1.2l-6.8-3.4a3 3 0 0 0 0-1.6l6.8-3.4A3 3 0 1 0 15 7l-6.8 3.4a3 3 0 1 0 0 3.2L15 17a3 3 0 1 0 3-1z',
  save: 'M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm5 11h-4v4h-2v-4H7v-2h4V7h2v4h4z',
  saved: 'M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm-1.4 14.2-4.2-4.2 1.4-1.4 2.8 2.8 5.8-5.8 1.4 1.4z',
  bell: 'M12 22a2.5 2.5 0 0 0 2.5-2.5h-5A2.5 2.5 0 0 0 12 22zm7-6V11a7 7 0 0 0-5.5-6.8V3h-3v1.2A7 7 0 0 0 5 11v5l-2 2v1h18v-1z',
  lock: 'M17 9V7A5 5 0 0 0 7 7v2H5v13h14V9zM9 7a3 3 0 0 1 6 0v2H9z', dl: 'M11 3h2v9.2l3.6-3.6L18 10l-6 6-6-6 1.4-1.4 3.6 3.6zM5 19h14v2H5z',
  home: 'M12 3 2 11h3v10h6v-6h2v6h6V11h3z', disc: 'M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm0 13a3 3 0 1 1 0-6 3 3 0 0 1 0 6z',
  spark: 'M12 2l2.4 7.6L22 12l-7.6 2.4L12 22l-2.4-7.6L2 12l7.6-2.4z', lib: 'M3 3h2v18H3zm5 0h2v18H8zm5.5.6 1.9-.6 5.6 17.7-1.9.6z',
  user: 'M12 12a5 5 0 1 0 0-10 5 5 0 0 0 0 10zm0 2c-5 0-9 2.5-9 6v2h18v-2c0-3.5-4-6-9-6z', bag: 'M7 7V6a5 5 0 0 1 10 0v1h3l-1 14H5L4 7zm2 0h6V6a3 3 0 0 0-6 0z',
  close: 'M18.3 5.7 12 12l6.3 6.3-1.4 1.4L10.6 13.4 4.3 19.7 2.9 18.3 9.2 12 2.9 5.7l1.4-1.4 6.3 6.3 6.3-6.3z', plus: 'M11 5h2v6h6v2h-6v6h-2v-6H5v-2h6z'
};

@Component({
  selector: 'ds-ico', standalone: true,
  template: `<svg viewBox="0 0 24 24" aria-hidden="true"><path [attr.d]="d()"/></svg>`,
  host: { class: 'ico' }
})
export class Ico { name = input.required<string>(); d = computed(() => ICONS[this.name()] || ''); }

/** Artwork with a placeholder and a GitHub fallback for just-uploaded files. */
@Component({
  selector: 'ds-art', standalone: true,
  template: `@if (src()) { <img [src]="src()" [alt]="alt()" loading="lazy" (error)="fallback($event)" /> } @else { <div class="ph"><span>{{ (alt() || '?')[0] }}</span></div> }`,
  host: { class: 'art' }
})
export class Art {
  src = input<string>(''); alt = input<string>('');
  fallback(e: Event) { const el = e.target as HTMLImageElement; if (el.dataset['raw']) return; const a = rawUrl(el.src); if (a) { el.dataset['raw'] = '1'; el.src = a; } }
}

@Component({
  selector: 'ds-status', standalone: true,
  template: `<span class="status st-{{ stage() }}">{{ label() }}</span>`
})
export class Status {
  stage = input.required<string>();
  label = computed(() => ({ teaser: 'Teaser', announced: 'Announced', upcoming: 'Upcoming', released: 'Out now' } as any)[this.stage()] || '');
}

@Component({
  selector: 'ds-countdown', standalone: true,
  template: `@if (c(); as c) {<div class="cd" [class.small]="small()">
    <div><b>{{ c.d }}</b><span>days</span></div><div><b>{{ pad(c.h) }}</b><span>hrs</span></div>
    <div><b>{{ pad(c.m) }}</b><span>min</span></div><div><b>{{ pad(c.s) }}</b><span>sec</span></div></div>}`
})
export class Countdown {
  private content = inject(ContentService);
  date = input<Date | null>(null); small = input(false);
  c = computed(() => countdown(this.date(), this.content.now()));
  pad = (n: number) => String(n).padStart(2, '0');
}

@Component({
  selector: 'ds-release-card', standalone: true, imports: [RouterLink, Art, Ico, Status],
  template: `
    <a class="rcard" [routerLink]="['/album', r().id]">
      <div class="rcard-art">
        <ds-art [src]="r().displayCover" [alt]="r().displayTitle" />
        @if (r().stage !== 'released') { <ds-status [stage]="r().stage" /> }
        @if (canPlay()) {
          <button class="fab" (click)="play($event)" [attr.aria-label]="'Play ' + r().displayTitle"><ds-ico [name]="player.isPlayingRelease(r()) ? 'pause' : 'play'" /></button>
        }
      </div>
      <p class="rcard-t">{{ r().displayTitle }}</p>
      <p class="rcard-s">{{ r().year }}{{ r().year ? ' · ' : '' }}{{ r().type }}@if (r().showTracklist && r().stage !== 'teaser') { · {{ r().tracks.length }} {{ r().tracks.length === 1 ? 'track' : 'tracks' }} }</p>
    </a>`
})
export class ReleaseCard {
  r = input.required<ViewRelease>();
  player = inject(PlayerService); content = inject(ContentService);
  canPlay = computed(() => this.r().showTracklist && this.r().tracks.length > 0 && !this.content.isLocked(this.r()));
  play(e: Event) {
    e.preventDefault(); e.stopPropagation();
    this.player.isPlayingRelease(this.r()) ? this.player.toggle() : this.player.playRelease(this.r());
  }
}

@Component({
  selector: 'ds-track-row', standalone: true, imports: [Ico, Art, RouterLink],
  template: `
    <div class="trow" [class.on]="player.isCurrent(t().id)" (click)="play()">
      <span class="trow-n">
        @if (player.isCurrent(t().id) && player.playing()) { <span class="eq"><i></i><i></i><i></i></span> }
        @else { <span class="num">{{ num() }}</span><ds-ico class="pi" name="play" /> }
      </span>
      @if (showArt()) { <ds-art class="trow-art" [src]="r().displayCover" /> }
      <div class="trow-t">
        <b>{{ content.title(t(), r()) }}</b>
        <small>
          @if (t().explicit) { <span class="exp" title="Explicit">E</span> }
          @if (!full()) { <span class="pv">Preview</span> }
          @if (sub()) { {{ sub() }} } @else if (showArt()) { <a [routerLink]="['/album', r().id]" (click)="$event.stopPropagation()">{{ r().displayTitle }}</a> }
        </small>
      </div>
      <span class="trow-d">{{ dur() }}</span>
      <button class="icon-btn like" [class.on]="lib.isLiked(t().id)" (click)="like($event)" aria-label="Like"><ds-ico [name]="lib.isLiked(t().id) ? 'heart' : 'heartO'" /></button>
      <button class="icon-btn" (click)="ui.openMenu(t().id, $event)" aria-label="More options"><ds-ico name="more" /></button>
    </div>`
})
export class TrackRow {
  t = input.required<Track>(); r = input.required<ViewRelease>(); num = input<number>(1);
  list = input<string[]>([]); showArt = input(false); sub = input('');
  player = inject(PlayerService); lib = inject(LibraryService); ui = inject(UiService); content = inject(ContentService);
  full = computed(() => this.content.isFull(this.t(), this.r()));
  dur = computed(() => (this.full() ? fmt(this.t().duration || 0) : '0:30'));
  play() {
    if (this.player.isCurrent(this.t().id)) return this.player.toggle();
    const ids = this.list().length ? this.list() : this.r().tracks.map((x) => x.id);
    this.player.playList(ids, this.t().id);
  }
  like(e: Event) { e.stopPropagation(); this.ui.toast(this.lib.toggle('liked', this.t().id) ? 'Added to Liked tracks' : 'Removed from Liked tracks'); }
}
