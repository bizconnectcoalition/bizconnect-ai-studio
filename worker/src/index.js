// ============================================================
// BizConnect AI Studio - API Worker
// The browser never sees the fal.ai key. This Worker:
//   * checks the studio passcode and issues signed session tokens
//   * prices every generation at fal.ai cost x MARKUP (1 credit = $0.01)
//   * keeps wallets, referrals and history in KV
//   * enforces a daily fal.ai spend cap across all users
//   * relays requests to fal.ai (sync for fast jobs, queue for slow ones)
// ============================================================

const CREDIT_USD = 0.01;
const FAL_SYNC = "https://fal.run/";
const FAL_QUEUE = "https://queue.fal.run/";
const LLM_URL = "https://fal.run/openrouter/router/openai/v1/chat/completions";

// ---------- engine catalog (single source of truth for prices) ----------
// usd = fal.ai list price for one unit; unit tells the price calculator what to multiply by.
const LLMS = {
  "gemini-flash": { label: "Gemini Flash", maker: "Google", tier: "fast", desc: "Fast, low-cost answers", model: "google/gemini-2.5-flash", inPerM: 0.30, outPerM: 2.50 },
  "gpt-mini": { label: "GPT-5 mini", maker: "OpenAI", tier: "balanced", desc: "Sharp, well-rounded writing", model: "openai/gpt-5-mini", inPerM: 0.25, outPerM: 2.00 },
  "claude": { label: "Claude Sonnet", maker: "Anthropic", tier: "premium", desc: "Best for nuanced, polished writing", model: "anthropic/claude-sonnet-4.5", inPerM: 3.00, outPerM: 15.00 },
};
const llmEngines = (ids) => ids.map((id) => ({ id, ...LLMS[id], unit: "tokens" }));

const ENGINES = {
  chat: llmEngines(["gemini-flash", "gpt-mini", "claude"]),
  translate: llmEngines(["gemini-flash", "gpt-mini", "claude"]),
  deck: llmEngines(["gemini-flash", "gpt-mini", "claude"]),
  outreach: llmEngines(["gemini-flash", "gpt-mini", "claude"]),
  brand: llmEngines(["gemini-flash", "claude"]).map((e) => ({ ...e, extraUsd: 0.025, desc: e.desc + " + a FLUX logo concept" })),
  image: [
    { id: "flux-schnell", label: "FLUX Schnell", maker: "Black Forest Labs", tier: "fast", desc: "Drafts in about 2 seconds", endpoint: "fal-ai/flux/schnell", unit: "image", usd: 0.003 },
    { id: "flux-dev", label: "FLUX Dev", maker: "Black Forest Labs", tier: "balanced", desc: "Detailed, photographic results", endpoint: "fal-ai/flux/dev", unit: "image", usd: 0.025 },
    { id: "nano-banana", label: "Nano Banana", maker: "Google", tier: "premium", desc: "Best at text, logos and following directions", endpoint: "fal-ai/nano-banana", unit: "image", usd: 0.039 },
  ],
  video: [
    { id: "ltx", label: "LTX 2.3", maker: "Lightricks", tier: "fast", desc: "Quick 1080p clips with sound", endpoint: "fal-ai/ltx-2.3/text-to-video/fast", i2v: "fal-ai/ltx-2.3/image-to-video/fast", unit: "second", usd: 0.06, durations: [6, 8, 10], aspects: ["16:9", "9:16"], audio: "always" },
    { id: "hailuo", label: "Hailuo 02", maker: "MiniMax", tier: "balanced", desc: "Lifelike motion, silent", endpoint: "fal-ai/minimax/hailuo-02/standard/text-to-video", unit: "second", usd: 0.045, durations: [6, 10], aspects: [], audio: "never" },
    { id: "kling", label: "Kling 3 Pro", maker: "Kuaishou", tier: "premium", desc: "Cinematic camera work", endpoint: "fal-ai/kling-video/o3/pro/text-to-video", unit: "second", usd: 0.14, usdSilent: 0.112, durations: [5, 10], aspects: ["16:9", "9:16", "1:1"], audio: "optional" },
    { id: "veo", label: "Veo 3.1 Fast", maker: "Google", tier: "premium", desc: "Best overall, readable text, voices", endpoint: "fal-ai/veo3.1/fast", i2v: "fal-ai/veo3.1/fast/image-to-video", unit: "second", usd: 0.15, usdSilent: 0.10, durations: [4, 6, 8], aspects: ["16:9", "9:16"], audio: "optional" },
  ],
  voice: [
    { id: "kokoro", label: "Kokoro", maker: "Open source", tier: "fast", desc: "Clear, natural and very affordable", endpoint: "fal-ai/kokoro/american-english", unit: "kchar", usd: 0.02,
      voices: [["af_heart", "Heart (warm female)"], ["af_bella", "Bella (bright female)"], ["af_nicole", "Nicole (soft female)"], ["am_adam", "Adam (deep male)"], ["am_michael", "Michael (friendly male)"], ["am_eric", "Eric (confident male)"]] },
    { id: "elevenlabs", label: "ElevenLabs", maker: "ElevenLabs", tier: "premium", desc: "Studio-grade, most expressive", endpoint: "fal-ai/elevenlabs/tts/multilingual-v2", unit: "kchar", usd: 0.10,
      voices: [["Rachel", "Rachel (calm narrator)"], ["Aria", "Aria (expressive)"], ["Sarah", "Sarah (soft pro)"], ["Roger", "Roger (confident)"], ["George", "George (warm British)"], ["Charlie", "Charlie (casual)"]] },
  ],
  avatar: [
    { id: "fabric-480", label: "Fabric 480p", maker: "VEED", tier: "fast", desc: "Talking video for social clips", endpoint: "veed/fabric-1.0", unit: "second", usd: 0.08, resolution: "480p" },
    { id: "fabric-720", label: "Fabric 720p", maker: "VEED", tier: "premium", desc: "Sharper HD talking video", endpoint: "veed/fabric-1.0", unit: "second", usd: 0.15, resolution: "720p" },
  ],
  music: [
    { id: "lyria", label: "Lyria 2", maker: "Google", tier: "balanced", desc: "30-second instrumental beds", endpoint: "fal-ai/lyria2", unit: "gen", usd: 0.10 },
    { id: "minimax-song", label: "MiniMax Music", maker: "MiniMax", tier: "fast", desc: "Full songs with vocals and lyrics", endpoint: "fal-ai/minimax-music/v2", unit: "gen", usd: 0.03 },
  ],
};
const QUEUED = new Set(["video", "avatar", "music"]);

