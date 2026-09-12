# STARZ runtime ship artwork

The original PNG concept sheets remain in
`docs/design/imperial-command-v2/frotas/assets/`. This directory contains
their deterministic runtime crops: one WebP presentation and one WebP
thumbnail per approved class. They are presentation-only assets for the
Shipyard Design Catalog; they do not define gameplay stats or build
availability.

Runtime URLs are `/static/ships/presentation/<design-id>.webp` and
`/static/ships/thumbnail/<design-id>.webp`. The React registry maps the
eleven primary designs and maps only `horizon` to the current gameplay hull
`scout_hull`. Missing gameplay mappings remain `CONCEITO` and never receive a
build action. Strike craft are subordinate to Atlas and are not catalog rows.

The crops deliberately exclude orthographic grids, callouts, material guides
and multi-view layouts. A small amount of source title typography remains only
where removing it would cut into the approved hero silhouette; no pixels were
invented or reconstructed.

