/* Dawn Sogni — music app (songs, covers, lyrics). Content lives in content.json (edit it in /admin.html). */
(async () => {
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const esc = (v) => String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const fmt = (s) => (isFinite(s) && s > 0 ? `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}` : "0:00");
  const PLAY_D = "M8 5v14l11-7z", PAUSE_D = "M7 5h3.5v14H7zM13.5 5H17v14h-3.5z";
  const ico = (d) => `<svg viewBox="0 0 24 24"><path class="ico-pp" d="${d}"/></svg>`;
  const I = {
    back: '<svg viewBox="0 0 24 24"><path d="M20 11H7.8l5.6-5.6L12 4l-8 8 8 8 1.4-1.4L7.8 13H20z"/></svg>',
    bag: '<svg viewBox="0 0 24 24"><path d="M7 7V6a5 5 0 0 1 10 0v1h3l-1 14H5L4 7zm2 0h6V6a3 3 0 0 0-6 0z"/></svg>',
    search: '<svg viewBox="0 0 24 24"><path d="M10 3a7 7 0 0 1 5.6 11.2l5.1 5.1-1.4 1.4-5.1-5.1A7 7 0 1 1 10 3zm0 2a5 5 0 1 0 0 10 5 5 0 0 0 0-10z"/></svg>',
    lyrics: '<svg viewBox="0 0 24 24"><path d="M4 4h16v12H7l-3 3zm3 4v2h10V8zm0 4v2h7v-2z"/></svg>',
    prev: '<svg viewBox="0 0 24 24"><path d="M6 6h2v12H6zM9.5 12 18 18V6z"/></svg>',
    next: '<svg viewBox="0 0 24 24"><path d="M16 6h2v12h-2zM6 18l8.5-6L6 6z"/></svg>',
    shuffle: '<svg viewBox="0 0 24 24"><path d="M14.8 4H20v5.2l-2-2-3.6 3.6-1.4-1.4L16.6 5.8zM4 18.6 16.6 6l1.4 1.4L5.4 20zM13 14.4l1.4-1.4 3.6 3.6 2-2V20h-5.2l2-2z"/></svg>',
    repeat: '<svg viewBox="0 0 24 24"><path d="M7 7h10v3l4-4-4-4v3H5v6h2zm10 10H7v-3l-4 4 4 4v-3h12v-6h-2z"/></svg>'
  };

  /* ---------- Content (newest straight from GitHub so publishes show instantly) ---------- */
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
  const rawUrl = (u) => { try { const x = new URL(u, location.href), i = x.pathname.indexOf("/media/"); return i >= 0 && x.origin === location.origin ? RAW + x.pathname.slice(i + 1) : null; } catch { return null; } };
  document.addEventListener("error", (e) => { const el = e.target; if (el.tagName === "IMG" && !el.dataset.raw) { const alt = rawUrl(el.src); if (alt) { el.dataset.raw = 1; el.src = alt; } } }, true);
  const img = (s) => (s && s.cover ? `<img src="${esc(s.cover)}" alt="" loading="lazy" />` : `<div class="ph">${esc(((s && s.title) || "?")[0])}</div>`);
  const yr = (s) => (s.date ? String(s.date).slice(0, 4) : "");

  /* ---------- Durations ---------- */
  const dur = {};
  songs.forEach((s) => { const a = new Audio(); a.preload = "metadata"; a.src = s.audio; a.onloadedmetadata = () => { dur[s.id] = a.duration; $$(`[data-dur="${CSS.escape(s.id)}"]`).forEach((el) => (el.textContent = fmt(a.duration))); }; });

  /* ---------- Lyrics ---------- */
  const TS = /^\s*\[(\d+):(\d+(?:\.\d+)?)\]\s?(.*)$/;
  function parseLyrics(text) {
    const lines = String(text || "").replace(/\r/g, "").split("\n").map((l) => { const m = l.match(TS); return m ? { t: +m[1] * 60 + +m[2], text: m[3] } : { t: null, text: l }; });
    const st = lines.filter((l) => l.t !== null).length, synced = st > 0 && st >= lines.filter((l) => l.text.trim()).length * 0.6;
    return { synced, lines: synced ? lines.filter((l) => l.t !== null) : lines };
  }
  function lyricsHTML(s) {
    if (!s.lyrics || !s.lyrics.trim()) return `<p class="no-lyrics">Lyrics coming soon.</p>`;
    const L = parseLyrics(s.lyrics);
    return `<div class="ly ${L.synced ? "synced" : ""}" data-song="${esc(s.id)}">${L.lines.map((l) => {
      const t = l.text.trim(); if (!t) return `<div class="ly-line gap"></div>`;
      const tag = /^\[.*\]$/.test(t);
      return `<p class="ly-line ${tag ? "tag" : ""}" ${l.t !== null ? `data-t="${l.t}"` : ""}>${esc(tag ? t.slice(1, -1) : t)}</p>`;
    }).join("")}</div>`;
  }

  /* ---------- Waveform from the real audio ---------- */
  const BARS = 56, peaks = {};
  function fakePeaks(id) { let h = 7; for (const c of id) h = (h * 31 + c.charCodeAt(0)) >>> 0; return Array.from({ length: BARS }, (_, i) => { h = (h * 1103515245 + 12345) >>> 0; return 0.25 + ((h >>> 8) % 1000) / 1000 * 0.75 * (0.6 + 0.4 * Math.sin(i / 5)); }); }
  async function loadPeaks(s) {
    if (peaks[s.id]) return peaks[s.id];
    peaks[s.id] = fakePeaks(s.id);
    try {
      let res = await fetch(s.audio); if (!res.ok && rawUrl(s.audio)) res = await fetch(rawUrl(s.audio));
      const AC = window.AudioContext || window.webkitAudioContext, ctx = new AC();
      const ab = await res.arrayBuffer();
      const buf = await new Promise((ok, no) => { const pr = ctx.decodeAudioData(ab, ok, no); if (pr && pr.then) pr.then(ok, no); });
      const d = buf.getChannelData(0), step = Math.floor(d.length / BARS), out = [];
      for (let b = 0; b < BARS; b++) { let m = 0; for (let i = b * step; i < (b + 1) * step; i += 64) m = Math.max(m, Math.abs(d[i])); out.push(m); }
      const mx = Math.max(...out, 0.01); peaks[s.id] = out.map((v) => 0.12 + (v / mx) * 0.88); ctx.close && ctx.close();
    } catch {}
    return peaks[s.id];
  }

  /* ---------- Views ---------- */
  const view = $("#view");
  function rowHTML(s) {
    return `<div class="row glass" data-open="${esc(s.id)}">
      <div class="th">${img(s)}</div>
      <div class="tx"><b>${esc(s.title)}</b><small>${yr(s) ? "Single · " + yr(s) : "Single"}<i data-dur="${esc(s.id)}">${dur[s.id] ? fmt(dur[s.id]) : ""}</i></small></div>
      <button class="circle-btn" data-play="${esc(s.id)}" aria-label="Play">${ico(PLAY_D)}</button>
    </div>`;
  }
  function home() {
    document.body.classList.remove("on-player");
    setBg(songs[0]);
    const f = songs[0];
    const head = `<header class="head">
        <div class="who glass"><div class="av"><img src="assets/ds-logo-dark.png" alt="" /></div><div><small>Welcome to</small><b>Dawn Sogni</b></div></div>
        ${C.shopUrl ? `<a class="circle-btn" href="${esc(C.shopUrl)}" target="_blank" rel="noopener" aria-label="Shop">${I.bag}</a>` : ""}
      </header>`;
    if (!f) return head + `<div class="empty"><h1>New music soon</h1><p>Check back shortly.</p></div>`;
    return `${head}
      <label class="search glass">${I.search}<input id="q" type="search" placeholder="Search songs or lyrics…" autocomplete="off" /></label>
      <div class="home">
        <div class="feature glass" data-open="${esc(f.id)}">
          <div class="img">${img(f)}</div>
          <span class="chip glass">Latest</span>
          <div class="bottom"><div><h2>${esc(f.title)}</h2><p>${yr(f) ? "Single · " + yr(f) : "Single"}</p></div>
            <button class="circle-btn" data-play="${esc(f.id)}" aria-label="Play">${ico(PLAY_D)}</button></div>
        </div>
        <div>
          <div class="sec-h"><h3>All songs</h3><span>${songs.length} ${songs.length === 1 ? "song" : "songs"}</span></div>
          <div class="list" id="list">${songs.map(rowHTML).join("")}</div>
        </div>
      </div>`;
  }
  function playerPage(s) {
    document.body.classList.add("on-player");
    setBg(s);
    const i = songs.indexOf(s), prev = songs[i - 1], next = songs[i + 1];
    return `<div class="np ${cur === i && !audio.paused ? "playing" : ""}" data-song="${esc(s.id)}">
      <div class="np-top"><a class="circle-btn" href="#/" aria-label="Back">${I.back}</a><span>Music play</span>
        <button class="circle-btn" id="to-lyrics" aria-label="Lyrics">${I.lyrics}</button></div>
      <h1>${esc(s.title)}</h1>
      <div class="disc-row">
        ${prev ? `<div class="side-disc l" data-open="${esc(prev.id)}">${img(prev)}</div>` : ""}
        <div class="disc"><div class="face">${img(s)}</div></div>
        ${next ? `<div class="side-disc r" data-open="${esc(next.id)}">${img(next)}</div>` : ""}
      </div>
      <div class="panel glass">
        <div class="wave" id="wave">${Array.from({ length: BARS }, () => "<i></i>").join("")}</div>
        <div class="times"><span id="t-cur">${cur === i ? fmt(audio.currentTime) : "0:00"}</span><span id="t-dur" data-dur="${esc(s.id)}">${fmt(dur[s.id])}</span></div>
        <div class="ctrls">
          <button class="ghost-ico ${shuffle ? "on" : ""}" id="shuffle" aria-label="Shuffle">${I.shuffle}</button>
          <button class="circle-btn" id="prev" aria-label="Previous">${I.prev}</button>
          <button class="circle-btn main" data-play="${esc(s.id)}" aria-label="Play">${ico(PLAY_D)}</button>
          <button class="circle-btn" id="next" aria-label="Next">${I.next}</button>
          <button class="ghost-ico ${repeat ? "on" : ""}" id="repeat" aria-label="Repeat">${I.repeat}</button>
        </div>
      </div>
      <section class="lyrics glass" id="lyrics"><h3>Lyrics</h3>${lyricsHTML(s)}</section>
    </div>`;
  }
  function route() {
    const id = decodeURIComponent((location.hash.match(/^#\/song\/(.+)$/) || [])[1] || "");
    const s = songs.find((x) => x.id === id);
    view.innerHTML = s ? playerPage(s) : home();
    scrollTo(0, 0);
    if (s) {
      loadPeaks(s).then((p) => { if ($(".np")?.dataset.song === s.id) $$("#wave i").forEach((b, k) => (b.style.height = Math.round(p[k] * 100) + "%")); });
      $("#to-lyrics").onclick = () => $("#lyrics").scrollIntoView({ behavior: "smooth" });
      $("#prev").onclick = () => go(-1); $("#next").onclick = () => go(1);
      $("#shuffle").onclick = (e) => { shuffle = !shuffle; e.currentTarget.classList.toggle("on", shuffle); };
      $("#repeat").onclick = (e) => { repeat = !repeat; e.currentTarget.classList.toggle("on", repeat); };
      $("#wave").onclick = (e) => {
        const r = e.currentTarget.getBoundingClientRect(), frac = (e.clientX - r.left) / r.width, i = songs.indexOf(s);
        if (cur !== i) play(i);
        const seek = () => (audio.currentTime = frac * audio.duration); audio.readyState ? seek() : audio.addEventListener("loadedmetadata", seek, { once: true });
      };
    } else {
      const q = $("#q");
      if (q) q.oninput = () => {
        const t = q.value.trim().toLowerCase();
        const hits = songs.filter((s) => !t || s.title.toLowerCase().includes(t) || (s.lyrics || "").toLowerCase().includes(t));
        $("#list").innerHTML = hits.map(rowHTML).join("") || `<p class="no-match">No songs match “${esc(q.value)}”.</p>`;
        mark();
      };
    }
    mark(); tick(true);
  }
  addEventListener("hashchange", route);
  function setBg(s) { $("#bg-cover").style.backgroundImage = s && s.cover ? `url("${s.cover}")` : "none"; }

  /* ---------- Player ---------- */
  const audio = new Audio(); audio.preload = "auto";
  let cur = -1, shuffle = false, repeat = false;
  function play(i) {
    if (i === cur) return audio.paused ? audio.play() : audio.pause();
    cur = (i + songs.length) % songs.length;
    const s = songs[cur];
    delete audio.dataset.raw; audio.src = s.audio; audio.play().catch(() => {});
    $("#mini").hidden = false; $("#mini-cover").src = s.cover || "assets/ds-logo-sm.png"; $("#mini-title").textContent = s.title;
    if ("mediaSession" in navigator) {
      navigator.mediaSession.metadata = new MediaMetadata({ title: s.title, artist: "Dawn Sogni", artwork: s.cover ? [{ src: new URL(s.cover, location.href).href, sizes: "1500x1500", type: "image/jpeg" }] : [] });
      navigator.mediaSession.setActionHandler("previoustrack", () => go(-1));
      navigator.mediaSession.setActionHandler("nexttrack", () => go(1));
    }
    const np = $(".np"); if (np && np.dataset.song !== s.id) location.hash = "#/song/" + encodeURIComponent(s.id);
    mark();
  }
  function go(d) {
    if (cur < 0) { const np = $(".np"); return play(np ? songs.findIndex((s) => s.id === np.dataset.song) : 0); }
    if (d < 0 && audio.currentTime > 3) { audio.currentTime = 0; return; }
    play(shuffle && songs.length > 1 ? (cur + 1 + Math.floor(Math.random() * (songs.length - 1))) % songs.length : cur + d);
  }
  audio.addEventListener("error", () => { const alt = !audio.dataset.raw && rawUrl(audio.src); if (alt) { audio.dataset.raw = 1; audio.src = alt; audio.play().catch(() => {}); } });
  audio.addEventListener("play", mark); audio.addEventListener("pause", mark);
  audio.addEventListener("ended", () => { if (repeat) { audio.currentTime = 0; audio.play(); } else if (shuffle || cur < songs.length - 1) go(1); else mark(); });
  audio.addEventListener("timeupdate", () => tick());
  function mark() {
    const on = !audio.paused && cur >= 0, id = songs[cur]?.id;
    $$("[data-play]").forEach((b) => b.querySelector(".ico-pp")?.setAttribute("d", b.dataset.play === id && on ? PAUSE_D : PLAY_D));
    $("#mini-play .ico-pp").setAttribute("d", on ? PAUSE_D : PLAY_D);
    $$(".row").forEach((r) => r.classList.toggle("on", r.dataset.open === id));
    const np = $(".np"); if (np) np.classList.toggle("playing", on && np.dataset.song === id);
  }
  $("#mini-play").onclick = () => (audio.paused ? audio.play() : audio.pause());
  const openCur = () => { if (cur >= 0) location.hash = "#/song/" + encodeURIComponent(songs[cur].id); };
  $("#mini-cover").onclick = openCur; $("#mini-meta").onclick = openCur;

  let lastScroll = 0, lastLine = "";
  ["wheel", "touchmove"].forEach((ev) => addEventListener(ev, () => (lastScroll = Date.now()), { passive: true }));
  function tick(force) {
    const frac = audio.duration ? audio.currentTime / audio.duration : 0;
    $("#mini-fill").style.width = frac * 100 + "%";
    const np = $(".np"); if (!np) return;
    const mine = cur >= 0 && np.dataset.song === songs[cur].id;
    const bars = $$("#wave i"), lit = mine ? Math.round(frac * bars.length) : 0;
    bars.forEach((b, k) => b.classList.toggle("on", k < lit));
    if (mine) $("#t-cur").textContent = fmt(audio.currentTime);
    const box = $(".ly.synced"); if (!box) return;
    const lines = $$(".ly-line[data-t]", box); let idx = -1;
    if (mine) { const t = audio.currentTime + 0.15; lines.forEach((l, k) => { if (+l.dataset.t <= t) idx = k; }); }
    if (!force && String(idx) === lastLine) return; lastLine = String(idx);
    lines.forEach((l, k) => { l.classList.toggle("on", k === idx); l.classList.toggle("past", idx >= 0 && k < idx); });
    if (idx >= 0 && Date.now() - lastScroll > 2500) lines[idx].scrollIntoView({ block: "center", behavior: "smooth" });
  }

  /* ---------- Clicks ---------- */
  document.addEventListener("click", (e) => {
    const p = e.target.closest("[data-play]"), o = e.target.closest("[data-open]"), l = e.target.closest(".synced .ly-line[data-t]");
    if (p) { e.stopPropagation(); return play(songs.findIndex((s) => s.id === p.dataset.play)); }
    if (l) { const i = songs.findIndex((s) => s.id === l.closest(".ly").dataset.song); if (i !== cur) play(i); const sk = () => (audio.currentTime = +l.dataset.t); audio.readyState ? sk() : audio.addEventListener("loadedmetadata", sk, { once: true }); audio.play(); return; }
    if (o) location.hash = "#/song/" + encodeURIComponent(o.dataset.open);
  });
  addEventListener("keydown", (e) => { if (e.code === "Space" && !/INPUT|TEXTAREA/.test(document.activeElement.tagName)) { e.preventDefault(); cur < 0 ? play(0) : audio.paused ? audio.play() : audio.pause(); } });

  route();
})();
