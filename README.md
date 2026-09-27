# BizConnect AI Studio

An all-in-one AI creation studio for Biz Connect Coalition members. It offers ten simple studios (chat, images, video, voiceover, talking avatar, music, slide decks, translation, sales outreach and brand kits) in the BizConnect navy-and-gold look, with a credit wallet and referral sharing.

**Status:** private-preview prototype.

## How it works

```
Browser (GitHub Pages: /docs)  ──►  Cloudflare Worker (/worker)  ──►  fal.ai (all AI models)
   10 studios, wallet UI              passcode, pricing (3x), wallet,       Veo, Kling, LTX, Hailuo, FLUX,
   Allie concierge                    referrals, daily cap, history         Nano Banana, ElevenLabs, Kokoro,
                                      (Cloudflare KV)                       Fabric, Lyria, MiniMax, Claude/GPT/Gemini
```

- **The fal.ai key never reaches the browser.** It lives only as a Worker secret.
- **Pricing.** 1 credit = $0.01. Every generation costs its fal.ai list price × `MARKUP` (3). The price table lives in `worker/src/index.js` (`ENGINES`).
- **Safety rails.**
  - Everyone signs in with a studio passcode.
  - The Worker enforces a daily fal.ai spend cap (`DAILY_CAP_USD`).
  - Failed renders are refunded automatically.
- **Referrals.** A referrer earns `REF_SHARE` (10%) of their referrals' credit purchases. There's no pay-to-join and no pay for holding credits.
- **Payments.** Top-ups are **demo-only** (no charge). Plug a real checkout such as Stripe into `/api/topup`.

## Layout

| Path | What |
|---|---|
| `docs/` | Static front end served by GitHub Pages (`index.html`, `studio.html?s=<id>`, `account.html`) |
| `docs/assets/studios.js` | The ten studios: copy, examples, icons |
| `docs/assets/controls.js` | Engine picker and per-studio options |
| `docs/assets/app.js` | API client, pricing estimate, output rendering, Allie concierge |
| `worker/src/index.js` | Cloudflare Worker API |
| `worker/wrangler.toml` | Worker config (KV binding, markup, cap, starter credits) |
| `worker/public/` | Files the Worker serves publicly (default Allie presenter photo) |

## Run locally

```bash
python -m http.server 8743 --directory docs
```

Then open http://localhost:8743. The page talks to the deployed Worker.

## Deploy the Worker

```bash
cd worker
npx wrangler deploy
```

Secrets are set once and never committed: `FAL_KEY` (fal.ai API key) and `STUDIO_PASSCODE` (tester passcode).

```bash
'value' | npx wrangler secret put FAL_KEY
```

## API (Worker)

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/catalog` | Engines and prices (public) |
| POST | `/api/login` | `{name, handle, passcode, ref?}` → session token |
| GET | `/api/me` | Wallet, referrals, today's spend |
| POST | `/api/generate` | `{studio, engine, prompt, options}` → result, or `jobId` for video/avatar/music |
| GET | `/api/job/:id` | Poll a render; refunds on failure |
| GET | `/api/history?studio=` | Saved creations |
| POST | `/api/upload` | Photo for image-to-video or a custom avatar presenter |
| POST | `/api/topup` | Demo credit packs (no payment) |
| POST | `/api/concierge` | Allie, the studio guide |
