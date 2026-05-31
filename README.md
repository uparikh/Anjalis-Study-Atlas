# Anjali's Study Atlas 🪷

An interactive study companion for PA-school prep — built around the exact way
Anjali organized her **A&P Guide** and **Clinical Medicine I** notes.

- **Clickable body map** (2D, with a 3D toggle for Musculoskeletal) to jump into any system.
- **Editable note templates** that mirror her docs: outline + checklist + notes for each
  A&P system, muscle tables (Origin / Insertion / Action / Nerve Supply) by region, and
  disease tables (Pathophysiology / Causes / S&SX / PE-Dx / Treatment / Prognosis) per
  clinical specialty.
- **Progress tracking**: per-system status, checklists built from her outlines, a study
  streak, and a calendar heatmap.
- Everything **auto-saves in the browser**. Use **Export backup** to download a `.json`
  file (back it up or move it to another device) and **Import** to restore it.

Quizzes/knowledge checks live on Khan Academy (linked from the home page) — this Atlas is
her notebook and tracker.

## Run it locally

It's plain HTML/CSS/JS — no build step. Either open `index.html` directly, or serve it:

```bash
cd "A&P Interactive Model"
python3 -m http.server 8000
# then visit http://localhost:8000
```

## Deploy to GitHub Pages

1. Create a repo on GitHub and push these files to the `main` branch:
   ```bash
   git add .
   git commit -m "Anjali's Study Atlas"
   git branch -M main
   git remote add origin https://github.com/<you>/<repo>.git
   git push -u origin main
   ```
2. On GitHub: **Settings → Pages → Build and deployment → Source: Deploy from a branch**,
   pick `main` / `root`, **Save**.
3. The site goes live at `https://<you>.github.io/<repo>/` within a minute or two.

## Notes

- The 3D musculoskeletal model loads Three.js from a CDN, so it needs internet **the first
  time**. The 2D map and all note-taking work fully offline.
- Notes are stored per-browser (localStorage). They aren't synced automatically across
  devices — use **Export / Import** to move them, or back them up periodically.

## Project layout

```
index.html         app shell + script loading
css/styles.css     Indian-inspired design system
js/data.js         both guides encoded (systems, outlines, table schemas)
js/store.js        localStorage persistence, progress, streak, export/import
js/icons.js        mandala / lotus / paisley SVG motifs
js/notes.js        editable outline + table views
js/body2d.js       interactive 2D body map
js/body3d.js       3D musculoskeletal model (Three.js)
js/app.js          router + dashboard
```
