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
4. `tools/sync-client.ps1` copies the core into a client folder and rewrites `DEFAULT_BRAND`. The client's `docs/brands/<id>/` is never touched by the sync. It records `docs/CORE_VERSION.txt` (core commit) and `docs/CORE_FILES.txt` (hashes), refuses to overwrite core files that were hand-edited in the client, and `-Check` reports which clients are behind.

### Brand file fields
See `tools/brand-template/brand.js` (every field explained) and `tools/brand-template/brand.css` (every token explained). New core fields must always be **optional with a default**, so older client brand files keep working. Required: `id`, `api`, `productName`, `logo`, the `:root` tokens. Everything else has a default.

### CSS tokens
`--bg-950…--bg-600` (canvas and panels), `--ink`, `--accent`, `--accent-hi/-glow/-deep`, `--text`, `--text-dim`, `--slate`, `--slate-dim`, `--green`, `--red`, `--line`, `--line-soft`, `--card`, fonts `--serif`, `--serif-2`, `--sans`, `--mono`, and RGB triplets for tints (`--accent-rgb`, `--accent-hi-rgb`, `--text-rgb`, `--slate-rgb`, `--bg-950-rgb`, `--bg-700-rgb`, `--bg-600-rgb`, `--bg-raise-rgb`, `--ink-rgb`, `--overlay-rgb`). Optional raised-surface tokens (cards, panels, stats, packs): `--card-border`, `--card-border-hover`, `--card-muted`, `--shadow-card`, `--shadow-card-hover`, `--tier-fast-text`. Each has a fallback in `app.css` (no shadow, `--line-soft` edge, `--slate` text), so an older brand keeps its plain look. Make `--card` clearly lighter than the page (first stop ≥ 1.4:1 vs `--bg-900`; see `tools/brand-template/brand.css`). The design is built for **dark** canvases; a light theme needs core work (see VISION.md).

## Simple / Advanced mode
Every studio opens in **Simple mode**: the home page shows only the brand's starter tools (`BRAND.simpleStudios`, default Chat · Images · Video) as larger cards, plus a **"Show all N tools"** button. **Advanced mode** shows every studio. A *Simple | All N tools* switch sits beside "What would you like to create?", and the studio page's tool tabs follow the same mode (with a "+ N more tools" / "Simple mode" tab).
- The choice is remembered per browser (`localStorage` key `bcai_mode`) and applies on every page. `BRAND.defaultMode: "advanced"` makes new visitors start with everything showing.
- Hidden tools still work: links from the guide, "Use this in…" or a URL open them, and the open studio always shows its own tab. A home-page link straight to a hidden tool (`index.html#open=deck`) shows all tools for that visit only; it doesn't change the remembered choice.
- Visitors who never touched the switch see the brand's default (Simple), including people who used the studio before the switch existed. If storage is blocked (private browsing), the switch still works for the current page.
- The code is `mode()`, `setMode()`, `visibleStudios()` and `modeToggle()` in `app.js`; it fires a `bcai:mode` event that `home.js` and `studio-page.js` redraw on.
- If a brand hides studios until only its starter tools remain, the switch disappears.
- Inside a studio, Simple mode replaces the AI-engine cards with one **"AI model (optional)" dropdown**. It is pre-set to the recommended low-cost model (`DEFAULT_ENGINE` in `controls.js`), and each option reads like "Quick · Gemini Flash · about 2 credits / reply" (Quick / Better / Best = the engine's fast / balanced / premium tier). All-tools mode shows the full engine cards.

## Example previews on the studio cards
Resting the mouse on a studio card for a moment opens a small **"Example"** popover: *You type → You get* for that tool. Chat shows a conversation; Images shows a prompt and the picture; Video and Talking Avatar play a short muted clip (with a **Sound on** button for the avatar); Voiceover and Music show the prompt and a **▶ play** button (browsers won't play sound on hover); Slide Decks show three mini slides; Translate, Sales Outreach and Brand Kit show their typical results. The popover's **"Try … yourself →"** opens that tool.
- Phones/tablets (no hover) and keyboards: each card has a small **▶ Example** button; on screens ≤720px the preview opens as a bottom sheet. Esc or × closes it.
- Code: `docs/assets/preview.js` (behaviour), example data in `docs/assets/previews.js` (`CORE_PREVIEWS`, all about a made-up "Maple & Main Bakery"), media in `docs/assets/previews/` (≈1 MB total). Media loads only when a preview opens.
- A brand replaces any tool's example with `BRAND.previews.<studio>` (same fields; `src`/`logo` paths are relative to `docs/`, e.g. `brands/rootbloom/previews/image.webp`). Missing media degrades to "Example coming soon".
- How every sample was made (prompts, ffmpeg settings) is in `project-docs/PREVIEW_MEDIA.md`.

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
The BizConnect repo is GitHub `bizconnectcoalition/bizconnect-ai-studio`. Each client repo is listed in `..\ai-studio-clients\README.md`. The Worker and KV are on Cloudflare, the AI on fal.ai (key only as the Worker secret `FAL_KEY`), and the sign-in log in a Google Sheet via `sheets/LoginTracker.gs`. Which accounts and logins own these is in the git-ignored `PRIVATE_NOTES.md` (local only).
