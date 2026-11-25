/* Dawn Sogni — Spotify-style music site. Content comes from content.json (edit in /admin.html). */
(async () => {
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const esc = (v) => String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const fmt = (s) => (isFinite(s) && s > 0 ? `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}` : "–:––");
  const year = (d) => (d ? String(d).slice(0, 4) : "");
  const P = '<svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>';
  const PAUSE = '<svg viewBox="0 0 24 24"><path d="M7 5h3.5v14H7zM13.5 5H17v14h-3.5z"/></svg>';
  const VID = '<svg viewBox="0 0 24 24"><path d="M4 5h11a2 2 0 0 1 2 2v2.5l4-2.5v10l-4-2.5V17a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2z"/></svg>';
  const CLOCK = '<svg viewBox="0 0 24 24"><path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm0 18a8 8 0 1 1 0-16 8 8 0 0 1 0 16zm1-13h-2v6l5 3 1-1.7-4-2.3z"/></svg>';

  /* ---------- State ---------- */
  let audio = null, queue = [], qi = -1, libFilter = "all";

  /* ---------- Content ---------- */
  let C = {};
  try { C = await (await fetch("content.json?v=" + Date.now(), { cache: "no-store" })).json(); } catch {}
  const brand = C.brand || {};
  const albums = C.albums || [];
  const songs = (C.songs || []).filter((s) => s.audio || s.video || s.youtube || s.title);
  const albumById = Object.fromEntries(albums.map((a) => [a.id, a]));
  $$(".shop-link").forEach((a) => (brand.shopUrl ? (a.href = brand.shopUrl) : a.remove()));

  const releases = [
    ...albums.map((a) => {
      const tracks = songs.filter((s) => s.album === a.id);
      return { key: "a-" + a.id, type: a.type || "Album", title: a.title || "Untitled", description: a.description || "",
        cover: a.cover || tracks.find((t) => t.cover)?.cover || "", date: a.releaseDate || tracks.map((t) => t.releaseDate).filter(Boolean).sort().pop() || "",
        tracks, color: a.color, accent: a.accent };
    }),
    ...songs.filter((s) => !s.album || !albumById[s.album]).map((s) => ({
      key: "s-" + s.id, type: "Single", title: s.title || "Untitled", description: s.description || "",
      cover: s.cover || "", date: s.releaseDate || "", tracks: [s], single: true, color: s.color, accent: s.accent
    }))
  ].sort((a, b) => String(b.date).localeCompare(String(a.date)));
  const byKey = Object.fromEntries(releases.map((r) => [r.key, r]));
  const releaseOf = (song) => releases.find((r) => r.tracks.includes(song));
  const coverOf = (song) => song.cover || releaseOf(song)?.cover || "";
  const featured = byKey[String(C.featured || "").replace(":", "-")] || releases[0];

  const videos = [
    ...songs.filter((s) => s.video || s.youtube).map((s) => ({ id: "song-" + s.id, title: s.title, label: s.videoLabel || "Music video", file: s.video, youtube: s.youtube, poster: coverOf(s), song: s })),
    ...(C.videos || []).map((v, i) => ({ id: "vid-" + i, title: v.title, label: v.label || "Video", file: v.file, youtube: v.youtube, poster: v.poster || (v.youtube ? `https://img.youtube.com/vi/${encodeURIComponent(v.youtube)}/hqdefault.jpg` : "") }))
  ];
  const events = C.events || [];

  const art = (src, title, cls = "") => (src ? `<img class="${cls}" src="${esc(src)}" alt="" loading="lazy" />` : `<div class="ph ${cls}">${esc((title || "?").trim()[0] || "?")}</div>`);

  /* ---------- Durations ---------- */
  const dur = {};
  songs.forEach((s) => {
    if (!s.audio) return;
    const a = new Audio(); a.preload = "metadata"; a.src = s.audio;
    a.onloadedmetadata = () => { dur[s.id] = a.duration; $$(`[data-dur="${CSS.escape(s.id)}"]`).forEach((el) => (el.textContent = fmt(a.duration))); totals(); };
  });
  const totLen = (r) => r.tracks.reduce((t, s) => t + (dur[s.id] || 0), 0);
  const lenText = (sec) => (sec >= 3600 ? `${Math.floor(sec / 3600)} hr ${Math.round((sec % 3600) / 60)} min` : `${Math.floor(sec / 60)} min ${Math.round(sec % 60)} sec`);
  function totals() { $$("[data-total]").forEach((el) => { const r = byKey[el.dataset.total], s = r && totLen(r); if (s) el.textContent = lenText(s); }); }

  /* ---------- Colour per release ---------- */
  const hexRgb = (h) => { h = String(h || "").replace("#", ""); if (h.length === 3) h = h.split("").map((c) => c + c).join(""); if (!/^[0-9a-f]{6}$/i.test(h)) return null; const n = parseInt(h, 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
  const cache = {};
  function setVars(c, a) {
    const r = document.documentElement.style;
    r.setProperty("--c", c.join(", ")); r.setProperty("--a", a.join(", "));
    r.setProperty("--c-dark", c.map((v) => Math.round(v * 0.55)).join(", "));
  }
  function theme(rel) {
    if (!rel) return setVars([60, 60, 64], [255, 255, 255]);
    const c = hexRgb(rel.color), a = hexRgb(rel.accent);
    if (c) return setVars(c, a || c.map((v) => Math.min(255, v + 120)));
    if (cache[rel.cover]) return setVars(...cache[rel.cover]);
    if (!rel.cover) return setVars([60, 60, 64], [255, 255, 255]);
    const img = new Image(); img.src = rel.cover;
    img.onload = () => {
      try {
        const cv = document.createElement("canvas"); cv.width = cv.height = 24; const g = cv.getContext("2d"); g.drawImage(img, 0, 0, 24, 24);
        const d = g.getImageData(0, 0, 24, 24).data; let R = 0, G = 0, B = 0, n = 0;
        for (let i = 0; i < d.length; i += 4) { const w = Math.max(d[i], d[i + 1], d[i + 2]) - Math.min(d[i], d[i + 1], d[i + 2]) + 10; R += d[i] * w; G += d[i + 1] * w; B += d[i + 2] * w; n += w; }
        const base = [R / n, G / n, B / n], k = 130 / Math.max(...base, 1), col = base.map((v) => Math.round(v * k));
        cache[rel.cover] = [col, col.map((v) => Math.min(255, Math.round(v * 1.5 + 70)))]; setVars(...cache[rel.cover]);
      } catch {}
    };
  }
  function fitGiant() {
    $$(".giant").forEach((el) => {
      el.style.fontSize = "100px";
      const w = el.scrollWidth || 1, box = el.parentElement.clientWidth;
      el.style.fontSize = Math.min((100 * box * 0.98) / w, 300) + "px";
    });
  }
  addEventListener("resize", fitGiant);

  /* ---------- Library (sidebar) ---------- */
  function libRows(list) {
    const cur = queue[qi], curRel = cur && releaseOf(cur);
    return list.map((r) => `
      <li class="lib-row ${location.hash === "#/r/" + r.key ? "on" : ""} ${curRel === r ? "playing" : ""}" data-go="#/r/${r.key}">
        ${r.cover ? `<img class="thumb" src="${esc(r.cover)}" alt="" />` : `<div class="thumb">${art("", r.title)}</div>`}
        <div><div class="t">${esc(r.title)}</div><div class="s">${esc(r.type)}${r.date ? " • " + year(r.date) : ""}</div></div>
      </li>`).join("") || `<li class="s" style="padding:12px;color:var(--dim)">Nothing here yet.</li>`;
  }
  function renderLibrary() {
    const hasA = releases.some((r) => !r.single), hasS = releases.some((r) => r.single);
    $("#lib-chips").innerHTML = hasA && hasS ? ["all", "albums", "singles"].map((f) => `<button data-f="${f}" class="${libFilter === f ? "on" : ""}">${f === "all" ? "All" : f[0].toUpperCase() + f.slice(1)}</button>`).join("") : "";
    $("#lib-list").innerHTML = libRows(releases.filter((r) => libFilter === "all" || (libFilter === "albums" ? !r.single : r.single)));
  }
  $("#lib-chips").onclick = (e) => { const b = e.target.closest("button"); if (!b) return; libFilter = b.dataset.f; renderLibrary(); };

  /* ---------- Views ---------- */
  const view = $("#view"), main = $("#main");
  const card = (r) => `
    <div class="card" data-go="#/r/${r.key}">
      <div class="card-art">${art(r.cover, r.title)}${r.tracks.some((t) => t.audio) ? `<button class="card-play" data-play="${r.key}" aria-label="Play">${P}</button>` : ""}</div>
      <div class="t">${esc(r.title)}</div><div class="s">${year(r.date)}${r.date ? " • " : ""}${esc(r.type)}</div>
    </div>`;
  const vcard = (v) => `
    <div class="card" data-vid="${esc(v.id)}">
      <div class="card-art tall">${v.poster ? `<img src="${esc(v.poster)}" alt="" loading="lazy" />` : v.file ? `<video src="${esc(v.file)}#t=2" muted playsinline preload="metadata"></video>` : art("", v.title)}<span class="card-play">${P}</span></div>
      <div class="t">${esc(v.title)}</div><div class="s">${esc(v.label)}</div>
    </div>`;
  const foot = () => {
    const L = [["Instagram", brand.instagram], ["Spotify", brand.spotify], ["Apple Music", brand.appleMusic], ["YouTube", brand.youtube], ["Shop", brand.shopUrl]].filter((l) => l[1]);
    return `<footer class="foot"><span>© ${new Date().getFullYear()}</span><nav>${L.map(([n, u]) => `<a href="${esc(u)}" target="_blank" rel="noopener">${n}</a>`).join("")}</nav></footer>`;
  };
  const shelf = (title, items, more) => items ? `<section class="shelf"><div class="shelf-head"><h2>${title}</h2>${more ? `<a href="${more}">Show all</a>` : ""}</div><div class="cards">${items}</div></section>` : "";

  const VIEWS = {
    home() {
      theme(featured);
      if (!featured && !videos.length) return `<div class="wash"></div><div class="mobile-brand"><img src="assets/ds-logo-dark.png" alt="Dawn Sogni" /></div><div class="empty"><h1>SOON</h1>New music on the way.</div>`;
      const f = featured, fv = f && f.single && (f.tracks[0].video || f.tracks[0].youtube) ? f.tracks[0] : null;
      const albumsL = releases.filter((r) => !r.single), singlesL = releases.filter((r) => r.single);
      return `<div class="wash"></div>
        <div class="mobile-brand"><img src="assets/ds-logo-dark.png" alt="Dawn Sogni" /></div>
        ${f ? `<section class="banner">
          <div class="giant" aria-hidden="true">${esc(f.title)}</div>
          ${f.cover ? `<img class="banner-art" src="${esc(f.cover)}" alt="" data-go="#/r/${f.key}" />` : `<div class="banner-art" data-go="#/r/${f.key}">${art("", f.title)}</div>`}
          <div class="banner-info">
            <p class="kicker">${f === releases[0] ? "Latest " : ""}${esc(f.type)}</p>
            <h1>${esc(f.title)}</h1>
            <div class="rhead-meta">${f.date ? `<span>${year(f.date)}</span>` : ""}<span>${f.tracks.length} ${f.tracks.length === 1 ? "song" : "songs"}</span><span data-total="${f.key}"></span></div>
            <div class="actions">
              ${f.tracks.some((t) => t.audio) ? `<button class="big-play" data-play="${f.key}" aria-label="Play">${P}</button>` : ""}
              ${fv ? `<button class="txt-act" data-video="${esc(fv.id)}">${VID}${esc(fv.videoLabel || "Watch video")}</button>` : ""}
              <a class="txt-act" href="#/r/${f.key}">Open</a>
            </div>
          </div>
        </section>` : ""}
        ${shelf("Albums", albumsL.map(card).join(""))}
        ${shelf(albumsL.length ? "Singles" : "Releases", singlesL.map(card).join(""))}
        ${shelf("Videos", videos.slice(0, 8).map(vcard).join(""), videos.length > 8 ? "#/videos" : "")}
        ${events.length ? `<section class="shelf"><div class="shelf-head"><h2>Events</h2></div><ul class="events">${events.map((e) => {
          const d = e.date ? new Date(e.date + "T00:00:00") : null;
          return `<li><div class="ev-date">${d ? `<b>${d.getDate()}</b><span>${d.toLocaleDateString("en-GB", { month: "short" })}</span>` : "<b>TBA</b>"}</div>
            <div><div class="ev-title">${esc(e.title)}</div><div class="ev-place">${esc(e.place)}</div></div>
            ${e.link ? `<a class="txt-act" href="${esc(e.link)}" target="_blank" rel="noopener">${esc(e.cta || "Tickets")}</a>` : "<span></span>"}</li>`;
        }).join("")}</ul></section>` : ""}
        ${foot()}`;
    },

    release(key) {
      const r = byKey[key]; if (!r) return VIEWS.home();
      theme(r);
      const one = r.single ? r.tracks[0] : null, vid = one && (one.video || one.youtube) ? one : null;
      const more = releases.filter((x) => x !== r);
      return `<div class="wash"></div>
        <section class="rhead">
          <div class="giant" aria-hidden="true">${esc(r.title)}</div>
          ${r.cover ? `<img class="rhead-art" src="${esc(r.cover)}" alt="" />` : `<div class="rhead-art">${art("", r.title)}</div>`}
          <div class="rhead-info">
            <div class="rhead-type">${esc(r.type)}</div>
            <h1>${esc(r.title)}</h1>
            <div class="rhead-meta">${r.date ? `<span>${year(r.date)}</span>` : ""}<span>${r.tracks.length} ${r.tracks.length === 1 ? "song" : "songs"}<span data-total="${r.key}" style="margin-left:6px;color:var(--dim)"></span></span></div>
          </div>
        </section>
        <div class="actions">
          ${r.tracks.some((t) => t.audio) ? `<button class="big-play" data-play="${r.key}" aria-label="Play">${isPlayingRel(r) ? PAUSE : P}</button>` : ""}
          ${vid ? `<button class="txt-act" data-video="${esc(vid.id)}">${VID}${esc(vid.videoLabel || "Watch video")}</button>` : ""}
        </div>
        ${r.description ? `<p class="desc">${esc(r.description)}</p>` : ""}
        <div class="tl">
          <div class="tl-head"><span style="text-align:right">#</span><span>Title</span><span>Video</span>${CLOCK}</div>
          ${r.tracks.map((t, i) => `
            <div class="tl-row" data-song="${esc(t.id)}" data-rel="${r.key}" data-i="${i}">
              <span class="n"><span class="num">${i + 1}</span><span class="pi">${P}</span></span>
              <div class="tt">${t.cover && !r.single ? `<img src="${esc(t.cover)}" alt="" />` : ""}<div style="min-width:0"><div class="name">${esc(t.title)}</div>${t.description && !r.single ? `<div class="sub">${esc(t.description)}</div>` : ""}</div></div>
              <span class="vtag-col">${t.video || t.youtube ? `<button class="vtag" data-video="${esc(t.id)}">${esc(t.videoLabel || "Video")}</button>` : ""}</span>
              <span class="d" data-dur="${esc(t.id)}">${fmt(dur[t.id])}</span>
            </div>`).join("") || `<p class="empty" style="padding:40px 0">Songs coming soon.</p>`}
        </div>
        ${r.tracks.filter((t) => t.lyrics).map((t) => `<section class="lyrics-card"><h3>${r.single ? "Lyrics" : esc(t.title)}</h3><pre>${esc(t.lyrics)}</pre></section>`).join("")}
        ${shelf("More releases", more.map(card).join(""))}
        ${foot()}`;
    },

    videos() {
      theme(featured);
      return `<div class="wash"></div><h1 class="page-title">Videos</h1>
        ${videos.length ? `<section class="shelf"><div class="cards">${videos.map(vcard).join("")}</div></section>` : `<p class="empty">No videos yet.</p>`}${foot()}`;
    },

    library() {
      theme(featured);
      return `<div class="wash"></div><h1 class="page-title">Your Library</h1><ul class="lib-list lib-page">${libRows(releases)}</ul>${foot()}`;
    }
  };

  function route() {
    const h = location.hash || "#/";
    let html, name = "home", title = "";
    if (h.startsWith("#/r/")) { const k = decodeURIComponent(h.slice(4)); html = VIEWS.release(k); name = "release"; title = byKey[k]?.title || ""; }
    else if (h === "#/videos") { html = VIEWS.videos(); name = "videos"; title = "Videos"; }
    else if (h === "#/library") { html = VIEWS.library(); name = "library"; title = "Your Library"; }
    else html = VIEWS.home();
    view.innerHTML = html;
    $("#tb-title").textContent = title;
    $$("[data-nav]").forEach((a) => a.classList.toggle("on", a.dataset.nav === name));
    main.scrollTo(0, 0); scrollTo(0, 0);
    renderLibrary(); totals(); mark(); fitGiant();
    if (document.fonts) document.fonts.ready.then(fitGiant);
    onScroll();
  }
  addEventListener("hashchange", () => { closeFull(true); route(); });

  const topbar = $("#topbar");
  function onScroll() { const y = innerWidth <= 800 ? scrollY : main.scrollTop; topbar.classList.toggle("solid", y > 220); }
  main.addEventListener("scroll", onScroll, { passive: true });
  addEventListener("scroll", onScroll, { passive: true });

  /* ---------- Video modal ---------- */
  const modal = $("#modal"), frame = $("#modal-frame");
  function openVideo(v) {
    if (!v) return;
    if (audio && !audio.paused) audio.pause();
    frame.className = "modal-frame";
    if (v.youtube) frame.innerHTML = `<iframe src="https://www.youtube.com/embed/${encodeURIComponent(v.youtube)}?autoplay=1&rel=0&playsinline=1" allow="autoplay; encrypted-media; fullscreen; picture-in-picture" allowfullscreen></iframe>`;
    else {
      frame.innerHTML = `<video src="${esc(v.file)}" ${v.poster ? `poster="${esc(v.poster)}"` : ""} controls autoplay playsinline></video>`;
      const el = $("video", frame); el.onloadedmetadata = () => frame.classList.toggle("portrait", el.videoHeight > el.videoWidth);
    }
    modal.classList.add("open"); modal.setAttribute("aria-hidden", "false");
  }
  function closeVideo() { modal.classList.remove("open"); modal.setAttribute("aria-hidden", "true"); setTimeout(() => (frame.innerHTML = ""), 300); }
  $("#modal-close").onclick = closeVideo;
  modal.onclick = (e) => { if (e.target === modal) closeVideo(); };
  const videoOfSong = (id) => videos.find((v) => v.id === "song-" + id);

  /* ---------- Player ---------- */
  const player = $("#player");
  player.classList.add("idle");
  function isPlayingRel(r) { const s = queue[qi]; return !!(audio && !audio.paused && s && r.tracks.includes(s)); }
  function playRelease(key, i = 0) {
    const r = byKey[key]; if (!r) return;
    const cur = queue[qi];
    if (cur && r.tracks.includes(cur) && i === null) return toggle();
    queue = r.tracks.filter((t) => t.audio);
    const want = r.tracks[i || 0];
    playAt(Math.max(0, queue.indexOf(want)));
  }
  function playAt(i) {
    if (!queue.length) return;
    qi = (i + queue.length) % queue.length;
    const s = queue[qi], rel = releaseOf(s), cov = coverOf(s);
    if (!audio) {
      audio = new Audio(); audio.preload = "auto"; audio.volume = +$("#vol").value;
      audio.addEventListener("timeupdate", time); audio.addEventListener("loadedmetadata", time);
      audio.addEventListener("play", mark); audio.addEventListener("pause", mark);
      audio.addEventListener("ended", () => (qi < queue.length - 1 ? playAt(qi + 1) : (audio.currentTime = 0, mark())));
    }
    audio.src = s.audio; audio.play().catch(() => {});
    player.classList.remove("idle");
    const cv = $("#np-cover"); cv.hidden = !cov; if (cov) cv.src = cov;
    $("#np-title").textContent = s.title;
    $("#np-sub").textContent = rel && !rel.single ? rel.title : rel?.type || "";
    $("#b-lyrics").disabled = !s.lyrics; $("#b-video").disabled = !(s.video || s.youtube);
    // full screen player
    $("#full-cover").src = cov || ""; $("#full-cover").hidden = !cov;
    $("#full-title").textContent = s.title; $("#full-sub").textContent = rel && !rel.single ? rel.title : rel?.type || "";
    $("#full-from").textContent = rel ? rel.title : "";
    $("#f-video").hidden = !(s.video || s.youtube);
    const fl = $("#full-lyrics"); fl.hidden = !s.lyrics; fl.innerHTML = s.lyrics ? `<h3>Lyrics</h3><pre>${esc(s.lyrics)}</pre>` : "";
    if (!location.hash.startsWith("#/r/") || location.hash === "#/r/" + rel?.key) theme(rel);
    if ("mediaSession" in navigator) {
      navigator.mediaSession.metadata = new MediaMetadata({ title: s.title, artist: "Dawn Sogni", album: rel && !rel.single ? rel.title : "", artwork: cov ? [{ src: new URL(cov, location.href).href, sizes: "1500x1500", type: "image/jpeg" }] : [] });
      navigator.mediaSession.setActionHandler("previoustrack", prev);
      navigator.mediaSession.setActionHandler("nexttrack", () => playAt(qi + 1));
    }
    mark();
  }
  function toggle() { if (!audio) return featured && playRelease(featured.key); audio.paused ? audio.play() : audio.pause(); }
  function prev() { if (audio && audio.currentTime > 3) audio.currentTime = 0; else playAt(qi - 1); }
  function time() {
    if (!audio) return;
    const p = audio.duration ? (audio.currentTime / audio.duration) * 100 : 0;
    $("#seek-fill").style.width = $("#seek2-fill").style.width = p + "%";
    $("#t-cur").textContent = $("#t2-cur").textContent = fmt(audio.currentTime);
    $("#t-dur").textContent = $("#t2-dur").textContent = fmt(audio.duration);
  }
  function mark() {
    const playing = !!(audio && !audio.paused), cur = queue[qi];
    $$(".ico-play").forEach((p) => p.setAttribute("d", playing ? "M7 5h3.5v14H7zM13.5 5H17v14h-3.5z" : "M8 5v14l11-7z"));
    $$(".tl-row").forEach((el) => el.classList.toggle("playing", !!cur && el.dataset.song === cur.id));
    $$(".big-play[data-play]").forEach((b) => { const r = byKey[b.dataset.play]; b.innerHTML = r && isPlayingRel(r) ? PAUSE : P; });
    const curRel = cur && releaseOf(cur);
    $$(".lib-row").forEach((el) => el.classList.toggle("playing", !!curRel && el.dataset.go === "#/r/" + curRel.key));
  }
  const seekTo = (bar) => (e) => { if (!audio?.duration) return; const r = bar.getBoundingClientRect(); audio.currentTime = Math.max(0, Math.min(1, (e.clientX - r.left) / r.width)) * audio.duration; };
  $("#seek").onclick = seekTo($("#seek")); $("#seek2").onclick = seekTo($("#seek2"));
  $("#b-play").onclick = (e) => { e.stopPropagation(); toggle(); };
  $("#f-play").onclick = toggle;
  $("#b-prev").onclick = prev; $("#f-prev").onclick = prev;
  $("#b-next").onclick = () => playAt(qi + 1); $("#f-next").onclick = () => playAt(qi + 1);
  $("#vol").oninput = (e) => { if (audio) audio.volume = +e.target.value; };
  $("#b-video").onclick = $("#f-video").onclick = () => openVideo(videoOfSong(queue[qi]?.id));
  $("#b-lyrics").onclick = () => { const r = releaseOf(queue[qi]); if (r) location.hash = "#/r/" + r.key; setTimeout(() => $(".lyrics-card")?.scrollIntoView({ behavior: "smooth" }), 200); };
  // tapping now-playing: mobile opens full player, desktop opens the release
  const full = $("#full");
  $("#np").onclick = () => {
    if (!queue.length) return;
    if (innerWidth <= 800) { full.classList.add("open"); full.setAttribute("aria-hidden", "false"); history.pushState({ full: 1 }, ""); }
    else { const r = releaseOf(queue[qi]); if (r) location.hash = "#/r/" + r.key; }
  };
  function closeFull(silent) { if (!full.classList.contains("open")) return; full.classList.remove("open"); full.setAttribute("aria-hidden", "true"); if (!silent) history.back(); }
  $("#full-close").onclick = () => closeFull();
  addEventListener("popstate", () => { full.classList.remove("open"); });

  /* ---------- Clicks ---------- */
  document.addEventListener("click", (e) => {
    const t = e.target;
    const play = t.closest("[data-play]"), v = t.closest("[data-video]"), vc = t.closest("[data-vid]"), row = t.closest(".tl-row"), go = t.closest("[data-go]");
    if (play) { e.stopPropagation(); const r = byKey[play.dataset.play]; return r && isPlayingRel(r) ? audio.pause() : r && queue[qi] && r.tracks.includes(queue[qi]) && audio?.paused ? audio.play() : playRelease(play.dataset.play); }
    if (v) { e.stopPropagation(); return openVideo(videoOfSong(v.dataset.video)); }
    if (vc) return openVideo(videos.find((x) => x.id === vc.dataset.vid));
    if (row) { const cur = queue[qi]; if (cur && cur.id === row.dataset.song) return toggle(); return playRelease(row.dataset.rel, +row.dataset.i); }
    if (go) location.hash = go.dataset.go;
  });
  addEventListener("keydown", (e) => {
    if (/INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName)) return;
    if (e.code === "Space") { e.preventDefault(); toggle(); }
    if (e.key === "Escape") { closeVideo(); closeFull(); }
  });

  route();
})();
