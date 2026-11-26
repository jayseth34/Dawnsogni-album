import { Component, computed, effect, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ContentService } from '../core/content.service';
import { PlayerService } from '../core/player.service';
import { ViewRelease } from '../core/models';
import { Art, Ico } from '../shared/shared';

const CATS = [['all', 'All'], ['Album', 'Albums'], ['EP', 'EPs'], ['Single', 'Singles'], ['Deluxe', 'Deluxe']] as const;

@Component({
  selector: 'ds-albums', standalone: true, imports: [RouterLink, Art, Ico],
  host: { '(window:keydown)': 'key($event)' },
  template: `
  <section class="alx" (touchstart)="tStart($event)" (touchend)="tEnd($event)">
    <svg class="alx-fire" viewBox="0 0 1200 700" preserveAspectRatio="none" aria-hidden="true">
      <defs>
        <linearGradient id="alxG" x1="0" y1="0" x2="1" y2="0.3">
          <stop offset="0" stop-color="#54151D" /><stop offset="0.35" stop-color="#B32626" />
          <stop offset="0.7" stop-color="#e2502a" /><stop offset="1" stop-color="#f29a2e" />
        </linearGradient>
        <linearGradient id="alxM" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0.08" stop-color="#000" /><stop offset="0.45" stop-color="#fff" /><stop offset="1" stop-color="#fff" />
        </linearGradient>
        <mask id="alxMask"><rect width="1200" height="700" fill="url(#alxM)" /></mask>
        <filter id="alxStreak" x="0" y="0" width="100%" height="100%">
          <feTurbulence type="fractalNoise" baseFrequency="0.011 0.0009" numOctaves="5" seed="7" result="n" />
          <feColorMatrix in="n" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 26 -12.4" result="a" />
          <feComposite in="SourceGraphic" in2="a" operator="in" />
        </filter>
        <filter id="alxDust" x="0" y="0" width="100%" height="100%">
          <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="1" seed="3" result="n" />
          <feColorMatrix in="n" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 22 -14.6" result="a" />
          <feComposite in="SourceGraphic" in2="a" operator="in" />
        </filter>
      </defs>
      <g mask="url(#alxMask)">
        <rect width="1200" height="700" fill="url(#alxG)" filter="url(#alxStreak)" />
        <rect width="1200" height="700" fill="#f2a04a" filter="url(#alxDust)" opacity="0.55" />
      </g>
    </svg>

    <div class="alx-top">
      <span>{{ content.out().length }} {{ content.out().length === 1 ? 'release' : 'releases' }}</span>
      <h1>Albums</h1>
      <span>{{ content.raw().artist.name || 'Dawn Sogni' }} {{ span() }}</span>
    </div>

    @if (cats().length > 1) {
      <div class="alx-chips" role="tablist">@for (c of cats(); track c[0]) {
        <button role="tab" [class.on]="cat() === c[0]" (click)="cat.set(c[0])">{{ c[1] }}</button>
      }</div>
    }

    @if (cur(); as r) {
      <div class="alx-row">
        <div class="alx-side left">@for (x of before(); track x.r.id) {
          <button class="alx-spine" (click)="go(x.i)" [attr.aria-label]="x.r.displayTitle">
            <span class="alx-thumb"><ds-art [src]="x.r.displayCover" [alt]="x.r.displayTitle" /></span>
            <span class="alx-vt">{{ x.r.displayTitle }}</span>
          </button>
        }</div>

        @for (k of [r.id]; track k) {
          <a class="alx-card" [routerLink]="['/album', r.id]">
            <ds-art [src]="r.displayCover" [alt]="r.displayTitle" />
            <span class="alx-shade"></span>
            <h2>{{ r.displayTitle }}</h2>
            <span class="alx-meta">{{ r.type }}{{ r.year ? ' · ' + r.year : '' }}</span>
            @if (canPlay(r)) {
              <button class="alx-play" (click)="play($event, r)" [attr.aria-label]="'Play ' + r.displayTitle">
                <ds-ico [name]="player.isPlayingRelease(r) ? 'pause' : 'play'" />
              </button>
            }
            <span class="alx-see">See album ↗</span>
          </a>
        }

        <div class="alx-side right">@for (x of after(); track x.r.id) {
          <button class="alx-spine" (click)="go(x.i)" [attr.aria-label]="x.r.displayTitle">
            <span class="alx-thumb"><ds-art [src]="x.r.displayCover" [alt]="x.r.displayTitle" /></span>
            <span class="alx-vt">{{ x.r.displayTitle }}</span>
          </button>
        }</div>
      </div>

      <div class="alx-nav">
        <button (click)="go(idx() - 1)" [disabled]="idx() === 0" aria-label="Previous">←</button>
        <span>{{ idx() + 1 }} / {{ list().length }}</span>
        <button (click)="go(idx() + 1)" [disabled]="idx() >= list().length - 1" aria-label="Next">→</button>
      </div>
    } @else {
      <p class="alx-empty">Nothing here yet.</p>
    }
  </section>`
})
export class Albums {
  content = inject(ContentService); player = inject(PlayerService);
  cat = signal<string>('all');
  idx = signal(0);
  count = (c: string) => this.content.out().filter((r) => c === 'all' || r.type === c).length;
  cats = computed(() => CATS.filter((c) => c[0] === 'all' || this.count(c[0]) > 0));
  list = computed(() => this.content.out().filter((r) => this.cat() === 'all' || r.type === this.cat()));
  cur = computed(() => this.list()[this.idx()] ?? null);
  before = computed(() => this.list().map((r, i) => ({ r, i })).slice(0, this.idx()));
  after = computed(() => this.list().map((r, i) => ({ r, i })).slice(this.idx() + 1));
  span = computed(() => {
    const ys = this.content.out().map((r) => +r.year).filter(Boolean);
    if (!ys.length) return '';
    const a = Math.min(...ys), b = Math.max(...ys);
    return a === b ? `· ${a}` : `· ${a}–${b}`;
  });
  private tx = 0;

  constructor() { effect(() => { this.cat(); this.idx.set(0); }); }

  go(i: number) { this.idx.set(Math.max(0, Math.min(this.list().length - 1, i))); }
  canPlay = (r: ViewRelease) => r.showTracklist && r.tracks.length > 0 && !this.content.isLocked(r);
  play(e: Event, r: ViewRelease) {
    e.preventDefault(); e.stopPropagation();
    this.player.isPlayingRelease(r) ? this.player.toggle() : this.player.playRelease(r);
  }
  key(e: KeyboardEvent) {
    const t = e.target as HTMLElement;
    if (t?.closest('input, textarea, [contenteditable]') || this.player.open()) return;
    if (e.key === 'ArrowLeft') this.go(this.idx() - 1);
    if (e.key === 'ArrowRight') this.go(this.idx() + 1);
  }
  tStart(e: TouchEvent) { this.tx = e.touches[0].clientX; }
  tEnd(e: TouchEvent) {
    const d = e.changedTouches[0].clientX - this.tx;
    if (Math.abs(d) > 50) this.go(this.idx() + (d < 0 ? 1 : -1));
  }
}
