# Make an AI Studio for a new business

Worked example: Root & Bloom Salon Source → `ai-studio-clients\rootbloom-ai-studio`. Below, `acme` stands for the new business's short id: lowercase letters, numbers or `-`. It's used for the brand folder `docs\brands\<id>\`, the `id` field in its `brand.js`, and its `BRANDS` entry in the Worker. All commands are PowerShell.

Set these once per PowerShell window (edit the first two lines):
```powershell
$id     = 'acme'
$family = 'R:\Documents\Claude\Projects\Bizconnect'      # folder that holds bizconnect-ai-studio and ai-studio-clients
$core   = "$family\bizconnect-ai-studio"
$client = "$family\ai-studio-clients\$id-ai-studio"
```

## 1. Learn the business (15 minutes)
From their website, note:
- what they do and for whom
- **colors**: open the site, then read the computed colors of headings, buttons and backgrounds
- **fonts**: Google Fonts are free to reuse; for commercial fonts pick a close Google Font
- **logo files**: SVG is best
- the words their customers use

You'll write this into the client's `AGENTS.md` in step 6.

## 2. Create the client folder and brand
```powershell
New-Item -ItemType Directory -Force "$client\docs\brands\$id\img" | Out-Null
Copy-Item "$core\tools\brand-template\*" "$client\docs\brands\$id" -Recurse -Force
```
Then edit (every field is explained in the file):
- `docs\brands\<id>\brand.js`: replace **every** `TODO` and every `acme` / `Acme`.
  - `id` must equal `<id>`.
  - Write industry-specific example prompts in `studios`; they matter most for first impressions.
  - Avoid health, safety or "organic" product claims unless the business approves the wording.
  - Keep `noindex: true` until the business approves the site.
  - Optional: `previews` gives the hover examples this business's flavour (see the Root & Bloom brand for a full example). Without it the studio shows the core bakery examples.
  - Pick the 3 **starter tools** for Simple mode in `simpleStudios`: what this business's customers will do most, in that order. They must not also be in `studios.hide`.
- `docs\brands\<id>\brand.css`: the color and font tokens.
  - The studio is a **dark** design: the brand's darkest color becomes the canvas (`--bg-*`), and its warmest or brightest color becomes `--accent`.
  - Keep text readable (`--text` on `--bg-900`).
- `docs\brands\<id>\img\`:
  - `logo`: square, light-colored for the dark header; shows at 40px.
  - `crest`: sign-in box, ~76px wide.
  - `favicon`.
  - `guide-avatar`: round crop.
  - No character art? Keep `guide.poses: []` for the compact round helper.
  - No presenter photo for Talking Avatar? Keep `presenter: null`, and members upload their own.

Check nothing was missed (no output = good):
```powershell
Select-String -Path "$client\docs\brands\$id\brand.js" -Pattern 'TODO','acme','Acme' -CaseSensitive
```

## 3. Copy in the core
```powershell
powershell -ExecutionPolicy Bypass -File "$core\tools\sync-client.ps1" -Client $client -BrandId $id
```
Sync replaces the client's `docs\*.html`, `docs\brand.js` and the **whole** `docs\assets\` folder. Never keep client-only files there; client files go in `docs\brands\<id>\` (or the client root, e.g. `docs\CNAME` for a custom domain, which sync leaves alone).

## 4. Teach the shared Worker the brand's voice (required)
Without this the studio still works, but its concierge introduces itself as BizConnect's Allie. Careful: **one Worker serves every studio**, so a mistake here breaks all of them.
1. In `$core\worker\src\index.js`, find `const BRANDS = {` and add a line in the same shape as `rootbloom`:
   ```js
   acme: { product: "Acme AI Studio", about: "from Acme, a …", audience: "…", guide: "<guide name>", presenter: null },
   ```
2. Check and deploy (first time on a PC: `npx wrangler login`):
   ```powershell
   node --check "$core\worker\src\index.js"
   cd "$core\worker"; npx wrangler deploy
   ```
3. Confirm https://bizconnect-ai-studio.virtualecommerceinc.workers.dev/api/catalog still answers, and that BizConnect's studio still loads. If something broke: `npx wrangler rollback` (puts the previous version back), then fix and redeploy.
4. Commit + push the core repo (the Worker change lives there).

## 5. Preview and check
```powershell
python -m http.server 8750 --directory "$client\docs"
```
Open http://localhost:8750 and check at desktop width and at phone width (390px, using browser dev tools):
- header logo and name fit on one line
- the guide appears after 4 seconds and its bubble is readable
- Talking Avatar asks for a photo if there's no presenter
- signed in, the guide's chat introduces itself with the right name (proves step 4)

Then confirm no other brand's words leaked in (no output = good):
```powershell
Select-String -Path "$client\docs\*.html","$client\docs\brands\$id\brand.js" -Pattern 'BizConnect','Allie','TODO'
```

## 6. Write the client's brief
```powershell
Copy-Item "$family\ai-studio-clients\rootbloom-ai-studio\AGENTS.md","$family\ai-studio-clients\rootbloom-ai-studio\CLAUDE.md","$family\ai-studio-clients\rootbloom-ai-studio\README.md" $client
```
Rewrite `AGENTS.md` and `README.md` for the new business (keep `CLAUDE.md` as is). Add a row to `$family\ai-studio-clients\README.md` with folder, business, live URL, repo and brand id.

## 7. Repo + GitHub Pages
1. Create an empty **public** repo, e.g. `<owner>/<id>-ai-studio`, on GitHub (github.com/new, no README).
2. Push. Use the HTTPS address GitHub shows, or an SSH alias if one is set up for that account:
   ```powershell
   cd $client
   git init -b main
   git add .
   git commit -m "<Business> AI Studio"
   git remote add origin https://github.com/<owner>/<id>-ai-studio.git
   git push -u origin main
   ```
3. On GitHub: Settings → Pages → Source *Deploy from a branch*, Branch `main`, folder `/docs`. The site appears at `https://<owner>.github.io/<id>-ai-studio/` in 1–2 minutes (hard-refresh with Ctrl+Shift+R).

## Keeping clients up to date
After any core change, run `sync-client.ps1 -Check`, sync each client marked STALE (step 3), look at it (step 5), then commit and push each client repo.
```powershell
powershell -ExecutionPolicy Bypass -File "$core\tools\sync-client.ps1" -Check
```
