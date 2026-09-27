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
    const POSE_CYCLE_MS = 22000, APPEAR_MS = 5000, BUBBLE_MS = 9000;
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
    if (hidden()) tab.classList.add("show"); else setTimeout(() => show(true), APPEAR_MS);
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

  window.BCAI = { api, loadCatalog, credits, dollars, unitLabel, fromPrice, engineFor, generate, progressHTML, upload, renderOutput, thumbHTML, header, footer, gate, whenSignedIn, refreshMe, setUser, svg, esc, $, get user() { return user; }, get catalog() { return catalog; }, signOut, copyText, allie };
})();