// ---------- helpers ----------
const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type,Authorization",
  "Access-Control-Max-Age": "86400",
};
const json = (data, status = 200) => new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json", ...CORS } });
const fail = (status, error, extra = {}) => json({ error, ...extra }, status);
const today = () => new Date().toISOString().slice(0, 10);
const num = (v, d) => (Number.isFinite(Number(v)) ? Number(v) : d);
const cfg = (env) => ({
  cap: num(env.DAILY_CAP_USD, 5),
  markup: num(env.MARKUP, 3),
  starter: num(env.STARTER_CREDITS, 500),
  refShare: num(env.REF_SHARE, 0.1),
});
const toCredits = (env, usd) => Math.max(1, Math.ceil((usd * cfg(env).markup) / CREDIT_USD - 1e-9));
const falKey = (env) => (env.FAL_KEY || "").trim();
const rid = () => crypto.randomUUID().replace(/-/g, "").slice(0, 16);
const b64u = (s) => btoa(unescape(encodeURIComponent(s))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const unb64u = (s) => decodeURIComponent(escape(atob(s.replace(/-/g, "+").replace(/_/g, "/"))));

async function hmac(env, msg) {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(`${env.STUDIO_PASSCODE}::bizconnect-studio`), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(msg));
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, "0")).join("").slice(0, 40);
}
async function makeToken(env, handle) { return `${b64u(handle)}.${await hmac(env, handle)}`; }
async function readToken(env, req) {
  const t = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
  const [h, sig] = t.split(".");
  if (!h || !sig) return null;
  let handle;
  try { handle = unb64u(h); } catch { return null; }
  return sig === (await hmac(env, handle)) ? handle : null;
}

const kvGet = async (env, k, d = null) => (await env.STUDIO_KV.get(k, "json")) ?? d;
const kvPut = (env, k, v, opts) => env.STUDIO_KV.put(k, JSON.stringify(v), opts);

async function spentToday(env) { return num(await env.STUDIO_KV.get(`spend:${today()}`), 0); }
async function addSpend(env, usd) {
  const k = `spend:${today()}`;
  await env.STUDIO_KV.put(k, String(Math.max(0, (await spentToday(env)) + usd)), { expirationTtl: 60 * 60 * 24 * 3 });
}

function findEngine(studio, engineId) {
  const list = ENGINES[studio];
  if (!list) return null;
  return list.find((e) => e.id === engineId) || list[0];
}

