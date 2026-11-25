/* DAWN SOGNI — generative chrome visuals in the style of the DS logo.
   Each renderer: (ctx, W, H, t, logo) where t is seconds. */
(() => {
  const TAU = Math.PI * 2;

  // Polished-chrome gradient across a band from (x0,y0) to (x1,y1)
  function chrome(ctx, x0, y0, x1, y1, shift = 0) {
    const g = ctx.createLinearGradient(x0, y0, x1, y1);
    const s = (v) => Math.min(1, Math.max(0, v + shift * 0.1));
    g.addColorStop(0, "#1a1a1d");
    g.addColorStop(s(0.18), "#f6f6f8");
    g.addColorStop(s(0.32), "#5c5c63");
    g.addColorStop(s(0.48), "#0d0d0f");
    g.addColorStop(s(0.62), "#c9c9cf");
    g.addColorStop(s(0.78), "#ffffff");
    g.addColorStop(1, "#2a2a2e");
    return g;
  }

  // Tapered blade — the sharp swept tails of the DS mark
  function blade(ctx, p0, p1, p2, width, shift) {
    const N = 40, left = [], right = [];
    for (let i = 0; i <= N; i++) {
      const s = i / N, u = 1 - s;
      const x = u * u * p0[0] + 2 * u * s * p1[0] + s * s * p2[0];
      const y = u * u * p0[1] + 2 * u * s * p1[1] + s * s * p2[1];
      const dx = 2 * u * (p1[0] - p0[0]) + 2 * s * (p2[0] - p1[0]);
      const dy = 2 * u * (p1[1] - p0[1]) + 2 * s * (p2[1] - p1[1]);
      const len = Math.hypot(dx, dy) || 1;
      // thin at the tip, swelling, then thinning toward the end — like the logo strokes
      const w = width * Math.pow(Math.sin(Math.PI * Math.pow(s, 0.8)), 1.4);
      left.push([x - (dy / len) * w, y + (dx / len) * w]);
      right.push([x + (dy / len) * w, y - (dx / len) * w]);
    }
    ctx.beginPath();
    ctx.moveTo(left[0][0], left[0][1]);
    left.forEach((p) => ctx.lineTo(p[0], p[1]));
    for (let i = right.length - 1; i >= 0; i--) ctx.lineTo(right[i][0], right[i][1]);
    ctx.closePath();
    const midx = (p0[0] + p2[0]) / 2, midy = (p0[1] + p2[1]) / 2;
    ctx.fillStyle = chrome(ctx, midx - width * 1.2, midy - width * 2, midx + width * 1.2, midy + width * 2, shift);
    ctx.fill();
    ctx.strokeStyle = "rgba(255,255,255,0.35)";
    ctx.lineWidth = 0.8;
    ctx.stroke();
  }

  function spotlight(ctx, W, H, x = 0.5, y = 0.4, a = 0.14) {
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, W, H);
    const g = ctx.createRadialGradient(W * x, H * y, 0, W * x, H * y, Math.max(W, H) * 0.7);
    g.addColorStop(0, `rgba(255,255,255,${a})`);
    g.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
  }

  // Logo with a moving light sweep (offscreen so the sweep only hits the chrome)
  const off = document.createElement("canvas"), octx = off.getContext("2d");
  function sweptLogo(ctx, logo, x, y, w, t, alpha = 1) {
    if (!logo || !logo.complete || !logo.naturalWidth) return;
    const h = w * (logo.naturalHeight / logo.naturalWidth);
    off.width = Math.ceil(w); off.height = Math.ceil(h);
    octx.clearRect(0, 0, w, h);
    octx.globalCompositeOperation = "source-over";
    octx.drawImage(logo, 0, 0, w, h);
    octx.globalCompositeOperation = "source-atop";
    const p = ((t * 0.35) % 1.6) - 0.3;
    const g = octx.createLinearGradient(w * (p - 0.15), 0, w * (p + 0.15), h);
    g.addColorStop(0, "rgba(255,255,255,0)");
    g.addColorStop(0.5, "rgba(255,255,255,0.75)");
    g.addColorStop(1, "rgba(255,255,255,0)");
    octx.fillStyle = g;
    octx.fillRect(0, 0, w, h);
    ctx.globalAlpha = alpha;
    ctx.drawImage(off, x - w / 2, y - h / 2);
    ctx.globalAlpha = 1;
    return h;
  }

  const ART = {
    logo(ctx, W, H, t, logo) {
      spotlight(ctx, W, H, 0.5, 0.42, 0.16);
      // faint giant tails behind
      ctx.globalAlpha = 0.35;
      blade(ctx, [-W * 0.1, H * 0.86], [W * 0.5, H * 0.62 + Math.sin(t * 0.6) * 12], [W * 1.1, H * 0.9], H * 0.025, Math.sin(t * 0.5));
      blade(ctx, [W * 1.1, H * 0.12], [W * 0.5, H * 0.3 + Math.cos(t * 0.5) * 12], [-W * 0.1, H * 0.08], H * 0.02, Math.cos(t * 0.4));
      ctx.globalAlpha = 1;
      sweptLogo(ctx, logo, W / 2, H * 0.48 + Math.sin(t * 0.9) * H * 0.012, W * 0.86, t);
    },

    blades(ctx, W, H, t) {
      spotlight(ctx, W, H, 0.3, 0.3, 0.1);
      for (let i = 0; i < 6; i++) {
        const k = i / 5, ph = t * (0.25 + k * 0.12) + i * 1.7;
        const y = H * (0.15 + k * 0.7);
        blade(ctx,
          [-W * 0.2, y + Math.sin(ph) * H * 0.08],
          [W * (0.45 + Math.sin(ph * 0.7) * 0.2), y - H * (0.25 - k * 0.2) + Math.cos(ph) * H * 0.06],
          [W * 1.2, y + Math.cos(ph * 0.8) * H * 0.1],
          H * (0.018 + (i % 3) * 0.012), Math.sin(ph));
      }
    },

    liquid(ctx, W, H, t) {
      spotlight(ctx, W, H, 0.5, 0.2, 0.08);
      for (let i = 0; i < 7; i++) {
        const x = W * (0.5 + Math.sin(t * 0.3 + i * 1.9) * 0.35);
        const y = H * (0.5 + Math.cos(t * 0.25 + i * 2.3) * 0.33);
        const r = Math.min(W, H) * (0.12 + (i % 3) * 0.06);
        const g = ctx.createRadialGradient(x - r * 0.3, y - r * 0.35, r * 0.05, x, y, r);
        g.addColorStop(0, "#ffffff");
        g.addColorStop(0.25, "#9a9aa1");
        g.addColorStop(0.55, "#121214");
        g.addColorStop(0.82, "#d5d5da");
        g.addColorStop(0.92, "#3a3a3f");
        g.addColorStop(1, "rgba(0,0,0,0)");
        ctx.fillStyle = g;
        ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill();
      }
    },

    tee(ctx, W, H, t, logo) {
      spotlight(ctx, W, H, 0.5, 0.35, 0.2);
      const turn = Math.cos(t * 0.6), s = Math.min(W, H) / 240;
      ctx.save();
      ctx.translate(W / 2, H * 0.52);
      ctx.scale(s * (0.55 + 0.45 * Math.abs(turn)), s);
      ctx.translate(-120, -125);
      const p = new Path2D("M70 20 L100 8 Q120 24 140 8 L170 20 L205 58 L178 80 L165 68 L165 230 L75 230 L75 68 L62 80 L35 58 Z");
      const g = ctx.createLinearGradient(0, 0, 240, 0);
      g.addColorStop(0, "#050505"); g.addColorStop(0.5 + turn * 0.3, "#2a2a2e"); g.addColorStop(1, "#050505");
      ctx.fillStyle = g; ctx.fill(p);
      ctx.strokeStyle = "rgba(255,255,255,0.25)"; ctx.lineWidth = 1; ctx.stroke(p);
      if (turn > 0) sweptLogo(ctx, logo, 120, 92, 80, t, Math.min(1, turn * 2));
      ctx.restore();
    },

    flame(ctx, W, H, t) {
      spotlight(ctx, W, H, 0.5, 0.95, 0.18);
      for (let i = 0; i < 9; i++) {
        const k = i / 8, ph = t * 0.7 + i * 0.9;
        const bx = W * (0.05 + k * 0.9);
        blade(ctx,
          [bx + Math.sin(ph) * W * 0.04, H * 1.05],
          [bx + W * (k - 0.5) * 0.5 + Math.sin(ph * 1.3) * W * 0.12, H * (0.6 - Math.sin(k * Math.PI) * 0.15)],
          [W * 0.5 + (k - 0.5) * W * 0.4 + Math.cos(ph) * W * 0.1, H * (0.1 + Math.abs(k - 0.5) * 0.4) + Math.sin(ph * 1.1) * H * 0.04],
          W * (0.025 + Math.sin(k * Math.PI) * 0.03), Math.sin(ph));
      }
    },

    mirror(ctx, W, H, t, logo) {
      spotlight(ctx, W, H, 0.5, 0.3, 0.12);
      const w = W * 0.8, y = H * 0.34;
      const h = sweptLogo(ctx, logo, W / 2, y, w, t) || w / 3;
      // reflection on a dark wet floor
      ctx.save();
      ctx.translate(0, y * 2 + h * 0.62);
      ctx.scale(1, -1);
      sweptLogo(ctx, logo, W / 2, y, w, t + 0.5, 0.28);
      ctx.restore();
      const g = ctx.createLinearGradient(0, H * 0.5, 0, H);
      g.addColorStop(0, "rgba(0,0,0,0)"); g.addColorStop(1, "rgba(0,0,0,0.95)");
      ctx.fillStyle = g; ctx.fillRect(0, H * 0.5, W, H * 0.5);
      ctx.strokeStyle = "rgba(255,255,255,0.08)";
      for (let i = 0; i < 6; i++) {
        const yy = H * 0.62 + i * H * 0.06, wob = Math.sin(t * 1.5 + i) * 6;
        ctx.beginPath(); ctx.ellipse(W / 2, yy, W * (0.3 + i * 0.08) + wob, 4 + i * 2, 0, 0, TAU); ctx.stroke();
      }
    },

    hud(ctx, W, H, t, logo) {
      spotlight(ctx, W, H, 0.5, 0.5, 0.07);
      const cx = W / 2, cy = H / 2, R = Math.min(W, H) * 0.36;
      ctx.strokeStyle = "rgba(230,230,235,0.55)"; ctx.fillStyle = "rgba(230,230,235,0.6)";
      ctx.lineWidth = 1.2;
      [1, 0.72, 0.45].forEach((f) => { ctx.beginPath(); ctx.arc(cx, cy, R * f, 0, TAU); ctx.stroke(); });
      const rot = t * 0.25;
      for (let i = 0; i < 72; i++) {
        const a = rot + (i / 72) * TAU, l = i % 6 === 0 ? 14 : 6;
        ctx.beginPath();
        ctx.moveTo(cx + Math.cos(a) * R, cy + Math.sin(a) * R);
        ctx.lineTo(cx + Math.cos(a) * (R + l), cy + Math.sin(a) * (R + l));
        ctx.stroke();
      }
      ctx.beginPath(); ctx.moveTo(cx, cy);
      ctx.lineTo(cx + Math.cos(-rot * 2) * R * 0.72, cy + Math.sin(-rot * 2) * R * 0.72); ctx.stroke();
      ctx.font = `${Math.round(R * 0.11)}px "Barlow Condensed", sans-serif`;
      ctx.fillText(`${(-27 + Math.sin(t * 0.4) * 9).toFixed(0)}°`, W * 0.06, H * 0.9);
      ctx.textAlign = "right";
      ctx.fillText(`${(263.1 + t * 3.2 % 96).toFixed(1)}°`, W * 0.94, H * 0.9);
      ctx.textAlign = "left";
      sweptLogo(ctx, logo, cx, cy, R * 0.8, t);
    }
  };

  window.DS_ART = ART;
})();
