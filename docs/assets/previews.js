/* AI Studio — hover previews: one worked example per studio ("you type this → you get this").
   Shown when a visitor hovers a studio card (or taps its "Example" button on a phone).
   All examples follow one made-up small business, Maple & Main Bakery, so they read as a story.
   Media files live in assets/previews/. A brand can replace any studio's example with
   BRAND.previews = { image: { prompt, src, alt }, chat: { … } } (src paths are relative to docs/). */
window.CORE_PREVIEWS = {
  chat: {
    kind: "chat",
    prompt: "Write a friendly text to customers about our Saturday open house.",
    reply: "Hi neighbor! 🥐 This Saturday from 8–11 we're throwing open the doors at Maple & Main Bakery: free coffee, warm croissant samples and a first look at our fall menu. Bring a friend, and show this text for 10% off any dozen. See you there!",
  },
  image: {
    kind: "image",
    prompt: "Bright flyer-style photo for a bakery open house: fresh croissants and berry tarts on a rustic table, warm morning light.",
    src: "assets/previews/image.webp",
    alt: "AI-made photo of croissants and berry tarts on a rustic wooden table in warm morning light",
  },
  video: {
    kind: "video",
    prompt: "Slow cinematic close-up of a baker dusting powdered sugar over berry tarts, warm morning light.",
    src: "assets/previews/video.mp4",
    poster: "assets/previews/video.webp",
  },
  voice: {
    kind: "audio",
    prompt: "Thanks for calling Maple & Main Bakery! We're busy baking right now. Leave your name and number and we'll call you right back.",
    promptLabel: "You paste the script",
    detail: "Voice: warm female · natural pace",
    src: "assets/previews/voice.mp3",
  },
  avatar: {
    kind: "video",
    sound: true,
    prompt: "Hi neighbors! This Saturday we open our doors at eight. Come try a free pastry on us!",
    promptLabel: "You type what they should say",
    detail: "Presenter: a photo you upload (or the studio's guide)",
    src: "assets/previews/avatar.mp4",
    poster: "assets/previews/avatar.webp",
  },
  music: {
    kind: "audio",
    prompt: "Cheerful acoustic background music for a bakery promo video. No vocals.",
    detail: "Genre: acoustic · Mood: upbeat",
    src: "assets/previews/music.mp3",
  },
  deck: {
    kind: "deck",
    prompt: "A short pitch to local offices about our catering service.",
    slides: [
      { title: "Fresh catering for busy offices", bullets: ["Baked at 5 a.m., delivered by 8", "Breakfast boxes for 10–100 people"] },
      { title: "What's in a box", bullets: ["Croissants, muffins & fruit", "Coffee for the whole team"] },
      { title: "Simple pricing", bullets: ["From $9 a person", "Free delivery within 5 miles"] },
    ],
    detail: "7 slides + speaker notes · downloads as PowerPoint",
  },
  translate: {
    kind: "translate",
    prompt: "We're open Monday through Saturday, 7 a.m. to 3 p.m. Walk-ins welcome!",
    language: "Spanish",
    result: "¡Abrimos de lunes a sábado, de 7 a. m. a 3 p. m.! Sin cita previa, ¡los esperamos!",
  },
  outreach: {
    kind: "outreach",
    prompt: "brightpathdental.com",
    promptLabel: "You paste a prospect's website",
    pieces: [
      { title: "Cold email", text: "Subject: Breakfast for the Bright Path team? Hi Dr. Lee, I saw you just opened a second office. Congratulations! We bake fresh breakfast boxes for busy practices…" },
      { title: "LinkedIn note", text: "Loved seeing Bright Path's new Elm St. office. Could we treat your team to a sample breakfast box?" },
    ],
    detail: "Also writes a text, a call opener and a follow-up",
  },
  brand: {
    kind: "brand",
    prompt: "A family bakery on Main Street, warm, cozy and a little old-fashioned.",
    name: "Maple & Main Bakery",
    tagline: "Baked fresh, served warm, since this morning.",
    colors: ["#7A4A2A", "#E9B872", "#F6EBDD", "#3E5641"],
    logo: "assets/previews/logo.webp",
    detail: "Plus fonts, bios and taglines",
  },
};
