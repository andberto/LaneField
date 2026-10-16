# Lane Field · WACV 2027

An academic project page for **Learning Lane-Structured Conditioning Fields for Online HD Mapping**, with a centered publication header, full abstract, separately embedded demonstrations, numbered figure captions, and interactive scientific image explorers. All production files are in `dist/`; no JavaScript package installation is needed to run it.

## Preview locally

From this `website` directory:

```sh
python3 -m http.server 8000 --directory dist
```

Open http://localhost:8000. The entire `dist/` directory can also be hosted by any static web host, including GitHub Pages. Relative URLs work beneath a repository path.

## Pubblicazione su GitHub Pages

Repository: [andberto/LaneField](https://github.com/andberto/LaneField). Sito: **https://andberto.github.io/LaneField/**.

Il branch `main` contiene i sorgenti. GitHub Pages pubblica il branch **`gh-pages`**, cartella **`/ (root)`**, tramite la modalità **Deploy from a branch** in **Settings → Pages**. I percorsi relativi e i metadati sono preparati per `/LaneField/`.

Per aggiornare sorgenti e sito, dalla cartella principale `WACV_website`:

```sh
cd website
git add .
git commit -m "Update project page"
git push
python3 scripts/publish_pages.py
```

La pubblicazione richiede Python 3, Node.js e accesso Git alla repository; se disponibile, usa l’autenticazione di GitHub CLI (`gh`). Lo script controlla asset, JavaScript e calcoli del laboratorio, prepara i metadati con l’URL pubblico e aggiorna `gh-pages` senza force push. GitHub pubblica automaticamente ogni aggiornamento di quel branch. L’esito compare nella scheda **Actions**, workflow **pages build and deployment**.

I PDF originali nella cartella esterna non servono per la pubblicazione. Impostazioni locali di Sites, screenshot di verifica e cartelle generate sono esclusi da Git. Il modulo contatti apre una bozza nell’app email del visitatore; il destinatario è offuscato e non compare nella pagina.

In `scripts/github-actions/deploy-pages.yml` è conservato un template alternativo per pubblicare da `main` con un workflow personalizzato. Non è attivo: la creazione di workflow richiede un’autorizzazione GitHub con scope `workflow`. La modalità attuale funziona con i permessi della connessione esistente.

## What is included

- All eight authors, in the supplied order, as plain text without profile links.
- WACV 2027 identification, Orlando location, conference dates, and official link.
- Locally stored University of Parma, University of Bologna, VisLab, and Ambarella logos; source details in `ASSET_SOURCES.md`. The affiliation legend uses 1 = University of Parma, 2 = University of Bologna, and 3 = VisLab, an Ambarella Inc. company; individual assignments come from the author.
- Both supplied supplementary videos, converted from HEVC to browser-compatible H.264, with fast-start metadata. Videos are silent, load on demand, and never autoplay. Full-resolution original media remain untouched in the parent directory.
- All five main-paper figures rendered from the supplied original figure PDFs, full abstract, and all four tables from the main paper: OpenLane-V2 comparisons (1a/1b), component ablation (2), SD map priors (3), and Argoverse 2 / nuScenes results (4). Tables preserve the paper numbering, metrics, gains, and experimental notes, with section links and horizontal scrolling on mobile.
- Academic section structure inspired by [the supplied project-page reference](https://andberto.github.io/One-target-to-align-them-all/), with restrained typography and a keyboard-accessible figure enlargement dialog.
- An interactive analytic construction appears before the spread-factor comparison: four tabs explain geometry, Gaussian integration, tensor accumulation and directional confidence. Move the probe by dragging, tapping or using arrow keys; switch between a straight road, bend and crossing; select any segment from the map, selector or contribution rows; drag its endpoints or the whole segment; and adjust its angle and length. Shared bend vertices stay connected. The integration graph and q(t) follow the selected segment, while the inclusion checkbox lets visitors remove individual contributions from the total field. All map elements can be dragged directly, including q(t) in the integration step. Arrow keys move the last touched element; Tab switches the keyboard target without a movement selector. Reset controls restore the probe or geometry independently. The five live target channels use the actual closed-form integral and supplementary normalization. The illustrative geometry is explicitly labeled, while the four scientific figure explorers retain the supplied research images. Complete equations remain in an expandable native MathML explanation, including without JavaScript.
- A compact overview pairs the representation with the reconstruction video. Architecture details, the complete derivation and secondary result tables expand on demand. Result links open their corresponding disclosures automatically; both videos and the full abstract remain available.
- Additional qualitative scenes and two failure cases from the supplementary sources.
- An empty BibTeX section awaiting the final citation, and mobile navigation.
- Accessible labels, independent video players and keyboard-operable enlargement for every research image, visible focus, reduced-motion support, and responsive layouts.

## Edit content and add images

Edit `dist/index.html` for text, authors, links, result numbers, citation, and figures. Edit `dist/styles.css` for presentation, `dist/script.js` for page behavior, and `dist/field-lab.js` for the analytic field math and interactive construction. Media live in `dist/assets/media/`.

Research figure assets are in `dist/assets/media/figures/`. Each image has a lightweight inline preview when needed and a losslessly encoded, larger WebP version opened by the figure viewer. The supplied source files remain untouched. All original figure labels and geometry are preserved; no generated illustrations are presented as measurements.

The `data-media-slot` identifiers `qualitative-comparison`, `attention-visualization`, and `field-uncertainty` now contain the corresponding real research figures. The four `[data-explorer]` groups use native radio controls to reveal the selected image panel. Without JavaScript, all panels remain available. The image links also work without the dialog.

`scripts/figure_sources.json` maps each web figure to its original file, dimensions, and optional preview. To regenerate the assets, keep `hd_mapping_bertogalli/` and `hd_mapoing_bertogalli_supplementary/` beside `website/`, install Pillow and Poppler locally, and run `python3 scripts/prepare_figures.py`. This is an authoring step; GitHub Pages only needs the generated static files and has no new runtime dependency.

The code/model resource is intentionally labeled **Coming soon**. Replace `.resource-pending` with a real link when a repository is available.

## Contact form

The recipient is the address supplied by the author. It is stored as obfuscated numeric data in the client script and reconstructed only when the visitor submits the form or clicks its retry button. Neither the static HTML nor the rendered page displays the address or contains a recipient email link, including in the no-JavaScript fallback. The form validates name, email, and message and opens a prepared draft in the visitor’s email application. The visitor must send the draft. It does **not** claim delivery, store submissions, or require an external form service. This reduces simple address harvesting but cannot prevent extraction by a determined bot executing JavaScript. For delivery without an email application, connect a real form endpoint and replace the form handler; no endpoint credentials are currently configured.

## Publication details

The anonymous paper and supplementary PDFs have been removed from `dist/`, together with all download links and `citation_pdf_url` metadata. The original supplied files remain in the parent folder.

When ready, add the camera-ready PDF at `dist/assets/papers/paper.pdf`, restore the desired download links, and add `<meta name="citation_pdf_url" content="assets/papers/paper.pdf">` to the page head. `scripts/prepare_pages.py` supports the current page without a PDF and will make that metadata URL absolute when restored.

The BibTeX content is deliberately empty. Fill `#bibtex` with the final citation when available; the copy button enables automatically on page load when there is text. The author-supplied WACV 2027 designation is retained.

The page lists University of Parma (1), University of Bologna (2), and VisLab, an Ambarella Inc. company (3), with author-supplied superscripts: Andrea Bertogalli, Marcello Ceresini, Federico Pirazzoli, Lorenzo Cipelli and Massimo Bertozzi → Parma; Filippo D’Addeo → Bologna; Anthony Dell’Eva and Nicola Marinello → VisLab. Bertozzi is affiliated only with Parma; MUNER has been removed from the displayed affiliations and logos.

## Source and checks

`python3 scripts/check_site.py` checks referenced assets, HTML structure, required author names, contact configuration, and static file limits. Syntax-check both scripts with `node --check dist/script.js` and `node --check dist/field-lab.js`. `node scripts/check_field_math.mjs` compares the analytic weights with independent numerical quadrature and checks endpoint handling, reversal/subdivision invariance, crossing ambiguity, target bounds, background suppression and empty or collapsed geometry. `node scripts/check_browser.mjs` verifies real mouse and touch slider drags (including outside the track and after scene/segment changes), endpoint and segment editing, contribution toggles, keyboard access, research media, disclosures and responsive layout using local Chrome. The range controls keep tracking active gestures if native range behavior releases pointer capture and retain native keyboard input. Browser QA artifacts are ignored under `qa/`.
