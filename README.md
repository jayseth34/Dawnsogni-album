# Dawn Sogni — Music Site

Frontend-only music site (HTML, CSS, vanilla JS, no build step) on GitHub Pages.

- **Site:** https://jayseth34.github.io/Dawnsogni-album/
- **Admin:** https://jayseth34.github.io/Dawnsogni-album/admin.html
- **Shop:** links out to https://jayseth34.github.io/DawnSogniWeb/

## Adding music
1. Create a fine-grained GitHub token (https://github.com/settings/personal-access-tokens/new):
   only this repository, **Contents: Read and write** (optional **Pages: Read**).
2. Open `/admin.html`, paste the token, **Connect**.
3. **Albums** tab: create an album (title, type, date, description, cover).
4. **Songs** tab: add a song, upload the audio, choose its album (or leave it as a single), add cover, lyrics, lyric video.
5. **Publish**: files go to `media/`, text to `content.json`; the site updates in about a minute.

Files over ~45 MB can't be uploaded from the browser — compress videos first.

## Files
- `index.html`, `styles.css`, `app.js` — the site (reads `content.json`)
- `admin.html`, `admin.css`, `admin.js` — the admin panel
- `assets/` — logo, `media/` — uploaded songs, covers and videos
