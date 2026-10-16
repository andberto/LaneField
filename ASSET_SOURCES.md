# Logo asset sources

Downloaded on 2026-10-15 from the institutions' official websites. Original artwork is stored without recoloring, redrawing, or cropping; display with preserved aspect ratio.

| Local asset | Institution | Official asset URL | Source page |
| --- | --- | --- | --- |
| `dist/assets/logos/university-of-parma.svg` | University of Parma, black artwork for a light background | https://www.unipr.it/themes/custom/unipr_2025/assets/svg/unipr-bn.svg | https://www.unipr.it/ |
| `dist/assets/logos/university-of-parma-on-dark.svg` | University of Parma, white/gold artwork for a dark background | https://www.unipr.it/themes/custom/unipr_2025/logo.svg | https://www.unipr.it/ |
| `dist/assets/logos/university-of-bologna.png` | Alma Mater Studiorum – Università di Bologna, official header artwork, 350 × 254 | https://www.unibo.it/it/++theme++unibotheme.portale/img/header/sigillo1x_xl.png?v=2 | https://www.unibo.it/it |
| `dist/assets/logos/vislab.png` | VisLab, transparent PNG, 800 × 159 | https://vislab.it/logo/Logo-e-motto.png | https://vislab.it/ |
| `dist/assets/logos/ambarella.png` | Ambarella, transparent PNG, 665 × 407 | https://vislab.it/logo/AI_envisioned_cmyk.png | https://vislab.it/ |

The two PNG files were decoded and visually inspected. The SVG files were parsed successfully as XML. University of Parma brand guidance: https://www.unipr.it/marchio-di-ateneo . Logo ownership remains with the respective institutions.

## Institution context

Andrea Bertogalli's public portfolio (https://andberto.github.io/, inspected on 2026-10-15) lists VisLab / Ambarella as his current organization, University of Parma for his bachelor's degree, and Politecnico di Milano for his master's degree. The portfolio also displays these institutions' logos. This provides context for sourcing assets; it does not establish all coauthors' paper affiliations. The supplied paper is anonymous, so individual author-to-institution mappings should be confirmed before adding affiliation superscripts. Politecnico di Milano was not included in this asset set because a past degree alone does not establish its participation in this paper.

## Font and research media

- Manrope variable font: https://fonts.google.com/specimen/Manrope, self-hosted from https://fonts.gstatic.com/s/manrope/v20/xn7gYHE41ni1AdIRggexSg.woff2. SIL Open Font License saved beside the font.
- Main-paper figures: rendered from `hd_mapping_bertogalli/figures/introduction.pdf`, `Architecture.pdf`, `SPADE.pdf`, `new_attention.pdf`, and `HD_results.pdf`, as referenced by the supplied LaTeX. Their numbering follows Figures 1–5 in the paper. The older `architecture.png` extraction is no longer used by the page.
- Video posters and H.264 videos: derived from the user-supplied HD_map.mp4 and Field_prediction.mp4. Original files are retained. Web versions omit audio.
- Research text and results: user-supplied paper; Tables 1(a), 1(b), 2, and 3 are transcribed from page 7, and Table 4 from page 8. Values, absolute and relative gains, baseline markers, and experiment settings are retained. Author names and WACV designation supplied by the user.
- Conference dates/location: https://wacv.thecvf.com/ and https://wacv.thecvf.com/Conferences/2027/CallForTutorials (January 4–8, 2027, Orlando, Florida).
- Contact recipient: supplied by the user and stored as obfuscated numeric data; the address is not printed in public markup or documentation.
- The three former research-figure placeholders have been replaced by the actual source figures.
- Layout reference supplied by the author: https://andberto.github.io/One-target-to-align-them-all/. The page uses its academic publication structure with original styles; no unrelated paper content or assets were copied.

## Author affiliations

The author supplied the following paper affiliations directly in this session; these are authoritative for the project page:

| Author | Affiliation numbers | Institutions |
| --- | --- | --- |
| Andrea Bertogalli | 1 | University of Parma |
| Anthony Dell’Eva | 3 | VisLab, an Ambarella Inc. company |
| Marcello Ceresini | 1 | University of Parma |
| Federico Pirazzoli | 1 | University of Parma |
| Filippo D’Addeo | 2 | University of Bologna |
| Lorenzo Cipelli | 1 | University of Parma |
| Nicola Marinello | 3 | VisLab, an Ambarella Inc. company |
| Massimo Bertozzi | 1 | University of Parma |

