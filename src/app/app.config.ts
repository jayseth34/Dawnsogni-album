import { ApplicationConfig, provideBrowserGlobalErrorListeners, provideZonelessChangeDetection } from '@angular/core';
import { provideRouter, withComponentInputBinding, withHashLocation, Routes } from '@angular/router';
import { Home } from './pages/home';
import { Albums } from './pages/albums';
import { Releases } from './pages/releases';
import { Album, TrackLink } from './pages/album';
import { Library } from './pages/library';
import { ProfilePage } from './pages/profile';

const routes: Routes = [
  { path: '', component: Home, title: 'Dawn Sogni' },
  { path: 'albums', component: Albums, title: 'Albums — Dawn Sogni' },
  { path: 'releases', component: Releases, title: 'Releases — Dawn Sogni' },
  { path: 'library', component: Library, title: 'Library — Dawn Sogni' },
  { path: 'profile', component: ProfilePage, title: 'Profile — Dawn Sogni' },
  { path: 'album/:id', component: Album, title: 'Dawn Sogni' },
  { path: 'track/:id', component: TrackLink },
  { path: 'admin', loadComponent: () => import('./admin/admin').then((m) => m.Admin), title: 'Admin — Dawn Sogni' },
  { path: '**', redirectTo: '' }
];

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideZonelessChangeDetection(),
    provideRouter(routes, withHashLocation(), withComponentInputBinding())
  ]
};
