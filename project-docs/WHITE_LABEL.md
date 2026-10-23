# Make an AI Studio for a new business

Worked example: Root & Bloom Salon Source → `ai-studio-clients\rootbloom-ai-studio`. Replace `acme` below with a short lowercase id (letters, numbers, `-`).

## 1. Learn the business (15 minutes)
From their website, note: what they do and for whom; **colors** (open the site, then read the computed colors of headings, buttons and backgrounds); **fonts** (Google Fonts are free to reuse; for commercial fonts pick a close Google Font); **logo files** (SVG is best); and the words their customers use. Write this into the client's `AGENTS.md` (step 6).

## 2. Create the client folder and brand
```powershell
$id = 'acme'
$client = "R:\Documents\Claude\Projects\Bizconnect\ai-studio-clients\$id-ai-studio"
New-Item -ItemType Directory -Force "$client\docs\brands\$id\img" | Out-Null
Copy-Item "R:\Documents\Claude\Projects\Bizconnect\bizconnect-ai-studio\docs\brands\_template\*" "$client\docs\brands\$id" -Recurse -Force
```
Then edit:
- `docs\brands\acme\brand.js`: every field is explained in the file. Set `id: "acme"` (must match the folder name). Write industry-specific example prompts in `studios`. They matter more than anything else for first impressions.
- `docs\brands\acme\brand.css`: the color and font tokens. The studio is a **dark** design: use the brand's darkest color as the canvas (`--bg-*`) and its warmest or brightest as `--accent`. Keep text contrast high (`--text` on `--bg-900`).
- `docs\brands\acme\img\`: `logo` (square, shows at 40px in the header; a light version for the dark header), `crest` (sign-in box, ~76px wide), `favicon`, and `guide-avatar` (round crop).
  - No character art? Leave `guide.poses: []` and you get a compact round helper.
  - No presenter photo for Talking Avatar? Set `presenter: null` and members upload their own.

## 3. Copy in the core
```powershell
cd R:\Documents\Claude\Projects\Bizconnect\bizconnect-ai-studio
powershell -ExecutionPolicy Bypass -File .\tools\sync-client.ps1 -Client ..\ai-studio-clients\acme-ai-studio -BrandId acme
```

## 4. Teach the Worker the brand's voice
In `worker\src\index.js`, add to `BRANDS`:
```js
acme: { product: "Acme AI Studio", about: "from Acme, a …", audience: "…", guide: "<guide name>", presenter: null },
```
Then `cd worker; npx wrangler deploy`, and check https://bizconnect-ai-studio.virtualecommerceinc.workers.dev/api/catalog still answers. (Without this step the studio works, but its concierge introduces itself as BizConnect's Allie.)

## 5. Preview and check
```powershell
python -m http.server 8750 --directory R:\Documents\Claude\Projects\Bizconnect\ai-studio-clients\acme-ai-studio\docs
```
Open http://localhost:8750 and check, at desktop width and phone width (390px):
- header logo and name fit on one line
- the guide appears after 4 seconds and its bubble is readable
- Talking Avatar asks for a photo if there's no presenter
- no "BizConnect" or "Allie" anywhere: search the page text

## 6. Write the client's brief
Copy `ai-studio-clients\rootbloom-ai-studio\AGENTS.md`, `CLAUDE.md` and `README.md` and rewrite them for the new business. Add a row to `ai-studio-clients\README.md`.

## 7. Repo + GitHub Pages
1. Create an empty public repo (e.g. `<owner>/acme-ai-studio`) on GitHub.
2. Push:
   ```powershell
   cd $client
   git init -b main
   git add .
   git commit -m "Acme AI Studio"
   git remote add origin git@<ssh-alias>:<owner>/acme-ai-studio.git
   git push -u origin main
   ```
3. On GitHub: Settings → Pages → Source: *Deploy from a branch*, Branch `main`, folder `/docs`. The site appears at `https://<owner>.github.io/acme-ai-studio/` in 1–2 minutes.

## Keeping clients up to date
After any core change: run step 3 for each client, look at it (step 5), then commit and push each client repo.
