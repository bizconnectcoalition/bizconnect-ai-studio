# Decisions and open questions

Newest first. Status: DECIDED / OPEN.

## D-006 · 2026-10-23 · Client brands live only in the client's repo (DECIDED)
The core repo carries only `bizconnect` and `_template` brands. Root & Bloom's brand files live in `ai-studio-clients\rootbloom-ai-studio\docs\brands\rootbloom\`. **Why:** the BizConnect repo and site are public, so client logos and wording would otherwise be published on BizConnect's site. Clients also get their own repo history. **Cost:** a core change has to be synced into each client (`tools\sync-client.ps1`).

## D-005 · 2026-10-23 · Root & Bloom hosted under GitHub `dshenterpriseinc` (DECIDED for now)
That was the only GitHub account where a new repo could be created and pushed without Dan signing in. `bizconnectcoalition` wasn't signed in anywhere, and its SSH key is a deploy key for the studio repo only. **Can change:** GitHub → repo Settings → Transfer ownership to `bizconnectcoalition` (or the client's own account). The Pages URL changes with it.

## D-004 · 2026-10-23 · Back end for client studios (OPEN)
Today every studio shares one Worker, one passcode, one daily cap, one wallet store and one fal.ai bill. The Worker knows each brand's voice through `BRANDS`. Options before a client goes public:
- **A. One shared Worker, per-brand settings**: add per-brand passcodes, caps and wallet namespaces (`user:<brand>:<email>`), and per-brand pricing. Cheapest to run, one place to update.
- **B. One Worker per business**: copy `worker/` with its own name, KV, `FAL_KEY` (its own fal.ai bill) and passcode. Strongest isolation, more to maintain.
Dan chose "decide later" (2026-10-23). Lean: **A**, unless a client must pay its own AI bill directly.

## D-003 · 2026-10-23 · White-label structure (DECIDED)
Brand = `docs/brands/<id>/{brand.js, brand.css, img/}`, loaded by `docs/brand.js`. The core uses only tokens and `BRAND` fields. The BizConnect brand was extracted from the existing site and verified **pixel-identical** (12 screenshots, 3 pages × desktop/phone × signed-in/out; the only difference was the random test-server port inside the referral link). Two small mobile bugs were fixed in the core at the same time: the hero text touched the screen edges, and "Top up" wrapped onto two lines.

## D-002 · 2026-10-23 · Repo stays public (DECIDED)
No secrets in it. Making it private on a free GitHub plan would switch off GitHub Pages.

## D-001 · 2026-09 · Stack (DECIDED)
Static front end on GitHub Pages + one Cloudflare Worker + fal.ai for every model (single key, single bill, list prices known), KV for state, Google Sheet for the sign-in log.
