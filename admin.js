/* DAWN SOGNI — Admin. Edits content.json and uploads media straight to the GitHub repo
   via the GitHub REST API. No server: the token lives only in this browser. */
(() => {
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const esc = (v) => String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  const EMPTY = () => ({
    brand: { email: "", instagram: "", spotify: "", appleMusic: "", youtube: "" },
    album: { title: "", description: "", releaseDate: "", cover: "", tracks: [] },
    videos: [], products: [], drops: [], customOrders: true, currency: "₹"
  });

  /* ---------- Config ---------- */
  const cfgKeys = ["owner", "repo", "branch", "token"];
  const cfg = {};
  cfgKeys.forEach((k) => {
    const saved = localStorage.getItem("dsadmin_" + k);
    if (saved) $("#cfg-" + k).value = saved;
  });
  const readCfg = () => cfgKeys.forEach((k) => { cfg[k] = $("#cfg-" + k).value.trim(); localStorage.setItem("dsadmin_" + k, cfg[k]); });

  /* ---------- GitHub API ---------- */
  async function gh(path, opts = {}) {
    const res = await fetch(`https://api.github.com/repos/${cfg.owner}/${cfg.repo}${path}`, {
      ...opts,
      headers: { Authorization: `Bearer ${cfg.token}`, Accept: "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28", ...(opts.headers || {}) }
    });
    const body = res.status === 204 ? null : await res.json().catch(() => null);
    if (!res.ok) { const e = new Error(body?.message || res.statusText); e.status = res.status; throw e; }
    return body;
  }
  const enc = (p) => p.split("/").map(encodeURIComponent).join("/");
  const b64utf8 = (str) => {
    const bytes = new TextEncoder().encode(str); let bin = "";
    for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
    return btoa(bin);
  };
  const unb64utf8 = (b) => new TextDecoder().decode(Uint8Array.from(atob(b.replace(/\s/g, "")), (c) => c.charCodeAt(0)));
  const fileB64 = (file) => new Promise((ok, no) => { const r = new FileReader(); r.onload = () => ok(String(r.result).split(",")[1]); r.onerror = no; r.readAsDataURL(file); });
  async function putFile(path, contentB64, message, sha) {
    return gh(`/contents/${enc(path)}`, { method: "PUT", body: JSON.stringify({ message, content: contentB64, branch: cfg.branch, ...(sha ? { sha } : {}) }) });
  }
  async function getSha(path) {
    try { return (await gh(`/contents/${enc(path)}?ref=${encodeURIComponent(cfg.branch)}`)).sha; } catch (e) { if (e.status === 404) return null; throw e; }
  }

  /* ---------- State ---------- */
  let data = EMPTY(), dirty = false, siteUrl = "./";
  const pending = new Map(); // id -> File
  const previews = new Map(); // id -> objectURL
  const get = (path) => path.split(".").reduce((o, k) => (o == null ? o : o[k]), data);
  const set = (path, val) => {
    const ks = path.split("."), last = ks.pop();
    const o = ks.reduce((o, k) => (o[k] ??= /^\d+$/.test(k) ? [] : {}), data);
    o[last] = val; markDirty();
  };
  const markDirty = () => { dirty = true; $("#publish").disabled = false; };
  addEventListener("beforeunload", (e) => { if (dirty) { e.preventDefault(); e.returnValue = ""; } });

  /* ---------- Connect ---------- */
  const status = (msg, cls = "") => { const s = $("#connect-status"); s.textContent = msg; s.className = "status " + cls; };
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
        const file = await gh(`/contents/content.json?ref=${encodeURIComponent(cfg.branch)}`);
        data = Object.assign(EMPTY(), JSON.parse(unb64utf8(file.content)));
        data.brand = Object.assign(EMPTY().brand, data.brand); data.album = Object.assign(EMPTY().album, data.album);
      } catch (e) { if (e.status !== 404) throw e; data = EMPTY(); }
      dirty = false; $("#publish").disabled = true;
      $("#editor").hidden = false;
      status(`Connected to ${cfg.owner}/${cfg.repo} · publishing to "${cfg.branch}"`, "ok");
      render();
    } catch (e) {
      status(e.status === 401 ? "Token rejected — check it and try again." : e.status === 404 ? "Repo or branch not found (or token has no access)." : "Error: " + e.message, "err");
    }
  };
  $("#forget").onclick = () => { localStorage.removeItem("dsadmin_token"); $("#cfg-token").value = ""; status("Token removed from this browser."); };
  if (localStorage.getItem("dsadmin_token")) $("#connect").click();

  /* ---------- Tabs ---------- */
  $("#tabs").onclick = (e) => {
    const b = e.target.closest("button"); if (!b) return;
    $$("#tabs button").forEach((x) => x.classList.toggle("on", x === b));
    $$(".tab").forEach((t) => (t.hidden = t.dataset.tab !== b.dataset.tab));
  };

  /* ---------- Lists ---------- */
  const LISTS = {
    tracks: {
      path: "album.tracks", name: "SONG", blank: () => ({ title: "", description: "", file: "" }),
      fields: [
        { k: "title", label: "SONG TITLE", type: "text" },
        { k: "description", label: "DESCRIPTION / LYRICS NOTE (OPTIONAL)", type: "textarea" },
        { k: "file", label: "AUDIO FILE (MP3 / M4A)", type: "upload", accept: "audio/*" }
      ]
    },
    videos: {
      path: "videos", name: "VIDEO", blank: () => ({ title: "", label: "VIDEO", description: "", youtube: "", file: "", poster: "" }),
      fields: [
        { k: "title", label: "TITLE", type: "text" },
        { k: "label", label: "LABEL (VIDEO, FILM, VISUALIZER…)", type: "text" },
        { k: "youtube", label: "YOUTUBE LINK (OR UPLOAD BELOW)", type: "text", placeholder: "https://youtu.be/…" },
        { k: "description", label: "DESCRIPTION (OPTIONAL)", type: "textarea" },
        { k: "file", label: "MP4 FILE (OPTIONAL)", type: "upload", accept: "video/mp4,video/*" },
        { k: "poster", label: "COVER IMAGE (OPTIONAL)", type: "upload", accept: "image/*" }
      ]
    },
    products: {
      path: "products", name: "PRODUCT", blank: () => ({ name: "", price: "", sizes: ["S", "M", "L", "XL"], image: "" }),
      fields: [
        { k: "name", label: "NAME", type: "text" },
        { k: "price", label: "PRICE", type: "number" },
        { k: "sizes", label: "SIZES (COMMA SEPARATED, EMPTY FOR NONE)", type: "sizes" },
        { k: "image", label: "PRODUCT PHOTO", type: "upload", accept: "image/*" }
      ]
    },
    drops: {
      path: "drops", name: "EVENT", blank: () => ({ date: "", title: "", place: "", link: "", cta: "" }),
      fields: [
        { k: "date", label: "DATE", type: "date" },
        { k: "title", label: "TITLE", type: "text" },
        { k: "place", label: "PLACE", type: "text" },
        { k: "link", label: "LINK (TICKETS / RSVP — OPTIONAL)", type: "text" },
        { k: "cta", label: "BUTTON TEXT (OPTIONAL)", type: "text", placeholder: "TICKETS" }
      ]
    }
  };

  function fieldHTML(f, base) {
    const p = `${base}.${f.k}`, v = get(p);
    if (f.type === "upload") return `<div class="upload-row" data-upload="${p}" data-accept="${f.accept}" data-label="${f.label}"></div>`;
    if (f.type === "textarea") return `<label>${f.label}<textarea rows="3" data-bind="${p}">${esc(v)}</textarea></label>`;
    if (f.type === "sizes") return `<label>${f.label}<input data-bind="${p}" data-type="sizes" value="${esc((v || []).join(", "))}" /></label>`;
    return `<label>${f.label}<input type="${f.type}" data-bind="${p}" value="${esc(v)}" placeholder="${esc(f.placeholder || "")}" /></label>`;
  }
  function renderList(key) {
    const L = LISTS[key], arr = get(L.path) || [], box = $("#list-" + key);
    box.innerHTML = arr.length ? arr.map((_, i) => `
      <div class="item">
        <div class="item-head"><span class="num">${L.name} ${String(i + 1).padStart(2, "0")}</span>
          <button data-move="${key}:${i}:-1" title="Move up">↑</button><button data-move="${key}:${i}:1" title="Move down">↓</button>
          <button data-del="${key}:${i}" title="Remove">✕</button></div>
        ${L.fields.map((f) => fieldHTML(f, `${L.path}.${i}`)).join("")}
      </div>`).join("") : `<p class="empty">Nothing yet — add your first ${L.name.toLowerCase()}.</p>`;
    $$(".upload-row", box).forEach(renderUpload);
    bindInputs(box);
  }
  document.addEventListener("click", (e) => {
    const add = e.target.closest("[data-add]"), mv = e.target.closest("[data-move]"), del = e.target.closest("[data-del]");
    if (add) { const L = LISTS[add.dataset.add]; const arr = get(L.path) || []; arr.push(L.blank()); set(L.path, arr); renderList(add.dataset.add); }
    if (mv) {
      const [k, i, d] = mv.dataset.move.split(":"), arr = get(LISTS[k].path), a = +i, b = a + +d;
      if (b < 0 || b >= arr.length) return;
      [arr[a], arr[b]] = [arr[b], arr[a]]; markDirty(); renderList(k);
    }
    if (del) {
      const [k, i] = del.dataset.del.split(":");
      if (!confirm("Remove this " + LISTS[k].name.toLowerCase() + "?")) return;
      get(LISTS[k].path).splice(+i, 1); markDirty(); renderList(k);
    }
  });

  /* ---------- Inputs ---------- */
  function bindInputs(root) {
    $$("[data-bind]", root).forEach((el) => {
      const p = el.dataset.bind, v = get(p);
      if (el.type === "checkbox") el.checked = v !== false;
      else if (el.dataset.type === "sizes") el.value = (v || []).join(", ");
      else el.value = v ?? "";
      el.oninput = el.onchange = () => {
        if (el.type === "checkbox") set(p, el.checked);
        else if (el.dataset.type === "sizes") set(p, el.value.split(",").map((s) => s.trim()).filter(Boolean));
        else if (el.type === "number") set(p, el.value === "" ? "" : Number(el.value));
        else set(p, el.value);
      };
    });
  }

  /* ---------- Uploads ---------- */
  function renderUpload(row) {
    const p = row.dataset.upload, v = get(p) || "", isPending = v.startsWith("pending:");
    const accept = row.dataset.accept, id = isPending ? v.slice(8) : null;
    const src = isPending ? previews.get(id) : v;
    let preview = "";
    if (src && accept.startsWith("image")) preview = `<img class="thumb" src="${esc(src)}" alt="" />`;
    if (src && accept.startsWith("audio")) preview = `<audio controls preload="none" src="${esc(src)}"></audio>`;
    const name = isPending ? `${pending.get(id)?.name} — will upload on publish` : v ? v : "No file";
    row.innerHTML = `<label>${row.dataset.label}</label>
      <div class="upload">${preview}
        <span class="ghost small pick">${v ? "REPLACE" : "CHOOSE FILE"}<input type="file" accept="${accept}" /></span>
        ${v ? `<button class="ghost small danger" data-clear>REMOVE</button>` : ""}
        <span class="file-name ${isPending ? "pending" : ""}">${esc(name)}</span></div>`;
    $("input[type=file]", row).onchange = (e) => {
      const f = e.target.files[0]; if (!f) return;
      if (f.size > 45 * 1024 * 1024) { alert("That file is over 45 MB — GitHub won't accept it through the browser. Please compress it first."); return; }
      const nid = Math.random().toString(36).slice(2, 10);
      pending.set(nid, f); previews.set(nid, URL.createObjectURL(f));
      set(p, "pending:" + nid); renderUpload(row);
      // fill an empty song title from the file name
      if (p.startsWith("album.tracks.") && p.endsWith(".file")) {
        const tp = p.replace(/\.file$/, ".title");
        if (!get(tp)) { set(tp, f.name.replace(/\.[^.]+$/, "").replace(/[_-]+/g, " ").toUpperCase()); renderList("tracks"); }
      }
    };
    const clr = $("[data-clear]", row);
    if (clr) clr.onclick = () => { set(p, ""); renderUpload(row); };
  }

  function render() {
    bindInputs($("#editor"));
    $$(".tab > .box > .upload-row, .box > .upload-row").forEach(renderUpload);
    Object.keys(LISTS).forEach(renderList);
  }

  /* ---------- Publish ---------- */
  const log = (msg, cls = "") => { const li = document.createElement("li"); li.textContent = msg; li.className = cls; $("#log").append(li); li.scrollIntoView({ block: "nearest" }); return li; };
  const slug = (s) => s.toLowerCase().replace(/\.[^.]+$/, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40) || "file";
  const ext = (s) => (s.match(/\.([a-z0-9]+)$/i) || [, "bin"])[1].toLowerCase();
  const ytId = (v) => { v = (v || "").trim(); const m = v.match(/(?:v=|youtu\.be\/|shorts\/|embed\/|live\/)([\w-]{11})/); return m ? m[1] : /^[\w-]{11}$/.test(v) ? v : v; };
  function walk(o, path, fn) {
    if (Array.isArray(o)) o.forEach((x, i) => walk(x, `${path}.${i}`, fn));
    else if (o && typeof o === "object") Object.keys(o).forEach((k) => walk(o[k], path ? `${path}.${k}` : k, fn));
    else fn(path, o);
  }

  $("#publish").onclick = async () => {
    const btn = $("#publish"); btn.disabled = true;
    $("#log-box").hidden = false; $("#log").innerHTML = "";
    try {
      const uploads = [];
      walk(data, "", (p, v) => { if (typeof v === "string" && v.startsWith("pending:")) uploads.push([p, v.slice(8)]); });
      const stamp = new Date().toISOString().replace(/[-:T]/g, "").slice(0, 14);
      for (const [p, id] of uploads) {
        const f = pending.get(id); if (!f) { set(p, ""); continue; }
        const dest = `media/${stamp}-${slug(f.name)}.${ext(f.name)}`;
        const li = log(`Uploading ${f.name} (${(f.size / 1048576).toFixed(1)} MB)…`);
        await putFile(dest, await fileB64(f), `Upload ${f.name}`);
        set(p, dest); pending.delete(id); li.textContent = `Uploaded ${f.name}`; li.className = "ok";
      }
      (data.videos || []).forEach((v) => (v.youtube = ytId(v.youtube)));
      (data.products || []).forEach((x) => (x.price = Number(x.price) || 0));
      const li = log("Saving site content…");
      const sha = await getSha("content.json");
      await putFile("content.json", b64utf8(JSON.stringify(data, null, 2) + "\n"), "Update site content", sha);
      li.textContent = "Content saved"; li.className = "ok";
      log(`Published. The live site updates in about a minute: ${siteUrl}`, "done");
      dirty = false; render();
    } catch (e) {
      log("Failed: " + e.message + (e.status === 409 ? " (someone else published at the same time — try again)" : ""), "err");
      btn.disabled = false;
    }
  };

  /* ---------- Cleanup ---------- */
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
})();
