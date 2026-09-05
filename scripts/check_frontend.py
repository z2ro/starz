from pathlib import Path


root = Path(__file__).parents[1] / "frontend"
source = root / "src/main.ts"
artifact = root / "app.js"
html = root / "index.html"
for path in (source, artifact, html, root / "styles.css"):
    assert path.exists(), path
assert "type State" in source.read_text()
assert "/static/app.js" in html.read_text()
assert "fetch('/api/state')" in source.read_text()
print("frontend source and browser artifact present")
