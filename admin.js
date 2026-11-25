/* Dawn Sogni — Admin. Edits content.json and uploads media straight to the GitHub repo
   via the GitHub REST API. No server: the token lives only in this browser. */
(() => {
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const esc = (v) => String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const uid = (s = "") => (s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 30) || "item") + "-" + Math.random().toString(36).slice(2, 6);

  const EMPTY = () => ({
    brand: { instagram: "", spotify: "", appleMusic: "", youtube: "", shopUrl: "https://jayseth34.github.io/DawnSogniWeb/" },
    featured: "", albums: [], songs: [], videos: [], events: []
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
  const get = (path) => path.split(".").reduce((o, k) => (o == null ? o : o[k]), data);
  const set = (path, val) => { const ks = path.split("."), last = ks.pop(); const o = ks.reduce((o, k) => (o[k] ??= {}), data); o[last] = val; markDirty(); };
  const markDirty = () => { dirty = true; $("#publish").disabled = false; };
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
        data = Object.assign(EMPTY(), raw); data.brand = Object.assign(EMPTY().brand, raw.brand || {});
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
        { k: "audio", label: "Audio (MP3 / M4A)", type: "upload", accept: "audio/*" },
        { k: "cover", label: "Cover art (square). Songs in an album use the album cover if left empty.", type: "upload", accept: "image/*" },
        { row: [{ k: "color", label: "Theme colour (site colour for this release)", type: "color" }, { k: "accent", label: "Light colour", type: "color" }] },
        { k: "description", label: "Description (optional)", type: "textarea", rows: 2 },
        { k: "lyrics", label: "Lyrics (optional)", type: "textarea", rows: 6 },
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
    $("input[type=file]", row).onchange = (e) => {
      const f = e.target.files[0]; if (!f) return;
      if (f.size > 45 * 1024 * 1024) return alert("That file is over 45 MB — GitHub won't accept it from the browser. Please compress it first.");
      const nid = Math.random().toString(36).slice(2, 10);
      pending.set(nid, f); previews.set(nid, URL.createObjectURL(f));
      set(p, "pending:" + nid);
      const m = p.match(/^songs\.(\d+)\.audio$/);
      if (m && !data.songs[+m[1]].title) { data.songs[+m[1]].title = f.name.replace(/\.[^.]+$/, "").replace(/[_-]+/g, " "); renderList("songs"); }
      else renderUpload(row);
    };
    const clr = $("[data-clear]", row); if (clr) clr.onclick = () => { set(p, ""); renderUpload(row); };
    const des = $("[data-design]", row); if (des) des.onclick = () => openMaker(p);
  }

  function renderFeatured() {
    const sel = $("#featured");
    const opts = [["", "Automatic — newest release"], ...data.albums.map((a) => ["a:" + a.id, `${a.type || "Album"}: ${a.title || "Untitled"}`]),
      ...data.songs.filter((s) => !s.album || !data.albums.some((a) => a.id === s.album)).map((s) => ["s:" + s.id, `Single: ${s.title || "Untitled"}`])];
    sel.innerHTML = opts.map(([v, t]) => `<option value="${esc(v)}">${esc(t)}</option>`).join("");
    sel.value = opts.some((o) => o[0] === data.featured) ? data.featured : "";
    sel.onchange = () => set("featured", sel.value);
  }

  function render() {
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

  $("#publish").onclick = async () => {
    const btn = $("#publish"); btn.disabled = true;
    $("#log-box").hidden = false; $("#log").innerHTML = "";
    try {
      const ups = []; walk(data, "", (p, v) => typeof v === "string" && v.startsWith("pending:") && ups.push([p, v.slice(8)]));
      const stamp = new Date().toISOString().replace(/[-:T]/g, "").slice(0, 14);
      for (const [p, id] of ups) {
        const f = pending.get(id); if (!f) { set(p, ""); continue; }
        const dest = `media/${stamp}-${slug(f.name)}.${ext(f.name)}`;
        const li = log(`Uploading ${f.name} (${(f.size / 1048576).toFixed(1)} MB)…`);
        await putFile(dest, await fileB64(f), `Upload ${f.name}`);
        set(p, dest); pending.delete(id); li.textContent = `Uploaded ${f.name}`; li.className = "ok";
      }
      data.songs.forEach((s) => (s.youtube = ytId(s.youtube)));
      data.videos.forEach((v) => (v.youtube = ytId(v.youtube)));
      const li = log("Saving site content…");
      await putFile("content.json", b64utf8(JSON.stringify(data, null, 2) + "\n"), "Update site content", await getSha("content.json"));
      li.textContent = "Content saved"; li.className = "ok";
      log(`Published — the live site updates in about a minute: ${siteUrl}`, "done");
      dirty = false; render();
    } catch (e) {
      log("Failed: " + e.message + (e.status === 409 ? " (content changed at the same time — press Publish again)" : ""), "err");
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
