# Hover-example media: how each file was made

The pictures, clips and sounds in the card previews (`docs/assets/previews/`, plus a brand's `docs/brands/<id>/previews/`) were generated on 2026-10-23 with Google Gemini on Dan's Google AI Pro accounts:
- images: Gemini image generation
- clips: Gemini **Create video**
- music: Gemini **Create music**

The Voiceover sample is the narration track of a generated clip. Use this file to regenerate or extend them.

## Rules for new media
- **One generation per Gemini chat** (open a new chat each time). Video has a daily cap per account; rotate Pro accounts when "Create video" greys out. See the browser / gemini-video-creation skills.
- Write the "You type" text in `previews.js` / `BRAND.previews` to match what the media shows.
- No real people, brands or business names. Use made-up businesses, and use `.example` web addresses in outreach examples.
- Budget: keep a brand's preview media under about 3 MB in total. It only downloads when a preview opens.

## Processing (ffmpeg / Pillow), the same for every file
| Kind | Command |
|---|---|
| image | Pillow → WebP quality 80 (1024 px wide); logos 512×512 quality 82 |
| looping video | `ffmpeg -i IN.mp4 -filter_complex "[0:v]scale=960:540,fps=24,split[a][b];[a]trim=1:10,setpts=PTS-STARTPTS[m];[b]trim=0:1,setpts=PTS-STARTPTS[t];[m][t]xfade=transition=fade:duration=1:offset=8,format=yuv420p" -an -c:v libx264 -preset slow -crf 26 -movflags +faststart video.mp4`, then poster = first frame: `ffmpeg -i video.mp4 -frames:v 1 -c:v libwebp -quality 80 video.webp` |
| talking avatar (keeps sound) | `ffmpeg -t 9.65 -i IN.mp4 -vf "scale=960:540,fps=24" -c:v libx264 -preset slow -crf 26 -pix_fmt yuv420p -af "loudnorm=I=-18:TP=-1.5:LRA=9" -c:a aac -b:a 96k -ar 44100 -movflags +faststart avatar.mp4` + first-frame poster |
| voiceover | `ffmpeg -ss 0.7 -i CLIP.mp4 -vn -af "loudnorm=I=-18:TP=-1.5:LRA=7" -ac 2 -ar 44100 -c:a libmp3lame -b:a 96k voice.mp3` (trim the lead-in silence) |
| music | 30 s excerpt: `ffmpeg -ss 4 -t 30 -i TRACK.mp4 -vn -af "afade=t=in:d=1.2,afade=t=out:st=27.5:d=2.5,loudnorm=I=-20:TP=-1.5:LRA=9" -ac 2 -ar 44100 -c:a libmp3lame -b:a 112k music.mp3` |

Check spoken lines with faster-whisper (`base.en`) and confirm the music has no vocals.

## Core set (Maple & Main Bakery)
| File | Gemini prompt (abridged) |
|---|---|
| image.webp | Bright flyer-style photo, bakery open house: golden croissants and berry tarts on a rustic table, coffee, warm morning light, blurred bakery behind. Photorealistic, 16:10, no text |
| logo.webp | Simple modern logo for "Maple & Main": maple leaf + wheat stalk in a circle, flat vector, brown #7A4A2A / gold #E9B872 on cream #F6EBDD, words MAPLE & MAIN below |
| video.mp4 | Slow cinematic close-up, sunny bakery: baker's hands dust powdered sugar over berry tarts, croissants soft-focus behind, warm light, gentle push-in, ambient sound only |
| avatar.mp4 | Friendly woman in her forties, flour-dusted apron, behind a bakery counter, to camera: "Hi neighbors! This Saturday we open our doors at eight. Come try a free pastry on us!" |
| voice.mp3 | Slow pan over a bakery display case, nobody on screen; warm female off-screen voiceover: "Thanks for calling Maple and Main Bakery! We're busy baking right now. Leave your name and number, and we'll call you right back." |
| music.mp3 | Gemini Create music: "Upbeat cozy acoustic guitar instrumental for a bakery commercial, happy and warm, no vocals." (track "The Baker's First Light", 0:04–0:34) |

## Guide characters (full-size, 6 poses)
Allie (BizConnect) predates this file. **Bloom (Root & Bloom, 2026-10-24)**: one Gemini chat, first prompt *"full-body 3D cartoon character illustration in a polished, semi-realistic animated-movie style … Bloom, a hairstylist: early thirties, shoulder-length wavy copper-auburn hair, light freckles, cream blouse, forest-green stylist apron, small gold sunflower pin, cream name tag 'Bloom', tan trousers, brown flats … SOLID FLAT MAGENTA (#FF00FF) background"*. Then, in the same chat: *"the SAME exact character Bloom … new pose: …"* for point, welcome (arms open), thumbs up, arms crossed, and brush + comb. **Use magenta, not green, when the character wears green.** Full-size downloads (2752×1536) were keyed with `key_bloom.py`-style processing:
- alpha from `min(R,B) − G`
- despill
- 1 px erode + blur
- crop
- resize to 640 px tall PNG

The presenter came from the same chat (*"waist-up portrait, facing the camera, mouth closed, plain deep forest-green background, vertical 4:5"*). It was cropped head-and-shoulders to 500×624 JPG (`img/presenter.jpg`, and the Worker's `public/bloom-presenter.jpg`), plus a 200×250 face crop for `img/guide-avatar.jpg`.

## Root & Bloom set (`ai-studio-clients\rootbloom-ai-studio\docs\brands\rootbloom\previews\`)
| File | Gemini prompt (abridged) |
|---|---|
| image.webp | Elegant photo for a salon's fall color special: calm plant-filled boutique salon, styling chair by a window, golden light, client with copper-and-honey waves from behind; sage and cream |
| logo.webp | Elegant logo for a hair studio "Willow & Wave": willow branch flowing into a soft wave, line art, sage #6E8B6B / gold #C9A46A on cream #F4EFE6 |
| video.mp4 | Slow-motion close-up of a stylist's hands blow-drying and brushing glossy copper-and-honey hair in a plant-filled salon, golden window light, salon ambience only |
| avatar.mp4 | Friendly stylist in her thirties, black apron, at her station in a bright plant-filled salon, to camera: "Hi! Fall color appointments are filling up fast. Book your spot this week!" |
| voice.mp3 | Slow pan across a calm salon reception, nobody on screen; warm off-screen voiceover phone greeting for "Willow and Wave Hair Studio" |
