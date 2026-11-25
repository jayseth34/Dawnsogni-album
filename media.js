/* Dawn Sogni — in-browser media processing for the admin (ffmpeg.wasm, self-hosted in /vendor/ffmpeg).
   DSMedia.video(file, onProgress)        -> compressed 720p MP4 (or the original if already small)
   DSMedia.extractAudio(file, onProgress) -> M4A audio track from a video
   DSMedia.audio(file, onProgress)        -> compact M4A (or the original if already compact)
   DSMedia.image(file)                    -> resized JPEG (max 1500px) (or the original if already small) */
(() => {
  const MB = 1024 * 1024;
  const abs = (p) => new URL(p, location.href).href;
  let ff = null, loading = null, chain = Promise.resolve();

  function loadScript(src) {
    return new Promise((ok, no) => { const s = document.createElement("script"); s.src = src; s.onload = ok; s.onerror = () => no(new Error("Couldn't load " + src)); document.head.append(s); });
  }
  async function engine(onProgress) {
    if (ff) return ff;
    loading ||= (async () => {
      onProgress && onProgress(0, "Loading the media engine (first time only)…");
      if (!window.FFmpegWASM) await loadScript(abs("vendor/ffmpeg/ffmpeg.js"));
      const f = new FFmpegWASM.FFmpeg();
      await f.load({ coreURL: abs("vendor/ffmpeg/ffmpeg-core.js"), wasmURL: abs("vendor/ffmpeg/ffmpeg-core.wasm") });
      ff = f; return f;
    })();
    return loading;
  }
  // run jobs one at a time on the single engine
  const queue = (job) => (chain = chain.then(job, job));

  async function run(file, outName, argSets, onProgress, label) {
    return queue(async () => {
      const f = await engine(onProgress);
      const inName = "in." + ((file.name.match(/\.([a-z0-9]+)$/i) || [, "bin"])[1].toLowerCase());
      await f.writeFile(inName, new Uint8Array(await file.arrayBuffer()));
      const prog = ({ progress }) => onProgress && onProgress(Math.max(0, Math.min(1, progress || 0)), label);
      f.on("progress", prog);
      let ok = false;
      try {
        for (const args of argSets) {
          const code = await f.exec(["-y", "-i", inName, ...args, outName]);
          if (code === 0) { ok = true; break; }
        }
      } finally { f.off("progress", prog); }
      try { await f.deleteFile(inName); } catch {}
      if (!ok) throw new Error("Couldn't process " + file.name);
      const data = await f.readFile(outName);
      try { await f.deleteFile(outName); } catch {}
      return data;
    });
  }

  function videoInfo(file) {
    return new Promise((ok) => {
      const v = document.createElement("video"), url = URL.createObjectURL(file);
      v.preload = "metadata"; v.muted = true;
      v.onloadedmetadata = () => { ok({ w: v.videoWidth, h: v.videoHeight, d: v.duration }); URL.revokeObjectURL(url); };
      v.onerror = () => { ok({ w: 0, h: 0, d: 0 }); URL.revokeObjectURL(url); };
      v.src = url;
    });
  }
  const base = (name) => name.replace(/\.[^.]+$/, "");

  async function video(file, onProgress) {
    const { w, h } = await videoInfo(file);
    const short = Math.min(w || 9999, h || 9999);
    if (file.size <= 25 * MB && short <= 720 && /mp4/i.test(file.type)) return file;
    const scale = !w || !h ? "scale=-2:720" : w >= h ? (h > 720 ? "scale=-2:720" : "scale=-2:-2") : (w > 720 ? "scale=720:-2" : "scale=-2:-2");
    const common = ["-vf", scale, "-c:v", "libx264", "-preset", "ultrafast", "-crf", "28", "-pix_fmt", "yuv420p", "-movflags", "+faststart"];
    const data = await run(file, "out.mp4", [
      [...common, "-c:a", "aac", "-b:a", "128k"],
      [...common, "-an"]
    ], onProgress, "Compressing video");
    const out = new File([data], base(file.name) + ".mp4", { type: "video/mp4" });
    return out.size < file.size ? out : file;
  }

  async function extractAudio(file, onProgress) {
    const data = await run(file, "out.m4a", [
      ["-vn", "-c:a", "copy"],                       // instant when the video already has AAC audio
      ["-vn", "-c:a", "aac", "-b:a", "192k"]
    ], onProgress, "Extracting audio");
    return new File([data], base(file.name) + ".m4a", { type: "audio/mp4" });
  }

  async function audio(file, onProgress) {
    const lossless = /wav|flac|aiff|x-aiff/i.test(file.type) || /\.(wav|flac|aiff?)$/i.test(file.name);
    if (!lossless && file.size <= 15 * MB) return file;
    const data = await run(file, "out.m4a", [["-vn", "-c:a", "aac", "-b:a", "192k"]], onProgress, "Compressing audio");
    const out = new File([data], base(file.name) + ".m4a", { type: "audio/mp4" });
    return out.size < file.size ? out : file;
  }

  async function image(file) {
    if (/gif|svg/i.test(file.type)) return file;
    const img = await new Promise((ok, no) => { const i = new Image(); i.onload = () => ok(i); i.onerror = no; i.src = URL.createObjectURL(file); });
    const max = Math.max(img.naturalWidth, img.naturalHeight);
    if (file.size <= 1 * MB && max <= 1600) return file;
    const k = Math.min(1, 1500 / max), c = document.createElement("canvas");
    c.width = Math.round(img.naturalWidth * k); c.height = Math.round(img.naturalHeight * k);
    c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
    const blob = await new Promise((ok) => c.toBlob(ok, "image/jpeg", 0.88));
    const out = new File([blob], base(file.name) + ".jpg", { type: "image/jpeg" });
    return out.size < file.size ? out : file;
  }

  const isVideo = (f) => /^video\//.test(f.type) || /\.(mp4|mov|m4v|webm|mkv|avi)$/i.test(f.name);
  const isAudio = (f) => /^audio\//.test(f.type) || /\.(mp3|m4a|aac|wav|flac|aiff?|ogg|opus)$/i.test(f.name);
  window.DSMedia = { video, extractAudio, audio, image, isVideo, isAudio, engine };
})();
