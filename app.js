/* DAWN SOGNI — album site (pure frontend) */
(() => {
  const D = window.DS_DATA;
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const store = {
    get: (k, d) => { try { return JSON.parse(localStorage.getItem("ds_" + k)) ?? d; } catch { return d; } },
    set: (k, v) => { try { localStorage.setItem("ds_" + k, JSON.stringify(v)); } catch {} }
  };
  const fmt = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;
  const money = (n) => D.currency + n.toLocaleString("en-IN");
  const toast = (msg) => {
    const t = $("#toast"); t.textContent = msg; t.classList.add("show");
    clearTimeout(toast._t); toast._t = setTimeout(() => t.classList.remove("show"), 2400);
  };

  /* ---------------- Smoke canvas ---------------- */
  function smoke(canvas, count = 26) {
    const ctx = canvas.getContext("2d");
    let w, h, parts;
    const resize = () => {
      const dpr = Math.min(devicePixelRatio || 1, 1.5);
      w = canvas.width = innerWidth * dpr; h = canvas.height = innerHeight * dpr;
      parts = Array.from({ length: count }, () => ({
        x: Math.random() * w, y: Math.random() * h, r: (0.15 + Math.random() * 0.35) * Math.max(w, h),
        vx: (Math.random() - 0.5) * 0.25, vy: (Math.random() - 0.5) * 0.15, a: 0.03 + Math.random() * 0.05, c: Math.random() < 0.6 ? "255,140,50" : "255,220,180"
      }));
    };
    resize(); addEventListener("resize", resize);
    let running = true;
    const tick = () => {
      if (!running) return;
      ctx.clearRect(0, 0, w, h);
      for (const p of parts) {
        p.x += p.vx; p.y += p.vy;
        if (p.x < -p.r) p.x = w + p.r; if (p.x > w + p.r) p.x = -p.r;
        if (p.y < -p.r) p.y = h + p.r; if (p.y > h + p.r) p.y = -p.r;
        const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.r);
        g.addColorStop(0, `rgba(${p.c},${p.a})`); g.addColorStop(1, "rgba(0,0,0,0)");
        ctx.fillStyle = g; ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2); ctx.fill();
      }
      requestAnimationFrame(tick);
    };
    tick();
    return () => (running = false);
  }
  const stopGateSmoke = smoke($("#gate-smoke"), 18);
  smoke($("#bg-smoke"), 14);

  /* ---------------- Audio engine ---------------- */
  let ctx, master, analyser;
  function ensureAudio() {
    if (ctx) { if (ctx.state === "suspended") ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ctx = new AC();
    master = ctx.createGain(); master.gain.value = 0.8;
    analyser = ctx.createAnalyser(); analyser.fftSize = 256;
    master.connect(analyser); analyser.connect(ctx.destination);
  }

  /* ---------------- Gate ---------------- */
  document.body.classList.add("locked");
  $("#enter-btn").addEventListener("click", () => {
    ensureAudio();
    $("#gate").classList.add("hide");
    document.body.classList.remove("locked");
    setTimeout(stopGateSmoke, 1400);
  });

  /* ---------------- Nav ---------------- */
  const nav = $("#nav");
  addEventListener("scroll", () => nav.classList.toggle("scrolled", scrollY > 40), { passive: true });
  $("#burger").addEventListener("click", (e) => {
    e.currentTarget.classList.toggle("open"); $("#nav-links").classList.toggle("open");
  });
  $$("#nav-links a").forEach((a) => a.addEventListener("click", () => {
    $("#burger").classList.remove("open"); $("#nav-links").classList.remove("open");
  }));

  /* ---------------- Hero tilt ---------------- */
  const heroLogo = $(".hero-logo");
  const tilt = (x, y) => (heroLogo.style.transform = `rotateY(${x * 14}deg) rotateX(${-y * 10}deg)`);
  addEventListener("mousemove", (e) => {
    if (scrollY > innerHeight) return;
    tilt(e.clientX / innerWidth - 0.5, e.clientY / innerHeight - 0.5);
  });
  addEventListener("deviceorientation", (e) => {
    if (e.gamma == null) return;
    tilt(Math.max(-1, Math.min(1, e.gamma / 45)) / 2, Math.max(-1, Math.min(1, (e.beta - 45) / 45)) / 2);
  });

  /* ---------------- Title, countdown, marquee ---------------- */
  $("#album-title").textContent = D.albumTitle;
    document.title = `DAWN SOGNI — ${D.albumTitle.toUpperCase()}`;
  $("#year").textContent = new Date().getFullYear();
  const release = new Date(D.releaseDate);
  $("#release-label").textContent = "RELEASE — " + release.toLocaleDateString("en-GB", { day: "2-digit", month: "long", year: "numeric" }).toUpperCase();
  const cd = () => {
    let s = Math.max(0, (release - Date.now()) / 1000);
    if (s === 0) { $("#countdown").innerHTML = '<div><b>OUT NOW</b></div>'; return; }
    const d = Math.floor(s / 86400); s -= d * 86400;
    const h = Math.floor(s / 3600); s -= h * 3600;
    const m = Math.floor(s / 60); s = Math.floor(s - m * 60);
    $("#cd-d").textContent = String(d).padStart(2, "0");
    $("#cd-h").textContent = String(h).padStart(2, "0");
    $("#cd-m").textContent = String(m).padStart(2, "0");
    $("#cd-s").textContent = String(s).padStart(2, "0");
    setTimeout(cd, 1000);
  };
  cd();
  const mq = D.marquee.map((t) => `<span>${t}</span>`).join("");
  $("#marquee").innerHTML = mq + mq;

  /* ---------------- Player ---------------- */
  const tracks = D.tracks;
  const list = $("#tracklist");
  list.innerHTML = tracks.map((t, i) =>
    `<li data-i="${i}"><span class="num">${String(i + 1).padStart(2, "0")}</span><span>${t.title}</span><span class="len">${fmt(t.length)}</span></li>`
  ).join("");
  let cur = 0, playing = false, voice = null, startAt = 0, offset = 0, audioEl = null, mediaNode = null;

  function synthVoice(t) {
    // Generated ambient preview: detuned pad + sub + filtered noise + slow arpeggio
    const out = ctx.createGain(); out.gain.value = 0;
    const filter = ctx.createBiquadFilter(); filter.type = "lowpass"; filter.frequency.value = 900; filter.Q.value = 6;
    const lfo = ctx.createOscillator(); lfo.frequency.value = 0.08; const lfoG = ctx.createGain(); lfoG.gain.value = 600;
    lfo.connect(lfoG); lfoG.connect(filter.frequency);
    const delay = ctx.createDelay(); delay.delayTime.value = 0.42; const fb = ctx.createGain(); fb.gain.value = 0.38;
    delay.connect(fb); fb.connect(delay);
    filter.connect(out); delay.connect(out); out.connect(master);
    const nodes = [lfo];
    t.seed.forEach((f) => [-6, 6].forEach((det) => {
      const o = ctx.createOscillator(); o.type = "sawtooth"; o.frequency.value = f / 2; o.detune.value = det;
      const g = ctx.createGain(); g.gain.value = 0.05; o.connect(g); g.connect(filter); nodes.push(o);
    }));
    const sub = ctx.createOscillator(); sub.type = "sine"; sub.frequency.value = t.seed[0] / 4;
    const sg = ctx.createGain(); sg.gain.value = 0.22; sub.connect(sg); sg.connect(out); nodes.push(sub);
    // noise
    const buf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const ch = buf.getChannelData(0); for (let i = 0; i < ch.length; i++) ch[i] = Math.random() * 2 - 1;
    const n = ctx.createBufferSource(); n.buffer = buf; n.loop = true;
    const nf = ctx.createBiquadFilter(); nf.type = "bandpass"; nf.frequency.value = 3000; nf.Q.value = 0.6;
    const ng = ctx.createGain(); ng.gain.value = 0.015; n.connect(nf); nf.connect(ng); ng.connect(out); nodes.push(n);
    // arpeggio (bell)
    const now = ctx.currentTime;
    const notes = [...t.seed, t.seed[1] * 2, t.seed[0] * 2];
    for (let k = 0; k < Math.floor(t.length / 0.6); k++) {
      const o = ctx.createOscillator(); o.type = "triangle"; o.frequency.value = notes[(k * 3 + (k >> 2)) % notes.length] * 2;
      const g = ctx.createGain(); const at = now + 0.4 + k * 0.6;
      g.gain.setValueAtTime(0, at); g.gain.linearRampToValueAtTime(0.06, at + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, at + 0.55);
      o.connect(g); g.connect(delay); g.connect(out); o.start(at); o.stop(at + 0.6);
    }
    nodes.forEach((o) => o.start());
    out.gain.linearRampToValueAtTime(0.9, now + 1.5);
    return {
      stop() {
        const s = ctx.currentTime;
        out.gain.cancelScheduledValues(s); out.gain.setValueAtTime(out.gain.value, s); out.gain.linearRampToValueAtTime(0, s + 0.4);
        nodes.forEach((o) => { try { o.stop(s + 0.45); } catch {} });
        setTimeout(() => out.disconnect(), 600);
      }
    };
  }

  function currentTime() {
    if (audioEl) return audioEl.currentTime;
    return playing ? offset + (ctx.currentTime - startAt) : offset;
  }
  function duration() { return audioEl && isFinite(audioEl.duration) ? audioEl.duration : tracks[cur].length; }

  function stopAll() {
    if (voice) { voice.stop(); voice = null; }
    if (audioEl) { audioEl.pause(); }
  }
  function play(i = cur) {
    ensureAudio(); if (!ctx) return toast("AUDIO NOT SUPPORTED");
    if (i !== cur) { stopAll(); offset = 0; if (audioEl) { audioEl = null; mediaNode = null; } }
    cur = i;
    const t = tracks[cur];
    if (t.src) {
      if (!audioEl) {
        audioEl = new Audio(t.src); audioEl.crossOrigin = "anonymous";
        mediaNode = ctx.createMediaElementSource(audioEl); mediaNode.connect(master);
        audioEl.addEventListener("ended", () => next());
      }
      audioEl.play();
    } else {
      voice = synthVoice(t); startAt = ctx.currentTime;
    }
    playing = true; render();
  }
  function pause() {
    if (!playing) return;
    offset = currentTime(); stopAll(); playing = false; render();
  }
  function next() { stopAll(); playing = false; offset = 0; audioEl = null; play((cur + 1) % tracks.length); }
  function prev() {
    if (currentTime() > 3) { stopAll(); offset = 0; audioEl = null; playing = false; return play(cur); }
    stopAll(); playing = false; offset = 0; audioEl = null; play((cur - 1 + tracks.length) % tracks.length);
  }
  function render() {
    $("#now-title").textContent = tracks[cur].title;
    $("#play").textContent = playing ? "❚❚" : "▶";
    $(".album").classList.toggle("playing", playing);
    $$("#tracklist li").forEach((li, i) => li.classList.toggle("active", i === cur));
  }
  $("#play").addEventListener("click", () => (playing ? pause() : play()));
  $("#next").addEventListener("click", next);
  $("#prev").addEventListener("click", prev);
  list.addEventListener("click", (e) => {
    const li = e.target.closest("li"); if (!li) return;
    const i = +li.dataset.i;
    if (i === cur && playing) return pause();
    if (i !== cur) { stopAll(); playing = false; offset = 0; audioEl = null; }
    play(i);
  });
  $("#progress").addEventListener("click", (e) => {
    const r = e.currentTarget.getBoundingClientRect();
    const p = (e.clientX - r.left) / r.width;
    if (audioEl) { audioEl.currentTime = p * duration(); return; }
    // synth previews restart (generated, not seekable) — just reposition the clock
    offset = p * duration(); if (playing) startAt = ctx.currentTime;
  });
  addEventListener("keydown", (e) => {
    if (e.code === "Space" && !/INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName) && $("#gate").classList.contains("hide")) {
      e.preventDefault(); playing ? pause() : play();
    }
  });
  render();

  // progress + visualizer loop
  const viz = $("#viz"), vctx = viz.getContext("2d");
  const data = new Uint8Array(128);
  (function loop() {
    const t = currentTime(), d = duration();
    if (playing && t >= d) next();
    $("#progress-fill").style.width = Math.min(100, (t / d) * 100) + "%";
    $("#t-cur").textContent = fmt(Math.min(t, d)); $("#t-dur").textContent = fmt(d);
    const dpr = devicePixelRatio || 1;
    const W = (viz.width = viz.clientWidth * dpr), H = (viz.height = viz.clientHeight * dpr);
    if (analyser && playing) analyser.getByteFrequencyData(data); else data.fill(0);
    const bars = 64, bw = W / bars;
    const grad = vctx.createLinearGradient(0, 0, W, 0);
    grad.addColorStop(0, "#b8541a"); grad.addColorStop(0.5, "#fff1de"); grad.addColorStop(1, "#c2611f");
    vctx.fillStyle = grad;
    for (let i = 0; i < bars; i++) {
      const v = data[i] / 255; const bh = Math.max(2 * dpr, v * H);
      vctx.fillRect(i * bw + 1, (H - bh) / 2, bw - 2 * dpr, bh);
    }
    requestAnimationFrame(loop);
  })();

  /* ---------------- Visuals ---------------- */
  function drawChromeArt(c, seed, time = 0) {
    const g = c.getContext("2d"), W = c.width, H = c.height;
    const bg = g.createLinearGradient(0, 0, W, H);
    bg.addColorStop(0, "#050505"); bg.addColorStop(1, "#16161a");
    g.fillStyle = bg; g.fillRect(0, 0, W, H);
    for (let k = 0; k < 9; k++) {
      g.beginPath();
      for (let x = 0; x <= W; x += 6) {
        const y = H / 2 + Math.sin(x * 0.006 + seed * 1.7 + k * 0.5 + time) * H * 0.22 * Math.sin(k + seed)
          + Math.cos(x * 0.013 + seed + time * 0.7) * H * 0.08 + (k - 4) * H * 0.045;
        x ? g.lineTo(x, y) : g.moveTo(x, y);
      }
      const lg = g.createLinearGradient(0, 0, W, 0);
      lg.addColorStop(0, "rgba(255,255,255,0)"); lg.addColorStop(0.5, `rgba(240,240,250,${0.15 + k * 0.05})`); lg.addColorStop(1, "rgba(255,255,255,0)");
      g.strokeStyle = lg; g.lineWidth = 1 + (k % 3) * 1.2; g.stroke();
    }
  }
  const vg = $("#visual-grid");
  vg.innerHTML = D.visuals.map((v, i) => `
    <article class="visual-card reveal" data-i="${i}">
      <canvas width="800" height="450"></canvas>
      <div class="playicon">▶</div>
      <div class="visual-meta"><h3>${v.title}</h3><span class="tag mono">${v.tag}</span></div>
    </article>`).join("");
  $$(".visual-card canvas", vg).forEach((c, i) => drawChromeArt(c, i + 1));

  const modal = $("#modal"), mbody = $("#modal-body");
  let modalAnim = 0;
  vg.addEventListener("click", (e) => {
    const card = e.target.closest(".visual-card"); if (!card) return;
    const v = D.visuals[+card.dataset.i];
    if (playing) pause();
    if (v.youtube) {
      mbody.innerHTML = `<iframe src="https://www.youtube.com/embed/${encodeURIComponent(v.youtube)}?autoplay=1" allow="autoplay; encrypted-media; fullscreen" allowfullscreen></iframe>`;
    } else {
      mbody.innerHTML = `<canvas width="1280" height="720"></canvas><p class="soon">${v.title} — COMING SOON</p>`;
      const c = $("canvas", mbody), seed = +card.dataset.i + 1, t0 = performance.now();
      const anim = () => { drawChromeArt(c, seed, (performance.now() - t0) / 1500); modalAnim = requestAnimationFrame(anim); };
      anim();
    }
    modal.classList.add("show"); document.body.classList.add("locked");
  });
  const closeModal = () => {
    cancelAnimationFrame(modalAnim); modal.classList.remove("show"); document.body.classList.remove("locked");
    setTimeout(() => (mbody.innerHTML = ""), 400);
  };
  $("#modal-close").addEventListener("click", closeModal);
  modal.addEventListener("click", (e) => e.target === modal && closeModal());

  /* ---------------- Drops ---------------- */
  const reminders = store.get("reminders", []);
  $("#drop-list").innerHTML = D.drops.map((d, i) => {
    const date = new Date(d.date + "T00:00:00").toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }).toUpperCase();
    const done = reminders.includes(i);
    return `<li class="reveal"><span class="d-date">${date}</span><span class="d-title">${d.title}</span><span class="d-place">${d.place}</span>
      <button data-i="${i}" class="${done ? "done" : ""}">${done ? "✓ SAVED" : d.status}</button></li>`;
  }).join("");
  $("#drop-list").addEventListener("click", (e) => {
    const b = e.target.closest("button"); if (!b) return;
    const i = +b.dataset.i, r = store.get("reminders", []);
    if (r.includes(i)) { r.splice(r.indexOf(i), 1); b.classList.remove("done"); b.textContent = D.drops[i].status; toast("REMINDER REMOVED"); }
    else { r.push(i); b.classList.add("done"); b.textContent = "✓ SAVED"; toast("WE'LL REMIND YOU — " + D.drops[i].title); }
    store.set("reminders", r);
  });

  /* ---------------- Shop ---------------- */
  const LOGO = "assets/ds-logo-dark.png";
  const productSVG = (p) => {
    const fill = p.hue ? `hsl(${p.hue},12%,14%)` : "#121214";
    const stroke = "rgba(255,255,255,0.28)";
    const shapes = {
      tee: `<path d="M70 20 L100 8 Q120 24 140 8 L170 20 L205 58 L178 80 L165 68 L165 230 L75 230 L75 68 L62 80 L35 58 Z" fill="${fill}" stroke="${stroke}"/>
            <image href="${LOGO}" x="82" y="70" width="76" height="24"/>`,
      hoodie: `<path d="M68 30 Q90 0 120 6 Q150 0 172 30 L210 70 L200 230 L178 230 L172 110 L172 236 L68 236 L68 110 L62 230 L40 230 L30 70 Z" fill="${fill}" stroke="${stroke}"/>
            <path d="M96 22 Q120 56 144 22" fill="none" stroke="${stroke}"/><path d="M92 180 L148 180 L156 214 L84 214 Z" fill="none" stroke="${stroke}"/>
            <image href="${LOGO}" x="78" y="90" width="84" height="26"/>`,
      cap: `<path d="M40 150 Q40 60 120 56 Q200 60 200 150 Z" fill="${fill}" stroke="${stroke}"/>
            <path d="M40 150 Q130 140 228 170 Q140 186 40 160 Z" fill="${fill}" stroke="${stroke}"/>
            <image href="${LOGO}" x="78" y="96" width="84" height="26"/>`,
      vinyl: `<rect x="30" y="40" width="160" height="160" fill="${fill}" stroke="${stroke}"/>
            <circle cx="160" cy="120" r="74" fill="#0b0b0b" stroke="#2a2a2a"/>
            <circle cx="160" cy="120" r="22" fill="#ddd"/>
            <rect x="30" y="40" width="160" height="160" fill="${fill}" stroke="${stroke}"/>
            <image href="${LOGO}" x="45" y="105" width="130" height="40"/>`
    };
    return `<svg viewBox="0 0 240 250" xmlns="http://www.w3.org/2000/svg">${shapes[p.type] || shapes.tee}</svg>`;
  };
  $("#shop-grid").innerHTML = D.products.map((p) => `
    <article class="product reveal">
      <div class="product-visual">${productSVG(p)}</div>
      <div class="product-info"><span>${p.name}</span><span>${money(p.price)}</span></div>
      <div class="product-actions">
        <select aria-label="Size">${p.sizes.map((s) => `<option>${s}</option>`).join("")}</select>
        <button class="btn" data-id="${p.id}">ADD TO BAG</button>
      </div>
    </article>`).join("");

  let cart = store.get("cart", []);
  const saveCart = () => { store.set("cart", cart); renderCart(); };
  function renderCart() {
    $("#cart-count").textContent = cart.reduce((a, c) => a + c.qty, 0);
    const items = $("#cart-items");
    if (!cart.length) { items.innerHTML = '<li class="empty">YOUR BAG IS EMPTY</li>'; }
    else items.innerHTML = cart.map((c, i) => {
      const p = D.products.find((x) => x.id === c.id); if (!p) return "";
      return `<li><span>${p.name}<br><span class="dim">SIZE ${c.size}</span></span><span>${money(p.price * c.qty)}</span>
        <span class="qty"><button data-a="dec" data-i="${i}">−</button>${c.qty}<button data-a="inc" data-i="${i}">+</button></span>
        <button class="dim" data-a="rm" data-i="${i}">REMOVE</button></li>`;
    }).join("");
    $("#cart-total").textContent = money(cart.reduce((a, c) => a + (D.products.find((x) => x.id === c.id)?.price || 0) * c.qty, 0));
  }
  $("#shop-grid").addEventListener("click", (e) => {
    const b = e.target.closest("button[data-id]"); if (!b) return;
    const size = b.parentElement.querySelector("select").value;
    const ex = cart.find((c) => c.id === b.dataset.id && c.size === size);
    ex ? ex.qty++ : cart.push({ id: b.dataset.id, size, qty: 1 });
    saveCart(); toast("ADDED TO BAG");
  });
  $("#cart-items").addEventListener("click", (e) => {
    const b = e.target.closest("button[data-a]"); if (!b) return;
    const i = +b.dataset.i;
    if (b.dataset.a === "inc") cart[i].qty++;
    if (b.dataset.a === "dec") cart[i].qty--;
    if (b.dataset.a === "rm" || cart[i].qty <= 0) cart.splice(i, 1);
    saveCart();
  });
  const drawer = $("#drawer"), overlay = $("#overlay");
  const openDrawer = (o) => { drawer.classList.toggle("open", o); overlay.classList.toggle("show", o); drawer.setAttribute("aria-hidden", !o); };
  $("#cart-btn").addEventListener("click", () => openDrawer(true));
  $("#drawer-close").addEventListener("click", () => openDrawer(false));
  overlay.addEventListener("click", () => openDrawer(false));
  addEventListener("keydown", (e) => { if (e.key === "Escape") { openDrawer(false); if (modal.classList.contains("show")) closeModal(); } });
  $("#checkout").addEventListener("click", () => {
    if (!cart.length) return toast("YOUR BAG IS EMPTY");
    const lines = cart.map((c) => { const p = D.products.find((x) => x.id === c.id); return `${p.name} (${c.size}) x${c.qty} — ${money(p.price * c.qty)}`; });
    const body = `Hi Dawn Sogni,\n\nI'd like to order:\n\n${lines.join("\n")}\n\nTotal: ${$("#cart-total").textContent}\n\nName:\nAddress:\nPhone:\n`;
    location.href = `mailto:${D.orderEmail}?subject=${encodeURIComponent("Order — Dawn Sogni")}&body=${encodeURIComponent(body)}`;
    $("#checkout-msg").textContent = "Your mail app will open with the order. We'll confirm payment & shipping by reply.";
  });
  renderCart();

  /* ---------------- Forms ---------------- */
  $("#custom-form").addEventListener("submit", (e) => {
    e.preventDefault();
    const f = Object.fromEntries(new FormData(e.target));
    const reqs = store.get("custom", []); reqs.push({ ...f, at: new Date().toISOString() }); store.set("custom", reqs);
    const body = `Name: ${f.name}\nContact: ${f.contact}\nPiece: ${f.piece}\nSize: ${f.size || "-"}\n\nIdea:\n${f.idea}`;
    location.href = `mailto:${D.orderEmail}?subject=${encodeURIComponent("Custom design request — " + f.piece)}&body=${encodeURIComponent(body)}`;
    $("#custom-msg").textContent = "REQUEST READY — SEND IT FROM YOUR MAIL APP. WE'LL GET BACK WITHIN 48H.";
    e.target.reset();
  });
  $("#signup-form").addEventListener("submit", (e) => {
    e.preventDefault();
    const email = e.target.email.value.trim();
    const list = store.get("signups", []); if (!list.includes(email)) list.push(email); store.set("signups", list);
    $("#signup-msg").textContent = "YOU'RE ON THE LIST."; e.target.reset(); toast("WELCOME TO DAWN SOGNI");
  });

  /* ---------------- Reveal on scroll ---------------- */
  const io = new IntersectionObserver((es) => es.forEach((en) => {
    if (en.isIntersecting) { en.target.classList.add("in"); io.unobserve(en.target); }
  }), { threshold: 0.12 });
  $$(".reveal").forEach((el) => io.observe(el));
})();
