/* BizConnect AI Studio — shared app core (auth, wallet, pricing, generation, output rendering, Allie). */
(function () {
  "use strict";
  const API = "https://bizconnect-ai-studio.virtualecommerceinc.workers.dev";
  const LS = { token: "bcai_token", user: "bcai_user", ref: "bcai_ref" };
  const $ = (s, r = document) => r.querySelector(s);
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const svg = (paths, cls = "") => `<svg class="${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths}</svg>`;
  const store = {
    get(k) { try { return localStorage.getItem(k); } catch { return null; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch {} },
    del(k) { try { localStorage.removeItem(k); } catch {} },
  };
  const ref = new URLSearchParams(location.search).get("ref");
  if (ref) store.set(LS.ref, ref);

  // ---------------- API ----------------
  let catalog = null;
  let user = null;
  try { user = JSON.parse(store.get(LS.user) || "null"); } catch {}

  async function api(path, body) {
    const headers = { "Content-Type": "application/json" };
    const t = store.get(LS.token);
    if (t) headers.Authorization = `Bearer ${t}`;
    const r = await fetch(API + path, { method: body ? "POST" : "GET", headers, body: body ? JSON.stringify(body) : undefined });
    const data = await r.json().catch(() => ({ error: "Unexpected response from the studio." }));
    if (r.status === 401 && data.signin) { signOut(false); gate(); }
    if (!r.ok) { const e = new Error(data.error || `Request failed (${r.status})`); e.data = data; e.status = r.status; throw e; }
    return data;
  }
  async function loadCatalog() {
    if (!catalog) catalog = await api("/api/catalog");
    return catalog;
  }
  function setUser(u) {
    user = u;
    store.set(LS.user, JSON.stringify(u));
    document.querySelectorAll("[data-credits]").forEach((el) => (el.textContent = Number(u.credits).toLocaleString()));
    document.querySelectorAll("[data-initial]").forEach((el) => (el.textContent = (u.name || u.handle).slice(0, 2).toUpperCase()));
  }
  function setCredits(c) { if (user && typeof c === "number") setUser({ ...user, credits: c }); }
  async function refreshMe() {
    if (!store.get(LS.token)) return null;
    const d = await api("/api/me");
    setUser(d.user);
    return d;
  }
  function signOut(reload = true) {
    store.del(LS.token); store.del(LS.user); user = null;
    if (reload) location.reload();
  }

  // ---------------- pricing (mirrors the Worker's estimate) ----------------
  function engineFor(studio, id) {
    const list = catalog?.studios?.[studio] || [];
    return list.find((e) => e.id === id) || list[0];
  }
  function estimateUsd(studio, eng, o = {}, prompt = "") {
    if (!eng) return 0;
    const text = String(prompt || "");
    switch (eng.unit) {
      case "tokens": {
        const inTok = text.length / 3.5 + 400;
        const outTok = { deck: 2200, outreach: 1800, brand: 1500, translate: Math.max(300, text.length / 3) }[studio] || 900;
        return (inTok * eng.inPerM + outTok * eng.outPerM) / 1e6 + (eng.extraUsd || 0);
      }
      case "image": return eng.usd * Math.min(4, Math.max(1, Number(o.count) || 1));
      case "second": {
        if (studio === "avatar") {
          const secs = Math.max(3, Math.ceil(Math.max(text.length, 40) / 14));
          return secs * eng.usd + (Math.max(text.length, 40) / 1000) * (o.voiceEngine === "elevenlabs" ? 0.1 : 0.02);
        }
        const d = Number(o.duration) || eng.durations[0];
        return d * (o.audio === false && eng.usdSilent ? eng.usdSilent : eng.usd);
      }
      case "kchar": return Math.max(0.001, (Math.max(text.length, 20) / 1000) * eng.usd);
      case "gen": return eng.usd;
      default: return 0.01;
    }
  }
  function credits(studio, engId, o, prompt) {
    const eng = engineFor(studio, engId);
    if (!eng || !catalog) return 0;
    return Math.max(1, Math.ceil((estimateUsd(studio, eng, o, prompt) * catalog.markup) / catalog.creditUsd - 1e-9));
  }
  const dollars = (cr) => `$${(cr * (catalog?.creditUsd || 0.01)).toFixed(2)}`;
  function unitLabel(studio, eng) {
    const c = (o, p) => credits(studio, eng.id, o, p);
    switch (eng.unit) {
      case "tokens": return `~${c({}, "x".repeat(200))} cr / reply`;
      case "image": return `${c({ count: 1 })} cr / image`;
      case "second": return studio === "avatar" ? `~${c({}, "x".repeat(140))} cr / 10 sec` : `${c({ duration: eng.durations[0] })} cr / ${eng.durations[0]}s clip`;
      case "kchar": return `~${c({}, "x".repeat(750))} cr / minute`;
      case "gen": return `${c({})} cr / track`;
    }
    return "";
  }
  function fromPrice(studio) {
    const list = catalog?.studios?.[studio] || [];
    if (!list.length) return "";
    const eng = list.reduce((a, b) => (credits(studio, a.id, { duration: a.durations?.[0] }, "x".repeat(200)) <= credits(studio, b.id, { duration: b.durations?.[0] }, "x".repeat(200)) ? a : b));
    return `From ${unitLabel(studio, eng)}`;
  }

  // ---------------- generation ----------------
  async function generate({ studio, engine, prompt, options = {} }, onProgress = () => {}) {
    const r = await api("/api/generate", { studio, engine, prompt, options });
    setCredits(r.credits);
    if (r.item) return r.item;
    const started = Date.now();
    onProgress({ status: "IN_QUEUE", elapsed: 0 });
    for (;;) {
      await new Promise((res) => setTimeout(res, 4000));
      const s = await api(`/api/job/${r.jobId}`);
      if (s.status === "COMPLETED") { setCredits(s.credits); return s.item; }
      if (s.status === "FAILED") { setCredits(s.credits); const e = new Error(s.error || "The render failed."); throw e; }
      onProgress({ status: s.status, position: s.position, elapsed: Math.round((Date.now() - started) / 1000) });
      if (Date.now() - started > 12 * 60 * 1000) throw new Error("This is taking longer than usual. It will appear in your history when it finishes.");
    }
  }
  function progressHTML(label, p) {
    const msg = !p ? "Starting…" : p.status === "IN_QUEUE" ? `In line${p.position ? ` (position ${p.position + 1})` : ""}…` : `Rendering… ${p.elapsed || 0}s`;
    return `<div class="progress"><div class="spinner"></div><div><b>${esc(label)}</b><small>${esc(msg)}</small></div></div>`;
  }
  async function toDataUrl(file, maxSide = 1600) {
    const img = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = URL.createObjectURL(file); });
    const scale = Math.min(1, maxSide / Math.max(img.width, img.height));
    const c = document.createElement("canvas");
    c.width = Math.round(img.width * scale); c.height = Math.round(img.height * scale);
    c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
    return c.toDataURL("image/jpeg", 0.9);
  }
  async function upload(file) { return (await api("/api/upload", { dataUrl: await toDataUrl(file) })).url; }

  // ---------------- output rendering: every result gets simple Copy / Save / Share tools ----------------
  function md(text) {
    let h = esc(text);
    h = h.replace(/^### (.*)$/gm, "<h3>$1</h3>").replace(/^## (.*)$/gm, "<h2>$1</h2>").replace(/^# (.*)$/gm, "<h1>$1</h1>");
    h = h.replace(/\*\*(.+?)\*\*/g, "<b>$1</b>").replace(/(^|[^*])\*(?!\s)(.+?)\*/g, "$1<i>$2</i>");
    return h;
  }
  // Clean text for pasting into emails, posts and documents: no markdown symbols (hashtags are kept).
  function plain(text) {
    return String(text || "")
      .replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, "$1 ($2)")
      .replace(/^\s*([-*_])\1{2,}\s*$/gm, "")
      .replace(/^#{1,6}\s+/gm, "")
      .replace(/\*\*(.+?)\*\*/g, "$1").replace(/__(.+?)__/g, "$1")
      .replace(/(^|[^*\w])\*(?!\s)(.+?)\*/g, "$1$2").replace(/(^|\W)_(?!\s)(.+?)_(?=\W|$)/g, "$1$2")
      .replace(/`([^`]+)`/g, "$1")
      .replace(/^(\s*)[-*+]\s+/gm, "$1• ")
      .replace(/\n{3,}/g, "\n\n").trim();
  }
  const ICO = {
    copy: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V6a2 2 0 0 1 2-2h9"/></svg>',
    down: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 4v11M7 10l5 5 5-5M5 20h14"/></svg>',
    doc: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8Z"/><path d="M14 3v5h5M9 13h6M9 17h6"/></svg>',
    share: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="18" cy="5" r="2.5"/><circle cx="6" cy="12" r="2.5"/><circle cx="18" cy="19" r="2.5"/><path d="m8.2 10.8 7.6-4.4M8.2 13.2l7.6 4.4"/></svg>',
    phone: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="7" y="2" width="10" height="20" rx="2"/><path d="M12 8v6M9.5 11.5 12 14l2.5-2.5M11 18h2"/></svg>',
    link: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1"/><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/></svg>',
    wand: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m4 20 11-11M14 4v3M18 8h3M17 3l-1.5 1.5M19.5 5.5 21 4"/></svg>',
    ok: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m5 12 5 5 9-10"/></svg>',
  };
  const TOUCH = window.matchMedia?.("(pointer:coarse)").matches;
  const IOS = /iP(hone|ad|od)/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  const SHARE_FILES = (() => { try { return !!(navigator.share && navigator.canShare && navigator.canShare({ files: [new File(["x"], "x.txt", { type: "text/plain" })] })); } catch { return false; } })();
  const PHONE_SAVE = SHARE_FILES && TOUCH; // phones/tablets: "Save to phone" opens the share sheet (→ Save Image / Save Video)
  const COPIED = "Copied! Now paste it anywhere";
  const liveRegion = document.createElement("div");
  liveRegion.className = "sr-only"; liveRegion.setAttribute("aria-live", "polite");
  document.body.appendChild(liveRegion);
  function announce(msg) { liveRegion.textContent = ""; setTimeout(() => (liveRegion.textContent = msg), 30); }

  function flash(btn, label, ok = true) {
    announce(label);
    if (!btn) return;
    clearTimeout(btn._t);
    if (btn.classList.contains("tool")) {
      if (!btn._orig) btn._orig = btn.innerHTML;
      btn.classList.toggle("ok", ok); btn.classList.toggle("warn", !ok);
      btn.innerHTML = `${ok ? ICO.ok : ""}<span>${esc(label)}</span>`;
      btn._t = setTimeout(() => { btn.classList.remove("ok", "warn"); btn.innerHTML = btn._orig; }, 3000);
    } else if (btn.classList.contains("sw")) {
      if (ok) { btn.classList.add("ok"); btn._t = setTimeout(() => btn.classList.remove("ok"), 3000); }
    } else if (btn.tagName === "BUTTON") {
      if (btn._origText == null) btn._origText = btn.textContent;
      btn.textContent = ok ? `✓ ${label}` : label;
      btn._t = setTimeout(() => (btn.textContent = btn._origText), 3000);
    }
  }
  async function writeClipboard(t) {
    try { await navigator.clipboard.writeText(t); return true; } catch {}
    try { // fallback for older browsers
      const ta = document.createElement("textarea");
      ta.value = t; ta.setAttribute("readonly", ""); ta.style.cssText = "position:fixed;left:-9999px;top:0;opacity:0";
      document.body.appendChild(ta); ta.select();
      const ok = document.execCommand("copy"); ta.remove(); return ok;
    } catch { return false; }
  }
  // Copy text. If the browser refuses, select the text on screen so Ctrl/Cmd+C still works.
  async function copyText(t, btn, label = COPIED, selectEl) {
    const ok = await writeClipboard(t);
    if (ok) return flash(btn, label, true);
    if (selectEl) { const r = document.createRange(); r.selectNodeContents(selectEl); const s = getSelection(); s.removeAllRanges(); s.addRange(r); }
    flash(btn, /Mac|iP/.test(navigator.platform) ? "Text selected: press Cmd+C" : "Text selected: press Ctrl+C", false);
  }
  async function copyImage(url, btn) {
    try {
      if (!window.ClipboardItem || !navigator.clipboard?.write) throw new Error("no image clipboard");
      const png = fetch(url).then((r) => { if (!r.ok) throw new Error(); return r.blob(); }).then((b) => b.type === "image/png" ? b : new Promise((res, rej) => {
        const img = new Image(); const src = URL.createObjectURL(b);
        img.onload = () => { const c = document.createElement("canvas"); c.width = img.naturalWidth; c.height = img.naturalHeight; c.getContext("2d").drawImage(img, 0, 0); URL.revokeObjectURL(src); c.toBlob((x) => (x ? res(x) : rej(new Error())), "image/png"); };
        img.onerror = () => { URL.revokeObjectURL(src); rej(new Error()); };
        img.src = src;
      }));
      await navigator.clipboard.write([new ClipboardItem({ "image/png": png })]);
      flash(btn, "Picture copied! Paste it anywhere");
    } catch {
      flash(btn, PHONE_SAVE ? "Can't copy pictures here. Use Save" : "Couldn't copy the picture. Use Download", false);
    }
  }
  const extFor = (type, fallback) => ({ "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp", "video/mp4": "mp4", "audio/wav": "wav", "audio/x-wav": "wav", "audio/mpeg": "mp3", "audio/mp4": "m4a" }[type] || fallback);
  function download(url, name, btn) {
    flash(btn, "Downloading…");
    fetch(url).then((r) => { if (!r.ok) throw new Error(); return r.blob(); }).then((b) => {
      const n = name.replace(/\.\w+$/, "") + "." + extFor(b.type, (name.match(/\.(\w+)$/) || [, "bin"])[1]);
      const a = document.createElement("a"); a.href = URL.createObjectURL(b); a.download = n; document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 4000);
    }).catch(() => {
      const a = document.createElement("a"); a.href = url; a.target = "_blank"; a.rel = "noopener"; document.body.appendChild(a); a.click(); a.remove();
      flash(btn, TOUCH ? "Opened: long-press it to save" : "Opened: right-click it to save", false);
    });
  }
  // Pre-fetch files so "Save to phone" / "Share" can open the share sheet instantly (Safari needs that).
  const fileCache = new Map();
  function prepFile(url, name, type) {
    if (!fileCache.has(url)) {
      const p = fetch(url).then((r) => { if (!r.ok) throw new Error(); return r.blob(); })
        .then((b) => new File([b], name.replace(/\.\w+$/, "") + "." + extFor(b.type, name.split(".").pop()), { type: b.type || type }))
        .then((f) => (p.file = f)).catch(() => null);
      fileCache.set(url, p);
    }
    return fileCache.get(url);
  }
  function shareFiles(urls, names, type, btn) {
    const ps = urls.map((u, i) => prepFile(u, names[i], type));
    const ready = ps.map((p) => p.file).filter(Boolean);
    const go = (files) => navigator.share({ files }).catch((e) => { if (e && e.name !== "AbortError") flash(btn, "Couldn't share. Try again", false); });
    if (ready.length === urls.length) return go(ready); // instant: still inside the tap
    flash(btn, "Getting it ready… tap again");
    Promise.all(ps).catch(() => {});
  }
  // Save text as a real Word document (.docx) that Word and Google Docs both open.
  let docxLib = null;
  async function saveWord(title, blocks, filename, btn) {
    flash(btn, "Making your Word doc…");
    try {
      if (!docxLib) docxLib = new Promise((res, rej) => { const s = document.createElement("script"); s.src = "https://cdn.jsdelivr.net/npm/docx@9.0.2/build/index.umd.js"; s.onload = () => res(window.docx); s.onerror = rej; document.head.appendChild(s); });
      const D = await docxLib;
      const kids = [new D.Paragraph({ text: title, heading: D.HeadingLevel.TITLE })];
      for (const bl of blocks) {
        if (bl.heading) kids.push(new D.Paragraph({ text: bl.heading, heading: D.HeadingLevel.HEADING_2, spacing: { before: 240 } }));
        for (const line of String(bl.text || "").split("\n")) {
          const bullet = /^\s*•\s+/.test(line);
          kids.push(new D.Paragraph({ children: [new D.TextRun(line.replace(/^\s*•\s+/, ""))], ...(bullet ? { bullet: { level: 0 } } : {}) }));
        }
      }
      const blob = await D.Packer.toBlob(new D.Document({ creator: "BizConnect AI Studio", title, sections: [{ children: kids }] }));
      const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = `${filename}.docx`; document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 4000);
      flash(btn, "Saved! Check your Downloads");
    } catch {
      const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([[title, ...blocks.map((b) => (b.heading ? b.heading + "\n" : "") + b.text)].join("\n\n")], { type: "text/plain" })); a.download = `${filename}.txt`; a.click();
      flash(btn, "Saved as a text file");
    }
  }
  // A tool button: icon + plain words, big enough to tap.
  function tool(kind, label, fn, cls = "", aria) {
    const b = document.createElement("button");
    b.type = "button"; b.className = `tool ${cls}`.trim();
    b.innerHTML = `${ICO[kind]}<span>${esc(label)}</span>`;
    b.setAttribute("aria-label", aria || label);
    b.onclick = (e) => { e.preventDefault(); e.stopPropagation(); fn(b); };
    return b;
  }
  function copyChip(text, what) { return tool("copy", "Copy", (b) => copyText(text, b), "tool-sm", `Copy ${what}`); }
  // "Use this in…": send a result into another studio with the prompt already filled in.
  function useIn(targets) {
    const d = document.createElement("details");
    d.className = "usein";
    d.innerHTML = `<summary class="tool">${ICO.wand}<span>Use this in…</span></summary><div class="usein-menu"></div>`;
    const menu = $(".usein-menu", d);
    targets.forEach(([studio, label, text]) => {
      const a = document.createElement("a");
      a.href = `studio.html?s=${studio}&p=${encodeURIComponent(String(text).slice(0, 1400))}`;
      a.textContent = label;
      menu.appendChild(a);
    });
    return d;
  }
  // Split markdown into titled pieces (email, LinkedIn note, text…) so each can be copied on its own.
  function sections(text) {
    const lines = String(text || "").split("\n");
    const out = []; let cur = { title: "", body: [] };
    for (const ln of lines) {
      const m = ln.match(/^\s*(?:#{1,3}\s+(.*)|\*\*([^*]{2,60})\*\*:?\s*)$/);
      if (m) { if (cur.title || cur.body.join("").trim()) out.push(cur); cur = { title: (m[1] || m[2]).replace(/\*\*/g, "").replace(/:$/, "").trim(), body: [] }; }
      else cur.body.push(ln);
    }
    if (cur.title || cur.body.join("").trim()) out.push(cur);
    const secs = out.map((s) => ({ title: s.title, body: s.body.join("\n").trim() })).filter((s) => s.body);
    return secs.filter((s) => s.title).length >= 2 ? secs.map((s) => ({ ...s, title: s.title || "Overview" })) : [];
  }
  async function exportPptx(deck) {
    if (!window.PptxGenJS) {
      await new Promise((res, rej) => { const s = document.createElement("script"); s.src = "https://cdn.jsdelivr.net/npm/pptxgenjs@3.12.0/dist/pptxgen.bundle.js"; s.onload = res; s.onerror = rej; document.head.appendChild(s); });
    }
    const p = new window.PptxGenJS();
    p.layout = "LAYOUT_WIDE";
    const navy = "0E1B33", gold = "C6972F", ivory = "F7F6F2";
    const t = p.addSlide(); t.background = { color: navy };
    t.addText(deck.title || "Presentation", { x: 0.8, y: 2.3, w: 11.7, h: 1.2, fontFace: "Georgia", fontSize: 40, color: ivory });
    t.addText(deck.subtitle || "", { x: 0.8, y: 3.5, w: 11.7, h: 0.8, fontSize: 20, color: gold });
    (deck.slides || []).forEach((s, i) => {
      const sl = p.addSlide(); sl.background = { color: navy };
      sl.addText(String(i + 1).padStart(2, "0"), { x: 0.8, y: 0.45, w: 2, h: 0.4, fontSize: 12, color: gold });
      sl.addText(s.title || "", { x: 0.8, y: 0.8, w: 11.7, h: 1, fontFace: "Georgia", fontSize: 30, color: ivory });
      sl.addShape(p.ShapeType.line, { x: 0.8, y: 1.85, w: 3, h: 0, line: { color: gold, width: 1.5 } });
      sl.addText((s.bullets || []).map((b) => ({ text: b, options: { bullet: true } })), { x: 0.8, y: 2.1, w: 11.7, h: 4.6, fontSize: 20, color: "DDE0E6", paraSpaceAfter: 10, valign: "top" });
      if (s.notes) sl.addNotes(s.notes);
    });
    await p.writeFile({ fileName: `${(deck.title || "deck").replace(/[^\w\- ]+/g, "").slice(0, 50)}.pptx` });
  }
  const deckOutline = (d) => `${d.title}\n${d.subtitle || ""}\n\n` + (d.slides || []).map((s, i) => `${i + 1}. ${s.title}\n${(s.bullets || []).map((x) => "   • " + x).join("\n")}`).join("\n\n");
  const slug = (s) => String(s || "").replace(/[^\w ]+/g, "").trim().slice(0, 40).replace(/\s+/g, "-");

  // "Write a post caption" card for pictures, videos and audio (1 credit, on request).
  function captionCard(item, host) {
    const card = document.createElement("div");
    card.className = "sect caption-card";
    card.innerHTML = `<div class="sect-head"><h4>Posting this on social media?</h4></div><div class="sect-body"><p class="muted" style="font-size:13.5px">Get a ready-to-post caption and hashtags (1 credit).</p></div>`;
    const bodyEl = $(".sect-body", card);
    const btn = tool("wand", "Write a post caption", async (b) => {
      b.disabled = true; flash(b, "Writing…");
      try {
        const kind = { image: "photo", video: "video", audio: "audio clip" }[item.output.type] || "post";
        const r = await generate({ studio: "chat", engine: "gemini-flash", prompt: `Write a short, friendly social media caption (1-2 sentences, no hashtags inside it) for a ${kind} made from this idea: "${item.prompt}". Then 5 relevant hashtags. Reply in exactly this format:\nCAPTION: <caption>\nHASHTAGS: #one #two #three #four #five` });
        const t = r.output.text || "";
        const cap = ((t.match(/CAPTION:\s*([\s\S]*?)(?:\n\s*HASHTAGS:|$)/i) || [])[1] || t).trim();
        const tags = ((t.match(/HASHTAGS:\s*(.*)/i) || [])[1] || "").trim();
        bodyEl.innerHTML = `<p class="cap-text"></p>${tags ? `<p class="cap-tags"></p>` : ""}<div class="img-tools"></div>`;
        $(".cap-text", bodyEl).textContent = cap;
        if (tags) $(".cap-tags", bodyEl).textContent = tags;
        const bar = $(".img-tools", bodyEl);
        bar.appendChild(tool("copy", "Copy caption + hashtags", (x) => copyText(`${cap}\n\n${tags}`.trim(), x), "tool-sm primary"));
        bar.appendChild(tool("copy", "Copy caption only", (x) => copyText(cap, x), "tool-sm"));
      } catch (e) { flash(b, e.message || "Couldn't write it. Try again", false); b.disabled = false; }
    }, "tool-sm primary");
    bodyEl.appendChild(btn);
    host.appendChild(card);
  }

  function renderOutput(item, el) {
    const o = item.output || {};
    const when = new Date(item.created || Date.now()).toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
    el.innerHTML = `<div class="out"><div class="out-meta"><span>${esc(item.engineLabel || "")} · ${item.credits} credits · ${when}</span></div><div class="body"></div><div class="result-tools"><div class="actions"></div><p class="tools-note muted"></p></div></div>`;
    const body = $(".body", el), actions = $(".actions", el), note = $(".tools-note", el);
    const add = (b) => actions.appendChild(b);
    const base = slug(item.prompt) || "bizconnect";

    if (o.type === "text") {
      const secs = sections(o.text);
      const clean = plain(o.text);
      if (secs.length) {
        // e.g. the Sales Outreach pack: every piece gets its own Copy button
        body.innerHTML = `<div class="sects"></div>`;
        const wrap = $(".sects", body);
        secs.forEach((s) => {
          const card = document.createElement("div");
          card.className = "sect";
          card.innerHTML = `<div class="sect-head"><h4>${esc(s.title)}</h4></div><div class="sect-body out-text">${md(s.body)}</div>`;
          const bodyEl = $(".sect-body", card);
          $(".sect-head", card).appendChild(tool("copy", "Copy", (b) => copyText(plain(s.body), b, COPIED, bodyEl), "tool-sm", `Copy ${s.title}`));
          wrap.appendChild(card);
        });
      } else {
        body.innerHTML = `<div class="out-text">${md(o.text)}</div>`;
      }
      const textEl = $(".out-text", body);
      add(tool("copy", secs.length ? "Copy everything" : "Copy text", (b) => copyText(clean, b, COPIED, textEl), "primary"));
      const site = String(o.meta?.site || "").replace(/^www\./, "").split(".")[0];
      const docName = item.studio === "outreach" ? `outreach-pack-${slug(site) || "prospect"}` : item.studio === "translate" ? `translation-${slug(o.meta?.language) || "text"}` : base;
      add(tool("doc", "Save as Word doc", (b) => saveWord(item.studio === "outreach" ? `Outreach pack: ${o.meta?.site || ""}` : STUDIO_BY_ID[item.studio]?.name || "BizConnect AI Studio", secs.length ? secs.map((s) => ({ heading: s.title, text: plain(s.body) })) : [{ text: clean }], docName, b)));
      if (item.studio === "outreach") add(useIn([["translate", "Translate the pack", clean]]));
      else if (item.studio === "translate") add(useIn([["voice", "Turn it into a voiceover", clean], ["avatar", "Make a talking video", clean]]));
      else add(useIn([["voice", "Turn it into a voiceover", clean], ["avatar", "Make a talking video", clean], ["deck", "Make slides from it", clean], ["translate", "Translate it", clean]]));
    } else if (o.type === "image") {
      body.innerHTML = `<div class="out-img"></div>`;
      const grid = $(".out-img", body);
      const names = o.urls.map((u, i) => `${base}-${i + 1}.jpg`);
      o.urls.forEach((u, i) => {
        if (PHONE_SAVE) prepFile(u, names[i], "image/jpeg");
        const card = document.createElement("figure");
        card.className = "img-card";
        card.innerHTML = `<a href="${esc(u)}" target="_blank" rel="noopener" title="Open full size"><img src="${esc(u)}" alt="Generated image ${i + 1}" crossorigin="anonymous"></a><figcaption class="img-tools"></figcaption>`;
        const bar = $(".img-tools", card);
        const n = o.urls.length > 1 ? ` ${i + 1}` : "";
        if (PHONE_SAVE) bar.appendChild(tool("phone", "Save to phone", (b) => shareFiles([u], [names[i]], "image/jpeg", b), "tool-sm", `Save picture${n} to phone`));
        else bar.appendChild(tool("down", "Download", (b) => download(u, names[i], b), "tool-sm", `Download picture${n}`));
        bar.appendChild(tool("copy", "Copy picture", (b) => copyImage(u, b), "tool-sm", `Copy picture${n}`));
        grid.appendChild(card);
      });
      if (PHONE_SAVE) add(tool("phone", o.urls.length > 1 ? "Save all to phone" : "Save to phone", (b) => shareFiles(o.urls, names, "image/jpeg", b), "primary"));
      else if (o.urls.length > 1) add(tool("down", "Download all", (b) => { flash(b, "Downloading…"); o.urls.forEach((u, i) => setTimeout(() => download(u, names[i]), i * 700)); }, "primary"));
      else add(tool("down", "Download", (b) => download(o.urls[0], names[0], b), "primary"));
      add(useIn([["video", "Animate it into a video", item.prompt], ["image", "Make another version", item.prompt]]));
      captionCard(item, body);
    } else if (o.type === "video" || o.type === "audio") {
      const isVid = o.type === "video";
      const name = `${base}.${isVid ? "mp4" : /\.wav/.test(o.url) ? "wav" : "mp3"}`;
      const type = isVid ? "video/mp4" : "audio/mpeg";
      if (SHARE_FILES) prepFile(o.url, name, type);
      body.innerHTML = isVid ? `<video src="${esc(o.url)}" controls playsinline autoplay muted loop></video>` : `<audio src="${esc(o.url)}" controls></audio>`;
      if (o.meta?.lyrics) {
        const card = document.createElement("div");
        card.className = "sect";
        card.innerHTML = `<div class="sect-head"><h4>Lyrics</h4></div><div class="sect-body out-text">${esc(o.meta.lyrics)}</div>`;
        const lyr = $(".sect-body", card);
        $(".sect-head", card).appendChild(tool("copy", "Copy lyrics", (b) => copyText(o.meta.lyrics, b, COPIED, lyr), "tool-sm"));
        body.appendChild(card);
      }
      if (PHONE_SAVE) add(tool("phone", "Save to phone", (b) => shareFiles([o.url], [name], type, b), "primary"));
      else add(tool("down", isVid ? "Download video" : "Download audio", (b) => download(o.url, name, b), "primary"));
      if (SHARE_FILES) add(tool("share", "Share to Facebook, text…", (b) => shareFiles([o.url], [name], type, b)));
      if (!TOUCH) {
        add(tool("link", "Copy link to send", (b) => copyText(o.url, b, "Link copied! Paste it in an email or text")));
        note.textContent = "Tip: shared links work for about 7 days. Download the file to keep it forever.";
      }
      if (isVid) add(useIn([["video", "Make another version", item.prompt]]));
      else if (item.studio === "voice") add(useIn([["avatar", "Make a talking video with this script", item.prompt]]));
      captionCard(item, body);
    } else if (o.type === "deck") {
      const d = o.deck;
      body.innerHTML = `<div class="out-text" style="white-space:normal"><h2 style="font-family:var(--serif);font-weight:400;font-size:24px;color:var(--ivory)">${esc(d.title)}</h2><p class="muted">${esc(d.subtitle || "")}</p></div><div class="slides"></div>`;
      const grid = $(".slides", body);
      (d.slides || []).forEach((s, i) => {
        const card = document.createElement("div");
        card.className = "slide";
        card.innerHTML = `<span class="n">${String(i + 1).padStart(2, "0")}</span><h5>${esc(s.title)}</h5><ul>${(s.bullets || []).map((b) => `<li>${esc(b)}</li>`).join("")}</ul>`;
        card.appendChild(tool("copy", "Copy", (b) => copyText(`${s.title}\n${(s.bullets || []).map((x) => "• " + x).join("\n")}${s.notes ? `\n\nSpeaker notes: ${s.notes}` : ""}`, b), "tool-sm slide-copy", `Copy slide ${i + 1}`));
        grid.appendChild(card);
      });
      const notes = (d.slides || []).map((s, i) => `Slide ${i + 1}: ${s.title}\n${s.notes || ""}`).join("\n\n");
      add(tool("down", "Download PowerPoint", (b) => { flash(b, "Building your slides…"); exportPptx(d).then(() => flash(b, "Saved! Check your Downloads")); }, "primary"));
      add(tool("copy", "Copy outline", (b) => copyText(deckOutline(d), b)));
      add(tool("doc", "Save as Word doc", (b) => saveWord(d.title || "Presentation", (d.slides || []).map((s, i) => ({ heading: `${i + 1}. ${s.title}`, text: (s.bullets || []).map((x) => "• " + x).join("\n") + (s.notes ? `\nSpeaker notes: ${s.notes}` : "") })), slug(d.title) || base, b)));
      if ((d.slides || []).some((s) => s.notes)) {
        add(tool("copy", "Copy speaker notes", (b) => copyText(notes, b)));
        add(useIn([["voice", "Record the speaker notes as a voiceover", (d.slides || []).map((s) => s.notes).filter(Boolean).join(" ")]]));
      }
    } else if (o.type === "brand") {
      const k = o.kit || {};
      const kbase = slug(k.name) || base;
      const row = (label, text, big) => text ? `<div class="kv"><div><span class="label">${esc(label)}</span><p${big ? ' class="big"' : ""}>${esc(text)}</p></div><span data-copy="${esc(text)}" data-what="${esc(label.toLowerCase())}"></span></div>` : "";
      const colors = (k.colors || []).map((c) => ({ ...c, hex: /^#[0-9a-f]{3,8}$/i.test(c.hex || "") ? c.hex : "#888888" }));
      body.innerHTML = `<div class="kit-grid">
          <div>${o.logo ? `<img src="${esc(o.logo)}" alt="Logo concept" crossorigin="anonymous" style="border-radius:10px;border:1px solid var(--line-soft)"><div class="img-tools logo-tools"></div>` : ""}</div>
          <div class="out-text kit" style="white-space:normal">
            ${row("Business name", k.name, true)}
            ${row("Tagline", k.tagline)}
            ${(k.alt_taglines || []).map((t, i) => row(`Tagline option ${i + 2}`, t)).join("")}
            ${row("Elevator pitch", k.elevator_pitch)}
            ${row("Brand voice", (k.voice || []).join(" · "))}
          </div></div>
        <div><span class="label">Color palette · tap a color to copy its code</span><div class="swatches" style="margin-top:8px">${colors.map((c) => `<button type="button" class="sw" data-hex="${esc(c.hex)}" aria-label="Copy color ${esc(c.name || "")} ${esc(c.hex)}" title="${esc(c.use || "")}"><div style="background:${esc(c.hex)}"></div><span>${esc(c.name || "")}<br>${esc(c.hex)}</span></button>`).join("")}</div></div>
        <div class="out-text kit" style="white-space:normal">
          ${row("Fonts", k.fonts ? `Headings: ${k.fonts.heading || ""} · Body: ${k.fonts.body || ""}` : "")}
          ${row("Short bio", k.bio_short)}
          ${row("Social media bio", k.bio_social)}
        </div>`;
      body.querySelectorAll("[data-copy]").forEach((s) => s.replaceWith(copyChip(s.dataset.copy, s.dataset.what)));
      body.querySelectorAll("[data-hex]").forEach((s) => (s.onclick = async () => flash(s, `Copied ${s.dataset.hex}`, await writeClipboard(s.dataset.hex))));
      const lt = $(".logo-tools", body);
      if (lt) {
        if (PHONE_SAVE) { prepFile(o.logo, `${kbase}-logo.jpg`, "image/jpeg"); lt.appendChild(tool("phone", "Save to phone", (b) => shareFiles([o.logo], [`${kbase}-logo.jpg`], "image/jpeg", b), "tool-sm", "Save logo to phone")); }
        else lt.appendChild(tool("down", "Download", (b) => download(o.logo, `${kbase}-logo.jpg`, b), "tool-sm", "Download logo"));
        lt.appendChild(tool("copy", "Copy picture", (b) => copyImage(o.logo, b), "tool-sm", "Copy logo picture"));
      }
      const kitBlocks = [
        { heading: "Business name", text: k.name || "" }, { heading: "Tagline", text: k.tagline || "" },
        { heading: "Other taglines", text: (k.alt_taglines || []).map((t) => "• " + t).join("\n") },
        { heading: "Elevator pitch", text: k.elevator_pitch || "" }, { heading: "Brand voice", text: (k.voice || []).join(", ") },
        { heading: "Colors", text: colors.map((c) => `• ${c.name} ${c.hex}${c.use ? ` (${c.use})` : ""}`).join("\n") },
        { heading: "Fonts", text: `Headings: ${k.fonts?.heading || ""}\nBody: ${k.fonts?.body || ""}` },
        { heading: "Short bio", text: k.bio_short || "" }, { heading: "Social media bio", text: k.bio_social || "" },
      ].filter((b) => b.text.trim());
      const kitText = kitBlocks.map((b) => `${b.heading}:\n${b.text}`).join("\n\n");
      add(tool("copy", "Copy whole kit", (b) => copyText(kitText, b), "primary"));
      add(tool("doc", "Save as Word doc", (b) => saveWord(`${k.name || "Brand"} brand kit`, kitBlocks, `${kbase}-brand-kit`, b)));
      add(useIn([
        ["image", "Make a flyer with this tagline", `A clean, modern flyer for "${k.name || "my business"}" with the headline "${k.tagline || ""}", using the brand colors ${colors.map((c) => c.hex).join(", ")}`],
        ["music", "Make a jingle", `A short upbeat jingle for ${k.name || "my business"}: ${k.tagline || ""}`],
        ["avatar", "Make an intro video", k.elevator_pitch || ""],
      ]));
    }
  }

  function thumbHTML(item, icon) {
    const o = item.output || {};
    let th = svg(icon);
    if (o.type === "image") th = `<img src="${esc(o.urls[0])}" alt="" loading="lazy">`;
    else if (o.type === "video") th = `<video src="${esc(o.url)}#t=0.5" muted preload="metadata"></video>`;
    else if (o.type === "brand" && o.logo) th = `<img src="${esc(o.logo)}" alt="" loading="lazy">`;
    return `<div class="th">${th}</div><p>${esc(item.prompt)}</p>`;
  }

  // ---------------- chrome: header, footer, gate ----------------
  const CREST = "assets/img/bcc-logo.png";
  function header(active) {
    const el = document.createElement("header");
    el.className = "top";
    el.innerHTML = `<div class="wrap nav">
      <a class="brand" href="index.html"><img src="${CREST}" alt="Biz Connect crest"><span class="brand-word"><b>BIZCONNECT</b><span>AI Studio</span></span></a>
      <nav class="nav-links">
        <a href="index.html" class="${active === "home" ? "active" : ""}">Studios</a>
        <a href="studio.html?s=image" class="${active === "studio" ? "active" : ""}">Create</a>
        <a href="account.html" class="${active === "account" ? "active" : ""}">Wallet &amp; Referrals</a>
      </nav>
      <div class="nav-right">
        <div class="wallet-chip"><span class="lbl">Credits</span><b data-credits>${user ? Number(user.credits).toLocaleString() : "—"}</b><a href="account.html#topup">Top up</a></div>
        <button class="user-dot" data-initial title="Account" onclick="location.href='account.html'">${user ? esc((user.name || user.handle).slice(0, 2).toUpperCase()) : "?"}</button>
      </div></div>`;
    document.body.prepend(el);
  }
  function footer() {
    const f = document.createElement("footer");
    f.className = "bot";
    f.innerHTML = `<div class="wrap"><span>© ${new Date().getFullYear()} Biz Connect Coalition · BizConnect AI Studio (prototype)</span><span>Powered by leading AI models from Google, OpenAI, Anthropic, ElevenLabs and more · <a href="#" id="signout">Sign out</a></span></div>`;
    document.body.appendChild(f);
    $("#signout", f).onclick = (e) => { e.preventDefault(); signOut(); };
  }
  function gate() {
    if ($(".overlay.gate")) return;
    const ov = document.createElement("div");
    ov.className = "overlay gate";
    const r = store.get(LS.ref);
    ov.innerHTML = `<form class="modal" autocomplete="off">
      <img class="crest" src="assets/img/bcc-crest.png" alt="">
      <h2>Welcome to the Studio</h2>
      <p>BizConnect AI Studio is in private preview. Enter the access passcode to start creating.</p>
      <div class="stack">
        <div class="field"><label for="g-name">Your name</label><input class="input" id="g-name" placeholder="Jane Smith" autocomplete="name" required></div>
        <div class="field"><label for="g-email">Email</label><input class="input" id="g-email" type="email" placeholder="you@yourbusiness.com" autocomplete="email" required></div>
        <div class="field"><label for="g-pass">Access passcode</label><input class="input" id="g-pass" type="password" required></div>
        ${r ? `<p class="notice">You were invited by a BizConnect member. Welcome!</p>` : ""}
        <div class="err hidden" id="g-err"></div>
        <button class="btn btn-primary" type="submit">Enter the Studio</button>
        <p class="muted" style="font-size:12px;text-align:center">New accounts start with free credits. Returning? Sign in with the same email.</p>
      </div></form>`;
    document.body.appendChild(ov);
    const form = $("form", ov);
    form.onsubmit = async (e) => {
      e.preventDefault();
      const btn = $("button", form); btn.disabled = true; btn.textContent = "Checking…";
      try {
        const d = await api("/api/login", { name: $("#g-name").value.trim(), email: $("#g-email").value.trim(), passcode: $("#g-pass").value, ref: store.get(LS.ref) });
        store.set(LS.token, d.token); setUser(d.user); ov.remove();
        document.dispatchEvent(new CustomEvent("bcai:signedin"));
      } catch (err) {
        const g = $("#g-err"); g.textContent = err.message; g.classList.remove("hidden");
        btn.disabled = false; btn.textContent = "Enter the Studio";
      }
    };
    setTimeout(() => $("#g-name")?.focus(), 50);
  }
  function whenSignedIn(fn) {
    if (store.get(LS.token)) { fn(); refreshMe().catch(() => {}); }
    else { gate(); document.addEventListener("bcai:signedin", fn, { once: true }); }
  }

  // ---------------- Allie concierge (full-size, same look and motion as the main BizConnect site) ----------------
  const ALLIE_POSES = [
    { src: "assets/img/allie/allie-pose-wave.png", alt: "Allie waving hello" },
    { src: "assets/img/allie/allie-pose-point.png", alt: "Allie pointing something out" },
    { src: "assets/img/allie/allie-pose-welcome.png", alt: "Allie welcoming you with open arms" },
    { src: "assets/img/allie/allie-pose-thumbsup.png", alt: "Allie giving a thumbs up" },
    { src: "assets/img/allie/allie-pose-arms-crossed.png", alt: "Allie standing confidently" },
    { src: "assets/img/allie/allie-pose-clipboard.png", alt: "Allie holding a clipboard, ready to help" },
  ];
  const ALLIE_PAGE = {
    "index.html": { pose: 0, lines: ["Hi, I'm Allie! 👋 Not sure where to start? Tell me what you want to make.", "Tip: tap the 🎤 in any box and just talk. I'll type it for you."] },
    "studio.html": { pose: 1, lines: ["Try an example prompt, then tweak it. That's the fastest way to learn.", "Want better results? Switch to a Premium engine on the left."] },
    "account.html": { pose: 3, lines: ["Share your referral link and earn on every credit pack your referrals buy.", "Credits never expire, and there's no monthly fee."] },
  };
  function allie() {
    const page = location.pathname.split("/").pop() || "index.html";
    const cfg = ALLIE_PAGE[page] || ALLIE_PAGE["index.html"];
    const POSE_CYCLE_MS = 22000, APPEAR_MS = 4000, BUBBLE_MS = 9000;
    let poseIx = cfg.pose, lineIx = 0, frontIsA = true, bubbleTimer = null;
    const hidden = () => { try { return sessionStorage.getItem("allieHidden") === "1"; } catch { return false; } };

    const root = document.createElement("div");
    root.className = "allie";
    root.setAttribute("role", "complementary");
    root.setAttribute("aria-label", "Allie, your BizConnect Studio guide");
    root.innerHTML = `
      <div class="allie-chat" role="dialog" aria-label="Chat with Allie">
        <div class="ac-head"><span class="ac-dot"></span><b>Allie</b><span class="ac-sub">Studio concierge</span><button class="ac-close" type="button" aria-label="Close chat">&times;</button></div>
        <div class="ac-msgs" aria-live="polite"></div>
        <div class="ac-chips"></div>
        <form class="ac-input"><input type="text" placeholder="Tell me what you want to make…" aria-label="Ask Allie" maxlength="500"><button class="ac-send" type="submit" aria-label="Send"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><path d="M5 12h14M13 6l6 6-6 6" stroke-linecap="round" stroke-linejoin="round"/></svg></button></form>
      </div>
      <div class="allie-bubble" aria-live="polite"></div>
      <button class="allie-close" type="button" aria-label="Hide Allie" title="Hide Allie">&times;</button>
      <div class="allie-figure" role="button" tabindex="0" aria-label="Chat with Allie" title="Click to chat with Allie">
        <img class="allie-img on" alt=""><img class="allie-img" alt="">
      </div>`;
    const tab = document.createElement("button");
    tab.className = "allie-tab";
    tab.type = "button";
    tab.innerHTML = `<img src="assets/img/allie-avatar-sm.jpg" alt=""> Ask Allie`;
    tab.setAttribute("aria-label", "Show Allie, your studio guide");
    document.body.appendChild(root);
    document.body.appendChild(tab);

    const [imgA, imgB] = root.querySelectorAll(".allie-img");
    const bubble = $(".allie-bubble", root), figure = $(".allie-figure", root), chat = $(".allie-chat", root);
    const msgsEl = $(".ac-msgs", root), chipsEl = $(".ac-chips", root), form = $(".ac-input", root), input = $("input", form);
    const applyPose = (img, p) => { img.src = p.src; img.alt = p.alt; };
    applyPose(imgA, ALLIE_POSES[poseIx]);
    ALLIE_POSES.forEach((p) => { const i = new Image(); i.src = p.src; });

    function nextPose() {
      poseIx = (poseIx + 1) % ALLIE_POSES.length;
      const front = frontIsA ? imgA : imgB, back = frontIsA ? imgB : imgA;
      applyPose(back, ALLIE_POSES[poseIx]);
      const go = () => { back.classList.add("on"); front.classList.remove("on"); frontIsA = !frontIsA; };
      if (back.complete) requestAnimationFrame(go); else back.onload = () => requestAnimationFrame(go);
    }
    function say(text) {
      if (chat.classList.contains("open") || !root.classList.contains("in")) return;
      bubble.textContent = text;
      bubble.classList.add("show");
      clearTimeout(bubbleTimer);
      bubbleTimer = setTimeout(() => bubble.classList.remove("show"), BUBBLE_MS);
    }
    function show(first) {
      root.classList.remove("bye"); root.classList.add("in"); tab.classList.remove("show");
      if (first) setTimeout(() => say(cfg.lines[0]), 900);
    }
    function hide() {
      root.classList.add("bye"); root.classList.remove("in"); closeChat(); bubble.classList.remove("show");
      try { sessionStorage.setItem("allieHidden", "1"); } catch {}
      setTimeout(() => tab.classList.add("show"), 450);
    }
    if (hidden()) setTimeout(() => tab.classList.add("show"), APPEAR_MS); else setTimeout(() => show(true), APPEAR_MS);
    setInterval(() => {
      if (!root.classList.contains("in")) return;
      nextPose();
      lineIx = (lineIx + 1) % cfg.lines.length;
      say(cfg.lines[lineIx]);
    }, POSE_CYCLE_MS);
    $(".allie-close", root).onclick = hide;
    tab.onclick = () => { try { sessionStorage.removeItem("allieHidden"); } catch {} show(false); openChat(); };

    // Step aside on small screens while someone types in a page field (she'd cover it).
    const pageField = (el) => el && /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName) && !root.contains(el);
    document.addEventListener("focusin", (e) => { if (window.innerWidth <= 680 && pageField(e.target)) root.classList.add("form-focus"); });
    document.addEventListener("focusout", (e) => { if (pageField(e.target)) root.classList.remove("form-focus"); });

    // ----- chat (Allie's brain is the studio concierge on the server) -----
    const msgs = [];
    function addMsg(role, text) {
      const d = document.createElement("div");
      d.className = `ac-msg ${role === "user" ? "user" : "bot"}`;
      const m = String(text).match(/\[\[studio:(\w+)\|([^\]]*)\]\]/);
      d.textContent = String(text).replace(/\[\[studio:[^\]]*\]\]/g, "").trim();
      if (m && window.STUDIO_BY_ID?.[m[1]]) {
        const a = document.createElement("a");
        a.className = "allie-go";
        a.href = `studio.html?s=${m[1]}&p=${encodeURIComponent(m[2])}`;
        a.textContent = `Open ${STUDIO_BY_ID[m[1]].name} →`;
        d.appendChild(document.createElement("br")); d.appendChild(a);
      }
      msgsEl.appendChild(d); msgsEl.scrollTop = msgsEl.scrollHeight;
    }
    function setChips(list) {
      chipsEl.innerHTML = "";
      list.forEach((c) => { const b = document.createElement("button"); b.type = "button"; b.className = "ac-chip"; b.textContent = c; b.onclick = () => ask(c); chipsEl.appendChild(b); });
    }
    async function ask(text) {
      if (!store.get(LS.token)) { gate(); return; }
      setChips([]);
      msgs.push({ role: "user", content: text }); addMsg("user", text);
      const typing = document.createElement("div"); typing.className = "ac-msg bot typing"; typing.innerHTML = "<span></span><span></span><span></span>";
      msgsEl.appendChild(typing); msgsEl.scrollTop = msgsEl.scrollHeight;
      try {
        const d = await api("/api/concierge", { messages: msgs });
        typing.remove(); msgs.push({ role: "assistant", content: d.reply }); addMsg("assistant", d.reply);
      } catch (e) { typing.remove(); addMsg("assistant", e.message); }
    }
    function openChat(prefill) {
      if (!store.get(LS.token)) { gate(); return; }
      show(false);
      bubble.classList.remove("show");
      chat.classList.add("open"); figure.classList.add("chatting");
      if (!msgsEl.childElementCount) {
        addMsg("assistant", `Hi${user?.name ? " " + user.name.split(" ")[0] : ""}! I'm Allie. Tell me what you're trying to make (a flyer, a video, an email, anything) and I'll point you to the right studio.`);
        setChips(["Make a flyer for my event", "Write a follow-up email", "Create a short promo video", "Build a brand kit"]);
      }
      if (typeof prefill === "string" && prefill) ask(prefill); else setTimeout(() => input.focus(), 250);
    }
    function closeChat() { chat.classList.remove("open"); figure.classList.remove("chatting"); }
    figure.onclick = () => (chat.classList.contains("open") ? closeChat() : openChat());
    figure.onkeydown = (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); figure.onclick(); } };
    bubble.onclick = () => openChat();
    $(".ac-close", root).onclick = closeChat;
    form.onsubmit = (e) => { e.preventDefault(); const v = input.value.trim(); if (v) { ask(v); input.value = ""; } };
    window.BCAI.askAllie = openChat;
  }

  window.BCAI = { api, loadCatalog, credits, dollars, unitLabel, fromPrice, engineFor, generate, progressHTML, upload, renderOutput, thumbHTML, header, footer, gate, whenSignedIn, refreshMe, setUser, svg, esc, $, get user() { return user; }, get catalog() { return catalog; }, signOut, copyText, allie, tool, plain, saveWord, useIn, announce };
})();
