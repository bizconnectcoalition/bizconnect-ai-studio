/* AI Studio — example previews on the studio cards.
   Desktop: rest the mouse on a card for a moment → a popover shows "You type → You get" for that tool.
   Phones/tablets (no hover) and keyboards: the card's "Example" button opens the same preview
   (a bottom sheet on small screens). Data: CORE_PREVIEWS (assets/previews.js) + BRAND.previews. */
(function () {
  "use strict";
  const { esc } = BCAI;
  const B = BCAI.brand;
  const DATA = { ...(window.CORE_PREVIEWS || {}), ...((B && B.previews) || {}) };
  const CAN_HOVER = window.matchMedia?.("(hover: hover) and (pointer: fine)").matches;
  const SHOW_DELAY = 280, HIDE_DELAY = 220;
  let pv = null, cur = null, showT = null, hideT = null, pinned = false, onTry = null, lastFocus = null;

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
    pv.hidden = true;
    document.body.appendChild(pv);
    pv.addEventListener("mouseenter", () => clearTimeout(hideT));
    pv.addEventListener("mouseleave", () => { if (!pinned) scheduleHide(); });
    document.addEventListener("keydown", (e) => { if (e.key === "Escape" && cur) hide(true); });
    document.addEventListener("pointerdown", (e) => { if (cur && pinned && !pv.contains(e.target) && !e.target.closest?.(".ex-btn")) hide(); });
    window.addEventListener("scroll", () => { if (cur && !pinned) hide(); else if (cur) place(); }, { passive: true });
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
    switch (d.kind) {
      case "chat":
        return `${youGet("The AI replies")}<div class="pv-chat"><div class="pv-bubble me">${esc(d.prompt)}</div><div class="pv-bubble ai">${esc(d.reply)}</div></div>`;
      case "image":
        return `${youType}${youGet()}<div class="pv-media"><img data-src="${esc(d.src)}" alt="${esc(d.alt || "Example result")}"></div>${detail}`;
      case "video":
        return `${youType}${youGet()}<div class="pv-media pv-vid"><video data-src="${esc(d.src)}" ${d.poster ? `poster="${esc(d.poster)}"` : ""} muted loop playsinline preload="none"></video>${d.sound ? `<button type="button" class="pv-sound" aria-pressed="false">${ICON.sound}<span>Sound on</span></button>` : ""}</div>${detail}`;
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
    el().innerHTML = `<div class="pv-head"><span class="pv-tag">Example</span><b>${esc(S.name)}</b><button type="button" class="pv-x" aria-label="Close example">&times;</button></div>
      <div class="pv-body">${body(id, d)}</div>
      <div class="pv-foot"><button type="button" class="btn btn-primary btn-sm pv-try">Try ${esc(S.name)} yourself →</button></div>`;
    pv.setAttribute("aria-label", `Example of ${S.name}`);
    // media loads only when a preview opens (keeps the page fast)
    pv.querySelectorAll("[data-src]").forEach((m) => {
      m.addEventListener("error", () => m.closest(".pv-media, .pv-audio, .pv-kit")?.classList.add("pv-missing"), { once: true });
      m.src = m.dataset.src;
    });
    const v = pv.querySelector("video");
    if (v) v.play().catch(() => {});
    const snd = pv.querySelector(".pv-sound");
    if (snd && v) snd.onclick = () => { v.muted = !v.muted; snd.setAttribute("aria-pressed", String(!v.muted)); snd.querySelector("span").textContent = v.muted ? "Sound on" : "Sound off"; if (!v.muted) v.play().catch(() => {}); };
    const a = pv.querySelector("audio"), play = pv.querySelector(".pv-play"), bars = pv.querySelector(".pv-audio");
    if (a && play) {
      const sync = () => { const on = !a.paused; bars.classList.toggle("on", on); play.innerHTML = on ? ICON.pause : ICON.play; play.setAttribute("aria-label", on ? "Pause the example" : "Play the example"); };
      play.onclick = () => (a.paused ? a.play().catch(() => bars.classList.add("pv-missing")) : a.pause());
      a.onplay = a.onpause = a.onended = sync;
    }
    pv.querySelector(".pv-x").onclick = () => hide(true);
    pv.querySelector(".pv-try").onclick = () => { const id2 = cur?.id; hide(); onTry && onTry(id2); };
    return true;
  }

  function place() {
    if (!cur || !pv) return;
    const small = window.innerWidth <= 720;
    pv.classList.toggle("sheet", small);
    if (small) { pv.style.left = pv.style.top = ""; return; }
    const r = cur.anchor.getBoundingClientRect(), w = pv.offsetWidth, h = pv.offsetHeight, gap = 12, vw = window.innerWidth, vh = window.innerHeight;
    let left = r.right + gap;
    if (left + w > vw - 8) left = r.left - w - gap;           // not enough room on the right → left side
    if (left < 8) left = Math.min(Math.max(8, r.left + r.width / 2 - w / 2), vw - w - 8); // neither → centred on the card
    let top = left === r.right + gap || left === r.left - w - gap ? r.top : r.bottom + gap;
    top = Math.min(Math.max(8, top), vh - h - 8);
    pv.style.left = `${Math.round(left)}px`; pv.style.top = `${Math.round(top)}px`;
  }

  function show(id, anchor, pin = false) {
    clearTimeout(showT); clearTimeout(hideT);
    if (cur && cur.id === id && cur.anchor === anchor) { if (pin) { pinned = true; pv.classList.add("pinned"); } return; }
    stopMedia();
    if (!render(id)) return;
    cur = { id, anchor }; pinned = pin;
    pv.classList.toggle("pinned", pin);
    pv.hidden = false;
    place();
    requestAnimationFrame(() => pv.classList.add("in"));
    if (pin) { lastFocus = document.activeElement; setTimeout(() => pv.querySelector(".pv-try")?.focus({ preventScroll: true }), 50); }
  }
  function stopMedia() { pv?.querySelectorAll("video, audio").forEach((m) => { try { m.pause(); m.removeAttribute("src"); m.load(); } catch {} }); }
  function hide(restoreFocus) {
    clearTimeout(showT); clearTimeout(hideT);
    if (!pv || !cur) return;
    stopMedia();
    pv.classList.remove("in"); pv.hidden = true; cur = null; pinned = false;
    if (restoreFocus && lastFocus?.focus) lastFocus.focus({ preventScroll: true });
    lastFocus = null;
  }
  function scheduleHide() { clearTimeout(hideT); hideT = setTimeout(() => hide(), HIDE_DELAY); }

  // Wire one card. card = the studio card element, btn = its "Example" button.
  function attach(card, id, btn) {
    if (!DATA[id]) { btn?.remove(); return; }
    if (CAN_HOVER) {
      card.addEventListener("mouseenter", () => { clearTimeout(hideT); clearTimeout(showT); showT = setTimeout(() => show(id, card), cur ? 60 : SHOW_DELAY); });
      card.addEventListener("mouseleave", () => { clearTimeout(showT); if (!pinned) scheduleHide(); });
    }
    if (btn) btn.addEventListener("click", (e) => { e.preventDefault(); e.stopPropagation(); (cur?.id === id && pinned) ? hide(true) : show(id, card, true); });
  }

  window.BCAI_PREVIEW = { attach, hide, has: (id) => Boolean(DATA[id]), onTry: (fn) => (onTry = fn) };
})();
