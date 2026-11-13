# STARZ 3.0 — Planetary Building Visual Assets · Alpha v0.1

Four original 224×224 transparent RGBA building sprites, in PNG and WebP, for the `Instalações` UI. This is an art-only branch — it does not change game rules, frontend code or the persistent database.

## Download

- **Complete ZIP**: [STARZ_3_building_assets_alpha_v01.zip](./STARZ_3_building_assets_alpha_v01.zip) — contains four PNGs, four WebPs and a preview.
- **WebP individually** (recommended for frontend): [ferrite_extractor.webp](./ferrite_extractor.webp), [civil_district.webp](./civil_district.webp), [planetary_research_center.webp](./planetary_research_center.webp), [orbital_shipyard.webp](./orbital_shipyard.webp).
- PNG originals with identical basenames are also provided for image-editing work.
- [Old 64×64 atlas](./buildings-atlas-64.webp) remains solely for visual comparison; **do not upscale it**.

## Sprite mapping

| Gameplay object | Asset basename |
| --- | --- |
| Ferrite Extractor | `ferrite_extractor` |
| Civil District | `civil_district` |
| Planetary Research Center | `planetary_research_center` |
| Orbital Shipyard | `orbital_shipyard` |

All individual files are 224×224 pixels with transparency; isometric, dark industrial sci-fi, cyan and amber illumination, no embedded text.

## Safe integration into the newer local development checkout

The branch `art/building-assets-alpha-v1` was created from an older GitHub checkpoint because the owner's working branch contains newer **unpushed** Codex commits. Do **not** merge or reset a development branch against this older art branch.

From the current local `experiment/persistent-universe` checkout:

```bash
git fetch origin art/building-assets-alpha-v1
git restore --source=origin/art/building-assets-alpha-v1 -- frontend/public/assets/buildings/concepts
```

If the current frontend uses `frontend/assets/buildings/concepts/` rather than `frontend/public/assets/buildings/concepts/`, copy only the four high-resolution WebP files to its active asset directory and update paths in the current UI; do not overwrite local source code.

Test in the current `#/development` view with `object-fit: contain` / stable aspect ratio. Do not enlarge cards or redesign the approved grid. Keep icon fallback for buildings without art. Run only frontend typecheck, build and targeted Chromium visual check. Do not change economy or mechanics.

Before committing local frontend changes, inspect `git status`, preserve unpushed work and avoid committing the ZIP unless a bundled download is intentionally needed.
