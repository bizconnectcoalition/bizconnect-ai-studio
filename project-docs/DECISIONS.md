# Decisions and open questions

Newest first. Status: DECIDED / OPEN.

## D-008 · 2026-10-23 · Simple mode by default (DECIDED)
Dan: "a simple mode and then an advanced mode. The simple mode just has chat, images, video… then you can click a button for showing the rest." Built into the core so every brand gets it. Starter tools are per brand (`simpleStudios`), and the choice is remembered per browser. This BizConnect setup is now the template the other business studios follow.

## D-007 · 2026-10-23 · Seven-reviewer critique of the white-label build (DONE)
Independent reviews: cold-start comprehension, follow-the-guide (built a third test brand from the docs alone, with zero errors), front-end code, Worker safety and compatibility, Root & Bloom brand fit, privacy/public-repo, architecture. **Applied:**
- safer sync: staleness check (`-Check`), hand-edit guard, loud failures
- template moved out of the served site
- hidden studios no longer break "Use this in…" links
- visible error if a brand file is missing
- `noindex` + "not yet official" footer + data note for previews
- product-claim wording removed from Root & Bloom prompts ("organic", "gentle on sensitive scalps")
- Worker `brand` must be a string; new members store the brand they joined through
- account details moved out of public docs

**Deferred:** D-004 (per-brand passcodes, caps, wallets), light theme, plainer labels ("Quality" instead of "AI engine", "credits" instead of "cr"), a brand-contract version number.

## D-006 · 2026-10-23 · Client brands live only in the client's repo (DECIDED)
The core repo carries only the `bizconnect` brand (the starter template is in `tools/brand-template/`, not served). The Worker's `BRANDS` list does name each client, because the shared back end must know them. Root & Bloom's brand files live in `ai-studio-clients\rootbloom-ai-studio\docs\brands\rootbloom\`. **Why:** the BizConnect repo and site are public, so client logos and wording would otherwise be published on BizConnect's site. Clients also get their own repo history. **Cost:** a core change has to be synced into each client (`tools\sync-client.ps1`).

## D-005 · 2026-10-23 · Root & Bloom hosted under GitHub `bizconnectcoalition` (DECIDED)
Dan chose to keep client studios under the BizConnect GitHub account: `bizconnectcoalition/rootbloom-ai-studio`, pushed with its own deploy key (one key per repo, the same pattern as the core). A client can later get the repo transferred to its own account; the Pages URL changes with it.

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
