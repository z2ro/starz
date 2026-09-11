from pathlib import Path


root = Path(__file__).parents[1] / "frontend"
source = root / "src/main.tsx"
artifact = root / "dist"
html = artifact / "index.html"
for path in (source, artifact, html, root / "styles.css"):
    assert path.exists(), path
assert "createRoot" in source.read_text()
assert "/static/" in html.read_text()
assert any(path.suffix in {".js", ".css"} for path in artifact.rglob("*"))
print("frontend React source and Vite artifact present")
