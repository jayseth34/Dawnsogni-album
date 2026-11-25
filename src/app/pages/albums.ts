import { Component, computed, inject, signal } from '@angular/core';
import { ContentService } from '../core/content.service';
import { ReleaseCard } from '../shared/shared';

const CATS = [['all', 'All'], ['Album', 'Albums'], ['EP', 'EPs'], ['Single', 'Singles'], ['Deluxe', 'Deluxe editions']] as const;

@Component({
  selector: 'ds-albums', standalone: true, imports: [ReleaseCard],
  template: `
  <header class="page-head"><p class="kicker">Discography</p><h1 class="goth">Albums</h1></header>
  <div class="chips">@for (c of cats(); track c[0]) {
    <button [class.on]="cat() === c[0]" (click)="cat.set(c[0])">{{ c[1] }} <span>{{ count(c[0]) }}</span></button>
  }</div>
  @if (list().length) { <div class="grid">@for (r of list(); track r.id) { <ds-release-card [r]="r" /> }</div> }
  @else { <p class="empty-state">Nothing here yet.</p> }`
})
export class Albums {
  content = inject(ContentService);
  cat = signal<string>('all');
  count = (c: string) => this.content.out().filter((r) => c === 'all' || r.type === c).length;
  cats = computed(() => CATS.filter((c) => c[0] === 'all' || this.count(c[0]) > 0));
  list = computed(() => this.content.out().filter((r) => this.cat() === 'all' || r.type === this.cat()));
}
