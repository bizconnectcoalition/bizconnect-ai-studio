/* Full studio page — one template, adapts to each of the ten studios. */
(function () {
  "use strict";
  const { esc, $, svg } = BCAI;
  const qs = new URLSearchParams(location.search);
  const id = STUDIO_BY_ID[qs.get("s")] ? qs.get("s") : "image";
  const S = STUDIO_BY_ID[id];
  BCAI.header("studio");
  BCAI.footer();
  BCAI.allie();

  document.title = `${S.name} Studio — BizConnect AI Studio`;
  $("#crumb").textContent = S.name;
  $("#s-name").textContent = `${S.name} Studio`;
  $("#s-tag").textContent = S.blurb;
  $("#s-ico").innerHTML = svg(S.icon);
  $("#empty-ico").innerHTML = svg(S.icon);
  $("#switcher").innerHTML = STUDIOS.map((s) => `<button type="button" class="${s.id === id ? "on" : ""}" onclick="location.href='studio.html?s=${s.id}'">${esc(s.name)}</button>`).join("");

  const isChat = id === "chat";
  const long = ["chat", "translate", "voice", "avatar", "music", "deck", "brand", "image", "video"].includes(id);
  $("#prompt-field").innerHTML = `<label for="p">${{ outreach: "Prospect's website", translate: "Text to translate", voice: "Script", avatar: "What should the presenter say?", deck: "What's the presentation about?", brand: "Describe your business", chat: "Your message" }[id] || "Describe what you want"}</label>` +
    (long ? `<textarea class="input" id="p" rows="${id === "translate" ? 7 : 4}" placeholder="${esc(S.placeholder)}" required></textarea>` : `<input class="input" id="p" placeholder="${esc(S.placeholder)}" required>`) +
    (id === "voice" || id === "avatar" ? `<small class="muted" style="font-size:11.5px" id="chars"></small>` : "");
  const input = $("#p");
  if (qs.get("p")) input.value = qs.get("p");
  $("#examples").innerHTML = S.examples.map((e) => `<button type="button" class="chip" data-ex="${esc(e)}">${esc(e.length > 60 ? e.slice(0, 58) + "…" : e)}</button>`).join("");
  document.querySelectorAll("[data-ex]").forEach((c) => (c.onclick = () => { input.value = c.dataset.ex; update(); input.focus(); }));

  let ctl = null;
  function update() {
    if (!ctl) return;
    const cr = ctl.price(input.value);
    $("#cost").textContent = `${cr} credits`;
    $("#cost-usd").textContent = `(${BCAI.dollars(cr)})`;
    if ($("#chars")) $("#chars").textContent = `${input.value.length} characters · about ${Math.max(1, Math.round(input.value.length / 14))} seconds of speech`;
  }
  input.addEventListener("input", update);

  // ----- chat mode: a running conversation instead of single results -----
  const thread = [];
  function drawThread() {
    const st = $("#stage");
    if (!thread.length) return;
    st.innerHTML = `<div class="thread" id="thread">${thread.map((m) => `<div class="msg ${m.role === "user" ? "me" : "ai"}">${esc(m.content)}</div>`).join("")}</div>
      <div class="out-meta" style="margin-top:12px"><span>${thread.filter((m) => m.role === "assistant").length} replies</span><span class="actions"><button class="btn btn-ghost btn-sm" id="newchat">New chat</button></span></div>`;
    $("#newchat").onclick = () => { thread.length = 0; $("#stage").innerHTML = `<div class="stage-empty"><div><div class="ico">${svg(S.icon)}</div><p>New conversation. Ask anything.</p></div></div>`; };
    const t = $("#thread"); t.scrollTop = t.scrollHeight;
  }

  $("#create").onsubmit = async (e) => {
    e.preventDefault();
    const prompt = input.value.trim();
    if (!prompt) return;
    const go = $("#go");
    go.disabled = true; go.textContent = "Creating…";
    const stage = $("#stage");
    try {
      if (isChat) {
        const history = thread.slice();
        thread.push({ role: "user", content: prompt });
        drawThread();
        $("#thread").insertAdjacentHTML("beforeend", `<div class="msg ai" id="typing">Thinking…</div>`);
        input.value = "";
        const item = await BCAI.generate({ studio: id, engine: ctl.engine(), prompt, options: { ...ctl.options(), messages: history } });
        thread.push({ role: "assistant", content: item.output.text });
        drawThread();
      } else {
        stage.innerHTML = BCAI.progressHTML(`${S.verb}…`);
        const item = await BCAI.generate({ studio: id, engine: ctl.engine(), prompt, options: ctl.options() }, (p) => (stage.innerHTML = BCAI.progressHTML(`${S.verb}…`, p) + `<p class="muted" style="font-size:13px;margin-top:12px">${id === "video" || id === "avatar" ? "Video usually takes 30 to 90 seconds." : id === "music" ? "Music usually takes about a minute." : ""} You can leave this page; it will be saved to your history.</p>`));
        BCAI.renderOutput(item, stage);
        loadHistory();
      }
    } catch (err) {
      if (isChat) { $("#typing")?.remove(); thread.pop(); input.value = prompt; }
      stage.insertAdjacentHTML(isChat ? "beforeend" : "afterbegin", `<div class="err" style="margin-bottom:12px">${esc(err.message)}</div>`);
      if (!isChat) stage.querySelector(".progress")?.remove();
    } finally {
      go.disabled = false; go.textContent = isChat ? "Send" : "Create";
      update();
    }
  };
  if (isChat) {
    input.addEventListener("keydown", (e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); $("#create").requestSubmit(); } });
    $("#hist-panel").classList.add("hidden");
    $("#empty-msg").textContent = "Start a conversation. Press Enter to send, or Shift+Enter for a new line.";
  }

  let items = [];
  async function loadHistory() {
    if (isChat) return;
    try {
      items = (await BCAI.api(`/api/history?studio=${id}`)).items;
      $("#hist-empty").classList.toggle("hidden", items.length > 0);
      $("#history").innerHTML = items.map((it) => `<button class="h-item" data-item="${it.id}">${BCAI.thumbHTML(it, S.icon)}</button>`).join("");
      $("#history").querySelectorAll("[data-item]").forEach((b) => (b.onclick = () => show(b.dataset.item)));
    } catch {}
  }
  function show(itemId) {
    const it = items.find((x) => x.id === itemId);
    if (!it) return;
    BCAI.renderOutput(it, $("#stage"));
    const reuse = document.createElement("button");
    reuse.className = "btn btn-ghost btn-sm";
    reuse.textContent = "Reuse prompt";
    reuse.onclick = () => { input.value = it.prompt; update(); input.focus(); };
    $("#stage .actions")?.appendChild(reuse);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  BCAI.whenSignedIn(async () => {
    await BCAI.loadCatalog();
    ctl = BCAI_CONTROLS.build(id, "full", $("#controls"), update);
    $("#go").textContent = isChat ? "Send" : "Create";
    update();
    await loadHistory();
    if (qs.get("item")) show(qs.get("item"));
  });
})();
