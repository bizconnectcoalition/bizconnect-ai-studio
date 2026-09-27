/* Shared creation controls — used by the home-page quick panel ("simple") and full studio pages ("full"). */
(function () {
  "use strict";
  const { esc, $ } = BCAI;

  // Default engine for beginners: the balanced/fast pick that gives good results cheaply.
  const DEFAULT_ENGINE = { chat: "gemini-flash", translate: "gemini-flash", deck: "gemini-flash", outreach: "gemini-flash", brand: "gemini-flash", image: "flux-dev", video: "ltx", voice: "kokoro", avatar: "fabric-480", music: "lyria" };

  function seg(name, values, current, labels) {
    return `<div class="seg" data-seg="${name}">${values.map((v, i) => `<button type="button" data-v="${esc(v)}" class="${String(v) === String(current) ? "on" : ""}">${esc(labels ? labels[i] : v)}</button>`).join("")}</div>`;
  }

  function build(studioId, mode, host, onChange) {
    const S = STUDIO_BY_ID[studioId];
    const cat = BCAI.catalog;
    const engines = cat.studios[studioId];
    const st = { engine: DEFAULT_ENGINE[studioId] || engines[0].id, count: 1, aspect: studioId === "video" ? "16:9" : "1:1", duration: null, audio: true, voiceEngine: "kokoro", voice: null, speed: 1, language: "Spanish", tone: "natural", slides: 7, audience: "", offer: "", genre: "", mood: "", lyrics: "", style: "", persona: "", imageUrl: null, imageName: "" };
    const eng = () => BCAI.engineFor(studioId, st.engine);
    const full = mode === "full";

    function engineList() {
      return `<div class="field"><span class="label">AI engine</span><div class="engines">${engines.map((e) => `
        <button type="button" class="engine ${e.id === st.engine ? "on" : ""}" data-engine="${e.id}">
          <span class="dot"></span>
          <span><b>${esc(e.label)}<span class="tier ${e.tier}">${e.tier}</span></b><small>${esc(e.maker)} · ${esc(e.desc)}</small></span>
          <span class="cost">${esc(BCAI.unitLabel(studioId, e))}</span>
        </button>`).join("")}</div></div>`;
    }

    function optionsHTML() {
      const e = eng();
      const parts = [];
      if (studioId === "image") {
        parts.push(`<div class="field"><span class="label">Shape</span>${seg("aspect", ["1:1", "16:9", "9:16", "4:3"], st.aspect, ["Square", "Wide 16:9", "Story 9:16", "Classic 4:3"])}</div>`);
        if (full) {
          parts.push(`<div class="field"><span class="label">Style</span>${seg("style", ["", ...S.styles], st.style, ["Auto", ...S.styles])}</div>`);
          parts.push(`<div class="field"><span class="label">Variations</span>${seg("count", [1, 2, 4], st.count, ["1 image", "2 options", "4 options"])}</div>`);
        }
      }
      if (studioId === "video") {
        if (!e.durations.includes(Number(st.duration))) st.duration = e.durations[0];
        parts.push(`<div class="field"><span class="label">Length</span>${seg("duration", e.durations, st.duration, e.durations.map((d) => d + " sec"))}</div>`);
        if (e.aspects.length) { if (!e.aspects.includes(st.aspect)) st.aspect = e.aspects[0]; parts.push(`<div class="field"><span class="label">Shape</span>${seg("aspect", e.aspects, st.aspect, e.aspects.map((a) => ({ "16:9": "Wide 16:9", "9:16": "Story 9:16", "1:1": "Square" }[a])))}</div>`); }
        if (full && e.audio === "optional") parts.push(`<div class="field"><span class="label">Sound</span>${seg("audio", ["true", "false"], String(st.audio), ["With sound", "Silent (cheaper)"])}</div>`);
        if (full && e.photo) parts.push(`<div class="field"><span class="label">Start from a photo (optional)</span><label class="drop">${st.imageUrl ? `<img src="${esc(st.imageUrl)}" alt="">` : ""}${st.imageUrl ? "Photo attached · click to change" : "Drop or choose a photo to animate"}<input type="file" accept="image/*" data-upload="imageUrl"></label>${st.imageUrl ? `<button type="button" class="linkish" data-clear="imageUrl">Remove photo</button>` : ""}</div>`);
      }
      if (studioId === "voice" || studioId === "avatar") {
        const vEngId = studioId === "voice" ? st.engine : st.voiceEngine;
        const vEng = cat.voiceEngines.find((v) => v.id === vEngId) || cat.voiceEngines[0];
        if (!vEng.voices.some((v) => v[0] === st.voice)) st.voice = vEng.voices[0][0];
        if (studioId === "avatar" && full) parts.push(`<div class="field"><span class="label">Voice quality</span>${seg("voiceEngine", cat.voiceEngines.map((v) => v.id), st.voiceEngine, cat.voiceEngines.map((v) => v.label))}</div>`);
        parts.push(`<div class="field"><label>Voice</label><select class="input" data-f="voice">${vEng.voices.map((v) => `<option value="${esc(v[0])}" ${v[0] === st.voice ? "selected" : ""}>${esc(v[1])}</option>`).join("")}</select></div>`);
        if (studioId === "voice" && full) parts.push(`<div class="field"><span class="label">Pace</span>${seg("speed", ["0.9", "1", "1.1"], String(st.speed), ["Relaxed", "Normal", "Brisk"])}</div>`);
        if (studioId === "avatar") parts.push(`<div class="field"><span class="label">Presenter</span><label class="drop"><img src="${esc(st.imageUrl || "assets/img/allie-avatar-sm.jpg")}" alt="">${st.imageUrl ? "Your photo · click to change" : "Allie (default) · click to use your own photo"}<input type="file" accept="image/*" data-upload="imageUrl"></label>${st.imageUrl ? `<button type="button" class="linkish" data-clear="imageUrl">Use Allie instead</button>` : ""}<small class="muted" style="font-size:11.5px">Use a clear, front-facing head-and-shoulders photo.</small></div>`);
      }
      if (studioId === "music") {
        if (full) {
          parts.push(`<div class="field"><span class="label">Genre</span>${seg("genre", ["", ...S.genres], st.genre, ["Any", ...S.genres])}</div>`);
          parts.push(`<div class="field"><span class="label">Mood</span>${seg("mood", ["", ...S.moods], st.mood, ["Any", ...S.moods])}</div>`);
          if (st.engine === "minimax-song") parts.push(`<div class="field"><label>Lyrics (optional, or AI writes them)</label><textarea class="input" data-f="lyrics" placeholder="[Verse]&#10;…&#10;[Chorus]&#10;…">${esc(st.lyrics)}</textarea></div>`);
        } else {
          parts.push(`<div class="field"><span class="label">Type</span>${seg("engine", ["lyria", "minimax-song"], st.engine, ["Instrumental", "Song with vocals"])}</div>`);
        }
      }
      if (studioId === "translate") {
        parts.push(`<div class="field"><label>Translate into</label><select class="input" data-f="language">${S.languages.map((l) => `<option ${l === st.language ? "selected" : ""}>${esc(l)}</option>`).join("")}</select></div>`);
        if (full) parts.push(`<div class="field"><span class="label">Tone</span>${seg("tone", ["natural", "formal", "friendly", "marketing"], st.tone, ["Natural", "Formal", "Friendly", "Marketing"])}</div>`);
      }
      if (studioId === "deck" && full) {
        parts.push(`<div class="field"><span class="label">Number of slides</span>${seg("slides", [5, 7, 10], st.slides, ["5", "7", "10"])}</div>`);
        parts.push(`<div class="field"><label>Audience</label><input class="input" data-f="audience" placeholder="e.g. office managers, new members, investors" value="${esc(st.audience)}"></div>`);
      }
      if (studioId === "outreach" && full) parts.push(`<div class="field"><label>What you offer (optional)</label><textarea class="input" data-f="offer" placeholder="e.g. I run a commercial cleaning company serving offices in Bucks County.">${esc(st.offer)}</textarea></div>`);
      if (studioId === "chat" && full) parts.push(`<div class="field"><span class="label">Assistant style</span>${seg("persona", ["", ...S.personas], st.persona, ["General", ...S.personas])}</div>`);
      return parts.join("");
    }

    function render() {
      const opts = optionsHTML();
      if (full) {
        const simpleOpts = [], adv = [];
        host.innerHTML = `${engineList()}<div class="stack" data-opts>${opts}</div>`;
      } else {
        host.innerHTML = opts ? `<div class="quick-opts" style="display:flex;gap:14px;flex-wrap:wrap;margin-top:12px">${opts}</div>` : "";
      }
      wire();
      onChange && onChange();
    }

    function wire() {
      host.querySelectorAll("[data-engine]").forEach((b) => (b.onclick = () => { st.engine = b.dataset.engine; render(); }));
      host.querySelectorAll("[data-seg]").forEach((g) => g.querySelectorAll("button").forEach((b) => (b.onclick = () => {
        const k = g.dataset.seg, v = b.dataset.v;
        st[k] = k === "count" || k === "duration" || k === "slides" ? Number(v) : k === "audio" ? v === "true" : k === "speed" ? Number(v) : v;
        render();
      })));
      host.querySelectorAll("[data-f]").forEach((i) => (i.oninput = i.onchange = () => { st[i.dataset.f] = i.value; onChange && onChange(); }));
      host.querySelectorAll("[data-upload]").forEach((inp) => (inp.onchange = async () => {
        const f = inp.files[0]; if (!f) return;
        const lab = inp.closest(".drop"); lab.firstChild && (lab.style.opacity = ".6");
        try { st[inp.dataset.upload] = await BCAI.upload(f); } catch (e) { alert(e.message); }
        render();
      }));
      host.querySelectorAll("[data-clear]").forEach((b) => (b.onclick = () => { st[b.dataset.clear] = null; render(); }));
    }

    function options() {
      const o = {};
      if (studioId === "image") Object.assign(o, { aspect: st.aspect, count: st.count, style: st.style });
      if (studioId === "video") Object.assign(o, { duration: st.duration, aspect: st.aspect, audio: st.audio, imageUrl: st.imageUrl || undefined });
      if (studioId === "voice") Object.assign(o, { voice: st.voice, speed: st.speed });
      if (studioId === "avatar") Object.assign(o, { voiceEngine: st.voiceEngine, voice: st.voice, imageUrl: st.imageUrl || undefined });
      if (studioId === "music") Object.assign(o, { genre: st.genre, mood: st.mood, lyrics: st.lyrics });
      if (studioId === "translate") Object.assign(o, { language: st.language, tone: st.tone });
      if (studioId === "deck") Object.assign(o, { slides: st.slides, audience: st.audience });
      if (studioId === "outreach") Object.assign(o, { offer: st.offer });
      if (studioId === "chat" && st.persona) o.persona = st.persona;
      return o;
    }

    render();
    return { state: st, options, engine: () => st.engine, price: (prompt) => BCAI.credits(studioId, st.engine, options(), prompt), rerender: render };
  }

  window.BCAI_CONTROLS = { build, DEFAULT_ENGINE };
})();
