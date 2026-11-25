/* =========================================================
   DAWN SOGNI — SITE CONTENT
   Edit this file to update the album, tracks, drops and shop.
   ========================================================= */
window.DS_DATA = {
  albumTitle: "Sogni Vol. I",
  // ISO date/time of the release (countdown target)
  releaseDate: "2027-01-01T00:00:00+05:30",

  // Contact used for checkout & custom orders (opens the visitor's mail app)
  orderEmail: "orders@dawnsogni.com",

  marquee: ["SOGNI VOL. I", "OUT SOON", "CHROME DREAMS", "DAWN SOGNI", "CUSTOM ORDERS OPEN"],

  // Tracks: set `src` to an mp3 path (e.g. "audio/01.mp3") to play real audio.
  // Without `src`, a generated ambient preview plays instead.
  tracks: [
    { title: "First Light",      length: 30, src: "", seed: [220, 277.18, 329.63] },
    { title: "Chrome Halo",      length: 30, src: "", seed: [196, 246.94, 293.66] },
    { title: "Sogni",            length: 30, src: "", seed: [174.61, 220, 261.63] },
    { title: "Mercury Rain",     length: 30, src: "", seed: [164.81, 207.65, 246.94] },
    { title: "After Hours",      length: 30, src: "", seed: [146.83, 185, 220] },
    { title: "Silver Tongue",    length: 30, src: "", seed: [233.08, 293.66, 349.23] },
    { title: "Dawn (Outro)",     length: 30, src: "", seed: [130.81, 164.81, 196] }
  ],

  // Visuals: set `youtube` to a YouTube video ID to embed it.
  visuals: [
    { title: "Chrome Halo", tag: "OFFICIAL VIDEO", youtube: "" },
    { title: "First Light", tag: "VISUALIZER", youtube: "" },
    { title: "Behind The Drop", tag: "FILM", youtube: "" },
    { title: "Sogni", tag: "LYRIC VIDEO", youtube: "" }
  ],

  drops: [
    { date: "2026-12-12", title: "Vol. I Merch — Capsule 01", place: "ONLINE", status: "NOTIFY" },
    { date: "2026-12-20", title: "Listening Session", place: "MUMBAI, IN", status: "RSVP" },
    { date: "2027-01-01", title: "Album Release", place: "ALL PLATFORMS", status: "PRE-SAVE" },
    { date: "2027-01-15", title: "Pop-up Store", place: "BERLIN, DE", status: "NOTIFY" }
  ],

  // Shop products — `hue` tints the generated product visual.
  products: [
    { id: "tee-chrome",  name: "CHROME LOGO TEE",     price: 1999, type: "tee",    hue: 0,   sizes: ["S","M","L","XL"] },
    { id: "hoodie-dawn", name: "DAWN HOODIE",         price: 3999, type: "hoodie", hue: 0,   sizes: ["S","M","L","XL"] },
    { id: "tee-sogni",   name: "SOGNI TRACKLIST TEE", price: 2199, type: "tee",    hue: 220, sizes: ["S","M","L","XL"] },
    { id: "cap-ds",      name: "DS CAP",              price: 1499, type: "cap",    hue: 0,   sizes: ["OS"] },
    { id: "vinyl-1",     name: "VOL. I VINYL",        price: 2999, type: "vinyl",  hue: 0,   sizes: ["LP"] },
    { id: "jacket-merc", name: "MERCURY JACKET",      price: 6999, type: "hoodie", hue: 200, sizes: ["M","L","XL"] }
  ],
  currency: "₹"
};
