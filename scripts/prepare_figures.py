"""Prepare web copies of author-supplied paper figures (Pillow and pdftoppm)."""
from pathlib import Path
import json
import subprocess
import tempfile
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
SOURCES = ROOT.parent
OUTPUT = ROOT / 'dist/assets/media/figures'
MAIN = 'hd_mapping_bertogalli/figures'
SUPP = 'hd_mapoing_bertogalli_supplementary/figures'
FIGURES = {
    'representation': (MAIN, 'introduction.pdf', 2200),
    'framework': (MAIN, 'Architecture.pdf', 2800),
    'modulation-block': (MAIN, 'SPADE.pdf', 1800),
    'attention-mechanism': (MAIN, 'new_attention.pdf', 2000),
    'qualitative-main': (MAIN, 'HD_results.pdf', 3400),
    'qualitative-crossing': (SUPP, 'qual_01.pdf', 2200),
    'qualitative-intersection': (SUPP, 'qual_02.pdf', 2200),
    'failure-roundabout': (SUPP, 'failure_01.pdf', 2200),
    'failure-crossing': (SUPP, 'failure_02.pdf', 2200),
    'feature-analysis': (SUPP, 'modulation_01.pdf', 2200),
    'spread-map': (SUPP, 'HD_MAP.png', None),
    'spread-025': (SUPP, '0.25.png', None),
    'spread-050': (SUPP, '0.5.png', None),
    'spread-075': (SUPP, '0.75.png', None),
    'spread-100': (SUPP, '1.0.png', None),
    'attention-road-original': (SUPP, 'Orig.png', None),
    'attention-road-guided': (SUPP, 'Deformed.png', None),
    'attention-road-overlay': (SUPP, 'Orig_Deformed.png', None),
    'attention-intersection-original': (SUPP, 'intersection_orig.png', None),
    'attention-intersection-guided': (SUPP, 'intersection_deformed.png', None),
    'attention-intersection-overlay': (SUPP, 'intersection_Orig_Deform.png', None),
    'attention-uncertain-original': (SUPP, '1140_BEV_orig_variance.png', None),
    'attention-uncertain-guided': (SUPP, '1140_BEV_deform_variance.png', None),
    'attention-uncertain-reliable': (SUPP, '1140_BEV_lower_bound.png', None),
    'uncertainty-driveway-gt': (SUPP, '78_edge_var_mean_gt.png', None),
    'uncertainty-driveway-pred': (SUPP, '78_edge_var_mean_pred.png', None),
    'uncertainty-driveway-variance': (SUPP, '78_high_variance.png', None),
    'uncertainty-parking-gt': (SUPP, '1141_gt.png', None),
    'uncertainty-parking-pred': (SUPP, '1141_pred.png', None),
    'uncertainty-parking-variance': (SUPP, '1141_variance.png', None),
    'uncertainty-free-space-gt': (SUPP, '90_gt.png', None),
    'uncertainty-free-space-pred': (SUPP, '90_pred.png', None),
    'uncertainty-free-space-variance': (SUPP, '90_variance.png', None),
    'attention-alignment': (SUPP, 'angle_error_all_heads_mean.png', None),
    'attention-anisotropy': (SUPP, 'anisotropy_all_heads_mean.png', None),
    'attention-area': (SUPP, 'area_all_heads_mean.png', None),
}

def main():
    OUTPUT.mkdir(parents=True, exist_ok=True)
    manifest = {}
    with tempfile.TemporaryDirectory(prefix='lane-field-figures-') as temporary:
        for name, (folder, filename, width) in FIGURES.items():
            source = SOURCES / folder / filename
            if source.suffix == '.pdf':
                rendered = Path(temporary) / name
                subprocess.run(['pdftoppm', '-f', '1', '-singlefile', '-scale-to-x', str(width), '-scale-to-y', '-1', '-png', str(source), str(rendered)], check=True)
                image = Image.open(rendered.with_suffix('.png')).convert('RGB')
            else:
                image = Image.open(source).convert('RGB')
            target = OUTPUT / f'{name}.webp'
            # Lossless encoding preserves the rendered pixels, scientific colors and labels.
            image.save(target, 'WEBP', lossless=True, method=6)
            manifest[name] = {'source': f'{folder}/{filename}', 'width': image.width, 'height': image.height, 'bytes': target.stat().st_size}
            if image.width > 1600 or target.stat().st_size > 180 * 1024:
                preview = image.copy()
                limit = 960 if name.startswith('uncertainty-') else 1440
                if preview.width > limit:
                    preview = preview.resize((limit, round(preview.height * limit / preview.width)), Image.Resampling.LANCZOS)
                preview_path = OUTPUT / f'{name}-preview.webp'
                preview.save(preview_path, 'WEBP', quality=90, method=6)
                manifest[name].update(preview=preview_path.name, preview_width=preview.width, preview_height=preview.height)
            print(f'{name}: {image.width} × {image.height}, {target.stat().st_size // 1024} KiB', flush=True)
    (ROOT / 'scripts/figure_sources.json').write_text(json.dumps(manifest, indent=2) + '\n')
    print(f'Total: {sum(x["bytes"] for x in manifest.values()) / 1024 / 1024:.2f} MiB')

if __name__ == '__main__':
    main()
