# Vision

## The problem
Small-business owners hear that AI can write their emails, make their flyers, cut their promo videos and voice their phone greeting. But that means a dozen separate apps, each with its own account, subscription and learning curve. Most owners give up after the first one.

## The product
**One simple studio.** Pick what you want to make, describe it in plain words (or just talk), and the studio chooses the right AI model and hands back something ready to use, with **Copy / Download / Share / Save as Word or PowerPoint** buttons on every result. Ten studios:

| Studio | Makes |
|---|---|
| Chat | Answers, emails, posts, ideas (Gemini, GPT, Claude) |
| Images | Flyers, product shots, social graphics |
| Video | Short clips for reels and ads, from text or a photo |
| Voiceover | Natural voices for ads, videos, phone greetings |
| Talking Avatar | A photo that speaks your script on video |
| Music | Background music and full songs |
| Slide Decks | Complete presentations, downloadable as PowerPoint |
| Translate | Natural translations in 15+ languages |
| Sales Outreach | Reads a prospect's website, writes a tailored outreach pack |
| Brand Kit | Name ideas, tagline, colors, fonts, bios, logo concept |

A friendly **guide** (BizConnect's Allie) greets newcomers and points them to the right studio.

## The money model (prototype settings)
- Prepaid credits, 1 credit = $0.01, no subscription, credits never expire.
- Every creation costs the AI provider's list price × 3 (`MARKUP`). Failed renders are refunded automatically.
- Referrals: a member earns 10% of what the people they referred spend on credits. Paid only on real purchases; no pay-to-join.
- New members get 500 free credits ($5) to try it.
- Payments are **not connected yet** (demo top-ups only). Stripe is the expected next step.

## White-label: the same studio for other businesses
The studio isn't BizConnect-specific in substance. Any business with a community of customers or members (a salon supplier, a franchise, a trade association, a church, a gym) can offer its people "our own AI studio" in its own look and voice. Each one gets:
- its **own website and domain** (its own repo and folder in `ai-studio-clients\`),
- its **own name, logo, colors, fonts and wording** (example prompts written for its industry),
- its **own guide character** (or a simple round avatar if there's no character art yet),
- a concierge that **speaks for that business** (the Worker's `BRANDS` list).

**Client #1: Root & Bloom Salon Source** (rootbloomsalonsource.com), a collective for independent hairstylists and salon owners built on organic products, education and community. Its studio speaks to stylists: client texts, rebooking reminders, salon flyers, service reels, education-night decks.

## What's next (rough order)
1. Root & Bloom feedback round, then adjustments.
2. Pick a product name and domain (see `PRIVATE_NOTES.md` for the naming discussion).
3. Decide the back-end model for clients (see `DECISIONS.md`, D-004): one shared Worker vs. one Worker per business.
4. Real payments (Stripe) in `/api/topup`.
5. Per-client passcodes and spending caps (needed before a second client goes live to the public).
6. Light-theme support in the core (Root & Bloom's own website is light; the studio is currently dark-only).
