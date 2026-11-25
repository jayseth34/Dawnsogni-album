/* Dawn Sogni — Admin: add songs (title, audio, cover, lyrics) and publish to the GitHub repo. */
(() => {
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const esc = (v) => String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const OWNER = "jayseth34", REPO = "dawnsogni-album", BRANCH = "gh-pages";
  const MAXB = 45 * 1024 * 1024;
  let token = localStorage.getItem("dsadmin_token") || "";
  let data = { songs: [] }, dirty = false;
  const pending = new Map(), previews = new Map(), busy = new Set(), blobsDone = new Map();

  /* ---------- GitHub ---------- */
  async function gh(path, opts = {}) {
    const res = await fetch(`https://api.github.com/repos/${OWNER}/${REPO}${path}`, { ...opts, headers: { Authorization: `Bearer ${token}`, Accept: "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28" } });
    const body = res.status === 204 ? null : await res.json().catch(() => null);
    if (!res.ok) { const e = new Error(body?.message || res.statusText); e.status = res.status; throw e; }
    return body;
  }
  const b64utf8 = (str) => { const b = new TextEncoder().encode(str); let s = ""; for (let i = 0; i < b.length; i += 0x8000) s += String.fromCharCode.apply(null, b.subarray(i, i + 0x8000)); return btoa(s); };
  const unb64 = (b) => new TextDecoder().decode(Uint8Array.from(atob(b.replace(/\s/g, "")), (c) => c.charCodeAt(0)));
  const fileB64 = (f) => new Promise((ok, no) => { const r = new FileReader(); r.onload = () => ok(String(r.result).split(",")[1]); r.onerror = no; r.readAsDataURL(f); });
  async function blob(content, label) {
    let last;
    for (let a = 1; a <= 3; a++) {
      try { return (await gh("/git/blobs", { method: "POST", body: JSON.stringify({ content, encoding: "base64" }) })).sha; }
      catch (e) { last = e; if (e.status && e.status < 500 && e.status !== 408 && e.status !== 429) break; log(`${label}: retrying…`); await new Promise((r) => setTimeout(r, 1500 * a)); }
    }
    throw last;
  }

  /* ---------- Connect ---------- */
  const status = (m, c = "") => { const s = $("#connect-status"); s.textContent = m; s.className = "status " + c; };
  async function connect() {
    token = $("#cfg-token").value.trim() || token;
    if (!token) return status("Paste your token first.", "err");
    status("Connecting…");
    try {
      const repo = await gh("");
      if (repo.permissions && !repo.permissions.push) return status("This token can't write to the repo.", "err");
      localStorage.setItem("dsadmin_token", token);
      try {
        const f = await gh(`/contents/content.json?ref=${BRANCH}`);
        const raw = JSON.parse(unb64(f.content));
        data = { ...raw, songs: (raw.songs || []).map((s) => ({ id: s.id, title: s.title || "", audio: s.audio || "", cover: s.cover || "", lyrics: s.lyrics || "", date: s.date || s.releaseDate || "" })) };
      } catch (e) { if (e.status !== 404) throw e; }
      $("#editor").hidden = false; $("#connect-box").classList.add("done");
      status("Connected ✓", "ok"); dirty = false; render();
    } catch (e) { status(e.status === 401 ? "Token rejected — check it and try again." : "Error: " + e.message, "err"); }
  }
  $("#connect").onclick = connect;
  $("#forget").onclick = () => { localStorage.removeItem("dsadmin_token"); token = ""; $("#cfg-token").value = ""; status("Token removed."); };
  if (token) connect();

  /* ---------- Editor ---------- */
  const markDirty = () => { dirty = true; updatePublish(); };
  const updatePublish = () => { const b = $("#publish"); b.disabled = !dirty || busy.size > 0; b.textContent = busy.size ? "Processing…" : "Publish"; };
  addEventListener("beforeunload", (e) => { if (dirty) { e.preventDefault(); e.returnValue = ""; } });
  const srcOf = (v) => (String(v).startsWith("pending:") ? previews.get(v.slice(8)) : v);

  function render() {
    $("#list").innerHTML = data.songs.length ? data.songs.map((s, i) => `
      <div class="item" data-i="${i}">
        <div class="item-head">
          <span class="num">${esc(s.title || "New song")}</span>
          <button data-move="${i}:-1" title="Move up">↑</button><button data-move="${i}:1" title="Move down">↓</button><button data-del="${i}" title="Delete">✕</button>
        </div>
        <label>Title<input data-k="title" value="${esc(s.title)}" placeholder="Song title" /></label>
        ${slot(i, "audio", "Audio (MP3, M4A, WAV — or a video, its audio is used)", "audio/*,video/*")}
        ${slot(i, "cover", "Cover picture", "image/*")}
        <label>Lyrics<textarea data-k="lyrics" rows="10" placeholder="Paste the lyrics, one line per line…">${esc(s.lyrics)}</textarea></label>
      </div>`).join("") : `<p class="empty">No songs yet — press “+ Add song”.</p>`;
    $$(".item").forEach((el) => {
      const i = +el.dataset.i;
      $$("[data-k]", el).forEach((inp) => (inp.oninput = () => { data.songs[i][inp.dataset.k] = inp.value; markDirty(); if (inp.dataset.k === "title") $(".num", el).textContent = inp.value || "New song"; }));
      $$("input[type=file]", el).forEach((inp) => (inp.onchange = () => inp.files[0] && handleFile(i, inp.dataset.slot, inp.files[0])));
      $$("[data-clear]", el).forEach((b) => (b.onclick = () => { data.songs[i][b.dataset.clear] = ""; markDirty(); render(); }));
    });
    updatePublish();
  }
  function slot(i, k, label, accept) {
    const v = data.songs[i][k] || "", key = `${i}.${k}`, src = v && srcOf(v), isPending = String(v).startsWith("pending:");
    const preview = !src ? "" : k === "cover" ? `<img class="thumb" src="${esc(src)}" alt="" />` : `<audio controls preload="none" src="${esc(src)}"></audio>`;
    const note = busy.has(key) ? `<span class="file-name pending" data-busy="${key}">${esc(busyText.get(key) || "Processing…")}</span>`
      : isPending ? `<span class="file-name pending">${esc(pending.get(v.slice(8))?.name)} — uploads when you publish</span>` : v ? "" : `<span class="file-name">No file</span>`;
    return `<div class="upload-row"><label>${label}</label><div class="upload">${preview}
      ${busy.has(key) ? "" : `<span class="ghost small pick">${v ? "Replace" : "Choose file"}<input type="file" accept="${accept}" data-slot="${k}" /></span>`}
      ${v && !busy.has(key) ? `<button class="ghost small danger" data-clear="${k}">Remove</button>` : ""}${note}</div></div>`;
  }
  $("#add").onclick = () => { data.songs.unshift({ id: "song-" + Math.random().toString(36).slice(2, 8), title: "", audio: "", cover: "", lyrics: "", date: new Date().toISOString().slice(0, 10) }); markDirty(); render(); };
  $("#list").addEventListener("click", (e) => {
    const mv = e.target.closest("[data-move]"), del = e.target.closest("[data-del]");
    if (mv) { const [i, d] = mv.dataset.move.split(":").map(Number), j = i + d; if (j < 0 || j >= data.songs.length) return; [data.songs[i], data.songs[j]] = [data.songs[j], data.songs[i]]; markDirty(); render(); }
    if (del && confirm("Delete this song?")) { data.songs.splice(+del.dataset.del, 1); markDirty(); render(); }
  });

  /* ---------- Automatic file processing ---------- */
  const busyText = new Map();
  async function handleFile(i, k, f) {
    const key = `${i}.${k}`, song = data.songs[i];
    const set = (t) => {
      const first = !busy.has(key); busy.add(key); busyText.set(key, t);
      const el = document.querySelector(`[data-busy="${key}"]`);
      if (first || !el) render(); else el.textContent = t;
    };
    try {
      let out;
      if (k === "cover") { set("Optimising picture…"); out = await DSMedia.image(f); }
      else if (DSMedia.isVideo(f)) { set("Extracting audio…"); out = await DSMedia.extractAudio(f, (p) => set(`Extracting audio… ${Math.round(p * 100)}%`)); }
      else { set("Optimising audio…"); out = await DSMedia.audio(f, (p, l) => set(`${l || "Compressing audio"}… ${Math.round(p * 100)}%`)); }
      if (out.size > MAXB) throw new Error(`This file is still ${(out.size / 1048576).toFixed(0)} MB — the limit is 45 MB.`);
      const id = Math.random().toString(36).slice(2, 10);
      pending.set(id, out); previews.set(id, URL.createObjectURL(out));
      song[k] = "pending:" + id;
      if (k === "audio" && !song.title) song.title = f.name.replace(/\.[^.]+$/, "").replace(/[_-]+/g, " ");
      markDirty();
    } catch (err) { alert(err.message || String(err)); }
    finally { busy.delete(key); busyText.delete(key); render(); }
  }

  /* ---------- Publish: all files + content.json in one commit ---------- */
  const log = (m, c = "") => { const li = document.createElement("li"); li.textContent = m; li.className = c; $("#log").append(li); return li; };
  const slug = (s) => s.toLowerCase().replace(/\.[^.]+$/, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40) || "file";
  const ext = (s) => (s.match(/\.([a-z0-9]+)$/i) || [, "bin"])[1].toLowerCase();
  $("#publish").onclick = async () => {
    const btn = $("#publish"); btn.disabled = true;
    $("#log-box").hidden = false; $("#log").innerHTML = "";
    const missing = data.songs.filter((s) => !s.title.trim() || !s.audio);
    if (missing.length) { log(`${missing.length} song(s) need a title and audio before publishing.`, "err"); btn.disabled = false; return; }
    try {
      const stamp = new Date().toISOString().replace(/[-:T]/g, "").slice(0, 14), tree = [];
      for (const s of data.songs) for (const k of ["audio", "cover"]) {
        const v = s[k]; if (!String(v).startsWith("pending:")) continue;
        const id = v.slice(8), f = pending.get(id);
        if (!blobsDone.has(id)) {
          const li = log(`Uploading ${f.name} (${(f.size / 1048576).toFixed(1)} MB)…`);
          blobsDone.set(id, { path: `media/${stamp}-${slug(f.name)}.${ext(f.name)}`, sha: await blob(await fileB64(f), f.name) });
          li.textContent = `Uploaded ${f.name}`; li.className = "ok";
        }
        tree.push({ path: blobsDone.get(id).path, mode: "100644", type: "blob", sha: blobsDone.get(id).sha });
      }
      const out = { ...data, songs: data.songs.map((s) => ({ ...s, audio: resolve(s.audio), cover: resolve(s.cover) })) };
      const li = log("Saving…");
      tree.push({ path: "content.json", mode: "100644", type: "blob", sha: await blob(b64utf8(JSON.stringify(out, null, 2) + "\n"), "content.json") });
      const ref = await gh(`/git/ref/heads/${BRANCH}`), head = await gh(`/git/commits/${ref.object.sha}`);
      const t = await gh("/git/trees", { method: "POST", body: JSON.stringify({ base_tree: head.tree.sha, tree }) });
      const c = await gh("/git/commits", { method: "POST", body: JSON.stringify({ message: "Update songs", tree: t.sha, parents: [ref.object.sha] }) });
      await gh(`/git/refs/heads/${BRANCH}`, { method: "PATCH", body: JSON.stringify({ sha: c.sha }) });
      data = out; pending.clear(); blobsDone.clear(); dirty = false;
      li.textContent = "Saved"; li.className = "ok";
      log("Published — live now. Refresh the site to see it.", "done");
      render();
    } catch (e) { log("Failed: " + e.message + " — press Publish again; finished uploads won't repeat.", "err"); btn.disabled = false; }
  };
  const resolve = (v) => (String(v).startsWith("pending:") ? blobsDone.get(v.slice(8))?.path || "" : v);
})();
