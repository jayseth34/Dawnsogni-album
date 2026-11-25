/* Dawn Sogni — cinematic cover renderer (used by the admin Cover Maker).
   DSCover.render(canvas, { style, title, line, color, accent, subject, seed })
   style: "spotlight" | "glow" | "studio"   subject: loaded <img> (transparent PNG works best) */
(() => {
  const FONT_FACES = [
    ["DS Anton", "assets/fonts/anton.woff2"],
    ["DS Script", "assets/fonts/pinyon-script.woff2"]
  ];
  let fontsReady = null;
  function loadFonts() {
    if (fontsReady) return fontsReady;
    fontsReady = Promise.all(FONT_FACES.map(async ([name, url]) => {
      try { const f = new FontFace(name, `url(${url})`); await f.load(); document.fonts.add(f); } catch {}
    }));
    return fontsReady;
  }

  const hex = (h) => { h = (h || "#000").replace("#", ""); if (h.length === 3) h = h.split("").map((c) => c + c).join(""); const n = parseInt(h, 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
  const rgba = (c, a = 1) => `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${a})`;
  const mix = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);
  const shade = (c, k) => c.map((v) => Math.max(0, Math.min(255, v * k)));
  function rng(seed) { let s = (seed >>> 0) || 1; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); }

  function fog(ctx, W, H, rnd, col, n, yMin, yMax, aMax) {
    ctx.save(); ctx.globalCompositeOperation = "screen";
    for (let i = 0; i < n; i++) {
      const x = rnd() * W, y = yMin * H + rnd() * (yMax - yMin) * H, r = (0.12 + rnd() * 0.3) * W;
      const g = ctx.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0, rgba(col, aMax * (0.4 + rnd() * 0.6))); g.addColorStop(1, rgba(col, 0));
      ctx.fillStyle = g; ctx.fillRect(x - r, y - r, r * 2, r * 2);
    }
    ctx.restore();
  }
  // soft volumetric light cone: many faint, widening layers so there is no banding
  function beam(ctx, x, y, angle, len, width, col, a) {
    ctx.save(); ctx.globalCompositeOperation = "screen"; ctx.translate(x, y); ctx.rotate(angle);
    const N = 28;
    for (let i = 0; i < N; i++) {
      const spread = (width / len) * (0.15 + (i / N) * 1.1);
      const g = ctx.createLinearGradient(0, 0, len, 0);
      g.addColorStop(0, rgba(col, (a / N) * 2.2)); g.addColorStop(0.55, rgba(col, (a / N) * 0.9)); g.addColorStop(1, rgba(col, 0));
      ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(len, -len * spread * 0.5); ctx.lineTo(len, len * spread * 0.5); ctx.closePath(); ctx.fill();
    }
    ctx.restore();
  }
  function grain(ctx, W, H, amt, rnd) {
    const n = document.createElement("canvas"); n.width = n.height = 256;
    const g = n.getContext("2d"), d = g.createImageData(256, 256);
    for (let i = 0; i < d.data.length; i += 4) { const v = rnd() * 255; d.data[i] = d.data[i + 1] = d.data[i + 2] = v; d.data[i + 3] = 255; }
    g.putImageData(d, 0, 0);
    ctx.save(); ctx.globalAlpha = amt; ctx.globalCompositeOperation = "overlay";
    ctx.fillStyle = ctx.createPattern(n, "repeat"); ctx.fillRect(0, 0, W, H); ctx.restore();
  }
  function vignette(ctx, W, H, a) {
    const g = ctx.createRadialGradient(W / 2, H * 0.48, W * 0.25, W / 2, H / 2, W * 0.78);
    g.addColorStop(0, "rgba(0,0,0,0)"); g.addColorStop(1, `rgba(0,0,0,${a})`);
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  }
  function fitFont(ctx, text, family, maxW, maxH) {
    let s = maxH; ctx.font = `${s}px "${family}"`;
    const w = ctx.measureText(text).width; if (w > maxW) s = s * (maxW / w);
    return s;
  }
  // Subject standing on the floor at baseY, with contact shadow and optional reflection
  function subject(ctx, img, cx, baseY, maxW, maxH, { reflect = 0.25, shadow = 0.6, shadowDX = 0 } = {}) {
    if (!img || !img.naturalWidth) return;
    let w = maxW, h = w * (img.naturalHeight / img.naturalWidth);
    if (h > maxH) { h = maxH; w = h * (img.naturalWidth / img.naturalHeight); }
    const x = cx - w / 2, y = baseY - h;
    ctx.save();
    const sg = ctx.createRadialGradient(cx + shadowDX, baseY, 0, cx + shadowDX, baseY, w * 0.6);
    sg.addColorStop(0, `rgba(0,0,0,${shadow})`); sg.addColorStop(1, "rgba(0,0,0,0)");
    ctx.translate(0, baseY); ctx.scale(1, 0.12); ctx.fillStyle = sg; ctx.fillRect(cx + shadowDX - w, -w, w * 2, w * 2);
    ctx.restore();
    if (reflect) {
      const off = document.createElement("canvas"); off.width = Math.ceil(w); off.height = Math.ceil(h);
      const o = off.getContext("2d");
      o.translate(0, h); o.scale(1, -1); o.drawImage(img, 0, 0, w, h);
      o.setTransform(1, 0, 0, 1, 0, 0); o.globalCompositeOperation = "destination-in";
      const fg = o.createLinearGradient(0, 0, 0, h * 0.6); fg.addColorStop(0, `rgba(0,0,0,${reflect})`); fg.addColorStop(1, "rgba(0,0,0,0)");
      o.fillStyle = fg; o.fillRect(0, 0, w, h);
      ctx.drawImage(off, x, baseY + 2);
    }
    ctx.save(); ctx.shadowColor = "rgba(0,0,0,0.55)"; ctx.shadowBlur = w * 0.06; ctx.shadowOffsetY = w * 0.015;
    ctx.drawImage(img, x, y, w, h); ctx.restore();
  }
  function words(title) {
    const t = (title || "").trim().toUpperCase().split(/\s+/).filter(Boolean);
    if (t.length <= 1) return { big: t[0] || "", small: "" };
    // the longest word goes big behind, the rest is spaced across
    let bi = 0; t.forEach((w, i) => { if (w.replace(/[^A-Z0-9]/g, "").length >= t[bi].replace(/[^A-Z0-9]/g, "").length) bi = i; });
    return { big: t[bi], small: t.filter((_, i) => i !== bi).join(" ") };
  }

  const STYLES = {
    spotlight(ctx, W, H, o, rnd) {
      const c = hex(o.color || "#1f5a3c"), a = hex(o.accent || "#e6d27a");
      const floorY = H * 0.74;
      // backdrop
      let g = ctx.createLinearGradient(0, 0, 0, H);
      g.addColorStop(0, rgba(shade(c, 0.32))); g.addColorStop(0.7, rgba(shade(c, 0.5))); g.addColorStop(1, rgba(shade(c, 0.22)));
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
      fog(ctx, W, H, rnd, shade(c, 1.1), 26, 0.05, 0.8, 0.22);
      // giant word
      const { big, small } = words(o.title);
      const bigSize = fitFont(ctx, big, "DS Anton", W * 0.88, H * 0.66);
      ctx.save(); ctx.font = `${bigSize}px "DS Anton"`; ctx.textAlign = "center"; ctx.textBaseline = "alphabetic";
      g = ctx.createLinearGradient(0, floorY - bigSize, W, floorY);
      g.addColorStop(0, rgba(mix(c, [255, 255, 255], 0.45), 0.85)); g.addColorStop(0.55, rgba(mix(c, [255, 255, 255], 0.18), 0.7)); g.addColorStop(1, rgba(shade(c, 0.7), 0.6));
      ctx.fillStyle = g; ctx.fillText(big, W / 2, floorY + bigSize * 0.02); ctx.restore();
      // floor
      g = ctx.createLinearGradient(0, floorY, 0, H);
      g.addColorStop(0, rgba(shade(c, 0.55))); g.addColorStop(1, rgba(shade(c, 0.18)));
      ctx.fillStyle = g; ctx.fillRect(0, floorY, W, H - floorY);
      ctx.save(); ctx.globalCompositeOperation = "screen";
      const fl = ctx.createRadialGradient(W * 0.38, floorY + H * 0.06, 0, W * 0.38, floorY + H * 0.06, W * 0.55);
      fl.addColorStop(0, rgba(a, 0.35)); fl.addColorStop(1, rgba(a, 0));
      ctx.translate(0, floorY); ctx.scale(1, 0.35); ctx.translate(0, -floorY); ctx.fillStyle = fl; ctx.fillRect(0, floorY - H, W, H * 2); ctx.restore();
      // light beam from top-left
      beam(ctx, -W * 0.04, -H * 0.06, Math.PI * 0.26, W * 1.3, W * 0.55, a, 0.6);
      fog(ctx, W, H, rnd, mix(c, [255, 255, 255], 0.3), 18, 0.62, 1, 0.16);
      // subject
      subject(ctx, o.subject, W * 0.5, floorY + H * 0.05, W * (o.subjectIsLogo ? 0.62 : 0.5), H * 0.5, { reflect: 0.3, shadowDX: W * 0.06 });
      // spaced word across
      const sm = small || o.line || "";
      if (sm) {
        const letters = sm.replace(/\s+/g, " ").split("");
        const size = Math.min(H * 0.1, (W * 0.8) / Math.max(1, letters.length) * 1.6);
        ctx.save(); ctx.font = `${size}px "DS Anton"`; ctx.fillStyle = "#fff"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
        ctx.shadowColor = "rgba(0,0,0,0.5)"; ctx.shadowBlur = size * 0.3;
        const x0 = W * 0.13, x1 = W * 0.87;
        letters.forEach((ch, i) => ctx.fillText(ch, letters.length === 1 ? W / 2 : x0 + ((x1 - x0) * i) / (letters.length - 1), H * 0.45));
        ctx.restore();
      }
      vignette(ctx, W, H, 0.75); grain(ctx, W, H, 0.16, rnd);
    },

    glow(ctx, W, H, o, rnd) {
      const c = hex(o.color || "#1d3b2a"), a = hex(o.accent || "#d4552b");
      ctx.fillStyle = rgba(shade(c, 0.75)); ctx.fillRect(0, 0, W, H);
      fog(ctx, W, H, rnd, shade(c, 1.2), 40, 0, 1, 0.18);
      ctx.save(); ctx.globalCompositeOperation = "screen";
      for (let i = 0; i < 3; i++) {
        const g = ctx.createRadialGradient(W * 0.5, H * 0.36, 0, W * 0.5, H * 0.36, W * (0.32 + i * 0.12));
        g.addColorStop(0, rgba(a, 0.55 - i * 0.12)); g.addColorStop(1, rgba(a, 0));
        ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
      }
      ctx.restore();
      fog(ctx, W, H, rnd, mix(a, c, 0.5), 22, 0.1, 0.7, 0.1);
      subject(ctx, o.subject, W * 0.5, H * 0.76, W * (o.subjectIsLogo ? 0.72 : 0.56), H * 0.6, { reflect: 0, shadow: 0.55, shadowDX: W * 0.08 });
      // dot-matrix title
      const t = (o.title || "").toUpperCase();
      if (t) {
        const off = document.createElement("canvas"), oc = off.getContext("2d");
        const size = fitFont(oc, t, "DS Anton", W * 0.9, H * 0.16);
        off.width = W; off.height = Math.ceil(size * 1.3);
        oc.font = `${size}px "DS Anton"`; oc.textAlign = "center"; oc.textBaseline = "middle"; oc.fillStyle = "#fff";
        oc.fillText(t, W / 2, off.height / 2);
        const d = oc.getImageData(0, 0, off.width, off.height).data, step = Math.max(5, Math.round(W / 175)), y0 = H * 0.9 - off.height / 2;
        ctx.save(); ctx.fillStyle = "#f4f1ea"; ctx.shadowColor = "rgba(255,255,255,0.45)"; ctx.shadowBlur = step * 0.8;
        for (let y = step / 2; y < off.height; y += step) for (let x = step / 2; x < W; x += step) {
          if (d[((y | 0) * off.width + (x | 0)) * 4 + 3] > 120) { ctx.beginPath(); ctx.arc(x, y0 + y, step * 0.34, 0, Math.PI * 2); ctx.fill(); }
        }
        ctx.restore();
      }
      if (o.line) { ctx.save(); ctx.font = `${W * 0.026}px "DS Anton"`; ctx.fillStyle = "rgba(255,255,255,0.75)"; ctx.textAlign = "center"; ctx.fillText(o.line.toUpperCase().split("").join(" "), W / 2, H * 0.09); ctx.restore(); }
      vignette(ctx, W, H, 0.55); grain(ctx, W, H, 0.2, rnd);
    },

    studio(ctx, W, H, o, rnd) {
      const c = hex(o.color || "#b0121b"), a = hex(o.accent || "#d978d6");
      const floorY = H * 0.6;
      let g = ctx.createLinearGradient(0, 0, 0, H);
      g.addColorStop(0, rgba(shade(c, 0.28))); g.addColorStop(0.55, rgba(shade(c, 0.7))); g.addColorStop(1, rgba(shade(c, 0.95)));
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
      // seamless paper sweep + key light
      ctx.save(); ctx.globalCompositeOperation = "screen";
      g = ctx.createRadialGradient(W * 0.48, H * 0.78, 0, W * 0.48, H * 0.78, W * 0.62);
      g.addColorStop(0, rgba(mix(c, [255, 255, 255], 0.12), 0.55)); g.addColorStop(1, rgba(c, 0));
      ctx.translate(W * 0.48, H * 0.78); ctx.scale(1.35, 0.55); ctx.translate(-W * 0.48, -H * 0.78); ctx.fillStyle = g; ctx.fillRect(-W, 0, W * 3, H * 2); ctx.restore();
      ctx.save(); ctx.globalCompositeOperation = "multiply";
      g = ctx.createLinearGradient(0, floorY - H * 0.12, 0, floorY + H * 0.1);
      g.addColorStop(0, "rgba(0,0,0,0)"); g.addColorStop(0.5, "rgba(0,0,0,0.18)"); g.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = g; ctx.fillRect(0, floorY - H * 0.12, W, H * 0.22); ctx.restore();
      subject(ctx, o.subject, W * 0.5, H * 0.66, W * (o.subjectIsLogo ? 0.56 : 0.36), H * 0.36, { reflect: 0, shadow: 0.7, shadowDX: W * 0.1 });
      // script title
      const t = o.title || "";
      if (t) {
        const ws = t.split(/\s+/), lines = ws.length > 1 ? [ws.slice(0, Math.ceil(ws.length / 2)).join(" "), ws.slice(Math.ceil(ws.length / 2)).join(" ")] : [t];
        ctx.save(); ctx.textAlign = "center"; ctx.textBaseline = "alphabetic"; ctx.fillStyle = rgba(a);
        ctx.shadowColor = rgba(a, 0.35); ctx.shadowBlur = W * 0.01;
        const size = Math.min(...lines.map((l) => fitFont(ctx, l, "DS Script", W * 0.46, H * 0.13)));
        ctx.font = `${size}px "DS Script"`;
        lines.forEach((l, i) => ctx.fillText(l, W / 2 + (lines.length > 1 ? (i ? W * 0.05 : -W * 0.04) : 0), H * 0.22 + i * size * 0.85));
        ctx.restore();
      }
      vignette(ctx, W, H, 0.65); grain(ctx, W, H, 0.14, rnd);
    }
  };

  async function render(canvas, o = {}) {
    await loadFonts();
    const W = canvas.width, H = canvas.height, ctx = canvas.getContext("2d");
    ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = 1; ctx.globalCompositeOperation = "source-over";
    ctx.clearRect(0, 0, W, H);
    (STYLES[o.style] || STYLES.spotlight)(ctx, W, H, o, rng(o.seed || 7));
  }
  window.DSCover = { render, loadFonts, styles: Object.keys(STYLES) };
})();
