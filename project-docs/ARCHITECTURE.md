# Architecture

## Pieces
```
Client site (GitHub Pages, static)            Shared Worker (Cloudflare)                fal.ai
  index.html / studio.html / account.html  →   bizconnect-ai-studio.virtualecommerceinc   →  every AI model
  brand.js loader → brands/<id>/brand.*         .workers.dev  (KV: users, history, jobs)       (one key, one bill)
                                                 → Google Sheet (sign-in log, optional)
```

## How a page gets its brand
1. Each page's `<head>` loads `assets/app.css` (shared design, colors only as tokens) and then `brand.js`.
2. `docs/brand.js` (the **loader**) holds `DEFAULT_BRAND`. It writes two tags while the page is still loading: `brands/<id>/brand.css` (the `:root` color and font tokens, plus any small brand tweaks) and `brands/<id>/brand.js` (which sets `window.BRAND`).
   On localhost only, `?brand=<id>` previews another brand folder that exists in the same `docs/`.
3. At the end of `<body>`: `assets/studios.js` builds `window.STUDIOS` from the core list plus `BRAND.studios` overrides (and `hide`). `assets/app.js` fills every `[data-brand]` / `[data-brand-html]` element, the title, description and favicon, then provides header, footer, sign-in box and guide from `BRAND`.
4. `tools/sync-client.ps1` copies the core into a client folder and rewrites `DEFAULT_BRAND`. The client's `docs/brands/<id>/` is never touched by the sync.

### Brand file fields
See `docs/brands/_template/brand.js` (every field explained) and `docs/brands/_template/brand.css` (every token explained). Required: `id`, `api`, `productName`, `logo`, the `:root` tokens. Everything else has a default.

### CSS tokens
`--bg-950…--bg-600` (canvas and panels), `--ink`, `--accent`, `--accent-hi/-glow/-deep`, `--text`, `--text-dim`, `--slate`, `--slate-dim`, `--green`, `--red`, `--line`, `--line-soft`, `--card`, fonts `--serif`, `--serif-2`, `--sans`, `--mono`, and RGB triplets for tints (`--accent-rgb`, `--accent-hi-rgb`, `--text-rgb`, `--slate-rgb`, `--bg-950-rgb`, `--bg-700-rgb`, `--bg-600-rgb`, `--bg-raise-rgb`, `--ink-rgb`, `--overlay-rgb`). The design is built for **dark** canvases; a light theme needs core work (see VISION.md).

## The Worker and brands
- Every POST body carries `brand: "<id>"` (added automatically by `api()` in `app.js`).
- `BRANDS` in `worker/src/index.js` maps ids to `{product, about, audience, guide, presenter}`. Used for:
  - the concierge system prompt (guide name, product, description),
  - the Chat studio's system prompt (product, audience),
  - the default Talking Avatar photo (`presenter`, a file in `worker/public/`; `null` = member must upload a photo, enforced before any credits are charged),
  - the sign-in log: non-BizConnect sign-ins show as `login (<id>)` / `signup (<id>)` in the sheet's Event column, and new users get `brand` saved on their record.
- Only ids in `BRANDS` are honoured; anything else falls back to `bizconnect`. No text from the page ever reaches a prompt through this field.

### What is shared today (prototype)
All studios share **one** passcode, **one** daily spend cap, **one** KV store (a person who signs in to two studios with the same email has one wallet), and **one** fal.ai bill. That's fine for previews. Before a client opens to the public, decide D-004 in DECISIONS.md.

## Data kept (Cloudflare KV `STUDIO_KV`)
`user:<email>` (name, credits, referral code, referrer, purchases, brand), `refs:<email>`, `refcode:<code>`, `hist:<email>` (last 80 creations), `job:<id>`, `spend:<date>`, `log:logins`, short-lived uploads `up:<id>`.

## Accounts and hosting
| Thing | Account |
|---|---|
| BizConnect studio repo | GitHub `bizconnectcoalition` (SSH alias `github-bizconnect-ai-studio`, a deploy key for this repo only) |
| Root & Bloom repo | GitHub `dshenterpriseinc` (SSH alias `github-dshenterpriseinc`). Can be transferred to another owner later |
| Worker + KV | Cloudflare, virtualecommerceinc@gmail.com (`npx wrangler` is logged in on Dan's PC) |
| AI | fal.ai (key stored only as the Worker secret `FAL_KEY`) |
| Sign-in log | Google Sheet "BizConnect AI Studio - Logins" via `sheets/LoginTracker.gs` |
