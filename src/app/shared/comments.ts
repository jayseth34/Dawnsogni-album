import { Component, computed, inject, input, signal } from '@angular/core';
import { CommentsService, ago } from '../core/comments.service';
import { LibraryService } from '../core/library.service';

@Component({
  selector: 'ds-comments', standalone: true,
  template: `
  @if (svc.enabled()) {
    <form class="cm-form" (submit)="send($event)">
      <div class="cm-av">{{ initial(name() || '?') }}</div>
      <div class="cm-fields">
        <input class="cm-name" [value]="name()" (input)="name.set(val($event))" placeholder="Your name" maxlength="40" required />
        <textarea [value]="text()" (input)="text.set(val($event))" placeholder="Say something about this song…" maxlength="600" rows="2" required></textarea>
        <input class="cm-hp" name="website" tabindex="-1" autocomplete="off" aria-hidden="true" (input)="hp = val($event)" />
        <div class="cm-bar">
          <small>{{ err() || (text().length > 500 ? 600 - text().length + ' left' : '') }}</small>
          <button class="btn red sm" [disabled]="sending() || !name().trim() || !text().trim()">{{ sending() ? 'Posting…' : 'Post' }}</button>
        </div>
      </div>
    </form>

    @if (list(); as l) {
      <p class="cm-count">{{ l.length }} {{ l.length === 1 ? 'comment' : 'comments' }}</p>
      <ul class="cm-list">
        @for (c of l; track c.id) {
          <li [class.mine]="c.mine">
            <div class="cm-av" [style.background]="hue(c.name)">{{ initial(c.name) }}</div>
            <div><p class="cm-h"><b>{{ c.name }}</b><small>{{ ago(c.time) }}</small></p><p class="cm-t">{{ c.text }}</p></div>
          </li>
        } @empty { <li class="cm-empty">No comments yet — be the first.</li> }
      </ul>
    } @else { <p class="cm-count muted">Loading comments…</p> }
  } @else { <p class="muted">Comments aren't switched on yet.</p> }`
})
export class Comments {
  svc = inject(CommentsService); lib = inject(LibraryService);
  track = input.required<string>();
  list = computed(() => this.svc.list(this.track())());
  name = signal(localStorage.getItem('ds_cmname') || this.lib.profile().name || '');
  text = signal(''); sending = signal(false); err = signal('');
  hp = ''; private last = 0;
  ago = ago;
  val = (e: Event) => (e.target as HTMLInputElement).value;
  initial = (n: string) => n.trim().charAt(0).toUpperCase() || '?';
  hue(n: string) { let h = 0; for (const ch of n) h = (h * 31 + ch.charCodeAt(0)) % 360; return `linear-gradient(135deg, hsl(${h} 55% 38%), hsl(${(h + 40) % 360} 60% 22%))`; }

  async send(e: Event) {
    e.preventDefault();
    if (Date.now() - this.last < 15000) { this.err.set('Wait a few seconds before posting again'); return; }
    this.sending.set(true); this.err.set('');
    const n = this.name().trim(); localStorage.setItem('ds_cmname', n);
    const er = await this.svc.post(this.track(), n, this.text().trim(), this.hp);
    this.sending.set(false);
    if (er) this.err.set(er); else { this.text.set(''); this.last = Date.now(); }
  }
}
