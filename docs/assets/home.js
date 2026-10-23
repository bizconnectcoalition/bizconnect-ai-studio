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
    grid.innerHTML = list.map((s) => `
      <button class="card" data-id="${s.id}" aria-expanded="false">
        <span class="ico">${svg(s.icon)}</span>
        <h3>${esc(s.name)}</h3>
        <p>${esc(s.tagline)}</p>
        ${simple ? `<p class="card-blurb">${esc(s.blurb)}</p>` : ""}
        <span class="price" data-price="${s.id}"></span>
      </button>`).join("");
    grid.querySelectorAll(".card").forEach((c) => (c.onclick = () => toggle(c.dataset.id)));
    openId = null;
    const more = $("#more-tools");
    const hidden = STUDIOS.length - list.length;
    more.innerHTML = !BCAI.hasSimple() ? "" : simple
      ? `<button type="button" class="btn btn-ghost more-btn" data-go="advanced">Show all ${STUDIOS.length} tools <span class="muted">(+${hidden} more: ${esc(STUDIOS.filter((s) => !list.includes(s)).map((s) => s.name).join(", "))})</span></button>`
      : `<button type="button" class="linkish" data-go="simple">← Back to simple mode (${esc(list.length ? BCAI.simpleIds().map((id) => STUDIO_BY_ID[id].name).join(", ") : "")})</button>`;
    const go = more.querySelector("[data-go]");
    if (go) go.onclick = () => BCAI.setMode(go.dataset.go);
    BCAI.modeToggle($("#mode-toggle"));
    fillPrices();
  }
  function fillPrices() {
    if (!BCAI.catalog) return;
    document.querySelectorAll("[data-price]").forEach((el) => (el.textContent = BCAI.fromPrice(el.dataset.price)));
  }
  document.addEventListener("bcai:mode", () => drawCards());

  function columns() { return getComputedStyle(grid).gridTemplateColumns.split(" ").length; }

  function toggle(id) {
    grid.querySelector(".quick")?.remove();
    grid.querySelectorAll(".card").forEach((c) => { c.classList.remove("open"); c.setAttribute("aria-expanded", "false"); });
    if (openId === id) { openId = null; return; }
    openId = id;
    const cards = [...grid.querySelectorAll(".card")];
    const idx = cards.findIndex((c) => c.dataset.id === id);
    const cols = columns();
    const rowEnd = Math.min(cards.length - 1, Math.floor(idx / cols) * cols + cols - 1);
    cards[idx].classList.add("open");
    cards[idx].setAttribute("aria-expanded", "true");
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
  $("#studio-count").textContent = STUDIOS.length;
  BCAI.whenSignedIn(async () => {
    await BCAI.loadCatalog();
    fillPrices();
    loadRecent();
    const want = (location.hash.match(/open=(\w+)/) || [])[1];
    if (want && STUDIO_BY_ID[want]) {
      if (!grid.querySelector(`[data-id="${want}"]`)) BCAI.setMode("advanced"); // a link to a hidden tool opens all tools
      toggle(want);
    }
  });
})();
