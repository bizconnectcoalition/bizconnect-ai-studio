# AGENTS.md — BizConnect AI Studio (read this first)

Orientation for any AI agent or developer opening this folder. Read this file and the four short files in `project-docs/` before changing anything.

> **The BizConnect studio is the TEMPLATE for every new business studio.** It's the starting point (Simple/All-tools mode, the plain AI-model dropdown, hover examples, the full-size guide character, the default Talking Avatar presenter). A new studio starts as an exact copy plus its own brand, and may then be customised and drift from it: see *Starting point, not a cage* in `project-docs/WHITE_LABEL.md`.
>
> **This repo is two things:** the shared AI Studio **core** (used by every business's studio) **and** BizConnect's own branded studio. Client studios live next door in `..\ai-studio-clients\`.

## What this is, in one paragraph

An **all-in-one AI studio for small businesses**: one simple website where non-technical owners can chat with AI, make images and flyers, short videos, voiceovers, talking-avatar videos, music, slide decks, translations, sales-outreach packs and brand kits. They don't need to learn ChatGPT, Gemini, ElevenLabs and the rest separately. Members sign in with a passcode, spend prepaid credits (1 credit = 1¢, priced at 3× the AI cost), and earn 10% when people they refer buy credits. It started as **Biz Connect Coalition's member studio** (BizConnect is a business-networking organization). The bigger goal is to **reuse the exact same studio for other businesses, each with its own custom-branded site** (white-label).

## The BizConnect family on disk

```
R:\Documents\Claude\Projects\Bizconnect\
├─ Bizconnect Github\          BizConnect's public marketing site (separate repo, separate AGENTS.md)
├─ bizconnect-ai-studio\       ← YOU ARE HERE: the studio CORE + BizConnect's own brand
└─ ai-studio-clients\          one folder (and one git repo) per business that gets its own studio
   ├─ README.md                index of client studios
   └─ rootbloom-ai-studio\     Root & Bloom Salon Source (client #1)
```

- **Core** = everything in `docs/` except `docs/brands/`, plus the Worker. One copy, here.
- **Brand** = `docs/brands/<id>/` (`brand.js` holds words and settings, `brand.css` holds colors and fonts, `img/` holds logos and the guide). BizConnect's brand lives here. Each client's brand lives only in that client's own folder and repo, so client material never appears on BizConnect's public site.
- **Client studio** = core + one brand, copied into `ai-studio-clients\<client>\docs` by `tools\sync-client.ps1`.

## Live addresses

| What | Where |
|---|---|
| BizConnect studio | https://bizconnectcoalition.github.io/bizconnect-ai-studio/ (repo `bizconnectcoalition/bizconnect-ai-studio`, GitHub Pages from `main` `/docs`) |
| Client studios | see `..\ai-studio-clients\README.md` |
| Shared back end | https://bizconnect-ai-studio.virtualecommerceinc.workers.dev (Cloudflare Worker; account details in `PRIVATE_NOTES.md`) |

## How to do the common jobs

| Job | How |
|---|---|
| Change BizConnect's wording, guide or colors | Edit `docs/brands/bizconnect/brand.js` / `brand.css` → preview → commit + push this repo (GitHub Pages updates in 1–2 min; hard-refresh) |
| Change how every studio works | 1) edit the core (`docs/assets/*`, `docs/*.html`) 2) screenshot-compare BizConnect (rule 3) 3) commit + push **this** repo (BizConnect goes live) 4) `tools\sync-client.ps1` for each client, check it, commit + push each client repo. `tools\sync-client.ps1 -Check` lists clients that are behind |
| Change a client's wording or colors | Only in that client's folder: `docs\brands\<id>\` → commit + push the client repo (no sync needed) |
| Change which tools Simple mode shows | `simpleStudios` in that brand's `brand.js` (default chat, image, video); `defaultMode: "advanced"` to start with all tools |
| Change the hover examples on the cards | Core: `docs/assets/previews.js` + `docs/assets/previews/`. One brand: `previews` in its `brand.js` |
| Let one business keep its own version of a core file | List the path in `..\ai-studio-clients\<client>\CLIENT_OWNED.txt`; sync then leaves it alone (see WHITE_LABEL.md) |
| Make a studio for a new business | Follow `project-docs/WHITE_LABEL.md` step by step |
| Change AI engines or prices | `ENGINES` in `worker/src/index.js`, then `npx wrangler deploy` from `worker/` (separate from pushing the site; it affects **every** studio at once) |
| Give a brand its own concierge voice | Add it to `BRANDS` in `worker/src/index.js`, then deploy the Worker (required for every new client) |
| Preview locally | `python -m http.server 8743 --directory docs` → http://localhost:8743 (`?brand=<id>` previews another brand in this repo) |

## Rules (do not weaken)

1. **Public repos.** This repo and the client repos are public. Never commit secrets (fal.ai key, passcode, sheet token), personal contact details, or private business notes. Secrets live only as Worker secrets (`npx wrangler secret put`). Private context belongs in the git-ignored `PRIVATE_NOTES.md`.
2. **No brand inside the core.** Never type a business name, logo path or brand color into `docs/assets/*` or `docs/*.html`. (Exceptions: the Worker's `BRANDS` list names each client, because the shared back end must know them; and `docs/assets/previews.js` holds the made-up "Maple & Main Bakery" default hover examples.) Use `window.BRAND` / `BCAI.brand` in JS and the CSS tokens (`var(--accent)`, `rgba(var(--accent-rgb),.2)`, `var(--bg-900)`…). If a brand needs something new, add an optional field to `brand.js` with a sensible default in the core, and document it in `tools/brand-template/brand.js`.
3. **BizConnect must not change by accident.** After any core change, compare before/after screenshots of all three pages at desktop and phone width. The 2026-10-23 refactor was verified pixel-identical this way.
4. **The Worker is shared and live.** Every studio uses it, so a bad deploy breaks all of them. Keep changes backward-compatible: pages already open in someone's browser send the old request shapes. After deploying, check `/health` and `/api/catalog`.
5. **Don't push or deploy unless the owner asks.** The owner (Dan) uses phrases like "push it", "ship it", "update the site". When he does, his global instructions describe the full pipeline.
6. **Static hosting only** for the front end (GitHub Pages). No build step: plain HTML, CSS and JS.
7. **Windows + PowerShell** is the owner's environment. Give PowerShell commands, not bash.

## Where everything else is

| File | Contents |
|---|---|
| `project-docs/VISION.md` | Why this exists, who it's for, the white-label business idea, what's next |
| `project-docs/ARCHITECTURE.md` | How a page loads its brand, how the Worker uses `brand`, data stored, accounts used |
| `project-docs/WHITE_LABEL.md` | Step-by-step: new business studio from zero to live |
| `project-docs/DECISIONS.md` | Dated log of decisions and open questions |
| `README.md` | Feature summary, layout, API table |
| `PRIVATE_NOTES.md` | People, naming discussions and anything not for a public repo. **Git-ignored**: local disk only |
