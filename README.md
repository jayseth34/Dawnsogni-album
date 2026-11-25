# Dawn Sogni — Album Site

Frontend-only album world for **Dawn Sogni** (HTML, CSS, vanilla JS, no build step), hosted on GitHub Pages.

- **Site:** https://jayseth34.github.io/Dawnsogni-album/
- **Admin:** https://jayseth34.github.io/Dawnsogni-album/admin.html

## Publishing content (admin panel)
1. Create a fine-grained GitHub token (https://github.com/settings/personal-access-tokens/new)
   - Repository access: **Only select repositories → Dawnsogni-album**
   - Permissions: **Contents: Read and write** (optional: **Pages: Read**)
2. Open `/admin.html`, paste the token, press **Connect**.
3. Add album title/description, songs (MP3), videos, products, drops, links → **Publish**.
   Files go to `media/`, text goes to `content.json`; the live site updates in ~1 minute.

The token is stored only in your browser. Files over ~45 MB can't be uploaded from the browser.

## Files
- `index.html`, `styles.css`, `app.js` — the site (reads `content.json`)
- `art.js` — generated chrome visuals used when a card has no image/video
- `admin.html`, `admin.css`, `admin.js` — the admin panel
- `assets/` — logos and the intro video
