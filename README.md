# DAWN SOGNI — Music Streaming Platform

The official home for Dawn Sogni releases: albums, EPs, singles, release announcements,
a cinematic player with synced lyrics, and a listener library.

- **Live site:** https://jayseth34.github.io/Dawnsogni-album/
- **Admin dashboard:** https://jayseth34.github.io/Dawnsogni-album/#/admin

## How it's built
- **Frontend:** Angular 20 (standalone components, signals, zoneless), hash routing for GitHub Pages.
- **Content:** `content.json` + `media/` on the `gh-pages` branch, edited through the admin dashboard
  (GitHub REST API — every publish is one commit). The site reads the newest content straight from GitHub,
  so publishes show instantly.
- **Listener data** (likes, saved albums, playlists, history, downloads, profile) is stored on the listener's device.
- **Media processing** in the admin runs in the browser with ffmpeg.wasm. Its files (`vendor/ffmpeg`, ~32 MB) live on
  `gh-pages` and are not duplicated here.

## Release stages
| Status | What listeners see |
|---|---|
| Teaser | Teaser artwork, teaser text, 30-second previews; title and tracklist hidden |
| Announced | Title, artwork, release date + countdown, credits, pre-save |
| Upcoming | Tracklist revealed, previews; tracks marked "Out before release" play in full |
| Released | OUT NOW — everything playable. Announced/Upcoming switch automatically at the release date |

## Develop
```bash
npm install
npx ng serve        # http://localhost:4200
scripts/deploy.sh   # build + publish to gh-pages (keeps content.json, media/ and vendor/)
```