// Estimate fal.ai cost in USD for a request before running it.
function estimateUsd(studio, eng, o, prompt) {
  const text = String(prompt || "");
  switch (eng.unit) {
    case "tokens": {
      const inTok = (text.length + (o.contextChars || 0)) / 3.5 + 400;
      const outTok = { deck: 2200, outreach: 1800, brand: 1500, translate: Math.max(300, text.length / 3) }[studio] || 900;
      return (inTok * eng.inPerM + outTok * eng.outPerM) / 1e6 + (eng.extraUsd || 0);
    }
    case "image": return eng.usd * Math.min(4, Math.max(1, num(o.count, 1)));
    case "second": {
      if (studio === "avatar") {
        const secs = Math.max(3, Math.ceil(text.length / 14));
        const ttsUsd = (text.length / 1000) * (o.voiceEngine === "elevenlabs" ? 0.10 : 0.02);
        return secs * eng.usd + ttsUsd;
      }
      const d = num(o.duration, eng.durations[0]);
      const rate = o.audio === false && eng.usdSilent ? eng.usdSilent : eng.usd;
      return d * rate;
    }
    case "kchar": return Math.max(0.001, (text.length / 1000) * eng.usd);
    case "gen": return eng.usd + (studio === "music" && eng.id === "minimax-song" && !o.lyrics ? 0.002 : 0);
    default: return 0.01;
  }
}

