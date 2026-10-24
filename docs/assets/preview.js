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
    window.addEventListener("scroll", () => { if (!cur) return; if (!pinned && offscreen()) hide(); else place(); }, { passive: true });
    window.addEventListener("resize", () => cur && place());
    if (window.ResizeObserver) new ResizeObserver(() => cur && place()).observe(pv); // images load → taller → re-fit on screen
    return pv;
  }
  const offscreen = () => { const r = cur.anchor.getBoundingClientRect(); return r.bottom < 0 || r.top > window.innerHeight; };

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
    if (small) { pv.style.left = pv.style.top = ""; return; }
    const r = cur.anchor.getBoundingClientRect(), w = pv.offsetWidth, h = pv.offsetHeight, gap = 10, vw = window.innerWidth, vh = window.innerHeight;
    let left = r.right + gap;
    if (left + w > vw - 8) left = r.left - w - gap;           // not enough room on the right → left side
    if (left < 8) left = Math.min(Math.max(8, r.left + r.width / 2 - w / 2), vw - w - 8); // neither → centred on the card
    let top = left === r.right + gap || left === r.left - w - gap ? r.top : r.bottom + gap;
    top = Math.min(Math.max(8, top), vh - h - 8);
    pv.style.left = `${Math.round(left)}px`; pv.style.top = `${Math.round(top)}px`;
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

  window.BCAI_PREVIEW = { attach, hide, has: (id) => Boolean(DATA[id]), canHover: CAN_HOVER, onTry: (fn) => (onTry = fn) };
})();
