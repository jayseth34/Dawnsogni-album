import { Component, inject, signal } from '@angular/core';
import { NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { filter } from 'rxjs';
import { ContentService } from './core/content.service';
import { LibraryService } from './core/library.service';
import { PlayerService } from './core/player.service';
import { Ico } from './shared/shared';
import { Overlays, PlayerFull, PlayerMini } from './shared/player-ui';

const TABS = [['/', 'Home', 'home'], ['/albums', 'Albums', 'disc'], ['/releases', 'Releases', 'spark'], ['/library', 'Library', 'lib'], ['/profile', 'Profile', 'user']] as const;

@Component({
  selector: 'app-root', standalone: true,
  imports: [RouterOutlet, RouterLink, RouterLinkActive, Ico, PlayerFull, PlayerMini, Overlays],
  template: `
  @if (!content.loaded()) {
    <div class="splash"><img src="assets/ds-logo-dark.png" alt="Dawn Sogni" /><i></i></div>
  }
  @if (admin()) { <router-outlet /> } @else {
  <div class="shell" [class.has-player]="!!player.current()">
    <header class="top">
      <a routerLink="/" class="logo" aria-label="Home"><img src="assets/ds-logo-dark.png" alt="Dawn Sogni" /></a>
      <nav class="tabs-top">
        @for (t of tabs; track t[0]) {
          <a [routerLink]="t[0]" routerLinkActive="on" [routerLinkActiveOptions]="{ exact: t[0] === '/' }">{{ t[1] }}</a>
        }
      </nav>
      <div class="top-r">
        @if (content.raw().shopUrl) { <a class="btn ghost sm" [href]="content.raw().shopUrl" target="_blank" rel="noopener">Shop</a> }
        <a routerLink="/profile" class="me" aria-label="Profile">
          @if (lib.profile().avatar) { <img [src]="lib.profile().avatar" alt="" /> } @else { <ds-ico name="user" /> }
        </a>
      </div>
    </header>

    <main class="page" [class.enter]="anim()">
      <router-outlet (activate)="routed()" />
    </main>

    <ds-player-mini />
    <nav class="tabs-bottom">
      @for (t of tabs; track t[0]) {
        <a [routerLink]="t[0]" routerLinkActive="on" [routerLinkActiveOptions]="{ exact: t[0] === '/' }"><ds-ico [name]="t[2]" /><span>{{ t[1] }}</span></a>
      }
    </nav>
  </div>
  <ds-player-full />
  }
  <ds-overlays />`
})
export class App {
  content = inject(ContentService); lib = inject(LibraryService); player = inject(PlayerService); router = inject(Router);
  tabs = TABS;
  anim = signal(false);
  admin = signal(location.hash.startsWith('#/admin'));
  constructor() {
    this.router.events.pipe(filter((e) => e instanceof NavigationEnd)).subscribe((e: any) => this.admin.set(e.urlAfterRedirects.startsWith('/admin')));
  }
  routed() { this.anim.set(false); requestAnimationFrame(() => { this.anim.set(true); scrollTo({ top: 0 }); }); }
}
