/* Wallet, referrals, pricing and library. */
(function () {
  "use strict";
  const { esc, $ } = BCAI;
  BCAI.header("account");
  BCAI.footer();
  BCAI.allie();
  const money = (c) => `$${(c / 100).toFixed(2)}`;
  const mask = (e) => { const [a, d] = String(e).split("@"); return d ? `${a.slice(0, 2)}•••@${d}` : ""; };

  async function load() {
    const [me, cat, hist] = await Promise.all([BCAI.refreshMe(), BCAI.loadCatalog(), BCAI.api("/api/history")]);
    const u = me.user;
    $("#hello").textContent = `${(u.name || u.handle).split(" ")[0]}'s wallet`;
    $("#st-used").textContent = Number(u.spentCredits || 0).toLocaleString();
    $("#st-refs").textContent = me.referrals.length;
    $("#st-earn").textContent = money(u.earningsCents || 0);
    $("#share-pct").textContent = `${Math.round(cat.refShare * 100)}%`;
    const base = location.href.replace(/account\.html.*$/, "index.html");
    $("#reflink").value = `${base}?ref=${u.refCode || ""}`;
    $("#refrows").innerHTML = me.referrals.map((r) => `<tr><td>${esc(r.name || "Member")} <span class="muted">${esc(mask(r.handle))}</span></td><td>${new Date(r.joined).toLocaleDateString()}</td><td>${money(r.purchasedCents || 0)}</td><td style="color:var(--gold-hi)">${money(Math.round((r.purchasedCents || 0) * cat.refShare))}</td></tr>`).join("");
    $("#ref-empty").classList.toggle("hidden", me.referrals.length > 0);

    const rows = [];
    for (const s of STUDIOS) for (const e of cat.studios[s.id] || []) {
      const lbl = BCAI.unitLabel(s.id, e);
      const cr = Number((lbl.match(/\d[\d,]*/) || ["0"])[0].replace(/,/g, ""));
      rows.push(`<tr><td>${esc(s.name)}</td><td>${esc(e.label)} <span class="tier ${e.tier}">${e.tier}</span></td><td style="font-family:var(--mono);color:var(--gold-hi)">${esc(lbl)}</td><td class="muted">${lbl.startsWith("~") ? "≈ " : ""}${BCAI.dollars(cr)}</td></tr>`);
    }
    $("#prices").innerHTML = rows.join("");

    $("#all-empty").classList.toggle("hidden", hist.items.length > 0);
    $("#all").innerHTML = hist.items.map((it) => `<a class="h-item" href="studio.html?s=${it.studio}&item=${it.id}">${BCAI.thumbHTML(it, STUDIO_BY_ID[it.studio]?.icon || "")}</a>`).join("");
  }

  $("#copyref").onclick = (e) => BCAI.copyText($("#reflink").value, e.target);
  document.querySelectorAll("[data-pack]").forEach((b) => (b.onclick = async () => {
    b.disabled = true;
    try { const d = await BCAI.api("/api/topup", { pack: b.dataset.pack }); BCAI.setUser(d.user); await load(); }
    catch (e) { alert(e.message); }
    b.disabled = false;
  }));

  BCAI.whenSignedIn(() => load().catch((e) => console.error(e)));
})();
