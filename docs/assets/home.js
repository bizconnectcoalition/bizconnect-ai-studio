/* Home page: studio cards + inline quick-create panel. */
(function () {
  "use strict";
  const { esc, $, svg } = BCAI;
  BCAI.header("home");
  BCAI.footer();
  BCAI.guide();

  const grid = $("#cards");
  let openId = null;

  // Simple mode = the brand's starter tools (bigger cards) + a button for the rest; Advanced = every studio.
  function drawCards() {
    const list = BCAI.visibleStudios();
    const simple = BCAI.mode() === "simple";
    grid.classList.toggle("simple", simple);
    grid.style.setProperty("--simple-cols", Math.min(list.length, 4));
    const total = STUDIOS.length;
    $("#studio-count").parentElement.innerHTML = simple
      ? `<b id="studio-count">${list.length}</b> starter tools · ${total - list.length} more a click away`
      : `<b id="studio-count">${total}</b> creative tools`;
    // Card = a plain container; its title is the real button, stretched over the whole card (CSS ::after),
    // so the separate "Example" button never sits inside another button.
    BCAI_PREVIEW.hide();
    const exLabel = simple ? "See an example" : "Example";
    grid.innerHTML = list.map((s) => `
      <div class="card" data-id="${s.id}">
        <span class="ico tile"${BCAI.tileStyle(s)}>${BCAI.art(s)}</span>
        <h3><button type="button" class="card-hit" aria-expanded="false">${esc(s.name)}</button></h3>
        <p>${esc(s.tagline)}</p>
        ${simple ? `<p class="card-blurb">${esc(s.blurb)}</p>` : ""}
        <div class="card-foot"><span class="price" data-price="${s.id}"></span>${BCAI_PREVIEW.has(s.id) ? `<button type="button" class="ex-btn${simple ? " big" : ""}" aria-label="See an example of ${esc(s.name)}"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5v14l11-7z" fill="currentColor"/></svg>${exLabel}</button>` : ""}</div>
      </div>`).join("");
    grid.querySelectorAll(".card").forEach((c) => {
      c.querySelector(".card-hit").onclick = () => { BCAI_PREVIEW.hide(); toggle(c.dataset.id); };
      BCAI_PREVIEW.attach(c, c.dataset.id, c.querySelector(".ex-btn"));
    });
    $("#hover-hint").textContent = list.some((s) => BCAI_PREVIEW.has(s.id))
      ? (BCAI_PREVIEW.canHover ? "Rest your mouse on any card to see an example of what it makes." : "Tap ▶ Example on any card to see what it makes.") : "";
    openId = null;
    const more = $("#more-tools");
    const starters = BCAI.simpleIds().map((id) => STUDIO_BY_ID[id].name).join(", ");
    more.innerHTML = !BCAI.hasSimple() ? "" : simple
      ? `<button type="button" class="btn btn-ghost more-btn" data-go="advanced"><span>See all ${total} tools →</span><small class="muted">${esc(STUDIOS.filter((s) => !list.includes(s)).map((s) => s.name).join(" · "))}</small></button>`
      : `<button type="button" class="linkish" data-go="simple">← Back to Simple (${esc(starters)})</button>`;
    const go = more.querySelector("[data-go]");
    if (go) go.onclick = () => { BCAI.setMode(go.dataset.go); $("#mode-toggle [data-m]")?.scrollIntoView({ block: "nearest" }); };
    BCAI.modeToggle($("#mode-toggle"));
    fillPrices();
  }
  function fillPrices() {
    if (!BCAI.catalog) return;
    document.querySelectorAll("[data-price]").forEach((el) => (el.textContent = BCAI.fromPrice(el.dataset.price)));
  }
  document.addEventListener("bcai:mode", () => drawCards());
  // "Try it yourself" in a preview opens that tool's quick-create panel (switching to All tools if it's hidden).
  // "Make one like this" in a preview opens that tool's quick panel with the example prompt filled in.
  BCAI_PREVIEW.onTry((id, prompt) => {
    if (!grid.querySelector(`.card[data-id="${id}"]`)) BCAI.setMode("advanced", false);
    if (openId !== id) toggle(id);
    const input = grid.querySelector(".quick [name=p]");
    if (input && prompt) { input.value = prompt; input.dispatchEvent(new Event("input")); input.focus(); }
  });

  function columns() { return getComputedStyle(grid).gridTemplateColumns.split(" ").length; }

  function toggle(id) {
    grid.querySelector(".quick")?.remove();
    grid.querySelectorAll(".card").forEach((c) => { c.classList.remove("open"); c.querySelector(".card-hit")?.setAttribute("aria-expanded", "false"); });
    if (openId === id) { openId = null; return; }
    openId = id;
    const cards = [...grid.querySelectorAll(".card")];
    const idx = cards.findIndex((c) => c.dataset.id === id);
    if (idx < 0) { openId = null; return; }
    const cols = columns();
    const rowEnd = Math.min(cards.length - 1, Math.floor(idx / cols) * cols + cols - 1);
    cards[idx].classList.add("open");
    cards[idx].querySelector(".card-hit")?.setAttribute("aria-expanded", "true");
    const panel = document.createElement("div");
    panel.className = "quick";
    cards[rowEnd].after(panel);
    quickPanel(panel, id);
    panel.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }

  function quickPanel(panel, id) {
    const S = STUDIO_BY_ID[id];
    const multi = id === "translate" || id === "voice" || id === "avatar";
    panel.innerHTML = `
      <div class="quick-head">
        <div><span class="eyebrow">${esc(S.verb)}</span><h3 style="margin-top:6px">${esc(S.name)}</h3><p>${esc(S.blurb)}</p></div>
        <a class="btn btn-ghost btn-sm" href="studio.html?s=${id}">Open full ${esc(S.name)} studio →</a>
      </div>
      <form class="quick-form">
        <div class="quick-row">
          <div class="field">${multi
            ? `<textarea class="input" name="p" rows="3" placeholder="${esc(S.placeholder)}" required></textarea>`
            : `<input class="input" name="p" placeholder="${esc(S.placeholder)}" required ${id === "outreach" ? 'inputmode="url"' : ""}>`}</div>
          <button class="btn btn-primary" type="submit" style="align-self:flex-start;min-width:150px">Create</button>
        </div>
        <div class="q-controls"></div>
        <div class="chips">${S.examples.map((e) => `<button type="button" class="chip" data-ex="${esc(e)}">${esc(e.length > 70 ? e.slice(0, 68) + "…" : e)}</button>`).join("")}</div>
        <div class="quick-foot"><span class="muted">Estimated cost: <b style="color:var(--accent-hi)" class="q-cost">…</b> <span class="q-dollars"></span></span><span class="muted">Engine: <b class="q-engine" style="color:var(--text)"></b> · <a class="linkish" href="studio.html?s=${id}">more options</a></span></div>
        <div class="q-out" style="margin-top:16px"></div>
      </form>`;
    const form = $("form", panel), input = form.elements.p, out = $(".q-out", panel);
    let ctl;
    const update = () => {
      if (!ctl) return;
      const cr = ctl.price(input.value);
      $(".q-cost", panel).textContent = `${cr} credits`;
      $(".q-dollars", panel).textContent = `(${BCAI.dollars(cr)})`;
      $(".q-engine", panel).textContent = BCAI.engineFor(id, ctl.engine()).label;
    };
    ctl = BCAI_CONTROLS.build(id, "simple", $(".q-controls", panel), update);
    update();
    input.oninput = update;
    panel.querySelectorAll("[data-ex]").forEach((c) => (c.onclick = () => { input.value = c.dataset.ex; update(); input.focus(); }));
    form.onsubmit = async (e) => {
      e.preventDefault();
      const need = ctl?.missing?.();
      if (need) { out.innerHTML = `<div class="err">${esc(need)}</div>`; return; }
      const btn = $("button[type=submit]", form);
      btn.disabled = true; btn.textContent = "Creating…";
      out.innerHTML = BCAI.progressHTML(`${S.verb}…`);
      try {
        const item = await BCAI.generate({ studio: id, engine: ctl.engine(), prompt: input.value, options: ctl.options() }, (p) => (out.innerHTML = BCAI.progressHTML(`${S.verb}…`, p)));
        BCAI.renderOutput(item, out);
        const more = document.createElement("p");
        more.style.cssText = "margin-top:12px;font-size:13px";
        more.innerHTML = `<a class="linkish" href="studio.html?s=${id}">Open the full ${esc(S.name)} studio for more engines, options and your history →</a>`;
        out.appendChild(more);
        loadRecent();
      } catch (err) {
        out.innerHTML = `<div class="err">${esc(err.message)}</div>`;
      } finally {
        btn.disabled = false; btn.textContent = "Create";
      }
    };
    setTimeout(() => input.focus(), 60);
  }

  async function loadRecent() {
    try {
      const { items } = await BCAI.api("/api/history");
      const list = items.slice(0, 10);
      $("#recent-empty").classList.toggle("hidden", list.length > 0);
      $("#recent").innerHTML = list.map((it) => `<a class="h-item" href="studio.html?s=${it.studio}&item=${it.id}">${BCAI.thumbHTML(it, STUDIO_BY_ID[it.studio]?.icon || "")}</a>`).join("");
    } catch {}
  }

  drawCards();
  BCAI.whenSignedIn(async () => {
    await BCAI.loadCatalog();
    fillPrices();
    loadRecent();
    const want = (location.hash.match(/open=(\w+)/) || [])[1];
    if (want && STUDIO_BY_ID[want]) {
      if (!grid.querySelector(`[data-id="${want}"]`)) BCAI.setMode("advanced", false); // a link to a hidden tool shows all tools for this visit only
      toggle(want);
    }
  });
})();
