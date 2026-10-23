# BizConnect AI Studio

An all-in-one AI creation studio for small businesses: ten simple studios (chat, images, video, voiceover, talking avatar, music, slide decks, translation, sales outreach and brand kits) with a credit wallet and referral sharing. Members describe what they want in plain words; the studio picks the AI model and handles the rest.

Every studio opens in **Simple mode** (Chat, Images, Video, or whichever 3 starter tools a business picks) with one button to see all tools.

This repo is two things at once:

1. **The BizConnect studio**, Biz Connect Coalition's own branded studio (navy and gold, Allie the guide). Live at https://bizconnectcoalition.github.io/bizconnect-ai-studio/
2. **The white-label core.** The same studio can be re-skinned for any business (its name, logo, colors, guide and wording), and each business gets its own folder and repo under `..\ai-studio-clients\`. The first client is **Root & Bloom Salon Source**.

**Status:** private-preview prototype. **AI agents: read [AGENTS.md](AGENTS.md) first.**

## How it works

```
Browser (GitHub Pages: /docs)  ──►  Cloudflare Worker (/worker)  ──►  fal.ai (all AI models)
   10 studios, wallet UI              passcode, pricing (3x), wallet,       Veo, Kling, LTX, Hailuo, FLUX,
   guide + concierge chat             referrals, daily cap, history,        Nano Banana, ElevenLabs, Kokoro,
   brand from docs/brands/<id>/       brand voice per studio (BRANDS)       Fabric, Lyria, MiniMax, Claude/GPT/Gemini
```

- **The fal.ai key never reaches the browser.** It lives only as a Worker secret.
- **Pricing.** 1 credit = $0.01. Every generation costs its fal.ai list price × `MARKUP` (3). The price table lives in `worker/src/index.js` (`ENGINES`).
- **Safety rails.**
  - Everyone signs in with a studio passcode.
  - The Worker enforces a daily fal.ai spend cap (`DAILY_CAP_USD`) across all studios.
  - Failed renders are refunded automatically.
- **Referrals.** A referrer earns `REF_SHARE` (10%) of their referrals' credit purchases. There's no pay-to-join and no pay for holding credits.
- **Voice input.** Every text box has a 🎤 button (`docs/assets/mic.js`). Words appear live where the browser supports it, then `/api/transcribe` returns a Whisper transcript.
- **The guide.** A floating helper with a concierge chat. BizConnect's is Allie, the full-size character from the main BizConnect site. A brand without character art gets a compact round avatar instead.
- **Payments.** Top-ups are **demo-only** (no charge). Plug a real checkout such as Stripe into `/api/topup`.

## Layout

| Path | What |
|---|---|
| `AGENTS.md` | **Read-me-first brief** for any AI or developer |
| `project-docs/` | Vision, architecture, white-label how-to, decision log |
| `docs/` | The front end GitHub Pages serves (`index.html`, `studio.html?s=<id>`, `account.html`) |
| `docs/brand.js` | Brand loader: the one line that says which brand this site shows |
| `docs/brands/bizconnect/` | BizConnect's brand: `brand.js` (words, guide, settings), `brand.css` (colors, fonts), `img/` |
| `docs/assets/` | Shared core used by every brand (`app.js`, `app.css`, `studios.js`, `controls.js`…) |
| `tools/sync-client.ps1` | Copies the shared core into a client studio folder (`-Check` lists clients that are behind) |
| `tools/brand-template/` | Starting point for a new business's brand folder |
| `worker/src/index.js` | Cloudflare Worker API, shared by every studio (`BRANDS` list near the top) |
| `worker/wrangler.toml` | Worker config (KV binding, markup, cap, starter credits) |
| `worker/public/` | Files the Worker serves publicly (default presenter photo) |
| `sheets/LoginTracker.gs` | Google Apps Script that logs sign-ins to a Google Sheet |

## Run locally

```bash
python -m http.server 8743 --directory docs
```

Then open http://localhost:8743. The page talks to the deployed Worker. To preview another brand that lives in this repo, add `?brand=<id>` (works on localhost only).

## Deploy the Worker

```bash
cd worker
npx wrangler deploy
```

Secrets are set once and never committed: `FAL_KEY` (fal.ai API key), `STUDIO_PASSCODE` (tester passcode), plus `SHEET_WEBHOOK_URL` / `SHEET_TOKEN` for the login sheet.

## API (Worker)

Every POST body may carry `brand` (a key of `BRANDS` in the Worker). It sets the concierge's name and voice, the chat assistant's audience and the default presenter. Unknown or missing values fall back to `bizconnect`.

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/catalog` | Engines and prices (public) |
| POST | `/api/login` | `{name, email, passcode, ref?, brand?}` → session token (every sign-in is logged to the Google Sheet) |
| GET | `/api/me` | Wallet, referrals, today's spend |
| POST | `/api/generate` | `{studio, engine, prompt, options, brand?}` → result, or `jobId` for video/avatar/music |
| GET | `/api/job/:id` | Poll a render; refunds on failure |
| GET | `/api/history?studio=` | Saved creations |
| POST | `/api/upload` | Photo for image-to-video or a custom avatar presenter |
| POST | `/api/topup` | Demo credit packs (no payment) |
| POST | `/api/concierge` | The guide's concierge chat |
| POST | `/api/transcribe` | `{dataUrl, lang?}` → `{text}` (voice input; `{warm:true}` pre-warms the model) |
