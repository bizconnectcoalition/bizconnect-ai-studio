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

  // ---------------- output rendering ----------------
  function md(text) {
    let h = esc(text);
    h = h.replace(/^### (.*)$/gm, "<h3>$1</h3>").replace(/^## (.*)$/gm, "<h2>$1</h2>").replace(/^# (.*)$/gm, "<h1>$1</h1>");
    h = h.replace(/\*\*(.+?)\*\*/g, "<b>$1</b>").replace(/(^|[^*])\*(?!\s)(.+?)\*/g, "$1<i>$2</i>");
    return h;
  }
  function download(url, name) {
    fetch(url).then((r) => r.blob()).then((b) => {
      const a = document.createElement("a"); a.href = URL.createObjectURL(b); a.download = name; a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 4000);
    }).catch(() => window.open(url, "_blank"));
  }
  function copyText(t, btn) {
    navigator.clipboard.writeText(t).then(() => { if (btn) { const o = btn.textContent; btn.textContent = "Copied ✓"; setTimeout(() => (btn.textContent = o), 1500); } });
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

  function renderOutput(item, el) {
    const o = item.output || {};
    const when = new Date(item.created || Date.now()).toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
    const meta = `<div class="out-meta"><span>${esc(item.engineLabel || "")} · ${item.credits} credits · ${when}</span><span class="actions"></span></div>`;
    el.innerHTML = `<div class="out">${meta}<div class="body"></div></div>`;
    const body = $(".body", el), actions = $(".actions", el);
    const addBtn = (label, fn) => { const b = document.createElement("button"); b.className = "btn btn-ghost btn-sm"; b.textContent = label; b.onclick = () => fn(b); actions.appendChild(b); };
    const base = (item.prompt || "bizconnect").replace(/[^\w ]+/g, "").trim().slice(0, 40).replace(/\s+/g, "-") || "bizconnect";
    if (o.type === "text") {
      body.innerHTML = `<div class="out-text">${md(o.text)}</div>`;
      addBtn("Copy", (b) => copyText(o.text, b));
    } else if (o.type === "image") {
      body.innerHTML = `<div class="out-img">${o.urls.map((u) => `<a href="${esc(u)}" target="_blank" rel="noopener"><img src="${esc(u)}" alt="Generated image"></a>`).join("")}</div>`;
      addBtn(o.urls.length > 1 ? "Download all" : "Download", () => o.urls.forEach((u, i) => download(u, `${base}-${i + 1}.jpg`)));
    } else if (o.type === "video") {
      body.innerHTML = `<video src="${esc(o.url)}" controls playsinline autoplay muted loop></video>`;
      addBtn("Download MP4", () => download(o.url, `${base}.mp4`));
    } else if (o.type === "audio") {
      body.innerHTML = `<audio src="${esc(o.url)}" controls></audio>${o.meta?.lyrics ? `<details class="adv"><summary>Lyrics</summary><div class="out-text" style="margin-top:10px">${esc(o.meta.lyrics)}</div></details>` : ""}`;
      addBtn("Download audio", () => download(o.url, `${base}.${/\.wav/.test(o.url) ? "wav" : "mp3"}`));
    } else if (o.type === "deck") {
      const d = o.deck;
      body.innerHTML = `<div class="out-text" style="white-space:normal"><h2 style="font-family:var(--serif);font-weight:400;font-size:24px;color:var(--ivory)">${esc(d.title)}</h2><p class="muted">${esc(d.subtitle || "")}</p></div>
        <div class="slides">${(d.slides || []).map((s, i) => `<div class="slide"><span class="n">${String(i + 1).padStart(2, "0")}</span><h5>${esc(s.title)}</h5><ul>${(s.bullets || []).map((b) => `<li>${esc(b)}</li>`).join("")}</ul></div>`).join("")}</div>`;
      addBtn("Download PowerPoint", (b) => { b.textContent = "Building…"; exportPptx(d).then(() => (b.textContent = "Download PowerPoint")); });
      addBtn("Copy outline", (b) => copyText(`${d.title}\n${d.subtitle || ""}\n\n` + (d.slides || []).map((s, i) => `${i + 1}. ${s.title}\n${(s.bullets || []).map((x) => "  - " + x).join("\n")}`).join("\n\n"), b));
    } else if (o.type === "brand") {
      const k = o.kit || {};
      body.innerHTML = `<div class="kit-grid">
          <div>${o.logo ? `<img src="${esc(o.logo)}" alt="Logo concept" style="border-radius:10px;border:1px solid var(--line-soft)">` : ""}<p class="muted" style="font-size:12px;margin-top:6px">Logo concept</p></div>
          <div class="out-text" style="white-space:normal">
            <h2 style="font-family:var(--serif);font-weight:400;font-size:26px;color:var(--ivory);margin-top:0">${esc(k.name || "")}</h2>
            <p style="color:var(--gold-hi);font-size:17px">${esc(k.tagline || "")}</p>
            <h3>Other taglines</h3><p>${(k.alt_taglines || []).map(esc).join("<br>")}</p>
            <h3>Elevator pitch</h3><p>${esc(k.elevator_pitch || "")}</p>
            <h3>Brand voice</h3><p>${(k.voice || []).map(esc).join(" · ")}</p>
          </div></div>
        <div><span class="label">Color palette</span><div class="swatches" style="margin-top:8px">${(k.colors || []).map((c) => `<div class="sw" title="${esc(c.use || "")}"><div style="background:${esc(c.hex)}"></div><span>${esc(c.name || "")}<br>${esc(c.hex)}</span></div>`).join("")}</div></div>
        <div class="out-text" style="white-space:normal"><h3>Fonts</h3><p>Headings: ${esc(k.fonts?.heading || "")} · Body: ${esc(k.fonts?.body || "")}</p><h3>Short bio</h3><p>${esc(k.bio_short || "")}</p><h3>Social bio</h3><p>${esc(k.bio_social || "")}</p></div>`;
      addBtn("Copy kit", (b) => copyText(`${k.name}\n${k.tagline}\n\nPitch: ${k.elevator_pitch}\nVoice: ${(k.voice || []).join(", ")}\nColors: ${(k.colors || []).map((c) => `${c.name} ${c.hex}`).join(", ")}\nFonts: ${k.fonts?.heading} / ${k.fonts?.body}\n\nBio: ${k.bio_short}\nSocial: ${k.bio_social}`, b));
      if (o.logo) addBtn("Download logo", () => download(o.logo, `${base}-logo.jpg`));
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
        <div class="field"><label for="g-name">Your name</label><input class="input" id="g-name" placeholder="Dan Herlehy" required></div>
        <div class="field"><label for="g-handle">Username</label><input class="input" id="g-handle" placeholder="danh" required minlength="3" maxlength="24" pattern="[A-Za-z0-9_\\-]+"></div>
        <div class="field"><label for="g-pass">Access passcode</label><input class="input" id="g-pass" type="password" required></div>
        ${r ? `<p class="notice">Invited by <b style="color:var(--gold-hi)">@${esc(r)}</b></p>` : ""}
        <div class="err hidden" id="g-err"></div>
        <button class="btn btn-primary" type="submit">Enter the Studio</button>
        <p class="muted" style="font-size:12px;text-align:center">New accounts start with free credits. Returning? Use the same username.</p>
      </div></form>`;
    document.body.appendChild(ov);
    const form = $("form", ov);
    form.onsubmit = async (e) => {
      e.preventDefault();
      const btn = $("button", form); btn.disabled = true; btn.textContent = "Checking…";
      try {
        const d = await api("/api/login", { name: $("#g-name").value.trim(), handle: $("#g-handle").value.trim(), passcode: $("#g-pass").value, ref: store.get(LS.ref) });
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

  // ---------------- Allie concierge ----------------
  function allie() {
    const fab = document.createElement("button");
    fab.className = "allie-fab";
    fab.setAttribute("aria-label", "Ask Allie for help");
    fab.innerHTML = `<span class="bubble">Not sure where to start? <b style="color:var(--gold-hi)">Ask Allie</b></span><img src="assets/img/allie-avatar-sm.jpg" alt="">`;
    document.body.appendChild(fab);
    let panel = null;
    const msgs = [];
    function addMsg(role, text) {
      const t = $(".thread", panel);
      const d = document.createElement("div");
      d.className = `msg ${role === "user" ? "me" : "ai"}`;
      const m = String(text).match(/\[\[studio:(\w+)\|([^\]]*)\]\]/);
      const clean = String(text).replace(/\[\[studio:[^\]]*\]\]/g, "").trim();
      d.textContent = clean;
      if (m && window.STUDIO_BY_ID?.[m[1]]) {
        const a = document.createElement("a");
        a.className = "allie-go";
        a.href = `studio.html?s=${m[1]}&p=${encodeURIComponent(m[2])}`;
        a.textContent = `Open ${STUDIO_BY_ID[m[1]].name} →`;
        d.appendChild(document.createElement("br")); d.appendChild(a);
      }
      t.appendChild(d); t.scrollTop = t.scrollHeight;
    }
    async function ask(text) {
      msgs.push({ role: "user", content: text }); addMsg("user", text);
      const t = $(".thread", panel);
      const typing = document.createElement("div"); typing.className = "msg ai"; typing.textContent = "…"; t.appendChild(typing);
      try {
        const d = await api("/api/concierge", { messages: msgs });
        typing.remove(); msgs.push({ role: "assistant", content: d.reply }); addMsg("assistant", d.reply);
      } catch (e) { typing.textContent = e.message; }
    }
    function open(prefill) {
      if (!store.get(LS.token)) { gate(); return; }
      if (!panel) {
        panel = document.createElement("div");
        panel.className = "allie-panel";
        panel.innerHTML = `<header><img src="assets/img/allie-avatar-sm.jpg" alt=""><div><b>Allie</b><small>Your BizConnect Studio concierge</small></div><button aria-label="Close">×</button></header>
          <div class="thread"></div>
          <form><input class="input" placeholder="Tell me what you want to make…" maxlength="500"><button class="btn btn-primary btn-sm">Send</button></form>`;
        document.body.appendChild(panel);
        $("header button", panel).onclick = () => panel.classList.add("hidden");
        $("form", panel).onsubmit = (e) => { e.preventDefault(); const i = $("input", panel); if (i.value.trim()) { ask(i.value.trim()); i.value = ""; } };
        addMsg("assistant", `Hi${user?.name ? " " + user.name.split(" ")[0] : ""}! I'm Allie. Tell me what you're trying to make (a flyer, a video, an email, anything) and I'll point you to the right studio.`);
      }
      panel.classList.remove("hidden");
      if (prefill) ask(prefill); else $("input", panel).focus();
    }
    fab.onclick = () => (panel && !panel.classList.contains("hidden") ? panel.classList.add("hidden") : open());
    window.BCAI.askAllie = open;
  }

  window.BCAI = { api, loadCatalog, credits, dollars, unitLabel, fromPrice, engineFor, generate, progressHTML, upload, renderOutput, thumbHTML, header, footer, gate, whenSignedIn, refreshMe, setUser, svg, esc, $, get user() { return user; }, get catalog() { return catalog; }, signOut, copyText, allie };
})();
