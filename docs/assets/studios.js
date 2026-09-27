/* BizConnect AI Studio — the ten studios.
   Each entry drives the home-page card, the quick-create panel and the full studio page. */
window.STUDIOS = [
  {
    id: "chat", name: "Chat", verb: "Ask anything",
    tagline: "Your all-purpose AI assistant",
    blurb: "Ask a question, draft an email, plan a post or brainstorm ideas. It's like having ChatGPT, Claude and Gemini in one place, and you can switch between them any time.",
    placeholder: "Write a friendly follow-up email to someone I met at last night's networking event…",
    examples: ["Write a 30-second elevator pitch for my landscaping business", "Give me 5 Instagram post ideas for a bakery", "Summarize the pros and cons of an LLC vs S-Corp", "Draft a thank-you note to a referral partner"],
    personas: ["Marketing coach", "Sales copywriter", "Business advisor", "Social media manager", "Friendly editor"],
    icon: '<path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1.1-4.4A8 8 0 1 1 21 12Z"/><path d="M8.5 11h7M8.5 14h4.5"/>'
  },
  {
    id: "image", name: "Images", verb: "Create an image",
    tagline: "Flyers, product shots, social graphics",
    blurb: "Describe the picture you want and AI creates it in seconds. Great for social posts, event flyers, product mock-ups and website images.",
    placeholder: "A bright flyer-style photo of a charity car wash on a sunny Saturday…",
    examples: ["Professional headshot-style photo of a smiling realtor in front of a modern home", "Flat-lay product photo of handmade candles on marble, soft light", "Poster for a business networking mixer, navy and gold, elegant", "Cozy coffee shop interior at golden hour, photorealistic"],
    styles: ["Photorealistic", "Clean flat illustration", "3D render", "Watercolor", "Bold poster", "Minimal line art"],
    icon: '<rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="9" cy="10" r="2"/><path d="m21 16-5-5-9 9"/>'
  },
  {
    id: "video", name: "Video", verb: "Make a video clip",
    tagline: "Short AI video clips for reels and ads",
    blurb: "Turn a sentence or a photo into a short video clip. It's perfect for reels, ads and website headers. The premium engines add sound and dialogue.",
    placeholder: "Slow cinematic shot of a food truck serving tacos at a sunset street fair…",
    examples: ["Drone shot rising over a small-town main street at sunrise", "Close-up of a barista pouring latte art, slow motion", "A golden retriever running through a park in autumn leaves", "Product spin of a sleek water bottle on a pedestal, studio light"],
    icon: '<rect x="3" y="5" width="13" height="14" rx="2"/><path d="m16 10 5-3v10l-5-3z"/>'
  },
  {
    id: "voice", name: "Voiceover", verb: "Create a voiceover",
    tagline: "Natural AI voices for any script",
    blurb: "Paste a script and pick a voice. You'll get a studio-quality voiceover for videos, ads, podcasts or your phone greeting.",
    placeholder: "Thanks for calling Summit Plumbing. We're helping another customer right now…",
    examples: ["Thanks for calling! You've reached Bright Smile Dental. Please leave a message and we'll call you right back.", "Introducing our summer menu: fresh, local and made with love.", "Welcome to this week's episode of Main Street Makers."],
    icon: '<path d="M12 3a3 3 0 0 0-3 3v6a3 3 0 0 0 6 0V6a3 3 0 0 0-3-3Z"/><path d="M19 11a7 7 0 0 1-14 0M12 18v3"/>'
  },
  {
    id: "avatar", name: "Talking Avatar", verb: "Make a talking video",
    tagline: "A presenter reads your script on camera",
    blurb: "Type a script and a presenter speaks it on video: Allie, or a photo of you. No camera, lighting or retakes needed.",
    placeholder: "Hi, I'm with Summit Realty. Here are three things to do before you list your home…",
    examples: ["Hi! I'm Allie from BizConnect. Our next networking breakfast is Thursday at 8. Come meet local business owners!", "Welcome to our shop! Every order this week ships free.", "Three quick tips to get more referrals this month. Tip one: follow up within 24 hours."],
    icon: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/><path d="M17.5 4.5c1 .8 1.5 2 1.5 3.5s-.5 2.7-1.5 3.5"/>'
  },
  {
    id: "music", name: "Music", verb: "Create music",
    tagline: "Background music and full songs",
    blurb: "Get royalty-free background music for your videos, or a full song with vocals. Describe the vibe and AI composes it.",
    placeholder: "Upbeat acoustic background music for a small business promo video…",
    examples: ["Chill lo-fi beat for a coffee shop reel", "Inspiring cinematic build for a company intro", "Catchy jingle about a family pizza shop", "Warm acoustic guitar for a wedding photographer's reel"],
    genres: ["Pop", "Acoustic", "Lo-fi", "Cinematic", "Hip-hop", "Country", "Jazz", "Electronic", "Corporate"],
    moods: ["Upbeat", "Chill", "Inspiring", "Emotional", "Playful", "Epic"],
    icon: '<path d="M9 18V5l11-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="17" cy="16" r="3"/>'
  },
  {
    id: "deck", name: "Slide Decks", verb: "Build a presentation",
    tagline: "Presentations in minutes, PowerPoint ready",
    blurb: "Give it a topic and it writes a complete slide deck with titles, bullet points and speaker notes. Download it as a PowerPoint.",
    placeholder: "A 10-minute pitch for my commercial cleaning company to office managers…",
    examples: ["Why local businesses should join a networking chapter", "Quarterly update for my real-estate team", "Pitch deck for a mobile dog-grooming startup", "Workshop: 5 ways to get more Google reviews"],
    icon: '<rect x="3" y="4" width="18" height="12" rx="1.5"/><path d="M12 16v4M8 20h8M7 8h6M7 11h10"/>'
  },
  {
    id: "translate", name: "Translate", verb: "Translate text",
    tagline: "Documents and messages in 30+ languages",
    blurb: "Paste any text and get a natural, professional translation. It's great for flyers, menus, emails and customer messages.",
    placeholder: "Paste the text you'd like translated…",
    examples: ["We are open Monday through Saturday, 8am to 6pm. Walk-ins welcome!", "Thank you for your business. Your order will arrive in 3–5 days."],
    languages: ["Spanish", "French", "Portuguese", "Italian", "German", "Chinese (Simplified)", "Japanese", "Korean", "Vietnamese", "Arabic", "Hindi", "Tagalog", "Russian", "Polish", "Haitian Creole"],
    icon: '<path d="M4 5h9M8.5 3v2M6 5c.6 3 2.6 5.4 5 6.6M11 5c-.8 3.3-3 6-6 7.5"/><path d="m13 21 4-9 4 9M14.5 18h5"/>'
  },
  {
    id: "outreach", name: "Sales Outreach", verb: "Research a prospect",
    tagline: "A tailored outreach pack from any website",
    blurb: "Paste a prospect's website. AI reads it and writes a personalized cold email, LinkedIn message, text, call opener and follow-up, all tailored to them.",
    placeholder: "https://example-business.com",
    examples: ["bizconnectcoalition.com"],
    icon: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5M8 11h6M11 8v6"/>'
  },
  {
    id: "brand", name: "Brand Kit", verb: "Build my brand kit",
    tagline: "Tagline, colors, bios and a logo idea",
    blurb: "Describe your business and get a starter brand kit: name ideas, tagline, color palette, fonts, bios and a logo concept.",
    placeholder: "A family-owned mobile dog-grooming business in Tampa, friendly and upscale…",
    examples: ["Boutique bookkeeping firm for creative freelancers", "Farm-to-table food truck in Austin", "Veteran-owned HVAC company, trustworthy and local", "Yoga studio for busy professionals"],
    icon: '<path d="M12 3 4 7v5c0 5 3.4 8.3 8 9 4.6-.7 8-4 8-9V7Z"/><path d="m9 12 2 2 4-4"/>'
  }
];
window.STUDIO_BY_ID = Object.fromEntries(window.STUDIOS.map((s) => [s.id, s]));
