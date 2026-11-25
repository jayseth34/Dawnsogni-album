/* Dawn Sogni — Admin. Edits content.json and uploads media straight to the GitHub repo
   via the GitHub REST API. No server: the token lives only in this browser. */
(() => {
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const esc = (v) => String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const uid = (s = "") => (s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 30) || "item") + "-" + Math.random().toString(36).slice(2, 6);

  const EMPTY = () => ({
    brand: { instagram: "", spotify: "", appleMusic: "", youtube: "", shopUrl: "https://jayseth34.github.io/DawnSogniWeb/" },
    featured: "", albums: [], songs: [], videos: [], events: [],
    artist: { name: "", realName: "", tagline: "", bio: "", photo: "" }
  });

  /* ---------- Config ---------- */
  const cfgKeys = ["owner", "repo", "branch", "token"], cfg = {};
  cfgKeys.forEach((k) => { const v = localStorage.getItem("dsadmin_" + k); if (v) $("#cfg-" + k).value = v; });
  const readCfg = () => cfgKeys.forEach((k) => { cfg[k] = $("#cfg-" + k).value.trim(); localStorage.setItem("dsadmin_" + k, cfg[k]); });

  /* ---------- GitHub API ---------- */
  async function gh(path, opts = {}) {
    const res = await fetch(`https://api.github.com/repos/${cfg.owner}/${cfg.repo}${path}`, {
      ...opts, headers: { Authorization: `Bearer ${cfg.token}`, Accept: "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28", ...(opts.headers || {}) }
    });
    const body = res.status === 204 ? null : await res.json().catch(() => null);
    if (!res.ok) { const e = new Error(body?.message || res.statusText); e.status = res.status; throw e; }
    return body;
  }
  const enc = (p) => p.split("/").map(encodeURIComponent).join("/");
  const b64utf8 = (str) => { const b = new TextEncoder().encode(str); let s = ""; for (let i = 0; i < b.length; i += 0x8000) s += String.fromCharCode.apply(null, b.subarray(i, i + 0x8000)); return btoa(s); };
  const unb64utf8 = (b) => new TextDecoder().decode(Uint8Array.from(atob(b.replace(/\s/g, "")), (c) => c.charCodeAt(0)));
  const fileB64 = (file) => new Promise((ok, no) => { const r = new FileReader(); r.onload = () => ok(String(r.result).split(",")[1]); r.onerror = no; r.readAsDataURL(file); });
  const putFile = (path, content, message, sha) => gh(`/contents/${enc(path)}`, { method: "PUT", body: JSON.stringify({ message, content, branch: cfg.branch, ...(sha ? { sha } : {}) }) });
  async function getSha(path) { try { return (await gh(`/contents/${enc(path)}?ref=${encodeURIComponent(cfg.branch)}`)).sha; } catch (e) { if (e.status === 404) return null; throw e; } }

  /* ---------- State ---------- */
  let data = EMPTY(), dirty = false, siteUrl = "./";
  const pending = new Map(), previews = new Map();
  const busy = new Map(); // upload path -> processing status
  const get = (path) => path.split(".").reduce((o, k) => (o == null ? o : o[k]), data);
  const set = (path, val) => { const ks = path.split("."), last = ks.pop(); const o = ks.reduce((o, k) => (o[k] ??= {}), data); o[last] = val; markDirty(); };
  const markDirty = () => { dirty = true; $("#publish").disabled = busy.size > 0; };
  addEventListener("beforeunload", (e) => { if (dirty) { e.preventDefault(); e.returnValue = ""; } });

  /* ---------- Connect ---------- */
  const status = (m, c = "") => { const s = $("#connect-status"); s.textContent = m; s.className = "status " + c; };
  $("#connect").onclick = async () => {
    readCfg();
    if (!cfg.token) return status("Paste your token first.", "err");
    status("Connecting…");
    try {
      const repo = await gh("");
      if (repo.permissions && !repo.permissions.push) return status("This token can't write to the repo.", "err");
      try {
        const pages = await gh("/pages");
        if (pages?.source?.branch) { cfg.branch = pages.source.branch; $("#cfg-branch").value = cfg.branch; localStorage.setItem("dsadmin_branch", cfg.branch); }
        if (pages?.html_url) siteUrl = pages.html_url;
      } catch {}
      try {
        const f = await gh(`/contents/content.json?ref=${encodeURIComponent(cfg.branch)}`);
        const raw = JSON.parse(unb64utf8(f.content));
        data = Object.assign(EMPTY(), raw); data.brand = Object.assign(EMPTY().brand, raw.brand || {}); data.artist = Object.assign(EMPTY().artist, raw.artist || {});
        ["albums", "songs", "videos", "events"].forEach((k) => Array.isArray(data[k]) || (data[k] = []));
      } catch (e) { if (e.status !== 404) throw e; data = EMPTY(); }
      dirty = false; $("#publish").disabled = true; $("#editor").hidden = false;
      status(`Connected · publishing to ${cfg.owner}/${cfg.repo} (${cfg.branch})`, "ok");
      render();
    } catch (e) {
      status(e.status === 401 ? "Token rejected — check it and try again." : e.status === 404 ? "Repo or branch not found (or the token has no access)." : "Error: " + e.message, "err");
    }
  };
  $("#forget").onclick = () => { localStorage.removeItem("dsadmin_token"); $("#cfg-token").value = ""; status("Token removed from this browser."); };
  if (localStorage.getItem("dsadmin_token")) $("#connect").click();

  /* ---------- Tabs ---------- */
  $("#tabs").onclick = (e) => {
    const b = e.target.closest("button"); if (!b) return;
    $$("#tabs button").forEach((x) => x.classList.toggle("on", x === b));
    $$(".tab").forEach((t) => (t.hidden = t.dataset.tab !== b.dataset.tab));
    render();
  };

  /* ---------- List definitions ---------- */
  const albumOptions = () => [["", "Single (no album)"], ...data.albums.map((a) => [a.id, a.title || "Untitled album"])];
  const LISTS = {
    songs: {
      name: "song",
      blank: () => ({ id: uid("song"), title: "", album: "", releaseDate: new Date().toISOString().slice(0, 10), description: "", lyrics: "", cover: "", audio: "", video: "", videoLabel: "Lyric video", youtube: "", color: "", accent: "" }),
      head: (s) => `${esc(s.title || "Untitled song")}<small>${esc(s.album ? data.albums.find((a) => a.id === s.album)?.title || "Single" : "Single")}</small>`,
      fields: [
        { row: [{ k: "title", label: "Title" }, { k: "album", label: "Album", type: "select", options: albumOptions }, { k: "releaseDate", label: "Release date", type: "date" }] },
        { k: "audio", label: "Audio — MP3, M4A, WAV… or drop a video and its audio is extracted automatically", type: "upload", accept: "audio/*,video/*" },
        { k: "cover", label: "Cover art (square). Songs in an album use the album cover if left empty.", type: "upload", accept: "image/*" },
        { row: [{ k: "color", label: "Theme colour (site colour for this release)", type: "color" }, { k: "accent", label: "Light colour", type: "color" }] },
        { k: "description", label: "Description (optional)", type: "textarea", rows: 2 },
        { k: "video", label: "Lyric / music video (MP4, optional)", type: "upload", accept: "video/*" },
        { row: [{ k: "videoLabel", label: "Video button text", placeholder: "Lyric video" }, { k: "youtube", label: "…or YouTube link", placeholder: "https://youtu.be/…" }] }
      ]
    },
    albums: {
      name: "album",
      blank: () => ({ id: uid("album"), title: "", type: "Album", releaseDate: "", description: "", cover: "", color: "", accent: "" }),
      head: (a) => `${esc(a.title || "Untitled album")}<small>${esc(a.type || "Album")} · ${data.songs.filter((s) => s.album === a.id).length} songs</small>`,
      fields: [
        { row: [{ k: "title", label: "Title" }, { k: "type", label: "Type", type: "select", options: () => ["Album", "EP", "Mixtape", "Deluxe"].map((x) => [x, x]) }, { k: "releaseDate", label: "Release date", type: "date" }] },
        { k: "description", label: "Description", type: "textarea", rows: 3 },
        { k: "cover", label: "Album cover (square)", type: "upload", accept: "image/*" },
        { row: [{ k: "color", label: "Theme colour (site colour for this release)", type: "color" }, { k: "accent", label: "Light colour", type: "color" }] }
      ]
    },
    videos: {
      name: "video",
      blank: () => ({ title: "", label: "Video", youtube: "", description: "", file: "", poster: "" }),
      head: (v) => `${esc(v.title || "Untitled video")}<small>${esc(v.label || "")}</small>`,
      fields: [
        { row: [{ k: "title", label: "Title" }, { k: "label", label: "Label", placeholder: "Video, Film, Behind the scenes…" }] },
        { k: "youtube", label: "YouTube link (or upload an MP4 below)", placeholder: "https://youtu.be/…" },
        { k: "file", label: "MP4 file", type: "upload", accept: "video/*" },
        { k: "poster", label: "Thumbnail image (optional)", type: "upload", accept: "image/*" }
      ]
    },
    events: {
      name: "event",
      blank: () => ({ date: "", title: "", place: "", link: "", cta: "" }),
      head: (e) => `${esc(e.title || "Untitled event")}<small>${esc(e.date || "")}</small>`,
      fields: [
        { row: [{ k: "date", label: "Date", type: "date" }, { k: "title", label: "Title" }, { k: "place", label: "Place" }] },
        { row: [{ k: "link", label: "Link (tickets / RSVP, optional)" }, { k: "cta", label: "Button text", placeholder: "Tickets" }] }
      ]
    }
  };

  function fieldHTML(f, base) {
    if (f.row) return `<div class="grid${f.row.length}">${f.row.map((x) => fieldHTML(x, base)).join("")}</div>`;
    const p = `${base}.${f.k}`;
    if (f.type === "upload") return `<div class="upload-row" data-upload="${p}" data-accept="${f.accept}" data-label="${esc(f.label)}"></div>`;
    if (f.type === "textarea") return `<label>${f.label}<textarea rows="${f.rows || 3}" data-bind="${p}"></textarea></label>`;
    if (f.type === "select") return `<label>${f.label}<select data-bind="${p}">${f.options().map(([v, t]) => `<option value="${esc(v)}">${esc(t)}</option>`).join("")}</select></label>`;
    return `<label>${f.label}<input type="${f.type || "text"}" data-bind="${p}" placeholder="${esc(f.placeholder || "")}" /></label>`;
  }
  function renderList(key) {
    const L = LISTS[key], arr = data[key], box = $("#list-" + key);
    box.innerHTML = arr.length ? arr.map((it, i) => `
      <div class="item">
        <div class="item-head"><span class="num">${L.head(it)}</span>
          <button data-move="${key}:${i}:-1" title="Move up">↑</button><button data-move="${key}:${i}:1" title="Move down">↓</button>
          <button data-del="${key}:${i}" title="Remove">✕</button></div>
        ${L.fields.map((f) => fieldHTML(f, `${key}.${i}`)).join("")}
      </div>`).join("") : `<p class="empty">No ${L.name}s yet.</p>`;
    $$(".upload-row", box).forEach(renderUpload);
    bindInputs(box, () => { if (key === "albums") renderList("songs"); $$(".item-head .num", box).forEach((el, i) => (el.innerHTML = L.head(arr[i]))); });
  }

  document.addEventListener("click", (e) => {
    const add = e.target.closest("[data-add]"), mv = e.target.closest("[data-move]"), del = e.target.closest("[data-del]");
    if (add) { const k = add.dataset.add; data[k].unshift(LISTS[k].blank()); markDirty(); renderList(k); }
    if (mv) { const [k, i, d] = mv.dataset.move.split(":"), arr = data[k], a = +i, b = a + +d; if (b < 0 || b >= arr.length) return; [arr[a], arr[b]] = [arr[b], arr[a]]; markDirty(); renderList(k); }
    if (del) {
      const [k, i] = del.dataset.del.split(":"), item = data[k][+i];
      const n = k === "albums" ? data.songs.filter((s) => s.album === item.id).length : 0;
      if (!confirm(`Remove this ${LISTS[k].name}?${n ? `\n\nIts ${n} song(s) will become singles.` : ""}`)) return;
      if (k === "albums") data.songs.forEach((s) => s.album === item.id && (s.album = ""));
      data[k].splice(+i, 1); markDirty(); render();
    }
  });

  function bindInputs(root, onChange) {
    $$("[data-bind]", root).forEach((el) => {
      const p = el.dataset.bind; el.value = get(p) ?? "";
      if (el.type === "color" && !get(p)) el.value = "#202022";
      el.oninput = () => set(p, el.value);
      el.onchange = () => { set(p, el.value); onChange && onChange(); };
    });
  }

  /* ---------- Uploads ---------- */
  function renderUpload(row) {
    const p = row.dataset.upload, v = get(p) || "", isPending = v.startsWith("pending:"), accept = row.dataset.accept;
    const id = isPending ? v.slice(8) : null, src = isPending ? previews.get(id) : v;
    let preview = "";
    if (src && accept.startsWith("image")) preview = `<img class="thumb" src="${esc(src)}" alt="" />`;
    if (src && accept.startsWith("audio")) preview = `<audio controls preload="none" src="${esc(src)}"></audio>`;
    const name = isPending ? `${pending.get(id)?.name} — uploads when you publish` : v || "No file";
    row.innerHTML = `<label>${row.dataset.label}</label>
      <div class="upload">${preview}
        <span class="ghost small pick">${v ? "Replace" : "Choose file"}<input type="file" accept="${accept}" /></span>
        ${/\.cover$/.test(p) ? `<button class="ghost small" data-design>✦ Design cover</button>` : ""}
        ${v ? `<button class="ghost small danger" data-clear>Remove</button>` : ""}
        <span class="file-name ${isPending ? "pending" : ""}">${esc(name)}</span></div>`;
    $("input[type=file]", row).onchange = (e) => { const f = e.target.files[0]; if (f) handleFile(p, f); };
    if (busy.has(p)) { const fn = $(".file-name", row); fn.textContent = busy.get(p); fn.className = "file-name pending"; $(".pick", row).style.display = "none"; }
    const clr = $("[data-clear]", row); if (clr) clr.onclick = () => { set(p, ""); renderUpload(row); };
    const des = $("[data-design]", row); if (des) des.onclick = () => openMaker(p);
  }

  /* ---------- Automatic media processing (compress / extract audio) ---------- */
  const MAXB = 45 * 1024 * 1024;
  function setBusy(path, text) {
    if (text == null) busy.delete(path); else busy.set(path, text);
    $$(`.upload-row[data-upload="${path}"]`).forEach(renderUpload);
    const b = $("#publish"); b.disabled = busy.size > 0 || !dirty; b.textContent = busy.size ? "Processing…" : "Publish";
  }
  function addPending(path, file) {
    const nid = Math.random().toString(36).slice(2, 10);
    pending.set(nid, file); previews.set(nid, URL.createObjectURL(file));
    set(path, "pending:" + nid);
  }
  const prog = (path) => (p, label) => setBusy(path, `${label || "Working"}… ${Math.round(p * 100)}%`);
  const size = (f) => (f.size / 1048576).toFixed(1) + " MB";
  async function handleFile(path, f) {
    const m = path.match(/^songs\.(\d+)\.(audio|video)$/), song = m && data.songs[+m[1]];
    try {
      if (/\.(cover|poster|image|photo)$/.test(path)) {
        setBusy(path, "Optimising image…");
        addPending(path, await DSMedia.image(f));
      } else if (DSMedia.isVideo(f)) {
        if (song && m[2] === "audio") {
          // video dropped on the audio slot: take its audio, and keep the video as the song's video if it has none
          setBusy(path, "Extracting audio…");
          addPending(path, await DSMedia.extractAudio(f, prog(path)));
          setBusy(path, null);
          if (!song.video) { const vp = `songs.${m[1]}.video`; setBusy(vp, "Compressing video…"); const v = await DSMedia.video(f, prog(vp)); if (v.size <= MAXB) addPending(vp, v); setBusy(vp, null); }
        } else {
          setBusy(path, "Compressing video…");
          const v = await DSMedia.video(f, prog(path));
          if (v.size > MAXB) throw new Error(`Even compressed, the video is ${size(v)} — GitHub accepts up to 45 MB. Try a shorter clip.`);
          addPending(path, v);
          setBusy(path, null);
          if (song && !song.audio) { const ap = `songs.${m[1]}.audio`; setBusy(ap, "Extracting audio…"); addPending(ap, await DSMedia.extractAudio(f, prog(ap))); setBusy(ap, null); }
        }
      } else if (DSMedia.isAudio(f)) {
        setBusy(path, "Optimising audio…");
        const a = await DSMedia.audio(f, prog(path));
        if (a.size > MAXB) throw new Error(`The audio is ${size(a)} even after compressing — GitHub accepts up to 45 MB.`);
        addPending(path, a);
      } else {
        if (f.size > MAXB) throw new Error("That file is over 45 MB — GitHub won't accept it from the browser.");
        addPending(path, f);
      }
      if (song && !song.title) { song.title = f.name.replace(/\.[^.]+$/, "").replace(/[_-]+/g, " "); }
    } catch (err) {
      alert(err.message || String(err));
    } finally {
      [...busy.keys()].filter((k) => k.startsWith(path.replace(/\.[^.]+$/, ""))).forEach((k) => busy.delete(k));
      setBusy(path, null);
      if (m) renderList("songs"); else render();
    }
  }

  function renderFeatured() {
    const sel = $("#featured");
    const opts = [["", "Automatic — newest release"], ...data.albums.map((a) => ["a:" + a.id, `${a.type || "Album"}: ${a.title || "Untitled"}`]),
      ...data.songs.filter((s) => !s.album || !data.albums.some((a) => a.id === s.album)).map((s) => ["s:" + s.id, `Single: ${s.title || "Untitled"}`])];
    sel.innerHTML = opts.map(([v, t]) => `<option value="${esc(v)}">${esc(t)}</option>`).join("");
    sel.value = opts.some((o) => o[0] === data.featured) ? data.featured : "";
    sel.onchange = () => set("featured", sel.value);
  }

  /* ---------- Lyrics tab ---------- */
  const TS = /^\s*\[(\d+):(\d+(?:\.\d+)?)\]\s?(.*)$/;
  const isSynced = (t) => { const L = String(t || "").split("\n").filter((l) => l.trim()); return L.length > 0 && L.filter((l) => TS.test(l)).length >= L.length * 0.6; };
  const stripTimes = (t) => String(t || "").split("\n").map((l) => l.replace(/^\s*\[\d+:\d+(?:\.\d+)?\]\s?/, "")).join("\n");
  function renderLyricsTab() {
    const box = $("#lyrics-list");
    box.innerHTML = data.songs.length ? data.songs.map((s, i) => `
      <div class="item ly-card">
        <div class="item-head"><span class="num">${esc(s.title || "Untitled song")}<small>${s.audio ? "" : "no audio yet"}</small></span>
          <span class="badge ${isSynced(s.lyrics) ? "on" : ""}">${isSynced(s.lyrics) ? "Synced" : s.lyrics ? "Plain" : "Empty"}</span></div>
        <textarea rows="12" data-bind="songs.${i}.lyrics" placeholder="Paste lyrics here…"></textarea>
        <div class="row">
          <button class="ghost small" data-sync="${i}" ${s.audio ? "" : "disabled"}>♪ Sync with audio</button>
          <button class="ghost small" data-strip="${i}">Remove timings</button>
        </div>
      </div>`).join("") : `<p class="empty">Add a song first.</p>`;
    bindInputs(box, renderLyricsTab);
  }
  document.addEventListener("click", (e) => {
    const st = e.target.closest("[data-strip]"), sy = e.target.closest("[data-sync]");
    if (st) { const i = +st.dataset.strip; set(`songs.${i}.lyrics`, stripTimes(data.songs[i].lyrics)); renderLyricsTab(); }
    if (sy && !sy.disabled) openSync(+sy.dataset.sync);
  });

  /* ---------- Sync tool ---------- */
  const syA = $("#sy-audio"); let sy = { i: -1, lines: [], cur: 0 };
  const fmtTs = (t) => `${String(Math.floor(t / 60)).padStart(2, "0")}:${(t % 60).toFixed(2).padStart(5, "0")}`;
  function openSync(i) {
    const s = data.songs[i];
    if (!String(s.lyrics || "").trim()) return alert("Paste the lyrics first.");
    const src = String(s.audio || "").startsWith("pending:") ? previews.get(s.audio.slice(8)) : s.audio;
    syA.src = src;
    const lines = stripTimes(s.lyrics).split("\n").map((l) => l.trim()).filter(Boolean);
    const old = String(s.lyrics).split("\n").map((l) => l.match(TS)).filter(Boolean);
    sy = { i, lines: lines.map((text, k) => ({ text, t: old[k] && old[k][3].trim() === text ? +old[k][1] * 60 + +old[k][2] : null })), cur: 0 };
    sy.cur = Math.max(0, sy.lines.findIndex((l) => l.t === null)); if (sy.lines.every((l) => l.t !== null)) sy.cur = sy.lines.length;
    $("#sy-title").textContent = "Sync — " + (s.title || "song");
    $("#sy").hidden = false; drawSync();
  }
  function drawSync() {
    $("#sy-lines").innerHTML = sy.lines.map((l, k) => `<li class="${k === sy.cur ? "cur" : l.t !== null ? "done" : ""}" data-k="${k}"><span class="ts">${l.t !== null ? fmtTs(l.t) : ""}</span><span>${esc(l.text)}</span></li>`).join("");
    $("#sy-status").textContent = `${sy.lines.filter((l) => l.t !== null).length} / ${sy.lines.length} timed`;
    $("#sy-lines .cur")?.scrollIntoView({ block: "center" });
  }
  function stamp() { if (sy.cur >= sy.lines.length) return; sy.lines[sy.cur].t = Math.max(0, syA.currentTime - 0.2); sy.cur++; drawSync(); }
  $("#sy-stamp").onclick = stamp;
  $("#sy-undo").onclick = () => { if (sy.cur > 0) { sy.cur--; sy.lines[sy.cur].t = null; syA.currentTime = Math.max(0, (sy.lines[sy.cur - 1]?.t ?? 0)); drawSync(); } };
  $("#sy-restart").onclick = () => { sy.lines.forEach((l) => (l.t = null)); sy.cur = 0; syA.currentTime = 0; drawSync(); };
  $("#sy-lines").onclick = (e) => { const li = e.target.closest("li"); if (!li) return; sy.cur = +li.dataset.k; const t = sy.lines[sy.cur].t; if (t !== null) syA.currentTime = t; drawSync(); };
  addEventListener("keydown", (e) => { if ($("#sy").hidden || e.code !== "Space" || e.target.tagName === "TEXTAREA") return; e.preventDefault(); stamp(); });
  $("#sy-close").onclick = () => { syA.pause(); $("#sy").hidden = true; };
  $("#sy-save").onclick = () => {
    const text = sy.lines.map((l) => (l.t !== null ? `[${fmtTs(l.t)}] ${l.text}` : l.text)).join("\n");
    set(`songs.${sy.i}.lyrics`, text); syA.pause(); $("#sy").hidden = true; renderLyricsTab();
  };

  function render() {
    renderLyricsTab();
    bindInputs($('.tab[data-tab="artist"]'));
    $$('.tab[data-tab="artist"] .upload-row').forEach(renderUpload);
    bindInputs($('.tab[data-tab="settings"]'));
    Object.keys(LISTS).forEach(renderList);
    renderFeatured();
  }

  /* ---------- Publish ---------- */
  const log = (m, c = "") => { const li = document.createElement("li"); li.textContent = m; li.className = c; $("#log").append(li); li.scrollIntoView({ block: "nearest" }); return li; };
  const slug = (s) => s.toLowerCase().replace(/\.[^.]+$/, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40) || "file";
  const ext = (s) => (s.match(/\.([a-z0-9]+)$/i) || [, "bin"])[1].toLowerCase();
  const ytId = (v) => { v = (v || "").trim(); const m = v.match(/(?:v=|youtu\.be\/|shorts\/|embed\/|live\/)([\w-]{11})/); return m ? m[1] : v; };
  function walk(o, path, fn) {
    if (Array.isArray(o)) o.forEach((x, i) => walk(x, `${path}.${i}`, fn));
    else if (o && typeof o === "object") Object.keys(o).forEach((k) => walk(o[k], path ? `${path}.${k}` : k, fn));
    else fn(path, o);
  }

  // Publishing uses Git's blob/tree/commit API: each file is sent once as a blob (with retries),
  // then everything — files + content.json — lands in ONE commit. Far more reliable for big files.
  const blobsDone = new Map(); // pending id -> { dest, sha }  (survives a failed publish, so retries skip finished uploads)
  async function blob(contentB64, label) {
    let last;
    for (let attempt = 1; attempt <= 3; attempt++) {
      try { return (await gh("/git/blobs", { method: "POST", body: JSON.stringify({ content: contentB64, encoding: "base64" }) })).sha; }
      catch (e) { last = e; if (e.status && e.status < 500 && e.status !== 408 && e.status !== 429) break; log(`${label}: retrying (${attempt})…`); await new Promise((r) => setTimeout(r, 1500 * attempt)); }
    }
    throw last;
  }
  $("#publish").onclick = async () => {
    const btn = $("#publish"); btn.disabled = true;
    $("#log-box").hidden = false; $("#log").innerHTML = "";
    try {
      const ups = []; walk(data, "", (p, v) => typeof v === "string" && v.startsWith("pending:") && ups.push([p, v.slice(8)]));
      const stamp = new Date().toISOString().replace(/[-:T]/g, "").slice(0, 14);
      const tree = [];
      for (const [p, id] of ups) {
        const f = pending.get(id); if (!f) { set(p, ""); continue; }
        if (!blobsDone.has(id)) {
          const li = log(`Uploading ${f.name} (${(f.size / 1048576).toFixed(1)} MB)…`);
          const sha = await blob(await fileB64(f), f.name);
          blobsDone.set(id, { dest: `media/${stamp}-${slug(f.name)}.${ext(f.name)}`, sha });
          li.textContent = `Uploaded ${f.name}`; li.className = "ok";
        }
        const { dest, sha } = blobsDone.get(id);
        tree.push({ path: dest, mode: "100644", type: "blob", sha });
      }
      // swap pending tokens for real paths in a copy, so a failure leaves the editor untouched
      const out = JSON.parse(JSON.stringify(data));
      walk(out, "", (p, v) => {
        if (typeof v === "string" && v.startsWith("pending:")) {
          const done = blobsDone.get(v.slice(8)), ks = p.split("."), last = ks.pop();
          ks.reduce((o, k) => o[k], out)[last] = done ? done.dest : "";
        }
      });
      out.songs.forEach((x) => (x.youtube = ytId(x.youtube)));
      out.videos.forEach((x) => (x.youtube = ytId(x.youtube)));
      const li = log("Saving…");
      tree.push({ path: "content.json", mode: "100644", type: "blob", sha: await blob(b64utf8(JSON.stringify(out, null, 2) + "\n"), "content.json") });
      const ref = await gh(`/git/ref/heads/${encodeURIComponent(cfg.branch)}`);
      const head = await gh(`/git/commits/${ref.object.sha}`);
      const t = await gh("/git/trees", { method: "POST", body: JSON.stringify({ base_tree: head.tree.sha, tree }) });
      const c = await gh("/git/commits", { method: "POST", body: JSON.stringify({ message: "Update site content", tree: t.sha, parents: [ref.object.sha] }) });
      await gh(`/git/refs/heads/${encodeURIComponent(cfg.branch)}`, { method: "PATCH", body: JSON.stringify({ sha: c.sha }) });
      // success: commit the real paths into the editor
      for (const [p, id] of ups) { const d = blobsDone.get(id); if (d) { set(p, d.dest); pending.delete(id); blobsDone.delete(id); } }
      data.songs.forEach((x) => (x.youtube = ytId(x.youtube))); data.videos.forEach((x) => (x.youtube = ytId(x.youtube)));
      li.textContent = "Saved"; li.className = "ok";
      log(`Published — live now. Refresh the site to see it: ${siteUrl}`, "done");
      dirty = false; render(); btn.disabled = true;
    } catch (e) {
      log("Failed: " + e.message + " — press Publish again; finished uploads won't be repeated.", "err");
      btn.disabled = false;
    }
  };

  /* ---------- Clean up ---------- */
  $("#cleanup").onclick = async () => {
    if (dirty) return alert("Publish your changes first.");
    let files;
    try { files = await gh(`/contents/media?ref=${encodeURIComponent(cfg.branch)}`); } catch (e) { return alert(e.status === 404 ? "No uploaded files yet." : e.message); }
    const used = new Set(); walk(data, "", (_, v) => typeof v === "string" && v.startsWith("media/") && used.add(v));
    const unused = files.filter((f) => f.type === "file" && !used.has(f.path));
    if (!unused.length) return alert("Nothing to clean up.");
    if (!confirm(`Delete ${unused.length} unused file(s)?\n\n${unused.map((f) => f.name).join("\n")}`)) return;
    $("#log-box").hidden = false; $("#log").innerHTML = "";
    for (const f of unused) {
      const li = log("Deleting " + f.name + "…");
      try { await gh(`/contents/${enc(f.path)}`, { method: "DELETE", body: JSON.stringify({ message: "Remove unused " + f.name, sha: f.sha, branch: cfg.branch }) }); li.className = "ok"; li.textContent = "Deleted " + f.name; }
      catch (e) { li.className = "err"; li.textContent = `Couldn't delete ${f.name}: ${e.message}`; }
    }
    log("Clean-up finished.", "done");
  };
  /* ---------- Cover maker ---------- */
  const PRESETS = { gothic: ["#1a1a1c", "#e9e4d8"], spotlight: ["#1f5a3c", "#e6d27a"], glow: ["#1d3b2a", "#d4552b"], studio: ["#b0121b", "#e08ad8"] };
  const logoImg = new Image(); logoImg.src = "assets/ds-mark.png";
  const cm = { path: "", style: "gothic", subject: "chair", seed: 7 };
  const cmCanvas = $("#cm-canvas");
  async function drawMaker(canvas = cmCanvas) {
    if (!logoImg.complete) await logoImg.decode().catch(() => {});
    await DSCover.render(canvas, {
      style: cm.style, title: $("#cm-title").value, line: $("#cm-line").value,
      color: $("#cm-color").value, accent: $("#cm-accent").value,
      subject: cm.subject === "logo" ? logoImg : cm.subject, subjectIsLogo: cm.subject === "logo", seed: cm.seed
    });
  }
  function openMaker(path) {
    cm.path = path;
    const base = path.replace(/\.cover$/, ""), item = get(base) || {};
    $("#cm-title").value = item.title || "";
    $("#cm-line").value = path.startsWith("albums.") ? (item.type || "Album") : "";
    if (item.color) $("#cm-color").value = item.color;
    if (item.accent) $("#cm-accent").value = item.accent;
    $("#cm").hidden = false; drawMaker();
  }
  $("#cm-close").onclick = () => ($("#cm").hidden = true);
  $("#cm-styles").onclick = (e) => {
    const b = e.target.closest("button"); if (!b) return;
    cm.style = b.dataset.style; $$("#cm-styles button").forEach((x) => x.classList.toggle("on", x === b));
    [$("#cm-color").value, $("#cm-accent").value] = PRESETS[cm.style]; drawMaker();
  };
  ["cm-title", "cm-line", "cm-color", "cm-accent"].forEach((id) => ($("#" + id).oninput = () => drawMaker()));
  $("#cm-seed").onclick = () => { cm.seed = (Math.random() * 1e9) | 0; drawMaker(); };
  $("#cm-logo").onclick = () => { cm.subject = "logo"; drawMaker(); };
  $("#cm-chair").onclick = () => { cm.subject = "chair"; drawMaker(); };
  $("#cm-none").onclick = () => { cm.subject = null; drawMaker(); };
  $("#cm-subject").onchange = (e) => {
    const f = e.target.files[0]; if (!f) return;
    const img = new Image(); img.onload = () => { cm.subject = img; drawMaker(); }; img.src = URL.createObjectURL(f);
  };
  $("#cm-use").onclick = async () => {
    const big = document.createElement("canvas"); big.width = big.height = 1500;
    await drawMaker(big);
    const blob = await new Promise((ok) => big.toBlob(ok, "image/jpeg", 0.9));
    const name = slug($("#cm-title").value || "cover") + "-cover.jpg";
    const file = new File([blob], name, { type: "image/jpeg" });
    const nid = Math.random().toString(36).slice(2, 10);
    pending.set(nid, file); previews.set(nid, URL.createObjectURL(file));
    set(cm.path, "pending:" + nid);
    const base = cm.path.replace(/\.cover$/, "");
    set(base + ".color", $("#cm-color").value); set(base + ".accent", $("#cm-accent").value);
    $("#cm").hidden = true; render();
  };
})();
