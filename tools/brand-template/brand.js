/* <Business> AI Studio — brand settings (TEMPLATE: copy this folder, then edit every value).
   Step-by-step guide: project-docs/WHITE_LABEL.md. Image paths are relative to the brand folder.
   Only id, api, productName and logo are required; everything else falls back to a sensible default. */
window.BRAND = {
  id: "acme",                           // REQUIRED. Lowercase, = this folder's name. Add the same id to BRANDS in worker/src/index.js
  api: "https://bizconnect-ai-studio.virtualecommerceinc.workers.dev", // REQUIRED. The back end (shared Worker today)

  productName: "Acme AI Studio",        // REQUIRED. Used in titles, footer, documents
  orgName: "Acme Co.",
  wordmark: ["ACME", "AI Studio"],      // header: big word, small word (keep the big word short; it must fit on a phone)
  logo: "img/logo.svg",                 // REQUIRED. Square, light-colored (the header is dark). Shows at 40px
  logoAlt: "Acme logo",
  crest: "img/crest.svg",               // emblem at the top of the sign-in box (~76px wide). Defaults to logo
  favicon: "img/favicon.svg",           // browser-tab icon

  pageTitle: "Acme AI Studio — Every AI tool, one simple place",
  description: "TODO: one sentence for link previews.",
  noindex: true,                        // keep search engines away until the business approves the site (delete when live for real)
  hero: {                               // the home page's headline block
    eyebrow: "Acme · AI Studio",
    titleHtml: "Every AI tool your business needs.<br><em>One simple studio.</em>", // <em> = accent color
    lead: "TODO: two sentences in the customer's own words about what they can make here.",
  },
  footer: "Preview prototype prepared for Acme Co.", // {year} = current year. Don't claim the business's copyright until they approve
  gate: {                               // the sign-in box
    intro: "Acme AI Studio is in private preview. Enter the access passcode to start creating.",
    invited: "You were invited by a fellow member. Welcome!", // shown when someone arrives through a referral link
    note: "",                           // optional small print under the sign-in form (e.g. who stores members' data)
  },
  referral: {
    copied: "Link copied! Share it with your friends",
    empty: "No referrals yet. Share your link!",
  },
  fileName: "acme",                     // fallback name for downloaded files
  exportColors: { bg: "1A1A1A", accent: "C6972F", title: "FFFFFF", body: "DDDDDD" }, // PowerPoint export (hex, no #)

  // The floating helper and concierge chat. Set guide: null to have no helper at all.
  guide: {
    name: "Max",
    role: "Studio guide",               // small caption in the chat header
    label: "your Acme studio guide",    // for screen readers
    avatar: "img/guide-avatar.svg",     // round image: the compact helper and the "Ask Max" tab
    poses: [],                          // [] = compact round helper. Or full-body transparent PNG cut-outs that cross-fade:
                                        // [{ src: "img/guide/wave.png", alt: "Max waving" }, …]
    pages: {                            // speech bubbles per page (pose = index into poses)
      "index.html": { pose: 0, lines: ["Hi, I'm Max! Tell me what you want to make.", "Tip: tap the 🎤 in any box and just talk."] },
      "studio.html": { pose: 0, lines: ["Try an example prompt, then make it yours."] },
      "account.html": { pose: 0, lines: ["Share your referral link and earn on every credit pack your referrals buy."] },
    },
    greeting: "Hi{first}! I'm Max. Tell me what you'd like to make and I'll point you to the right studio.", // {first} = " Jane"
    chips: ["Make a flyer", "Write a follow-up email", "Create a short promo video", "Build a brand kit"],
  },

  // Default face for the Talking Avatar studio ({ name, thumb } with the photo also placed in worker/public/),
  // or null = members must upload their own photo.
  presenter: null,

  // Hover examples on the studio cards. Leave out to use the core examples (a made-up bakery), or give
  // any studio its own: previews: { chat: { kind: "chat", prompt: "…", reply: "…" }, image: { kind: "image", prompt: "…", src: "brands/acme/previews/image.webp" } }
  // Field reference: docs/assets/previews.js.

  // Simple mode (the default view) shows only these starter tools, with a button for the rest.
  // Pick 3, in order of what this business's customers do most; never list a studio that is also in studios.hide.
  // Default: chat, image, video. defaultMode: "advanced" opens with every tool showing instead.
  simpleStudios: ["chat", "image", "video"],
  defaultMode: "simple",

  // Per-studio wording. Any field from docs/assets/studios.js: tagline, blurb, placeholder, examples,
  // personas (chat), styles (image), genres/moods (music), languages (translate).
  // hide: ["music", "outreach"] removes studios completely.
  studios: {
    // chat: { examples: ["…", "…", "…", "…"] },
    // image: { examples: ["…"] },
  },
};
