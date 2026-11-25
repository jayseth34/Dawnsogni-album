/* DAWN SOGNI — EXPLORE WORLD (frontend only; content comes from content.json, edited in /admin.html) */
(async () => {
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const esc = (v) => String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const store = {
    get: (k, d) => { try { return JSON.parse(localStorage.getItem("ds_" + k)) ?? d; } catch { return d; } },
    set: (k, v) => { try { localStorage.setItem("ds_" + k, JSON.stringify(v)); } catch {} }
  };
  const fmt = (s) => (isFinite(s) ? `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}` : "–:––");
  const toast = (m) => { const t = $("#toast"); t.textContent = m; t.classList.add("show"); clearTimeout(toast.t); toast.t = setTimeout(() => t.classList.remove("show"), 2200); };

  let panelOpen = false, panelTick = null;
  let audio = null, ctx = null, analyser = null, cur = 0;

  /* ---------- Content ---------- */
  let C = {};
  try { C = await (await fetch("content.json?v=" + Date.now(), { cache: "no-store" })).json(); } catch {}
  const brand = C.brand || {}, album = C.album || {}, tracks = album.tracks || [];
  const videos = C.videos || [], products = C.products || [], drops = C.drops || [];
  const money = (n) => (C.currency || "₹") + Number(n || 0).toLocaleString("en-IN");
  const ART = window.DS_ART;
  const logo = new Image(); logo.src = "assets/ds-logo-dark.png";

  /* ---------- World items ---------- */
  const items = [{ title: "DAWN SOGNI", kind: "INTRO", action: "intro", video: "assets/ds-intro.mp4" }];
  if (album.title || tracks.length) items.push({ title: album.title || "THE ALBUM", kind: "ALBUM", action: "player", image: album.cover, art: "logo" });
  const vArts = ["blades", "liquid", "flame"];
  videos.forEach((v, i) => items.push({
    title: v.title || "UNTITLED", kind: v.label || "VIDEO", action: "video", ref: v,
    video: v.file && !v.poster ? v.file : "", image: v.poster || (v.youtube ? `https://img.youtube.com/vi/${encodeURIComponent(v.youtube)}/hqdefault.jpg` : ""),
    art: vArts[i % vArts.length]
  }));
  if (products.length) items.push({ title: "SHOP", kind: "COLLECTION", action: "shop", image: products.find((p) => p.image)?.image, art: "tee" });
  if (drops.length) items.push({ title: "DROPS", kind: "EVENTS", action: "drops", art: "hud" });
  if (C.customOrders !== false) items.push({ title: "MADE TO ORDER", kind: "CUSTOM", action: "custom", art: "mirror" });

  /* ---------- Build cards ---------- */
  const track = $("#track");
  track.innerHTML = items.map((it, i) => {
    const media = it.video ? `<video src="${esc(it.video)}" muted loop playsinline preload="metadata"></video>`
      : it.image ? `<img src="${esc(it.image)}" alt="" loading="lazy" />` : `<canvas></canvas>`;
    return `<article class="card" data-i="${i}" role="button" tabindex="-1" aria-label="${esc(it.title)} ${esc(it.kind)}">${media}</article>`;
  }).join("");
  const cards = $$(".card", track);
  const canvases = cards.map((c) => $("canvas", c));
  const sizeCanvas = (cv) => {
    const r = cv.getBoundingClientRect(), dpr = Math.min(devicePixelRatio || 1, 1.75);
    cv.width = Math.max(2, r.width * dpr); cv.height = Math.max(2, r.height * dpr);
  };
  const drawCard = (i, t) => { const cv = canvases[i]; if (cv && ART[items[i].art]) ART[items[i].art](cv.getContext("2d"), cv.width, cv.height, t, logo); };
  const resize = () => { canvases.forEach((cv, i) => cv && (sizeCanvas(cv), drawCard(i, 1.5 + i))); layout(); };

  /* ---------- Background ---------- */
  const bg = $(".bg"), bgCanvas = $("#bg-canvas"), bgVideo = $("#bg-video"), bgImg = $("#bg-img");
  bgCanvas.width = 240; bgCanvas.height = 300;
  function setBackground(it) {
    bg.classList.add("fade");
    setTimeout(() => {
      bgVideo.style.display = bgImg.style.display = "none"; bgCanvas.style.display = "block";
      bgVideo.pause();
      if (it.video) { bgVideo.src = it.video; bgVideo.style.display = "block"; bgCanvas.style.display = "none"; bgVideo.play().catch(() => {}); }
      else if (it.image) { bgImg.src = it.image; bgImg.style.display = "block"; bgCanvas.style.display = "none"; }
      bg.classList.remove("fade");
    }, 250);
  }

  /* ---------- Carousel ---------- */
  let active = -1;
  const step = () => (cards[1] ? cards[1].offsetLeft - cards[0].offsetLeft : 1);
  function layout() {
    const s = step(), pos = track.scrollLeft / s;
    cards.forEach((c, i) => {
      const d = Math.min(1.5, Math.abs(i - pos));
      c.style.transform = `scale(${1 - Math.min(d, 1) * 0.2})`;
      c.style.opacity = 1 - Math.min(d, 1) * 0.5;
    });
    const idx = Math.max(0, Math.min(items.length - 1, Math.round(pos)));
    if (idx !== active) setActive(idx);
  }
  function setActive(i) {
    active = i;
    const it = items[i], label = $("#label");
    label.classList.add("swap");
    setTimeout(() => { label.textContent = `${it.title} ${it.kind}`; label.classList.remove("swap"); }, 180);
    cards.forEach((c, k) => { const v = $("video", c); if (v) k === i ? v.play().catch(() => {}) : v.pause(); });
    setBackground(it);
  }
  const go = (i) => { i = Math.max(0, Math.min(items.length - 1, i)); track.scrollTo({ left: i * step(), behavior: "smooth" }); };
  track.addEventListener("scroll", () => requestAnimationFrame(layout), { passive: true });
  addEventListener("resize", resize);

  // mouse drag + wheel (desktop)
  let drag = null, moved = false;
  track.addEventListener("pointerdown", (e) => {
    if (e.pointerType !== "mouse") return;
    drag = { x: e.clientX, left: track.scrollLeft }; moved = false;
  });
  addEventListener("pointermove", (e) => {
    if (!drag) return;
    const dx = e.clientX - drag.x;
    if (Math.abs(dx) > 5) { moved = true; track.classList.add("dragging"); }
    track.scrollLeft = drag.left - dx;
  });
  addEventListener("pointerup", () => {
    if (!drag) return; drag = null;
    if (track.classList.contains("dragging")) { track.classList.remove("dragging"); go(Math.round(track.scrollLeft / step())); }
  });
  track.addEventListener("wheel", (e) => {
    if (Math.abs(e.deltaY) <= Math.abs(e.deltaX)) return;
    e.preventDefault();
    if (track._wheelLock) return;
    track._wheelLock = true; setTimeout(() => (track._wheelLock = false), 450);
    go(active + Math.sign(e.deltaY));
  }, { passive: false });
  track.addEventListener("click", (e) => {
    if (moved) { moved = false; return; }
    const c = e.target.closest(".card"); if (!c) return;
    const i = +c.dataset.i; i === active ? open(i) : go(i);
  });
  $("#emblem").addEventListener("click", () => open(active));
  addEventListener("keydown", (e) => {
    if (/INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName)) return;
    if (e.key === "Escape") { if ($("#drawer").classList.contains("open")) return bagOpen(false); if (panelOpen) return history.back(); }
    if (panelOpen || !$("#gate").classList.contains("hide")) return;
    if (e.key === "ArrowRight") go(active + 1);
    if (e.key === "ArrowLeft") go(active - 1);
    if (e.key === "Enter") open(active);
  });

  // animation loop: active card + blurred background
  const t0 = performance.now();
  (function loop() {
    const t = (performance.now() - t0) / 1000;
    if (!panelOpen && active >= 0) {
      drawCard(active, t);
      const it = items[active];
      if (!it.video && !it.image && ART[it.art]) ART[it.art](bgCanvas.getContext("2d"), bgCanvas.width, bgCanvas.height, t, logo);
    }
    if (panelOpen && panelTick) panelTick(t);
    requestAnimationFrame(loop);
  })();

  /* ---------- Gate ---------- */
  const gateVideo = $("#gate-video");
  $("#enter").addEventListener("click", () => {
    $("#gate").classList.add("hide");
    setTimeout(() => gateVideo.pause(), 1100);
    ensureAudio();
  });

  /* ---------- Top bar ---------- */
  const backLabel = $("#back-label");
  const homeLeft = () => (backLabel.textContent = tracks.length ? "LISTEN" : "");
  homeLeft();
  $("#back").addEventListener("click", () => {
    if (panelOpen) return history.back();
    if (tracks.length) open(items.findIndex((x) => x.action === "player"));
  });
  $("#home").addEventListener("click", () => { if (panelOpen) history.back(); else go(0); });
  $("#shop-pill").addEventListener("click", () => {
    if (products.length) { const i = items.findIndex((x) => x.action === "shop"); if (panelOpen) closePanel(true); open(i); }
    else bagOpen(true);
  });

  /* ---------- Panels ---------- */
  const panel = $("#panel"), inner = $("#panel-inner"), world = $("#world");
  function open(i) {
    const it = items[i]; if (!it) return;
    if (!panelOpen) history.pushState({ panel: true }, "");
    panelOpen = true; panelTick = null;
    world.classList.add("dim"); panel.classList.add("open"); panel.setAttribute("aria-hidden", "false");
    backLabel.textContent = "BACK"; panel.scrollTop = 0;
    $$("video", track).forEach((v) => v.pause());
    (PANELS[it.action] || PANELS.video)(it);
  }
  function closePanel(silent) {
    panelOpen = false; panelTick = null;
    $$("video, audio", inner).forEach((m) => m.pause());
    inner.innerHTML = "";
    world.classList.remove("dim"); panel.classList.remove("open"); panel.setAttribute("aria-hidden", "true");
    homeLeft();
    const v = cards[active] && $("video", cards[active]); if (v) v.play().catch(() => {});
    if (!silent) bgVideo.play().catch(() => {});
  }
  addEventListener("popstate", () => { if (panelOpen) closePanel(); });

  const head = (eyebrow, title) => `<p class="eyebrow">${esc(eyebrow)}</p><h2 class="panel-title">${esc(title)}</h2>`;
  const linksHTML = () => {
    const L = [["INSTAGRAM", brand.instagram], ["SPOTIFY", brand.spotify], ["APPLE MUSIC", brand.appleMusic], ["YOUTUBE", brand.youtube]].filter((x) => x[1]);
    return L.length ? `<div class="links">${L.map(([n, u]) => `<a href="${esc(u)}" target="_blank" rel="noopener">${n}</a>`).join("")}</div>` : "";
  };
  const artCanvas = (sel, art) => {
    const cv = $(sel, inner); if (!cv) return;
    const r = cv.getBoundingClientRect(), dpr = Math.min(devicePixelRatio || 1, 1.75);
    cv.width = r.width * dpr; cv.height = r.height * dpr;
    panelTick = (t) => ART[art](cv.getContext("2d"), cv.width, cv.height, t, logo);
  };

  const PANELS = {
    intro() {
      inner.innerHTML = `${head("DAWN SOGNI", "THE WORLD")}
        <div class="video-frame portrait"><video src="assets/ds-intro.mp4" poster="assets/ds-intro-poster.jpg" controls autoplay playsinline loop></video></div>
        ${album.description ? `<p class="desc">${esc(album.description)}</p>` : ""}${linksHTML()}`;
    },

    video(it) {
      const v = it.ref || {};
      let media;
      if (v.youtube) media = `<iframe src="https://www.youtube.com/embed/${encodeURIComponent(v.youtube)}?autoplay=1&rel=0" allow="autoplay; encrypted-media; fullscreen; picture-in-picture" allowfullscreen></iframe>`;
      else if (v.file) media = `<video src="${esc(v.file)}" ${v.poster ? `poster="${esc(v.poster)}"` : ""} controls autoplay playsinline></video>`;
      else media = `<canvas></canvas><p class="soon">COMING SOON</p>`;
      inner.innerHTML = `${head("EXPLORE", `${it.title}`)}<div class="video-frame">${media}</div>
        ${v.description ? `<p class="desc">${esc(v.description)}</p>` : ""}`;
      if (!v.youtube && !v.file) artCanvas(".video-frame canvas", it.art);
    },

    player(it) {
      const rel = album.releaseDate ? new Date(album.releaseDate) : null;
      inner.innerHTML = `${head("THE ALBUM", it.title)}
        ${album.description ? `<p class="desc">${esc(album.description)}</p>` : ""}
        ${rel && rel > Date.now() ? `<div class="countdown" id="cd"></div>` : ""}
        <div class="player">
          <div class="cover">${album.cover ? `<img src="${esc(album.cover)}" alt="" style="width:100%;height:100%;object-fit:cover" />` : `<canvas></canvas>`}</div>
          <div>
            ${tracks.length ? `
            <p class="now">NOW PLAYING</p>
            <p class="now-title" id="now-title">${esc(tracks[cur]?.title || "")}</p>
            <canvas class="viz" id="viz"></canvas>
            <div class="progress" id="progress"><div class="progress-fill" id="progress-fill"></div></div>
            <div class="times"><span id="t-cur">0:00</span><span id="t-dur">–:––</span></div>
            <div class="controls"><button id="prev" aria-label="Previous">⏮</button><button class="play" id="play" aria-label="Play">${audio && !audio.paused ? "❚❚" : "▶"}</button><button id="next" aria-label="Next">⏭</button></div>
            <ol class="tracklist" id="tracklist">${tracks.map((t, i) => `
              <li data-i="${i}" class="${i === cur ? "active" : ""}"><span>${String(i + 1).padStart(2, "0")}</span><span>${esc(t.title)}</span><span class="len" data-len="${i}"></span>
              ${t.description ? `<span class="track-desc">${esc(t.description)}</span>` : ""}</li>`).join("")}</ol>` : `<p class="empty-state">TRACKS DROPPING SOON</p>`}
          </div>
        </div>${linksHTML()}`;
      if (!album.cover) artCanvas(".cover canvas", "logo");
      if (rel && rel > Date.now()) {
        const cd = () => {
          const el = $("#cd", inner); if (!el) return;
          let s = Math.max(0, (rel - Date.now()) / 1000);
          const d = Math.floor(s / 86400); s -= d * 86400; const h = Math.floor(s / 3600); s -= h * 3600; const m = Math.floor(s / 60); s = Math.floor(s - m * 60);
          el.innerHTML = `<span><b>${d}</b>DAYS</span><span><b>${h}</b>HRS</span><span><b>${m}</b>MIN</span><span><b>${s}</b>SEC</span>`;
          setTimeout(cd, 1000);
        };
        cd();
      }
      if (!tracks.length) return;
      $("#play", inner).onclick = () => (audio && !audio.paused ? audio.pause() : playTrack(cur));
      $("#next", inner).onclick = () => playTrack((cur + 1) % tracks.length);
      $("#prev", inner).onclick = () => playTrack(audio && audio.currentTime > 3 ? cur : (cur - 1 + tracks.length) % tracks.length);
      $("#tracklist", inner).onclick = (e) => { const li = e.target.closest("li"); if (li) +li.dataset.i === cur && audio && !audio.paused ? audio.pause() : playTrack(+li.dataset.i); };
      $("#progress", inner).onclick = (e) => { if (!audio || !isFinite(audio.duration)) return; const r = e.currentTarget.getBoundingClientRect(); audio.currentTime = ((e.clientX - r.left) / r.width) * audio.duration; };
      // durations
      tracks.forEach((t, i) => { const a = new Audio(); a.preload = "metadata"; a.src = t.file; a.onloadedmetadata = () => { const el = $(`[data-len="${i}"]`, inner); if (el) el.textContent = fmt(a.duration); }; });
      const base = panelTick;
      panelTick = (t) => { base && base(t); drawViz(); };
    },

    shop() {
      inner.innerHTML = `${head("DAWN SOGNI", "SHOP")}
        <div class="shop-grid">${products.map((p, i) => `
          <article class="product">
            <div class="product-visual">${p.image ? `<img src="${esc(p.image)}" alt="${esc(p.name)}" loading="lazy" />` : productSVG()}</div>
            <div class="product-info"><span>${esc(p.name)}</span><span>${money(p.price)}</span></div>
            <div class="product-actions">
              ${(p.sizes || []).length ? `<select aria-label="Size">${p.sizes.map((s) => `<option>${esc(s)}</option>`).join("")}</select>` : ""}
              <button class="btn" data-p="${i}">ADD TO BAG</button>
            </div>
          </article>`).join("")}</div>
        <button class="ghost" id="view-bag">VIEW BAG</button>`;
      $(".shop-grid", inner).onclick = (e) => {
        const b = e.target.closest("[data-p]"); if (!b) return;
        const p = products[+b.dataset.p], sel = b.parentElement.querySelector("select"), size = sel ? sel.value : "";
        const ex = cart.find((c) => c.name === p.name && c.size === size);
        ex ? ex.qty++ : cart.push({ name: p.name, price: Number(p.price) || 0, size, qty: 1 });
        saveCart(); toast("ADDED TO BAG");
      };
      $("#view-bag", inner).onclick = () => bagOpen(true);
    },

    drops() {
      const saved = store.get("reminders", []);
      inner.innerHTML = `${head("DAWN SOGNI", "DROPS & EVENTS")}
        <ul class="drops">${drops.map((d, i) => {
          const date = d.date ? new Date(d.date + "T00:00:00").toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }).toUpperCase() : "TBA";
          const key = `${d.date}|${d.title}`, on = saved.includes(key);
          const btn = d.link ? `<a class="ghost" href="${esc(d.link)}" target="_blank" rel="noopener">${esc(d.cta || "TICKETS")}</a>`
            : `<button class="ghost ${on ? "done" : ""}" data-k="${esc(key)}">${on ? "✓ SAVED" : "NOTIFY"}</button>`;
          return `<li><span class="d-date">${date}</span><span class="d-title">${esc(d.title)}</span><span class="d-place">${esc(d.place)}</span>${btn}</li>`;
        }).join("")}</ul>`;
      $(".drops", inner).onclick = (e) => {
        const b = e.target.closest("button[data-k]"); if (!b) return;
        const r = store.get("reminders", []), k = b.dataset.k, on = r.includes(k);
        on ? r.splice(r.indexOf(k), 1) : r.push(k); store.set("reminders", r);
        b.classList.toggle("done", !on); b.textContent = on ? "NOTIFY" : "✓ SAVED"; toast(on ? "REMOVED" : "SAVED");
      };
    },

    custom() {
      inner.innerHTML = `${head("DAWN SOGNI", "MADE TO ORDER")}
        <p class="desc">Your idea, in chrome. One-of-one pieces made to order.</p>
        <form class="form" id="custom-form">
          <input name="name" placeholder="NAME" required />
          <input name="contact" placeholder="EMAIL / INSTAGRAM" required />
          <select name="piece" required><option value="">PIECE</option><option>Tee</option><option>Hoodie</option><option>Jacket</option><option>Cap</option><option>Other</option></select>
          <select name="size"><option value="">SIZE</option><option>XS</option><option>S</option><option>M</option><option>L</option><option>XL</option><option>XXL</option></select>
          <textarea name="idea" rows="4" placeholder="DESCRIBE YOUR DESIGN" required></textarea>
          <button class="btn" type="submit">SEND REQUEST</button>
          <p class="note" id="custom-msg"></p>
        </form>${linksHTML()}`;
      $("#custom-form", inner).onsubmit = (e) => {
        e.preventDefault();
        const f = Object.fromEntries(new FormData(e.target));
        const body = `Name: ${f.name}\nContact: ${f.contact}\nPiece: ${f.piece}\nSize: ${f.size || "-"}\n\nIdea:\n${f.idea}`;
        if (brand.email) {
          location.href = `mailto:${brand.email}?subject=${encodeURIComponent("Custom order — " + f.piece)}&body=${encodeURIComponent(body)}`;
          $("#custom-msg", inner).textContent = "YOUR MAIL APP WILL OPEN — HIT SEND AND WE'LL REPLY WITHIN 48H.";
        } else if (brand.instagram) {
          navigator.clipboard?.writeText(body); window.open(brand.instagram, "_blank");
          $("#custom-msg", inner).textContent = "REQUEST COPIED — PASTE IT IN OUR INSTAGRAM DMS.";
        } else $("#custom-msg", inner).textContent = "ORDERS OPEN SOON.";
      };
    }
  };

  function productSVG() {
    return `<svg viewBox="0 0 240 250" xmlns="http://www.w3.org/2000/svg"><path d="M70 20 L100 8 Q120 24 140 8 L170 20 L205 58 L178 80 L165 68 L165 230 L75 230 L75 68 L62 80 L35 58 Z" fill="#111113" stroke="rgba(255,255,255,0.25)"/><image href="assets/ds-logo-dark.png" x="80" y="72" width="80" height="25"/></svg>`;
  }

  /* ---------- Audio ---------- */
  const vizData = new Uint8Array(128);
  function ensureAudio() {
    if (ctx) { ctx.state === "suspended" && ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
    ctx = new AC(); analyser = ctx.createAnalyser(); analyser.fftSize = 256; analyser.connect(ctx.destination);
  }
  function playTrack(i) {
    ensureAudio();
    if (!audio) {
      audio = new Audio(); audio.preload = "auto";
      if (ctx) ctx.createMediaElementSource(audio).connect(analyser);
      audio.addEventListener("ended", () => playTrack((cur + 1) % tracks.length));
      ["play", "pause"].forEach((ev) => audio.addEventListener(ev, syncUI));
      audio.addEventListener("timeupdate", syncUI);
    }
    if (i !== cur || !audio.src) { cur = i; audio.src = tracks[cur].file; }
    audio.play().catch(() => toast("COULDN'T PLAY THIS TRACK"));
    syncUI();
  }
  function syncUI() {
    const pb = $("#play", inner); if (!pb) return;
    pb.textContent = audio && !audio.paused ? "❚❚" : "▶";
    $("#now-title", inner).textContent = tracks[cur]?.title || "";
    $$("#tracklist li", inner).forEach((li, k) => li.classList.toggle("active", k === cur));
    if (audio) {
      $("#progress-fill", inner).style.width = (isFinite(audio.duration) ? (audio.currentTime / audio.duration) * 100 : 0) + "%";
      $("#t-cur", inner).textContent = fmt(audio.currentTime); $("#t-dur", inner).textContent = fmt(audio.duration);
    }
  }
  function drawViz() {
    const viz = $("#viz", inner); if (!viz) return;
    const g = viz.getContext("2d"), dpr = devicePixelRatio || 1;
    const W = (viz.width = viz.clientWidth * dpr), H = (viz.height = viz.clientHeight * dpr);
    if (analyser && audio && !audio.paused) analyser.getByteFrequencyData(vizData); else vizData.fill(0);
    const bars = 64, bw = W / bars, grad = g.createLinearGradient(0, 0, W, 0);
    grad.addColorStop(0, "#55555c"); grad.addColorStop(0.5, "#fff"); grad.addColorStop(1, "#55555c");
    g.fillStyle = grad;
    for (let i = 0; i < bars; i++) { const bh = Math.max(2 * dpr, (vizData[i] / 255) * H); g.fillRect(i * bw + 1, (H - bh) / 2, bw - 2 * dpr, bh); }
  }

  /* ---------- Bag ---------- */
  let cart = store.get("bag", []);
  const saveCart = () => { store.set("bag", cart); renderCart(); };
  function renderCart() {
    const n = cart.reduce((a, c) => a + c.qty, 0);
    $("#bag-count").textContent = n ? n : "";
    $("#cart-items").innerHTML = cart.length ? cart.map((c, i) => `
      <li><span>${esc(c.name)}${c.size ? `<br><small style="color:var(--dim)">SIZE ${esc(c.size)}</small>` : ""}</span><span>${money(c.price * c.qty)}</span>
      <span class="qty"><button data-a="dec" data-i="${i}">−</button>${c.qty}<button data-a="inc" data-i="${i}">+</button></span>
      <button class="rm" data-a="rm" data-i="${i}">REMOVE</button></li>`).join("") : `<li class="empty">YOUR BAG IS EMPTY</li>`;
    $("#cart-total").textContent = money(cart.reduce((a, c) => a + c.price * c.qty, 0));
  }
  $("#cart-items").addEventListener("click", (e) => {
    const b = e.target.closest("[data-a]"); if (!b) return;
    const i = +b.dataset.i;
    if (b.dataset.a === "inc") cart[i].qty++;
    if (b.dataset.a === "dec") cart[i].qty--;
    if (b.dataset.a === "rm" || cart[i].qty <= 0) cart.splice(i, 1);
    saveCart();
  });
  function bagOpen(o) { $("#drawer").classList.toggle("open", o); $("#overlay").classList.toggle("show", o); $("#drawer").setAttribute("aria-hidden", !o); }
  $("#drawer-close").onclick = () => bagOpen(false);
  $("#overlay").onclick = () => bagOpen(false);
  $("#checkout").onclick = () => {
    if (!cart.length) return toast("YOUR BAG IS EMPTY");
    if (!brand.email) { $("#checkout-msg").textContent = "Checkout opens soon."; return; }
    const lines = cart.map((c) => `${c.name}${c.size ? ` (${c.size})` : ""} x${c.qty} — ${money(c.price * c.qty)}`);
    const body = `Hi Dawn Sogni,\n\nI'd like to order:\n\n${lines.join("\n")}\n\nTotal: ${$("#cart-total").textContent}\n\nName:\nAddress:\nPhone:\n`;
    location.href = `mailto:${brand.email}?subject=${encodeURIComponent("Order — Dawn Sogni")}&body=${encodeURIComponent(body)}`;
    $("#checkout-msg").textContent = "Your mail app will open with the order. We'll confirm payment & shipping by reply.";
  };
  renderCart();

  /* ---------- Start ---------- */
  resize();
  if (logo.complete) resize(); else logo.onload = resize;
  if (document.fonts) document.fonts.ready.then(resize);
})();