University of Bologna was explicitly requested by the author. Its logo is from the university’s official homepage. VisLab’s existing logo is retained alongside its parent company, Ambarella.

OpenReview was consulted as requested. Only [Massimo Bertozzi](https://openreview.net/profile?id=~Massimo_Bertozzi1) was readable and listed Parma. Other profiles required browser verification or could not be retrieved; both public APIs returned HTTP 403. The subsequent author-provided affiliations above take precedence, including the latest correction assigning Bertozzi only to Parma. No profile links are shown on the author names.

The anonymous paper and supplementary PDFs are no longer included in the deployable `dist/` directory. The BibTeX is intentionally blank until the final citation is supplied.

## Original figures and interactive visualizations

The analytic construction laboratory (`dist/field-lab.js`) is a code-drawn canvas demonstration with illustrative lane geometry, not an experimental figure or a model prediction. Its segment-integral, tensor and confidence equations follow main-paper §3.2 (`hd_mapping_bertogalli/sec/3_method.tex`). The finite-segment error-function evaluation follows supplementary `sec/1_derivation.tex`; target saturation, trace normalization and sigmoid mask follow `sec/2.5_implementation_details.tex`, using τP = 1, k = 20 and τm = 0.3. The demo fixes lane width at 3.5 m and σ at 1.75 m to isolate the construction before the original spread-factor figures. Gaussian integration uses a deterministic numerical approximation of erf, verified against independent quadrature in the accompanying checks. No original research image is modified by the demo.

The source-to-web mapping is recorded in `scripts/figure_sources.json`. Assets are generated by `scripts/prepare_figures.py`: PDFs are rasterized with Poppler at explicit resolutions, and full-size web images are encoded as lossless WebP. Large assets also have resized, quality-90 WebP previews for inline display; the full-size copy loads only when enlarged. All source PDFs and PNGs are preserved. No research content is cropped, recolored, synthesized, or interpolated between experimental settings.

The supplementary figure captions and interpretations follow the supplied LaTeX under `hd_mapoing_bertogalli_supplementary/sec/`:

- `2_sigma_ablation.tex` and `tables/sigma_ablation.tex`: vector map and ground-truth fields at f = 0.25, 0.50, 0.75, and 1.00, with lane-edge weights 13%, 61%, 80%, and 88%. The selector switches between the provided images; these weights are analytic field-construction values, not model scores.
- `5_attention.tex` and `big_images.tex`: original/guided attention and overlays at road, intersection, and high-variance reference points; the last example shows the uncertainty gate's reliable regions. The selected head has a learned gate close to one.
- `tables/attention_metrics.tex`: Lane Attention → Guided Attention measurements of 35.3° → 11.4° alignment error, 13% → 62% anisotropy, and 33.2 m² → 78.2 m² coverage. Original plots from `angle_error_all_heads_mean.png`, `anisotropy_all_heads_mean.png`, and `area_all_heads_mean.png` show measurements across 1,000 validation samples.
- `4_variance.tex` and `big_images.tex`: three ground-truth/prediction/variance triplets for a driveway, parking entrance, and ambiguous free space.
- `6_modulation.tex`: `modulation_01.pdf` assets are retained locally; the PCA / clustering / UMAP feature-analysis section was removed from the page at the author’s request.
- `7_qualitative.tex` and `big_images.tex`: `qual_01.pdf`, `qual_02.pdf`, `failure_01.pdf`, and `failure_02.pdf`, including the documented roundabout and missed-crossing limitations.

Only rendered figures are added to the deployable site. Paper and supplementary manuscript downloads remain absent, and the BibTeX remains empty as requested.

The author’s latest correction assigns Massimo Bertozzi only to University of Parma (1), removes MUNER from the page, and requests the labels “University of Bologna” (2) and “VisLab, an Ambarella Inc. company” (3).

The field-construction explanation follows `hd_mapping_bertogalli/sec/3_method.tex`: the Gaussian line integral, directional outer-product accumulation, proximity sum, eigenvalue-based confidence, and five-channel field. The implementation note follows supplementary `sec/2.5_implementation_details.tex` and `sec/2_sigma_ablation.tex`. Formulas are rendered as native MathML before the Gaussian-spread explorer.
