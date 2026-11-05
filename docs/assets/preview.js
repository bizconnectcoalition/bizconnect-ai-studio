/* AI Studio — example previews on the studio cards.
   Desktop: rest the mouse on a card for a moment → a popover shows "You type → You get" for that tool.
   Phones/tablets (no hover) and keyboards: the card's "Example" button opens the same preview
   (a bottom sheet on small screens). Data: CORE_PREVIEWS (assets/previews.js) + BRAND.previews
   (BRAND.previews = false → no previews at all; BRAND.previews.<studio> = null → none for that studio). */
(function () {
  "use strict";
  const { esc } = BCAI;
  const B = BCAI.brand;
  const DATA = B && B.previews === false ? {} : { ...(window.CORE_PREVIEWS || {}), ...((B && B.previews) || {}) };
  const CAN_HOVER = window.matchMedia?.("(hover: hover) and (pointer: fine)").matches;
  const CALM = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches; // no autoplay for people who ask for less motion
  const SHOW_DELAY = 280, SWITCH_DELAY = 140, HIDE_DELAY = 400;
  let pv = null, back = null, cur = null, showT = null, hideT = null, pinned = false, onTry = null, lastFocus = null, raf = 0;
  // Bottom sheet on phones/tablets (any touch-first device) and on narrow windows.
  const useSheet = () => window.innerWidth <= 720 || !CAN_HOVER;

  const ICON = {
    play: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5v14l11-7z" fill="currentColor"/></svg>',
    pause: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 5h4v14H7zM13 5h4v14h-4z" fill="currentColor"/></svg>',
    sound: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M4 9h4l5-4v14l-5-4H4z"/><path d="M16.5 8.5a5 5 0 0 1 0 7"/></svg>',
  };

  function el() {
    if (pv) return pv;
    pv = document.createElement("div");
    pv.className = "pv";
    pv.setAttribute("role", "dialog");
    pv.setAttribute("aria-modal", "false");
    pv.tabIndex = -1;
    pv.hidden = true;
    // dimmed backdrop behind the bottom sheet: a tap on it only closes the sheet (never opens a card behind)
    back = document.createElement("div");
    back.className = "pv-back"; back.hidden = true;
    back.addEventListener("click", (e) => { e.preventDefault(); e.stopPropagation(); hide(true); });
    document.body.appendChild(back);
    document.body.appendChild(pv);
    pv.addEventListener("pointerenter", () => clearTimeout(hideT));
    pv.addEventListener("pointerleave", (e) => { if (e.pointerType === "mouse" && !pinned) scheduleHide(); });
    // keyboard: leaving the open example with Tab closes it (focus goes wherever the user tabbed to)
    pv.addEventListener("focusout", (e) => { if (pinned && e.relatedTarget && !pv.contains(e.relatedTarget)) hide(); });
    document.addEventListener("keydown", (e) => { if (e.key === "Escape" && cur) hide(true); });
    document.addEventListener("pointerdown", (e) => { if (cur && pinned && !pv.contains(e.target) && !e.target.closest?.(".ex-btn")) hide(); });
    // a hover example closes when the page scrolls (no jumping around); a clicked (pinned) one follows its card
    window.addEventListener("scroll", () => { if (!cur) return; if (!pinned) hide(); else place(); }, { passive: true });
    window.addEventListener("resize", () => cur && place());
    if (window.ResizeObserver) new ResizeObserver(() => cur && place()).observe(pv); // images load → taller → re-fit on screen
    return pv;
  }

  // ----- what each kind of tool shows -----
  function body(id, d) {
    const S = window.STUDIO_BY_ID?.[id] || {};
    const youType = `<div class="pv-step">${esc(d.promptLabel || "You type")}</div><div class="pv-prompt">${esc(d.prompt)}</div>`;
    const youGet = (label = "You get") => `<div class="pv-step">${esc(label)}</div>`;
    const detail = d.detail ? `<p class="pv-detail">${esc(d.detail)}</p>` : "";
    const aiTag = `<span class="pv-ai" aria-hidden="true">AI-generated</span>`;
    switch (d.kind) {
      case "chat":
        return `${youGet("The AI replies")}<div class="pv-chat"><div class="pv-bubble me">${esc(d.prompt)}</div><div class="pv-bubble ai">${esc(d.reply)}</div></div>`;
      case "image":
        return `${youType}${youGet()}<div class="pv-media"><img data-src="${esc(d.src)}" alt="${esc(d.alt || "Example result")}"></div>${detail}`;
      case "video":
        return `${youType}${youGet()}<div class="pv-media pv-vid"><video data-src="${esc(d.src)}" ${d.poster ? `poster="${esc(d.poster)}"` : ""} muted loop playsinline preload="none" aria-label="Example video${d.sound ? " of a presenter speaking the script" : ""}"></video>${aiTag}
          <div class="pv-vctl"><button type="button" class="pv-pause" aria-label="Pause video">${ICON.pause}</button>${d.sound ? `<button type="button" class="pv-sound" aria-pressed="false">${ICON.sound}<span>Sound on</span></button>` : ""}</div></div>${detail}`;
      case "audio":
        return `${youType}${youGet()}<div class="pv-audio"><button type="button" class="pv-play" aria-label="Play the example">${ICON.play}</button><div class="pv-bars" aria-hidden="true">${"<i></i>".repeat(28)}</div><audio data-src="${esc(d.src)}" preload="none"></audio></div>${detail}`;
      case "deck":
        return `${youType}${youGet()}<div class="pv-slides">${(d.slides || []).slice(0, 3).map((s, i) => `<div class="pv-slide"><span>${String(i + 1).padStart(2, "0")}</span><b>${esc(s.title)}</b><ul>${(s.bullets || []).map((x) => `<li>${esc(x)}</li>`).join("")}</ul></div>`).join("")}</div>${detail}`;
      case "translate":
        return `${youType}${youGet(`In ${d.language || "another language"}`)}<div class="pv-prompt pv-result">${esc(d.result)}</div>${detail}`;
      case "outreach":
        return `${youType}${youGet("You get a tailored pack")}${(d.pieces || []).map((p) => `<div class="pv-piece"><b>${esc(p.title)}</b><p>${esc(p.text)}</p></div>`).join("")}${detail}`;
      case "brand":
        return `${youType}${youGet()}<div class="pv-kit">${d.logo ? `<img data-src="${esc(d.logo)}" alt="Example logo concept">` : ""}<div><b>${esc(d.name)}</b><p>${esc(d.tagline)}</p><div class="pv-sw">${(d.colors || []).map((c) => `<i style="background:${/^#[0-9a-f]{3,8}$/i.test(c) ? c : "#888"}" title="${esc(c)}"></i>`).join("")}</div></div></div>${detail}`;
      default:
        return `${youType}<p class="pv-detail">${esc(S.blurb || "")}</p>`;
    }
  }

  function render(id) {
    const d = DATA[id], S = window.STUDIO_BY_ID?.[id];
    if (!d || !S) return false;
    el().innerHTML = `<div class="pv-head"><span class="pv-tag">Example</span><b id="pv-title">${esc(S.name)}</b><button type="button" class="pv-x" aria-label="Close example">&times;</button></div>
      <div class="pv-body">${body(id, d)}</div>
      <div class="pv-foot"><span class="pv-note">Illustrative example. Results vary by model and prompt.</span><button type="button" class="btn btn-primary btn-sm pv-try">Make one like this →</button></div>`;
    pv.setAttribute("aria-labelledby", "pv-title");
    pv.setAttribute("aria-label", `Example of ${S.name}`);
    // media loads only when a preview opens (keeps the page fast)
    pv.querySelectorAll("[data-src]").forEach((m) => {
      m.addEventListener("error", () => { if (cur) m.closest(".pv-media, .pv-audio, .pv-kit")?.classList.add("pv-missing"); }, { once: true });
      m.addEventListener(m.tagName === "IMG" ? "load" : "loadedmetadata", () => cur && place(), { once: true }); // re-measure once media has a size
      m.src = m.dataset.src;
    });
    const v = pv.querySelector("video"), pause = pv.querySelector(".pv-pause");
    if (v && pause) {
      const syncV = () => { pause.innerHTML = v.paused ? ICON.play : ICON.pause; pause.setAttribute("aria-label", v.paused ? "Play video" : "Pause video"); };
      v.onplay = v.onpause = syncV;
      pause.onclick = () => (v.paused ? v.play().catch(() => {}) : v.pause());
      if (!CALM) v.play().catch(() => {}); else syncV();
    }
    const snd = pv.querySelector(".pv-sound");
    if (snd && v) snd.onclick = () => { v.muted = !v.muted; snd.setAttribute("aria-pressed", String(!v.muted)); snd.querySelector("span").textContent = v.muted ? "Sound on" : "Sound off"; if (!v.muted) { v.currentTime = 0; v.play().catch(() => {}); } };
    const a = pv.querySelector("audio"), play = pv.querySelector(".pv-play"), bars = pv.querySelector(".pv-audio");
    if (a && play) {
      const sync = () => { const on = !a.paused; bars.classList.toggle("on", on); play.innerHTML = on ? ICON.pause : ICON.play; play.setAttribute("aria-label", on ? "Pause the example" : "Play the example"); };
      play.onclick = () => (a.paused ? a.play().catch(() => bars.classList.add("pv-missing")) : a.pause());
      a.onplay = a.onpause = a.onended = sync;
    }
    pv.querySelector(".pv-x").onclick = () => hide(true);
    pv.querySelector(".pv-try").onclick = () => { const id2 = cur?.id; hide(); onTry && onTry(id2, d.prompt || ""); }; // opens the tool with the example prompt filled in
    return true;
  }

  function place() {
    if (!cur || !pv) return;
    const small = useSheet();
    pv.classList.toggle("sheet", small);
    back.hidden = !small;
    document.body.classList.toggle("pv-lock", small);
    const MIN = 0.75;                                   // never shrink text below 75% (still readable)
    const step = (k) => Math.floor(k * 20) / 20;        // whole 5% steps keep text crisp
    const h0 = pv.scrollHeight + 2, w0 = pv.offsetWidth; // layout size: unaffected by the --pvs transform
    const vw = window.innerWidth, vh = window.innerHeight, M = 8, gap = 12;
    const apply = (k, maxH) => { pv.style.setProperty("--pvs", String(k)); pv.style.maxHeight = maxH ? `${Math.floor(maxH)}px` : "none"; };
    if (small) {
      // bottom panel (phones, touch): shrink to fit the window; only a very short window falls back to scrolling inside
      pv.style.left = pv.style.top = "";
      const k = Math.min(1, step((vh - 16) / h0));
      if (k >= MIN) apply(k); else apply(MIN, (vh - 16) / MIN);
      return;
    }
    // Desktop: the example FLOATS kitty-corner to the card: up and toward its neighbour in the row (right; left for
    // the last card in a row), reaching about halfway across the neighbour. Its bottom edge sits near the top of the
    // card, so the card's title and its "See an example" button stay visible. It never scrolls inside: when there
    // isn't room it is shrunk (CSS transform via --pvs, never below 75%), and otherwise it tries, in order:
    // floating lower (but never over the card's button), floating below the button, sliding fully onto the neighbour.
    const r = cur.anchor.getBoundingClientRect();
    const kMax = Math.min(1, step((vw - 2 * M) / w0));
    const row = [...(cur.anchor.parentElement?.querySelectorAll(".card") || [])]
      .filter((c) => c !== cur.anchor).map((c) => c.getBoundingClientRect()).filter((b) => Math.abs(b.top - r.top) < 8);
    const right = row.filter((b) => b.left >= r.right - 4).sort((a, b) => a.left - b.left)[0];
    const left = row.filter((b) => b.right <= r.left + 4).sort((a, b) => b.right - a.right)[0];
    const dir = right ? 1 : left ? -1 : (vw - r.right > r.left ? 1 : -1) * 0.5; // ±0.5 = alone in its row: lean toward the roomier side
    const nb = dir === 1 ? right : dir === -1 ? left : null;
    const diagX = (k) => {
      const W = w0 * k;
      if (dir === 1) return nb.left + nb.width * 0.5 - W;
      if (dir === -1) return nb.right - nb.width * 0.5;
      return dir > 0 ? r.right - W * 0.4 : r.left - W * 0.6;
    };
    const clampX = (x, k) => Math.min(Math.max(M, x), vw - w0 * k - M);
    const btn = cur.anchor.querySelector(".ex-btn")?.getBoundingClientRect();
    // keep the card's title words and its Example button visible
    const h = cur.anchor.querySelector("h3");
    let title = null;
    if (h) { const rg = document.createRange(); rg.selectNodeContents(h); title = rg.getBoundingClientRect(); }
    // (the last card in a row floats up-LEFT, over its own title; keeping that clear would cover the whole neighbour)
    // Preference order: keep title + button clear; if that's impossible in the diagonal spot, keep only the button clear
    // (covering the hovered card's own title beats covering the whole neighbour).
    const keepBoth = [dir === -1 ? null : title, btn].filter((b) => b && b.width), keepBtn = [btn].filter((b) => b && b.width);
    const clearOf = (keep) => (x, y, k) => {
      const L = clampX(x, k), T = y, R = L + w0 * k, B = y + h0 * k;
      return B <= vh - M + 0.5 && keep.every((b) => R <= b.left - 4 || L >= b.right + 4 || B <= b.top - 4 || T >= b.bottom + 4);
    };
    const target = r.top + r.height * 0.22;                     // ideal bottom edge: just into the card's top
    const sizes = []; for (let k = kMax; k >= MIN - 1e-9; k = Math.round((k - 0.05) * 100) / 100) sizes.push(k);
    let pick = null;
    // 1) above, kitty-corner: the biggest size that floats there without covering the title or the button
    // 2) card near the top of the window: float down-and-across, under the button
    const y0 = Math.max(M, btn ? btn.bottom + 8 : r.bottom + gap);
    for (const clear of [clearOf(keepBoth), clearOf(keepBtn)]) {
      for (const k of sizes) { const y = Math.max(M, target - h0 * k), x = diagX(k); if (clear(x, y, k)) { pick = { k, y, x }; break; } }
      if (!pick) for (const k of sizes) { const x = diagX(k); if (clear(x, y0, k)) { pick = { k, y: y0, x }; break; } }
      if (pick) break;
    }
    // 3) beside the card, fully over the neighbour (only when neither diagonal fits)
    if (!pick) {
      const k = Math.max(MIN, Math.min(kMax, step((vh - 2 * M) / h0))), W = w0 * k, H = h0 * k;
      const y = Math.min(Math.max(M, target - H), vh - H - M);
      for (const x of dir > 0 ? [r.right + gap, r.left - gap - W] : [r.left - gap - W, r.right + gap]) {
        const cx = clampX(x, k);
        if (cx >= r.right + gap - 1 || cx + W <= r.left - gap + 1) { pick = { k, y, x, maxH: H > vh - 2 * M ? (vh - 2 * M) / k : 0 }; break; }
      }
    }
    // 4) a very small window: smallest readable size at the top, scrolling inside only as a last resort
    if (!pick) pick = { k: MIN, y: M, x: diagX(MIN), maxH: (vh - 2 * M) / MIN };
    apply(pick.k, pick.maxH);
    pv.style.left = `${Math.round(clampX(pick.x, pick.k))}px`; pv.style.top = `${Math.round(pick.y)}px`;
  }

  function show(id, anchor, pin = false) {
    clearTimeout(showT); clearTimeout(hideT);
    if (cur && cur.id === id && cur.anchor === anchor) {
      if (pin && !pinned) { pinned = true; pv.classList.add("pinned"); lastFocus = document.activeElement; pv.focus({ preventScroll: true }); setExpanded(true); }
      return;
    }
    if (cur) hide();
    if (!render(id)) return;
    cur = { id, anchor }; pinned = pin;
    pv.classList.toggle("pinned", pin);
    pv.hidden = false;
    document.body.classList.add("pv-open");   // the floating guide steps aside while an example is open
    setExpanded(true);
    place();
    cancelAnimationFrame(raf); raf = requestAnimationFrame(() => pv.classList.add("in"));
    if (pin) { lastFocus = document.activeElement; setTimeout(() => pv.focus({ preventScroll: true }), 30); }
  }
  function setExpanded(on) { cur?.anchor.querySelector(".ex-btn")?.setAttribute("aria-expanded", String(on)); }
  function stopMedia() { pv?.querySelectorAll("video, audio").forEach((m) => { try { m.onerror = null; m.pause(); m.removeAttribute("src"); m.load(); } catch {} }); }
  function hide(restoreFocus) {
    clearTimeout(showT); clearTimeout(hideT);
    if (!pv || !cur) return;
    setExpanded(false);
    const prev = lastFocus;
    cur = null; pinned = false; lastFocus = null;   // cleared first so media "error" events from unloading are ignored
    stopMedia();
    cancelAnimationFrame(raf);
    pv.classList.remove("in"); pv.hidden = true; back.hidden = true;
    document.body.classList.remove("pv-open", "pv-lock");
    if (restoreFocus && prev?.focus) prev.focus({ preventScroll: true });
  }
  function scheduleHide() { clearTimeout(hideT); hideT = setTimeout(() => hide(), HIDE_DELAY); }

  const warmed = new Set();
  function warm(id) { const d = DATA[id], u = d && (d.poster || (d.kind === "image" ? d.src : d.logo)); if (u && !warmed.has(u)) { warmed.add(u); new Image().src = u; } }

  // Wire one card. card = the studio card element, btn = its "Example" button.
  function attach(card, id, btn) {
    if (!DATA[id]) { btn?.remove(); return; }
    if (btn) { btn.setAttribute("aria-haspopup", "dialog"); btn.setAttribute("aria-expanded", "false"); }
    // Hover only for a real mouse (touchscreen laptops send touch taps too) and only where a popover fits.
    card.addEventListener("pointerenter", (e) => {
      if (e.pointerType !== "mouse" || useSheet()) return;
      clearTimeout(hideT); clearTimeout(showT); if (pinned) return;
      warm(id); // fetch the still picture now so the popover opens with it ready
      showT = setTimeout(() => show(id, card), cur ? SWITCH_DELAY : SHOW_DELAY);
    });
    card.addEventListener("pointerleave", (e) => { if (e.pointerType !== "mouse") return; clearTimeout(showT); if (!pinned) scheduleHide(); });
    if (btn) btn.addEventListener("click", (e) => { e.preventDefault(); e.stopPropagation(); (cur?.id === id && pinned) ? hide(true) : show(id, card, true); });
  }

  window.BCAI_PREVIEW = { attach, hide, has: (id) => Boolean(DATA[id]), canHover: CAN_HOVER, sheet: useSheet, onTry: (fn) => (onTry = fn) };
})();
