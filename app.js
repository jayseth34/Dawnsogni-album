/* Dawn Sogni — music app: songs, covers, lyrics. Content lives in content.json (edit it in /admin.html). */
(async () => {
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const esc = (v) => String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const fmt = (s) => (isFinite(s) && s > 0 ? `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}` : "0:00");
  const P = '<svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>';
  const PAUSE_D = "M7 5h3.5v14H7zM13.5 5H17v14h-3.5z", PLAY_D = "M8 5v14l11-7z";

  /* ---------- Content: newest version straight from GitHub, so publishes show instantly ---------- */
  const onPages = location.hostname.endsWith(".github.io");
  const OWNER = onPages ? location.hostname.split(".")[0] : "jayseth34";
  const REPO = onPages ? location.pathname.split("/")[1] || "dawnsogni-album" : "dawnsogni-album";
  const RAW = `https://raw.githubusercontent.com/${OWNER}/${REPO}/gh-pages/`;
  let C = { songs: [] };
  try {
    const r = await fetch(`https://api.github.com/repos/${OWNER}/${REPO}/contents/content.json?ref=gh-pages&t=${Date.now()}`, { headers: { Accept: "application/vnd.github.raw+json" }, cache: "no-store" });
    if (!r.ok) throw 0; C = await r.json();
  } catch { try { C = await (await fetch("content.json?v=" + Date.now(), { cache: "no-store" })).json(); } catch {} }
  const songs = (C.songs || []).filter((s) => s.audio && s.title);
  if (C.shopUrl) { $("#shop").href = C.shopUrl; $("#shop").hidden = false; }

  // a file uploaded seconds ago may not be on Pages yet: load it from GitHub directly
  const rawUrl = (u) => { try { const x = new URL(u, location.href), i = x.pathname.indexOf("/media/"); return i >= 0 && x.origin === location.origin ? RAW + x.pathname.slice(i + 1) : null; } catch { return null; } };
  document.addEventListener("error", (e) => { const el = e.target; if (el.tagName === "IMG" && !el.dataset.raw) { const alt = rawUrl(el.src); if (alt) { el.dataset.raw = 1; el.src = alt; } } }, true);

  const art = (s) => (s.cover ? `<img src="${esc(s.cover)}" alt="" loading="lazy" />` : `<div class="ph">${esc((s.title || "?")[0])}</div>`);

  /* ---------- Lyrics (plain, or synced with [mm:ss.xx] timestamps) ---------- */
  const TS = /^\s*\[(\d+):(\d+(?:\.\d+)?)\]\s?(.*)$/;
  function parseLyrics(text) {
    const lines = String(text || "").replace(/\r/g, "").split("\n").map((l) => { const m = l.match(TS); return m ? { t: +m[1] * 60 + +m[2], text: m[3] } : { t: null, text: l }; });
    const stamped = lines.filter((l) => l.t !== null).length;
    const synced = stamped > 0 && stamped >= lines.filter((l) => l.text.trim()).length * 0.6;
    return { synced, lines: synced ? lines.filter((l) => l.t !== null) : lines };
  }
  function lyricsHTML(s) {
    if (!s.lyrics || !s.lyrics.trim()) return `<p class="no-lyrics">Lyrics coming soon.</p>`;
    const L = parseLyrics(s.lyrics);
    return `<div class="ly ${L.synced ? "synced" : ""}" data-song="${esc(s.id)}">${L.lines.map((l, i) => {
      const t = l.text.trim();
      if (!t) return `<div class="ly-line gap"></div>`;
      const tag = /^\[.*\]$/.test(t);
      return `<p class="ly-line ${tag ? "tag" : ""}" data-i="${i}" ${l.t !== null ? `data-t="${l.t}"` : ""}>${esc(tag ? t.slice(1, -1) : t)}</p>`;
    }).join("")}</div>`;
  }

  /* ---------- Views ---------- */
  const view = $("#view");
  function home() {
    document.title = "Dawn Sogni";
    if (!songs.length) return `<div class="wrap empty"><h1>Soon</h1><p>New music on the way.</p></div>`;
    return `<div class="wrap"><h1 class="page-h">Music</h1><div class="grid">${songs.map((s) => `
      <div class="song" data-open="${esc(s.id)}">
        <div class="art">${art(s)}<button class="go" data-play="${esc(s.id)}" aria-label="Play ${esc(s.title)}">${P}</button></div>
        <p class="t">${esc(s.title)}</p>${s.date ? `<p class="s">${esc(String(s.date).slice(0, 4))}</p>` : ""}
      </div>`).join("")}</div></div>`;
  }
  function songPage(s) {
    document.title = `${s.title} — Dawn Sogni`;
    return `<div class="sp-bg" style="${s.cover ? `background-image:url('${esc(s.cover)}')` : ""}"></div>
      <div class="wrap">
        <a class="back" href="#/">← All music</a>
        <section class="sp-head">
          <div class="sp-art">${art(s)}</div>
          <div><p class="sp-kind">Song${s.date ? " · " + esc(String(s.date).slice(0, 4)) : ""}</p><h1>${esc(s.title)}</h1>
            <button class="big-play" data-play="${esc(s.id)}">${P}<span>Play</span></button></div>
        </section>
        <section class="lyrics"><h2>Lyrics</h2>${lyricsHTML(s)}</section>
      </div>`;
  }
  function route() {
    const id = decodeURIComponent((location.hash.match(/^#\/song\/(.+)$/) || [])[1] || "");
    const s = songs.find((x) => x.id === id);
    view.innerHTML = s ? songPage(s) : home();
    scrollTo(0, 0); mark(); syncLyrics(true);
  }
  addEventListener("hashchange", route);

  /* ---------- Player ---------- */
  const audio = new Audio(); audio.preload = "auto";
  let cur = -1;
  function play(i) {
    if (i === cur) return audio.paused ? audio.play() : audio.pause();
    cur = (i + songs.length) % songs.length;
    const s = songs[cur];
    delete audio.dataset.raw; audio.src = s.audio; audio.play().catch(() => {});
    $("#player").hidden = false;
    $("#p-cover").src = s.cover || "assets/ds-logo-sm.png";
    $("#p-title").textContent = s.title;
    if ("mediaSession" in navigator) {
      navigator.mediaSession.metadata = new MediaMetadata({ title: s.title, artist: "Dawn Sogni", artwork: s.cover ? [{ src: new URL(s.cover, location.href).href, sizes: "1500x1500", type: "image/jpeg" }] : [] });
      navigator.mediaSession.setActionHandler("previoustrack", () => play(cur - 1));
      navigator.mediaSession.setActionHandler("nexttrack", () => play(cur + 1));
    }
    mark();
  }
  audio.addEventListener("error", () => { const alt = !audio.dataset.raw && rawUrl(audio.src); if (alt) { audio.dataset.raw = 1; audio.src = alt; audio.play().catch(() => {}); } });
  audio.addEventListener("play", mark); audio.addEventListener("pause", mark);
  audio.addEventListener("ended", () => (cur < songs.length - 1 ? play(cur + 1) : mark()));
  audio.addEventListener("timeupdate", () => {
    $("#fill").style.width = (audio.duration ? (audio.currentTime / audio.duration) * 100 : 0) + "%";
    $("#p-time").textContent = `${fmt(audio.currentTime)} / ${fmt(audio.duration)}`;
    syncLyrics();
  });
  function mark() {
    const on = !audio.paused && cur >= 0, id = songs[cur]?.id;
    $("#play-ico").setAttribute("d", on ? PAUSE_D : PLAY_D);
    $$(".song").forEach((el) => el.classList.toggle("playing", el.dataset.open === id && on));
    $$("[data-play]").forEach((b) => { const playing = b.dataset.play === id && on; b.querySelector("svg").innerHTML = `<path d="${playing ? PAUSE_D : PLAY_D}"/>`; const t = b.querySelector("span"); if (t) t.textContent = playing ? "Pause" : "Play"; });
  }
  $("#play").onclick = () => (cur < 0 ? play(0) : audio.paused ? audio.play() : audio.pause());
  $("#prev").onclick = () => (audio.currentTime > 3 ? (audio.currentTime = 0) : play(cur - 1));
  $("#next").onclick = () => play(cur + 1);
  $("#seek").onclick = (e) => { if (!audio.duration) return; const r = e.currentTarget.getBoundingClientRect(); audio.currentTime = ((e.clientX - r.left) / r.width) * audio.duration; };
  const openCur = () => { if (cur >= 0) location.hash = "#/song/" + encodeURIComponent(songs[cur].id); };
  $("#p-cover").onclick = openCur; $("#p-meta").onclick = openCur;

  /* synced lyrics: highlight + follow the current line */
  let lastScroll = 0;
  ["wheel", "touchmove"].forEach((ev) => addEventListener(ev, () => (lastScroll = Date.now()), { passive: true }));
  function syncLyrics(force) {
    const box = $(".ly.synced"); if (!box) return;
    const lines = $$(".ly-line[data-t]", box), mine = cur >= 0 && box.dataset.song === songs[cur].id;
    let idx = -1; if (mine) { const t = audio.currentTime + 0.15; lines.forEach((l, i) => { if (+l.dataset.t <= t) idx = i; }); }
    if (!force && String(idx) === box.dataset.last) return;
    box.dataset.last = idx;
    lines.forEach((l, i) => { l.classList.toggle("on", i === idx); l.classList.toggle("past", idx >= 0 && i < idx); });
    if (idx >= 0 && Date.now() - lastScroll > 2500) lines[idx].scrollIntoView({ block: "center", behavior: "smooth" });
  }

  /* ---------- Clicks ---------- */
  document.addEventListener("click", (e) => {
    const p = e.target.closest("[data-play]"), o = e.target.closest("[data-open]"), l = e.target.closest(".synced .ly-line[data-t]");
    if (p) { e.stopPropagation(); return play(songs.findIndex((s) => s.id === p.dataset.play)); }
    if (l) { const i = songs.findIndex((s) => s.id === l.closest(".ly").dataset.song); if (i !== cur) play(i); const go = () => (audio.currentTime = +l.dataset.t); audio.readyState ? go() : audio.addEventListener("loadedmetadata", go, { once: true }); return audio.play(); }
    if (o) location.hash = "#/song/" + encodeURIComponent(o.dataset.open);
  });
  addEventListener("keydown", (e) => { if (e.code === "Space" && !/INPUT|TEXTAREA/.test(document.activeElement.tagName)) { e.preventDefault(); $("#play").click(); } });

  route();
})();
