# Dawn Sogni — Album Site

Frontend-only album page for **Dawn Sogni** (HTML, CSS, vanilla JS — no build step).

Live: https://jayseth34.github.io/Dawnsogni-album/

## Edit content
Everything (album title, release date, tracks, videos, drops, products, order email) lives in **`data.js`**.

- Real audio: put mp3s in `audio/` and set each track's `src` (e.g. `"audio/01.mp3"`). Without `src`, a generated ambient preview plays.
- Videos: set `youtube` to a YouTube video ID.
- Checkout & custom orders open the visitor's mail app addressed to `orderEmail`.
- Bag, reminders and sign-ups are stored in the visitor's browser (localStorage).

## Run locally
Open `index.html`, or `python3 -m http.server` and visit http://localhost:8000.
