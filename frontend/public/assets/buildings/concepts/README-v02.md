# STARZ 3.0 — Planetary installation concepts, batch 2

Six additional approved 3/4 isometric pixel-art facility sprites. Each asset has transparent background and 224 x 224 pixel dimensions. Use WebP in the frontend; PNG is provided as an editable/source reference.

| Installation (pt-BR) | Canonical asset basename |
| --- | --- |
| Laboratório de Engenharia Civil | `civil_engineering_lab` |
| Refinaria de combustível | `fuel_refinery` |
| Instituto de Ciência Fundamental | `fundamental_science_institute` |
| Manufatura avançada | `advanced_manufacturing` |
| Complexo de Pesquisa Militar | `military_research_complex` |
| Processador de materiais | `materials_processor` |

Files: `<basename>.webp` and `<basename>.png`, all inside this directory.

## Codex implementation notes

- This is a dedicated art branch; **do not merge or reset** the unpushed local working branch `experiment/persistent-universe`.
- Fetch `art/building-assets-alpha-v1` then selectively copy the 12 files into the working tree, preferably with `git restore --source=origin/art/building-assets-alpha-v1 -- frontend/public/assets/buildings/concepts/{...}` or equivalent non-destructive file extraction.
- Integrate six distinct new mappings, preserving the four previously approved facility images, grid, detail pane, mechanics and fallbacks.
- Validate browser loading, desktop/mobile screenshots, typecheck/build and focused UI tests; no `qa:full`, push, deploy or backend changes.
