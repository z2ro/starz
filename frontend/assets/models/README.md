# StarZ visual assets

Optional local models are loaded by `frontend/src/visual/AssetRegistry.ts`:

- `orbital_shipyard.glb` — orbital shipyard station
- `horizon.glb` — `scout_hull` / Horizon exploration corvette

Files are intentionally not bundled in this repository yet. Add original or
license-compatible CC0 assets at these paths; the renderer keeps its
procedural fallback when a file is absent or fails to load.

The asset registry caches source scenes and clones instances. Scene cleanup
must not dispose shared cached resources.
