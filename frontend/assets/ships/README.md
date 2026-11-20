# STARZ runtime ship artwork

Approved opaque PNG sources live in `source/`. This directory contains
deterministic derivatives: one opaque WebP presentation and one opaque WebP
thumbnail per approved class. They are presentation-only assets for the
Shipyard Design Catalog; they do not define gameplay stats or build
availability. Regenerate all eleven classes with
`scripts/build_ship_runtime_assets.sh`.

Runtime URLs are `/static/ships/presentation/<design-id>.webp` and
`/static/ships/thumbnail/<design-id>.webp`. The React registry maps the eleven
primary designs and maps only `horizon` to the current gameplay hull
`scout_hull`. Missing gameplay mappings remain `CONCEITO` and never receive a
build action. Strike craft are subordinate to Atlas and are not catalog rows.

The generator preserves each approved opaque `2048x1024` source, derives its
thumbnail from the presentation asset, and never segments ships, creates an
alpha mask, invents pixels, or changes gameplay. Concept sheets under
`docs/design/imperial-command-v2/frotas/assets/` are documentation/reference
only and are not generator inputs.
