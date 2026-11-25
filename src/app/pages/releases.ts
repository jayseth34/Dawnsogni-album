import { Component, computed, inject } from '@angular/core';
import { DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { ContentService } from '../core/content.service';
import { LibraryService } from '../core/library.service';
import { ViewRelease } from '../core/models';
import { PlayerService } from '../core/player.service';
import { UiService } from '../core/ui.service';
import { Art, Countdown, Ico, ReleaseCard, Status } from '../shared/shared';

/** Pre-save: remember the release on this device and offer a calendar reminder (.ics). */
export function calendarFile(r: ViewRelease) {
  if (!r.date) return;
  const d = r.date.toISOString().replace(/[-:]/g, '').replace(/\.\d+Z$/, 'Z');
  const ics = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Dawn Sogni//EN', 'BEGIN:VEVENT', `UID:${r.id}@dawnsogni`, `DTSTAMP:${d}`, `DTSTART:${d}`, `DURATION:PT1H`,
    `SUMMARY:${r.displayTitle} — out now`, `DESCRIPTION:${location.href.split('#')[0]}#/album/${r.id}`, 'END:VEVENT', 'END:VCALENDAR'].join('\r\n');
  const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([ics], { type: 'text/calendar' })); a.download = `${r.displayTitle}.ics`; a.click();
}

@Component({
  selector: 'ds-releases', standalone: true, imports: [RouterLink, DatePipe, Art, Ico, Status, Countdown, ReleaseCard],
  template: `
  <header class="page-head"><p class="kicker">Announcements</p><h1 class="goth">Releases</h1></header>

  @for (r of content.upcoming(); track r.id) {
    <article class="rel-ann" [class.teaser]="r.stage === 'teaser'">
      <a class="rel-ann-art" [routerLink]="['/album', r.id]"><ds-art [src]="r.displayCover" [alt]="r.displayTitle" />
        @if (r.stage === 'teaser') { <span class="mystery">?</span> }</a>
      <div class="rel-ann-info">
        <div class="row-gap"><ds-status [stage]="r.stage" /><span class="muted">{{ r.type }}</span></div>
        <h2 class="goth">{{ r.displayTitle }}</h2>
        @if (r.stage === 'teaser') { <p class="desc">{{ r.teaserText || 'Something new is on the way.' }}</p> }
        @else if (r.description) { <p class="desc clamp">{{ r.description }}</p> }
        @if (r.date && r.stage !== 'teaser') { <p class="date">Out {{ r.date | date: 'EEEE d MMMM y, HH:mm' }}</p> }
        @if (r.date) { <ds-countdown [date]="r.date" /> }
        @if (r.stage === 'upcoming' && r.tracks.length) {
          <ol class="ann-tracks">@for (t of r.tracks; track t.id) { <li>{{ t.title }}@if (t.unlocked) { <span class="pv out">Out now</span> }@if (t.explicit) { <span class="exp">E</span> }</li> }</ol>
        }
        <div class="btns">
          @if (r.showTracklist && r.tracks.length && !content.isLocked(r)) {
            <button class="btn red" (click)="player.playRelease(r)"><ds-ico name="play" />{{ r.stage === 'teaser' ? 'Hear a preview' : 'Play previews' }}</button>
          }
          @if (r.stage !== 'teaser') {
            <button class="btn ghost" [class.on]="lib.reminders().includes(r.id)" (click)="presave(r)"><ds-ico [name]="lib.reminders().includes(r.id) ? 'saved' : 'bell'" />{{ lib.reminders().includes(r.id) ? 'Pre-saved' : 'Pre-save' }}</button>
          }
          <a class="btn ghost" [routerLink]="['/album', r.id]">Details</a>
        </div>
      </div>
    </article>
  } @empty { <p class="empty-state">No announcements right now — check back soon.</p> }

  @if (recentOut().length) {
    <section class="shelf"><header><h3>Recently released</h3></header>
      <div class="cards">@for (r of recentOut(); track r.id) { <ds-release-card [r]="r" /> }</div></section>
  }`
})
export class Releases {
  content = inject(ContentService); lib = inject(LibraryService); player = inject(PlayerService); ui = inject(UiService);
  recentOut = computed(() => this.content.out().slice(0, 8));
  presave(r: ViewRelease) {
    const on = this.lib.toggle('reminders', r.id);
    if (on) { this.lib.saved().includes(r.id) || this.lib.toggle('saved', r.id); this.ui.toast('Pre-saved — added to your library'); calendarFile(r); }
    else this.ui.toast('Pre-save removed');
  }
}
