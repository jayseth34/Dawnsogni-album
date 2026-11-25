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
  /* Live content: read the newest content.json straight from GitHub (no waiting for the Pages rebuild),
     falling back to the deployed copy. Newly uploaded files load from GitHub until Pages has them. */
  const REPO = (() => {
    const owner = location.hostname.endsWith(".github.io") ? location.hostname.split(".")[0] : "jayseth34";
    const repo = location.hostname.endsWith(".github.io") ? (location.pathname.split("/")[1] || "dawnsogni-album") : "dawnsogni-album";
    return { owner, repo, branch: "gh-pages" };
  })();
  const RAW = `https://raw.githubusercontent.com/${REPO.owner}/${REPO.repo}/${REPO.branch}/`;
  async function loadContent() {
    try {
      const r = await fetch(`https://api.github.com/repos/${REPO.owner}/${REPO.repo}/contents/content.json?ref=${REPO.branch}&t=${Date.now()}`, { headers: { Accept: "application/vnd.github.raw+json" }, cache: "no-store" });
      if (r.ok) return await r.json();
    } catch {}
    return await (await fetch("content.json?v=" + Date.now(), { cache: "no-store" })).json();
  }
  try { C = await loadContent(); } catch {}
  // media fallback: if a freshly uploaded file isn't on Pages yet, load it from GitHub directly
  const rawUrl = (u) => { try { const x = new URL(u, location.href); const i = x.pathname.indexOf("/media/"); return i >= 0 && x.origin === location.origin ? RAW + x.pathname.slice(i + 1) : null; } catch { return null; } };
  document.addEventListener("error", (e) => {
    const el = e.target; if (!el || !/^(IMG|VIDEO|AUDIO)$/.test(el.tagName) || el.dataset.raw) return;
    const alt = rawUrl(el.currentSrc || el.src); if (alt) { el.dataset.raw = 1; el.src = alt; }
  }, true);
  const brand = C.brand || {};
  const albums = C.albums || [];
  const SHOW_VIDEOS = false; // lyric/music videos hidden for now — songs + lyrics only
  if (!SHOW_VIDEOS) { (C.songs || []).forEach((s) => { s.video = ""; s.youtube = ""; }); C.videos = []; }
  const songs = (C.songs || []).filter((s) => s.audio || s.video || s.youtube || (s.title && s.title.trim()));
  songs.forEach((s) => { if (!s.lyrics && (s.description || "").split("\n").length > 8) { s.lyrics = s.description; s.description = ""; } });
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

  /* ---------- Lyrics ---------- */
  // Plain text, or synced with [mm:ss.xx] at the start of lines (LRC style)
  const TS = /^\s*\[(\d+):(\d+(?:\.\d+)?)\]\s?(.*)$/;
  function parseLyrics(text) {
    const raw = String(text || "").replace(/\r/g, "").split("\n");
    const lines = raw.map((l) => { const m = l.match(TS); return m ? { t: +m[1] * 60 + +m[2], text: m[3] } : { t: null, text: l.replace(/^\s*\[[^\]]*\]\s?/, "") }; });
    const stamped = lines.filter((l) => l.t !== null).length;
    const synced = stamped > 0 && stamped >= lines.filter((l) => l.text.trim()).length * 0.6;
    return { synced, lines: synced ? lines.filter((l) => l.t !== null) : lines };
  }
  const plainLyrics = (text) => parseLyrics(text).lines.map((l) => l.text).join("\n");
  const lyricLines = (song) => {
    const L = parseLyrics(song.lyrics);
    return `<div class="ly ${L.synced ? "synced" : ""}" data-ly="${esc(song.id)}">${L.lines.map((l, i) =>
      `<p class="ly-line" data-i="${i}" ${l.t !== null ? `data-t="${l.t}"` : ""}>${esc(l.text) || "&nbsp;"}</p>`).join("")}</div>`;
  };
  // pull the punchiest lines (shouted hooks first) for the homepage marquee
  function hooks(text) {
    if (!text) return [];
    const lines = parseLyrics(text).lines.map((l) => l.text.replace(/\[[^\]]*\]/g, "").replace(/\s+/g, " ").trim())
      .filter((l) => l.length >= 8 && l.length <= 44);
    const caps = (l) => { const letters = l.replace(/[^A-Za-z]/g, ""); return letters && letters.replace(/[^A-Z]/g, "").length / letters.length; };
    const uniq = [...new Set(lines.map((l) => l.replace(/[.,!?…]+$/, "")))];
    const loud = uniq.filter((l) => caps(l) > 0.7);
    return (loud.length >= 3 ? loud : uniq).slice(0, 8).map((l) => l.toUpperCase());
  }
  const withLyrics = () => songs.filter((s) => s.lyrics && s.lyrics.trim());

  /* ---------- Zine helpers ---------- */
  function seeded(str) { let h = 2166136261; for (const c of str) h = Math.imul(h ^ c.charCodeAt(0), 16777619); return () => ((h = Math.imul(h ^ (h >>> 15), 2246822507) >>> 0) / 4294967296); }
  // ransom-note headline: every letter cut from a different "magazine"
  function ransom(text) {
    const rnd = seeded(text), fonts = ["g", "a", "s", "m", "i"], looks = ["w", "b", "n", "r", "w", "b", "t"];
    return String(text).split(/\s+/).filter(Boolean).map((word) => `<span class="rs-word">${[...word].map((ch) => {
      const f = fonts[Math.floor(rnd() * fonts.length)], l = looks[Math.floor(rnd() * looks.length)];
      const rot = (rnd() * 12 - 6).toFixed(1), dy = (rnd() * 10 - 5).toFixed(0), up = rnd() > 0.45;
      return `<span class="rs f-${f} l-${l}" style="transform:rotate(${rot}deg) translateY(${dy}%)">${esc(up ? ch.toUpperCase() : ch.toLowerCase())}</span>`;
    }).join("")}</span>`).join(`<span class="rs-gap"> </span>`);
  }
  // torn paper strip between sections
  function tear(seed, flip) {
    const rnd = seeded("tear" + seed); let top = "M0,30 ", bot = "";
    for (let x = 0; x <= 100; x += 1.5) top += `L${x},${(10 + rnd() * 18).toFixed(1)} `;
    for (let x = 100; x >= 0; x -= 1.5) bot += `L${x},${(46 + rnd() * 16).toFixed(1)} `;
    return `<div class="tear ${flip ? "flip" : ""}" aria-hidden="true"><svg viewBox="0 0 100 70" preserveAspectRatio="none"><path d="${top}${bot}Z" /></svg></div>`;
  }

  /* ---------- Durations ---------- */
  const dur = {};
  songs.forEach((s) => {
    if (!s.audio) return;
    const a = new Audio(); a.preload = "metadata"; a.src = s.audio;
    a.onerror = () => { const alt = !a._raw && rawUrl(a.src); if (alt) { a._raw = 1; a.src = alt; } };
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
      const A = C.artist || {};
      const name = A.name || "Dawn Sogni";
      const photo = A.photo || (featured && featured.cover) || "";
      const popular = [...songs].filter((t) => t.audio).sort((x, y) => String(y.releaseDate).localeCompare(String(x.releaseDate))).slice(0, 5);
      const lyr = songs.find((t) => t.lyrics);
      return `
        <section class="ar-banner">
          ${photo ? `<img class="ar-img" src="${esc(photo)}" alt="${esc(name)}" />` : ""}
          <div class="ar-shade"></div>
          <div class="ar-text">
            <p class="ar-badge"><svg viewBox="0 0 24 24"><path d="M12 1 9.4 3.6 5.7 3.3l-.3 3.7L2.2 9l1.8 3.3L2.2 15.6l3.2 1.9.3 3.7 3.7-.3L12 23l2.6-2.1 3.7.3.3-3.7 3.2-1.9-1.8-3.3L21.8 9l-3.2-2-.3-3.7-3.7.3z"/><path fill="#000" d="m10.6 16.2-3.9-3.9 1.4-1.4 2.5 2.5 5.3-5.3 1.4 1.4z"/></svg>Artist</p>
            <h1 class="ransom" aria-label="${esc(name)}">${ransom(name)}</h1>
            ${A.realName || A.tagline ? `<p class="ar-tag">${esc([A.realName, A.tagline].filter(Boolean).join("  ·  "))}</p>` : ""}
          </div>
          ${tear(1)}
        </section>
        <div class="actions ar-actions">
          ${popular.length ? `<button class="big-play" data-playsong="${esc(popular[0].id)}" aria-label="Play">${P}</button>` : ""}
          ${brand.instagram ? `<a class="txt-act" href="${esc(brand.instagram)}" target="_blank" rel="noopener">Follow</a>` : ""}
        </div>

        ${popular.length ? `<section class="shelf"><div class="shelf-head"><h2>Popular</h2></div>
          <div class="tl pop">${popular.map((t, i) => { const r = releaseOf(t); return `
            <div class="tl-row" data-song="${esc(t.id)}" data-rel="${r.key}" data-i="${r.tracks.indexOf(t)}">
              <span class="n"><span class="num">${i + 1}</span><span class="pi">${P}</span></span>
              <div class="tt">${coverOf(t) ? `<img src="${esc(coverOf(t))}" alt="" />` : ""}<div style="min-width:0"><div class="name">${esc(t.title)}</div><div class="sub">${esc(r.single ? "Single" : r.title)}</div></div></div>
              <span>${t.lyrics ? `<a class="vtag" href="#/lyrics/${encodeURIComponent(t.id)}">Lyrics</a>` : ""}</span>
              <span class="d" data-dur="${esc(t.id)}">${fmt(dur[t.id])}</span>
            </div>`; }).join("")}</div></section>` : `<p class="empty">New music on the way.</p>`}

        ${releases.length ? `<section class="shelf"><div class="shelf-head"><h2>Discography</h2></div>
          <div class="vinyls">${releases.map((r) => `
            <div class="vinyl-card" data-go="#/r/${r.key}">
              <div class="vinyl-wrap"><div class="record"><span style="${r.cover ? `background-image:url('${esc(r.cover)}')` : ""}"></span></div><div class="sleeve">${art(r.cover, r.title)}</div>
                ${r.tracks.some((t) => t.audio) ? `<button class="v-play" data-play="${r.key}" aria-label="Play">${P}</button>` : ""}</div>
              <p class="v-title">${esc(r.title)}</p><p class="v-sub">${r.date ? year(r.date) + " · " : ""}${esc(r.type)}</p>
            </div>`).join("")}</div></section>` : ""}

        ${lyr ? `<section class="shelf"><div class="shelf-head"><h2>Lyrics</h2><a href="#/lyrics">Show all</a></div>
          <a class="lyr-card" href="#/lyrics/${encodeURIComponent(lyr.id)}">
            <p class="lyr-song">${esc(lyr.title)}</p>
            ${parseLyrics(lyr.lyrics).lines.map((l) => l.text.trim()).filter((t) => t && !/^\[.*\]$/.test(t)).slice(0, 6).map((t) => `<p>${esc(t)}</p>`).join("")}
            <span class="lyr-more">Read all →</span>
          </a></section>` : ""}

        ${photo ? `<section class="shelf"><div class="shelf-head"><h2>About</h2></div>
          <div class="about-card" style="background-image:url('${esc(photo)}')">
            <div class="about-in">
              <p class="ransom small" aria-label="${esc(name)}">${ransom(name)}</p>
              ${A.tagline ? `<p class="about-tag">${esc(A.tagline)}</p>` : ""}
              ${A.bio ? `<p class="about-bio">${esc(A.bio)}</p>` : ""}
            </div>
          </div></section>` : ""}
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
        ${r.tracks.filter((t) => t.lyrics).map((t) => `<section class="lyrics-card"><div class="lc-head"><h3>${r.single ? "Lyrics" : esc(t.title)}</h3><a class="txt-act" href="#/lyrics/${encodeURIComponent(t.id)}">Open lyrics</a></div><pre>${esc(plainLyrics(t.lyrics))}</pre></section>`).join("")}
        ${shelf("More releases", more.map(card).join(""))}
        ${foot()}`;
    },

    videos() {
      theme(featured);
      return `<div class="wash"></div><h1 class="page-title">Videos</h1>
        ${videos.length ? `<section class="shelf"><div class="cards">${videos.map(vcard).join("")}</div></section>` : `<p class="empty">No videos yet.</p>`}${foot()}`;
    },

    lyricsIndex() {
      theme(featured);
      const L = withLyrics();
      return `<div class="wash"></div><h1 class="page-title">Lyrics</h1>
        ${L.length ? `<ul class="lib-list lib-page">${L.map((s) => `
          <li class="lib-row" data-go="#/lyrics/${encodeURIComponent(s.id)}">
            ${coverOf(s) ? `<img class="thumb" src="${esc(coverOf(s))}" alt="" />` : `<div class="thumb">${art("", s.title)}</div>`}
            <div><div class="t">${esc(s.title)}</div><div class="s">${parseLyrics(s.lyrics).synced ? "Synced lyrics" : "Lyrics"} • ${esc(releaseOf(s)?.title || "")}</div></div>
          </li>`).join("")}</ul>` : `<p class="empty">Lyrics coming soon.</p>`}${foot()}`;
    },

    lyrics(id) {
      const s = songs.find((x) => x.id === id); if (!s || !s.lyrics) return VIEWS.lyricsIndex();
      const r = releaseOf(s); theme(r);
      const synced = parseLyrics(s.lyrics).synced;
      return `<div class="wash"></div>
        <section class="ly-head">
          ${coverOf(s) ? `<img src="${esc(coverOf(s))}" alt="" />` : ""}
          <div><div class="rhead-type">Lyrics${synced ? " • synced" : ""}</div><h1>${esc(s.title)}</h1>
            <div class="actions" style="padding:14px 0 0">
              ${s.audio ? `<button class="big-play" data-playsong="${esc(s.id)}" aria-label="Play">${P}</button>` : ""}
              ${r ? `<a class="txt-act" href="#/r/${r.key}">${esc(r.type)}: ${esc(r.title)}</a>` : ""}
            </div>
          </div>
        </section>
        <section class="ly-page">${lyricLines(s)}</section>
        ${synced ? `<p class="ly-hint">Tap a line to jump there</p>` : ""}
        ${foot()}`;
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
    else if (h === "#/videos" && SHOW_VIDEOS) { html = VIEWS.videos(); name = "videos"; title = "Videos"; }
    else if (h === "#/lyrics") { html = VIEWS.lyricsIndex(); name = "lyrics"; title = "Lyrics"; }
    else if (h.startsWith("#/lyrics/")) { const id = decodeURIComponent(h.slice(9)); html = VIEWS.lyrics(id); name = "lyrics"; title = songs.find((x) => x.id === id)?.title || "Lyrics"; }
    else if (h === "#/library") { html = VIEWS.library(); name = "library"; title = "Your Library"; }
    else html = VIEWS.home();
    view.innerHTML = html;
    $("#tb-title").textContent = title;
    $$("[data-nav]").forEach((a) => a.classList.toggle("on", a.dataset.nav === name));
    main.scrollTo(0, 0); scrollTo(0, 0);
    $$('[data-nav="videos"]').forEach((a) => (a.hidden = !SHOW_VIDEOS));
    $("#b-video").hidden = !SHOW_VIDEOS;
    renderLibrary(); totals(); mark(); fitGiant(); lastLine = -2; syncLyrics(true); enhance();
    if (document.fonts) document.fonts.ready.then(fitGiant);
    onScroll();
  }
  addEventListener("hashchange", () => { closeFull(true); route(); });

  /* ---------- Home motion: parallax hero, tilting cover, cinema preview, reveals ---------- */
  let io2;
  function enhance() {
    const tilt = $("#tilt");
    if (tilt && matchMedia("(hover: hover)").matches) {
      const inner = $(".tilt-in", tilt), glare = $(".glare", tilt);
      tilt.onmousemove = (e) => {
        const r = tilt.getBoundingClientRect(), x = (e.clientX - r.left) / r.width - 0.5, y = (e.clientY - r.top) / r.height - 0.5;
        inner.style.transform = `rotateY(${x * 16}deg) rotateX(${-y * 16}deg)`;
        glare.style.background = `radial-gradient(circle at ${50 + x * 100}% ${50 + y * 100}%, rgba(255,255,255,0.22), transparent 55%)`;
      };
      tilt.onmouseleave = () => { inner.style.transform = ""; glare.style.background = ""; };
    }
    io2?.disconnect();
    io2 = new IntersectionObserver((es) => es.forEach((en) => {
      if (en.target.classList.contains("reveal")) { if (en.isIntersecting) en.target.classList.add("in"); return; }
      en.isIntersecting ? en.target.play().catch(() => {}) : en.target.pause();
    }), { threshold: 0.15 });
    $$(".reveal, .cinema video").forEach((el) => io2.observe(el));
  }
  function parallax(y) {
    const m = $("#hero-media"), c = $("#hero-content"); if (!m) return;
    m.style.transform = `translate3d(0, ${y * 0.35}px, 0) scale(${1.05 + y * 0.0003})`;
    c.style.transform = `translate3d(0, ${y * 0.15}px, 0)`; c.style.opacity = Math.max(0, 1 - y / 500);
  }

  const topbar = $("#topbar");
  function onScroll() { const y = innerWidth <= 800 ? scrollY : main.scrollTop; topbar.classList.toggle("solid", y > ($("#hero") ? $("#hero").offsetHeight - 80 : 220)); parallax(y); }
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
      audio.addEventListener("error", () => { const alt = !audio.dataset.raw && rawUrl(audio.src); if (alt) { audio.dataset.raw = 1; audio.src = alt; audio.play().catch(() => {}); } });
      audio.addEventListener("timeupdate", time); audio.addEventListener("loadedmetadata", time);
      audio.addEventListener("play", mark); audio.addEventListener("pause", mark);
      audio.addEventListener("ended", () => (qi < queue.length - 1 ? playAt(qi + 1) : (audio.currentTime = 0, mark())));
    }
    delete audio.dataset.raw; audio.src = s.audio; audio.play().catch(() => {});
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
    const fl = $("#full-lyrics"); fl.hidden = !s.lyrics; fl.innerHTML = s.lyrics ? `<h3>Lyrics</h3>${lyricLines(s)}` : "";
    lastLine = -2;
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
    syncLyrics();
  }

  /* ---------- Synced lyrics highlight ---------- */
  let lastLine = -2, userScrollAt = 0;
  ["wheel", "touchmove"].forEach((ev) => addEventListener(ev, () => (userScrollAt = Date.now()), { passive: true }));
  function syncLyrics(force) {
    const s = queue[qi];
    $$(".ly.synced").forEach((box) => {
      const lines = $$(".ly-line", box), mine = s && box.dataset.ly === s.id && audio;
      let idx = -1;
      if (mine) { const t = audio.currentTime + 0.15; lines.forEach((l, i) => { if (+l.dataset.t <= t) idx = i; }); }
      if (!force && idx === lastLine && box.dataset.last == idx) return;
      box.dataset.last = idx;
      lines.forEach((l, i) => { l.classList.toggle("active", i === idx); l.classList.toggle("past", idx >= 0 && i < idx); });
      if (idx >= 0 && Date.now() - userScrollAt > 2500 && box.offsetParent) lines[idx].scrollIntoView({ block: "center", behavior: "smooth" });
    });
    lastLine = queue[qi] ? lastLine : -2;
  }
  function mark() {
    const playing = !!(audio && !audio.paused), cur = queue[qi];
    $$(".ico-play").forEach((p) => p.setAttribute("d", playing ? "M7 5h3.5v14H7zM13.5 5H17v14h-3.5z" : "M8 5v14l11-7z"));
    $$(".tl-row").forEach((el) => el.classList.toggle("playing", !!cur && el.dataset.song === cur.id));
    $$(".big-play[data-play]").forEach((b) => { const r = byKey[b.dataset.play]; b.innerHTML = r && isPlayingRel(r) ? PAUSE : P; });
    $$("[data-playsong]").forEach((b) => (b.innerHTML = playing && cur && cur.id === b.dataset.playsong ? PAUSE : P));
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
  $("#b-lyrics").onclick = () => { const s = queue[qi]; if (s) location.hash = "#/lyrics/" + encodeURIComponent(s.id); };
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
    const ps = t.closest("[data-playsong]"), line = t.closest(".ly.synced .ly-line");
    if (ps || line) {
      const id = ps ? ps.dataset.playsong : line.closest(".ly").dataset.ly, song = songs.find((x) => x.id === id);
      if (!song || !song.audio) return;
      const cur = queue[qi];
      if (ps && cur && cur.id === id) return toggle();
      if (!cur || cur.id !== id) { const r = releaseOf(song); queue = r.tracks.filter((x) => x.audio); playAt(queue.indexOf(song)); }
      if (line) { const go = () => { audio.currentTime = +line.dataset.t; audio.play(); }; audio.readyState >= 1 ? go() : audio.addEventListener("loadedmetadata", go, { once: true }); }
      return;
    }
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
