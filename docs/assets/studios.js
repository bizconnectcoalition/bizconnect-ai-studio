/* AI Studio — the ten studios (shared by every brand).
   Each entry drives the home-page card, the quick-create panel and the full studio page.
   icon = small line icon (24 grid); art = the detailed duotone card icon (32 grid; classes l line, d tint, k/w solid, o faded, p cut-out);
   hue = that card's tile color (0-360); optional sat / tone (x1.0) even out bright hues (yellow, green, cyan) so the white icon stays readable. Keep the wording here brand-neutral; a brand changes any field via BRAND.studios in its brand.js. */
const CORE_STUDIOS = [
  {
    id: "chat", name: "Chat", verb: "Ask anything",
    tagline: "Your all-purpose AI assistant",
    blurb: "Ask a question, draft an email, plan a post or brainstorm ideas. It's like having ChatGPT, Claude and Gemini in one place, and you can switch between them any time.",
    placeholder: "Write a friendly follow-up email to someone I met at last night's networking event…",
    examples: ["Write a 30-second elevator pitch for my landscaping business", "Give me 5 Instagram post ideas for a bakery", "Summarize the pros and cons of an LLC vs S-Corp", "Draft a thank-you note to a referral partner"],
    personas: ["Marketing coach", "Sales copywriter", "Business advisor", "Social media manager", "Friendly editor"],
    icon: '<path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1.1-4.4A8 8 0 1 1 21 12Z"/><path d="M8.5 11h7M8.5 14h4.5"/>',
    hue: 38, tone: 0.9,
    art: '<path class="d" d="M6 5h12a3 3 0 0 1 3 3v6a3 3 0 0 1-3 3h-7.5L6 20.5V17a3 3 0 0 1-3-3V8a3 3 0 0 1 3-3Z"/><path class="l o" d="M3 14V8a3 3 0 0 1 3-3h12a3 3 0 0 1 3 3v1"/><path class="p l" d="M14 12h12.5a3 3 0 0 1 3 3v6.5a3 3 0 0 1-3 3H26v3.5L21.5 24.5H14a3 3 0 0 1-3-3V15a3 3 0 0 1 3-3Z"/><circle class="k" cx="16.2" cy="18.3" r="1.5"/><circle class="k" cx="20.2" cy="18.3" r="1.5"/><circle class="k" cx="24.2" cy="18.3" r="1.5"/>'
  },
  {
    id: "image", name: "Images", verb: "Create an image",
    tagline: "Flyers, product shots, social graphics",
    blurb: "Describe the picture you want and AI creates it in seconds. Great for social posts, event flyers, product mock-ups and website images.",
    placeholder: "A bright flyer-style photo of a charity car wash on a sunny Saturday…",
    examples: ["Professional headshot-style photo of a smiling realtor in front of a modern home", "Flat-lay product photo of handmade candles on marble, soft light", "Poster for a summer open house, bright and elegant", "Cozy coffee shop interior at golden hour, photorealistic"],
    styles: ["Photorealistic", "Clean flat illustration", "3D render", "Watercolor", "Bold poster", "Minimal line art"],
    icon: '<rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="9" cy="10" r="2"/><path d="m21 16-5-5-9 9"/>',
    hue: 330,
    art: '<path class="d" d="M4 24 11.5 15.2 17.3 21.6 21 17.9 28 25v.2a1.8 1.8 0 0 1-1.8 1.8H5.8A1.8 1.8 0 0 1 4 25.2Z"/><rect class="l" x="3" y="5" width="26" height="22" rx="4"/><path class="l" d="M3.6 23.6 11.5 15l9.6 10.8M17.6 21.4l3.6-3.6 7.3 7.3"/><circle class="k" cx="21.6" cy="11.4" r="2.7"/>'
  },
  {
    id: "video", name: "Video", verb: "Make a video clip",
    tagline: "Short AI video clips for reels and ads",
    blurb: "Turn a sentence or a photo into a short video clip. It's perfect for reels, ads and website headers. The premium engines add sound and dialogue.",
    placeholder: "Slow cinematic shot of a food truck serving tacos at a sunset street fair…",
    examples: ["Drone shot rising over a small-town main street at sunrise", "Close-up of a barista pouring latte art, slow motion", "A golden retriever running through a park in autumn leaves", "Product spin of a sleek water bottle on a pedestal, studio light"],
    icon: '<rect x="3" y="5" width="13" height="14" rx="2"/><path d="m16 10 5-3v10l-5-3z"/>',
    hue: 0,
    art: '<rect class="d" x="3" y="7" width="26" height="20" rx="4"/><rect class="l" x="3" y="7" width="26" height="20" rx="4"/><path class="l" d="M3 12h26M12 7l-2.7 5M20.5 7l-2.7 5"/><path class="k" d="M13.8 15.6v7.6c0 .8.8 1.2 1.5.8l6.2-3.8a.9.9 0 0 0 0-1.6l-6.2-3.8c-.7-.4-1.5 0-1.5.8Z"/>'
  },
  {
    id: "voice", name: "Voiceover", verb: "Create a voiceover",
    tagline: "Natural AI voices for any script",
    blurb: "Paste a script and pick a voice. You'll get a studio-quality voiceover for videos, ads, podcasts or your phone greeting.",
    placeholder: "Thanks for calling Summit Plumbing. We're helping another customer right now…",
    examples: ["Thanks for calling! You've reached Bright Smile Dental. Please leave a message and we'll call you right back.", "Introducing our summer menu: fresh, local and made with love.", "Welcome to this week's episode of Main Street Makers."],
    icon: '<path d="M12 3a3 3 0 0 0-3 3v6a3 3 0 0 0 6 0V6a3 3 0 0 0-3-3Z"/><path d="M19 11a7 7 0 0 1-14 0M12 18v3"/>',
    hue: 25,
    art: '<rect class="d" x="10.5" y="3" width="11" height="16" rx="5.5"/><rect class="l" x="10.5" y="3" width="11" height="16" rx="5.5"/><path class="l o" d="M13.8 8.6h4.4M13.8 12.2h4.4"/><path class="l" d="M6.5 14.5a9.5 9.5 0 0 0 19 0M16 24v4.2M11 28.5h10"/>'
  },
  {
    id: "avatar", name: "Talking Avatar", verb: "Make a talking video",
    tagline: "A presenter reads your script on camera",
    blurb: "Type a script and a presenter speaks it on video, using a photo of you. No camera, lighting or retakes needed.",
    placeholder: "Hi, I'm with Summit Realty. Here are three things to do before you list your home…",
    examples: ["Welcome to our shop! Every order this week ships free.", "Three quick tips to get more referrals this month. Tip one: follow up within 24 hours."],
    icon: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/><path d="M17.5 4.5c1 .8 1.5 2 1.5 3.5s-.5 2.7-1.5 3.5"/>',
    hue: 188, tone: 0.9,
    art: '<rect class="d" x="3" y="4" width="20" height="21" rx="4"/><rect class="l" x="3" y="4" width="20" height="21" rx="4"/><path class="w o" d="M6.3 24.9c.4-3.8 3.2-6.5 6.7-6.5s6.3 2.7 6.7 6.5Z"/><circle class="w" cx="13" cy="12.4" r="3.9"/><path class="p" style="stroke:var(--ico-bg);stroke-width:2.4" d="M20 18.5h8a2.5 2.5 0 0 1 2.5 2.5v3.5a2.5 2.5 0 0 1-2.5 2.5h-3.2L21.5 29.8V27H20a2.5 2.5 0 0 1-2.5-2.5V21a2.5 2.5 0 0 1 2.5-2.5Z"/><path class="k" d="M20 18.5h8a2.5 2.5 0 0 1 2.5 2.5v3.5a2.5 2.5 0 0 1-2.5 2.5h-3.2L21.5 29.8V27H20a2.5 2.5 0 0 1-2.5-2.5V21a2.5 2.5 0 0 1 2.5-2.5Z"/><circle class="p" cx="21.8" cy="22.8" r="1.05"/><circle class="p" cx="24.8" cy="22.8" r="1.05"/><circle class="p" cx="27.8" cy="22.8" r="1.05"/>'
  },
  {
    id: "music", name: "Music", verb: "Create music",
    tagline: "Background music and full songs",
    blurb: "Get royalty-free background music for your videos, or a full song with vocals. Describe the vibe and AI composes it.",
    placeholder: "Upbeat acoustic background music for a small business promo video…",
    examples: ["Chill lo-fi beat for a coffee shop reel", "Inspiring cinematic build for a company intro", "Catchy jingle about a family pizza shop", "Warm acoustic guitar for a wedding photographer's reel"],
    genres: ["Pop", "Acoustic", "Lo-fi", "Cinematic", "Hip-hop", "Country", "Jazz", "Electronic", "Corporate"],
    moods: ["Upbeat", "Chill", "Inspiring", "Emotional", "Playful", "Epic"],
    icon: '<path d="M9 18V5l11-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="17" cy="16" r="3"/>',
    hue: 255,
    art: '<path class="l" d="M11 23.5V8.8l13.5-3v14.5"/><path class="k" d="M11 8.8l13.5-3v4.6L11 13.4Z"/><ellipse class="k" cx="7.6" cy="23.6" rx="3.6" ry="3"/><ellipse class="k" cx="21.1" cy="20.4" rx="3.6" ry="3"/><path class="l o" d="M28.6 13.5v7M3.6 9.5v5"/>'
  },
  {
    id: "deck", name: "Slide Decks", verb: "Build a presentation",
    tagline: "Presentations in minutes, PowerPoint ready",
    blurb: "Give it a topic and it writes a complete slide deck with titles, bullet points and speaker notes. Download it as a PowerPoint.",
    placeholder: "A 10-minute pitch for my commercial cleaning company to office managers…",
    examples: ["How our business helps first-time customers", "Quarterly update for my real-estate team", "Pitch deck for a mobile dog-grooming startup", "Workshop: 5 ways to get more Google reviews"],
    icon: '<rect x="3" y="4" width="18" height="12" rx="1.5"/><path d="M12 16v4M8 20h8M7 8h6M7 11h10"/>',
    hue: 128, tone: 0.85,
    art: '<rect class="d" x="8" y="3.5" width="21" height="15" rx="2.5"/><rect class="l o" x="8" y="3.5" width="21" height="15" rx="2.5"/><rect class="p l" x="3" y="9" width="21" height="15" rx="2.5"/><path class="k" d="M7 13h9.5v2.2H7Z"/><path class="l o" d="M7 19h12"/><path class="l" d="M13.5 24v3.5M9.5 28.5h8"/>'
  },
  {
    id: "translate", name: "Translate", verb: "Translate text",
    tagline: "Documents and messages in 30+ languages",
    blurb: "Paste any text and get a natural, professional translation. It's great for flyers, menus, emails and customer messages.",
    placeholder: "Paste the text you'd like translated…",
    examples: ["We are open Monday through Saturday, 8am to 6pm. Walk-ins welcome!", "Thank you for your business. Your order will arrive in 3–5 days."],
    languages: ["Spanish", "French", "Portuguese", "Italian", "German", "Chinese (Simplified)", "Japanese", "Korean", "Vietnamese", "Arabic", "Hindi", "Tagalog", "Russian", "Polish", "Haitian Creole"],
    icon: '<path d="M4 5h9M8.5 3v2M6 5c.6 3 2.6 5.4 5 6.6M11 5c-.8 3.3-3 6-6 7.5"/><path d="m13 21 4-9 4 9M14.5 18h5"/>',
    hue: 168, sat: 0.82, tone: 0.86,
    art: '<rect class="d" x="2.5" y="3" width="16" height="16" rx="3.4"/><rect class="l o" x="2.5" y="3" width="16" height="16" rx="3.4"/><path class="l" style="stroke-width:2.1" d="M6.2 15.2 10.5 6.2l4.3 9M7.7 12.2h5.6"/><rect class="p l" x="14" y="13" width="15.5" height="15.5" rx="3.2"/><path class="k" d="M18 17h8.5v1.8H18ZM21.3 15h1.9v2h-1.9Z"/><path class="l" d="M24.4 18.6c-.7 3.6-2.8 5.9-5.4 7.2M19.7 20.7c1.1 2.3 3 4.1 5.6 5"/>'
  },
  {
    id: "outreach", name: "Sales Outreach", verb: "Research a prospect",
    tagline: "A tailored outreach pack from any website",
    blurb: "Paste a prospect's website. AI reads it and writes a personalized cold email, LinkedIn message, text, call opener and follow-up, all tailored to them.",
    placeholder: "https://example-business.com",
    examples: ["example-business.com"],
    icon: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5M8 11h6M11 8v6"/>',
    hue: 212, sat: 0.9, tone: 1.04,
    art: '<circle class="d" cx="13" cy="13" r="9.5"/><circle class="l" cx="13" cy="13" r="9.5"/><circle class="k" cx="13" cy="10.8" r="3"/><path class="w" d="M7.6 18.6c1-2.6 3-3.9 5.4-3.9s4.4 1.3 5.4 3.9a8 8 0 0 1-10.8 0Z"/><path class="l" style="stroke-width:3.2" d="M20.3 20.3 27.5 27.5"/>'
  },
  {
    id: "brand", name: "Brand Kit", verb: "Build my brand kit",
    tagline: "Tagline, colors, bios and a logo idea",
    blurb: "Describe your business and get a starter brand kit: name ideas, tagline, color palette, fonts, bios and a logo concept.",
    placeholder: "A family-owned mobile dog-grooming business in Tampa, friendly and upscale…",
    examples: ["Boutique bookkeeping firm for creative freelancers", "Farm-to-table food truck in Austin", "Veteran-owned HVAC company, trustworthy and local", "Yoga studio for busy professionals"],
    icon: '<path d="M12 3 4 7v5c0 5 3.4 8.3 8 9 4.6-.7 8-4 8-9V7Z"/><path d="m9 12 2 2 4-4"/>',
    hue: 300, sat: 0.7, tone: 0.9,
    art: '<g transform="translate(.8 .8) scale(.95)"><path class="d" d="M16 3.5C8.8 3.5 3 8.9 3 15.6S8.6 28 15.4 28c1.9 0 2.9-1.2 2.9-2.6 0-1.9-1.8-2.5-1.8-4.2 0-1.4 1.1-2.4 2.7-2.4h3.6c3.9 0 6.2-2.6 6.2-5.6C29 7.7 23.4 3.5 16 3.5Z"/><path class="l" d="M16 3.5C8.8 3.5 3 8.9 3 15.6S8.6 28 15.4 28c1.9 0 2.9-1.2 2.9-2.6 0-1.9-1.8-2.5-1.8-4.2 0-1.4 1.1-2.4 2.7-2.4h3.6c3.9 0 6.2-2.6 6.2-5.6C29 7.7 23.4 3.5 16 3.5Z"/><circle class="k" cx="9.3" cy="14.2" r="2.3"/><circle class="w" cx="12.6" cy="8.9" r="2.3"/><circle class="k o" cx="18.8" cy="8.2" r="2.3"/><circle class="w o" cx="23.6" cy="12" r="2.3"/></g>'
  }
];
// Apply the brand's overrides: BRAND.studios = { hide: ["music"], avatar: { examples: [...] }, ... }
const STUDIO_OVERRIDES = (window.BRAND && window.BRAND.studios) || {};
window.STUDIOS = CORE_STUDIOS
  .filter((s) => !(STUDIO_OVERRIDES.hide || []).includes(s.id))
  .map((s) => {
    const o = STUDIO_OVERRIDES[s.id] || {}, merged = { ...s, ...o };
    if (o.icon && !("art" in o)) delete merged.art;   // a brand's own line icon wins over the core art (art:"" also opts out)
    return merged;
  });
window.STUDIO_BY_ID = Object.fromEntries(window.STUDIOS.map((s) => [s.id, s]));
