/* BizConnect AI Studio — voice input for every text box.
   Tap the mic and talk. It stops by itself when you pause (or tap ■). Words appear live where the
   browser supports it, then a Whisper transcript polishes them. Nothing is ever lost: Undo is offered. */
(function () {
  "use strict";
  if (!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia && window.MediaRecorder)) return;
  const mobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  const Live = !mobile ? (window.SpeechRecognition || window.webkitSpeechRecognition || null) : null; // live words on desktop only (mobile mics can't be shared)
  const SKIP_TYPES = new Set(["password", "email", "hidden", "number", "file", "checkbox", "radio", "range", "color", "date", "time", "submit", "button", "search"]);
  const MAX_MS = 90000, WARN_MS = 80000, SILENCE_MS = 3500, NO_SPEECH_MS = 12000;
  const ICON_MIC = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3a3 3 0 0 0-3 3v6a3 3 0 0 0 6 0V6a3 3 0 0 0-3-3Z"/><path d="M19 11a7 7 0 0 1-14 0M12 18v3"/></svg>';
  const ICON_STOP = '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="7" y="7" width="10" height="10" rx="2" fill="currentColor"/></svg>';
  let active = null, starting = false;

  // ---------- announcements (screen readers) + toast (everyone) ----------
  const sr = document.createElement("div");
  sr.className = "sr-only"; sr.setAttribute("role", "status"); sr.setAttribute("aria-live", "polite");
  const say = (m) => { sr.textContent = ""; setTimeout(() => (sr.textContent = m), 30); };
  function toast(msg, action) {
    let t = document.querySelector(".mic-toast");
    if (!t) { t = document.createElement("div"); t.className = "mic-toast"; document.body.appendChild(t); }
    t.innerHTML = "";
    const span = document.createElement("span"); span.textContent = msg; t.appendChild(span);
    if (action) { const b = document.createElement("button"); b.type = "button"; b.textContent = action.label; b.onclick = () => { action.fn(); t.classList.remove("show"); }; t.appendChild(b); }
    t.classList.add("show"); say(msg);
    clearTimeout(t._h); t._h = setTimeout(() => t.classList.remove("show"), action ? 7000 : 4500);
  }

  const pickMime = () => ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg;codecs=opus"].find((m) => MediaRecorder.isTypeSupported?.(m)) || "";
  const blobToDataUrl = (blob) => new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = rej; r.readAsDataURL(blob); });
  const signedIn = () => { try { return !!localStorage.getItem("bcai_token"); } catch { return false; } };

  // Wake the speech model early (free) so the first transcript is quick.
  let lastWarm = 0;
  function warm() {
    if (!signedIn() || Date.now() - lastWarm < 240000 || !window.BCAI) return;
    lastWarm = Date.now();
    window.BCAI.api("/api/transcribe", { warm: true }).catch(() => {});
  }

  // ---------- write text at the caret (or at the end if the box was never clicked) ----------
  function makeWriter(el) {
    const v = el.value || "";
    const focused = document.activeElement === el;
    const start = focused ? el.selectionStart ?? v.length : v.length;
    const end = focused ? el.selectionEnd ?? v.length : v.length;
    const before = v.slice(0, start), after = v.slice(end);
    const joinL = before && !/\s$/.test(before) ? " " : "";
    const joinR = after && !/^\s/.test(after) ? " " : "";
    const w = (text, final) => {
      const t = String(text || "").trim();
      const mid = t ? joinL + t + joinR : "";
      el.value = before + mid + after;
      w.last = el.value;
      if (final) {
        const pos = (before + mid).length;
        try { el.setSelectionRange(pos, pos); } catch {}
        el.dispatchEvent(new Event("input", { bubbles: true }));
        el.dispatchEvent(new Event("change", { bubbles: true }));
      }
      if (el.tagName === "TEXTAREA") el.scrollTop = el.scrollHeight;
    };
    w.original = v;
    w.last = v;
    return w;
  }

  function setState(ui, state) {
    const { btn, pill, el } = ui;
    btn.classList.toggle("rec", state === "rec");
    btn.classList.toggle("busy", state === "busy");
    btn.innerHTML = state === "rec" ? ICON_STOP : state === "busy" ? '<span class="mic-spin"></span>' : ICON_MIC;
    const label = { rec: "Stop recording", busy: "Polishing your words, please wait", idle: "Speak instead of typing" }[state];
    btn.setAttribute("aria-label", label); btn.title = state === "rec" ? "Tap to stop (Esc cancels)" : label;
    pill.className = "mic-pill" + (state === "rec" ? " rec show" : state === "busy" ? " busy show" : "");
    pill.textContent = state === "rec" ? "● Listening… tap ■ when done" : state === "busy" ? "Polishing your words…" : "";
    el.classList.toggle("mic-listening", state === "rec");
    el.setAttribute("aria-busy", state === "busy" ? "true" : "false");
  }

  // ---------- one recording session ----------
  async function start(ui) {
    const { el, btn } = ui;
    if (active) { active.stop(); return; }
    if (starting) return;
    if (!signedIn()) { toast("Please sign in first to use voice input."); return; }
    starting = true;
    let stream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } });
    } catch (e) {
      toast(e && e.name === "NotAllowedError"
        ? "Your microphone is turned off for this site. Click the icon just left of the web address, turn Microphone on, then tap the mic again."
        : "We couldn't find a microphone on this device.");
      return;
    } finally { starting = false; }

    warm();
    const write = makeWriter(el);
    const mime = pickMime();
    let rec;
    try {
      rec = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
    } catch {
      stream.getTracks().forEach((t) => t.stop());
      toast("Voice input isn't supported in this browser. Try Chrome, Edge or Safari.");
      return;
    }
    const chunks = [];
    rec.ondataavailable = (e) => e.data && e.data.size && chunks.push(e.data);
    const wasReadOnly = el.readOnly;
    el.readOnly = true; // nothing typed or clicked in can be overwritten while listening

    let recording = true, cancelled = false, heard = false, liveFinal = "", liveInterim = "";
    let live = null;
    if (Live) {
      try {
        live = new Live();
        live.continuous = true; live.interimResults = true; live.lang = navigator.language || "en-US";
        live.onresult = (ev) => {
          if (!recording) return;
          liveInterim = "";
          for (let i = ev.resultIndex; i < ev.results.length; i++) {
            const r = ev.results[i];
            if (r.isFinal) liveFinal += r[0].transcript + " "; else liveInterim += r[0].transcript;
          }
          if ((liveFinal + liveInterim).trim()) heard = true;
          write(liveFinal + liveInterim, false);
        };
        live.onerror = () => {};
        live.start();
      } catch { live = null; }
    }

    // Auto-stop after a pause. Threshold adapts to the room's background noise.
    const t0 = Date.now();
    let ac = null, iv = null, quietSince = 0, floor = 0, floorN = 0, warned = false;
    try {
      ac = new (window.AudioContext || window.webkitAudioContext)();
      if (ac.state === "suspended") await ac.resume().catch(() => {});
      if (ac.state === "running") {
        const an = ac.createAnalyser(); an.fftSize = 1024;
        ac.createMediaStreamSource(stream).connect(an);
        const buf = new Uint8Array(an.fftSize);
        iv = setInterval(() => {
          if (!el.isConnected) { cancelled = true; session.stop(); return; }
          an.getByteTimeDomainData(buf);
          let sum = 0; for (let i = 0; i < buf.length; i++) { const x = (buf[i] - 128) / 128; sum += x * x; }
          const rms = Math.sqrt(sum / buf.length);
          const now = Date.now();
          if (now - t0 < 400) { floor += rms; floorN++; return; }
          const thr = Math.max(0.018, (floorN ? floor / floorN : 0.01) * 2.5);
          btn.style.setProperty("--lvl", Math.min(1, rms * 9).toFixed(2));
          if (rms > thr) { heard = true; quietSince = 0; } else if (!quietSince) quietSince = now;
          if (!warned && now - t0 > WARN_MS) { warned = true; toast("Still listening. 10 seconds left."); }
          if ((heard && quietSince && now - quietSince > SILENCE_MS) || (!heard && now - t0 > NO_SPEECH_MS) || now - t0 > MAX_MS) session.stop();
        }, 100);
      }
    } catch {}
    if (!iv) iv = setInterval(() => { if (!el.isConnected) { cancelled = true; session.stop(); } else if (Date.now() - t0 > MAX_MS) session.stop(); }, 250);

    const onKey = (e) => { if (e.key === "Escape") { cancelled = true; session.stop(); e.preventDefault(); e.stopPropagation(); } };
    document.addEventListener("keydown", onKey, true);
    const session = { el, stop() { if (rec.state !== "inactive") rec.stop(); } };
    active = session;
    setState(ui, "rec");
    say("Listening. Speak now. Pause when you're done.");

    rec.onstop = async () => {
      recording = false;
      clearInterval(iv);
      try { ac && ac.close(); } catch {}
      stream.getTracks().forEach((t) => t.stop());
      if (live) { live.onresult = null; try { live.abort(); } catch {} }
      document.removeEventListener("keydown", onKey, true);
      active = null;
      btn.style.removeProperty("--lvl");
      const quick = (liveFinal + liveInterim).trim();
      const restore = () => { el.value = write.original; el.dispatchEvent(new Event("input", { bubbles: true })); };

      if (cancelled) {
        el.readOnly = wasReadOnly; restore(); setState(ui, "idle");
        if (el.isConnected) toast("Cancelled. Nothing was added.");
        return;
      }
      const durMs = Date.now() - t0;
      if (!chunks.length || (!heard && !quick && durMs < 1500)) {
        el.readOnly = wasReadOnly; restore(); setState(ui, "idle");
        toast("I didn't catch anything. Tap the mic and try again.");
        return;
      }
      // Show what we heard right away; the box stays usable if we already have live words.
      if (quick) { write(quick, true); el.readOnly = wasReadOnly; }
      setState(ui, "busy"); say("Polishing your words.");
      const shown = el.value;
      let finalText = quick;
      try {
        const blob = new Blob(chunks, { type: rec.mimeType || mime || "audio/webm" });
        const d = await window.BCAI.api("/api/transcribe", { dataUrl: await blobToDataUrl(blob), lang: (navigator.language || "en").slice(0, 2) });
        if (d.text) finalText = d.text;
      } catch {}
      el.readOnly = wasReadOnly;
      setState(ui, "idle");
      if (!el.isConnected) return;
      if (el.value !== shown && quick) { say("Done."); return; } // they already edited the live text: leave it alone
      if (!finalText) { restore(); toast("I didn't catch anything. Tap the mic and try again."); return; }
      if (finalText !== quick || !quick) write(finalText, true);
      toast("Text added.", { label: "Undo", fn: () => { restore(); el.focus(); } });
      if (document.activeElement === document.body || document.activeElement === btn) el.focus();
    };
    rec.start(250);
  }

  // Don't let a form be submitted with half-dictated text: stop listening first.
  document.addEventListener("submit", (e) => {
    if (active && e.target.contains(active.el)) { e.preventDefault(); e.stopImmediatePropagation(); active.stop(); }
  }, true);

  // ---------- attach a mic button to every eligible field ----------
  function eligible(el) {
    if (el.dataset.mic === "off" || el.dataset.micReady) return false;
    if (el.tagName === "INPUT" && SKIP_TYPES.has((el.type || "text").toLowerCase())) return false;
    if (el.readOnly || el.disabled) return false;
    if (el.closest(".gate, .copybox, [data-mic-off]")) return false;
    return true;
  }
  let hinted = false;
  try { hinted = localStorage.getItem("bcai_mic_hint") === "1"; } catch {}
  function hint(wrap) {
    if (hinted || !signedIn()) return;
    hinted = true;
    try { localStorage.setItem("bcai_mic_hint", "1"); } catch {}
    const h = document.createElement("div");
    h.className = "mic-hint"; h.setAttribute("role", "note");
    h.innerHTML = "<b>New:</b> tap the mic and just talk. We'll type it for you. <button type='button' aria-label='Dismiss'>×</button>";
    wrap.appendChild(h);
    const kill = () => h.remove();
    h.querySelector("button").onclick = kill;
    setTimeout(kill, 7000);
  }
  function attach(el) {
    if (!eligible(el)) return;
    const cs = getComputedStyle(el);
    if (cs.display === "none") return;
    el.dataset.micReady = "1";
    const wrap = document.createElement("span");
    wrap.className = "mic-wrap" + (el.tagName === "TEXTAREA" ? " ta" : "");
    wrap.style.flex = cs.flex;
    el.parentNode.insertBefore(wrap, el);
    wrap.appendChild(el);
    const btn = document.createElement("button");
    btn.type = "button"; btn.className = "mic-btn";
    const pill = document.createElement("span");
    pill.className = "mic-pill"; pill.setAttribute("aria-hidden", "true");
    const ui = { el, btn, pill };
    setState(ui, "idle");
    btn.addEventListener("mousedown", (e) => e.preventDefault()); // keep the caret where it is
    btn.addEventListener("pointerenter", warm, { passive: true });
    btn.addEventListener("click", (e) => { e.preventDefault(); e.stopPropagation(); if (btn.classList.contains("busy")) return; start(ui); });
    el.addEventListener("focus", warm, { passive: true });
    wrap.appendChild(pill);
    wrap.appendChild(btn);
    if (el.tagName === "TEXTAREA" || el.id === "ask-in" || el.name === "p") hint(wrap);
  }
  function scan(root) { (root.querySelectorAll ? root : document).querySelectorAll("textarea, input").forEach(attach); }
  const mo = new MutationObserver((muts) => { for (const m of muts) m.addedNodes.forEach((n) => n.nodeType === 1 && (n.matches?.("textarea, input") ? attach(n) : scan(n))); });
  function init() {
    document.body.appendChild(sr);
    scan(document);
    mo.observe(document.body, { childList: true, subtree: true });
    setTimeout(warm, 1500);
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init); else init();
})();