// ---------- fal.ai calls ----------
async function falSync(env, endpoint, input) {
  const r = await fetch(FAL_SYNC + endpoint, { method: "POST", headers: { Authorization: `Key ${falKey(env)}`, "Content-Type": "application/json" }, body: JSON.stringify(input) });
  const body = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(falErr(body, r.status));
  return body;
}
async function falSubmit(env, endpoint, input) {
  const r = await fetch(FAL_QUEUE + endpoint, { method: "POST", headers: { Authorization: `Key ${falKey(env)}`, "Content-Type": "application/json" }, body: JSON.stringify(input) });
  const body = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(falErr(body, r.status));
  return body; // { request_id, status_url, response_url, ... }
}
function falErr(body, status) {
  const d = body?.detail;
  const msg = typeof d === "string" ? d : Array.isArray(d) ? d.map((x) => x.msg || JSON.stringify(x)).join("; ") : body?.error || body?.message;
  return `AI engine error (${status})${msg ? ": " + String(msg).slice(0, 240) : ""}`;
}
async function llm(env, eng, messages, maxTokens = 1500, json = false) {
  const body = { model: eng.model, messages, max_tokens: maxTokens };
  if (json) body.response_format = { type: "json_object" };
  const r = await fetch(LLM_URL, { method: "POST", headers: { Authorization: `Key ${falKey(env)}`, "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const out = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(falErr(out, r.status));
  const text = out?.choices?.[0]?.message?.content ?? out?.output ?? "";
  const u = out?.usage || {};
  const usd = ((u.prompt_tokens || 0) * eng.inPerM + (u.completion_tokens || 0) * eng.outPerM) / 1e6;
  return { text: String(text), usd };
}
function parseJsonLoose(text) {
  const s = String(text).replace(/^```(?:json)?/i, "").replace(/```\s*$/, "").trim();
  try { return JSON.parse(s); } catch {}
  const m = s.match(/\{[\s\S]*\}/);
  if (m) { try { return JSON.parse(m[0]); } catch {} }
  return null;
}
async function fetchSiteText(url) {
  let u;
  try { u = new URL(/^https?:\/\//i.test(url) ? url : `https://${url}`); } catch { throw new Error("That doesn't look like a website address."); }
  const r = await fetch(u.toString(), { headers: { "User-Agent": "Mozilla/5.0 (BizConnect AI Studio prospect research)" }, redirect: "follow" });
  if (!r.ok) throw new Error(`Couldn't open ${u.hostname} (${r.status}).`);
  const html = (await r.text()).slice(0, 400000);
  const title = (html.match(/<title[^>]*>([^<]*)/i) || [])[1] || "";
  const desc = (html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']*)/i) || [])[1] || "";
  const text = html.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>|<noscript[\s\S]*?<\/noscript>/gi, " ").replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/\s+/g, " ").trim();
  return { host: u.hostname, text: `TITLE: ${title}\nDESCRIPTION: ${desc}\nPAGE TEXT: ${text}`.slice(0, 12000) };
}

// ---------- studio runners ----------
// Each returns either { output, usd } (finished) or { queued: {...job}, usd } (still rendering).
const ASPECT_TO_SIZE = { "1:1": "square_hd", "16:9": "landscape_16_9", "9:16": "portrait_16_9", "4:3": "landscape_4_3", "3:4": "portrait_4_3" };

async function runStudio(env, origin, studio, eng, prompt, o) {
  switch (studio) {
    case "chat": {
      const hist = Array.isArray(o.messages) ? o.messages.slice(-12).map((m) => ({ role: m.role === "assistant" ? "assistant" : "user", content: String(m.content).slice(0, 6000) })) : [];
      const system = { role: "system", content: `You are a helpful assistant inside BizConnect AI Studio, used by small-business owners and networkers. Be clear, practical and friendly. ${o.persona ? "Act as: " + String(o.persona).slice(0, 300) : ""}` };
      const r = await llm(env, eng, [system, ...hist, { role: "user", content: prompt }], 1500);
      return { output: { type: "text", text: r.text }, usd: r.usd };
    }
    case "translate": {
      const lang = String(o.language || "Spanish").slice(0, 40);
      const tone = String(o.tone || "natural").slice(0, 40);
      const r = await llm(env, eng, [
        { role: "system", content: `You are a professional translator. Translate the user's text into ${lang} with a ${tone} tone. Preserve formatting, names and numbers. Return only the translation.` },
        { role: "user", content: prompt },
      ], 3000);
      return { output: { type: "text", text: r.text, meta: { language: lang } }, usd: r.usd };
    }
    case "deck": {
      const n = Math.min(12, Math.max(4, num(o.slides, 7)));
      const r = await llm(env, eng, [
        { role: "system", content: `You create concise, persuasive slide decks for small businesses. Return ONLY JSON: {"title":string,"subtitle":string,"slides":[{"title":string,"bullets":[string, ...3-5 short bullets],"notes":string}]}. Exactly ${n} slides. Audience: ${String(o.audience || "prospective clients").slice(0, 120)}.` },
        { role: "user", content: prompt },
      ], 3500, true);
      const deck = parseJsonLoose(r.text);
      if (!deck?.slides?.length) throw new Error("The deck came back incomplete. Please try again.");
      return { output: { type: "deck", deck }, usd: r.usd };
    }
    case "outreach": {
      const site = await fetchSiteText(prompt);
      const offer = String(o.offer || "").slice(0, 500);
      const r = await llm(env, eng, [
        { role: "system", content: "You are a B2B outreach strategist for local business networkers. Using the prospect's website, write a practical outreach pack in Markdown with these sections: ## Snapshot (what they do, who they serve, 3 bullets), ## Talking points (3 personalised hooks), ## Cold email (subject + 120-word body), ## LinkedIn message (under 300 chars), ## Text message (under 160 chars), ## Call opener (2-3 sentences), ## Follow-up email. Never invent facts that aren't on the site; keep it warm and non-pushy." },
        { role: "user", content: `PROSPECT WEBSITE (${site.host}):\n${site.text}\n\nWHAT I OFFER: ${offer || "(not specified; keep the pitch general: a warm introduction and an invitation to connect)"}` },
      ], 2500);
      return { output: { type: "text", text: r.text, meta: { site: site.host } }, usd: r.usd };
    }
    case "brand": {
      const r = await llm(env, eng, [
        { role: "system", content: 'You are a brand strategist. Return ONLY JSON: {"name":string,"tagline":string,"alt_taglines":[3 strings],"elevator_pitch":string,"voice":[3 short adjectives],"bio_short":string,"bio_social":string,"colors":[{"name":string,"hex":"#RRGGBB","use":string} x5],"fonts":{"heading":string,"body":string},"logo_prompt":string (a prompt for a clean, flat, vector-style logo mark on a plain background)}' },
        { role: "user", content: prompt },
      ], 1800, true);
      const kit = parseJsonLoose(r.text);
      if (!kit) throw new Error("The brand kit came back incomplete. Please try again.");
      let logo = null;
      try {
        const img = await falSync(env, "fal-ai/flux/dev", { prompt: `${kit.logo_prompt || kit.name + " logo"}. Minimal flat vector logo mark, centered, plain light background, no mockup, no extra text`, image_size: "square_hd", num_images: 1 });
        logo = img?.images?.[0]?.url || null;
      } catch {}
      return { output: { type: "brand", kit, logo }, usd: r.usd + (logo ? 0.025 : 0) };
    }
    case "image": {
      const count = Math.min(4, Math.max(1, num(o.count, 1)));
      const aspect = ASPECT_TO_SIZE[o.aspect] ? o.aspect : "1:1";
      const styled = o.style ? `${prompt}. Style: ${String(o.style).slice(0, 80)}` : prompt;
      const input = eng.id === "nano-banana"
        ? { prompt: styled, num_images: count, aspect_ratio: aspect }
        : { prompt: styled, num_images: count, image_size: ASPECT_TO_SIZE[aspect] };
      const r = await falSync(env, eng.endpoint, input);
      const urls = (r.images || []).map((i) => i.url).filter(Boolean);
      if (!urls.length) throw new Error("No image came back. Please try again.");
      return { output: { type: "image", urls }, usd: eng.usd * urls.length };
    }
    case "voice": {
      const voice = (eng.voices.find((v) => v[0] === o.voice) || eng.voices[0])[0];
      const speed = Math.min(eng.id === "elevenlabs" ? 1.2 : 2, Math.max(eng.id === "elevenlabs" ? 0.7 : 0.5, num(o.speed, 1)));
      const input = eng.id === "elevenlabs" ? { text: prompt, voice, speed } : { prompt, voice, speed };
      const r = await falSync(env, eng.endpoint, input);
      const url = r?.audio?.url;
      if (!url) throw new Error("No audio came back. Please try again.");
      return { output: { type: "audio", url, meta: { voice } }, usd: (prompt.length / 1000) * eng.usd };
    }
    case "video": {
      const d = eng.durations.includes(num(o.duration, 0)) ? num(o.duration, 0) : eng.durations[0];
      const useI2V = Boolean(o.imageUrl && eng.i2v);
      const input = { prompt };
      if (eng.id === "veo") { input.duration = `${d}s`; input.aspect_ratio = eng.aspects.includes(o.aspect) ? o.aspect : "16:9"; input.generate_audio = o.audio !== false; }
      if (eng.id === "kling") { input.duration = String(d); input.aspect_ratio = eng.aspects.includes(o.aspect) ? o.aspect : "16:9"; input.generate_audio = o.audio !== false; }
      if (eng.id === "hailuo") { input.duration = String(d); }
      if (eng.id === "ltx") { input.duration = d; if (!useI2V) input.aspect_ratio = eng.aspects.includes(o.aspect) ? o.aspect : "16:9"; }
      if (useI2V) { input.image_url = o.imageUrl; if (eng.id === "veo") input.aspect_ratio = "auto"; }
      const q = await falSubmit(env, useI2V ? eng.i2v : eng.endpoint, input);
      const rate = o.audio === false && eng.usdSilent ? eng.usdSilent : eng.usd;
      return { queued: { q, outType: "video" }, usd: d * rate };
    }
    case "avatar": {
      const voiceEng = ENGINES.voice.find((v) => v.id === (o.voiceEngine || "kokoro")) || ENGINES.voice[0];
      const voice = (voiceEng.voices.find((v) => v[0] === o.voice) || voiceEng.voices[0])[0];
      const tts = await falSync(env, voiceEng.endpoint, voiceEng.id === "elevenlabs" ? { text: prompt, voice } : { prompt, voice });
      const audioUrl = tts?.audio?.url;
      if (!audioUrl) throw new Error("Couldn't create the voice track. Please try again.");
      const imageUrl = o.imageUrl || `${origin}/allie-presenter.jpg`;
      const q = await falSubmit(env, eng.endpoint, { image_url: imageUrl, audio_url: audioUrl, resolution: eng.resolution });
      const secs = Math.max(3, Math.ceil(prompt.length / 14));
      return { queued: { q, outType: "video", meta: { audioUrl } }, usd: secs * eng.usd + (prompt.length / 1000) * voiceEng.usd };
    }
    case "music": {
      if (eng.id === "lyria") {
        const q = await falSubmit(env, eng.endpoint, { prompt: `${prompt}${o.genre ? ". Genre: " + o.genre : ""}${o.mood ? ". Mood: " + o.mood : ""}` });
        return { queued: { q, outType: "audio" }, usd: eng.usd };
      }
      let lyrics = String(o.lyrics || "").trim();
      let extra = 0;
      if (lyrics.length < 10) {
        const w = await llm(env, LLMS["gemini-flash"], [
          { role: "system", content: "Write short, catchy song lyrics (under 900 characters) using [Verse], [Chorus] and [Outro] tags. Return only the lyrics." },
          { role: "user", content: prompt },
        ], 600);
        lyrics = w.text.slice(0, 2900);
        extra = w.usd;
      }
      const style = `${o.genre || ""} ${o.mood || ""} ${prompt}`.trim().slice(0, 290).padEnd(10, ".");
      const q = await falSubmit(env, eng.endpoint, { prompt: style, lyrics_prompt: lyrics.slice(0, 2990) });
      return { queued: { q, outType: "audio", meta: { lyrics } }, usd: eng.usd + extra };
    }
  }
  throw new Error("Unknown studio.");
}

function normalizeQueued(outType, result, meta) {
  if (outType === "video") {
    const url = result?.video?.url;
    if (!url) throw new Error("The video finished but no file came back.");
    return { type: "video", url, meta };
  }
  const url = result?.audio?.url || result?.audio_file?.url;
  if (!url) throw new Error("The audio finished but no file came back.");
  return { type: "audio", url, meta };
}

// ---------- users, wallet, history ----------
async function getUser(env, handle) { return kvGet(env, `user:${handle}`); }
async function saveUser(env, u) { return kvPut(env, `user:${u.handle}`, u); }
async function addHistory(env, handle, item) {
  const k = `hist:${handle}`;
  const list = await kvGet(env, k, []);
  list.unshift(item);
  await kvPut(env, k, list.slice(0, 80));
}

// ---------- routes ----------
async function route(req, env, url) {
  const p = url.pathname;
  const method = req.method;

  if (p === "/health") {
    const k = falKey(env);
    return json({ ok: true, falKeySet: Boolean(k), falKeyLooksValid: k.includes(":"), passcodeSet: Boolean(env.STUDIO_PASSCODE), kv: Boolean(env.STUDIO_KV) });
  }

  if (p === "/api/catalog") {
    const c = cfg(env);
    const studios = {};
    for (const [s, list] of Object.entries(ENGINES)) {
      studios[s] = list.map((e) => {
        const pub = { id: e.id, label: e.label, maker: e.maker, tier: e.tier, desc: e.desc, unit: e.unit };
        if (e.unit === "tokens") { pub.inPerM = e.inPerM; pub.outPerM = e.outPerM; pub.extraUsd = e.extraUsd || 0; }
        else { pub.usd = e.usd; }
        for (const f of ["usdSilent", "durations", "aspects", "audio", "voices", "resolution"]) if (e[f] !== undefined) pub[f] = e[f];
        if (e.i2v) pub.photo = true;
        return pub;
      });
    }
    return json({ creditUsd: CREDIT_USD, markup: c.markup, starterCredits: c.starter, refShare: c.refShare, dailyCapUsd: c.cap, studios, voiceEngines: ENGINES.voice.map((v) => ({ id: v.id, label: v.label, usd: v.usd, voices: v.voices })) });
  }

  if (p === "/api/login" && method === "POST") {
    const b = await req.json().catch(() => ({}));
    if (!env.STUDIO_PASSCODE || String(b.passcode || "") !== env.STUDIO_PASSCODE) return fail(401, "That passcode isn't right.");
    const handle = String(b.handle || "").toLowerCase().trim().replace(/[^a-z0-9_-]/g, "").slice(0, 24);
    if (handle.length < 3) return fail(400, "Pick a username with at least 3 letters or numbers.");
    let u = await getUser(env, handle);
    if (!u) {
      const ref = String(b.ref || "").toLowerCase().replace(/[^a-z0-9_-]/g, "").slice(0, 24);
      const refUser = ref && ref !== handle ? await getUser(env, ref) : null;
      u = { handle, name: String(b.name || handle).slice(0, 60), credits: cfg(env).starter, created: Date.now(), ref: refUser ? ref : null, earningsCents: 0, purchasedCents: 0, spentCredits: 0 };
      await saveUser(env, u);
      if (refUser) {
        const refs = await kvGet(env, `refs:${ref}`, []);
        refs.unshift({ handle, joined: Date.now(), purchasedCents: 0 });
        await kvPut(env, `refs:${ref}`, refs.slice(0, 500));
      }
    }
    return json({ token: await makeToken(env, handle), user: u });
  }

  if (p.startsWith("/u/") && method === "GET") {
    const f = await kvGet(env, `up:${p.slice(3)}`);
    if (!f) return new Response("Not found", { status: 404, headers: CORS });
    const bin = Uint8Array.from(atob(f.b64), (c) => c.charCodeAt(0));
    return new Response(bin, { headers: { "Content-Type": f.ct, "Cache-Control": "public, max-age=86400", ...CORS } });
  }

  // ---- everything below needs a session ----
  const handle = await readToken(env, req);
  if (!handle) return fail(401, "Please sign in again.", { signin: true });
  const user = await getUser(env, handle);
  if (!user) return fail(401, "Please sign in again.", { signin: true });

  if (p === "/api/me") {
    const refs = await kvGet(env, `refs:${handle}`, []);
    const c = cfg(env);
    return json({ user, referrals: refs, spentTodayUsd: await spentToday(env), dailyCapUsd: c.cap });
  }

  if (p === "/api/history") {
    const list = await kvGet(env, `hist:${handle}`, []);
    const s = url.searchParams.get("studio");
    return json({ items: s ? list.filter((i) => i.studio === s) : list });
  }

  if (p === "/api/upload" && method === "POST") {
    const b = await req.json().catch(() => ({}));
    const m = String(b.dataUrl || "").match(/^data:(image\/(?:png|jpe?g|webp));base64,(.+)$/);
    if (!m) return fail(400, "Please upload a PNG, JPG or WebP image.");
    if (m[2].length > 7_000_000) return fail(400, "That image is too large. Please use one under 5 MB.");
    const id = rid();
    await kvPut(env, `up:${id}`, { ct: m[1], b64: m[2] }, { expirationTtl: 60 * 60 * 24 * 3 });
    return json({ url: `${url.origin}/u/${id}` });
  }

  if (p === "/api/topup" && method === "POST") {
    // DEMO ONLY: simulates a purchase so referral payouts can be shown. No payment is taken.
    const b = await req.json().catch(() => ({}));
    const packs = { starter: [1000, 1000], pro: [2500, 2750], studio: [5000, 6000] }; // [price cents, credits]
    const pack = packs[b.pack];
    if (!pack) return fail(400, "Unknown pack.");
    user.credits += pack[1];
    user.purchasedCents += pack[0];
    await saveUser(env, user);
    if (user.ref) {
      const ru = await getUser(env, user.ref);
      if (ru) {
        ru.earningsCents += Math.round(pack[0] * cfg(env).refShare);
        await saveUser(env, ru);
        const refs = await kvGet(env, `refs:${user.ref}`, []);
        const row = refs.find((r) => r.handle === handle);
        if (row) { row.purchasedCents += pack[0]; await kvPut(env, `refs:${user.ref}`, refs); }
      }
    }
    return json({ user, demo: true });
  }

  if (p === "/api/generate" && method === "POST") {
    const b = await req.json().catch(() => ({}));
    const studio = String(b.studio || "");
    const eng = findEngine(studio, b.engine);
    if (!eng) return fail(400, "Unknown studio.");
    const prompt = String(b.prompt || "").trim().slice(0, studio === "translate" ? 8000 : 4000);
    if (!prompt) return fail(400, studio === "outreach" ? "Enter the prospect's website address." : "Type what you'd like to create first.");
    const o = b.options || {};
    const estUsd = estimateUsd(studio, eng, o, prompt);
    const credits = toCredits(env, estUsd);
    if (user.credits < credits) return fail(402, `This needs ${credits} credits and you have ${user.credits}. Top up in your wallet.`, { needed: credits });
    const c = cfg(env);
    if ((await spentToday(env)) + estUsd > c.cap) return fail(429, "The studio has reached today's demo spending limit. Please try again tomorrow.");

    // Reserve credits up front; settle (refund the difference) when the real cost is known.
    user.credits -= credits;
    await saveUser(env, user);
    await addSpend(env, estUsd);
    const refund = async (amount, usdBack) => {
      const u = await getUser(env, handle);
      u.credits += amount;
      await saveUser(env, u);
      await addSpend(env, -usdBack);
      return u;
    };

    let res;
    try {
      res = await runStudio(env, url.origin, studio, eng, prompt, o);
    } catch (e) {
      const u = await refund(credits, estUsd);
      return fail(502, e.message || "Something went wrong.", { credits: u.credits, refunded: credits });
    }

    const actualCredits = Math.min(credits, toCredits(env, res.usd || estUsd));
    const created = Date.now();
    if (res.queued) {
      const id = rid();
      await kvPut(env, `job:${id}`, { id, handle, studio, engine: eng.id, engineLabel: eng.label, prompt, credits, usd: estUsd, created, statusUrl: res.queued.q.status_url, responseUrl: res.queued.q.response_url, outType: res.queued.outType, meta: res.queued.meta || null }, { expirationTtl: 60 * 60 * 24 * 7 });
      return json({ jobId: id, credits: user.credits, charged: credits });
    }
    let balance = user.credits;
    if (actualCredits < credits) balance = (await refund(credits - actualCredits, Math.max(0, estUsd - res.usd))).credits;
    const item = { id: rid(), studio, engine: eng.id, engineLabel: eng.label, prompt, options: o.messages ? undefined : o, output: res.output, credits: actualCredits, created };
    if (studio !== "chat") await addHistory(env, handle, item);
    const u2 = await getUser(env, handle);
    u2.spentCredits = (u2.spentCredits || 0) + actualCredits;
    await saveUser(env, u2);
    return json({ item, credits: balance });
  }

  if (p.startsWith("/api/job/")) {
    const job = await kvGet(env, `job:${p.slice(9)}`);
    if (!job || job.handle !== handle) return fail(404, "Job not found.");
    if (job.done) return json({ status: job.failed ? "FAILED" : "COMPLETED", item: job.item, error: job.error, credits: (await getUser(env, handle)).credits });
    const s = await fetch(job.statusUrl, { headers: { Authorization: `Key ${falKey(env)}` } });
    const st = await s.json().catch(() => ({}));
    if (st.status === "COMPLETED") {
      let item = null, error = null;
      try {
        if (st.error) throw new Error(String(st.error).slice(0, 240));
        const rr = await fetch(job.responseUrl, { headers: { Authorization: `Key ${falKey(env)}` } });
        const result = await rr.json().catch(() => ({}));
        if (!rr.ok) throw new Error(falErr(result, rr.status));
        item = { id: rid(), studio: job.studio, engine: job.engine, engineLabel: job.engineLabel, prompt: job.prompt, output: normalizeQueued(job.outType, result, job.meta), credits: job.credits, created: job.created };
        await addHistory(env, handle, item);
        const u = await getUser(env, handle);
        u.spentCredits = (u.spentCredits || 0) + job.credits;
        await saveUser(env, u);
      } catch (e) {
        error = e.message || "The render failed.";
        const u = await getUser(env, handle);
        u.credits += job.credits;
        await saveUser(env, u);
        await addSpend(env, -job.usd);
      }
      job.done = true; job.failed = Boolean(error); job.item = item; job.error = error;
      await kvPut(env, `job:${job.id}`, job, { expirationTtl: 60 * 60 * 24 * 7 });
      return json({ status: error ? "FAILED" : "COMPLETED", item, error: error ? `${error} Your ${job.credits} credits were refunded.` : null, credits: (await getUser(env, handle)).credits });
    }
    return json({ status: st.status || "IN_QUEUE", position: st.queue_position ?? null, elapsed: Math.round((Date.now() - job.created) / 1000) });
  }

  if (p === "/api/concierge" && method === "POST") {
    const b = await req.json().catch(() => ({}));
    const est = 0.002;
    if ((await spentToday(env)) + est > cfg(env).cap) return fail(429, "I'm resting for today. The studio hit its demo limit.");
    const msgs = (Array.isArray(b.messages) ? b.messages : []).slice(-10).map((m) => ({ role: m.role === "assistant" ? "assistant" : "user", content: String(m.content).slice(0, 2000) }));
    const system = `You are Allie, the friendly concierge of BizConnect AI Studio (part of Biz Connect Coalition, a business-networking community). Help beginners pick the right studio and write a good first prompt. Studios (use these exact ids): chat (ask anything, write anything), image (pictures, flyers, product shots), voice (voiceovers), avatar (talking-head video from a script), video (short AI video clips), music (songs and background music), deck (slide presentations), translate (translate documents), outreach (outreach pack from a prospect's website), brand (brand kit: tagline, colors, bios, logo idea). Keep replies under 90 words, warm and plain-spoken. When you recommend a studio, end with a line exactly like: [[studio:image|A flyer for a Saturday car wash fundraiser, bold and fun]] using the studio id and a suggested prompt. Never discuss income or earnings claims.`;
    try {
      const r = await llm(env, LLMS["gemini-flash"], [{ role: "system", content: system }, ...msgs], 400);
      await addSpend(env, r.usd || est);
      return json({ reply: r.text });
    } catch (e) {
      return fail(502, "I couldn't reach my brain just now. Please try again.");
    }
  }

  return fail(404, "Not found.");
}

export default {
  async fetch(req, env) {
    if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });
    const url = new URL(req.url);
    try {
      return await route(req, env, url);
    } catch (e) {
      return fail(500, "Server error: " + (e.message || String(e)).slice(0, 200));
    }
  },
};
