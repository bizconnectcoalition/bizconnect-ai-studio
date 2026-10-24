/* BizConnect AI Studio — brand settings.
   Every studio site reads ONE of these files. To make a studio for another business, copy
   tools/brand-template/ (see project-docs/WHITE_LABEL.md). Image paths are relative to this folder. */
window.BRAND = {
  id: "bizconnect",                     // must match the folder name; sent to the back end with every request
  api: "https://bizconnect-ai-studio.virtualecommerceinc.workers.dev",

  productName: "BizConnect AI Studio",
  orgName: "Biz Connect Coalition",
  wordmark: ["BIZCONNECT", "AI Studio"], // header: big word, small word
  logo: "img/logo.png",                 // header mark (square, ~80px)
  logoAlt: "Biz Connect crest",
  crest: "img/crest.png",               // sign-in box emblem
  favicon: "img/logo.png",

  pageTitle: "BizConnect AI Studio — Every AI tool, one simple place",
  description: "Create images, videos, voiceovers, talking avatars, music, slide decks and more with the world's leading AI models, in one simple studio by Biz Connect Coalition.",
  hero: {
    eyebrow: "Biz Connect Coalition · AI Studio",
    titleHtml: "Every AI tool your business needs.<br><em>One simple studio.</em>",
    lead: "No need to learn ChatGPT, Claude, Gemini or ElevenLabs separately. Pick what you want to make, describe it in plain English, and the studio handles the rest.",
  },
  footer: "© {year} Biz Connect Coalition · BizConnect AI Studio (prototype)",
  gate: {
    intro: "BizConnect AI Studio is in private preview. Enter the access passcode to start creating.",
    invited: "You were invited by a BizConnect member. Welcome!",
  },
  referral: {
    copied: "Link copied! Share it with your chapter",
    empty: "No referrals yet. Share your link with your chapter!",
  },
  fileName: "bizconnect",               // fallback name for downloaded files
  exportColors: { bg: "0E1B33", accent: "C6972F", title: "F7F6F2", body: "DDE0E6" }, // PowerPoint export (hex, no #)

  // The floating helper. Set guide: null for no helper at all.
  guide: {
    name: "Allie",
    role: "Studio concierge",
    label: "your BizConnect Studio guide",
    avatar: "img/guide-avatar.jpg",     // small round photo on the "Ask Allie" tab
    poses: [                            // full-body cut-outs that cross-fade; leave [] for a compact round-avatar helper
      { src: "img/guide/allie-pose-wave.png", alt: "Allie waving hello" },
      { src: "img/guide/allie-pose-point.png", alt: "Allie pointing something out" },
      { src: "img/guide/allie-pose-welcome.png", alt: "Allie welcoming you with open arms" },
      { src: "img/guide/allie-pose-thumbsup.png", alt: "Allie giving a thumbs up" },
      { src: "img/guide/allie-pose-arms-crossed.png", alt: "Allie standing confidently" },
      { src: "img/guide/allie-pose-clipboard.png", alt: "Allie holding a clipboard, ready to help" },
    ],
    pages: {                            // what she says on each page (pose = index into poses)
      "index.html": { pose: 0, lines: ["Hi, I'm Allie! 👋 Not sure where to start? Tell me what you want to make.", "Tip: tap the 🎤 in any box and just talk. I'll type it for you."] },
      "studio.html": { pose: 1, lines: ["Try an example prompt, then tweak it. That's the fastest way to learn.", "Want better results? Pick a 'Best' AI model in the options."] },
      "account.html": { pose: 3, lines: ["Share your referral link and earn on every credit pack your referrals buy.", "Credits never expire, and there's no monthly fee."] },
    },
    greeting: "Hi{first}! I'm Allie. Tell me what you're trying to make (a flyer, a video, an email, anything) and I'll point you to the right studio.",
    chips: ["Make a flyer for my event", "Write a follow-up email", "Create a short promo video", "Build a brand kit"],
  },

  // Default face for the Talking Avatar studio. presenter: null = members must upload their own photo.
  presenter: { name: "Allie", thumb: "img/guide-avatar.jpg" },

  // Simple mode (the default) shows these starter tools; a button reveals the rest (Advanced).
  simpleStudios: ["chat", "image", "video"],
  defaultMode: "simple",

  // Per-studio wording overrides (any field from assets/studios.js). hide: [...] removes studios.
  studios: {
    image: { examples: ["Professional headshot-style photo of a smiling realtor in front of a modern home", "Flat-lay product photo of handmade candles on marble, soft light", "Poster for a business networking mixer, navy and gold, elegant", "Cozy coffee shop interior at golden hour, photorealistic"] },
    avatar: {
      blurb: "Type a script and a presenter speaks it on video: Allie, or a photo of you. No camera, lighting or retakes needed.",
      examples: ["Hi! I'm Allie from BizConnect. Our next networking breakfast is Thursday at 8. Come meet local business owners!", "Welcome to our shop! Every order this week ships free.", "Three quick tips to get more referrals this month. Tip one: follow up within 24 hours."],
    },
    deck: { examples: ["Why local businesses should join a networking chapter", "Quarterly update for my real-estate team", "Pitch deck for a mobile dog-grooming startup", "Workshop: 5 ways to get more Google reviews"] },
    outreach: { examples: ["bizconnectcoalition.com"] },
  },
};
