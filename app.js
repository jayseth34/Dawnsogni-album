/* Dawn Sogni — site. All content comes from content.json (edited in /admin.html). */
(async () => {
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const esc = (v) => String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const fmt = (s) => (isFinite(s) && s > 0 ? `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}` : "–:––");
  const year = (d) => (d ? String(d).slice(0, 4) : "");
  const ICON_PLAY = '<svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>';
  const ICON_VIDEO = '<svg viewBox="0 0 24 24"><path d="M4 5h11a2 2 0 0 1 2 2v2.5l4-2.5v10l-4-2.5V17a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2z"/></svg>';
  const LOGO = "assets/ds-logo-dark.png";

  let io, audio = null, queue = [], qi = 0;

  /* ---------- Content ---------- */
  let C = {};
  try { C = await (await fetch("content.json?v=" + Date.now(), { cache: "no-store" })).json(); } catch {}
  const brand = C.brand || {};
  const albums = C.albums || [];
  const songs = (C.songs || []).filter((s) => s.audio || s.video || s.youtube || s.title);
  const albumById = Object.fromEntries(albums.map((a) => [a.id, a]));
  if (brand.shopUrl) $("#shop-link").href = brand.shopUrl;

  const releases = [
    ...albums.map((a) => {
      const tracks = songs.filter((s) => s.album === a.id);
      return {
        key: "a:" + a.id, type: a.type || "Album", title: a.title || "Untitled", description: a.description || "",
        cover: a.cover || tracks.find((t) => t.cover)?.cover || "", date: a.releaseDate || tracks.map((t) => t.releaseDate).filter(Boolean).sort().pop() || "",
        tracks, album: a, color: a.color, accent: a.accent
      };
    }),
    ...songs.filter((s) => !s.album || !albumById[s.album]).map((s) => ({
      key: "s:" + s.id, type: "Single", title: s.title || "Untitled", description: s.description || "",
      cover: s.cover || "", date: s.releaseDate || "", tracks: [s], single: true, color: s.color, accent: s.accent
    }))
  ];
  const byDate = [...releases].sort((a, b) => String(b.date).localeCompare(String(a.date)));
  const releaseOf = (song) => releases.find((r) => r.tracks.includes(song));
  const coverOf = (song) => song.cover || releaseOf(song)?.cover || "";
  const artHTML = (src, alt = "") => (src ? `<img src="${esc(src)}" alt="${esc(alt)}" loading="lazy" />` : `<div class="ph"><img src="${LOGO}" alt="" /></div>`);

  /* ---------- Durations ---------- */
  const durations = {};
  function loadDuration(song) {
    if (!song.audio || song.id in durations) return;
    durations[song.id] = 0;
    const a = new Audio(); a.preload = "metadata"; a.src = song.audio;
    a.onloadedmetadata = () => { durations[song.id] = a.duration; $$(`[data-dur="${CSS.escape(song.id)}"]`).forEach((el) => (el.textContent = fmt(a.duration))); updateTotals(); };
  }
  const releaseLength = (r) => r.tracks.reduce((s, t) => s + (durations[t.id] || 0), 0);
  function updateTotals() { $$("[data-total]").forEach((el) => { const r = releases.find((x) => x.key === el.dataset.total); const s = r && releaseLength(r); if (s) el.textContent = r.single ? fmt(s) : `${Math.round(s / 60)} min`; }); }
  songs.forEach(loadDuration);

  /* ---------- Colour grade (per release) ---------- */
  const hexRgb = (h) => { h = String(h || "").replace("#", ""); if (h.length === 3) h = h.split("").map((c) => c + c).join(""); if (!/^[0-9a-f]{6}$/i.test(h)) return null; const n = parseInt(h, 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
  const themeCache = {};
  function applyTheme(target, r) {
    if (!r) return;
    const set = (c, a) => { target.style.setProperty("--c", c.join(", ")); target.style.setProperty("--a", a.join(", ")); };
    const c = hexRgb(r.color), a = hexRgb(r.accent);
    if (c) return set(c, a || c.map((v) => Math.min(255, v + 110)));
    if (themeCache[r.cover]) return set(...themeCache[r.cover]);
    if (!r.cover) return;
    const img = new Image(); img.src = r.cover;
    img.onload = () => {
      try {
        const cv = document.createElement("canvas"); cv.width = cv.height = 24;
        const g = cv.getContext("2d"); g.drawImage(img, 0, 0, 24, 24);
        const d = g.getImageData(0, 0, 24, 24).data; let R = 0, G = 0, B = 0, n = 0;
        for (let i = 0; i < d.length; i += 4) { const w = Math.max(d[i], d[i + 1], d[i + 2]) - Math.min(d[i], d[i + 1], d[i + 2]) + 10; R += d[i] * w; G += d[i + 1] * w; B += d[i + 2] * w; n += w; }
        const base = [R / n, G / n, B / n], k = 120 / Math.max(...base, 1);
        const col = base.map((v) => Math.round(v * k)), acc = col.map((v) => Math.min(255, Math.round(v * 1.6 + 60)));
        themeCache[r.cover] = [col, acc]; set(col, acc);
      } catch {}
    };
  }

  /* giant poster type: scale a word to fill its container's width */
  function fitGiant(root = document) {
    $$(".giant", root).forEach((el) => {
      el.style.fontSize = "100px";
      const w = el.scrollWidth || 1, box = el.parentElement.clientWidth * 0.96;
      el.style.fontSize = Math.min((100 * box) / w, el.parentElement.clientHeight * 0.62) + "px";
    });
  }
  addEventListener("resize", () => fitGiant());
  const spaced = (t) => esc(t);

  /* ---------- Hero ---------- */
  const featured = releases.find((r) => r.key === C.featured) || byDate[0];
  const hero = $("#hero");
  if (featured) {
    const hasVideo = featured.single && (featured.tracks[0].video || featured.tracks[0].youtube);
    const playable = featured.tracks.some((t) => t.audio);
    hero.innerHTML = `
      <div class="stage">
        <h1 class="giant" aria-label="${esc(featured.title)}">${esc(featured.title.toUpperCase())}</h1>
        <div class="hero-art" data-open="${featured.key}">${artHTML(featured.cover, featured.title)}</div>
      </div>
      <div class="hero-info reveal">
        <p class="spaced">${spaced((featured === byDate[0] ? "Latest " : "") + featured.type)}</p>
        <div class="meta">${featured.date ? `<span>${year(featured.date)}</span>` : ""}${!featured.single ? `<span>${featured.tracks.length} songs</span>` : ""}<span data-total="${featured.key}"></span></div>
        ${featured.description ? `<p class="desc">${esc(featured.description)}</p>` : ""}
        <div class="actions">
          ${playable ? `<button class="btn btn-primary" data-play="${featured.key}">${ICON_PLAY}Play</button>` : ""}
          ${hasVideo ? `<button class="btn btn-ghost" data-video="${esc(featured.tracks[0].id)}">${ICON_VIDEO}${esc(featured.tracks[0].videoLabel || "Watch video")}</button>` : ""}
          ${!featured.single ? `<button class="btn btn-ghost" data-open="${featured.key}">View ${esc(featured.type.toLowerCase())}</button>` : ""}
        </div>
      </div>`;
    applyTheme(document.documentElement, featured);
  } else {
    hero.innerHTML = `<div class="stage"><h1 class="giant">SOON</h1></div><div class="hero-info"><p class="spaced">${spaced("New music on the way")}</p></div>`;
  }
  (document.fonts ? document.fonts.ready : Promise.resolve()).then(() => fitGiant());
  fitGiant();

  /* ---------- Releases grid ---------- */
  const relGrid = $("#releases");
  const relCard = (r) => `
    <article class="rel reveal" data-open="${r.key}">
      <div class="rel-art">${artHTML(r.cover, r.title)}${r.tracks.some((t) => t.audio) ? `<button class="rel-play" data-play="${r.key}" aria-label="Play ${esc(r.title)}">${ICON_PLAY}</button>` : ""}</div>
      <p class="rel-title">${esc(r.title)}</p>
      <p class="rel-sub">${esc(r.type)}${r.date ? " · " + year(r.date) : ""}</p>
    </article>`;
  function renderReleases(filter = "all") {
    const list = byDate.filter((r) => filter === "all" || (filter === "albums" ? !r.single : r.single));
    relGrid.innerHTML = list.length ? list.map(relCard).join("") : `<p class="empty">No releases yet.</p>`;
    observe();
  }
  const hasAlbums = releases.some((r) => !r.single), hasSingles = releases.some((r) => r.single);
  if (hasAlbums && hasSingles) {
    $("#chips").innerHTML = ["all", "albums", "singles"].map((f, i) => `<button data-f="${f}" class="${i ? "" : "on"}">${f[0].toUpperCase() + f.slice(1)}</button>`).join("");
    $("#chips").onclick = (e) => { const b = e.target.closest("button"); if (!b) return; $$("#chips button").forEach((x) => x.classList.toggle("on", x === b)); renderReleases(b.dataset.f); };
  }
  renderReleases();

  /* ---------- Videos ---------- */
  const videoItems = [
    ...songs.filter((s) => s.video || s.youtube).map((s) => ({ id: "song:" + s.id, title: s.title, label: s.videoLabel || "Music video", file: s.video, youtube: s.youtube, poster: coverOf(s) })),
    ...(C.videos || []).map((v, i) => ({ id: "vid:" + i, title: v.title, label: v.label || "Video", file: v.file, youtube: v.youtube, poster: v.poster || (v.youtube ? `https://img.youtube.com/vi/${encodeURIComponent(v.youtube)}/hqdefault.jpg` : "") }))
  ];
  if (videoItems.length) {
    $("#videos").hidden = false; $('[data-sec="videos"]').hidden = false;
    $("#video-grid").innerHTML = videoItems.map((v) => `
      <article class="vid reveal" data-vid="${esc(v.id)}">
        <div class="vid-art">${v.poster ? `<img src="${esc(v.poster)}" alt="" loading="lazy" />` : v.file ? `<video src="${esc(v.file)}#t=2" muted playsinline preload="metadata"></video>` : `<div class="ph"><img src="${LOGO}" alt="" /></div>`}
          <span class="vid-badge"><i>${ICON_PLAY}</i>${esc(v.label)}</span></div>
        <p class="rel-title">${esc(v.title)}</p>
      </article>`).join("");
  }

  /* ---------- Events ---------- */
  const events = C.events || [];
  if (events.length) {
    $("#events").hidden = false; $('[data-sec="events"]').hidden = false;
    $("#event-list").innerHTML = events.map((e) => {
      const d = e.date ? new Date(e.date + "T00:00:00").toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) : "TBA";
      return `<li class="reveal"><span class="ev-date">${d}</span><div><div class="ev-title">${esc(e.title)}</div><div class="ev-place">${esc(e.place)}</div></div>
        ${e.link ? `<a class="btn btn-ghost" href="${esc(e.link)}" target="_blank" rel="noopener">${esc(e.cta || "Tickets")}</a>` : "<span></span>"}</li>`;
    }).join("");
  }

  /* ---------- Footer ---------- */
  const links = [["Instagram", brand.instagram], ["Spotify", brand.spotify], ["Apple Music", brand.appleMusic], ["YouTube", brand.youtube], ["Shop", brand.shopUrl]].filter((l) => l[1]);
  $("#foot").innerHTML = `<span>© ${new Date().getFullYear()}</span><nav>${links.map(([n, u]) => `<a href="${esc(u)}" target="_blank" rel="noopener">${n}</a>`).join("")}</nav>`;

  /* ---------- Release sheet ---------- */
  const sheet = $("#sheet"), sheetBody = $("#sheet-body");
  let sheetOpen = false, modalOpen = false;
  function openRelease(key, scrollToLyrics) {
    const r = releases.find((x) => x.key === key); if (!r) return;
    $("#sheet-bg").innerHTML = `<div class="giant" aria-hidden="true">${esc(r.title.toUpperCase())}</div>`;
    applyTheme(sheet, r);
    const one = r.single ? r.tracks[0] : null;
    sheetBody.innerHTML = `
      <div class="rel-head">
        <div class="art">${artHTML(r.cover, r.title)}</div>
        <div>
          <p class="spaced">${spaced(r.type)}</p>
          <h1>${esc(r.title)}</h1>
          <div class="meta">${r.date ? `<span>${year(r.date)}</span>` : ""}${!r.single ? `<span>${r.tracks.length} songs</span>` : ""}<span data-total="${r.key}"></span></div>
          <div class="actions">
            ${r.tracks.some((t) => t.audio) ? `<button class="btn btn-primary" data-play="${r.key}">${ICON_PLAY}Play</button>` : ""}
            ${one && (one.video || one.youtube) ? `<button class="btn btn-ghost" data-video="${esc(one.id)}">${ICON_VIDEO}${esc(one.videoLabel || "Watch video")}</button>` : ""}
          </div>
        </div>
      </div>
      ${r.description ? `<p class="rel-desc">${esc(r.description)}</p>` : ""}
      <ol class="tracks">${r.tracks.map((t, i) => `
        <li class="trk" data-song="${esc(t.id)}" data-rel="${r.key}" data-i="${i}">
          <span class="n">${i + 1}</span>
          <div><div class="t">${esc(t.title)}</div>${!r.single && t.description ? `<div class="s">${esc(t.description)}</div>` : ""}</div>
          ${t.video || t.youtube ? `<button class="tag" data-video="${esc(t.id)}">${esc(t.videoLabel || "Video")}</button>` : "<span></span>"}
          <span class="d" data-dur="${esc(t.id)}">${fmt(durations[t.id])}</span>
        </li>`).join("")}${!r.tracks.length ? `<p class="empty">Songs coming soon.</p>` : ""}</ol>
      ${r.tracks.filter((t) => t.lyrics).map((t) => `<section class="lyrics" id="lyrics-${esc(t.id)}"><h3>${r.single ? "Lyrics" : esc(t.title) + " — Lyrics"}</h3><pre>${esc(t.lyrics)}</pre></section>`).join("")}`;
    updateTotals(); markPlaying();
    requestAnimationFrame(() => fitGiant(sheet));
    if (!sheetOpen) history.pushState({ sheet: key }, "");
    sheetOpen = true; sheet.classList.add("open"); sheet.setAttribute("aria-hidden", "false"); document.body.classList.add("locked");
    sheet.scrollTop = 0;
    if (scrollToLyrics) setTimeout(() => $("#lyrics-" + CSS.escape(scrollToLyrics), sheetBody)?.scrollIntoView({ behavior: "smooth" }), 350);
  }
  function closeSheet() { sheetOpen = false; sheet.classList.remove("open"); sheet.setAttribute("aria-hidden", "true"); if (!modalOpen) document.body.classList.remove("locked"); }
  $("#sheet-close").onclick = () => history.back();

  /* ---------- Video modal ---------- */
  const modal = $("#modal"), frame = $("#modal-frame");
  function openVideo(item) {
    if (!item) return;
    if (audio && !audio.paused) audio.pause();
    frame.className = "modal-frame";
    if (item.youtube) frame.innerHTML = `<iframe src="https://www.youtube.com/embed/${encodeURIComponent(item.youtube)}?autoplay=1&rel=0&playsinline=1" allow="autoplay; encrypted-media; fullscreen; picture-in-picture" allowfullscreen></iframe>`;
    else {
      frame.innerHTML = `<video src="${esc(item.file)}" ${item.poster ? `poster="${esc(item.poster)}"` : ""} controls autoplay playsinline></video>`;
      const v = $("video", frame);
      v.onloadedmetadata = () => frame.classList.toggle("portrait", v.videoHeight > v.videoWidth);
    }
    history.pushState({ modal: 1 }, "");
    modalOpen = true; modal.classList.add("open"); modal.setAttribute("aria-hidden", "false"); document.body.classList.add("locked");
  }
  function closeModal() {
    modalOpen = false; modal.classList.remove("open"); modal.setAttribute("aria-hidden", "true");
    setTimeout(() => (frame.innerHTML = ""), 300);
    if (!sheetOpen) document.body.classList.remove("locked");
  }
  $("#modal-close").onclick = () => history.back();
  modal.onclick = (e) => { if (e.target === modal) history.back(); };
  addEventListener("popstate", () => { if (modalOpen) return closeModal(); if (sheetOpen) closeSheet(); });
  const videoForSong = (id) => videoItems.find((v) => v.id === "song:" + id);

  /* ---------- Player ---------- */
  const bar = $("#player");
  function playRelease(key, i = 0) {
    const r = releases.find((x) => x.key === key); if (!r) return;
    queue = r.tracks.filter((t) => t.audio);
    const start = r.tracks[i] && r.tracks[i].audio ? queue.indexOf(r.tracks[i]) : 0;
    if (queue.length) playAt(Math.max(0, start));
  }
  function playAt(i) {
    qi = (i + queue.length) % queue.length;
    const s = queue[qi];
    if (!audio) {
      audio = new Audio(); audio.preload = "auto";
      audio.addEventListener("timeupdate", syncTime);
      audio.addEventListener("loadedmetadata", syncTime);
      audio.addEventListener("play", syncState); audio.addEventListener("pause", syncState);
      audio.addEventListener("ended", () => (qi < queue.length - 1 ? playAt(qi + 1) : syncState()));
    }
    audio.src = s.audio;
    audio.play().catch(() => {});
    bar.hidden = false;
    const cov = coverOf(s);
    $("#pl-cover").src = cov || LOGO;
    $("#pl-title").textContent = s.title;
    const rel = releaseOf(s);
    $("#pl-sub").textContent = rel && !rel.single ? rel.title : rel?.type || "";
    $("#pl-lyrics").hidden = !s.lyrics;
    $("#pl-video").hidden = !(s.video || s.youtube);
    markPlaying();
    if ("mediaSession" in navigator) {
      navigator.mediaSession.metadata = new MediaMetadata({ title: s.title, artist: "Dawn Sogni", album: rel && !rel.single ? rel.title : "", artwork: cov ? [{ src: new URL(cov, location.href).href, sizes: "1080x1080", type: "image/jpeg" }] : [] });
      navigator.mediaSession.setActionHandler("previoustrack", () => playAt(qi - 1));
      navigator.mediaSession.setActionHandler("nexttrack", () => playAt(qi + 1));
    }
  }
  function toggle() { if (!audio) { const f = featured || byDate[0]; return f && playRelease(f.key); } audio.paused ? audio.play() : audio.pause(); }
  function syncState() { $("#pl-icon").setAttribute("d", audio && !audio.paused ? "M7 5h3.5v14H7zM13.5 5H17v14h-3.5z" : "M8 5v14l11-7z"); markPlaying(); }
  function syncTime() { if (!audio) return; $("#pl-fill").style.width = (audio.duration ? (audio.currentTime / audio.duration) * 100 : 0) + "%"; $("#pl-time").textContent = `${fmt(audio.currentTime)} / ${fmt(audio.duration)}`; }
  function markPlaying() { const cur = queue[qi]; $$(".trk").forEach((el) => el.classList.toggle("playing", !!cur && el.dataset.song === cur.id && audio && !audio.paused)); }
  $("#pl-play").onclick = toggle;
  $("#pl-prev").onclick = () => (audio && audio.currentTime > 3 ? (audio.currentTime = 0) : playAt(qi - 1));
  $("#pl-next").onclick = () => playAt(qi + 1);
  $("#pl-progress").onclick = (e) => { if (!audio?.duration) return; const r = e.currentTarget.getBoundingClientRect(); audio.currentTime = ((e.clientX - r.left) / r.width) * audio.duration; };
  const openCurrent = () => { const s = queue[qi], r = s && releaseOf(s); if (r) openRelease(r.key); };
  $("#pl-cover").onclick = openCurrent; $(".pl-meta").onclick = openCurrent;
  $("#pl-lyrics").onclick = () => { const s = queue[qi], r = s && releaseOf(s); if (r) openRelease(r.key, s.id); };
  $("#pl-video").onclick = () => openVideo(videoForSong(queue[qi]?.id));

  /* ---------- Global clicks ---------- */
  document.addEventListener("click", (e) => {
    const play = e.target.closest("[data-play]"), vid = e.target.closest("[data-video]"), vcard = e.target.closest("[data-vid]");
    const trk = e.target.closest(".trk"), open = e.target.closest("[data-open]");
    if (play) { e.stopPropagation(); return playRelease(play.dataset.play); }
    if (vid) { e.stopPropagation(); return openVideo(videoForSong(vid.dataset.video)); }
    if (vcard) return openVideo(videoItems.find((v) => v.id === vcard.dataset.vid));
    if (trk) { const cur = queue[qi]; if (cur && cur.id === trk.dataset.song && audio) return toggle(); return playRelease(trk.dataset.rel, +trk.dataset.i); }
    if (open) return openRelease(open.dataset.open);
  });
  addEventListener("keydown", (e) => {
    if (/INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName)) return;
    if (e.code === "Space" && audio && !modalOpen) { e.preventDefault(); toggle(); }
    if (e.key === "Escape" && (modalOpen || sheetOpen)) history.back();
  });

  /* ---------- Header + reveal ---------- */
  const hdr = $("#hdr");
  const onScroll = () => hdr.classList.toggle("solid", scrollY > 20);
  addEventListener("scroll", onScroll, { passive: true }); onScroll();
  function observe() {
    io ||= new IntersectionObserver((es) => es.forEach((en) => { if (en.isIntersecting) { en.target.classList.add("in"); io.unobserve(en.target); } }), { threshold: 0.08 });
    $$(".reveal:not(.in)").forEach((el) => io.observe(el));
  }
  observe();
})();
