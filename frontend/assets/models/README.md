# StarZ visual assets

Local models are loaded by `frontend/src/visual/AssetRegistry.ts`:

- `orbital_shipyard.glb` — orbital shipyard station
- `horizon.glb` — `scout_hull` / Horizon exploration corvette

These files are authored by the deterministic Blender scripts in
`tools/blender/` and exported as GLB 2.0 with Principled materials embedded. To
regenerate them from the repository root:

```sh
PYTHONPATH=/path/to/blender-python-site blender -b --factory-startup --python tools/blender/build_horizon.py
PYTHONPATH=/path/to/blender-python-site blender -b --factory-startup --python tools/blender/build_orbital_shipyard.py
```

Blender 3.0.1's glTF exporter needs a compatible NumPy installation. The
current authoring convention is Blender Z-up with `+Z` as the Horizon forward
axis; the shipyard uses the same axis convention and both origins are centered
on the visual mass/hub. Models are authored at their intended relative scale:
Horizon is roughly one unit long and the shipyard is roughly four units wide; the
registry applies a small scene scale when placing them beside the planet.

Only original or license-compatible assets may replace these files. The
renderer keeps its procedural fallback when a file is absent or fails to load.

The asset registry caches source scenes and clones instances. Scene cleanup
must not dispose shared cached resources.
