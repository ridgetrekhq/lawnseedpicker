# LawnSeedPicker — site + seed-picker tool

The full lawnseedpicker.com site in one repo. Static, no build step.

```
/                         the marketing site (landing, guides, legal pages)
  index.html              homepage — links prominently to the tool at /picker/
  where-to-buy-grass-seed.html, restart-lawn-from-scratch.html, ...legal pages
  style.css, robots.txt, sitemap.xml
  _headers                Cloudflare Pages headers (security + cache rules)
/picker/                  the "What should I plant?" calculator
  index.html              app shell (import map + inline theme CSS)
  src/                    no-build React (htm) — engine, UI, data
    data/database.js      species DB, generated from lawn_species_database.json
    data/zipZones.js      3-digit ZIP-prefix → region + USDA zone (client-side)
    data/retailers.js     retailer link map + placeholder blends (swap point)
    engine/               scoring, blend, seeding-window, zip resolver, orchestrator
    ui/                   funnel + result screens
```

## How it works (no build, no server backend)

- React + htm are **vendored locally** in `picker/vendor/` and resolved via an import map in `picker/index.html`. There is **no bundler, no build command, and no third-party request at runtime** — Cloudflare just serves these files. (See `picker/vendor/README.md` for versions / how to refresh.)
- All recommendation logic runs **in the browser**. The species database ships as `picker/src/data/database.js`. The zip is resolved against the baked-in prefix table and **never leaves the browser** — no API, no geolocation.
- Affiliate links are **labeled placeholders** (`picker/src/data/retailers.js`, all `retailer: 'placeholder'`, `url: '#'`). Swap real tracked URLs in that one file when DoMyOwn / Andersons approve.

## Regenerating the species database

`picker/src/data/database.js` is generated from the canonical `lawn_species_database.json`. If that JSON changes, regenerate (PowerShell):

```powershell
$raw = Get-Content "PATH\TO\lawn_species_database.json" -Raw
$enc = New-Object System.Text.UTF8Encoding($false)
[System.IO.File]::WriteAllText("picker\src\data\database.js", "export default $raw;", $enc)
```

## Local preview

The app uses ES modules, which browsers **block over `file://`** — you need a local static server (any will do). Examples:

- VS Code "Live Server" extension, opening the repo folder.
- Python (if installed): `python -m http.server 5577` then open `http://localhost:5577/picker/`.
- The PowerShell static server used during development (`static-server.ps1`), pointed at this repo root.

Then visit `http://localhost:<port>/picker/`. Opening `index.html` by double-click will **not** work (module/CORS restriction).

---

# Deploying to Cloudflare Pages (Git-connected)

The site currently deploys via **Direct Upload**. Cloudflare does **not** let you convert a Direct-Upload project to Git — you create a **new** Git-connected Pages project, point the domain at it, then retire the old one. Steps:

### 1. Push this repo to GitHub
```bash
# from the repo root
git remote add origin https://github.com/<you>/lawnseedpicker.git
git branch -M main
git push -u origin main
```
(Create the empty `lawnseedpicker` repo on GitHub first — no README/license, since this repo already has commits.)

### 2. Create the Git-connected Pages project
In the Cloudflare dashboard → **Workers & Pages → Create → Pages → Connect to Git**:
- Select the `lawnseedpicker` GitHub repo, branch `main`.
- **Build settings:**
  - Framework preset: **None**
  - Build command: **(leave empty)**
  - Build output directory: **`/`** (repo root — the site is not in a subfolder)
  - Root directory: **(leave as repo root)**
- **Save and Deploy.** It will build a preview at `https://<project>.pages.dev`.

### 3. Verify on the preview URL
Open `https://<project>.pages.dev/` (homepage) and `https://<project>.pages.dev/picker/` (tool). Run a couple of zips through the tool. Confirm the homepage "Find your grass seed" button reaches `/picker/`.

### 4. Move the custom domain off the old Direct-Upload project
A custom domain can only attach to one Pages project at a time:
1. Old project → **Custom domains** → remove `lawnseedpicker.com` (and `www` if present).
2. New Git project → **Custom domains** → **Set up a custom domain** → add `lawnseedpicker.com` (and `www`). If your DNS is on Cloudflare, records are configured automatically; otherwise follow the CNAME prompt.
3. Wait for the domain to show **Active** on the new project and load over HTTPS.

> There will be a brief window during the swap where the domain points between projects. Do it at a low-traffic time. Pre-launch this is harmless.

### 5. Retire the old Direct-Upload project
Once `lawnseedpicker.com` serves from the new Git project and is verified, delete (or rename/disable) the old Direct-Upload project so you're running **one** deploy method. From here on, **`git push` to `main` auto-deploys.**

---

## Notes / future hardening

- **Privacy / no third-party requests:** React + htm are vendored locally (`picker/vendor/`), so the site makes **no runtime calls to any third party**. The zip and all data stay in the browser; nothing is fetched from a CDN. This is deliberate — it's the privacy posture the whole tool is built around.
- **Sitemap:** `/picker/` is included. Resubmit `sitemap.xml` to Google Search Console + Bing after the SEO pages land (Week 5).
- **Analytics:** none yet (deliberate). Adding any is a privacy-policy regeneration trigger.
